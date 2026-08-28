# DraftCrease - NHL Fantasy Hockey Insights

Data-driven fantasy hockey insights: player trends, pickup/drop recommendations, and a pre-season
draft guide. NHL only for now; architected so other sports could be bolted on later (the
ingestion/scoring pattern in `functions/src` isn't NHL-specific beyond the API client itself).

Domain: **draftcrease.com** (DNS setup covered below, once Hosting is live).

## Stack

- **Frontend**: React + Vite + Tailwind, deployed to Firebase Hosting (`frontend/`)
- **Backend**: Firebase Cloud Functions, scheduled ingestion jobs (`functions/`)
- **Database**: Firestore - the frontend only ever *reads* from it; all writes happen
  server-side via the Admin SDK in Cloud Functions
- **Data source**: NHL's free, unofficial public API (`api-web.nhle.com`) - no key, no budget
  needed, but also no uptime/schema guarantees from NHL. See `functions/src/nhlApi.js`.
- **News**: free RSS feeds, parsed and deduped into Firestore (`functions/src/ingestNews.js`)
- **Ads**: Google AdSense, wired but inactive until the account is approved (see below)

## Why Firebase, not Railway

This is a static-buildable frontend + serverless backend with no need for a persistently-running
custom server, so Firebase Hosting (static assets, global CDN, free SSL) + Cloud Functions
(scheduled jobs) + Firestore covers 100% of it. Railway would just be paying for a container to
run something Firebase already runs cheaper and with less ops overhead. No Railway anywhere in
this project.

## How the data pipeline works

```
Cloud Scheduler (via onSchedule)
  |
  v
Cloud Function (ingestStats / ingestNews / ingestDraftGuide / ingestScoreboard)
  | fetches NHL API / RSS feeds
  | computes scores (see scoring.js for the formula, fully commented)
  v
Firestore (players/, scores/, news/, draftGuide/, scoreboard/, meta/)
  | read-only, public
  v
React frontend (onSnapshot listeners - no live API calls from the browser, ever)
```

- `scheduledStatsIngestion` - every 5 hours. Walks all 32 team rosters (~700 skaters), pulls each
  player's recent game log, computes the trend score. See `functions/src/scoring.js` for the full
  formula write-up (recency-weighted trend vs. baseline, z-scored across the player pool, weighted
  composite - weights are 4 constants at the top of that file, tune freely). Goalies get the same
  treatment with their own signal set (save percentage, goals against, win rate) and weights -
  see `GOALIE_SCORE_WEIGHTS` in the same file.
- `scheduledNewsIngestion` - hourly. Pulls configured RSS feeds, dedupes by article URL.
- `scheduledDraftGuideIngestion` - daily. Ranks skaters by position using last season's per-game
  production projected to an 82-game season. Deliberately simple ("basic projections" per spec).
  Goalies are ranked the same way but projected from wins, shutouts, and save percentage instead -
  see `PROJECTED_GOALIE_GAMES` and `GOALIE_FANTASY_WEIGHTS` in `functions/src/ingestDraftGuide.js`
  for the exact formula and tunable weights (wins and shutouts are worth flat points, save
  percentage only counts once it clears a replacement-level baseline).
- `scheduledScoreboardIngestion` - every 15 minutes. Pulls today's (or the next scheduled day's)
  NHL scoreboard for the "Around the League" widget. See `functions/src/ingestScoreboard.js`.
- `runIngestionNow` - an HTTPS endpoint to trigger any of the above on demand
  (`?job=stats|news|draftGuide|scoreboard|all`), so you don't have to wait for the first scheduled
  run. **Lock this down or delete it** once the site has real traffic - right now it's open to
  anyone who finds the URL.

## Frontend data layer: draftGuide vs scores (read this before adding a new page)

`draftGuide` is the full player universe (preseason projections, available year-round for every
rostered NHL player). `scores` only has a doc for a player once they have current-season game
logs to compute a trend score from, which is empty or sparse for most of the off-season. A page
that queries `scores` as if it were the complete player list will silently drop any player who
doesn't have a trend score yet - this caused a real bug where a player added to My Team from the
Draft Board (which correctly reads `draftGuide`) would vanish on the My Team page (which
incorrectly read only `scores`), and where Compare's search couldn't find players like Nathan
MacKinnon who hadn't logged current-season games yet.

