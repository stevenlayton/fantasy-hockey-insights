const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { logger } = require('firebase-functions');
const { XMLParser } = require('fast-xml-parser');
const crypto = require('crypto');
const { getSources } = require('./rssSources');

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

/** Turn an article URL into a stable, safe Firestore doc ID for dedupe-by-URL. */
function urlToDocId(url) {
  return crypto.createHash('sha1').update(url).digest('hex');
}

/** Normalize an RSS 2.0 <item> or Atom <entry> into a common shape. Returns null if unusable (no link). */
function normalizeEntry(raw, sourceName) {
  // RSS 2.0 uses <link>text</link>. Atom uses <link href="..."/> (attribute).
let link = raw.link;
  if (link && typeof link === 'object') {
    link = link['@_href'] || link['#text'] || null;
  }
  if (Array.isArray(link)) {
    // Atom feeds can have multiple <link> entries; prefer rel="alternate" or the first with an href.
  const alt = link.find((l) => l && (l['@_rel'] === 'alternate' || l['@_href']));
    link = alt ? alt['@_href'] : null;
  }
  if (!link || typeof link !== 'string') return null;

const title = typeof raw.title === 'object' ? raw.title['#text'] : raw.title;
  const summaryRaw = raw.description || raw.summary || raw.content || '';
  const summary = typeof summaryRaw === 'object' ? summaryRaw['#text'] || '' : String(summaryRaw);
  const publishedRaw = raw.pubDate || raw.published || raw.updated || null;
  const publishedAt = publishedRaw ? new Date(publishedRaw) : new Date();

return {
  headline: (title || '').toString().trim(),
  // Strip any HTML tags from the summary - keep it plain text for the card UI.
  summary: summary.replace(/<[^>]*>/g, '').trim().slice(0, 400),
  link,
  source: sourceName,
  publishedAt: Number.isNaN(publishedAt.getTime()) ? new Date() : publishedAt,
};
}

async function fetchAndParseFeed(source) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(source.url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'FantasyHockeyInsights/1.0 (+https://draftcrease.com)' },
    });
    if (!res.ok) {
      logger.warn(`ingestNews: ${source.id} returned ${res.status}, skipping`);
      return [];
    }
    const xml = await res.text();
    const parsed = parser.parse(xml);

  const items =
    parsed?.rss?.channel?.item || // RSS 2.0
    parsed?.feed?.entry || // Atom
    [];
    const list = Array.isArray(items) ? items : [items];

  const entries = list.map((item) => normalizeEntry(item, source.name)).filter(Boolean);
    if (entries.length === 0) {
      logger.warn(`ingestNews: ${source.id} parsed 0 usable entries - feed may have changed/moved`);
    }
    return entries;
  } catch (err) {
    logger.warn(`ingestNews: ${source.id} failed: ${err.message}`);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/**
* Pull all configured RSS sources, dedupe by article URL (sha1 of the URL
* is the Firestore doc ID, so re-ingesting the same article is a harmless
* overwrite, not a duplicate), and write to the `news` collection.
*/
async function runNewsIngestion() {
  const db = getFirestore();
  const startedAt = Date.now();
  const sources = getSources();
  logger.info('ingestNews: starting run', { sources: sources.map((s) => s.id) });

const perSource = await Promise.all(sources.map(fetchAndParseFeed));
  const allEntries = perSource.flat();

const BATCH_LIMIT = 400;
  let batch = db.batch();
  let ops = 0;
  const commits = [];
  const commitIfNeeded = async () => {
    if (ops >= BATCH_LIMIT) {
      commits.push(batch.commit());
      batch = db.batch();
      ops = 0;
    }
  };

for (const entry of allEntries) {
  const docId = urlToDocId(entry.link);
  const ref = db.collection('news').doc(docId);
  batch.set(
    ref,
    {
      headline: entry.headline,
      summary: entry.summary,
      link: entry.link,
      source: entry.source,
      publishedAt: entry.publishedAt,
      ingestedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
    );
  ops++;
  await commitIfNeeded();
}
  commits.push(batch.commit());
  await Promise.all(commits);

await db.collection('meta').doc('newsIngestion').set({
  lastRunAt: FieldValue.serverTimestamp(),
  articlesProcessed: allEntries.length,
  sourcesTried: sources.length,
  durationMs: Date.now() - startedAt,
});

logger.info(`ingestNews: done. ${allEntries.length} articles from ${sources.length} sources in ${Date.now() - startedAt}ms`);
  return { articlesProcessed: allEntries.length, durationMs: Date.now() - startedAt };
}

module.exports = { runNewsIngestion };
