import { Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useDocumentMeta } from '../hooks/useDocumentMeta';

export default function About() {
  useDocumentMeta(
    'About & Methodology',
    "How DraftCrease calculates Trend Score, Draft Guide rankings, Site Rank, and Draft IQ - and where the underlying NHL data comes from.",
    '/about'
  );
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex items-center gap-2">
        <Info size={20} className="text-ice-500" />
        <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">About &amp; Methodology</h1>
      </div>

      <div className="space-y-6 text-sm leading-relaxed text-slate-400">
        <p>
          DraftCrease is an independent, ad-supported fantasy hockey site built by a single
          developer who wanted a free, no-account-required way to answer one question during a
          fantasy draft or a Tuesday-night waiver run: who should I actually pick up right now,
          based on real recent play instead of name recognition? Every number on this site comes
          from a documented formula, not a black box or a paid consensus feed.
        </p>

        <section>
          <h2 className="mb-2 font-display text-base font-semibold text-slate-200">Where the data comes from</h2>
          <p>
            Player stats are pulled directly from the NHL's own public API, refreshed automatically
            every 5 hours for player performance, every 15 minutes for scores and schedules, and
            daily for draft rankings. News headlines are pulled from public RSS feeds and
            deduplicated automatically; DraftCrease doesn't write original reporting, it links out
            to the original publisher for every story.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-display text-base font-semibold text-slate-200">Trend Score (Trends, Pickup / Drop)</h2>
          <p>
            Each player's Trend Score compares their recent play (roughly the last 5-15 games)
            against their own established baseline, weights more recent games more heavily, and
            then standardizes that number across the entire player pool so a hot streak from a
            bottom-six forward and a hot streak from a first-line center are measured on the same
            scale. Goalies use a separate version of the same idea built from save percentage,
            goals against, and win rate rather than points.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-display text-base font-semibold text-slate-200">Draft Guide rankings &amp; Site Rank</h2>
          <p>
            Pre-season Draft Guide rankings project each skater's last-season per-game point
            production out to a full 82-game season; goalies are projected from wins, shutouts,
            and save percentage, with limited-sample goalies blended toward the league average so
            a hot two-start stretch can't outrank an established starter. It's deliberately simple,
            transparent math instead of a proprietary model. Site Rank applies that same
            projected-points ranking across every position - it's our own estimate of expected
            draft slot, and it is never presented as real, third-party average draft position
            (ADP), since no free ADP data source exists for fantasy hockey.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-display text-base font-semibold text-slate-200">Draft IQ</h2>
          <p>
            Draft IQ is a 0-100 score shown on the Draft Board that combines five components -
            Value, Team Fit, Scarcity, Upside, and Risk - into one number, recalculated live as a
            mock draft progresses. The "why" explanation behind each score is built from the same
            calculated inputs using plain-English templates, not a live AI call, so it's fast,
            free, and reproducible.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-display text-base font-semibold text-slate-200">Sleepers &amp; Breakouts</h2>
          <p>
            This page cross-references each player's preseason draft rank against their current
            Trend Score to surface two groups: players quietly outperforming a low preseason
            ranking (breakouts), and highly-ranked players whose current play has cooled off
            (fallers).
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-display text-base font-semibold text-slate-200">Independence</h2>
          <p>
            DraftCrease is not affiliated with, endorsed by, or sponsored by the NHL or any of its
            member clubs. See our{' '}
            <Link to="/privacy" className="text-ice-400 hover:underline">
              Privacy Policy
            </Link>{' '}
            for how visitor data, optional sign-in, and advertising are handled.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-display text-base font-semibold text-slate-200">Contact</h2>
          <p>
            Questions, corrections, or feature requests can be sent to the site owner via the
            contact information on our{' '}
            <a
              href="https://github.com/stevenlayton/fantasy-hockey-insights"
              target="_blank"
              rel="noreferrer"
              className="text-ice-400 hover:underline"
            >
              GitHub repository
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
