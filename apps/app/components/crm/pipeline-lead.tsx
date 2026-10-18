"use client";

import { EmptyCellValue } from "@crm/ui/components/empty-cell";
import { Markdown } from "@crm/ui/components/markdown";
import Image from "next/image";
import { isValidElement, type ReactNode } from "react";
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

type Person = PipelineLead["people"][number];

type Competition = NonNullable<PipelineLead["competition"]>;

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

const DAY: Record<string, string> = {
	mon: "Mon",
	tue: "Tue",
	wed: "Wed",
	thu: "Thu",
	fri: "Fri",
	sat: "Sat",
	sun: "Sun",
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

function Muted({ children }: { children: ReactNode }) {
	return <span className="text-muted-foreground">{children}</span>;
}

function humanize(value: string): string {
	return value.replaceAll("_", " ");
}

function Lines({ items }: { items: ReactNode[] }) {
	if (items.length === 0) return <EmptyCellValue />;
	return (
		<span className="flex flex-col gap-1">
			{items.map((item) =>
				isValidElement(item) ? item : <span key={String(item)}>{item}</span>,
			)}
		</span>
	);
}

function LinkLines({ urls }: { urls: string[] }) {
	return (
		<Lines
			items={urls.map((url) => (
				<ExternalLink key={url} href={url}>
					{hostOf(url)}
					<Muted>{url.replace(/^https?:\/\/(www\.)?[^/]+/, "")}</Muted>
				</ExternalLink>
			))}
		/>
	);
}

function stars(rating: number | null) {
	return rating === null ? null : `${rating.toFixed(1)}★`;
}

function yesNo(value: boolean | null) {
	return value === null ? null : value ? "yes" : "no";
}

function position(value: number | null) {
	return value === null ? "not ranked" : `#${value}`;
}

function PersonLines({ person }: { person: Person }) {
	return (
		<span className="flex flex-col">
			<span>{[person.name, person.role].filter(Boolean).join(", ")}</span>
			{person.source || person.checkedAt ? (
				<Muted>
					{person.source ? `Source: ${person.source}` : null}
					{person.source && person.checkedAt ? " · " : null}
					{person.checkedAt ? (
						<>
							checked <LocalDay date={person.checkedAt} />
						</>
					) : null}
				</Muted>
			) : null}
			{person.phones.map((phone) => (
				<span key={phone.number}>
					{phone.number}
					{phone.lineType ? (
						<Muted>{` · ${humanize(phone.lineType)}`}</Muted>
					) : null}
				</span>
			))}
			{person.emails.map((email) => (
				<span key={email.address} className="break-all">
					{email.address}
					{email.verdict ? (
						<Muted>{` · ${humanize(email.verdict)}`}</Muted>
					) : null}
				</span>
			))}
		</span>
	);
}

function Owner({ lead }: { lead: PipelineLead }) {
	if (!lead.owner?.name) {
		return lead.ownerStatus === "not_determined" ? (
			<span>Owner not determined — contact the business directly</span>
		) : (
			<EmptyCellValue />
		);
	}
	return <PersonLines person={lead.owner} />;
}

function hasCompetition(competition: Competition | null) {
	if (!competition) return false;
	return (
		competition.maps.length > 0 ||
		competition.google.length > 0 ||
		competition.competitors.length > 0 ||
		competition.gaps.length > 0 ||
		competition.aiShareOfVoice.length > 0 ||
		competition.directories.length > 0 ||
		competition.yelp !== null
	);
}

function Themes({
	themes,
}: {
	themes: { praise: string[]; complaints: string[] } | null;
}) {
	if (!themes) return <EmptyCellValue />;
	return (
		<Lines
			items={[
				...themes.praise.map((theme) => `+ ${theme}`),
				...themes.complaints.map((theme) => `− ${theme}`),
			]}
		/>
	);
}

function CompetitionSection({
	competition,
	trafficOpportunities,
}: {
	competition: Competition | null;
	trafficOpportunities: PipelineLead["trafficOpportunities"];
}) {
	if (!hasCompetition(competition) && trafficOpportunities.length === 0) {
		return null;
	}

	return (
		<DetailSheetSection title="Competition">
			<DetailSheetProperties columns={1}>
				{competition ? (
					<>
						<DetailSheetProperty label="Maps rank">
							<Lines
								items={competition.maps.map(
									(rank) => `${position(rank.position)} for “${rank.query}”`,
								)}
							/>
						</DetailSheetProperty>
						<DetailSheetProperty label="Google">
							<Lines
								items={competition.google.map((row) => (
									<span key={row.query}>
										“{row.query}”
										<Muted>
											{` · map pack ${yesNo(row.inMapPack) ?? "—"} · AI overview ${yesNo(row.inAiOverview) ?? "—"} · organic ${position(row.organicPosition)}`}
										</Muted>
									</span>
								))}
							/>
						</DetailSheetProperty>
						<DetailSheetProperty label="Yelp">
							{competition.yelp ? (
								<span className="flex flex-col gap-1">
									<span>
										{[
											stars(competition.yelp.rating),
											competition.yelp.reviewCount !== null
												? `${competition.yelp.reviewCount} reviews`
												: null,
											competition.yelp.claimed === null
												? null
												: competition.yelp.claimed
													? "claimed"
													: "not claimed",
											competition.yelp.position !== null
												? `#${competition.yelp.position} on Yelp`
												: null,
										]
											.filter(Boolean)
											.join(" · ") || <EmptyCellValue />}
									</span>
									<Themes themes={competition.yelp} />
								</span>
							) : (
								<EmptyCellValue />
							)}
						</DetailSheetProperty>
						<DetailSheetProperty label="Nextdoor">
							<Themes themes={competition.nextdoor} />
						</DetailSheetProperty>
						<DetailSheetProperty label="Directories">
							<Lines
								items={competition.directories.map((row) => (
									<span key={row.name}>
										{row.name}
										<Muted>
											{[
												row.present === null
													? null
													: row.present
														? "listed"
														: "not listed",
												stars(row.rating),
											]
												.filter(Boolean)
												.map((part) => ` · ${part}`)
												.join("")}
										</Muted>
									</span>
								))}
							/>
						</DetailSheetProperty>
						<DetailSheetProperty label="Social">
							<Lines
								items={competition.social.map((row) => (
									<span key={row.network}>
										{row.network}
										<Muted>
											{row.followers !== null
												? ` · ${row.followers} followers`
												: null}
											{row.lastPostAt ? (
												<>
													{" · last post "}
													<LocalDay date={row.lastPostAt} />
												</>
											) : null}
										</Muted>
									</span>
								))}
							/>
						</DetailSheetProperty>
						<DetailSheetProperty label="Competitors">
							<Lines
								items={competition.competitors.map((row) => (
									<span key={row.name} className="flex flex-col">
										<span>{row.name}</span>
										{row.whyPicked ? <Muted>{row.whyPicked}</Muted> : null}
										{row.maps.length > 0 ? (
											<Muted>
												{row.maps
													.map(
														(rank) =>
															`${position(rank.position)} for “${rank.query}”`,
													)
													.join(" · ")}
											</Muted>
										) : null}
									</span>
								))}
							/>
						</DetailSheetProperty>
						<DetailSheetProperty label="Gaps">
							<Lines
								items={competition.gaps.map((gap) => (
									<span key={gap.signal} className="flex flex-col">
										<span>
											{gap.signal}
											{gap.score !== null ? (
												<Muted>{` · score ${gap.score}`}</Muted>
											) : null}
										</span>
										<Muted>
											{[
												gap.clientValue ? `Them: ${gap.clientValue}` : null,
												gap.winnersMedian
													? `Winners: ${gap.winnersMedian}`
													: null,
											]
												.filter(Boolean)
												.join(" · ")}
										</Muted>
									</span>
								))}
							/>
						</DetailSheetProperty>
						<DetailSheetProperty label="AI answers">
							<Lines
								items={competition.aiShareOfVoice.map((row) => (
									<span
										key={`${row.engine}-${row.prompt}`}
										className="flex flex-col"
									>
										<span>
											{row.engine ?? "AI"}
											<Muted>
												{` · named ${row.namedCount ?? 0}, cited ${row.citedCount ?? 0}${row.runs !== null ? ` of ${row.runs} runs` : ""}`}
											</Muted>
										</span>
										<Muted>{row.prompt}</Muted>
									</span>
								))}
							/>
						</DetailSheetProperty>
						<DetailSheetProperty label="Checked">
							<Value>
								{competition.baselineAt ? (
									<LocalDay date={competition.baselineAt} />
								) : null}
							</Value>
						</DetailSheetProperty>
					</>
				) : null}
				<DetailSheetProperty label="Search openings">
					<Lines
						items={trafficOpportunities.map((row) => (
							<span key={row.keyword} className="flex flex-col">
								<span>
									“{row.keyword}”
									<Muted>
										{[
											row.intent,
											row.score !== null ? `score ${row.score}` : null,
										]
											.filter(Boolean)
											.map((part) => ` · ${part}`)
											.join("")}
									</Muted>
								</span>
								{row.signal ? <Muted>{row.signal}</Muted> : null}
								{row.suggestedPage ? (
									<Muted>{`Page: ${row.suggestedPage}`}</Muted>
								) : null}
							</span>
						))}
					/>
				</DetailSheetProperty>
			</DetailSheetProperties>
		</DetailSheetSection>
	);
}

function BusinessSection({ lead }: { lead: PipelineLead }) {
	return (
		<DetailSheetSection title="The business">
			<DetailSheetProperties columns={1}>
				<DetailSheetProperty label="Vibe">
					<Value>{lead.vibe}</Value>
				</DetailSheetProperty>
				<DetailSheetProperty label="Services">
					<Lines items={lead.services} />
				</DetailSheetProperty>
				<DetailSheetProperty label="Stands out for">
					<Lines items={lead.differentiators} />
				</DetailSheetProperty>
				<DetailSheetProperty label="Hours">
					<Lines
						items={lead.hours.map((row) =>
							row.day ? `${DAY[row.day] ?? row.day}: ${row.hours}` : row.hours,
						)}
					/>
				</DetailSheetProperty>
				<DetailSheetProperty label="Logo">
					<Value>
						{lead.logoUrl ? (
							<ExternalLink href={lead.logoUrl}>
								{hostOf(lead.logoUrl)}
							</ExternalLink>
						) : null}
					</Value>
				</DetailSheetProperty>
				<DetailSheetProperty label="Brand colors">
					<Value>
						{lead.brandColors.length > 0 ? lead.brandColors.join(", ") : null}
					</Value>
				</DetailSheetProperty>
			</DetailSheetProperties>
		</DetailSheetSection>
	);
}

function PeopleSection({ lead }: { lead: PipelineLead }) {
	return (
		<DetailSheetSection title="People">
			<DetailSheetProperties columns={1}>
				<DetailSheetProperty label="Found">
					<Lines
						items={lead.people.map((person) => (
							<PersonLines
								key={`${person.name}-${person.role}`}
								person={person}
							/>
						))}
					/>
				</DetailSheetProperty>
				<DetailSheetProperty label="Business phones">
					<Lines items={lead.businessPhones} />
				</DetailSheetProperty>
				<DetailSheetProperty label="Business emails">
					<Lines items={lead.businessEmails} />
				</DetailSheetProperty>
			</DetailSheetProperties>
		</DetailSheetSection>
	);
}

function PresenceSection({ links }: { links: PipelineLead["links"] }) {
	const empty =
		links.social.length === 0 &&
		links.yelp === null &&
		links.linkedin.length === 0 &&
		links.directories.length === 0 &&
		links.sources.length === 0;
	if (empty) return null;

	return (
		<DetailSheetSection title="Online presence">
			<DetailSheetProperties columns={1}>
				<DetailSheetProperty label="Social">
					<LinkLines urls={links.social} />
				</DetailSheetProperty>
				<DetailSheetProperty label="Yelp">
					<LinkLines urls={links.yelp ? [links.yelp] : []} />
				</DetailSheetProperty>
				<DetailSheetProperty label="LinkedIn">
					<LinkLines urls={links.linkedin} />
				</DetailSheetProperty>
				<DetailSheetProperty label="Listed on">
					<LinkLines urls={links.directories} />
				</DetailSheetProperty>
				<DetailSheetProperty label="Sources">
					<LinkLines urls={links.sources} />
				</DetailSheetProperty>
			</DetailSheetProperties>
		</DetailSheetSection>
	);
}

function ReviewsSection({ lead }: { lead: PipelineLead }) {
	const { reviews, photos } = lead;
	if (reviews.length === 0 && photos.length === 0) return null;

	return (
		<DetailSheetSection
			title={`Reviews (${reviews.length}) and photos (${photos.length})`}
		>
			{photos.length > 0 ? (
				<div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
					{photos.map((photo) => (
						<a
							key={photo.url}
							href={photo.url}
							target="_blank"
							rel="noreferrer noopener"
						>
							<Image
								src={photo.url}
								alt={photo.caption ?? "Business photo"}
								width={240}
								height={240}
								unoptimized
								className="aspect-square w-full rounded-md object-cover"
							/>
						</a>
					))}
				</div>
			) : null}
			<div className="flex flex-col gap-3">
				{reviews.map((review) => (
					<div
						key={`${review.author}-${review.date}-${review.text.slice(0, 40)}`}
						className="flex flex-col gap-0.5 text-xs/5"
					>
						<span>
							{[review.author, stars(review.rating)]
								.filter(Boolean)
								.join(" · ")}
							<Muted>
								{review.source ? ` · ${review.source}` : null}
								{review.date ? (
									<>
										{" · "}
										<LocalDay date={review.date} />
									</>
								) : null}
							</Muted>
						</span>
						<span className="text-pretty text-muted-foreground">
							{review.text}
						</span>
					</div>
				))}
			</div>
		</DetailSheetSection>
	);
}

function OfferSection({ offer }: { offer: PipelineLead["offer"] }) {
	if (!offer) return null;

	return (
		<DetailSheetSection title="Offer angle">
			<DetailSheetProperties columns={1}>
				<DetailSheetProperty label="Offer">
					<Value>{offer.name}</Value>
					{offer.status ? <Muted>{` · ${offer.status}`}</Muted> : null}
				</DetailSheetProperty>
				<DetailSheetProperty label="Dream outcome">
					<Value>{offer.dreamOutcome}</Value>
				</DetailSheetProperty>
				<DetailSheetProperty label="Likelihood">
					<Value>{offer.likelihood}</Value>
				</DetailSheetProperty>
				<DetailSheetProperty label="Time to result">
					<Value>{offer.timeDelay}</Value>
				</DetailSheetProperty>
				<DetailSheetProperty label="Effort">
					<Value>{offer.effort}</Value>
				</DetailSheetProperty>
				<DetailSheetProperty label="Guarantee">
					<Value>{offer.guarantee}</Value>
				</DetailSheetProperty>
				{offer.slots.map((slot) => (
					<DetailSheetProperty
						key={`${slot.slot}-${slot.copy}`}
						label={slot.slot ? humanize(slot.slot) : "Copy"}
					>
						<span className="flex flex-col">
							<span>{slot.copy}</span>
							{slot.clientFact ? <Muted>{slot.clientFact}</Muted> : null}
						</span>
					</DetailSheetProperty>
				))}
			</DetailSheetProperties>
		</DetailSheetSection>
	);
}

function SourcesSection({
	sourcesRun,
}: {
	sourcesRun: PipelineLead["sourcesRun"];
}) {
	if (sourcesRun.length === 0) return null;

	return (
		<DetailSheetSection title="Sources checked">
			<DetailSheetProperties columns={1}>
				{sourcesRun.map((row) => (
					<DetailSheetProperty key={row.source} label={humanize(row.source)}>
						<span>
							{row.status ?? "—"}
							<Muted>
								{row.count !== null ? ` · ${row.count} found` : null}
								{row.costUsd ? ` · $${row.costUsd.toFixed(4)}` : null}
								{row.reason ? ` · ${row.reason}` : null}
								{row.checkedAt ? (
									<>
										{" · "}
										<LocalDay date={row.checkedAt} />
									</>
								) : null}
							</Muted>
						</span>
					</DetailSheetProperty>
				))}
			</DetailSheetProperties>
		</DetailSheetSection>
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
					<DetailSheetProperty label="Website check" wide>
						<Value>{lead.websiteEvidence}</Value>
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
					<DetailSheetProperty label="Lead score">
						<Value>{lead.score}</Value>
					</DetailSheetProperty>
					<DetailSheetProperty label="Pipeline status">
						<Value>{lead.status ? humanize(lead.status) : null}</Value>
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

			<BusinessSection lead={lead} />
			<PeopleSection lead={lead} />
			<PresenceSection links={lead.links} />
			<ReviewsSection lead={lead} />
			<OfferSection offer={lead.offer} />
			<CompetitionSection
				competition={lead.competition}
				trafficOpportunities={lead.trafficOpportunities}
			/>

			<SourcesSection sourcesRun={lead.sourcesRun} />
		</>
	);
}
