import {
	Controller,
	ForbiddenException,
	Get,
	Headers,
	Logger,
	Post,
	ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
	ApiExcludeEndpoint,
	ApiForbiddenResponse,
	ApiHeader,
	ApiOkResponse,
	ApiOperation,
	ApiServiceUnavailableResponse,
	ApiTags,
} from "@nestjs/swagger";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import type { EnvironmentVariables } from "../config/env.validation";
import { PipelineLeadsService } from "./pipeline-leads.service";

@ApiTags("Internal — Cron")
@ApiHeader({
	name: "authorization",
	description: "`Bearer <CRON_SECRET>`",
	required: true,
})
@ApiForbiddenResponse({ description: "CRON_SECRET did not match." })
@ApiServiceUnavailableResponse({ description: "CRON_SECRET is not set." })
@Controller("internal/pipeline")
export class PipelineController {
	private readonly logger = new Logger(PipelineController.name);
	private readonly secret: string | undefined;

	constructor(
		private readonly leads: PipelineLeadsService,
		config: ConfigService<EnvironmentVariables, true>,
	) {
		this.secret = config.get("CRON_SECRET", { infer: true });
	}

	@Get("leads")
	@AllowAnonymous()
	@ApiOperation({
		summary: "Create a company for every pipeline lead without one",
	})
	@ApiOkResponse({ description: "Counts of created and relabeled companies." })
	async leadsViaGet(@Headers("authorization") authorization?: string) {
		return this.run(authorization);
	}

	@Post("leads")
	@AllowAnonymous()
	@ApiExcludeEndpoint()
	async leadsViaPost(@Headers("authorization") authorization?: string) {
		return this.run(authorization);
	}

	private async run(authorization?: string) {
		if (!this.secret) {
			this.logger.error({
				message: "CRON_SECRET is not set — refusing to run the pipeline route.",
			});
			throw new ServiceUnavailableException("Pipeline sync is not configured.");
		}

		if (!timingSafeEquals(authorization ?? "", `Bearer ${this.secret}`)) {
			throw new ForbiddenException();
		}

		return this.leads.ensureCompanies();
	}
}

function timingSafeEquals(a: string, b: string): boolean {
	if (a.length !== b.length) return false;

	let mismatch = 0;
	for (let index = 0; index < a.length; index += 1) {
		mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
	}

	return mismatch === 0;
}
