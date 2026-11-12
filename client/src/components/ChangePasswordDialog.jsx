import { useEffect, useRef, useState } from 'react';
import { X, Lock, Eye, EyeOff, BadgeCheck } from 'lucide-react';

// Change password while logged in (opened from the dashboard sidebar - DashboardShell.jsx).
// Needs the current password; on success every other device is logged out, this one stays in.
export default function ChangePasswordDialog({ onClose }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const firstFieldRef = useRef(null);

  useEffect(() => {
    firstFieldRef.current?.focus();
    function handleKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    document.body.classList.add('krew-modal-open');
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.classList.remove('krew-modal-open');
    };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (next.length < 8) {
      setError('Your new password must be at least 8 characters.');
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: current, new_password: next }),
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

  const type = show ? 'text' : 'password';

  return (
    <div className="krew-moment-backdrop" onClick={onClose}>
      <div className="krew-cp-hire-dialog" role="dialog" aria-modal="true" aria-label="Change password" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="krew-cp-hire-close" onClick={onClose} aria-label="Close">
          <X size={20} strokeWidth={1.75} />
        </button>

        {done ? (
          <div className="krew-cp-hire-done">
            <BadgeCheck size={44} strokeWidth={1.2} aria-hidden="true" />
            <h2>Password changed</h2>
            <p>You're still logged in here. Any other phone or computer that was logged in to your account has been logged out.</p>
            <div className="krew-cp-hire-done-actions">
              <button type="button" className="krew-button-primary krew-button-inline" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <div className="krew-card krew-dash-form-card">
            <h2 className="krew-dash-form-title">Change password</h2>
            {error && <div className="krew-form-banner error">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="krew-field">
                <label className="krew-field-label" htmlFor="current-password">Current password</label>
                <div className="krew-field-input-wrap">
                  <span className="krew-field-input-icon" aria-hidden="true"><Lock size={17} strokeWidth={1.75} /></span>
                  <input
                    id="current-password"
                    ref={firstFieldRef}
                    type={type}
                    className="krew-field-input"
                    value={current}
                    onChange={(e) => setCurrent(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </div>
              </div>
              <div className="krew-field">
                <label className="krew-field-label" htmlFor="new-password">New password</label>
                <div className="krew-field-input-wrap">
                  <span className="krew-field-input-icon" aria-hidden="true"><Lock size={17} strokeWidth={1.75} /></span>
                  <input
                    id="new-password"
                    type={type}
                    className="krew-field-input"
                    value={next}
                    onChange={(e) => setNext(e.target.value)}
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    className="krew-field-toggle"
                    onClick={() => setShow((value) => !value)}
                    aria-label={show ? 'Hide passwords' : 'Show passwords'}
                  >
                    {show ? <EyeOff size={17} strokeWidth={1.75} /> : <Eye size={17} strokeWidth={1.75} />}
                  </button>
                </div>
              </div>
              <div className="krew-dash-form-actions">
                <button type="button" className="krew-button-secondary" onClick={onClose} disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="krew-button-primary krew-dash-form-submit" disabled={submitting}>
                  {submitting ? 'Saving…' : 'Change password'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
