import { DealStage, EnrichmentStatus, RecordSource } from "@crm/db";
import { FIELD_TYPES } from "@crm/db/fields";
import { z } from "zod";
import { bulkIdsInput } from "../crm/bulk";
import { fieldEntity, recordFieldValues } from "../fields/fields.contracts";
import { activityFacetInput, listInput } from "../trpc/list-input";

export const companyListInput = listInput.extend({
	owner: z.array(z.string()).default([]),
	industry: z.array(z.string()).default([]),
	enrichment: z.array(z.string()).default([]),
	source: z.array(z.string()).default([]),
	activity: activityFacetInput.default([]),
	fields: z.record(z.string(), z.array(z.string())).default({}),
	archived: z.boolean().default(false),
});

export type CompanyListInput = z.infer<typeof companyListInput>;

export const companyCreateInput = z.object({
	name: z.string().trim().min(1, "A company needs a name."),
	domain: z.string().trim().optional(),
	ownerId: z.string().nullable().optional(),
});

export type CompanyCreateInput = z.infer<typeof companyCreateInput>;

const companyUpdateInput = z.object({
	name: z.string().trim().min(1).optional(),
	domain: z.string().optional(),
	website: z.string().optional(),
	description: z.string().optional(),
	industry: z.string().optional(),
	city: z.string().optional(),
	stateCode: z.string().optional(),
	country: z.string().optional(),
	phone: z.string().optional(),
	email: z.string().optional(),
	linkedinUrl: z.string().optional(),
	ownerId: z.string().nullable().optional(),
	fields: recordFieldValues.optional(),
});

export type CompanyUpdateInput = z.infer<typeof companyUpdateInput>;

export const companyUpdateArgs = z.object({
	id: z.string(),
	data: companyUpdateInput,
});

export const companyIdInput = z.object({ id: z.string() });

export const setPrimaryContactInput = z.object({
	companyId: z.string(),
	contactId: z.string().nullable(),
});

export const companyOptionsInput = z.object({
	q: z.string().default(""),
});

export const companyBulkInput = bulkIdsInput;

export const companyBulkOwnerInput = bulkIdsInput.extend({
	ownerId: z.string().nullable(),
});

export type CompanyBulkOwnerInput = z.infer<typeof companyBulkOwnerInput>;

const companyEnrichmentStatus = z.enum(
	Object.values(EnrichmentStatus) as [EnrichmentStatus, ...EnrichmentStatus[]],
);

const companyRecordSource = z.enum(
	Object.values(RecordSource) as [RecordSource, ...RecordSource[]],
);

const companyDealStage = z.enum(
	Object.values(DealStage) as [DealStage, ...DealStage[]],
);

const companyFieldType = z.enum(FIELD_TYPES);

const ownerSummaryOutput = z.object({
	id: z.string(),
	name: z.string(),
	email: z.string(),
	image: z.string().nullable(),
});

const companyFieldOptionOutput = z.object({
	id: z.string(),
	label: z.string(),
	position: z.number(),
});

const companyRecordFieldOutput = z.object({
	id: z.string(),
	entity: fieldEntity,
	key: z.string(),
	label: z.string(),
	type: companyFieldType,
	typeLabel: z.string(),
	agentFilled: z.boolean(),
	agentBrief: z.string().nullable(),
	required: z.boolean(),
	showOnSheet: z.boolean(),
	showOnTable: z.boolean(),
	showOnFilter: z.boolean(),
	position: z.number(),
	archived: z.boolean(),
	options: z.array(companyFieldOptionOutput),
	value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
});

export const companyRowOutput = z.object({
	id: z.string(),
	name: z.string(),
	domain: z.string().nullable(),
	iconUrl: z.string().nullable(),
	iconDarkUrl: z.string().nullable(),
	iconTone: z.string().nullable(),
	logoUrl: z.string().nullable(),
	brandColor: z.string().nullable(),
	industry: z.string().nullable(),
	enrichmentStatus: companyEnrichmentStatus,
	queued: z.boolean(),
	source: companyRecordSource,
	owner: ownerSummaryOutput.nullable(),
	contactCount: z.number(),
	openDealCount: z.number(),
	lastActivityAt: z.string().nullable(),
	createdAt: z.string(),
	archivedAt: z.string().nullable(),
	fields: recordFieldValues,
});

export type CompanyRow = z.infer<typeof companyRowOutput>;