**Any new page that looks up players by ID or searches by name should use
`frontend/src/hooks/usePlayerPool.js`**, which merges `draftGuide` (the full universe) with
`scores` (trend data layered on top when available) into one consistent list. My Team and Compare
were both refactored to use this hook (Aug 2026) - don't reintroduce a direct `scores`-only query
in a new page without a specific reason.

## What's built vs. what's left (original MVP)

Built: full Firestore schema + rules, all ingestion Cloud Functions with a documented scoring
model, core frontend pages reading live from Firestore, AdSense wiring (inactive until approved),
CI/CD via GitHub Actions.

Not built yet / roadmap:
- **Injury status** on Player Detail - NHL's free API doesn't reliably expose this; the page has
  an honest placeholder rather than fake data. A future source (e.g. scraping team injury reports,
  or a paid sports-data API) would slot into `players/{id}` as a new field.
- **RSS feed URLs are best-effort** - dead feeds log a warning per-source rather than crashing
  anything. Check `ingestNews` logs periodically.
- **NHL.com news** needs a proxy feed URL (NHL.com has no native RSS) - see
  `functions/src/rssSources.js` for the one-time setup.
- **Firebase App Check** - recommended before real traffic scales up, to make sure only our own
  frontend can read Firestore (rules are read-only already, but App Check stops scraping/abuse).
- **Real fantasy ownership %** - `rosteredEstimate` is a heuristic (season PPG/TOI thresholds), not
  real waiver-wire data, since there's no budget for a paid fantasy-platform API. Documented in
  `scoring.js`.
- **Other sports** - the ingestion/scoring pattern generalizes, but every NHL-specific piece
  (`nhlApi.js`, team codes, position codes) would need sport-specific equivalents.

## Feature Expansion: Draft Intelligence Platform

Steven's brief (Aug 2026): evolve the site from a rankings site into a "Draft Intelligence"
platform. Core product principle - answer "who should I draft right now?" better than any
competitor, entirely free/ad-supported, no required accounts (optional Google sign-in only for
saving state across devices, never a paywall). **This section is the living status tracker for
that expansion - update it every time a piece ships or a decision is made, so the plan survives
context resets between sessions.**

### Key decisions (locked in with Steven - don't relitigate without checking with him)

- **No real ADP data source.** There is no free, ToS-safe API for fantasy hockey ADP (average
  draft position - the crowd-sourced pick number a player typically goes off the board). Rather
  than scrape one or fabricate a number, our own site rank (from `draftGuide.positionRank` /
  projected points) is used as the "expected draft slot" proxy everywhere the spec calls for ADP.
  This is shown to users as **Site Rank**, never labeled as true ADP, so we're never passing off
  an internal number as real third-party consensus data.
- **Deterministic, not LLM-generated, explanations.** "Why is this Draft IQ 94?" and similar copy
  is built from templates driven by the actual calculated inputs (value delta, scarcity, category
  fit, etc.), not a per-request AI call. Keeps the product free and fast. If a real LLM
  integration ever makes sense later, it must be optional and cost-bounded, never required for
  core functionality.
- **Formulas live in dedicated, commented files with named constants at the top** - same pattern
  as `functions/src/scoring.js` - specifically so Steven can open one file, read the weights in
  plain English, and tune them without touching application logic. Every new formula (Draft IQ,
  breakout/bust scores, roster category grades, tier cutoffs) follows this pattern.

### Recent fixes (Aug 2026, from a ChatGPT review Steven ran against the live site)

- **My Team / Draft Board sync bug** - fixed. Root cause and the new shared-pool rule are
  documented above in "Frontend data layer: draftGuide vs scores". Both pages now use
  `usePlayerPool`; a new "Steady / No Trend Data Yet" section on My Team also shows roster
  players who don't have a trend score yet, instead of silently omitting them from every list.
- **Compare search missing players** - fixed, same root cause and same hook.
- **Draft Board's "run a full solo mock draft" copy** - reworded to describe what actually exists
  today (manual pick tracking), since there's no bot-driven simulation engine yet (that's Phase 2,
  item 4 below).
