import { useState } from 'react';

// Login page component. Renders a form for the user to log in with their phone number and password.
// On successful login, calls the onLoggedIn callback with the user data.

export default function Login({ onLoggedIn, heading = 'Log in', subhead = '' }) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [banner, setBanner] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setBanner(null);
    setSubmitting(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), password }),
      });
      const data = await response.json();

      if (!response.ok) {
        setBanner({ type: 'error', text: data.error || 'Something went wrong. Please try again.' });
        return;
      }

      onLoggedIn(data);
    } catch (err) {
      // fetch itself throws when there's no network connection at all.
      setBanner({ type: 'error', text: 'Could not reach the server. Check your connection and try again.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="krew-auth-page">
      <div className="krew-wordmark">
        KRE<span>W</span>
      </div>

      <div className="krew-headline-wrap">
        <h1 className="krew-headline">{heading}</h1>
        {subhead && <p className="krew-subhead">{subhead}</p>}
      </div>

      <div className="krew-card">
        {banner && <div className={`krew-form-banner ${banner.type}`}>{banner.text}</div>}

        <form onSubmit={handleSubmit}>
          <div className="krew-field">
            <label className="krew-field-label" htmlFor="login-phone">Phone Number</label>
            <input
              id="login-phone"
              type="tel"
              className="krew-field-input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0712345678"
            />
          </div>

          <div className="krew-field">
            <label className="krew-field-label" htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              className="krew-field-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
            />
          </div>

          <button type="submit" className="krew-button-primary" disabled={submitting}>
            {submitting ? 'Logging in…' : 'Log in'}
          </button>
        </form>
      </div>
    </div>
  );
}