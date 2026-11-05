import { useState } from 'react';

// JobCard component.
// Displays a job card with details about the job, the counterpart's name, and confirmation status.
// Allows the user to confirm payment for the job if they are an organizer or crew member.
// Also lets either side raise a dispute on the job, as long as it isn't disputed already.

export default function JobCard({ job, viewerRole, onConfirmed }) {
  const [confirming, setConfirming] = useState(false);
  const [amount, setAmount] = useState('');
  const [banner, setBanner] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [disputing, setDisputing] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeBanner, setDisputeBanner] = useState(null);
  const [disputeSubmitting, setDisputeSubmitting] = useState(false);

  const counterpartName = viewerRole === 'organizer' ? job.crew_member_name : job.organizer_name;
  const myConfirmedAt = viewerRole === 'organizer' ? job.organizer_confirmed_at : job.crew_confirmed_at;
  const myConfirmedAmount = viewerRole === 'organizer' ? job.organizer_confirmed_amount : job.crew_confirmed_amount;
  const theirConfirmedAt = viewerRole === 'organizer' ? job.crew_confirmed_at : job.organizer_confirmed_at;
  const theirConfirmedAmount = viewerRole === 'organizer' ? job.crew_confirmed_amount : job.organizer_confirmed_amount;

  // Both sides have confirmed, but the job is still showing as pending instead of
  // confirmed - the only reason that happens is the two amounts didn't match.
  const bothConfirmed = Boolean(myConfirmedAt) && Boolean(theirConfirmedAt);
  const mismatch = job.status === 'pending' && bothConfirmed && Number(myConfirmedAmount) !== Number(theirConfirmedAmount);

  function openForm() {
    setBanner(null);
    setAmount(myConfirmedAmount != null ? String(myConfirmedAmount) : '');
    setConfirming(true);
    setDisputing(false);
  }

  function openDisputeForm() {
    setDisputeBanner(null);
    setDisputeReason('');
    setDisputing(true);
    setConfirming(false);
  }

  async function handleConfirm(e) {
    e.preventDefault();
    setBanner(null);

    if (!amount || Number(amount) <= 0) {
      setBanner({ type: 'error', text: 'Enter an amount greater than zero.' });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/jobs/${job.id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(amount) }),
      });
      const data = await response.json();

      if (!response.ok) {
        setBanner({ type: 'error', text: data.error || 'Something went wrong. Please try again.' });
        return;
      }

      setConfirming(false);
      setAmount('');
      onConfirmed();
    } catch (err) {
      // fetch itself throws when there's no network connection at all.
      setBanner({ type: 'error', text: 'Could not reach the server. Check your connection and try again.' });
    } finally {
      setSubmitting(false);
    }
  }

  // Raises a dispute on the job. Once this succeeds the job's status becomes 'disputed'
  // on the server, which also takes it out of both sides' reciprocal records - the same
  // onConfirmed() refresh used after a payment confirmation picks up the new status here.
  async function handleDispute(e) {
    e.preventDefault();
    setDisputeBanner(null);

    if (!disputeReason.trim()) {
      setDisputeBanner({ type: 'error', text: 'Enter a reason for the dispute.' });
      return;
    }

    setDisputeSubmitting(true);
    try {
      const response = await fetch(`/api/jobs/${job.id}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: disputeReason.trim() }),
      });
      const data = await response.json();

      if (!response.ok) {
        setDisputeBanner({ type: 'error', text: data.error || 'Something went wrong. Please try again.' });
        return;
      }

      setDisputing(false);
      setDisputeReason('');
      onConfirmed();
    } catch (err) {
      setDisputeBanner({ type: 'error', text: 'Could not reach the server. Check your connection and try again.' });
    } finally {
      setDisputeSubmitting(false);
    }
  }

  return (
    <div className="krew-job-card krew-job-card-confirmable">
      <div className="krew-job-card-top">
        <div className="krew-job-card-main">
          <div className="krew-job-card-crew">{counterpartName}</div>
          {job.job_description && <div className="krew-job-card-desc">{job.job_description}</div>}
          <div className="krew-job-card-meta">Due {new Date(job.due_date).toLocaleDateString()}</div>
        </div>
        <div className="krew-job-card-side">
          <div className="krew-job-card-amount">KES {Number(job.amount).toLocaleString()}</div>
          <span className={`krew-status-pill ${job.status}`}>{job.status}</span>
        </div>
      </div>

      <div className="krew-confirmation-block">
        <div className="krew-confirmation-row">
          <span>
            You {myConfirmedAt ? `confirmed KES ${Number(myConfirmedAmount).toLocaleString()}` : "haven't confirmed payment yet"}
          </span>
          {job.status === 'pending' && !confirming && (
            <button type="button" className="krew-dash-text-btn" onClick={openForm}>
              {myConfirmedAt ? 'Update' : 'Confirm payment'}
            </button>
          )}
        </div>
        <div className="krew-confirmation-row">
          <span>
            {counterpartName} {theirConfirmedAt ? `confirmed KES ${Number(theirConfirmedAmount).toLocaleString()}` : "hasn't confirmed yet"}
          </span>
        </div>

        {mismatch && (
          <div className="krew-form-banner warning">
            These don't match - double-check the amount and update yours if it's wrong.
          </div>
        )}

        {confirming && (
          <form className="krew-confirmation-form" onSubmit={handleConfirm}>
            {banner && <div className={`krew-form-banner ${banner.type}`}>{banner.text}</div>}
            <input
              type="number"
              min="1"
              step="1"
              className="krew-field-input"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount (KES)"
              autoFocus
            />
            <div className="krew-confirmation-form-actions">
              <button
                type="button"
                className="krew-dash-text-btn"
                onClick={() => setConfirming(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button type="submit" className="krew-button-primary krew-dash-post-btn" disabled={submitting}>
                {submitting ? 'Saving…' : 'Submit'}
              </button>
            </div>
          </form>
        )}

        {job.status !== 'disputed' && !confirming && !disputing && (
          <div className="krew-confirmation-row">
            <button type="button" className="krew-dash-text-btn danger" onClick={openDisputeForm}>
              Raise a dispute
            </button>
          </div>
        )}

        {disputing && (
          <form className="krew-confirmation-form" onSubmit={handleDispute}>
            {disputeBanner && <div className={`krew-form-banner ${disputeBanner.type}`}>{disputeBanner.text}</div>}
            <textarea
              className="krew-field-input"
              rows={2}
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder="What's wrong with this job?"
              autoFocus
            />
            <div className="krew-confirmation-form-actions">
              <button
                type="button"
                className="krew-dash-text-btn"
                onClick={() => setDisputing(false)}
                disabled={disputeSubmitting}
              >
                Cancel
              </button>
              <button type="submit" className="krew-button-primary krew-dash-post-btn" disabled={disputeSubmitting}>
                {disputeSubmitting ? 'Saving…' : 'Submit'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}