import { defineTool } from "eve/tools";
import { z } from "zod";
import { readPipelineLead, searchPipelineLeads } from "../lib/handsome-brain";

export default defineTool({
	description:
		"Read the Handsome Sites scouting pipeline — the `leads` and their `research` that Scout discovered, verified, and researched (status, website verdict, disposition, and the research summary). Use this to ground a CRM answer in what the pipeline actually found on a business. Give a leadId for one lead, or a name/status to search. Read-only. Free.",
	inputSchema: z.object({
		leadId: z.string().optional().describe("Exact pipeline lead id (public.leads.id)."),
		name: z.string().optional().describe("Fuzzy business-name search when you don't have an id."),
		status: z
			.string()
			.optional()
			.describe("Filter by pipeline status, e.g. researched, verified_no_site, rejected_has_site."),
		limit: z.number().int().min(1).max(25).default(10),
	}),
	async execute(input) {
		if (input.leadId) {
			const lead = await readPipelineLead(input.leadId);
			return lead ? { lead } : { error: "No pipeline lead with that id." };
		}
		const leads = await searchPipelineLeads({ name: input.name, status: input.status, limit: input.limit });
		return { leads, count: leads.length };
	},
	toModelOutput(output) {
		return { type: "json", value: output };
	},
});
