import { defineTool } from "eve/tools";
import { z } from "zod";
import { putBrainPage } from "../lib/handsome-brain";

export default defineTool({
	description:
		"Write a page to the Handsome Sites company brain (gbrain) so it becomes shared, durable knowledge the other agents (Scout/Build/BizDev) can recall. Use this to record something reusable you learned or decided — a pricing rationale, an objection/answer, a winning angle — NOT per-lead state (that goes on the lead/CRM). The page is embedded inline, so it is immediately searchable and semantically recall-able. Writing with an existing slug UPDATES that page. Write deliberately; this is shared memory.",
	inputSchema: z.object({
		slug: z
			.string()
			.min(3)
			.regex(/^[a-z0-9-]+$/, "lowercase-kebab-case only")
			.describe("Stable kebab-case id, e.g. 'objection-already-have-a-facebook-page'. Reusing one updates it."),
		title: z.string().min(3).describe("A descriptive title — it carries the most search weight."),
		content: z.string().min(1).describe("The page body in Markdown/plain text."),
		type: z
			.enum(["note", "concept", "project", "reference"])
			.default("note")
			.describe("What kind of page this is."),
	}),
	async execute(input) {
		try {
			const res = await putBrainPage(input);
			return { ok: true, ...res };
		} catch (err) {
			return { ok: false, error: err instanceof Error ? err.message : String(err) };
		}
	},
	toModelOutput(output) {
		return { type: "json", value: output };
	},
});
