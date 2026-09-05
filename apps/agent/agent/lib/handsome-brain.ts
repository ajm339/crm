// Read-only access to Handsome Sites' shared knowledge, which lives in the same
// Postgres as the CRM: the company brain (gbrain, `public.pages`) and the
// scouting pipeline (`public.leads` / `public.research`). These let eve ground
// answers in what the Claude agents (Scout/Build/BizDev) already know and found,
// exactly as they do. Everything here is READ-ONLY — eve's writes stay in the CRM.
//
// The CRM's Prisma client is schema-qualified to `crm`; these queries name the
// `public` schema explicitly, so they work regardless of the connection's
// search_path. Parameters are bound (never interpolated).
import { createHash } from "node:crypto";
import { db } from "@crm/db";

// gbrain embeds with voyage-3-large at 1024 dims (embedding_signature
// "voyage:voyage-3-large:1024"); the Vercel AI Gateway serves that exact model,
// so eve writes brain pages that are recall-able the same way the CLI's are.
const EMBED_MODEL = "voyage/voyage-3-large";
const EMBED_SIGNATURE = "voyage:voyage-3-large:1024";

async function embedText(text: string): Promise<number[]> {
	const key = process.env.AI_GATEWAY_API_KEY;
	if (!key) throw new Error("AI_GATEWAY_API_KEY is not set — cannot embed for gbrain.");
	const r = await fetch("https://ai-gateway.vercel.sh/v1/embeddings", {
		method: "POST",
		headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
		body: JSON.stringify({ model: EMBED_MODEL, input: text }),
	});
	if (!r.ok) throw new Error(`embed ${r.status}: ${(await r.text()).slice(0, 160)}`);
	const j = (await r.json()) as { data: Array<{ embedding: number[] }> };
	const first = j.data[0];
	if (!first) throw new Error("embed: no embedding returned.");
	return first.embedding;
}

function chunkText(text: string, size = 1800): string[] {
	const paras = text.split(/\n\n+/);
	const out: string[] = [];
	let buf = "";
	for (const p of paras) {
		if ((buf + "\n\n" + p).length > size && buf) {
			out.push(buf.trim());
			buf = p;
		} else {
			buf = buf ? buf + "\n\n" + p : p;
		}
	}
	if (buf.trim()) out.push(buf.trim());
	return out.length ? out : [text];
}

const vec = (arr: number[]) => `[${arr.join(",")}]`;

/** Re-chunk + re-embed one page's content into content_chunks (matching gbrain's
 * format), then stamp the page's embedding_signature. Used by both the write tool
 * and the backlog indexer. */
async function embedPageChunks(pageId: number, content: string): Promise<number> {
	await db.$queryRawUnsafe(`DELETE FROM public.content_chunks WHERE page_id = $1`, pageId);
	const chunks = chunkText(content);
	for (let i = 0; i < chunks.length; i++) {
		const chunk = chunks[i] as string;
		const embedding = await embedText(chunk);
		await db.$queryRawUnsafe(
			`INSERT INTO public.content_chunks
			   (page_id, chunk_index, chunk_text, embedding, model, token_count, chunk_source, modality, embedded_at)
			 VALUES ($1, $2, $3, $4::vector, 'voyage:voyage-3-large', $5, 'compiled_truth', 'text', now())`,
			pageId,
			i,
			chunk,
			vec(embedding),
			Math.ceil(chunk.length / 4),
		);
	}
	await db.$queryRawUnsafe(
		`UPDATE public.pages SET embedding_signature = $2 WHERE id = $1`,
		pageId,
		EMBED_SIGNATURE,
	);
	return chunks.length;
}

/**
 * Write (create or update) a company-brain page and embed it inline so it is
 * immediately recall-able by `search_gbrain` and by the other agents' `gbrain
 * query` — the same as a CLI-written page. Upserts on (source_id, slug).
 */
export async function putBrainPage(input: {
	slug: string;
	title: string;
	content: string;
	type?: string;
}): Promise<{ slug: string; chunks: number }> {
	const hash = createHash("sha256").update(input.content).digest("hex");
	const rows = await db.$queryRawUnsafe<Array<{ id: number }>>(
		`INSERT INTO public.pages
		   (source_id, slug, type, title, compiled_truth, content_hash, source_kind, ingested_via, embedding_signature)
		 VALUES ('default', $1, $2, $3, $4, $5, 'eve', 'eve-agent', NULL)
		 ON CONFLICT (source_id, slug) DO UPDATE SET
		   title = excluded.title,
		   compiled_truth = excluded.compiled_truth,
		   content_hash = excluded.content_hash,
		   embedding_signature = NULL,
		   updated_at = now()
		 RETURNING id`,
		input.slug,
		input.type ?? "note",
		input.title,
		input.content,
		hash,
	);
	const pageId = rows[0]!.id;
	const chunks = await embedPageChunks(pageId, input.content);
	return { slug: input.slug, chunks };
}

