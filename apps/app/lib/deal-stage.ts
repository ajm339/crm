import { DealStage } from "@crm/db/enums";
import type { StatusTone } from "@crm/ui/components/status-indicator";

const ORDER = [
	DealStage.EMAILED,
	DealStage.REPLIED,
	DealStage.DEMO_BOOKED,
	DealStage.CALL_HELD,
	DealStage.QUALIFIED_TO_BUY,
	DealStage.DECISION_MAKER_BOUGHT_IN,
	DealStage.CONTRACT_SENT,
	DealStage.PAID,
	DealStage.LIVE,
	DealStage.CLOSED_WON,
	DealStage.CLOSED_LOST,
	DealStage.UNQUALIFIED_TO_BUY,
] as const;

type DealStagePresentation = Record<
	DealStage,
	{ label: string; tone: StatusTone }
>;

const PRESENTATION: DealStagePresentation = {
	EMAILED: { label: "Emailed", tone: "neutral" },
	REPLIED: { label: "Replied", tone: "neutral" },
	DEMO_BOOKED: { label: "Call booked", tone: "neutral" },
	CALL_HELD: { label: "Call held", tone: "info" },
	QUALIFIED_TO_BUY: { label: "Qualified to buy", tone: "info" },
	DECISION_MAKER_BOUGHT_IN: { label: "Decision maker in", tone: "info" },
	CONTRACT_SENT: { label: "Contract sent", tone: "warning" },
	PAID: { label: "Paid", tone: "warning" },
	LIVE: { label: "Live", tone: "warning" },
	CLOSED_WON: { label: "Closed won", tone: "success" },
	CLOSED_LOST: { label: "Closed lost", tone: "error" },
	UNQUALIFIED_TO_BUY: { label: "Unqualified", tone: "neutral" },
};

export const OPEN_STAGES = ORDER.slice(0, 9) as readonly DealStage[];

export const LOSING_STAGES: readonly DealStage[] = [
	DealStage.CLOSED_LOST,
	DealStage.UNQUALIFIED_TO_BUY,
];

export const DEAL_STAGE_OPTIONS = ORDER.map((value) => ({
	value,
	label: PRESENTATION[value].label,
}));

const OPEN_STAGE_COLORS = [
	"var(--chart-1)",
	"var(--chart-2)",
	"var(--chart-3)",
	"var(--chart-4)",
	"var(--chart-5)",
] as const;

export function isClosedStage(stage: DealStage): boolean {
	return !OPEN_STAGES.includes(stage);
}

export function dealStageColor(stage: DealStage): string {
	const index = OPEN_STAGES.indexOf(stage);
	return (
		(index < 0
			? undefined
			: OPEN_STAGE_COLORS[index % OPEN_STAGE_COLORS.length]) ?? "var(--chart-5)"
	);
}

export function dealStageLabel(stage: DealStage): string {
	return PRESENTATION[stage].label;
}

export function dealStagePresentation(stage: DealStage) {
	return PRESENTATION[stage];
}
