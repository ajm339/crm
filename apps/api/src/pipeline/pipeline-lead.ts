export const LEAD_ID_FIELD_KEY = "scout_lead_id";
export const DISPOSITION_FIELD_KEY = "disposition";
export const PREVIEW_BASE_URL = "https://handsomesites.com/p";

export const DISPOSITION_LABELS: Record<string, string> = {
	pursue: "Pursue",
	not_worth_pursuing: "Not worth pursuing",
};

export type PipelineLeadRow = {
	lead: Record<string, unknown>;
	research: Record<string, unknown> | null;
	previewSlug: string | null;
};

export type PipelineLead = {
	id: string;
	status: string | null;
	disposition: string | null;
	dispositionReason: string | null;
	industry: string | null;
	metro: string | null;
	websiteStatus: string | null;
	websiteUrl: string | null;
	bookingUrl: string | null;
	rating: number | null;
	reviewCount: number | null;
	mapsRank: { position: number; query: string } | null;
	address: string | null;
	phone: string | null;
	mapsUrl: string | null;
	owner: {
		name: string | null;
		role: string | null;
		source: string | null;
		checkedAt: string | null;
	} | null;
	ownerStatus: "found" | "not_determined" | null;
	summary: string | null;
	previewUrl: string | null;
	reportUrl: string | null;
};

function text(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function num(value: unknown): number | null {
	if (value === null || value === undefined || value === "") return null;
	const parsed = typeof value === "number" ? value : Number(value);
	return Number.isFinite(parsed) ? parsed : null;
}

function record(value: unknown): Record<string, unknown> | null {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

function list(value: unknown): unknown[] {
	return Array.isArray(value) ? value : [];
}

function bestMapsRank(packet: Record<string, unknown> | null) {
	const ranking = record(packet?.competitive_ranking);
	const maps = record(record(ranking?.client)?.maps);
	let best: { position: number; query: string } | null = null;
	for (const entry of list(maps?.rankByQuery)) {
		const row = record(entry);
		const position = num(row?.position);
		const query = text(row?.query);
		if (position === null || query === null) continue;
		if (!best || position < best.position) best = { position, query };
	}
	return best;
}

function pickOwner(contacts: Record<string, unknown> | null) {
	const people = list(contacts?.people).map(record).filter(Boolean) as Record<
		string,
		unknown
	>[];
	const named = people.filter((person) => text(person.name));
	const person =
		named.find((p) => /owner|founder|proprietor/i.test(text(p.role) ?? "")) ??
		named[0];
	if (!person) return null;
	return {
		name: text(person.name),
		role: text(person.role),
		source: text(person.source),
		checkedAt: text(person.checked_at) ?? text(person.checkedAt),
	};
}

function ownerStatus(
	contacts: Record<string, unknown> | null,
	owner: PipelineLead["owner"],
): PipelineLead["ownerStatus"] {
	const stated = text(contacts?.owner_status) ?? text(contacts?.ownerStatus);
	if (stated === "found" || stated === "not_determined") return stated;
	if (owner) return "found";
	return contacts ? "not_determined" : null;
}

function metro(lead: Record<string, unknown>): string | null {
	const explicit = text(lead.metro);
	if (explicit) return explicit;
	const parts = [text(lead.city), text(lead.state)].filter(Boolean);
	return parts.length > 0 ? parts.join(", ") : null;
}

export function toPipelineLead(row: PipelineLeadRow): PipelineLead {
	const { lead, research, previewSlug } = row;
	const contacts = record(research?.contacts);
	const packet = record(research?.positioning_packet);
	const owner = pickOwner(contacts);

	return {
		id: String(lead.id),
		status: text(lead.status),
		disposition: text(lead.disposition),
		dispositionReason: text(lead.disposition_reason),
		industry:
			text(lead.industry) ?? text(contacts?.industry) ?? text(lead.category),
		metro: metro(lead),
		websiteStatus: text(lead.website_verdict),
		websiteUrl: text(lead.website_url),
		bookingUrl: text(lead.booking_url),
		rating: num(lead.rating),
		reviewCount: num(lead.review_count),
		mapsRank: bestMapsRank(packet),
		address: text(lead.address) ?? text(contacts?.address),
		phone: text(lead.phone),
		mapsUrl: text(lead.maps_url),
		owner,
		ownerStatus: ownerStatus(contacts, owner),
		summary: text(research?.summary_md),
		previewUrl: previewSlug ? `${PREVIEW_BASE_URL}/${previewSlug}` : null,
		reportUrl: text(record(packet?.files)?.reportDocUrl),
	};
}
