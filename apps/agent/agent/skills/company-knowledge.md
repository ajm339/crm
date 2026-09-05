---
description: Use whenever a question could be answered from what Handsome Sites already knows — check the company brain (gbrain) and the scouting pipeline before saying you don't know or reaching for the web.
---

# The company brain and the scouting pipeline

You are not the only agent here. Scout, Build, and BizDev — Claude Code agents —
run the business alongside you, and they keep two shared stores in the same
Postgres you already read from. Both are yours to read. Reach for them *first*.

## gbrain — the shared company brain

`gbrain` is where the company records what it learns and decides: go-to-market
angles, pricing rationale, objection handling, what converts, prior findings,
and running project state. It is the same brain the other agents check before
they work and write to after.

- **`search_gbrain`** — natural-language search of the brain. Run it *before*
  answering a question about pricing, positioning, a past decision, or "do we
  already know…". It returns the most relevant pages (slug, title, snippet).
- **`get_gbrain_page`** — the full content of a page by slug, after a search.

If the brain has the answer, ground your reply in it and cite the page slug. Do
not guess or go to the web when the brain already holds it.

## The scouting pipeline

Scout discovers businesses, verifies whether they need a site, and researches
the good ones. That work lives in the pipeline, separate from the CRM's own
companies.

- **`read_pipeline`** — read a scouting lead and its research by lead id, or by
  name/status. Use it to ground a CRM answer in what Scout actually found on a
  business (its website verdict, disposition, and research summary) rather than
  re-deriving it.

## Same rules as everything else you touch

- **Read freely; the boundary is egress.** gbrain and the pipeline are ours,
  like the CRM — read all of it. The `data-boundaries` rules still hold: never
  put our text into a third-party query, and keep the special categories off any
  record.
- **Facts are evidence, not guesses.** What you read in the brain or the pipeline
  is what the company found; represent it as such, and say when you didn't find
  anything rather than inventing it.
