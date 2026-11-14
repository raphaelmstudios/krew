import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { Moon, Sun } from 'lucide-react';
import { prefersReducedMotion } from '../motion.js';

const STORAGE_KEY = 'krew-theme';

// What the page is actually showing right now - an explicit choice (data-theme on <html>)
// wins, otherwise it follows the device's own light/dark setting.
function getEffectiveTheme() {
  const chosen = document.documentElement.dataset.theme;
  if (chosen === 'light' || chosen === 'dark') return chosen;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// Manual light/dark switch. The choice is saved in this browser, and index.html applies
// it before the page draws so there's no flash of the wrong theme on reload.
export default function ThemeToggle({ className = '' }) {
  const [theme, setTheme] = useState(getEffectiveTheme);
  // Only the icon that appears after a click turns in - not the one drawn on page load.
  const [turned, setTurned] = useState(false);

  // Until someone picks a theme themselves, keep following the device setting if it changes.
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => setTheme(getEffectiveTheme());
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  function applyTheme(next) {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage blocked (private window etc.) - the switch still works for this visit.
    }
    setTheme(next);
    setTurned(true);
  }

  // The new theme spreads out in a circle from the switch itself. Browsers without view
  // transitions (and anyone with reduced motion on) just switch straight over.
  function handleToggle(event) {
    const next = theme === 'dark' ? 'light' : 'dark';
    if (!document.startViewTransition || prefersReducedMotion()) {
      applyTheme(next);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const root = document.documentElement;
    root.classList.add('krew-theme-switching');
    const transition = document.startViewTransition(() => {
      flushSync(() => applyTheme(next));
    });
    transition.ready
      .then(() => {
        root.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: 650, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', pseudoElement: '::view-transition-new(root)' }
        );
      })
      .catch(() => {});
    transition.finished.finally(() => root.classList.remove('krew-theme-switching'));
  }

  const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <button type="button" className={`krew-theme-toggle ${className}`} onClick={handleToggle} aria-label={label} title={label}>
      <span className={`krew-theme-toggle-icon${turned ? ' is-turning' : ''}`} key={theme}>
        {theme === 'dark' ? <Sun size={18} strokeWidth={1.75} /> : <Moon size={18} strokeWidth={1.75} />}
      </span>
    </button>
  );
}
