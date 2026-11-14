import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import Login from './Login.jsx';

// A gate that checks the user's role before showing the real content.
// If the user is not logged in, it shows a login form.
// If the user is logged in but does not have an allowed role, it shows a forbidden message and a logout button.
// If the user is logged in with an allowed role, it shows the real content (children).
// redirects sends a logged-in role that belongs somewhere else straight there instead of
// showing the forbidden message - e.g. an admin who opens /dashboard lands on /admin.
export default function RoleGate({ role, loginHeading, loginSubhead, forbiddenMessage, showSignupLink = true, redirects = {}, children }) {
  const allowedRoles = Array.isArray(role) ? role : [role];

  // checking -> looking up the session on load
  // loggedOut -> no valid session at all, show the login form
  // forbidden -> logged in, but not with an allowed role
  // ready -> logged in with an allowed role, show the real screen
  const [status, setStatus] = useState('checking');
  const [user, setUser] = useState(null);

  useEffect(() => {
    checkSession();
  }, []);

  async function checkSession() {
    try {
      // /api/auth/session answers 200 with user: null when nobody is logged in, so a
      // logged-out visit doesn't show up as an error in the browser console.
      const response = await fetch('/api/auth/session');
      const loggedInUser = response.ok ? (await response.json()).user : null;
      if (!loggedInUser) {
        setStatus('loggedOut');
        return;
      }
      setUser(loggedInUser);
      setStatus(allowedRoles.includes(loggedInUser.role) ? 'ready' : 'forbidden');
    } catch {
      setStatus('loggedOut');
    }
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setStatus('loggedOut');
  }

  if (status === 'checking') {
    return (
      <div style={{ maxWidth: 480, margin: '80px auto', textAlign: 'center' }}>
        <span className="krew-dash-loading-note" role="status">Checking your session…</span>
      </div>
    );
  }

  if (status === 'forbidden' && redirects[user?.role]) {
    return <Navigate to={redirects[user.role]} replace />;
  }

  if (status === 'forbidden') {
    return (
      <div className="krew-admin-empty" style={{ maxWidth: 480, margin: '80px auto' }}>
        {forbiddenMessage}{' '}
        <button type="button" className="krew-admin-logout" onClick={handleLogout}>
          Log out and try a different account
        </button>
      </div>
    );
  }

  if (status === 'loggedOut') {
    return (
      <Login
        heading={loginHeading}
        subhead={loginSubhead}
        onLoggedIn={checkSession}
        showSignupLink={showSignupLink}
      />
    );
  }

  return children({ user, onLogout: handleLogout });
}