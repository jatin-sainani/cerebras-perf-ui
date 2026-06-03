# Perf Sweep Explorer

**Live URL:** _<paste your Vercel/Netlify URL here>_ ← required; also paste into the submission form.

A browser tool that turns Cerebras `.xlsx` perf-projection sweeps into an answer two
audiences can act on:

- **Customer / PM** — a **GO / NO-GO** signal against a workload SLA, in numbers they
  recognize (tok/s/user, TTFT, throughput, relative cost).
- **Internal engineer** — a **sanity-check**: config-sensitivity curves, the
  latency/throughput frontier, automatic anomaly flags, and the raw projection.

Plus an **Insights** view that infers relative model sizes and labels each traffic
profile's use case from the numbers alone.

Everything is parsed **in your browser** — drop one or many sweeps and the views render
live, with no rebuild and no code changes. Comparing several models at once is the common
case and a first-class view.

---

## Quick start (clean clone)

```bash
git clone <your-private-repo-url> perf-ui
cd perf-ui
npm install
npm run dev          # http://localhost:5173
```

Production build / local preview:

```bash
npm run build        # tsc -b && vite build  →  dist/
npm run preview      # serves dist/ at http://localhost:4173
```

Tests:

```bash
npm test             # vitest run — parsing, analysis, and a full UI render
```

Requirements: **Node ≥ 20** (developed on Node 24). No backend, no env vars, no API keys.

---

## How to use it

1. **Upload** — drop `.xlsx` sweeps (or a whole `Model_X_profile_N/` folder) onto the
   panel on the left, or click **Load sample data** to explore the 11 shipped models × 7
   profiles. Files are parsed locally; nothing is uploaded anywhere.
2. **Select** what to compare — sweeps are grouped by model with per-profile chips. Pick
   one, or many across models/profiles.
3. **Switch views** — **Customer** (set an SLA → GO/NO-GO + cost ranking), **Engineer**
   (sensitivity charts, anomalies, raw table), **Insights** (model sizes + profile
   use-cases).

### The upload contract

The tool relies only on the **file/column shape**, not on the specific shipped models:

- File path `Model_<X>_profile_<N>/Model X profile N.xlsx` → model letter `X`, profile `N`
  (any letter, any integer; `_` or spaces both work).
- A **`Summary`** sheet whose header row contains the perf columns (`Input Length`,
  `Output Length`, `Cache %`, `Batch Size`, `Throughput (t/s)`, `Throughput / box`,
  `TTFT (ms)`, `Gen Speed (t/s/user)`, …). `Input/Output/Cache` are merged across each
  batch block and are **forward-filled** automatically.

Header matching is **tolerant** (normalize → exact → alias → fuzzy token overlap), so a
brand-new **Model L** — even with slightly reworded headers — renders with **zero code
edits**. Non-conforming files fail in isolation with a clear per-file message instead of
crashing the app.

---

## Architecture

```
src/
  lib/ingest/        # File -> ParsedSweep. The contract + Model-L defensibility lives here.
    columns.ts         canonical column map, header normalize/alias/fuzzy matching
    parseWorkbook.ts   Summary-sheet read, header detection, merged-cell forward-fill
    identity.ts        model/profile from filename or webkitRelativePath
    coerce.ts          numeric coercion + cache % normalization
    types.ts           SweepRow / ParsedSweep
  lib/analysis/      # pure functions over parsed sweeps
    operatingPoint.ts  customer GO/NO-GO + boxes/cost proxy
    anomalies.ts       monotonicity / spike / outlier checks
    compare.ts         multi-sweep axis detection + overlay alignment
    derived.ts         inferred model size + profile classification
  store/             # zustand: sweeps, selection, audience, workload SLA
  components/        # Upload, SweepSelector, customer/, engineer/, insights/, charts/
```

**Stack:** Vite + React + TypeScript · SheetJS (`xlsx`) for in-browser parsing · Recharts ·
Tailwind v4 · TanStack Table · Zustand · react-dropzone. Tested with Vitest (+ jsdom /
Testing Library for the render test).

**Tests (96):** every shipped sweep parses cleanly; header normalization/alias/fuzzy
matching; Model-L identity + reworded-header tolerance; malformed-file isolation; the full
customer/engineer/insights analysis pipeline; and an end-to-end App render (load → parse →
select → GO/NO-GO → charts).

---

## Deploy (free)

**Vercel (recommended):** import the repo → it auto-detects Vite and uses
[`vercel.json`](./vercel.json) (`npm run build` → `dist/`, SPA rewrite). Every push
redeploys. Put the resulting URL at the top of this README and in the submission form.

Equivalent on **Netlify** (build `npm run build`, publish `dist`), **Cloudflare Pages**, or
**GitHub Pages** (static `dist/`). The repo stays private; only the deployed UI is public
(the perf data is synthetic).

---

## Reading the data (notes for the video)

These are *derived in the UI*, not hard-coded — see the **Insights** tab:

- **Model size (A–K):** at a fixed profile, a larger model is **slower per user** and
  yields **less throughput per box**. The size bar ranks models by combining those two.
- **Profile use-case (1–7):** classified from the `(input, output, cache%)` shape —
  long-input + short-output + high cache ⇒ RAG/repeated-context; short-input + long-output
  ⇒ long-form generation; balanced + high cache ⇒ agentic/multi-turn; etc.
