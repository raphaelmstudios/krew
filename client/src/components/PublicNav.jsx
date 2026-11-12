import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import Logo from './Logo.jsx';
import ThemeToggle from './ThemeToggle.jsx';

// The list of links in the public navigation bar. 
// Each link has a label and either an href (for scrolling to a section of the homepage) or a to (for navigating to another page). 
// The links are rendered in the order they appear in this array.
const NAV_LINKS = [
  { label: 'About', href: '#about' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Find Work', to: '/find-work' },
  { label: 'Hire Crew', to: '/hire-crew' },
];

export default function PublicNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [session, setSession] = useState(undefined); // undefined = still checking, null = logged out
  const [mobileOpen, setMobileOpen] = useState(false);
  const [highlight, setHighlight] = useState({ left: 0, width: 0, opacity: 0 });
  const linksRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/session')
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled) setSession(data?.user ?? null);
      })
      .catch(() => {
        if (!cancelled) setSession(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function moveHighlightTo(el) {
    if (!el || !linksRef.current) return;
    const containerRect = linksRef.current.getBoundingClientRect();
    const itemRect = el.getBoundingClientRect();
    setHighlight({
      left: itemRect.left - containerRect.left,
      width: itemRect.width,
      opacity: 1,
    });
  }

  function hideHighlight() {
    setHighlight((current) => ({ ...current, opacity: 0 }));
  }

  // If the user clicks a link to a section of the homepage, scroll to that
  // section instead of navigating to a new page. If they're already on the
  // homepage, just scroll to the section. If they're somewhere else, go to
  // the homepage and then scroll to the section once it's loaded.

  function handleSectionLink(e, href) {
    e.preventDefault();
    setMobileOpen(false);
    if (location.pathname === '/') {
      document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate(`/${href}`);
    }
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setSession(null);
    setMobileOpen(false);
  }

  const dashboardPath = session?.role === 'admin' ? '/admin' : '/dashboard';

  return (
    <header className="krew-public-nav">
      <div className="krew-public-nav-inner">
        <Logo className="krew-public-nav-logo" onClick={() => setMobileOpen(false)} />

        <nav
          className="krew-public-nav-links"
          ref={linksRef}
          onMouseLeave={hideHighlight}
        >
          <span className="krew-public-nav-highlight" style={{ left: highlight.left, width: highlight.width, opacity: highlight.opacity }} aria-hidden="true" />
          {NAV_LINKS.map((link) =>
            link.to ? (
              <Link
                key={link.label}
                to={link.to}
                className="krew-public-nav-link"
                onMouseEnter={(e) => moveHighlightTo(e.currentTarget)}
                onFocus={(e) => moveHighlightTo(e.currentTarget)}
                onBlur={hideHighlight}
              >
                {link.label}
              </Link>
            ) : (
              <a
                key={link.label}
                href={`/${link.href}`}
                className="krew-public-nav-link"
                onClick={(e) => handleSectionLink(e, link.href)}
                onMouseEnter={(e) => moveHighlightTo(e.currentTarget)}
                onFocus={(e) => moveHighlightTo(e.currentTarget)}
                onBlur={hideHighlight}
              >
                {link.label}
              </a>
            )
          )}
        </nav>

        <div className="krew-public-nav-actions">
          <ThemeToggle />
          {session ? (
            <>
              <Link to={dashboardPath} className="krew-button-secondary krew-public-nav-btn">Dashboard</Link>
              <button type="button" className="krew-dash-text-btn" onClick={handleLogout}>Log out</button>
            </>
          ) : (
            <Link to="/login" className="krew-button-primary krew-public-nav-btn">Sign in</Link>
          )}
        </div>

        <ThemeToggle className="krew-public-nav-theme-mobile" />

        <button
          type="button"
          className="krew-public-nav-toggle"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMobileOpen((current) => !current)}
        >
          {mobileOpen ? <X size={22} strokeWidth={1.75} /> : <Menu size={22} strokeWidth={1.75} />}
        </button>
      </div>

      {mobileOpen && (
        <nav className="krew-public-nav-mobile">
          {NAV_LINKS.map((link) =>
            link.to ? (
              <Link key={link.label} to={link.to} className="krew-public-nav-mobile-link" onClick={() => setMobileOpen(false)}>
                {link.label}
              </Link>
            ) : (
              <a
                key={link.label}
                href={`/${link.href}`}
                className="krew-public-nav-mobile-link"
                onClick={(e) => handleSectionLink(e, link.href)}
              >
                {link.label}
              </a>
            )
          )}
          <div className="krew-public-nav-mobile-actions">
            {session ? (
              <>
                <Link to={dashboardPath} className="krew-button-secondary krew-public-nav-btn" onClick={() => setMobileOpen(false)}>Dashboard</Link>
                <button type="button" className="krew-dash-text-btn" onClick={handleLogout}>Log out</button>
              </>
            ) : (
              <Link to="/login" className="krew-button-primary krew-public-nav-btn" onClick={() => setMobileOpen(false)}>Sign in</Link>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}