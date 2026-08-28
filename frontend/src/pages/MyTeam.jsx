import { useMemo, useState } from 'react';
import { usePlayerPool } from '../hooks/usePlayerPool';
import { useMyRoster } from '../hooks/useMyRoster';
import { useLeagueSettings } from '../hooks/useLeagueSettings';
import PlayerCard from '../components/PlayerCard';
import AdSlot from '../components/AdSlot';
import { UserCircle, Search, X, Settings, RotateCcw, Gauge } from 'lucide-react';
import { useDocumentMeta } from '../hooks/useDocumentMeta';

const POSITIONS = ['C', 'L', 'R', 'D', 'G'];
const POSITION_LABELS = { C: 'C', L: 'LW', R: 'RW', D: 'D', G: 'G' };

const GRADE_BANDS = [
  { min: 90, grade: 'A', className: 'bg-up/10 text-up ring-1 ring-up/30' },
  { min: 80, grade: 'B', className: 'bg-ice-500/10 text-ice-400 ring-1 ring-ice-500/30' },
  { min: 70, grade: 'C', className: 'bg-gold/10 text-gold ring-1 ring-gold/30' },
  { min: 60, grade: 'D', className: 'bg-down/10 text-down ring-1 ring-down/30' },
  { min: 0, grade: 'F', className: 'bg-down/20 text-down ring-1 ring-down/40' },
];

function computeTeamGrade(myPlayers, positionCounts, targets) {
  const totalTargets = POSITIONS.reduce((sum, pos) => sum + targets[pos], 0);
  if (totalTargets === 0 || myPlayers.length === 0) return null;

  const totalFilled = POSITIONS.reduce(
    (sum, pos) => sum + Math.min(positionCounts[pos], targets[pos]),
    0
  );
  const fillRatio = totalFilled / totalTargets;

  const avgTrend =
    myPlayers.reduce((sum, p) => sum + (p.score || 0), 0) / myPlayers.length;
  const trendComponent = Math.max(0, Math.min(1, (avgTrend + 0.5) / 1));

  const score = Math.round(fillRatio * 70 + trendComponent * 30);
  const band = GRADE_BANDS.find((b) => score >= b.min);
  return { score, grade: band.grade, className: band.className };
}

