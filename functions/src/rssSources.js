/**
* Free, no-key RSS sources for the NHL news feed.
*
* IMPORTANT - verify these before relying on them in production: public RSS
* feed URLs move/disappear without notice and I could only spot-check one
* of these while building this (network access here is limited to a
* handful of test fetches). Check functions logs after the first deploy -
* `ingestNews` logs a warning per source that returns 0 items or fails to
* parse, so dead feeds are easy to spot and swap out.
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
    id: 'espn-nhl',
    name: 'ESPN NHL',
    url: 'https://www.espn.com/espn/rss/nhl/news',
  },
  {
    id: 'yahoo-nhl',
    name: 'Yahoo Sports NHL',
    url: 'https://sports.yahoo.com/nhl/rss.xml',
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
