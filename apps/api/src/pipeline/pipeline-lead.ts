export const LEAD_ID_FIELD_KEY = "scout_lead_id";
export const PREVIEW_BASE_URL = "https://handsomesites.com/p";

const WEEK = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export type PipelineLeadRow = {
	lead: Record<string, unknown>;
	research: Record<string, unknown> | null;
	previewSlug: string | null;
};

export type PipelineLeadOptions = {
	photoBaseUrl?: string | null;
};

export type PipelinePerson = {
	name: string | null;
	role: string | null;
	source: string | null;
	checkedAt: string | null;
	phones: { number: string; lineType: string | null }[];
	emails: { address: string; verdict: string | null }[];
};

export type PipelineLead = {
	id: string;
	status: string | null;
	score: number | null;
	disposition: string | null;
	dispositionReason: string | null;
	industry: string | null;
	metro: string | null;
	websiteStatus: string | null;
	websiteUrl: string | null;
	websiteEvidence: string | null;
	bookingUrl: string | null;
	rating: number | null;
	reviewCount: number | null;
	mapsRank: { position: number; query: string } | null;
	address: string | null;
	phone: string | null;
	mapsUrl: string | null;
	owner: PipelinePerson | null;
	ownerStatus: "found" | "not_determined" | null;
	people: PipelinePerson[];
	businessPhones: string[];
	businessEmails: string[];
	summary: string | null;
	vibe: string | null;
	services: string[];
	differentiators: string[];
	hours: { day: string | null; hours: string }[];
	logoUrl: string | null;
	brandColors: string[];
	reviews: {
		author: string | null;
		rating: number | null;
		text: string;
		date: string | null;
		source: string | null;
		url: string | null;
	}[];
	photos: { url: string; caption: string | null; source: string | null }[];
	links: {
		social: string[];
		yelp: string | null;
		linkedin: string[];
		directories: string[];
		sources: string[];
	};
	offer: {
		name: string | null;
		status: string | null;
		dreamOutcome: string | null;
		likelihood: string | null;
		timeDelay: string | null;
		effort: string | null;
		guarantee: string | null;
		slots: { slot: string | null; copy: string; clientFact: string | null }[];
	} | null;
	competition: {
		baselineAt: string | null;
		queries: string[];
		maps: { query: string; position: number | null }[];
		google: {
			query: string;
			inMapPack: boolean | null;
			inAiOverview: boolean | null;
			organicPosition: number | null;
		}[];
		yelp: {
			rating: number | null;
			reviewCount: number | null;
			claimed: boolean | null;
			position: number | null;
			praise: string[];
			complaints: string[];
		} | null;
		nextdoor: { praise: string[]; complaints: string[] } | null;
		directories: {
			name: string;
			rating: number | null;
			present: boolean | null;
		}[];
		social: {
			network: string;
			followers: number | null;
			lastPostAt: string | null;
		}[];
		competitors: {
			name: string;
			whyPicked: string | null;
			maps: { query: string; position: number | null }[];
		}[];
		gaps: {
			signal: string;
			clientValue: string | null;
			winnersMedian: string | null;
			score: number | null;
		}[];
		aiShareOfVoice: {
			engine: string | null;
			prompt: string;
			namedCount: number | null;
			citedCount: number | null;
			runs: number | null;
		}[];
	} | null;
	trafficOpportunities: {
		keyword: string;
		signal: string | null;
		suggestedPage: string | null;
		intent: string | null;
		score: number | null;
	}[];
	sourcesRun: {
		source: string;
		status: string | null;
		count: number | null;
		costUsd: number | null;
		reason: string | null;
		checkedAt: string | null;
	}[];
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

function bool(value: unknown): boolean | null {
	return typeof value === "boolean" ? value : null;
}

function record(value: unknown): Record<string, unknown> | null {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

function list(value: unknown): unknown[] {
	return Array.isArray(value) ? value : [];
}

function records(value: unknown): Record<string, unknown>[] {
	return list(value)
		.map(record)
		.filter((row): row is Record<string, unknown> => row !== null);
}

function texts(...values: unknown[]): string[] {
	const out = new Set<string>();
	for (const value of values) {
		for (const entry of list(value)) {
			const item = text(entry);
			if (item) out.add(item);
		}
	}
	return [...out];
}

function rankList(value: unknown) {
	return records(value).flatMap((row) => {
		const query = text(row.query);
		return query ? [{ query, position: num(row.position) }] : [];
	});
}

function bestMapsRank(packet: Record<string, unknown> | null) {
	const ranking = record(packet?.competitive_ranking);
	const maps = record(record(ranking?.client)?.maps);
	let best: { position: number; query: string } | null = null;
	for (const row of rankList(maps?.rankByQuery)) {
		if (row.position === null) continue;
		if (!best || row.position < best.position) {
			best = { position: row.position, query: row.query };
		}
	}
	return best;
}

function entries<T>(
	values: unknown,
	legacy: unknown,
	valueKey: string,
	labelKey: string,
	build: (value: string, label: string | null) => T,
): T[] {
	const out: T[] = [];
	for (const entry of list(values)) {
		const row = record(entry);
		const value = row ? text(row[valueKey]) : text(entry);
		if (value) out.push(build(value, row ? text(row[labelKey]) : null));
	}
	const single = text(legacy);
	if (out.length === 0 && single) out.push(build(single, null));
	return out;
}

function toPerson(person: Record<string, unknown>): PipelinePerson {
	return {
		name: text(person.name),
		role: text(person.role),
		source: text(person.source),
		checkedAt: text(person.checked_at) ?? text(person.checkedAt),
		phones: entries(
			person.phones,
			person.phone,
			"number",
			"line_type",
			(number, lineType) => ({ number, lineType }),
		),
		emails: entries(
			person.emails,
			person.email,
			"address",
			"verdict",
			(address, verdict) => ({ address, verdict }),
		),
	};
}

function namedPeople(contacts: Record<string, unknown> | null) {
	return records(contacts?.people).filter((person) => text(person.name));
}

function pickOwner(contacts: Record<string, unknown> | null) {
	const named = namedPeople(contacts);
	const person =
		named.find((p) => /owner|founder|proprietor/i.test(text(p.role) ?? "")) ??
		named[0];
	return person ? toPerson(person) : null;
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

function hours(value: unknown): PipelineLead["hours"] {
	const single = text(value);
	if (single) return [{ day: null, hours: single }];
	const week = record(value);
	if (!week) return [];
	const days = [
		...WEEK.filter((day) => day in week),
		...Object.keys(week).filter((day) => !WEEK.includes(day)),
	];
	return days.flatMap((day) => {
		const value = text(week[day]);
		return value ? [{ day, hours: value }] : [];
	});
}

function photoUrl(path: string, base: string | null | undefined) {
	if (/^https?:\/\//i.test(path)) return path;
	if (!base) return null;
	return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

function photos(value: unknown, base: string | null | undefined) {
	return records(value).flatMap((row) => {
		const path = text(row.storagePath) ?? text(row.url);
		const url = path ? photoUrl(path, base) : null;
		return url
			? [{ url, caption: text(row.caption), source: text(row.source) }]
			: [];
	});
}

function reviews(value: unknown): PipelineLead["reviews"] {
	return records(value).flatMap((row) => {
		const body = text(row.text);
		return body
			? [
					{
						author: text(row.author),
						rating: num(row.rating),
						text: body,
						date: text(row.date),
						source: text(row.source),
						url: text(row.url),
					},
				]
			: [];
	});
}

function offer(value: unknown): PipelineLead["offer"] {
	const angle = record(value);
	if (!angle) return null;
	return {
		name: text(angle.offerName),
		status: text(angle.status),
		dreamOutcome: text(angle.dreamOutcome),
		likelihood: text(angle.likelihood),
		timeDelay: text(angle.timeDelay),
		effort: text(angle.effort),
		guarantee: text(angle.guaranteeSentence),
		slots: records(angle.slots).flatMap((row) => {
			const copy = text(row.copy);
			return copy
				? [{ slot: text(row.slot), copy, clientFact: text(row.clientFact) }]
				: [];
		}),
	};
}

function themes(value: unknown) {
	const row = record(value);
	return row
		? {
				praise: texts(row.praiseThemes),
				complaints: texts(row.complaintThemes),
			}
		: null;
}

function competition(value: unknown): PipelineLead["competition"] {
	const ranking = record(value);
	if (!ranking) return null;
	const client = record(ranking.client);
	const yelp = record(client?.yelp);
	const yelpThemes = themes(yelp);
	return {
		baselineAt: text(ranking.baselineAt),
		queries: texts(ranking.queryPanel),
		maps: rankList(record(client?.maps)?.rankByQuery),
		google: records(record(client?.google)?.byQuery).flatMap((row) => {
			const query = text(row.query);
			return query
				? [
						{
							query,
							inMapPack: bool(row.inMapPack),
							inAiOverview: bool(row.inAiOverview),
							organicPosition: num(row.organicPosition),
						},
					]
				: [];
		}),
		yelp:
			yelp && yelpThemes
				? {
						rating: num(yelp.rating),
						reviewCount: num(yelp.reviewCount),
						claimed: bool(yelp.claimed),
						position: num(yelp.position),
						...yelpThemes,
					}
				: null,
		nextdoor: themes(client?.nextdoor),
		directories: records(client?.directories).flatMap((row) => {
			const name = text(row.name);
			return name
				? [{ name, rating: num(row.rating), present: bool(row.present) }]
				: [];
		}),
		social: records(client?.social).flatMap((row) => {
			const network = text(row.network);
			return network
				? [
						{
							network,
							followers: num(row.followers),
							lastPostAt: text(row.lastPostAt),
						},
					]
				: [];
		}),
		competitors: records(ranking.competitors).flatMap((row) => {
			const name = text(row.name);
			return name
				? [
						{
							name,
							whyPicked: text(row.whyPicked),
							maps: rankList(record(record(row.standing)?.maps)?.rankByQuery),
						},
					]
				: [];
		}),
		gaps: records(ranking.gaps).flatMap((row) => {
			const signal = text(row.signal);
			return signal
				? [
						{
							signal,
							clientValue: text(row.clientValue),
							winnersMedian: text(row.winnersMedian),
							score: num(row.score),
						},
					]
				: [];
		}),
		aiShareOfVoice: records(ranking.aiShareOfVoice).flatMap((row) => {
			const prompt = text(row.prompt);
			return prompt
				? [
						{
							engine: text(row.engine),
							prompt,
							namedCount: num(row.namedCount),
							citedCount: num(row.citedCount),
							runs: num(row.runs),
						},
					]
				: [];
		}),
	};
}

function trafficOpportunities(
	value: unknown,
): PipelineLead["trafficOpportunities"] {
	return records(value).flatMap((row) => {
		const keyword = text(row.keyword);
		return keyword
			? [
					{
						keyword,
						signal: text(row.signal),
						suggestedPage: text(row.suggestedPage),
						intent: text(row.intent),
						score: num(row.score),
					},
				]
			: [];
	});
}

function sourcesRun(...logs: unknown[]): PipelineLead["sourcesRun"] {
	return logs.flatMap((log) =>
		Object.entries(record(log) ?? {}).flatMap(([source, value]) => {
			const row = record(value);
			return row
				? [
						{
							source,
							status: text(row.status),
							count: num(row.count),
							costUsd: num(row.cost_usd),
							reason: text(row.reason),
							checkedAt: text(row.checked_at),
						},
					]
				: [];
		}),
	);
}

export function toPipelineLead(
	row: PipelineLeadRow,
	options: PipelineLeadOptions = {},
): PipelineLead {
	const { lead, research, previewSlug } = row;
	const contacts = record(research?.contacts);
	const packet = record(research?.positioning_packet);
	const owner = pickOwner(contacts);

	return {
		id: String(lead.id),
		status: text(lead.status),
		score: num(lead.score),
		disposition: text(lead.disposition),
		dispositionReason: text(lead.disposition_reason),
		industry:
			text(lead.industry) ?? text(contacts?.industry) ?? text(lead.category),
		metro: metro(lead),
		websiteStatus: text(lead.website_verdict),
		websiteUrl: text(lead.website_url),
		websiteEvidence: text(lead.website_evidence),
		bookingUrl: text(lead.booking_url),
		rating: num(lead.rating),
		reviewCount: num(lead.review_count),
		mapsRank: bestMapsRank(packet),
		address: text(lead.address) ?? text(contacts?.address),
		phone: text(lead.phone),
		mapsUrl: text(lead.maps_url),
		owner,
		ownerStatus: ownerStatus(contacts, owner),
		people: namedPeople(contacts).map(toPerson),
		businessPhones: texts(contacts?.phones),
		businessEmails: texts(contacts?.emails),
		summary: text(research?.summary_md),
		vibe: text(research?.vibe),
		services: texts(research?.services),
		differentiators: texts(research?.differentiators),
		hours: hours(research?.hours),
		logoUrl: text(research?.logo_url),
		brandColors: texts(research?.brand_colors),
		reviews: reviews(research?.reviews),
		photos: photos(research?.photos, options.photoBaseUrl),
		links: {
			social: texts(research?.social_links, contacts?.socialLinks),
			yelp: text(contacts?.yelpUrl),
			linkedin: texts(contacts?.linkedin),
			directories: texts(contacts?.thirdPartyLinks),
			sources: texts(research?.sources),
		},
		offer: offer(packet?.offer_angle),
		competition: competition(packet?.competitive_ranking),
		trafficOpportunities: trafficOpportunities(packet?.traffic_opportunities),
		sourcesRun: sourcesRun(research?.sources_run, contacts?.sources_run),
		previewUrl: previewSlug ? `${PREVIEW_BASE_URL}/${previewSlug}` : null,
		reportUrl: text(record(packet?.files)?.reportDocUrl),
	};
}
