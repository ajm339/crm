import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { db } from "@crm/db";
import { AgentQueueService } from "../src/agent/agent-queue.service";
import type { AgentTriggerService } from "../src/agent/agent-trigger.service";
import { CompaniesService } from "../src/companies/companies.service";
import type { FaviconService } from "../src/companies/favicon.service";
import { ActivityStampService } from "../src/crm/activity-stamp.service";
import { ConversionService } from "../src/currency/conversion.service";
import { FieldsService } from "../src/fields/fields.service";
import { PipelineLeadsService } from "../src/pipeline/pipeline-leads.service";
import { withDiscardedCrmEvents } from "./agent-trigger.stub";

const suffix = process.env.TEST_RUN_ID ?? "pipeline-spec";
const ownerEmail = `pipeline-owner-${suffix}@example.test`;
const pursueLead = "6f1c9a52-0d1e-4f57-9a43-2d8f1b7c0a11";
const passLead = "0b7e2d44-8c3a-4e61-b5f2-9e1d6a3c4b22";

const config = (values: Record<string, string | undefined>) =>
	({ get: (key: string) => values[key] }) as never;

const pipeline = new PipelineLeadsService(
	db,
	config({ PIPELINE_LEAD_OWNER_EMAIL: ownerEmail }),
);

const agent = {
	companyCreated: async () => undefined,
	withCrmEvents: withDiscardedCrmEvents,
	fieldBackfillRecords: async () => undefined,
} as unknown as AgentTriggerService;

const fields = new FieldsService(db, agent);
const conversion = new ConversionService(db);
const companies = new CompaniesService(
	db,
	agent,
	new AgentQueueService(db),
	{ backfill: async () => undefined } as unknown as FaviconService,
	new ActivityStampService(db),
	conversion,
	fields,
	pipeline,
);

let ownerId: string;
let leadFieldId: string;
let dispositionFieldId: string;
let pursueOptionId: string;
let passOptionId: string;

async function companyFor(leadId: string) {
	const link = await db.fieldValue.findFirstOrThrow({
		where: { fieldId: leadFieldId, text: leadId },
		select: { companyId: true },
	});
	return db.company.findUniqueOrThrow({
		where: { id: link.companyId ?? "" },
		include: { fieldValues: true },
	});
}

async function dropPipelineTables() {
	await db.$executeRawUnsafe(
		"DROP TABLE IF EXISTS public.sites, public.research, public.leads",
	);
}

beforeAll(async () => {
	await dropPipelineTables();

	const owner = await db.user.create({
		data: {
			id: `pipeline-owner-${suffix}`,
			name: "Handsome Websites",
			email: ownerEmail,
		},
	});
	ownerId = owner.id;

	const leadField = await db.fieldDefinition.create({
		data: {
			entity: "COMPANY",
			key: "scout_lead_id",
			label: "Scout lead ID",
			type: "TEXT",
			agentFilled: false,
			position: 102,
		},
	});
	leadFieldId = leadField.id;

	const disposition = await db.fieldDefinition.create({
		data: {
			entity: "COMPANY",
			key: "disposition",
			label: "Disposition",
			type: "SELECT",
			agentFilled: false,
			position: 100,
			options: {
				create: [
					{ label: "Pursue", position: 0 },
					{ label: "Not worth pursuing", position: 1 },
				],
			},
		},
		include: { options: true },
	});
	dispositionFieldId = disposition.id;
	pursueOptionId =
		disposition.options.find((o) => o.label === "Pursue")?.id ?? "";
	passOptionId =
		disposition.options.find((o) => o.label === "Not worth pursuing")?.id ?? "";
});

afterAll(async () => {
	const links = await db.fieldValue.findMany({
		where: { fieldId: leadFieldId },
		select: { companyId: true },
	});
	await db.company.deleteMany({
		where: { id: { in: links.map((l) => l.companyId ?? "") } },
	});
	await db.fieldDefinition.deleteMany({
		where: { id: { in: [leadFieldId, dispositionFieldId] } },
	});
	await db.user.deleteMany({ where: { id: ownerId } });
	await dropPipelineTables();
});

