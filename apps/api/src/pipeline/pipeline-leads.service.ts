import type { Db } from "@crm/db";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { EnvironmentVariables } from "../config/env.validation";
import { InjectDatabase } from "../database/database.constants";
import {
	DISPOSITION_FIELD_KEY,
	DISPOSITION_LABELS,
	LEAD_ID_FIELD_KEY,
	LEAD_VERSION_FIELD,
	type PipelineLead,
	toPipelineLead,
} from "./pipeline-lead";

const BATCH = 200;

type MissingLead = {
	id: string;
	name: string;
	labels: Record<string, string | null>;
};

type LabelField = {
	fieldId: string;
	column: string;
	optionFor: (value: string | null) => string | undefined;
};

export type EnsureCompaniesResult = {
	available: boolean;
	created: number;
	relabeled: number;
	failed: number;
};

@Injectable()
export class PipelineLeadsService {
	private readonly logger = new Logger(PipelineLeadsService.name);
	private readonly ownerEmail: string | undefined;
	private readonly photoBaseUrl: string | undefined;

	constructor(
		@InjectDatabase() private readonly db: Db,
		config: ConfigService<EnvironmentVariables, true>,
	) {
		this.ownerEmail = config.get("PIPELINE_LEAD_OWNER_EMAIL", { infer: true });
		this.photoBaseUrl = config.get("PIPELINE_PHOTO_BASE_URL", { infer: true });
	}

	async forCompany(companyId: string): Promise<PipelineLead | null> {
		const link = await this.db.fieldValue.findFirst({
			where: {
				companyId,
				field: { entity: "COMPANY", key: LEAD_ID_FIELD_KEY },
			},
			select: { text: true },
		});
		const leadId = link?.text?.trim();
		if (!leadId || !(await this.available())) return null;

		try {
			const rows = await this.db.$queryRaw<
				Array<{
					lead: Record<string, unknown>;
					research: Record<string, unknown> | null;
					previewSlug: string | null;
				}>
			>`
				SELECT to_jsonb(l) AS lead,
				       to_jsonb(r) AS research,
				       (SELECT s.slug FROM public.sites s
				         WHERE s.lead_id = l.id AND s.published_at IS NOT NULL
				         ORDER BY s.published_at DESC LIMIT 1) AS "previewSlug"
				  FROM public.leads l
				  LEFT JOIN public.research r ON r.lead_id = l.id
				 WHERE l.id::text = ${leadId}
				 LIMIT 1`;
			const row = rows[0];
			return row
				? toPipelineLead(row, { photoBaseUrl: this.photoBaseUrl })
				: null;
		} catch (error) {
			this.logger.warn(
				{ message: "Pipeline lead read failed", companyId },
				(error as Error).stack,
			);
			return null;
		}
	}

	async ensureCompanies(): Promise<EnsureCompaniesResult> {
		const result: EnsureCompaniesResult = {
			available: false,
			created: 0,
			relabeled: 0,
			failed: 0,
		};
		if (!(await this.available())) return result;

		const fields = await this.db.fieldDefinition.findMany({
			where: {
				entity: "COMPANY",
				key: { in: [LEAD_ID_FIELD_KEY, DISPOSITION_FIELD_KEY] },
				archivedAt: null,
			},
			include: { options: { where: { archivedAt: null } } },
		});
		const leadField = fields.find((f) => f.key === LEAD_ID_FIELD_KEY);
		if (!leadField) {
			this.logger.warn({
				message: `No COMPANY field "${LEAD_ID_FIELD_KEY}"; leads are not linked.`,
			});
			return result;
		}
		result.available = true;

		const labels = await this.labelFields(
			fields.find((f) => f.key === DISPOSITION_FIELD_KEY),
		);

		const ownerId = await this.ownerId();

		const missing = await this.db.$queryRaw<MissingLead[]>`
			SELECT l.id::text AS id, l.name,
			       jsonb_build_object(
			         'disposition', to_jsonb(l)->>'disposition',
			         'lead_version', to_jsonb(l)->>'lead_version') AS labels
			  FROM public.leads l
			 WHERE NOT EXISTS (
			         SELECT 1 FROM "fieldValue" fv
			          WHERE fv."fieldId" = ${leadField.id} AND fv.text = l.id::text)
			 ORDER BY l.created_at ASC
			 LIMIT ${BATCH}`;

		for (const lead of missing) {
			const labelValues = labels.flatMap((label) => {
				const optionId = label.optionFor(lead.labels[label.column] ?? null);
				return optionId ? [{ fieldId: label.fieldId, optionId }] : [];
			});
			try {
				await this.db.company.create({
					data: {
						name: lead.name,
						ownerId,
						source: "MANUAL",
						fieldValues: {
							create: [
								{ fieldId: leadField.id, text: lead.id },
								...labelValues,
							],
						},
					},
				});
				result.created += 1;
			} catch (error) {
				result.failed += 1;
				this.logger.error(
					{ message: "Company create from lead failed", leadId: lead.id },
					(error as Error).stack,
				);
			}
		}

		for (const label of labels) {
			result.relabeled += await this.relabel(leadField.id, label);
		}

		this.logger.log({ message: "Pipeline leads ensured", ...result });
		return result;
	}

