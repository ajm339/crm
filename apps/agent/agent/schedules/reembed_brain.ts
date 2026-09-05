import { defineSchedule } from "eve/schedules";
import { reembedUnindexed } from "../lib/handsome-brain";

// Keep the company brain fully indexed: any gbrain page written without an
// embedding (e.g. a capture that queued, or a page whose content changed) is
// re-chunked + re-embedded here, so `gbrain query` recall never falls behind and
// the un-embedded backlog stays at zero. Bounded per run to stay well inside a
// serverless invocation; the every-5-minutes cadence drains any backlog quickly.
export default defineSchedule({
	cron: "*/5 * * * *",
	async run({ waitUntil }) {
		// Batch sized to drain a normal burst of captures in one pass while staying
		// well inside the invocation; the 5-min cadence catches anything larger.
		waitUntil(reembedUnindexed(25));
	},
});
