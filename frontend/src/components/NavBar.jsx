import { NavLink } from 'react-router-dom';
import {
  Radar,
  TrendingUp,
  ArrowLeftRight,
  ClipboardList,
  Menu,
  X,
  ChevronDown,
  GitCompare,
  Flame,
  ListChecks,
  UserCircle,
  LogIn,
  LogOut,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../hooks/useAuth';

const LINKS = [
  { to: '/', label: 'Trends', icon: TrendingUp, end: true },
  { to: '/pickup-drop', label: 'Pickup / Drop', icon: ArrowLeftRight },
  { to: '/draft-guide', label: 'Draft Guide', icon: ClipboardList },
];

const MORE_LINKS = [
  { to: '/draft-board', label: 'Draft Board', icon: ListChecks },
  { to: '/my-team', label: 'My Team', icon: UserCircle },
  { to: '/compare', label: 'Compare Players', icon: GitCompare },
  { to: '/sleepers', label: 'Sleepers & Breakouts', icon: Flame },
];

export default function NavBar() {
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const moreRef = useRef(null);
  const userRef = useRef(null);
  const { user, authLoading, signIn, signOut } = useAuth();

  useEffect(() => {
    function handleClickOutside(e) {
      if (moreRef.current && !moreRef.current.contains(e.target)) {
        setMoreOpen(false);
      }
      if (userRef.current && !userRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-rink-border bg-rink-950/95 backdrop-blur print:hidden">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <NavLink to="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-ice-500/10 text-ice-500 ring-1 ring-ice-500/30">
              <Radar size={20} strokeWidth={2.25} />
            </span>
            <span className="font-display text-xl font-semibold tracking-wide text-white">
              DRAFT<span className="text-ice-500">CREASE</span>
            </span>
            <span className="hidden rounded bg-rink-700 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400 sm:inline">
              NHL
            </span>
          </NavLink>
          <span className="hidden border-l border-rink-border pl-3 text-xs font-medium uppercase tracking-wide text-slate-500 lg:inline">
            Fantasy Insights &amp; Analytics
          </span>
        </div>

        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-rink-800 text-ice-400'
                    : 'text-slate-400 hover:bg-rink-800/60 hover:text-slate-100'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}

          <div className="relative" ref={moreRef}>
            <button
              onClick={() => setMoreOpen((v) => !v)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                moreOpen ? 'bg-rink-800 text-ice-400' : 'text-slate-400 hover:bg-rink-800/60 hover:text-slate-100'
              }`}
            >
              More
              <ChevronDown size={14} className={moreOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
            </button>
            {moreOpen && (
              <div className="absolute right-0 top-full mt-1 w-56 overflow-hidden rounded-md border border-rink-border bg-rink-900 py-1 shadow-xl">
                {MORE_LINKS.map(({ to, label, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={() => setMoreOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors ${
                        isActive ? 'bg-rink-800 text-ice-400' : 'text-slate-300 hover:bg-rink-800 hover:text-slate-100'
                      }`
                    }
                  >
                    <Icon size={16} />
                    {label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        </nav>

        <div className="flex items-center gap-2">
          {!authLoading && (
            user ? (
              <div className="relative" ref={userRef}>
                <button
                  onClick={() => setUserMenuOpen((v) => !v)}
                  title={user.displayName || user.email || 'Account'}
                  className="flex items-center gap-2 rounded-md px-1.5 py-1.5 text-sm text-slate-300 hover:bg-rink-800"
                >
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'Account'}
                      referrerPolicy="no-referrer"
                      className="h-7 w-7 rounded-full"
                    />
                  ) : (
                    <UserCircle size={22} className="text-slate-400" />
                  )}
                  <span className="hidden max-w-[9rem] truncate sm:inline">
                    {user.displayName?.split(' ')[0] || 'Account'}
                  </span>
                </button>
                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-1 w-48 overflow-hidden rounded-md border border-rink-border bg-rink-900 py-1 shadow-xl">
                    <div className="truncate border-b border-rink-border px-3 py-2 text-xs text-slate-500">
                      Synced to this account
                    </div>
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        signOut();
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-300 hover:bg-rink-800 hover:text-slate-100"
                    >
                      <LogOut size={14} />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={signIn}
                title="Sign in with Google to save your roster and settings across devices"
                className="flex items-center gap-1.5 rounded-md bg-rink-800 px-3 py-1.5 text-sm font-medium text-slate-300 hover:bg-rink-700 hover:text-white"
              >
                <LogIn size={14} />
                <span className="hidden sm:inline">Sign in</span>
              </button>
            )
          )}

          <button
            className="rounded-md p-2 text-slate-300 hover:bg-rink-800 md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle navigation"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="flex flex-col gap-1 border-t border-rink-border px-4 py-3 md:hidden">
          {[...LINKS, ...MORE_LINKS].map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${
                  isActive ? 'bg-rink-800 text-ice-400' : 'text-slate-400'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  );
}
