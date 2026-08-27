/**
 * Free, no-key RSS sources for the NHL news feed.
 *
 * IMPORTANT - verify these before relying on them in production: public RSS
 * feed URLs move/disappear without notice. Check functions logs after
 * deploy - `ingestNews` logs a warning per source that returns 0 items or
 * fails to parse, so dead feeds are easy to spot and swap out.
 *
 * `espn-nhl` (https://www.espn.com/espn/rss/nhl/news) and `yahoo-nhl`
 * (https://sports.yahoo.com/nhl/rss.xml) were the original sources here but
 * were dropped: ESPN's feed now returns an empty body (dead/blocked), and
 * Yahoo's "NHL" feed turned out to be a generic Yahoo Sports firehose -
 * NFL, college football, even soccer showed up in it, not just hockey.
 *
 * Replaced with a Google News topic search scoped to "NHL hockey", which is
 * free, keyless, and reliably returns hockey-specific coverage pulled from
 * many outlets (Sportsnet, The Hockey News, Daily Faceoff, etc). As a second
 * layer of defense, ingestNews.js also runs every entry through a hockey
 * keyword filter before writing to Firestore, so if this or any future feed
 * drifts off-topic again, non-hockey articles get dropped rather than
 * displayed.
 *
 * NHL.com itself does not publish a public RSS feed. The spec calls for
 * "NHL.com via an RSS proxy" - to add it, sign up for a feed-generation
 * proxy (e.g. RSS.app, FetchRSS, or politepol.com all have free tiers),
 * point it at nhl.com/news, and set the resulting feed URL as the
 * NHL_PROXY_RSS_URL environment variable (see functions/.env.example).
 * If that variable is unset, ingestNews simply skips it - no crash.
 */

const STATIC_SOURCES = [
  {
    id: 'google-news-nhl',
    name: 'Google News (NHL)',
    url: 'https://news.google.com/rss/search?q=NHL+hockey+when:2d&hl=en-US&gl=US&ceid=US:en',
  },
];

function getSources() {
  const sources = [...STATIC_SOURCES];
  const proxyUrl = process.env.NHL_PROXY_RSS_URL;
  if (proxyUrl) {
    sources.push({ id: 'nhl-com-proxy', name: 'NHL.com (via proxy)', url: proxyUrl });
  }
  return sources;
}

module.exports = { getSources };
