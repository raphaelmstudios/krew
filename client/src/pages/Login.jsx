import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Phone, Lock, Eye, EyeOff } from 'lucide-react';
import AuthLayout from '../components/AuthLayout.jsx';

// Offers to save this phone number and password in the browser's own password manager
// (Chrome, Edge and others support this). Next time, clicking the phone field shows a
// dropdown of saved accounts, and picking one fills in both fields. KREW itself never keeps
// a copy - the browser stores it, protected by the device's own lock.
// Browsers without this (Safari, Firefox) still offer to save, from the autocomplete hints
// on the fields below.
function rememberLogin(phone, password) {
  if (typeof window.PasswordCredential !== 'function' || !navigator.credentials?.store) return;
  try {
    const credential = new window.PasswordCredential({ id: phone, password, name: phone });
    navigator.credentials.store(credential).catch(() => {});
  } catch {
    // Not allowed here (e.g. inside a private window) - nothing to do.
  }
}

// Login page component. Renders a form for the user to log in with their phone number and password.
// On successful login, calls the onLoggedIn callback with the user data.
// The autoComplete="username" / "current-password" hints are what let the browser's password
// manager recognise this as a log in form, offer its saved accounts and fill them in.
export default function Login({ onLoggedIn, heading = 'Log in', subhead = '', showSignupLink = true }) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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

      rememberLogin(phone.trim(), password);
      onLoggedIn(data);
    } catch {
      // fetch itself throws when there's no network connection at all.
      setBanner({ type: 'error', text: 'Could not reach the server. Check your connection and try again.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <div className="krew-headline-wrap">
        <h1 className="krew-headline">{heading}</h1>
        {subhead && <p className="krew-subhead">{subhead}</p>}
      </div>

      <div className="krew-card">
        {banner && <div className={`krew-form-banner ${banner.type}`}>{banner.text}</div>}

        <form onSubmit={handleSubmit} method="post">
          <div className="krew-field">
            <label className="krew-field-label" htmlFor="login-phone">Phone Number</label>
            <div className="krew-field-input-wrap">
              <span className="krew-field-input-icon" aria-hidden="true"><Phone size={17} strokeWidth={1.75} /></span>
              <input
                id="login-phone"
                name="username"
                type="tel"
                inputMode="tel"
                autoComplete="username"
                className="krew-field-input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0712345678"
              />
            </div>
          </div>

          <div className="krew-field">
            <div className="krew-field-label-row">
              <label className="krew-field-label" htmlFor="login-password">Password</label>
              <Link to="/forgot-password" className="krew-forgot-link">Forgot password?</Link>
            </div>
            <div className="krew-field-input-wrap has-toggle">
              <span className="krew-field-input-icon" aria-hidden="true"><Lock size={17} strokeWidth={1.75} /></span>
              <input
                id="login-password"
                name="password"
                autoComplete="current-password"
                type={showPassword ? 'text' : 'password'}
                className="krew-field-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
              />
              <button
                type="button"
                className="krew-field-toggle"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={17} strokeWidth={1.75} /> : <Eye size={17} strokeWidth={1.75} />}
              </button>
            </div>
          </div>

          <button type="submit" className="krew-button-primary" disabled={submitting}>
            {submitting ? 'Logging in…' : 'Log in'}
          </button>
        </form>

        {showSignupLink && (
          <div className="krew-fine-print">
            Don't have an account? <Link to="/register">Sign up</Link>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}