- **Goalies were entirely absent** (rankings, projections, roster slots, scoring categories) -
  fixed (Aug 2026). Ingestion now pulls goalie rosters and game logs alongside skaters
  (`functions/src/ingestStats.js`, `functions/src/ingestDraftGuide.js`), scores them with a
  goalie-specific trend model and a goalie-specific draft projection (both fully commented in
  `functions/src/scoring.js` and `functions/src/ingestDraftGuide.js` - all weights are named
  constants at the top of each file so they can be tuned without touching the logic). Goalies now
  show up in Draft Guide (new Goalies tab), Draft Board, My Team, Compare, and the roster panel,
  and count against a new `G` roster target (default 2) in league settings. Player Detail shows
  goalie-appropriate charts (save %, goals against, ice time) and a goalie-shaped game log table
  instead of the skater points/shots view.
- **SEO infrastructure** - fixed (Aug 2026). Added `frontend/public/robots.txt` (allows all
  crawlers, points to the sitemap) and `frontend/public/sitemap.xml` (all static routes). Added
  `frontend/src/hooks/useDocumentMeta.js`, a lightweight per-route hook (title, meta description,
  canonical link tag) with no extra dependency - every page (Trends, Pickup/Drop, Draft Guide,
  Draft Board, My Team, Compare, Sleepers, Privacy, and PlayerDetail with a dynamic per-player
  title/description) now sets its own metadata instead of sharing one static title across the
  whole site. Note: this fixes duplicate-title/meta and social-preview issues, but does not by
  itself fix crawler visibility for bots that don't execute JavaScript, since the app is still a
  client-rendered SPA - true crawlability would need server-side rendering or prerendering, which
  is a bigger lift and not yet scheduled.
- **Player Detail roster panel** - fixed (Aug 2026). Added `frontend/src/components/RosterPanel.jsx`,
  a sticky right-hand panel on the player page showing your current roster (grouped by position,
  with fill counts vs. your league settings) so you can see whether you have room before deciding
  to add someone, without leaving the page. Reuses `usePlayerPool`/`useMyRoster`/`useLeagueSettings`,
  so it always matches My Team and Draft Board exactly.
- **Injury status** - investigated, not a bug. Checked the NHL public API's roster endpoint
  (`/v1/roster/{team}/current`) and player landing endpoint (`/v1/player/{id}/landing`) directly;
  neither exposes an injury/IR field. The existing placeholder text on Player Detail is accurate
  as-is - a real fix would need a different data source entirely (paid sports-data API, or
  scraping team injury reports), noted in the roadmap below.

### Status by feature (from Steven's Aug 2026 spec)

1. **Live Draft Assistant** - partial. Draft Board tracks drafted/mine/other, filters, search,
   print. Missing: draft config (teams/position/snake/rounds/scoring), scarcity, tiers,
   STEAL/REACH tags, suggested next picks.
2. **Draft IQ** - not started. Signature 0-100 score with Value/Team Fit/Scarcity/Upside/Risk
   components and a "why" explanation.
3. **League-specific rankings** - not started. `useLeagueSettings` currently only stores roster
   position targets, not a category scoring system. No "Default Rank vs Your League Rank" yet.
4. **Mock draft simulator** - not started. No bot opponents or difficulty modes.
5. **Post-draft report card** - not started. My Team's A-F grade is a simple fill-ratio+trend
   score, not the full best-pick/biggest-reach/category-grade report.
6. **Shareable draft card** - not started.
7. **Player Battles / Who Should I Draft** - partial. Compare.jsx does ad hoc side-by-side stats
   for up to 4 players (now sourced from the full player pool); no SEO-indexable per-matchup
   pages, no Our Pick / For Your League verdict.
8. **Will He Be There Next Round** - not started.
9. **Sleeper/Breakout/Bust engine** - partial. Sleepers.jsx does breakouts + fallers off one
   score; missing component breakdown, busts, bouncebacks, rookies, lottery tickets.
10. **Roster Intelligence** - partial. My Team shows position-count fill + overall grade +
    a steady/no-data section; Player Detail now also shows a sticky roster panel (Aug 2026) so
    you can check roster room while looking at any player. Still missing per-category
    (goals/assists/PPP/hits/blocks/goaltending) bars tied to "why this pick helps".
11. **Draft tier alerts** - not started.
12. **ADP value board** - not started (was blocked on the ADP question, now unblocked by the
    Site Rank decision above).
