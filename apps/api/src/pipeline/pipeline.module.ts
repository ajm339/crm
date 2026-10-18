import { Module } from "@nestjs/common";
import { PipelineController } from "./pipeline.controller";
import { PipelineLeadsService } from "./pipeline-leads.service";

@Module({
	controllers: [PipelineController],
	providers: [PipelineLeadsService],
	exports: [PipelineLeadsService],
})
export class PipelineModule {}
