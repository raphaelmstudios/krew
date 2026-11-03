import { useEffect, useState } from 'react';
import Login from './Login.jsx';
import Admin from './Admin.jsx';

// Sits in front of the admin screen so only a logged-in admin can see it.

export default function AdminGate() {
  // checking -> looking up the session on load
  // loggedOut -> no valid session at all, show the login form
  // forbidden -> logged in, but not as an admin
  // admin -> logged in as an admin, show the real screen
  const [status, setStatus] = useState('checking');

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
      const user = await response.json();
      setStatus(user.role === 'admin' ? 'admin' : 'forbidden');
    } catch (err) {
      setStatus('loggedOut');
    }
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
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
        This account isn't an admin account.{' '}
        <button type="button" className="krew-admin-logout" onClick={handleLogout}>
          Log out and try a different account
        </button>
      </div>
    );
  }

  if (status === 'loggedOut') {
    return (
      <Login
        heading="Admin sign-in"
        subhead="Sign in with an admin account to review pending approvals."
        onLoggedIn={checkSession}
      />
    );
  }

  return <Admin onLogout={handleLogout} />;
}