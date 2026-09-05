import { defineTool } from "eve/tools";
import { z } from "zod";
import { updateLead } from "../lib/handsome-brain";

export default defineTool({
	description:
		"Update a Handsome Sites scouting-pipeline lead: advance its status and/or set its disposition. A status change is validated against the pipeline status machine — an illegal jump is rejected — so you can move a lead forward but never corrupt the pipeline. Every change is logged to the shared event trail as agent 'eve'. Use read_pipeline first to get the lead id and current status. Writes; use deliberately.",
	inputSchema: z.object({
		leadId: z.string().describe("The pipeline lead id (public.leads.id)."),
		status: z
			.string()
			.optional()
			.describe(
				"New pipeline status (must be a legal next status from the lead's current one, e.g. verified_no_site → researched).",
			),
		disposition: z
			.string()
			.optional()
			.describe("Scout-style verdict, e.g. pursue or not_worth_pursuing."),
		dispositionReason: z.string().optional().describe("Plain-language reason for the disposition."),
	}),
	async execute(input) {
		const { leadId, ...patch } = input;
		try {
			const lead = await updateLead(leadId, patch);
			return { ok: true, lead };
		} catch (err) {
			return { ok: false, error: err instanceof Error ? err.message : String(err) };
		}
	},
	toModelOutput(output) {
		return { type: "json", value: output };
	},
});
