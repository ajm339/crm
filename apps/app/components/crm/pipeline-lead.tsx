"use client";

import { EmptyCellValue } from "@crm/ui/components/empty-cell";
import { Markdown } from "@crm/ui/components/markdown";
import type { ReactNode } from "react";
import {
	DetailSheetProperties,
	DetailSheetProperty,
	DetailSheetSection,
} from "@/components/detail-sheet";
import { LocalDay } from "@/components/local-date-time";
import type { RouterOutputs } from "@/lib/trpc/types";

type PipelineLead = NonNullable<
	RouterOutputs["companies"]["byId"]["pipelineLead"]
>;

const WEBSITE_STATUS: Record<string, string> = {
	none: "No website",
	stale: "Outdated website",
	good: "Good website",
	social_only: "Social page only",
};

const DISPOSITION: Record<string, string> = {
	pursue: "Pursue",
	not_worth_pursuing: "Not worth pursuing",
};

function ExternalLink({
	href,
	children,
}: {
	href: string;
	children: ReactNode;
}) {
	return (
		<a
			href={href}
			target="_blank"
			rel="noreferrer noopener"
			className="break-all text-foreground underline underline-offset-2"
		>
			{children}
		</a>
	);
}

function hostOf(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return url;
	}
}

function Value({ children }: { children: ReactNode }) {
	return children === null || children === undefined || children === "" ? (
		<EmptyCellValue />
	) : (
		children
	);
}

function humanize(value: string): string {
	return value.replaceAll("_", " ");
}

function Owner({ lead }: { lead: PipelineLead }) {
	const { owner } = lead;
	if (!owner?.name) {
		return lead.ownerStatus === "not_determined" ? (
			<span>Owner not determined — contact the business directly</span>
		) : (
			<EmptyCellValue />
		);
	}

	return (
		<span className="flex flex-col">
			<span>{[owner.name, owner.role].filter(Boolean).join(", ")}</span>
			{owner.source || owner.checkedAt ? (
				<span className="text-muted-foreground">
					{owner.source ? `Source: ${owner.source}` : null}
					{owner.source && owner.checkedAt ? " · " : null}
					{owner.checkedAt ? (
						<>
							checked <LocalDay date={owner.checkedAt} />
						</>
					) : null}
				</span>
			) : null}
			{owner.phones.map((phone) => (
				<span key={phone.number}>
					{phone.number}
					{phone.lineType ? (
						<span className="text-muted-foreground">
							{` · ${humanize(phone.lineType)}`}
						</span>
					) : null}
				</span>
			))}
			{owner.emails.map((email) => (
				<span key={email.address} className="break-all">
					{email.address}
					{email.verdict ? (
						<span className="text-muted-foreground">
							{` · ${humanize(email.verdict)}`}
						</span>
					) : null}
				</span>
			))}
		</span>
	);
}

export function PipelineLeadSection({ lead }: { lead: PipelineLead }) {
	const rating =
		lead.rating !== null
			? `${lead.rating.toFixed(1)}★${lead.reviewCount !== null ? ` · ${lead.reviewCount} reviews` : ""}`
			: lead.reviewCount !== null
				? `${lead.reviewCount} reviews`
				: null;

	return (
		<>
			<DetailSheetSection title="Research">
				<DetailSheetProperties>
					<DetailSheetProperty label="Industry">
						<Value>{lead.industry}</Value>
					</DetailSheetProperty>
					<DetailSheetProperty label="Metro">
						<Value>{lead.metro}</Value>
					</DetailSheetProperty>
					<DetailSheetProperty label="Website">
						<Value>
							{lead.websiteStatus
								? (WEBSITE_STATUS[lead.websiteStatus] ?? lead.websiteStatus)
								: null}
						</Value>
						{lead.websiteUrl ? (
							<>
								{" · "}
								<ExternalLink href={lead.websiteUrl}>
									{hostOf(lead.websiteUrl)}
								</ExternalLink>
							</>
						) : null}
					</DetailSheetProperty>
					<DetailSheetProperty label="Booking page">
						<Value>
							{lead.bookingUrl ? (
								<ExternalLink href={lead.bookingUrl}>
									{hostOf(lead.bookingUrl)}
								</ExternalLink>
							) : null}
						</Value>
					</DetailSheetProperty>
					<DetailSheetProperty label="Google rating">
						<Value>{rating}</Value>
					</DetailSheetProperty>
					<DetailSheetProperty label="Maps rank">
						<Value>
							{lead.mapsRank
								? `#${lead.mapsRank.position} for “${lead.mapsRank.query}”`
								: null}
						</Value>
					</DetailSheetProperty>
					<DetailSheetProperty label="Owner" wide>
						<Owner lead={lead} />
					</DetailSheetProperty>
					<DetailSheetProperty label="Phone">
						<Value>{lead.phone}</Value>
					</DetailSheetProperty>
					<DetailSheetProperty label="Address">
						<Value>
							{lead.address && lead.mapsUrl ? (
								<ExternalLink href={lead.mapsUrl}>{lead.address}</ExternalLink>
							) : (
								lead.address
							)}
						</Value>
					</DetailSheetProperty>
					<DetailSheetProperty label="Disposition" wide>
						<Value>
							{lead.disposition
								? [
										DISPOSITION[lead.disposition] ?? lead.disposition,
										lead.dispositionReason,
									]
										.filter(Boolean)
										.join(" — ")
								: null}
						</Value>
					</DetailSheetProperty>
					<DetailSheetProperty label="Preview page">
						<Value>
							{lead.previewUrl ? (
								<ExternalLink href={lead.previewUrl}>Open preview</ExternalLink>
							) : null}
						</Value>
					</DetailSheetProperty>
					<DetailSheetProperty label="Research report">
						<Value>
							{lead.reportUrl ? (
								<ExternalLink href={lead.reportUrl}>Open report</ExternalLink>
							) : null}
						</Value>
					</DetailSheetProperty>
				</DetailSheetProperties>
			</DetailSheetSection>

			{lead.summary ? (
				<DetailSheetSection title="Research summary">
					<Markdown>{lead.summary}</Markdown>
				</DetailSheetSection>
			) : null}
		</>
	);
}
