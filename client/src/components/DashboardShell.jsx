import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, CircleHelp, LogOut, KeyRound } from 'lucide-react';
import Logo from './Logo.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import NotificationBell from './NotificationBell.jsx';
import ChangePasswordDialog from './ChangePasswordDialog.jsx';

function initials(name) {
  return (name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

// The logged-in app frame from the moodboard's dashboard panels: a sidebar with the logo, the
// section links (bare line icons) and help / log out at the bottom, and a slim top bar with the
// theme switch, notifications and the person's avatar. Shared by the crew and organizer
// dashboards (and admin) so they all feel like the same product. On phones the sidebar slides
// in from the left behind a menu button.
export default function DashboardShell({ user, navItems, active, onNavigate, onLogout, children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Close the phone menu with Esc.
  useEffect(() => {
    if (!menuOpen) return undefined;
    function handleKey(e) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [menuOpen]);

  function handleNavigate(key) {
    setMenuOpen(false);
    onNavigate(key);
  }

  return (
    <div className="krew-shell">
      <aside className={`krew-shell-sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="krew-shell-sidebar-top">
          <Logo />
          <button type="button" className="krew-shell-close" onClick={() => setMenuOpen(false)} aria-label="Close menu">
            <X size={20} strokeWidth={1.75} />
          </button>
        </div>

        <nav className="krew-shell-nav" aria-label="Dashboard">
          {navItems.map(({ key, label, icon: Icon, badge }) => (
            <button
              type="button"
              key={key}
              className={`krew-shell-nav-item ${active === key ? 'active' : ''}`}
              aria-current={active === key ? 'page' : undefined}
              onClick={() => handleNavigate(key)}
            >
              <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
              <span>{label}</span>
              {badge ? <span className="krew-shell-nav-badge">{badge}</span> : null}
            </button>
          ))}
        </nav>

        <div className="krew-shell-sidebar-bottom">
          <Link to="/faq" className="krew-shell-help">
            <CircleHelp size={20} strokeWidth={1.5} aria-hidden="true" />
            <span>
              Need help?
              <small>Read the FAQ</small>
            </span>
          </Link>
          <button
            type="button"
            className="krew-shell-logout"
            onClick={() => {
              setMenuOpen(false);
              setChangingPassword(true);
            }}
          >
            <KeyRound size={20} strokeWidth={1.5} aria-hidden="true" />
            Change password
          </button>
          <button type="button" className="krew-shell-logout" onClick={onLogout}>
            <LogOut size={20} strokeWidth={1.5} aria-hidden="true" />
            Log out
          </button>
        </div>
      </aside>

      {menuOpen && <div className="krew-shell-backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true" />}

      <div className="krew-shell-main">
        <header className="krew-shell-topbar">
          <button type="button" className="krew-shell-menu" onClick={() => setMenuOpen(true)} aria-label="Open menu">
            <Menu size={22} strokeWidth={1.75} />
          </button>
          <Logo className="krew-shell-topbar-logo" />
          <div className="krew-shell-topbar-actions">
            <ThemeToggle />
            <NotificationBell />
            <span className="krew-shell-avatar" title={user.name}>
              {user.profile_photo_path ? (
                <img src={`/uploads/${user.profile_photo_path}`} alt="" />
              ) : (
                <span aria-hidden="true">{initials(user.name)}</span>
              )}
            </span>
          </div>
        </header>

        <main className="krew-shell-content">{children}</main>
        {changingPassword && <ChangePasswordDialog onClose={() => setChangingPassword(false)} />}
      </div>
    </div>
  );
}