export const companyListOutput = z.object({
	rows: z.array(companyRowOutput),
	total: z.number(),
	facetCounts: z.record(z.string(), z.record(z.string(), z.number())),
});

const companyDetailContactOutput = z.object({
	id: z.string(),
	firstName: z.string(),
	lastName: z.string().nullable(),
	email: z.string().nullable(),
	title: z.string().nullable(),
	imageUrl: z.string().nullable(),
	owner: ownerSummaryOutput.nullable(),
});

const companyDetailDealOutput = z.object({
	id: z.string(),
	name: z.string(),
	stage: companyDealStage,
	currency: z.string(),
	expectedCloseDate: z.string().nullable(),
	owner: ownerSummaryOutput.nullable(),
	amountCents: z.number().nullable(),
	baseAmountCents: z.number().nullable(),
});

const companyDetailPrimaryContactOutput = z.object({
	id: z.string(),
	firstName: z.string(),
	lastName: z.string().nullable(),
	email: z.string().nullable(),
	phone: z.string().nullable(),
	title: z.string().nullable(),
});

const pipelinePersonOutput = z.object({
	name: z.string().nullable(),
	role: z.string().nullable(),
	source: z.string().nullable(),
	checkedAt: z.string().nullable(),
	phones: z.array(
		z.object({ number: z.string(), lineType: z.string().nullable() }),
	),
	emails: z.array(
		z.object({ address: z.string(), verdict: z.string().nullable() }),
	),
});

const pipelineRankOutput = z.object({
	query: z.string(),
	position: z.number().nullable(),
});

const pipelineThemesOutput = z.object({
	praise: z.array(z.string()),
	complaints: z.array(z.string()),
});

export const companyPipelineLeadOutput = z.object({
	id: z.string(),
	status: z.string().nullable(),
	score: z.number().nullable(),
	disposition: z.string().nullable(),
	dispositionReason: z.string().nullable(),
	industry: z.string().nullable(),
	metro: z.string().nullable(),
	websiteStatus: z.string().nullable(),
	websiteUrl: z.string().nullable(),
	websiteEvidence: z.string().nullable(),
	bookingUrl: z.string().nullable(),
	rating: z.number().nullable(),
	reviewCount: z.number().nullable(),
	mapsRank: z.object({ position: z.number(), query: z.string() }).nullable(),
	address: z.string().nullable(),
	phone: z.string().nullable(),
	mapsUrl: z.string().nullable(),
	owner: pipelinePersonOutput.nullable(),
	ownerStatus: z.enum(["found", "not_determined"]).nullable(),
	people: z.array(pipelinePersonOutput),
	businessPhones: z.array(z.string()),
	businessEmails: z.array(z.string()),
	summary: z.string().nullable(),
	vibe: z.string().nullable(),
	services: z.array(z.string()),
	differentiators: z.array(z.string()),
	hours: z.array(z.object({ day: z.string().nullable(), hours: z.string() })),
	logoUrl: z.string().nullable(),
	brandColors: z.array(z.string()),
	reviews: z.array(
		z.object({
			author: z.string().nullable(),
			rating: z.number().nullable(),
			text: z.string(),
			date: z.string().nullable(),
			source: z.string().nullable(),
			url: z.string().nullable(),
		}),
	),
	photos: z.array(
		z.object({
			url: z.string(),
			caption: z.string().nullable(),
			source: z.string().nullable(),
		}),
	),
	links: z.object({
		social: z.array(z.string()),
		yelp: z.string().nullable(),
		linkedin: z.array(z.string()),
		directories: z.array(z.string()),
		sources: z.array(z.string()),
	}),
	offer: z
		.object({
			name: z.string().nullable(),
			status: z.string().nullable(),
			dreamOutcome: z.string().nullable(),
			likelihood: z.string().nullable(),
			timeDelay: z.string().nullable(),
			effort: z.string().nullable(),
			guarantee: z.string().nullable(),
			slots: z.array(
				z.object({
					slot: z.string().nullable(),
					copy: z.string(),
					clientFact: z.string().nullable(),
				}),
			),
		})
		.nullable(),
	competition: z
		.object({
			baselineAt: z.string().nullable(),
			queries: z.array(z.string()),
			maps: z.array(pipelineRankOutput),
			google: z.array(
				z.object({
					query: z.string(),
					inMapPack: z.boolean().nullable(),
					inAiOverview: z.boolean().nullable(),
					organicPosition: z.number().nullable(),
				}),
			),
			yelp: pipelineThemesOutput
				.extend({
					rating: z.number().nullable(),
					reviewCount: z.number().nullable(),
					claimed: z.boolean().nullable(),
					position: z.number().nullable(),
				})
				.nullable(),
			nextdoor: pipelineThemesOutput.nullable(),
			directories: z.array(
				z.object({
					name: z.string(),
					rating: z.number().nullable(),
					present: z.boolean().nullable(),
				}),
			),
			social: z.array(
				z.object({
					network: z.string(),
					followers: z.number().nullable(),
					lastPostAt: z.string().nullable(),
				}),
			),
			competitors: z.array(
				z.object({
					name: z.string(),
					whyPicked: z.string().nullable(),
					maps: z.array(pipelineRankOutput),
				}),
			),
			gaps: z.array(
				z.object({
					signal: z.string(),
					clientValue: z.string().nullable(),
					winnersMedian: z.string().nullable(),
					score: z.number().nullable(),
				}),
			),
			aiShareOfVoice: z.array(
				z.object({
					engine: z.string().nullable(),
					prompt: z.string(),
					namedCount: z.number().nullable(),
					citedCount: z.number().nullable(),
					runs: z.number().nullable(),
				}),
			),
		})
		.nullable(),
	trafficOpportunities: z.array(
		z.object({
			keyword: z.string(),
			signal: z.string().nullable(),
			suggestedPage: z.string().nullable(),
			intent: z.string().nullable(),
			score: z.number().nullable(),
		}),
	),
	sourcesRun: z.array(
		z.object({
			source: z.string(),
			status: z.string().nullable(),
			count: z.number().nullable(),
			costUsd: z.number().nullable(),
			reason: z.string().nullable(),
			checkedAt: z.string().nullable(),
		}),
	),
	previewUrl: z.string().nullable(),
	reportUrl: z.string().nullable(),
});

