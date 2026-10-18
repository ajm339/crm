import type { Db } from "@crm/db";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { EnvironmentVariables } from "../config/env.validation";
import { InjectDatabase } from "../database/database.constants";
import {
	LEAD_ID_FIELD_KEY,
	type PipelineLead,
	toPipelineLead,
} from "./pipeline-lead";

@Injectable()
export class PipelineLeadsService {
	private readonly logger = new Logger(PipelineLeadsService.name);
	private readonly photoBaseUrl: string | undefined;

	constructor(
		@InjectDatabase() private readonly db: Db,
		config: ConfigService<EnvironmentVariables, true>,
	) {
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
