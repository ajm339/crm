import type { Db } from "@crm/db";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { EnvironmentVariables } from "../config/env.validation";
import { InjectDatabase } from "../database/database.constants";
import {
	DISPOSITION_FIELD_KEY,
	DISPOSITION_LABELS,
	LEAD_ID_FIELD_KEY,
	type PipelineLead,
	toPipelineLead,
} from "./pipeline-lead";

const BATCH = 200;

type MissingLead = {
	id: string;
	name: string;
	disposition: string | null;
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

	constructor(
		@InjectDatabase() private readonly db: Db,
		config: ConfigService<EnvironmentVariables, true>,
	) {
		this.ownerEmail = config.get("PIPELINE_LEAD_OWNER_EMAIL", { infer: true });
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
			return row ? toPipelineLead(row) : null;
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

		const dispositionField = fields.find(
			(f) => f.key === DISPOSITION_FIELD_KEY,
		);
		const optionFor = (disposition: string | null) => {
			const label = disposition ? DISPOSITION_LABELS[disposition] : undefined;
			return label
				? dispositionField?.options.find((o) => o.label === label)?.id
				: undefined;
		};

		const ownerId = await this.ownerId();

		const missing = await this.db.$queryRaw<MissingLead[]>`
			SELECT l.id::text AS id, l.name, l.disposition
			  FROM public.leads l
			 WHERE NOT EXISTS (
			         SELECT 1 FROM "fieldValue" fv
			          WHERE fv."fieldId" = ${leadField.id} AND fv.text = l.id::text)
			 ORDER BY l.created_at ASC
			 LIMIT ${BATCH}`;

		for (const lead of missing) {
			const optionId = optionFor(lead.disposition);
			try {
				await this.db.company.create({
					data: {
						name: lead.name,
						ownerId,
						source: "MANUAL",
						fieldValues: {
							create: [
								{ fieldId: leadField.id, text: lead.id },
								...(dispositionField && optionId
									? [{ fieldId: dispositionField.id, optionId }]
									: []),
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

		if (dispositionField) {
			result.relabeled = await this.relabel(
				leadField.id,
				dispositionField.id,
				optionFor,
			);
		}

		this.logger.log({ message: "Pipeline leads ensured", ...result });
		return result;
	}

	private async relabel(
		leadFieldId: string,
		dispositionFieldId: string,
		optionFor: (disposition: string | null) => string | undefined,
	): Promise<number> {
		const rows = await this.db.$queryRaw<
			Array<{
				companyId: string;
				disposition: string | null;
				optionId: string | null;
			}>
		>`
			SELECT link."companyId", l.disposition, d."optionId"
			  FROM "fieldValue" link
			  JOIN public.leads l ON l.id::text = link.text
			  LEFT JOIN "fieldValue" d
			         ON d."companyId" = link."companyId" AND d."fieldId" = ${dispositionFieldId}
			 WHERE link."fieldId" = ${leadFieldId} AND link."companyId" IS NOT NULL`;

		let changed = 0;
		for (const row of rows) {
			const optionId = optionFor(row.disposition);
			if (!optionId || optionId === row.optionId) continue;
			await this.db.fieldValue.upsert({
				where: {
					fieldId_companyId: {
						fieldId: dispositionFieldId,
						companyId: row.companyId,
					},
				},
				create: {
					fieldId: dispositionFieldId,
					companyId: row.companyId,
					optionId,
				},
				update: { optionId },
			});
			changed += 1;
		}
		return changed;
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
