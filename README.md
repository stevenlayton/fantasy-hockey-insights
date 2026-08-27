# DraftCrease — NHL Fantasy Hockey Insights

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
        │
        ▼
Cloud Function (ingestStats / ingestNews / ingestDraftGuide)
        │  fetches NHL API / RSS feeds
        │  computes scores (see scoring.js for the formula, fully commented)
        ▼
Firestore  (players/, scores/, news/, draftGuide/, meta/)
        │  read-only, public
        ▼
React frontend (onSnapshot listeners - no live API calls from the browser, ever)
```

- `scheduledStatsIngestion` — every 5 hours. Walks all 32 team rosters (~700 skaters), pulls each
  player's recent game log, computes the trend score. See `functions/src/scoring.js` for the full
  formula write-up (recency-weighted trend vs. baseline, z-scored across the player pool, weighted
  composite - weights are 4 constants at the top of that file, tune freely).
- `scheduledNewsIngestion` — hourly. Pulls configured RSS feeds, dedupes by article URL.
- `scheduledDraftGuideIngestion` — daily. Ranks players by position using last season's per-game
  production projected to an 82-game season. Deliberately simple ("basic projections" per spec).
- `runIngestionNow` — an HTTPS endpoint to trigger any of the above on demand (`?job=stats|news|draftGuide|all`),
  so you don't have to wait for the first scheduled run. **Lock this down or delete it** once the
  site has real traffic - right now it's open to anyone who finds the URL.

## What's built vs. what's left

Built: full Firestore schema + rules, all three ingestion Cloud Functions with a documented
scoring model, all four frontend pages (Trends Dashboard, Pickup/Drop, Draft Guide, Player Detail)
reading live from Firestore, AdSense wiring (inactive until approved), CI/CD via GitHub Actions.
Also done: Firebase project created (`crease-draft`), Blaze plan active, Web app registered.

Not built yet / roadmap:
- **First real deploy + data load** — see "Deploying" below; this needs the GitHub secrets set
  from the Firebase config below.
- **Injury status** on Player Detail — NHL's free API doesn't reliably expose this; the page has
  an honest placeholder rather than fake data. A future source (e.g. scraping team injury reports,
  or a paid sports-data API) would slot into `players/{id}` as a new field.
- **RSS feed URLs are best-effort** — I could only spot-check one live during a build with limited
  network access. Check `ingestNews` logs after first deploy; dead feeds log a warning per-source
  rather than crashing anything.
- **NHL.com news** needs a proxy feed URL (NHL.com has no native RSS) - see
  `functions/src/rssSources.js` for the one-time setup.
- **Firebase App Check** — recommended before AdSense/real traffic, to make sure only your own
  frontend can read Firestore (rules are read-only already, but App Check stops scraping/abuse).
- **Real fantasy ownership %** — `rosteredEstimate` is a heuristic (season PPG/TOI thresholds), not
  real waiver-wire data, since there's no budget for a paid fantasy-platform API. Documented in
  `scoring.js`.
- **Other sports** — the ingestion/scoring pattern generalizes, but every NHL-specific piece
  (`nhlApi.js`, team codes, position codes) would need sport-specific equivalents.

## One-time setup (things only you can do)

1. ~~Create the Firebase project~~ Done: project `crease-draft` exists on the Blaze (pay-as-you-go)
   plan with a Web app registered.
2. Put `crease-draft` in `.firebaserc` (replace `REPLACE_WITH_YOUR_FIREBASE_PROJECT_ID`).
3. In GitHub repo secrets (Settings → Secrets and variables → Actions), add the Firebase web
   config as: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`,
   `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`.
4. Create a **service account key** for CI deploys: Google Cloud Console → IAM & Admin → Service
   Accounts → create one with the **Firebase Admin** role (or the narrower set: Cloud Functions
   Admin, Firebase Hosting Admin, Cloud Datastore Index Admin, Service Account User) → Keys → Add
   Key → JSON. Paste the entire JSON file content into a GitHub secret named
   `FIREBASE_SERVICE_ACCOUNT`. Also add `FIREBASE_PROJECT_ID` as a secret (value: `crease-draft`).
   **This is a real credential** - I'm intentionally not generating or handling it for you.
5. Push to `main` (or click "Run workflow" on the Actions tab) - GitHub Actions builds and deploys
   everything. Check the Actions log for errors; this is the first time this exact pipeline runs,
   so treat the first run or two as a debugging pass.
6. Hit `https://<region>-crease-draft.cloudfunctions.net/runIngestionNow?job=all` once after the
   first successful deploy so the site has data immediately instead of waiting up to 5 hours.

## Connecting draftcrease.com

Once Hosting is live on its default URL (`crease-draft.web.app`), add the custom domain in
Firebase Console → Hosting → Add custom domain → `draftcrease.com`. Firebase will generate the
exact DNS records to add in Namecheap (typically an **A record** (and a second A record for the
apex, or a **TXT record** for verification first) - Firebase shows the literal values once you
start that flow, and they're specific to your project, so I can't pre-supply them here). Add
`www.draftcrease.com` as a second custom domain the same way if you want the www subdomain too.

## AdSense

`AdSlot.jsx` reads `VITE_ADSENSE_CLIENT_ID`. Until it's set, ad positions render a labeled dashed
placeholder (no fake ads, no broken embed). To activate: create an AdSense account, get the site
approved (needs real content live at draftcrease.com first - chicken-and-egg with deploying),
create ad units for the header/in-feed/sidebar slots, then set `VITE_ADSENSE_CLIENT_ID` (and
optionally per-slot `data-ad-slot` IDs) as a GitHub secret / in `frontend/.env.local` for local
dev.

## Local development

```bash
cd frontend && cp .env.example .env.local   # fill in Firebase web config
npm install
npm run dev

cd ../functions && cp .env.example .env     # optional: NHL_PROXY_RSS_URL
npm install
firebase emulators:start   # requires `npm install -g firebase-tools` once, and `firebase login`
```
