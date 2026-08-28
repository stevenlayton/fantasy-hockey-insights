import { useEffect } from 'react';

const SITE_NAME = 'DraftCrease';
const DEFAULT_DESCRIPTION =
  'DraftCrease - data-driven NHL fantasy hockey insights: player trends, pickup/drop recommendations, and a draft guide, built from raw stats.';

function setMetaTag(name, content) {
  if (!content) return;
  let tag = document.querySelector(`meta[name="${name}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('name', name);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function setCanonical(path) {
  if (!path) return;
  let link = document.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', `https://draftcrease.com${path}`);
}

/**
 * Sets a per-route document title, meta description, and canonical link.
 * DraftCrease is a client-rendered SPA (no SSR/prerendering yet), so this
 * doesn't help a crawler that never executes JavaScript - but it does fix
 * the more immediate problem of every route sharing one generic title and
 * description, which flattens search snippets and social share previews
 * to the same text no matter which page gets shared or indexed.
 *
 * Usage: useDocumentMeta('Draft Board | DraftCrease', 'One big board...', '/draft-board')
 */
export function useDocumentMeta(title, description, path) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title ? `${title} | ${SITE_NAME}` : SITE_NAME;
    setMetaTag('description', description || DEFAULT_DESCRIPTION);
    setCanonical(path);
    return () => {
      document.title = previousTitle;
    };
  }, [title, description, path]);
}
