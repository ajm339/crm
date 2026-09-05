import { defineTool } from "eve/tools";
import { z } from "zod";
import { getBrainPage } from "../lib/handsome-brain";

export default defineTool({
	description:
		"Fetch the full content of one company-brain (gbrain) page by its slug — use after search_gbrain to read a page in full. Read-only. Free.",
	inputSchema: z.object({
		slug: z.string().min(1).describe("The page slug from a search_gbrain result."),
	}),
	async execute(input) {
		const page = await getBrainPage(input.slug);
		return page ?? { error: "No brain page with that slug." };
	},
	toModelOutput(output) {
		return { type: "json", value: output };
	},
});
