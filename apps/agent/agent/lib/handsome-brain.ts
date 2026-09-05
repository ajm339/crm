// Read-only access to Handsome Sites' shared knowledge, which lives in the same
// Postgres as the CRM: the company brain (gbrain, `public.pages`) and the
// scouting pipeline (`public.leads` / `public.research`). These let eve ground
// answers in what the Claude agents (Scout/Build/BizDev) already know and found,
// exactly as they do. Everything here is READ-ONLY — eve's writes stay in the CRM.
//
// The CRM's Prisma client is schema-qualified to `crm`; these queries name the
// `public` schema explicitly, so they work regardless of the connection's
// search_path. Parameters are bound (never interpolated).
import { db } from "@crm/db";

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
	const rows = await db.$queryRawUnsafe<BrainHit[]>(
		`SELECT p.slug,
		        p.title,
		        p.type,
		        left(regexp_replace(coalesce(p.compiled_truth, ''), '\\s+', ' ', 'g'), 600) AS snippet,
		        ts_rank(p.search_vector, websearch_to_tsquery('english', $1))::float8 AS rank
		   FROM public.pages p
		  WHERE p.deleted_at IS NULL
		    AND p.search_vector @@ websearch_to_tsquery('english', $1)
		  ORDER BY rank DESC
		  LIMIT $2`,
		query,
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
