import { useEffect, useRef } from 'react';

const ADSENSE_CLIENT_ID = import.meta.env.VITE_ADSENSE_CLIENT_ID;

/**
 * Ad placement slot. Three variants matching the spec: header banner,
 * in-feed (between player cards), and sidebar (desktop only).
 *
 * The AdSense loader script itself is loaded once, globally, from a <script>
 * tag in index.html <head> (that's also the exact snippet Google's AdSense
 * dashboard gives for site verification). This component just registers each
 * <ins> slot with that already-loaded script.
 *
 * Until VITE_ADSENSE_CLIENT_ID is set, this renders a clearly-labeled dashed
 * placeholder in the correct size/position so the layout can be reviewed
 * before real ads are wired in. No fake ad content is ever shown.
 */
export default function AdSlot({ variant = 'in-feed', slotId }) {
  const insRef = useRef(null);

  useEffect(() => {
    if (!ADSENSE_CLIENT_ID) return;
    try {
      // eslint-disable-next-line no-undef
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (err) {
      // AdSense push can throw if the script hasn't loaded yet on fast
      // navigations; harmless, next mount will retry.
    }
  }, []);

  const sizing = {
    header: 'h-[90px] w-full max-w-[728px] mx-auto',
    'in-feed': 'h-[100px] w-full',
    sidebar: 'h-[600px] w-full max-w-[300px]',
  }[variant];

  if (!ADSENSE_CLIENT_ID) {
    return (
      <div
        className={`${sizing} flex items-center justify-center rounded-lg border border-dashed border-rink-600 bg-rink-900/50 text-xs uppercase tracking-wider text-slate-500`}
        aria-hidden="true"
      >
        Ad slot · {variant}
      </div>
    );
  }

  return (
    <ins
      ref={insRef}
      className={`adsbygoogle block ${sizing}`}
      style={{ display: 'block' }}
      data-ad-client={ADSENSE_CLIENT_ID}
      data-ad-slot={slotId || ''}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  );
}
