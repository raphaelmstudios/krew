import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapPin, Calendar, Tag } from 'lucide-react';
import PublicNav from '../components/PublicNav.jsx';
import PublicFooter from '../components/PublicFooter.jsx';
import InfoTooltip from '../components/InfoTooltip.jsx';

// Formats the organizer's record for display in the listing. Same badge logic as CrewDashboard.jsx's formatOrganizerRecord.
// Duplicated rather than imported since this is a public page with its own fetch (GET /job-listings/public, no session needed) and the two pages don't otherwise share state or a parent component worth threading a prop through. Comes with a small info icon explaining what it means.
function formatOrganizerRecord(record) {
  if (!record || record.confirmed_job_count === 0) {
    return (
      <>
        <span className="krew-status-pill new">New here</span>
        <InfoTooltip text="New here means this organizer hasn't had a job confirmed on KREW yet - everyone starts without a track record, it isn't a red flag." />
      </>
    );
  }
  const jobWord = record.confirmed_job_count === 1 ? 'job' : 'jobs';
  return (
    <>
      {record.confirmed_job_count} completed {jobWord} · {record.on_time_percentage}% on time
      <InfoTooltip text="How many of this organizer's jobs were confirmed paid, and what percentage were paid by the due date - calculated automatically from payment confirmations, not a self-reported rating." />
    </>
  );
}

// The Gig Detail page is a public-facing page that shows the details of a single job listing.
export default function GigDetail() {
  const { id } = useParams();

  const [listing, setListing] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(null);

  const [session, setSession] = useState(undefined); // undefined = still checking, null = logged out

  const [applyState, setApplyState] = useState('idle'); // idle | applying | applied | already_applied | error
  const [applyError, setApplyError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/job-listings/public/${id}`)
      .then((response) => response.json().then((data) => ({ ok: response.ok, status: response.status, data })))
      .then(({ ok, status, data }) => {
        if (cancelled) return;
        if (!ok) {
          if (status === 404) {
            setNotFound(true);
          } else {
            setError(data.error || 'Could not load this gig.');
          }
          return;
        }
        setListing(data);
      })
      .catch(() => {
        if (!cancelled) setError('Could not reach the server.');
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me')
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled) setSession(data);
      })
      .catch(() => {
        if (!cancelled) setSession(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // This effect checks if the logged-in crew member has already applied to this gig.
  // If they have, it sets the applyState to 'already_applied'.
  useEffect(() => {
    if (!session || session.role !== 'crew_member' || session.verification_status !== 'approved') return;
    let cancelled = false;
    fetch('/api/job-listings/mine-applications')
      .then((response) => (response.ok ? response.json() : []))
      .then((applications) => {
        if (cancelled) return;
        if (applications.some((application) => String(application.listing_id) === String(id))) {
          setApplyState('already_applied');
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [session, id]);

  async function handleApply() {
    setApplyState('applying');
    setApplyError(null);
    try {
      const response = await fetch(`/api/job-listings/${id}/apply`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 409 && data.error?.includes('already applied')) {
          setApplyState('already_applied');
          return;
        }
        setApplyError(data.error || 'Could not apply. Please try again.');
        setApplyState('error');
        return;
      }
      setApplyState('applied');
    } catch (err) {
      setApplyError('Could not reach the server.');
      setApplyState('error');
    }
  }

  function renderApplyPanel() {
    // Session is still being checked, so don't render anything yet.
    // This avoids a flash of the "Sign up to apply" panel for logged-in users.
    if (session === undefined) return null;

    if (session === null) {
      return (
        <div className="krew-gig-apply-panel">
          <p className="krew-gig-apply-note">Create a free account to apply for this gig.</p>
          <Link to="/register" className="krew-button-primary krew-gig-apply-cta">Sign up to apply</Link>
          <p className="krew-fine-print" style={{ marginTop: 10 }}>
            Already have an account? <Link to="/login">Log in</Link>.
          </p>
        </div>
      );
    }

    if (session.role !== 'crew_member') {
      return (
        <div className="krew-gig-apply-panel">
          <p className="krew-gig-apply-note">Only crew accounts can apply to open gigs.</p>
        </div>
      );
    }

    if (session.verification_status !== 'approved') {
      return (
        <div className="krew-gig-apply-panel">
          <p className="krew-gig-apply-note">
            Your account is still pending approval. You'll be able to apply once it's approved.
          </p>
        </div>
      );
    }

    if (applyState === 'applied' || applyState === 'already_applied') {
      return (
        <div className="krew-gig-apply-panel">
          <p className="krew-gig-apply-note">
            {applyState === 'applied'
              ? "You're in. The organizer will reach out if you're a match."
              : "You've already applied to this gig."}
          </p>
        </div>
      );
    }

    return (
      <div className="krew-gig-apply-panel">
        {applyState === 'error' && <div className="krew-form-banner error">{applyError}</div>}
        <button
          type="button"
          className="krew-button-primary krew-gig-apply-cta"
          onClick={handleApply}
          disabled={applyState === 'applying'}
        >
          {applyState === 'applying' ? 'Applying…' : 'Apply for this gig'}
        </button>
      </div>
    );
  }

  return (
    <div className="krew-public-page">
      <PublicNav />

      <div className="krew-gig-wrap">
        <Link to="/find-work" className="krew-gig-back-link">&larr; Back to Find Work</Link>

        {error && <div className="krew-form-banner error">{error}</div>}

        {notFound && (
          <div className="krew-dash-empty">
            <p>This gig isn't open anymore, or never existed.</p>
            <Link to="/find-work" className="krew-button-secondary" style={{ width: 'auto', display: 'inline-block' }}>
              Browse open gigs
            </Link>
          </div>
        )}

        {listing === null && !notFound && !error && (
          <div className="krew-dash-loading-note">Loading gig…</div>
        )}

        {listing && (
          <div className="krew-gig-layout">
            <div className="krew-gig-main">
              <p className="krew-home-section-label">{listing.category}</p>
              <h1 className="krew-gig-title">{listing.title}</h1>
              <p className="krew-gig-organizer">
                Posted by <strong>{listing.organizer_name}</strong> · {formatOrganizerRecord(listing.organizer_record)}
              </p>

              <div className="krew-gig-meta-row">
                <span><MapPin size={15} strokeWidth={1.75} /> {listing.location}</span>
                <span><Calendar size={15} strokeWidth={1.75} /> Due {new Date(listing.due_date).toLocaleDateString()}</span>
                <span><Tag size={15} strokeWidth={1.75} /> {listing.category}</span>
              </div>

              {listing.job_description && (
                <div className="krew-gig-body">
                  <h2>About this gig</h2>
                  <p>{listing.job_description}</p>
                </div>
              )}
            </div>

            <aside className="krew-gig-side">
              <div className="krew-gig-amount-card">
                <p className="krew-gig-amount-label">Payment</p>
                <p className="krew-gig-amount">KES {Number(listing.amount).toLocaleString()}</p>
                <p className="krew-gig-amount-sub">Due {new Date(listing.due_date).toLocaleDateString()}</p>
              </div>
              {renderApplyPanel()}
            </aside>
          </div>
        )}
      </div>

      <PublicFooter />
    </div>
  );
}