# ATScope

See your resume the way an applicant tracking system reads it. Drop a PDF or DOCX, get an honest score, a line-by-line teardown that quotes your own words with exact point costs, and a rewrite that uses only facts already in the document — verified and re-scored by the same engine until it lands in the 89–99 band, or told exactly why it cannot.

Next.js 15 (App Router) · TypeScript · Tailwind v4 · Motion · Vercel AI SDK (`streamObject` + Zod) · unpdf · JSZip · react-dropzone · Upstash Redis · pdf-lib · docx.

## Run it

```bash
npm install
cp .env.example .env.local   # optional — everything below is optional
npm run dev
```

Open http://localhost:3000. No signup. With **no environment variables at all** the app is fully functional: parsing and scoring are deterministic, and the rewrite falls back to a rule-based pass (every missing number becomes a `[[fill-in]]` field). Three sample resumes are one click away on the upload screen.

| Variable | Purpose |
| --- | --- |
| `AI_MODEL` + `ANTHROPIC_API_KEY` (or `OPENAI_API_KEY`, or `AI_GATEWAY_API_KEY`) | Model-written prose: per-finding fixes during analysis, and bullets/summary/skills in the rewrite. Default `anthropic/claude-opus-5`. |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (or `KV_REST_API_URL` + `KV_REST_API_TOKEN`, the names Vercel's Upstash integration uses) | Rate limits and anonymous session state. **Required when deployed**: serverless instances don't share memory. Locally, an in-memory store is used without them (resets on restart). |
| `AUTH_SECRET` + `GITHUB_CLIENT_ID/SECRET` or `GOOGLE_CLIENT_ID/SECRET` | Sign-in, only needed to save versions past the anonymous 7-day window. |

Scripts: `npm run build`, `npm run lint`, and the engine checks under `scripts/`:

```bash
npx tsx scripts/make-samples.ts                       # regenerate the three fixture resumes
npx tsx scripts/score-check.ts samples/weak-two-column.pdf [jd.txt]
npx tsx scripts/rewrite-check.ts samples/weak-sidebar.docx
npx tsx scripts/roundtrip-check.ts samples/decent-single.docx   # export → re-parse → re-score
npx tsx scripts/build-demo.ts                         # freeze a real run into lib/demo/sample.json for the landing demo
```

## How it works

1. **Parse like an ATS actually parses.** `lib/parse/pdf.ts` keeps every text run with its page box and content-stream position (via unpdf/pdf.js). `lib/parse/docx.ts` reads WordprocessingML directly with JSZip, so headers, footers, text boxes, tables and layout tables are *seen* — precisely so we can report them as lost. `lib/parse/ats-simulation.ts` builds two views of the same document: the human view (geometry, columns, entries) and the **ATS view** — the text as a position-sorting parser linearises it, columns merged line by line, header text gone, tables flattened. Every dropped element and reading-order issue is recorded with the lines it affects.
2. **Score six weighted categories.** One pure function per file in `lib/score/`, all with the signature `(doc, ctx) => CategoryResult`: parse integrity 25, keyword coverage 25, impact & quantification 20, structure 15, writing 10, contact 5. Every finding quotes the exact line and carries a point cost; costs sum to the category's deduction. Per-engine estimates for Workday, Greenhouse, Lever and Taleo reweight the categories and apply that parser's layout penalties (`lib/score/engines.ts`). The total is capped at 99.
3. **Plan.** `lib/rewrite/planner.ts` turns findings into an ordered list of intended changes; each item's projected gain is the weighted point cost of the findings it resolves. The plan screen recomputes the projected total on every toggle.
4. **Rewrite, verify, iterate.** `lib/rewrite/structural.ts` rebuilds the document single-column from the original lines (every rewrite line points at the lines it came from). When a model is configured, `lib/rewrite/prose.ts` asks it — with `streamObject` and a Zod schema — for bullets, a summary, grouped skills and keyword additions, each addition backed by a verbatim quote. `lib/rewrite/verifier.ts` then removes any number not in the original (→ placeholder), rejects any bullet naming a tool the original never mentions, drops keywords without evidence, scrubs generic phrasing, re-scores with the same engine, and iterates (model revision, then rule-based pass) up to three times. If it stops short of 89, the note says exactly which terms would have to be invented.
5. **Review and export.** The diff screen composes the document client-side from accepted hunks and filled placeholders and re-scores it in the browser on every action (`lib/rewrite/compose.ts` runs the same scorer). Unfilled placeholders block export. Exports are ATS-safe single-column PDF (pdf-lib, embedded Helvetica), DOCX (`docx`, body paragraphs and real bullets only) and plain text; `scripts/roundtrip-check.ts` re-parses the exports and confirms the score.

The analysis and rewrite pipelines are async generators of events (`lib/analysis/pipeline.ts`, `lib/rewrite/rewriter.ts`) streamed to the client through server actions with `createStreamableValue`. The analyzing screen animates on the real arrival times of those events; deterministic stages resolve in milliseconds and model-written fixes dock as they are produced. The landing page replays a frozen real run of the sample resume through the same components.

## Layout

```
app/                routes, server actions (app/actions), OAuth route handlers
lib/parse           pdf, docx, xml, lines, sections, headings, ats-simulation, from-text
lib/score           one file per category + aggregate, engines, bullet-strength, keywords/
lib/rewrite         planner, structural, fallback, prose (model), fixes (model), verifier, compose, rewriter
lib/schema          zod schemas shared by server and client (analysis, rewrite)
lib/analysis        pipeline (server) and client feed reducer
lib/export          model, pdf, docx
lib/store           kv (Upstash or memory), session, ratelimit, analyses
lib/auth            signed-cookie sessions, hand-rolled OAuth
components/ui       primitives (button, readouts, chips, toast, dialog, count)
components/{landing,upload,analyze,report,plan,diff,export,history,palette}
styles              tokens, type scale, motion constants
samples/            fixture resumes (also served from public/samples)
```

## Design

Direction B, "technical instrument": warm near-black `#121110`, off-white text, one amber accent, IBM Plex Sans body, IBM Plex Sans Condensed display, JetBrains Mono for every number with tabular figures. Layered shadows, alpha-tinted borders, nested radii, a 4px spacing scale. Motion animates transform and opacity only, honours `prefers-reduced-motion` with shorter, non-overshooting variants, and every animation is interruptible.

Keyboard: `⌘K` palette everywhere; on the rewrite screen `j`/`k` move, `a` accept, `r` reject, `⇧A` accept all, `f` jump to fill-ins.
