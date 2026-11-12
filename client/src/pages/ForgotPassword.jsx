import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Phone, PhoneCall } from 'lucide-react';
import AuthLayout from '../components/AuthLayout.jsx';
import usePageMeta from '../usePageMeta.js';
import { PAGE_META } from '../pageMeta.js';

// Step 1 of a password reset. KREW has no email or SMS, so a person checks it's really you:
// you ask here, a KREW admin calls the number on your account, and reads you a one-time code
// to use on the next page (/reset-password). The answer is the same whether or not the number
// has an account, so this page can't be used to find out who's registered.
export default function ForgotPassword() {
  usePageMeta(PAGE_META['/forgot-password']);
  const [phone, setPhone] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Something went wrong. Please try again.');
        return;
      }
      setSent(true);
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <div className="krew-headline-wrap">
        <h1 className="krew-headline">Forgot your password?</h1>
        <p className="krew-subhead">
          Enter the phone number on your account. A KREW admin will call you to check it's really you, then give you a
          reset code.
        </p>
      </div>

      <div className="krew-card">
        {sent ? (
          <div className="krew-reset-sent">
            <PhoneCall size={28} strokeWidth={1.4} aria-hidden="true" />
            <p>
              <strong>Request received.</strong> If {phone.trim()} has a KREW account, an admin will call that number
              soon. Answer a couple of questions about your account and they'll read you an 8-character code. The code
              works for 30 minutes.
            </p>
            <Link
              to={`/reset-password?phone=${encodeURIComponent(phone.trim())}`}
              className="krew-button-primary krew-reset-link"
            >
              I have my code
            </Link>
          </div>
        ) : (
          <>
            {error && <div className="krew-form-banner error">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="krew-field">
                <label className="krew-field-label" htmlFor="forgot-phone">Phone Number</label>
                <div className="krew-field-input-wrap">
                  <span className="krew-field-input-icon" aria-hidden="true"><Phone size={17} strokeWidth={1.75} /></span>
                  <input
                    id="forgot-phone"
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
              <button type="submit" className="krew-button-primary" disabled={submitting}>
                {submitting ? 'Sending…' : 'Ask for a reset'}
              </button>
            </form>
          </>
        )}

        <div className="krew-fine-print">
          Already have a code? <Link to="/reset-password">Enter it</Link> · <Link to="/login">Back to log in</Link>
        </div>
      </div>
    </AuthLayout>
  );
}
