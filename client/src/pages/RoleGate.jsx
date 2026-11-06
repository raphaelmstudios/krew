import { useEffect, useState } from 'react';
import Login from './Login.jsx';

// A gate that checks the user's role before showing the real content.
// If the user is not logged in, it shows a login form.
// If the user is logged in but does not have an allowed role, it shows a forbidden message and a logout button.
// If the user is logged in with an allowed role, it shows the real content (children).
export default function RoleGate({ role, loginHeading, loginSubhead, forbiddenMessage, showSignupLink = true, children }) {
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
      const response = await fetch('/api/auth/me');
      if (!response.ok) {
        setStatus('loggedOut');
        return;
      }
      const loggedInUser = await response.json();
      setUser(loggedInUser);
      setStatus(allowedRoles.includes(loggedInUser.role) ? 'ready' : 'forbidden');
    } catch (err) {
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
      <div className="krew-admin-empty" style={{ maxWidth: 480, margin: '80px auto' }}>
        Checking your session…
      </div>
    );
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