13. **AI-style draft explanations** - not started (see deterministic-templates decision above).
14. **User retention** - partial. localStorage roster/settings persist; no saved mocks/grades/
    watchlist yet. Optional Google sign-in in progress for cross-device sync.
15. **Ad-supported design** - done. AdSlot wired header/in-feed/sidebar everywhere, kept out of
    the live Draft Board decision path per spec.

### Phase plan (Steven's own ordering)

- [ ] **Phase 1**: league scoring customization, Draft IQ engine, Site Rank/ADP-proxy value
      board, roster category intelligence, live draft board upgrades (goalie support shipped Aug
      2026, see Recent fixes above)
- [ ] **Phase 2**: mock draft simulator (bots), draft grading, shareable draft cards
- [ ] **Phase 3**: SEO player-battle pages, sleeper/breakout/bust engine expansion, Will He Be
      There Next Round, tier alerts
- [ ] **Phase 4**: retention (saved mocks/history/watchlist); SEO polish (sitemap.xml,
      robots.txt, per-route meta tags - done, see Recent fixes above; true crawler visibility via
      SSR/prerendering still open), ad placement tuning

Check items off (or replace the checkbox line with a one-line "done, see commit X" note) as each
phase lands, so this stays the single source of truth for where the expansion stands.

## One-time setup (things only you can do)

1. **Create the Firebase project** at https://console.firebase.google.com (free). Enable
   **Firestore** (production mode) and **Hosting**.
2. **Upgrade to the Blaze (pay-as-you-go) plan.** This is required for Cloud Functions to make
   outbound network calls (fetching the NHL API and RSS feeds) - the free Spark plan blocks
   outbound requests entirely. Blaze still has a generous free tier underneath; a project this
   size should cost close to $0/month, but it does require a billing method on file, so I can't do
   this step for you.
3. Put the real project ID in `.firebaserc` (replace `REPLACE_WITH_YOUR_FIREBASE_PROJECT_ID`).
4. In Firebase Console -> Project Settings -> General, add a **Web app** and copy its config into
   GitHub repo secrets (Settings -> Secrets and variables -> Actions):
   `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`,
   `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`.
5. Create a **service account key** for CI deploys: Google Cloud Console -> IAM & Admin -> Service
   Accounts -> create one with the **Firebase Admin** role (or the narrower set: Cloud Functions
   Admin, Firebase Hosting Admin, Cloud Datastore Index Admin, Service Account User) -> Keys -> Add
   Key -> JSON. Paste the entire JSON file content into a GitHub secret named
   `FIREBASE_SERVICE_ACCOUNT`. Also add `FIREBASE_PROJECT_ID` as a secret (same value as step 3).
   **This is a real credential** - I'm intentionally not generating or handling it for you.
6. Push to `main` (or click "Run workflow" on the Actions tab) - GitHub Actions builds and deploys
   everything. Check the Actions log for errors.
7. Hit `https://<region>-<project-id>.cloudfunctions.net/runIngestionNow?job=all` once after the
   first successful deploy so the site has data immediately instead of waiting up to 5 hours.

## Connecting draftcrease.com

Once Hosting is live on its default URL (`<project-id>.web.app`), add the custom domain in
Firebase Console -> Hosting -> Add custom domain -> `draftcrease.com`. Firebase will generate the
exact DNS records to add in Namecheap (typically an **A record** and a **TXT record** for
verification first) - Firebase shows the literal values once you start that flow, and they're
specific to your project. Add `www.draftcrease.com` as a second custom domain the same way if you
want the www subdomain too.

## AdSense

`AdSlot.jsx` reads `VITE_ADSENSE_CLIENT_ID`. Until it's set, ad positions render a labeled dashed
placeholder (no fake ads, no broken embed). To activate: create an AdSense account, get the site
approved, create ad units for the header/in-feed/sidebar slots, then set `VITE_ADSENSE_CLIENT_ID`
(and optionally per-slot `data-ad-slot` IDs) as a GitHub secret / in `frontend/.env.local` for
local dev.

## Local development

```bash
cd frontend && cp .env.example .env.local # fill in Firebase web config
npm install
npm run dev

cd ../functions && cp .env.example .env # optional: NHL_PROXY_RSS_URL
npm install
firebase emulators:start # requires `npm install -g firebase-tools` once, and `firebase login`
```
