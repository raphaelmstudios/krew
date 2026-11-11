import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

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

  // Until someone picks a theme themselves, keep following the device setting if it changes.
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => setTheme(getEffectiveTheme());
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  function handleToggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (err) {
      // Storage blocked (private window etc.) - the switch still works for this visit.
    }
    setTheme(next);
  }

  const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <button type="button" className={`krew-theme-toggle ${className}`} onClick={handleToggle} aria-label={label} title={label}>
      {theme === 'dark' ? <Sun size={18} strokeWidth={1.75} /> : <Moon size={18} strokeWidth={1.75} />}
    </button>
  );
}
