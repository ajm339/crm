import { defineTool } from "eve/tools";
import { z } from "zod";
import { searchBrain } from "../lib/handsome-brain";

export default defineTool({
	description:
		"Search the Handsome Sites company brain (gbrain) — the shared knowledge the Scout/Build/BizDev agents record and recall: go-to-market angles, pricing rationale, objection handling, decisions, and prior findings. Use this to ground an answer in what the company already knows before saying you don't know. Returns the most relevant brain pages (slug, title, snippet); follow up with get_gbrain_page for a page's full content. Read-only. Free.",
	inputSchema: z.object({
		query: z.string().min(1).describe("What to look up, in natural language."),
		limit: z.number().int().min(1).max(20).default(6),
	}),
	async execute(input) {
		const results = await searchBrain(input.query, input.limit);
		return { results, count: results.length };
	},
	toModelOutput(output) {
		return { type: "json", value: output };
	},
});
