import { Module } from "@nestjs/common";
import { PipelineLeadsService } from "./pipeline-leads.service";

@Module({
	providers: [PipelineLeadsService],
	exports: [PipelineLeadsService],
})
export class PipelineModule {}