/**
 * Index brain pages that have no embedding yet (the re-embed backlog), so
 * `gbrain query` recall stays complete. Runs on eve's cron; bounded per run.
 */
export async function reembedUnindexed(limit: number): Promise<{ embedded: number; slugs: string[] }> {
	const pages = await db.$queryRawUnsafe<Array<{ id: number; slug: string; compiled_truth: string | null }>>(
		`SELECT id, slug, compiled_truth
		   FROM public.pages
		  WHERE embedding_signature IS NULL AND deleted_at IS NULL AND coalesce(compiled_truth, '') <> ''
		  ORDER BY updated_at DESC
		  LIMIT $1`,
		limit,
	);
	const slugs: string[] = [];
	for (const p of pages) {
		await embedPageChunks(p.id, p.compiled_truth ?? "");
		slugs.push(p.slug);
	}
	return { embedded: pages.length, slugs };
}

export interface BrainHit {
	slug: string;
	title: string | null;
	type: string | null;
	snippet: string;
	rank: number;
}

/**
 * Full-text search the company brain (gbrain pages) and return the most relevant
 * pages with a snippet. This is the same knowledge base the Claude agents recall
 * from — GTM angles, pricing rationale, objection handling, decisions. Uses
 * Postgres full-text ranking over the page's compiled content.
 */
