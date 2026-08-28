import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useFirestoreQuery } from '../hooks/useFirestoreQuery';
import { useMyRoster } from '../hooks/useMyRoster';
import AdSlot from '../components/AdSlot';
import FreshnessBadge from '../components/FreshnessBadge';
import { ListChecks, Plus, UserX, Undo2, RotateCcw, Printer } from 'lucide-react';

const POSITIONS = ['ALL', 'C', 'L', 'R', 'D'];
const POSITION_LABELS = { C: 'C', L: 'LW', R: 'RW', D: 'D' };

export default function DraftBoard() {
  const [position, setPosition] = useState('ALL');
  const [search, setSearch] = useState('');
  const [hideDrafted, setHideDrafted] = useState(false);

  const { data: guide, loading } = useFirestoreQuery(
    () => query(collection(db, 'draftGuide'), orderBy('projectedPoints', 'desc'), limit(600)),
    []
  );
  const { myTeam, draftedElsewhere, addToMyTeam, markDraftedElsewhere, undraft, resetDraft } =
    useMyRoster();

  const board = useMemo(
    () => guide.map((p, i) => ({ ...p, overallRank: i + 1 })),
    [guide]
  );

  const myTeamPlayers = useMemo(
    () => board.filter((p) => myTeam.includes(p.playerId)),
    [board, myTeam]
  );

  const positionCounts = useMemo(() => {
    const counts = { C: 0, L: 0, R: 0, D: 0 };
    myTeamPlayers.forEach((p) => {
      if (counts[p.position] !== undefined) counts[p.position] += 1;
    });
    return counts;
  }, [myTeamPlayers]);

  const filtered = board.filter((p) => {
    if (position !== 'ALL' && p.position !== position) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    const isDrafted = myTeam.includes(p.playerId) || draftedElsewhere.includes(p.playerId);
    if (hideDrafted && isDrafted) return false;
    return true;
  });

  const handleReset = () => {
    if (window.confirm('Clear your entire draft board? This removes your team and all drafted-elsewhere marks from this browser.')) {
      resetDraft();
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 print:max-w-none print:px-0">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3 print:mb-4">
        <div>
          <div className="flex items-center gap-2">
            <ListChecks size={20} className="text-gold" />
            <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Draft Board</h1>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-slate-500 print:hidden">
            One big board, ranked by projected points. Use it as a live cheat sheet during your
            real draft, or run a full solo mock draft. Your picks are saved in this browser only -
            there are no accounts, so nothing syncs across devices.
          </p>
        </div>
        <FreshnessBadge metaDocId="draftGuideIngestion" />
      </div>

      <div className="mb-4 print:hidden">
        <AdSlot variant="header" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px] print:block">
        <section>
          <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
            {POSITIONS.map((pos) => (
              <button
                key={pos}
                onClick={() => setPosition(pos)}
                className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
                  position === pos
                    ? 'bg-gold text-rink-950'
                    : 'bg-rink-800 text-slate-400 hover:text-slate-100'
                }`}
              >
                {pos}
              </button>
            ))}
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search players..."
              className="ml-auto min-w-[180px] flex-1 rounded-md border border-rink-border bg-rink-900 px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 focus:border-ice-500 focus:outline-none sm:flex-none"
            />
            <label className="flex items-center gap-1.5 text-xs text-slate-500">
              <input
                type="checkbox"
                checked={hideDrafted}
                onChange={(e) => setHideDrafted(e.target.checked)}
                className="rounded border-rink-border bg-rink-900"
              />
              Hide drafted
            </label>
            <button
              onClick={() => window.print()}
              title="Print a paper cheat sheet of the current filtered list"
              className="flex items-center gap-1.5 rounded-md bg-rink-800 px-3 py-1.5 text-sm font-semibold text-slate-400 hover:text-slate-100"
            >
              <Printer size={14} />
              Print
            </button>
          </div>

          <div className="overflow-hidden rounded-lg border border-rink-border print:rounded-none print:border-0">
            <table className="w-full text-sm">
              <thead className="bg-rink-800 text-left text-xs uppercase tracking-wider text-slate-400 print:bg-transparent print:text-slate-700">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Player</th>
                  <th className="px-3 py-2">Pos</th>
                  <th className="px-3 py-2 text-right">Proj. Pts</th>
                  <th className="px-3 py-2 text-right print:hidden">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rink-border">
                {loading && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                      Loading…
                    </td>
                  </tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                      No players match this filter.
                    </td>
                  </tr>
                )}
                {filtered.map((p) => {
                  const isMine = myTeam.includes(p.playerId);
                  const isOther = draftedElsewhere.includes(p.playerId);
                  const isDrafted = isMine || isOther;
                  return (
                    <tr key={p.playerId} className={isDrafted ? 'bg-rink-950/40 opacity-50 print:opacity-100' : 'bg-rink-900 hover:bg-rink-800 print:bg-transparent'}>
                      <td className="px-3 py-2 font-semibold text-slate-500 print:text-slate-700">{p.overallRank}</td>
                      <td className="px-3 py-2">
                        <Link
                          to={`/player/${p.playerId}`}
                          className={`font-medium hover:text-ice-400 print:text-slate-900 ${isDrafted ? 'text-slate-500 line-through' : 'text-slate-100'}`}
                        >
                          {p.name}
                        </Link>
                        <span className="ml-1.5 text-xs text-slate-500 print:text-slate-600">{p.team}</span>
                        {isMine && <span className="ml-2 rounded bg-ice-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-ice-400 print:hidden">My team</span>}
                        {isOther && <span className="ml-2 rounded bg-rink-700 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-400 print:hidden">Drafted</span>}
                      </td>
                      <td className="px-3 py-2 text-slate-400 print:text-slate-700">{POSITION_LABELS[p.position] || p.position}</td>
                      <td className="px-3 py-2 text-right text-slate-300 print:text-slate-700">{p.projectedPoints}</td>
                      <td className="px-3 py-2 text-right print:hidden">
                        {!isDrafted ? (
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => addToMyTeam(p.playerId)}
                              title="Add to my team"
                              className="rounded-md bg-ice-500/10 p-1.5 text-ice-400 ring-1 ring-ice-500/30 hover:bg-ice-500/20"
                            >
                              <Plus size={14} />
                            </button>
                            <button
                              onClick={() => markDraftedElsewhere(p.playerId)}
                              title="Mark drafted by someone else"
                              className="rounded-md bg-rink-700 p-1.5 text-slate-400 ring-1 ring-rink-600 hover:text-slate-200"
                            >
                              <UserX size={14} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => undraft(p.playerId)}
                            title="Undo"
                            className="ml-auto flex items-center gap-1 rounded-md bg-rink-700 px-2 py-1 text-xs text-slate-400 ring-1 ring-rink-600 hover:text-slate-200"
                          >
                            <Undo2 size={12} /> Undo
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="space-y-4 print:hidden">
          <div className="rounded-lg border border-rink-border bg-rink-900 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-slate-200">
                My Team ({myTeamPlayers.length})
              </h2>
              <button
                onClick={handleReset}
                title="Reset draft"
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300"
              >
                <RotateCcw size={12} /> Reset
              </button>
            </div>
            <div className="mb-3 flex gap-2 text-xs text-slate-500">
              {Object.entries(positionCounts).map(([pos, count]) => (
                <span key={pos} className="rounded bg-rink-800 px-2 py-1">
                  {POSITION_LABELS[pos]}: {count}
                </span>
              ))}
            </div>
            {myTeamPlayers.length === 0 ? (
              <p className="text-xs text-slate-500">
                Add players from the board to start building your team.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {myTeamPlayers.map((p) => (
                  <li key={p.playerId} className="flex items-center justify-between text-sm">
                    <span className="truncate text-slate-200">{p.name}</span>
                    <button
                      onClick={() => undraft(p.playerId)}
                      className="text-slate-600 hover:text-down"
                      title="Remove"
                    >
                      <UserX size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <AdSlot variant="sidebar" />
        </aside>
      </div>
    </div>
  );
}
