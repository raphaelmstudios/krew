import { useEffect } from 'react';

// Sets the browser tab title and the page's description / share tags while a page is on
// screen. The values come from src/pageMeta.js - the same ones the server writes into the
// HTML for search engines and link previews.
function setMeta(selector, attribute, value) {
  const element = document.head.querySelector(selector);
  if (element) element.setAttribute(attribute, value);
}

export default function usePageMeta(meta) {
  const title = meta?.title;
  const description = meta?.description;

  useEffect(() => {
    if (!title) return;
    document.title = title;
    setMeta('meta[property="og:title"]', 'content', title);
    setMeta('meta[name="twitter:title"]', 'content', title);
    if (description) {
      setMeta('meta[name="description"]', 'content', description);
      setMeta('meta[property="og:description"]', 'content', description);
      setMeta('meta[name="twitter:description"]', 'content', description);
    }
  }, [title, description]);
}
