import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { X, Download, UserRoundX } from 'lucide-react';

// "Your data", opened from the dashboard sidebar (DashboardShell.jsx). Kenya's Data Protection
// Act gives everyone the right to see the data held about them and to have it deleted
// (NFR6 in the SRS), so this offers both:
// - a copy of your data, downloaded straight away as a file (GET /api/users/me/data);
// - a request to delete your account, which an admin carries out (routes/admin.js), because
//   deleting touches the other person's side of every job you did.

function formatServerDay(value) {
  if (!value) return '';
  return new Date(`${value.replace(' ', 'T')}Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function YourDataDialog({ onClose }) {
  const [request, setRequest] = useState(undefined); // undefined while loading, null when there's none
  const [asking, setAsking] = useState(false); // the delete form is open
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
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

  useEffect(() => {
    fetch('/api/users/me/deletion-request')
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setRequest(data))
      .catch(() => setRequest(null));
  }, []);

  async function send(method, body) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/users/me/deletion-request', {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Something went wrong. Please try again.');
        return;
      }
      setRequest(method === 'POST' ? data : null);
      setAsking(false);
      setReason('');
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  const waiting = request?.status === 'open';

  return (
    <div className="krew-moment-backdrop" onClick={onClose}>
      <div className="krew-cp-hire-dialog" role="dialog" aria-modal="true" aria-label="Your data" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="krew-cp-hire-close" onClick={onClose} aria-label="Close">
          <X size={20} strokeWidth={1.75} />
        </button>

        <div className="krew-card krew-dash-form-card">
          <h2 className="krew-dash-form-title">Your data</h2>
          <p className="krew-yd-intro">
            KREW keeps your account details, your jobs and payments, and the ID photos only admins can see. Under Kenya's
            Data Protection Act you can get a copy at any time, or ask for your account to be deleted. See the{' '}
            <Link to="/privacy" onClick={onClose}>Privacy Policy</Link> for what each part is used for.
          </p>

          {error && <div className="krew-form-banner error">{error}</div>}

          <section className="krew-yd-section">
            <Download size={22} strokeWidth={1.4} aria-hidden="true" className="krew-yd-icon" />
            <div>
              <h3>Get a copy</h3>
              <p>One file with your profile, jobs, payments, disputes and notifications.</p>
              <a className="krew-button-secondary krew-button-inline krew-db-small-btn" href="/api/users/me/data" download>
                Download my data
              </a>
            </div>
          </section>

          <section className="krew-yd-section">
            <UserRoundX size={22} strokeWidth={1.4} aria-hidden="true" className="krew-yd-icon" />
            <div>
              <h3>Delete my account</h3>

              {request === undefined && <p role="status">Loading…</p>}

              {waiting && (
                <>
                  <p>
                    You asked on {formatServerDay(request.created_at)}. An admin will delete your account and let you know if
                    anything needs sorting out first, such as a job still in progress.
                  </p>
                  <button
                    type="button"
                    className="krew-button-secondary krew-button-inline krew-db-small-btn"
                    disabled={busy}
                    onClick={() => send('DELETE')}
                  >
                    {busy ? 'Cancelling…' : 'Cancel my request'}
                  </button>
                </>
              )}

              {request !== undefined && !waiting && (
                <>
                  {request?.status === 'declined' && (
                    <div className="krew-form-banner warning">
                      Your last request was not completed. The admin said: {request.response_note}
                    </div>
                  )}
                  <p>
                    Your name, phone number, password, photos, ID and selfie are removed for good. The jobs and payments you
                    did stay on the other person's history, shown as "Deleted account".
                  </p>
                  {asking ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        send('POST', { reason });
                      }}
                    >
                      <div className="krew-field">
                        <label className="krew-field-label" htmlFor="deletion-reason">
                          Why are you leaving? (optional)
                        </label>
                        <textarea
                          id="deletion-reason"
                          className="krew-field-input krew-field-textarea"
                          rows={3}
                          maxLength={500}
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                        />
                      </div>
                      <div className="krew-dash-form-actions">
                        <button type="button" className="krew-button-secondary" onClick={() => setAsking(false)} disabled={busy}>
                          Keep my account
                        </button>
                        <button type="submit" className="krew-button-secondary krew-adm-reject" disabled={busy}>
                          {busy ? 'Sending…' : 'Send deletion request'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button
                      type="button"
                      className="krew-button-secondary krew-button-inline krew-db-small-btn krew-adm-reject"
                      onClick={() => setAsking(true)}
                    >
                      Ask to delete my account
                    </button>
                  )}
                </>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