export default function MyTeam() {
  useDocumentMeta('My Team', 'Track your fantasy hockey roster trends, team grade, and waiver wire suggestions.', '/my-team');
  const [search, setSearch] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { pool, loading } = usePlayerPool();
  const { myTeam, draftedElsewhere, addToMyTeam, removeFromMyTeam } = useMyRoster();
  const { targets, setTarget, resetTargets } = useLeagueSettings();

  const myPlayers = useMemo(
    () => pool.filter((p) => myTeam.includes(p.playerId)),
    [pool, myTeam]
  );

  // Split by trend direction, but anyone without a meaningful trend yet
  // (no scores doc, or a score too small to call up/down - very common
  // in the off-season before current-season game logs exist) still needs
  // a place to show up, otherwise they'd count toward the team grade and
  // position counts while being invisible in the roster list below.
  const trendingUp = myPlayers.filter((p) => p.score > 0.05);
  const trendingDown = myPlayers.filter((p) => p.score < -0.05);
  const steady = myPlayers.filter((p) => p.score <= 0.05 && p.score >= -0.05);

  const positionCounts = useMemo(() => {
    const counts = { C: 0, L: 0, R: 0, D: 0, G: 0 };
    myPlayers.forEach((p) => {
      if (counts[p.position] !== undefined) counts[p.position] += 1;
    });
    return counts;
  }, [myPlayers]);

  const teamGrade = useMemo(
    () => computeTeamGrade(myPlayers, positionCounts, targets),
    [myPlayers, positionCounts, targets]
  );

  const suggestions = useMemo(() => {
    const unavailableIds = new Set([...myTeam, ...draftedElsewhere]);
    return POSITIONS.map((pos) => ({
      position: pos,
      candidates: pool
        .filter((p) => p.position === pos && !unavailableIds.has(p.playerId))
        .slice(0, 3),
    })).filter((group) => group.candidates.length > 0);
  }, [pool, myTeam, draftedElsewhere]);

  const searchResults = search
    ? pool
        .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) && !myTeam.includes(p.playerId))
        .slice(0, 8)
    : [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <UserCircle size={20} className="text-ice-500" />
            <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">My Team</h1>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Track your roster's trends and see where the board suggests upgrading. Your roster is
            saved in this browser only (same list used on the Draft Board).
          </p>
        </div>
        {teamGrade && (
          <div
            className={`flex items-center gap-2 rounded-lg px-4 py-2 ${teamGrade.className}`}
            title="Based on how full your roster is against your league settings, and how your roster's trend scores are moving right now"
          >
            <Gauge size={18} />
            <div className="leading-tight">
              <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">Team Grade</p>
              <p className="font-display text-xl font-bold">{teamGrade.grade}</p>
            </div>
          </div>
        )}
      </div>

      <div className="mb-6 relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search players to add to your team..."
          className="w-full rounded-md border border-rink-border bg-rink-900 py-2 pl-9 pr-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-ice-500 focus:outline-none"
        />
        {searchResults.length > 0 && (
          <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-rink-border bg-rink-900 shadow-lg">
            {searchResults.map((p) => (
              <button
                key={p.playerId}
                onClick={() => {
                  addToMyTeam(p.playerId);
                  setSearch('');
                }}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-rink-800"
              >
                <span className="text-slate-200">{p.name}</span>
                <span className="text-xs text-slate-500">{p.team} · {POSITION_LABELS[p.position] || p.position}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mb-4">
        <AdSlot variant="header" />
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-2">
        {POSITIONS.map((pos) => (
          <span
            key={pos}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
              positionCounts[pos] < targets[pos]
                ? 'bg-down/10 text-down ring-1 ring-down/30'
                : 'bg-rink-800 text-slate-400'
            }`}
          >
            {POSITION_LABELS[pos]}: {positionCounts[pos]} / {targets[pos]}
          </span>
        ))}
        <button
          onClick={() => setSettingsOpen((v) => !v)}
          title="Customize roster targets for your league"
          className="ml-1 flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-slate-500 hover:text-slate-300"
        >
          <Settings size={14} />
          League settings
        </button>
      </div>

      {settingsOpen && (
        <div className="mb-6 flex flex-wrap items-end gap-4 rounded-lg border border-rink-border bg-rink-900 p-4">
          {POSITIONS.map((pos) => (
            <label key={pos} className="flex flex-col gap-1 text-xs text-slate-500">
              {POSITION_LABELS[pos]} needed
              <input
                type="number"
                min="0"
                max="12"
                value={targets[pos]}
                onChange={(e) => setTarget(pos, e.target.value)}
                className="w-16 rounded-md border border-rink-border bg-rink-950 px-2 py-1 text-sm text-slate-200 focus:border-ice-500 focus:outline-none"
              />
            </label>
          ))}
          <button
            onClick={resetTargets}
            className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-slate-500 hover:text-slate-300"
          >
            <RotateCcw size={12} /> Reset to default
          </button>
          <p className="w-full text-xs text-slate-600">
            Match these to your real league's roster spots so the counts above tell you what to
            target. Saved in this browser only.
          </p>
        </div>
      )}

      {loading && <p className="text-sm text-slate-500">Loading...</p>}

      {!loading && myPlayers.length === 0 && (
        <div className="mb-8 rounded-lg border border-dashed border-rink-border p-6 text-center text-sm text-slate-500">
          Your team is empty. Search above or add players from the Draft Board.
        </div>
      )}

      {myPlayers.length > 0 && (
        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section>
            <h2 className="mb-3 font-display text-lg font-semibold uppercase tracking-wide text-up">
              Trending Up ({trendingUp.length})
            </h2>
            <div className="space-y-2">
              {trendingUp.length === 0 && <p className="text-sm text-slate-500">Nobody on your team is trending up right now.</p>}
              {trendingUp.map((s) => (
                <RosterRow key={s.playerId} scoreDoc={s} onRemove={() => removeFromMyTeam(s.playerId)} />
              ))}
            </div>
          </section>
          <section>
            <h2 className="mb-3 font-display text-lg font-semibold uppercase tracking-wide text-down">
              Trending Down ({trendingDown.length})
            </h2>
            <div className="space-y-2">
              {trendingDown.length === 0 && <p className="text-sm text-slate-500">Nobody on your team is trending down right now.</p>}
              {trendingDown.map((s) => (
                <RosterRow key={s.playerId} scoreDoc={s} onRemove={() => removeFromMyTeam(s.playerId)} />
              ))}
            </div>
          </section>
          {steady.length > 0 && (
            <section className="lg:col-span-2">
              <h2 className="mb-3 font-display text-lg font-semibold uppercase tracking-wide text-slate-300">
                Steady / No Trend Data Yet ({steady.length})
              </h2>
              <p className="mb-3 text-xs text-slate-500">
                These players are on your team but don't have enough recent game data yet to show
                a trend - common in the off-season or early in the year.
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {steady.map((s) => (
                  <RosterRow key={s.playerId} scoreDoc={s} onRemove={() => removeFromMyTeam(s.playerId)} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {suggestions.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-lg font-semibold uppercase tracking-wide text-slate-200">
            Suggested Waiver Targets
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {suggestions.map(({ position, candidates }) => (
              <div key={position} className="rounded-lg border border-rink-border bg-rink-900 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {POSITION_LABELS[position]}
                </p>
                <div className="space-y-2">
                  {candidates.map((p) => (
                    <PlayerCard key={p.playerId} scoreDoc={p} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function RosterRow({ scoreDoc, onRemove }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        <PlayerCard scoreDoc={scoreDoc} />
      </div>
      <button
        onClick={onRemove}
        title="Remove from my team"
        className="rounded-md p-2 text-slate-600 hover:text-down"
      >
        <X size={16} />
      </button>
    </div>
  );
}
