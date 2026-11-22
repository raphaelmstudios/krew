import { useEffect, useState } from 'react';
import { PhoneCall } from 'lucide-react';

// Admin: people asking for their account to be deleted (NFR6, Kenya's Data Protection Act).
// Each request shows whether the person still has jobs in progress, since deleting then would
// leave the other side waiting. The admin either deletes the account (routes/admin.js lists
// what is removed and what is kept) or declines with a note the person sees.

function initials(name) {
  return (name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

function formatServerDay(value) {
  if (!value) return '';
  return new Date(`${value.replace(' ', 'T')}Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function roleLabel(role) {
  return role === 'crew_member' ? 'Crew member' : role === 'organizer' ? 'Organizer' : role;
}

const STATUS_LABELS = { done: 'Deleted', declined: 'Declined', cancelled: 'Cancelled by them' };

export default function AdminDataRequests({ onChange }) {
  const [requests, setRequests] = useState(null);
  const [error, setError] = useState(null);
  const [openId, setOpenId] = useState(null); // which request's decision form is open
  const [mode, setMode] = useState('complete'); // 'complete' or 'decline'
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const response = await fetch('/api/admin/data-requests');
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Could not load the requests.');
        return;
      }
      setRequests(data);
      onChange?.(data.filter((request) => request.status === 'open').length);
    } catch {
      setError('Could not reach the server.');
    }
  }

  function openForm(request, nextMode) {
    setOpenId(request.id);
    setMode(nextMode);
    setNote('');
    setError(null);
  }

  async function submit(request) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/data-requests/${request.id}/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response_note: note }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Something went wrong. Please try again.');
        return;
      }
      setOpenId(null);
      load();
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  }

  const open = requests ? requests.filter((request) => request.status === 'open') : [];
  const handled = requests ? requests.filter((request) => request.status !== 'open') : [];

  return (
    <>
      <div className="krew-db-head">
        <h1>Data requests</h1>
        <p>
          People asking for their account to be deleted, as Kenya's Data Protection Act allows. Deleting removes their name,
          number, password, photos, ID and selfie for good. Their jobs and payments stay on the other person's history as
          "Deleted account". If they still have a job in progress, call them first.
        </p>
      </div>

      {error && <div className="krew-form-banner error">{error}</div>}
      {requests === null && !error && <div className="krew-dash-loading-note" role="status">Loading…</div>}

      {requests && open.length === 0 && (
        <div className="krew-dash-empty">
          <p>No one is waiting on an account deletion.</p>
        </div>
      )}

      {open.length > 0 && (
        <ul className="krew-adm-list krew-adm-list-card">
          {open.map((request) => (
            <li className="krew-adm-row krew-adm-datareq" key={request.id}>
              <span className="krew-db-crew-avatar krew-adm-avatar" aria-hidden="true">
                {initials(request.name)}
              </span>
              <div className="krew-adm-row-main">
                <strong>{request.name}</strong>
                <span>
                  {roleLabel(request.role)} · Asked {formatServerDay(request.created_at)}
                </span>
                <a className="krew-adm-call" href={`tel:${request.phone}`}>
                  <PhoneCall size={16} strokeWidth={1.6} aria-hidden="true" /> {request.phone}
                </a>
                {request.reason && <p className="krew-adm-datareq-reason">"{request.reason}"</p>}
              </div>
              <span className={`krew-adm-docs ${request.open_jobs > 0 ? 'warn' : 'missing'}`}>
                {request.open_jobs > 0
                  ? `${request.open_jobs} job${request.open_jobs === 1 ? '' : 's'} still in progress`
                  : 'No jobs in progress'}
              </span>
              <div className="krew-adm-actions">
                <button
                  type="button"
                  className="krew-button-secondary krew-button-inline krew-db-small-btn krew-adm-reject"
                  onClick={() => openForm(request, 'complete')}
                >
                  Delete account
                </button>
                <button
                  type="button"
                  className="krew-button-secondary krew-button-inline krew-db-small-btn"
                  onClick={() => openForm(request, 'decline')}
                >
                  Decline
                </button>
              </div>

              {openId === request.id && (
                <form
                  className="krew-adm-datareq-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    submit(request);
                  }}
                >
                  <label className="krew-field-label" htmlFor={`datareq-note-${request.id}`}>
                    {mode === 'complete' ? 'Note for the record (optional)' : 'Why not? They will see this'}
                  </label>
                  <textarea
                    id={`datareq-note-${request.id}`}
                    className="krew-field-input krew-field-textarea"
                    rows={2}
                    maxLength={1000}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={
                      mode === 'complete' ? 'e.g. Called them on the number above to confirm.' : 'e.g. Please confirm the payment for your job with Kevin first.'
                    }
                    required={mode === 'decline'}
                  />
                  <div className="krew-adm-actions">
                    <button type="button" className="krew-button-secondary krew-button-inline krew-db-small-btn" onClick={() => setOpenId(null)} disabled={busy}>
                      Back
                    </button>
                    <button
                      type="submit"
                      className={`krew-button-inline krew-db-small-btn ${mode === 'complete' ? 'krew-button-secondary krew-adm-reject' : 'krew-button-primary'}`}
                      disabled={busy}
                    >
                      {busy ? 'Working…' : mode === 'complete' ? 'Delete this account for good' : 'Send'}
                    </button>
                  </div>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}

      {handled.length > 0 && (
        <section className="krew-db-card krew-adm-datareq-history">
          <div className="krew-db-card-head">
            <h2>Handled</h2>
          </div>
          <ul>
            {handled.map((request) => (
              <li key={request.id}>
                <span>
                  <strong>{request.name}</strong> · {roleLabel(request.role)}
                </span>
                <span className={`krew-adm-datareq-status ${request.status}`}>{STATUS_LABELS[request.status]}</span>
                <span>{formatServerDay(request.handled_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
