import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleCheckBig, Check, ShieldCheck, X } from 'lucide-react';

// The payment confirmation moment (redesign moodboard panel 8): the screen either side sees
// when a job flips to 'confirmed' - both sides entered the same amount (or an admin settled
// a dispute with a final amount). It opens straight after your own confirmation completes a
// job, and also the first time you open your jobs after the other side completed it, so the
// person who confirmed first doesn't miss it either.
//
// "Seen" is remembered per browser in localStorage. That's a convenience only - nothing on
// the server depends on it, and if storage is blocked the worst case is seeing it again.

const SEEN_KEY = 'krew-confirmed-seen';
const RECENT_DAYS = 14; // older confirmations never pop up on their own

function readSeen() {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) || '[]');
  } catch {
    return [];
  }
}

export function markConfirmationSeen(jobId) {
  try {
    const seen = readSeen();
    if (!seen.includes(jobId)) {
      localStorage.setItem(SEEN_KEY, JSON.stringify([...seen, jobId].slice(-200)));
    }
  } catch {
    // Storage blocked - nothing to do.
  }
}

function parseServerDate(value) {
  return value ? new Date(`${value.replace(' ', 'T')}Z`) : null;
}

// When the job became confirmed: the server's completed_at, or (for older data) whichever side confirmed last.
export function confirmedOn(job) {
  if (job.completed_at) return parseServerDate(job.completed_at);
  const dates = [parseServerDate(job.organizer_confirmed_at), parseServerDate(job.crew_confirmed_at)].filter(Boolean);
  return dates.length ? new Date(Math.max(...dates)) : null;
}

// Only one card on the page gets to open the moment on load - the first one that asks.
let autoOpenClaimed = false;

export function shouldAutoOpen(job) {
  if (autoOpenClaimed || job.status !== 'confirmed') return false;
  if (readSeen().includes(job.id)) return false;
  const when = confirmedOn(job);
  if (!when || Date.now() - when.getTime() > RECENT_DAYS * 24 * 60 * 60 * 1000) return false;
  autoOpenClaimed = true;
  return true;
}

export function releaseAutoOpen() {
  autoOpenClaimed = false;
}

function formatDay(date) {
  return date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
}

export default function PaymentConfirmedMoment({ job, viewerRole, onClose }) {
  const dialogRef = useRef(null);
  const [myId, setMyId] = useState(null);

  const isOrganizer = viewerRole === 'organizer';
  const counterpartName = isOrganizer ? job.crew_member_name : job.organizer_name;
  const amount = Number(job.organizer_confirmed_amount ?? job.crew_confirmed_amount ?? job.amount);
  const organizerName = isOrganizer ? 'You' : job.organizer_name;
  const crewName = isOrganizer ? job.crew_member_name : 'You';

  useEffect(() => {
    markConfirmationSeen(job.id);
    dialogRef.current?.focus(); // focus the dialog itself so Esc / Tab work without a ring on the close button
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

  // Crew get a link to their public profile, where this job now shows in their work history.
  useEffect(() => {
    if (isOrganizer) return;
    fetch('/api/auth/session')
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setMyId(data?.user?.id ?? null))
      .catch(() => {});
  }, []);

  return (
    <div className="krew-moment-backdrop" onClick={onClose}>
      <div
        className="krew-moment"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`krew-moment-title-${job.id}`}
        tabIndex={-1}
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="krew-moment-top">
          <span className="krew-shard krew-moment-shard-1" aria-hidden="true" />
          <span className="krew-shard krew-moment-shard-2" aria-hidden="true" />
          <span className="krew-shard krew-moment-shard-3" aria-hidden="true" />
          <button type="button" className="krew-moment-close" onClick={onClose} aria-label="Close">
            <X size={20} strokeWidth={1.75} />
          </button>
          <CircleCheckBig className="krew-moment-icon" size={64} strokeWidth={1.1} aria-hidden="true" />
          <span className="krew-moment-eyebrow" id={`krew-moment-title-${job.id}`}>
            Payment confirmed
          </span>
          <strong className="krew-moment-amount">KES {amount.toLocaleString()}</strong>
          <span className="krew-moment-job">
            {job.title || 'Direct hire'} · with {counterpartName}
          </span>
        </div>

        <div className="krew-moment-body">
          <ul className="krew-moment-sides">
            <li>
              <Check size={18} strokeWidth={2} aria-hidden="true" />
              <span>
                <strong>{organizerName}</strong> confirmed paying KES{' '}
                {Number(job.organizer_confirmed_amount).toLocaleString()}
              </span>
              <small>{formatDay(parseServerDate(job.organizer_confirmed_at))}</small>
            </li>
            <li>
              <Check size={18} strokeWidth={2} aria-hidden="true" />
              <span>
                <strong>{crewName}</strong> confirmed receiving KES {Number(job.crew_confirmed_amount).toLocaleString()}
              </span>
              <small>{formatDay(parseServerDate(job.crew_confirmed_at))}</small>
            </li>
          </ul>

          <p className="krew-moment-meaning">
            <ShieldCheck size={20} strokeWidth={1.4} aria-hidden="true" />
            <span>
              {isOrganizer
                ? 'The amounts match, so this job is complete. It now counts toward your on-time payment record - the record crew see before they apply to your gigs.'
                : `The amounts match, so this job is complete. It now shows in the verified work history on your public profile, where organizers can see it.`}
            </span>
          </p>

          <div className="krew-moment-actions">
            {isOrganizer ? (
              <Link to="/dashboard?section=post" className="krew-button-primary krew-button-inline" onClick={onClose}>
                Post another gig
              </Link>
            ) : (
              myId && (
                <Link to={`/crew/${myId}`} className="krew-button-primary krew-button-inline" onClick={onClose}>
                  View my profile
                </Link>
              )
            )}
            <button type="button" className="krew-button-secondary krew-button-inline" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
