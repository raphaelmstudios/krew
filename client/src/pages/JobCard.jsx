import { useEffect, useState } from 'react';
import { CircleCheck, CircleDashed, BadgeCheck, Scale, TriangleAlert, ArrowRight } from 'lucide-react';
import ListingPhoto from '../components/ListingPhoto.jsx';
import PaymentConfirmedMoment, { shouldAutoOpen, releaseAutoOpen } from '../components/PaymentConfirmedMoment.jsx';

// JobCard component.
// One job between an organizer and a crew member, shown on both sides' dashboards (Payments for
// organizers, My Jobs for crew). The middle of the card is a two-step track - your confirmation
// and theirs - since a job only counts once both sides enter the same amount.
// From here either side can confirm (or correct) their amount, or raise a dispute as long as
// the job isn't disputed already.
// When a job becomes confirmed, the payment confirmation moment opens
// (components/PaymentConfirmedMoment.jsx) - straight away for whoever completed it, and the next
// time the other side opens their jobs.

const STATUS_LABELS = { pending: 'Awaiting confirmation', confirmed: 'Confirmed', disputed: 'Disputed' };

function formatDate(value) {
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Confirmation timestamps are SQLite UTC values without a timezone marker.
function formatServerDay(value) {
  return new Date(`${value.replace(' ', 'T')}Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function JobCard({ job, viewerRole, onConfirmed }) {
  const [confirming, setConfirming] = useState(false);
  const [amount, setAmount] = useState('');
  const [banner, setBanner] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [disputing, setDisputing] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeBanner, setDisputeBanner] = useState(null);
  const [disputeSubmitting, setDisputeSubmitting] = useState(false);

  const [momentJob, setMomentJob] = useState(null); // set = the confirmation moment is open

  const isOrganizer = viewerRole === 'organizer';
  const counterpartName = isOrganizer ? job.crew_member_name : job.organizer_name;
  const counterpartFirst = (counterpartName || '').split(' ')[0];
  const myConfirmedAt = isOrganizer ? job.organizer_confirmed_at : job.crew_confirmed_at;
  const myConfirmedAmount = isOrganizer ? job.organizer_confirmed_amount : job.crew_confirmed_amount;
  const theirConfirmedAt = isOrganizer ? job.crew_confirmed_at : job.organizer_confirmed_at;
  const theirConfirmedAmount = isOrganizer ? job.crew_confirmed_amount : job.organizer_confirmed_amount;

  // Both sides have confirmed, but the job is still showing as pending instead of
  // confirmed - the only reason that happens is the two amounts didn't match.
  const bothConfirmed = Boolean(myConfirmedAt) && Boolean(theirConfirmedAt);
  const mismatch = job.status === 'pending' && bothConfirmed && Number(myConfirmedAmount) !== Number(theirConfirmedAmount);

  // The other side completed this job since you last looked - show them the moment too.
  useEffect(() => {
    if (shouldAutoOpen(job)) setMomentJob(job);
  }, [job.id, job.status]);

  function closeMoment() {
    setMomentJob(null);
    releaseAutoOpen();
  }

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
      // This confirmation completed the job - open the moment with the fresh numbers.
      if (data.status === 'confirmed') {
        setMomentJob({ ...job, ...data });
      }
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

  function renderStep(label, confirmedAt, confirmedAmount, waitingText) {
    const done = Boolean(confirmedAt);
    const Icon = done ? CircleCheck : CircleDashed;
    return (
      <div className={`krew-jc-step ${done ? 'done' : ''}`}>
        <Icon size={22} strokeWidth={1.4} aria-hidden="true" />
        <span>
          <strong>{label}</strong>
          <small>
            {done ? `Confirmed KES ${Number(confirmedAmount).toLocaleString()} · ${formatServerDay(confirmedAt)}` : waitingText}
          </small>
        </span>
      </div>
    );
  }

  const canAct = job.status === 'pending';

  return (
    <article className={`krew-jc ${job.status}`}>
      <div className="krew-jc-top">
        <ListingPhoto listing={{ category: job.category, photo_path: job.photo_path }} className="krew-jc-photo" />
        <div className="krew-jc-main">
          {/* Jobs from an open listing lead with the listing's title; direct hires say so */}
          <h3 className="krew-jc-title">{job.title || 'Direct hire'}</h3>
          <span className="krew-jc-meta">
            <span>
              {isOrganizer ? 'Crew' : 'Organizer'}: <strong>{counterpartName}</strong>
            </span>
            <span>Due {formatDate(job.due_date)}</span>
            {job.location && <span>{job.location}</span>}
          </span>
          {job.job_description && <p className="krew-jc-desc">{job.job_description}</p>}
        </div>
        <div className="krew-jc-side">
          <span className="krew-jc-amount">KES {Number(job.amount).toLocaleString()}</span>
          <span className={`krew-status-pill ${job.status}`}>{STATUS_LABELS[job.status] || job.status}</span>
        </div>
      </div>

      <div className="krew-jc-track" aria-label="Payment confirmation">
        {renderStep('You', myConfirmedAt, myConfirmedAmount, isOrganizer ? 'Confirm once you’ve paid' : 'Confirm once you’ve been paid')}
        <span className={`krew-jc-track-line ${job.status === 'confirmed' ? 'done' : ''}`} aria-hidden="true" />
        {renderStep(counterpartFirst, theirConfirmedAt, theirConfirmedAmount, 'Hasn’t confirmed yet')}
      </div>

      {mismatch && (
        <p className="krew-jc-note warning">
          <TriangleAlert size={18} strokeWidth={1.6} aria-hidden="true" />
          <span>These amounts don't match - double-check yours and update it if it's wrong, or raise a dispute.</span>
        </p>
      )}

      {job.status === 'confirmed' && (
        <p className="krew-jc-note success">
          <BadgeCheck size={18} strokeWidth={1.6} aria-hidden="true" />
          <span>
            Payment confirmed - {isOrganizer ? 'it counts toward your on-time record.' : 'it shows in your verified work history.'}
          </span>
          <span className="krew-jc-note-links">
            <button type="button" className="krew-dash-text-btn" onClick={() => setMomentJob(job)}>
              View confirmation
            </button>
            {!disputing && (
              <button type="button" className="krew-dash-text-btn danger" onClick={openDisputeForm}>
                Raise a dispute
              </button>
            )}
          </span>
        </p>
      )}

      {job.status === 'disputed' && (
        <p className="krew-jc-note danger">
          <Scale size={18} strokeWidth={1.6} aria-hidden="true" />
          <span>Disputed - a KREW admin is reviewing this job. It's left out of both sides' records until it's settled.</span>
        </p>
      )}

      {confirming && (
        <form className="krew-jc-form" onSubmit={handleConfirm}>
          {banner && <div className={`krew-form-banner ${banner.type}`}>{banner.text}</div>}
          <label className="krew-field-label" htmlFor={`confirm-amount-${job.id}`}>
            {isOrganizer ? `How much did you pay ${counterpartFirst}?` : `How much did ${counterpartFirst} pay you?`}
          </label>
          <div className="krew-jc-form-row">
            <span className="krew-jc-input">
              <span aria-hidden="true">KES</span>
              <input
                id={`confirm-amount-${job.id}`}
                type="number"
                min="1"
                step="1"
                className="krew-field-input"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={String(job.amount)}
                autoFocus
              />
            </span>
            <button type="submit" className="krew-button-primary krew-button-inline krew-db-small-btn" disabled={submitting}>
              {submitting ? 'Saving…' : 'Confirm amount'}
            </button>
            <button type="button" className="krew-dash-text-btn" onClick={() => setConfirming(false)} disabled={submitting}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {disputing && (
        <form className="krew-jc-form" onSubmit={handleDispute}>
          {disputeBanner && <div className={`krew-form-banner ${disputeBanner.type}`}>{disputeBanner.text}</div>}
          <label className="krew-field-label" htmlFor={`dispute-reason-${job.id}`}>
            What's wrong with this job?
          </label>
          <textarea
            id={`dispute-reason-${job.id}`}
            className="krew-field-input"
            rows={2}
            value={disputeReason}
            onChange={(e) => setDisputeReason(e.target.value)}
            placeholder="e.g. I was paid KES 6,000, not 9,000"
            autoFocus
          />
          <div className="krew-jc-form-row">
            <button type="submit" className="krew-button-primary krew-button-inline krew-db-small-btn" disabled={disputeSubmitting}>
              {disputeSubmitting ? 'Saving…' : 'Raise dispute'}
            </button>
            <button type="button" className="krew-dash-text-btn" onClick={() => setDisputing(false)} disabled={disputeSubmitting}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Confirmed jobs keep their dispute link in the note above, so only pending jobs get this row */}
      {!confirming && !disputing && canAct && (
        <div className="krew-jc-actions">
          {canAct && (
            <button type="button" className="krew-button-primary krew-button-inline krew-db-small-btn" onClick={openForm}>
              {myConfirmedAt ? 'Update my amount' : 'Confirm payment'} <ArrowRight size={15} strokeWidth={2} />
            </button>
          )}
          <button type="button" className="krew-dash-text-btn danger krew-jc-dispute" onClick={openDisputeForm}>
            Raise a dispute
          </button>
        </div>
      )}

      {momentJob && <PaymentConfirmedMoment job={momentJob} viewerRole={viewerRole} onClose={closeMoment} />}
    </article>
  );
}
