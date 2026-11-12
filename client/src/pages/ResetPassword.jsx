import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Phone, KeyRound, Lock, Eye, EyeOff, BadgeCheck } from 'lucide-react';
import AuthLayout from '../components/AuthLayout.jsx';
import usePageMeta from '../usePageMeta.js';
import { PAGE_META } from '../pageMeta.js';

// Step 2 of a password reset: the code a KREW admin read out over the phone, plus a new
// password. On success every device that was logged in to the account is logged out.
export default function ResetPassword() {
  usePageMeta(PAGE_META['/reset-password']);
  const [searchParams] = useSearchParams();
  const [phone, setPhone] = useState(searchParams.get('phone') || '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Your new password must be at least 8 characters.');
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), code: code.trim(), password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Something went wrong. Please try again.');
        return;
      }
      setDone(true);
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <div className="krew-headline-wrap">
        <h1 className="krew-headline">Set a new password</h1>
        <p className="krew-subhead">Use the code a KREW admin gave you on the phone. It works for 30 minutes.</p>
      </div>

      <div className="krew-card">
        {done ? (
          <div className="krew-reset-sent">
            <BadgeCheck size={28} strokeWidth={1.4} aria-hidden="true" />
            <p>
              <strong>Password changed.</strong> You've been logged out everywhere else - log in with your new password.
            </p>
            <Link to="/login" className="krew-button-primary krew-reset-link">
              Log in
            </Link>
          </div>
        ) : (
          <>
            {error && <div className="krew-form-banner error">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="krew-field">
                <label className="krew-field-label" htmlFor="reset-phone">Phone Number</label>
                <div className="krew-field-input-wrap">
                  <span className="krew-field-input-icon" aria-hidden="true"><Phone size={17} strokeWidth={1.75} /></span>
                  <input
                    id="reset-phone"
                    type="tel"
                    className="krew-field-input"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0712345678"
                    autoComplete="tel"
                    required
                  />
                </div>
              </div>

              <div className="krew-field">
                <label className="krew-field-label" htmlFor="reset-code">Reset code</label>
                <div className="krew-field-input-wrap">
                  <span className="krew-field-input-icon" aria-hidden="true"><KeyRound size={17} strokeWidth={1.75} /></span>
                  <input
                    id="reset-code"
                    type="text"
                    className="krew-field-input krew-reset-code-input"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="ABCD-2345"
                    autoComplete="one-time-code"
                    autoCapitalize="characters"
                    spellCheck="false"
                    maxLength={12}
                    required
                  />
                </div>
              </div>

              <div className="krew-field">
                <label className="krew-field-label" htmlFor="reset-password">New password</label>
                <div className="krew-field-input-wrap">
                  <span className="krew-field-input-icon" aria-hidden="true"><Lock size={17} strokeWidth={1.75} /></span>
                  <input
                    id="reset-password"
                    type={showPassword ? 'text' : 'password'}
                    className="krew-field-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    required
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
                {submitting ? 'Saving…' : 'Set new password'}
              </button>
            </form>
          </>
        )}

        <div className="krew-fine-print">
          No code yet? <Link to="/forgot-password">Ask for a reset</Link> · <Link to="/login">Back to log in</Link>
        </div>
      </div>
    </AuthLayout>
  );
}
