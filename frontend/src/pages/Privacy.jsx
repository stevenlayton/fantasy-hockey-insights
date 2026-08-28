import { ShieldCheck } from 'lucide-react';
import { useDocumentMeta } from '../hooks/useDocumentMeta';

export default function Privacy() {
  useDocumentMeta('Privacy Policy', 'DraftCrease privacy policy covering data collection, cookies, and advertising.', '/privacy');
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex items-center gap-2">
        <ShieldCheck size={20} className="text-ice-500" />
        <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">Privacy Policy</h1>
      </div>

      <div className="space-y-6 text-sm leading-relaxed text-slate-400">
        <p>
          DraftCrease ("we," "us") is an independent fantasy hockey stats and insights site. This
          page explains what data is collected when you visit and how it's used.
        </p>

        <section>
          <h2 className="mb-2 font-display text-base font-semibold text-slate-200">
            No accounts, no personal sign-up
          </h2>
          <p>
            DraftCrease doesn't require - or offer - account creation or login. We don't collect
            names, email addresses, or any other personal information from visitors.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-display text-base font-semibold text-slate-200">
            Browser-local features (Draft Board, My Team, Compare)
          </h2>
          <p>
            Tools like the Draft Board and My Team save your picks and roster using your browser's
            local storage, on your device only. This data is never sent to us or to any server -
            it stays on your device, and clearing your browser data or switching devices/browsers
            clears it.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-display text-base font-semibold text-slate-200">Analytics</h2>
          <p>
            We use Google Analytics to understand overall site traffic (pages visited, general
            location, device type). This data is aggregated and not tied to your identity. You can
            opt out of Google Analytics tracking using browser extensions such as Google's own
            Analytics Opt-out Browser Add-on.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-display text-base font-semibold text-slate-200">
            Advertising
          </h2>
          <p>
            DraftCrease shows ads served by Google AdSense. Google and its partners may use
            cookies or similar technologies to serve ads based on your prior visits to this or
            other websites. You can learn more about how Google uses this data and manage your ad
            personalization settings at{' '}
            <a
              href="https://policies.google.com/technologies/ads"
              target="_blank"
              rel="noreferrer"
              className="text-ice-400 hover:underline"
            >
              policies.google.com/technologies/ads
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-display text-base font-semibold text-slate-200">
            Data sources
          </h2>
          <p>
            Player stats and news are pulled from the NHL's public API and public RSS news feeds.
            DraftCrease is not affiliated with or endorsed by the NHL or any of its member clubs.
          </p>
        </section>

        <section>
          <h2 className="mb-2 font-display text-base font-semibold text-slate-200">Contact</h2>
          <p>
            Questions about this policy can be sent to the site owner via the contact information
            on our GitHub repository.
          </p>
        </section>

        <p className="text-xs text-slate-600">Last updated: {new Date().toLocaleDateString()}</p>
      </div>
    </div>
  );
}