export const companyDetailOutput = z.object({
	id: z.string(),
	name: z.string(),
	domain: z.string().nullable(),
	website: z.string().nullable(),
	description: z.string().nullable(),
	logoUrl: z.string().nullable(),
	logoDarkUrl: z.string().nullable(),
	iconUrl: z.string().nullable(),
	iconDarkUrl: z.string().nullable(),
	iconTone: z.string().nullable(),
	brandColor: z.string().nullable(),
	industry: z.string().nullable(),
	subIndustry: z.string().nullable(),
	city: z.string().nullable(),
	stateCode: z.string().nullable(),
	country: z.string().nullable(),
	countryCode: z.string().nullable(),
	phone: z.string().nullable(),
	email: z.string().nullable(),
	linkedinUrl: z.string().nullable(),
	twitterUrl: z.string().nullable(),
	githubUrl: z.string().nullable(),
	pricingUrl: z.string().nullable(),
	careersUrl: z.string().nullable(),
	enrichmentStatus: companyEnrichmentStatus,
	enrichmentError: z.string().nullable(),
	source: companyRecordSource,
	owner: ownerSummaryOutput.nullable(),
	contacts: z.array(companyDetailContactOutput),
	fields: z.array(companyRecordFieldOutput),
	queued: z.boolean(),
	createdAt: z.string(),
	archivedAt: z.string().nullable(),
	enrichedAt: z.string().nullable(),
	primaryContactId: z.string().nullable(),
	primaryContact: companyDetailPrimaryContactOutput.nullable(),
	reportingCurrency: z.string(),
	deals: z.array(companyDetailDealOutput),
	pipelineLead: companyPipelineLeadOutput.nullable(),
});

export const companyOptionOutput = z.array(
	z.object({
		id: z.string(),
		name: z.string(),
		domain: z.string().nullable(),
		iconUrl: z.string().nullable(),
	}),
);

export const companySummaryOutput = z.object({
	id: z.string(),
	name: z.string(),
	domain: z.string().nullable(),
});

export const companyArchiveResultOutput = z.object({
	id: z.string(),
	name: z.string(),
});

export const companyBulkResultOutput = z.object({
	requested: z.number(),
	succeeded: z.number(),
	failed: z.number(),
	message: z.string().nullable(),
});

export const companyEnrichOutput = z.object({
	id: z.string(),
	queued: z.boolean(),
});

export const companyResearchOutput = z.object({
	ok: z.literal(true),
	queued: z.boolean(),
});

export const companySetPrimaryContactOutput = z.object({
	id: z.string(),
	primaryContactId: z.string().nullable(),
});