describe("without the scouting pipeline in the database", () => {
	it("does nothing and does not throw", async () => {
		expect(await pipeline.ensureCompanies()).toEqual({
			available: false,
			created: 0,
			relabeled: 0,
			failed: 0,
		});
	});
});

describe("with the scouting pipeline in the database", () => {
	beforeAll(async () => {
		await db.$executeRawUnsafe(`
			CREATE TABLE public.leads (
				id uuid PRIMARY KEY,
				created_at timestamptz NOT NULL DEFAULT now(),
				status text NOT NULL,
				name text NOT NULL,
				category text,
				address text,
				city text,
				state text,
				phone text,
				maps_url text,
				rating numeric,
				review_count integer,
				website_url text,
				website_verdict text,
				disposition text,
				disposition_reason text
			)`);
		await db.$executeRawUnsafe(`
			CREATE TABLE public.research (
				lead_id uuid PRIMARY KEY,
				summary_md text,
				contacts jsonb,
				positioning_packet jsonb
			)`);
		await db.$executeRawUnsafe(`
			CREATE TABLE public.sites (
				lead_id uuid,
				kind text,
				slug text,
				published_at timestamptz
			)`);

		await db.$executeRaw`
			INSERT INTO public.leads
				(id, created_at, status, name, category, address, city, state, phone,
				 maps_url, rating, review_count, website_url, website_verdict,
				 disposition, disposition_reason)
			VALUES
				(${pursueLead}::uuid, now() - interval '1 day', 'researched',
				 'Jesus Seed Lawn Care', 'Lawn care service', '4512 S Peoria Ave',
				 'Tulsa', 'OK', '(918) 555-0142', 'https://maps.google.com/?cid=1',
				 4.9, 89, 'https://jesusseedlawn.com', 'none', 'pursue',
				 'Dead domain; map pack #3'),
				(${passLead}::uuid, now(), 'rejected_has_site', 'Loose Leaf Lawn Care',
				 'Lawn care service', NULL, 'Tulsa', 'OK', NULL, NULL, 4.9, 124,
				 'https://looseleaflawncare.com', 'good', 'not_worth_pursuing',
				 'Maintained site')`;

		await db.$executeRaw`
			INSERT INTO public.research (lead_id, summary_md, contacts, positioning_packet)
			VALUES (
				${pursueLead}::uuid,
				${"## Jesus Seed Lawn Care — research brief\n\nA family-run lawn crew."},
				${JSON.stringify({
					industry: "Lawn care",
					people: [
						{ name: "Ana Madrigal", role: "Office manager" },
						{
							name: "Jorge Madrigal",
							role: "Owner",
							source: "Oklahoma SOS registry",
							checked_at: "2026-10-18T12:00:00.000Z",
						},
					],
				})}::jsonb,
				${JSON.stringify({
					competitive_ranking: {
						client: {
							maps: {
								rankByQuery: [
									{ query: "lawn care tulsa ok", position: 3 },
									{ query: "lawn mowing service tulsa", position: null },
								],
							},
						},
					},
					files: {
						reportDocUrl: "https://docs.google.com/document/d/report/edit",
					},
				})}::jsonb)`;

		await db.$executeRaw`
			INSERT INTO public.sites (lead_id, kind, slug, published_at)
			VALUES
				(${pursueLead}::uuid, 'landing', 'jesus-seed-draft', NULL),
				(${pursueLead}::uuid, 'landing', 'jesus-seed-lawn-care-tulsa', now())`;
	});

	it("creates one owned, labeled company per lead, and only once", async () => {
		const first = await pipeline.ensureCompanies();
		expect(first).toMatchObject({ available: true, created: 2, failed: 0 });

		const pursue = await companyFor(pursueLead);
		expect(pursue.name).toBe("Jesus Seed Lawn Care");
		expect(pursue.ownerId).toBe(ownerId);
		expect(
			pursue.fieldValues.find((v) => v.fieldId === dispositionFieldId)
				?.optionId,
		).toBe(pursueOptionId);

		const pass = await companyFor(passLead);
		expect(
			pass.fieldValues.find((v) => v.fieldId === dispositionFieldId)?.optionId,
		).toBe(passOptionId);

		const second = await pipeline.ensureCompanies();
		expect(second).toMatchObject({ created: 0, relabeled: 0 });
		expect(await db.fieldValue.count({ where: { fieldId: leadFieldId } })).toBe(
			2,
		);
	});

	it("follows Scout when a lead is relabeled", async () => {
		await db.$executeRaw`
			UPDATE public.leads SET disposition = 'not_worth_pursuing'
			 WHERE id = ${pursueLead}::uuid`;

		expect(await pipeline.ensureCompanies()).toMatchObject({
			created: 0,
			relabeled: 1,
		});
		const pursue = await companyFor(pursueLead);
		expect(
			pursue.fieldValues.find((v) => v.fieldId === dispositionFieldId)
				?.optionId,
		).toBe(passOptionId);

		await db.$executeRaw`
			UPDATE public.leads SET disposition = 'pursue' WHERE id = ${pursueLead}::uuid`;
		await pipeline.ensureCompanies();
	});

	it("shows the lead's research live on the company record", async () => {
		const company = await companyFor(pursueLead);
		const before = await companies.byId(company.id);

		expect(before.pipelineLead).toEqual({
			id: pursueLead,
			status: "researched",
			disposition: "pursue",
			dispositionReason: "Dead domain; map pack #3",
			industry: "Lawn care",
			metro: "Tulsa, OK",
			websiteStatus: "none",
			websiteUrl: "https://jesusseedlawn.com",
			bookingUrl: null,
			rating: 4.9,
			reviewCount: 89,
			mapsRank: { position: 3, query: "lawn care tulsa ok" },
			address: "4512 S Peoria Ave",
			phone: "(918) 555-0142",
			mapsUrl: "https://maps.google.com/?cid=1",
			owner: {
				name: "Jorge Madrigal",
				role: "Owner",
				source: "Oklahoma SOS registry",
				checkedAt: "2026-10-18T12:00:00.000Z",
			},
			ownerStatus: "found",
			summary:
				"## Jesus Seed Lawn Care — research brief\n\nA family-run lawn crew.",
			previewUrl: "https://handsomesites.com/p/jesus-seed-lawn-care-tulsa",
			reportUrl: "https://docs.google.com/document/d/report/edit",
		});

		await db.$executeRawUnsafe(
			"ALTER TABLE public.leads ADD COLUMN industry text, ADD COLUMN metro text, ADD COLUMN booking_url text",
		);
		await db.$executeRaw`
			UPDATE public.leads
			   SET industry = 'lawn_care', metro = 'tulsa',
			       booking_url = 'https://jesusseed.square.site', rating = 5
			 WHERE id = ${pursueLead}::uuid`;

		const after = await companies.byId(company.id);
		expect(after.pipelineLead).toMatchObject({
			industry: "lawn_care",
			metro: "tulsa",
			bookingUrl: "https://jesusseed.square.site",
			rating: 5,
		});
	});

	it("says when no owner was found", async () => {
		const company = await companyFor(passLead);
		const record = await companies.byId(company.id);
		expect(record.pipelineLead).toMatchObject({
			owner: null,
			ownerStatus: null,
			previewUrl: null,
			summary: null,
		});

		await db.$executeRaw`
			INSERT INTO public.research (lead_id, contacts)
			VALUES (${passLead}::uuid, ${JSON.stringify({ people: [], owner_status: "not_determined" })}::jsonb)`;
		const updated = await companies.byId(company.id);
		expect(updated.pipelineLead).toMatchObject({
			owner: null,
			ownerStatus: "not_determined",
		});
	});

	it("leaves a company without a lead untouched", async () => {
		const plain = await db.company.create({
			data: { name: `No lead ${suffix}` },
		});
		const record = await companies.byId(plain.id);
		expect(record.pipelineLead).toBeNull();
		await db.company.delete({ where: { id: plain.id } });
	});
});