export async function searchBrain(query: string, limit: number): Promise<BrainHit[]> {
	// gbrain's own recall is vector-semantic; here we approximate with Postgres
	// full-text over the OR of the query's words (any term can match, ranked by
	// relevance) — natural-language queries like "eve pricing model" then return
	// the best pages instead of requiring every word in one page. Terms are
	// sanitized to bare lexemes so the tsquery can't be injected or malformed.
	const terms = (query.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((t) => t.length > 1);
	if (terms.length === 0) return [];
	const tsquery = terms.join(" | ");
	const rows = await db.$queryRawUnsafe<BrainHit[]>(
		`SELECT p.slug,
		        p.title,
		        p.type,
		        left(regexp_replace(coalesce(p.compiled_truth, ''), '\\s+', ' ', 'g'), 600) AS snippet,
		        ts_rank(p.search_vector, to_tsquery('english', $1))::float8 AS rank
		   FROM public.pages p
		  WHERE p.deleted_at IS NULL
		    AND p.search_vector @@ to_tsquery('english', $1)
		  ORDER BY rank DESC
		  LIMIT $2`,
		tsquery,
		limit,
	);
	return rows;
}

export interface BrainPage {
	slug: string;
	title: string | null;
	content: string;
	updatedAt: string | null;
}

/** Fetch one brain page's full content by slug (the `get` an agent would run). */
export async function getBrainPage(slug: string): Promise<BrainPage | null> {
	const rows = await db.$queryRawUnsafe<
		Array<{ slug: string; title: string | null; compiled_truth: string | null; updated_at: Date | null }>
	>(
		`SELECT slug, title, compiled_truth, updated_at
		   FROM public.pages
		  WHERE slug = $1 AND deleted_at IS NULL
		  LIMIT 1`,
		slug,
	);
	const r = rows[0];
	if (!r) return null;
	return {
		slug: r.slug,
		title: r.title,
		content: r.compiled_truth ?? "",
		updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null,
	};
}

export interface PipelineLead {
	id: string;
	name: string;
	status: string | null;
	category: string | null;
	city: string | null;
	state: string | null;
	websiteUrl: string | null;
	websiteVerdict: string | null;
	disposition: string | null;
	dispositionReason: string | null;
	email: string | null;
	researchSummary: string | null;
}

/**
 * Read a scouting lead and its research by lead id — the pipeline row the Claude
 * agents work from (discovery → verify → research → the positioning packet). Lets
 * eve ground a CRM answer in what Scout actually found on that business.
 */
export async function readPipelineLead(leadId: string): Promise<PipelineLead | null> {
	const rows = await db.$queryRawUnsafe<
		Array<Record<string, unknown>>
	>(
		`SELECT l.id, l.name, l.status, l.category, l.city, l.state,
		        l.website_url, l.website_verdict, l.disposition, l.disposition_reason, l.email,
		        r.summary_md AS research_summary
		   FROM public.leads l
		   LEFT JOIN public.research r ON r.lead_id = l.id
		  WHERE l.id = $1
		  LIMIT 1`,
		leadId,
	);
	const r = rows[0];
	if (!r) return null;
	return mapLead(r);
}

/** Find pipeline leads by name (fuzzy) and/or status — a lookup, newest first. */
export async function searchPipelineLeads(
	opts: { name?: string; status?: string; limit: number },
): Promise<PipelineLead[]> {
	const rows = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(
		`SELECT l.id, l.name, l.status, l.category, l.city, l.state,
		        l.website_url, l.website_verdict, l.disposition, l.disposition_reason, l.email,
		        r.summary_md AS research_summary
		   FROM public.leads l
		   LEFT JOIN public.research r ON r.lead_id = l.id
		  WHERE ($1::text IS NULL OR l.name ILIKE '%' || $1 || '%')
		    AND ($2::text IS NULL OR l.status = $2)
		  ORDER BY l.created_at DESC
		  LIMIT $3`,
		opts.name ?? null,
		opts.status ?? null,
		opts.limit,
	);
	return rows.map(mapLead);
}

// The pipeline status machine, mirrored from @wbp/pipeline-core status.ts so eve
// can change a lead's status without being able to make an illegal jump — the
// same guard Scout/Build/BizDev get from the Repo. Keep in sync with that file.
const LEAD_TRANSITIONS: Record<string, string[]> = {
	discovered: ["verified_no_site", "verified_bad_site", "rejected_has_site"],
	verified_no_site: ["researched", "closed_lost"],
	verified_bad_site: ["researched", "closed_lost"],
	rejected_has_site: [],
	researched: ["landing_drafted", "closed_lost"],
	landing_drafted: ["landing_deployed"],
	landing_deployed: ["outreach_queued"],
	outreach_queued: ["outreach_approved", "closed_lost"],
	outreach_approved: ["contacted"],
	contacted: ["replied", "closed_lost"],
	replied: ["in_conversation", "closed_lost"],
	in_conversation: ["requirements_gathered", "closed_lost"],
	requirements_gathered: ["pitch_drafted"],
	pitch_drafted: ["pitch_approved", "closed_lost"],
	pitch_approved: ["pitched"],
	pitched: ["aligned", "closed_lost"],
	aligned: ["build_in_progress"],
	build_in_progress: ["built"],
	built: ["delivered_replit"],
	delivered_replit: ["closed_won", "closed_lost"],
	closed_won: [],
	closed_lost: [],
};

export interface LeadUpdate {
	status?: string;
	disposition?: string;
	dispositionReason?: string;
}

/**
 * Update a pipeline lead. A status change is validated against the status machine
 * (an illegal jump throws, so eve can advance a lead but never corrupt the
 * pipeline); disposition/reason are free edits. Every change logs a `public.events`
 * row as agent `eve` for the audit trail the other agents share.
 */
export async function updateLead(leadId: string, patch: LeadUpdate): Promise<PipelineLead> {
	const cur = await db.$queryRawUnsafe<Array<{ status: string | null }>>(
		`SELECT status FROM public.leads WHERE id = $1 LIMIT 1`,
		leadId,
	);
	const curRow = cur[0];
	if (!curRow) throw new Error(`No pipeline lead with id ${leadId}.`);

	if (patch.status !== undefined) {
		const from = curRow.status ?? "";
		const allowed = LEAD_TRANSITIONS[from];
		if (!allowed) throw new Error(`Unknown current status "${from}" for lead ${leadId}.`);
		if (from !== patch.status && !allowed.includes(patch.status)) {
			throw new Error(
				`Illegal status transition ${from} -> ${patch.status}. Allowed from ${from}: ${allowed.join(", ") || "(none)"}.`,
			);
		}
	}

	const sets: string[] = [];
	const vals: unknown[] = [];
	let i = 1;
	if (patch.status !== undefined) { sets.push(`status = $${i++}`); vals.push(patch.status); }
	if (patch.disposition !== undefined) { sets.push(`disposition = $${i++}`); vals.push(patch.disposition); }
	if (patch.dispositionReason !== undefined) { sets.push(`disposition_reason = $${i++}`); vals.push(patch.dispositionReason); }
	if (sets.length === 0) throw new Error("Nothing to update (provide status, disposition, or dispositionReason).");
	vals.push(leadId);
	await db.$queryRawUnsafe(`UPDATE public.leads SET ${sets.join(", ")} WHERE id = $${i}`, ...vals);

	await db.$queryRawUnsafe(
		`INSERT INTO public.events (lead_id, agent, action, detail) VALUES ($1, 'eve', 'update_lead', $2::jsonb)`,
		leadId,
		JSON.stringify(patch),
	);

	const updated = await readPipelineLead(leadId);
	if (!updated) throw new Error(`Lead ${leadId} vanished after update.`);
	return updated;
}

function mapLead(r: Record<string, unknown>): PipelineLead {
	return {
		id: String(r.id),
		name: String(r.name),
		status: (r.status as string) ?? null,
		category: (r.category as string) ?? null,
		city: (r.city as string) ?? null,
		state: (r.state as string) ?? null,
		websiteUrl: (r.website_url as string) ?? null,
		websiteVerdict: (r.website_verdict as string) ?? null,
		disposition: (r.disposition as string) ?? null,
		dispositionReason: (r.disposition_reason as string) ?? null,
		email: (r.email as string) ?? null,
		researchSummary: (r.research_summary as string) ?? null,
	};
}
