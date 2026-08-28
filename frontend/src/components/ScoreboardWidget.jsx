import { collection, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useFirestoreQuery } from '../hooks/useFirestoreQuery';
import { CalendarDays } from 'lucide-react';

const LIVE_STATES = ['LIVE', 'CRIT'];
const FINAL_STATES = ['FINAL', 'OFF'];

function formatStartTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

// gameDate comes back as a plain 'YYYY-MM-DD' string from the NHL API with
// no time component. Parsing that directly with `new Date(str)` treats it
// as UTC midnight, which rolls back to the previous day in any timezone
// behind UTC - so this builds the Date from the parts instead to keep it
// anchored to the intended calendar day in the viewer's local time.
//
// The NHL 'score/now' endpoint doesn't always mean literally today - in the
// off-season or on off days it falls back to the next scheduled game day
// (e.g. showing preseason openers weeks out). Without a clear label that
// reads as 'games happening right now', which is misleading, so this
// distinguishes 'Today' from a future 'Next games' date.
function getDateLabel(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return '';
  const gameDate = new Date(y, m - 1, d);
  const today = new Date();
  const isToday =
    gameDate.getFullYear() === today.getFullYear() &&
    gameDate.getMonth() === today.getMonth() &&
    gameDate.getDate() === today.getDate();
  const formatted = gameDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  return isToday ? `Today · ${formatted}` : `Next games · ${formatted}`;
}

export default function ScoreboardWidget() {
  const { data: games, loading } = useFirestoreQuery(
    () => query(collection(db, 'scoreboard'), orderBy('startTimeUTC', 'asc')),
    []
  );
  const dateLabel = getDateLabel(games[0] && games[0].gameDate);

  return (
    <div className="rounded-lg border border-rink-border bg-rink-900">
      <div className="flex items-center justify-between border-b border-rink-border px-4 py-3">
        <div className="flex items-center gap-2">
          <CalendarDays size={16} className="text-ice-500" />
          <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-slate-300">
            Around the League
          </h3>
        </div>
        {dateLabel && <span className="text-xs text-slate-500">{dateLabel}</span>}
      </div>
      <div className="divide-y divide-rink-border">
        {loading && <p className="p-4 text-sm text-slate-500">Loading scores...</p>}
        {!loading && games.length === 0 && (
          <p className="p-4 text-sm text-slate-500">No games on the schedule right now.</p>
        )}
        {games.map((g) => {
          const isLive = LIVE_STATES.includes(g.gameState);
          const isFinal = FINAL_STATES.includes(g.gameState);
          const awayWins = isFinal && g.awayTeam.score > g.homeTeam.score;
          const homeWins = isFinal && g.homeTeam.score > g.awayTeam.score;
          return (
            <div key={g.id} className="px-4 py-3">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="text-slate-600">{g.venue}</span>
                {isLive && (
                  <span className="flex items-center gap-1 font-semibold uppercase text-down">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-down" />
                    Live
                  </span>
                )}
                {isFinal && <span className="font-semibold uppercase text-slate-500">Final</span>}
                {!isLive && !isFinal && (
                  <span className="text-slate-500">{formatStartTime(g.startTimeUTC)}</span>
                )}
              </div>
              <TeamRow team={g.awayTeam} highlight={awayWins} />
              <div className="mt-1">
                <TeamRow team={g.homeTeam} highlight={homeWins} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TeamRow({ team, highlight }) {
  return (
    <div className="flex w-full items-center justify-between">
      <div className="flex items-center gap-2">
        {team.logo && <img src={team.logo} alt={team.abbrev} className="h-5 w-5" />}
        <span className={`text-sm font-medium ${highlight ? 'text-slate-100' : 'text-slate-300'}`}>
          {team.abbrev}
        </span>
      </div>
      {team.score !== null && (
        <span className={`text-sm font-semibold ${highlight ? 'text-gold' : 'text-slate-400'}`}>
          {team.score}
        </span>
      )}
    </div>
  );
}