	private async labelFields(
		disposition:
			| { id: string; options: { id: string; label: string }[] }
			| undefined,
	): Promise<LabelField[]> {
		const labels: LabelField[] = [];
		if (disposition) {
			labels.push(
				this.labelField(disposition, "disposition", DISPOSITION_LABELS),
			);
		}
		const leadVersion = (await this.hasLeadColumn(LEAD_VERSION_FIELD.key))
			? await this.leadVersionField()
			: null;
		if (leadVersion) {
			labels.push(
				this.labelField(
					leadVersion,
					LEAD_VERSION_FIELD.key,
					LEAD_VERSION_FIELD.labels,
				),
			);
		}
		return labels;
	}

	private labelField(
		field: { id: string; options: { id: string; label: string }[] },
		column: string,
		names: Record<string, string>,
	): LabelField {
		return {
			fieldId: field.id,
			column,
			optionFor: (value) => {
				const label = value ? names[value] : undefined;
				return label
					? field.options.find((o) => o.label === label)?.id
					: undefined;
			},
		};
	}

	private async leadVersionField() {
		const labels = Object.values(LEAD_VERSION_FIELD.labels);
		const field = await this.db.fieldDefinition.upsert({
			where: {
				entity_key: { entity: "COMPANY", key: LEAD_VERSION_FIELD.key },
			},
			create: {
				entity: "COMPANY",
				key: LEAD_VERSION_FIELD.key,
				label: LEAD_VERSION_FIELD.label,
				type: "SELECT",
				agentFilled: false,
				showOnFilter: true,
				position: LEAD_VERSION_FIELD.position,
				options: {
					create: labels.map((label, position) => ({ label, position })),
				},
			},
			update: {},
			include: { options: { where: { archivedAt: null } } },
		});
		if (field.archivedAt) return null;
		const absent = labels.filter(
			(label) => !field.options.some((o) => o.label === label),
		);
		if (absent.length === 0) return field;
		await this.db.fieldOption.createMany({
			data: absent.map((label) => ({
				fieldId: field.id,
				label,
				position: labels.indexOf(label),
			})),
		});
		return this.db.fieldDefinition.findUniqueOrThrow({
			where: { id: field.id },
			include: { options: { where: { archivedAt: null } } },
		});
	}

	private async relabel(
		leadFieldId: string,
		label: LabelField,
	): Promise<number> {
		const rows = await this.db.$queryRaw<
			Array<{
				companyId: string;
				value: string | null;
				optionId: string | null;
			}>
		>`
			SELECT link."companyId", to_jsonb(l)->>${label.column} AS value, d."optionId"
			  FROM "fieldValue" link
			  JOIN public.leads l ON l.id::text = link.text
			  LEFT JOIN "fieldValue" d
			         ON d."companyId" = link."companyId" AND d."fieldId" = ${label.fieldId}
			 WHERE link."fieldId" = ${leadFieldId} AND link."companyId" IS NOT NULL`;

		let changed = 0;
		for (const row of rows) {
			const optionId = label.optionFor(row.value);
			if (!optionId || optionId === row.optionId) continue;
			await this.db.fieldValue.upsert({
				where: {
					fieldId_companyId: {
						fieldId: label.fieldId,
						companyId: row.companyId,
					},
				},
				create: {
					fieldId: label.fieldId,
					companyId: row.companyId,
					optionId,
				},
				update: { optionId },
			});
			changed += 1;
		}
		return changed;
	}

	private async hasLeadColumn(column: string): Promise<boolean> {
		const [row] = await this.db.$queryRaw<Array<{ present: boolean }>>`
			SELECT EXISTS (
			         SELECT 1 FROM information_schema.columns
			          WHERE table_schema = 'public' AND table_name = 'leads'
			            AND column_name = ${column}) AS present`;
		return row?.present === true;
	}

	private async ownerId(): Promise<string | null> {
		if (!this.ownerEmail) return null;
		const user = await this.db.user.findFirst({
			where: { email: { equals: this.ownerEmail, mode: "insensitive" } },
			select: { id: true },
		});
		return user?.id ?? null;
	}

	private async available(): Promise<boolean> {
		try {
			const [row] = await this.db.$queryRaw<Array<{ present: boolean }>>`
				SELECT to_regclass('public.leads') IS NOT NULL AS present`;
			return row?.present === true;
		} catch {
			return false;
		}
	}
}
