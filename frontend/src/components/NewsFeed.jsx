import { Newspaper } from 'lucide-react';

function timeAgo(ts) {
  if (!ts) return '';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function NewsFeed({ articles, loading }) {
  return (
    <div className="rounded-lg border border-rink-border bg-rink-900">
      <div className="flex items-center gap-2 border-b border-rink-border px-4 py-3">
        <Newspaper size={16} className="text-ice-500" />
        <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-slate-300">
          Latest News
        </h3>
      </div>
      <div className="max-h-[560px] divide-y divide-rink-border overflow-y-auto scrollbar-thin">
        {loading && <p className="p-4 text-sm text-slate-500">Loading news…</p>}
        {!loading && articles.length === 0 && (
          <p className="p-4 text-sm text-slate-500">
            No articles yet - the news ingestion pipeline hasn't run, or none of the configured
            RSS feeds returned results. Check Cloud Functions logs for <code>ingestNews</code>.
          </p>
        )}
        {articles.map((a) => (
          <a
            key={a.id}
            href={a.link}
            target="_blank"
            rel="noopener noreferrer"
            className="block px-4 py-3 hover:bg-rink-800"
          >
            <p className="text-sm font-medium text-slate-100">{a.headline}</p>
            {a.summary && <p className="mt-1 line-clamp-2 text-xs text-slate-500">{a.summary}</p>}
            <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-600">
              {a.source} · {timeAgo(a.publishedAt)}
            </p>
          </a>
        ))}
      </div>
    </div>
  );
}
