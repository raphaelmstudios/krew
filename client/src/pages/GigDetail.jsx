import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CalendarDays, MapPin, Wallet, BadgeCheck, Clock, Timer } from 'lucide-react';
import PublicNav from '../components/PublicNav.jsx';
import PublicFooter from '../components/PublicFooter.jsx';
import InfoTooltip from '../components/InfoTooltip.jsx';
import ListingPhoto from '../components/ListingPhoto.jsx';
import usePageMeta from '../usePageMeta.js';
import { PAGE_META, NOT_FOUND_META, gigMeta } from '../pageMeta.js';

// The Gig Detail page, laid out like the moodboard's Gig Detail panel: back link, the title with
// its category and location tags, the listing photo, an apply panel on the right (pay, due date,
// location, the Apply button), and tabs under the photo - Overview (the organizer's description)
// and About Organizer (their real payment record). There's no separate "requirements" field on a
// listing, so there's no Requirements tab rather than an empty one. "More open gigs" at the bottom
// keeps people browsing without going back to Find Work.

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'organizer', label: 'About Organizer' },
];

function formatDate(value) {
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatPosted(value) {
  // created_at is a SQLite UTC timestamp without a timezone marker.
  return formatDate(`${value.replace(' ', 'T')}Z`);
}

export default function GigDetail() {
  const { id } = useParams();

  const [listing, setListing] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(null);
  const [moreGigs, setMoreGigs] = useState([]);
  const [tab, setTab] = useState('overview');

  const [session, setSession] = useState(undefined); // undefined = still checking, null = logged out

  const [applyState, setApplyState] = useState('idle'); // idle | applying | applied | already_applied | error
  const [applyError, setApplyError] = useState(null);

  usePageMeta(listing ? gigMeta(listing) : notFound ? NOT_FOUND_META : PAGE_META['/find-work']);

  useEffect(() => {
    let cancelled = false;
    setListing(null);
    setNotFound(false);
    setError(null);
    setTab('overview');
    setApplyState('idle');
    window.scrollTo(0, 0);
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

  // A few other open gigs for the bottom row - same category first.
  useEffect(() => {
    if (!listing) return undefined;
    let cancelled = false;
    fetch('/api/job-listings/public')
      .then((response) => (response.ok ? response.json() : []))
      .then((data) => {
        if (cancelled) return;
        const others = data.filter((gig) => gig.id !== listing.id);
        others.sort((a, b) => (a.category === listing.category ? 0 : 1) - (b.category === listing.category ? 0 : 1));
        setMoreGigs(others.slice(0, 3));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [listing]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/session')
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled) setSession(data?.user ?? null);
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
    } catch {
      setApplyError('Could not reach the server.');
      setApplyState('error');
    }
  }

  // The apply area changes with who's looking: a visitor, a non-crew account, an unapproved
  // crew member, someone who's already applied, or an approved crew member who can apply now.
  function renderApplyAction() {
    // Session is still being checked, so don't render anything yet.
    // This avoids a flash of the "Sign up to apply" panel for logged-in users.
    if (session === undefined) return null;

    if (session === null) {
      return (
        <>
          <Link to="/register" className="krew-button-primary krew-button-inline krew-gd-apply-btn">
            Sign up to apply <ArrowRight size={16} strokeWidth={2} />
          </Link>
          <p className="krew-gd-apply-note">
            Already have an account? <Link to="/login">Log in</Link>.
          </p>
        </>
      );
    }

    if (session.role !== 'crew_member') {
      return <p className="krew-gd-apply-note">Only crew accounts can apply to open gigs.</p>;
    }

    if (session.verification_status !== 'approved') {
      return (
        <p className="krew-gd-apply-note">Your account is still pending approval. You'll be able to apply once it's approved.</p>
      );
    }

    if (applyState === 'applied' || applyState === 'already_applied') {
      return (
        <p className="krew-gd-applied">
          <BadgeCheck size={18} strokeWidth={1.5} aria-hidden="true" />
          {applyState === 'applied' ? "You're in. The organizer will reach out if you're a match." : "You've already applied to this gig."}
        </p>
      );
    }

    return (
      <>
        {applyState === 'error' && <div className="krew-form-banner error">{applyError}</div>}
        <button
          type="button"
          className="krew-button-primary krew-button-inline krew-gd-apply-btn"
          onClick={handleApply}
          disabled={applyState === 'applying'}
        >
          {applyState === 'applying' ? 'Applying…' : 'Apply Now'} {applyState !== 'applying' && <ArrowRight size={16} strokeWidth={2} />}
        </button>
      </>
    );
  }

  if (!listing) {
    return (
      <div className="krew-public-page">
        <PublicNav />
        <div className="krew-gd-wrap">
          <Link to="/find-work" className="krew-gd-back"><ArrowLeft size={15} strokeWidth={2} /> Back to Find Work</Link>
          {error && <div className="krew-form-banner error">{error}</div>}
          {notFound && (
            <div className="krew-dash-empty">
              <p>This gig isn't open anymore, or never existed.</p>
              <Link to="/find-work" className="krew-button-secondary krew-button-inline">Browse open gigs</Link>
            </div>
          )}
          {!notFound && !error && <div className="krew-dash-loading-note" role="status">Loading gig…</div>}
        </div>
        <PublicFooter />
      </div>
    );
  }

  const record = listing.organizer_record;
  const hasRecord = record && record.confirmed_job_count > 0;

  return (
    <div className="krew-public-page">
      <PublicNav />

      <div className="krew-gd-wrap">
        <Link to="/find-work" className="krew-gd-back"><ArrowLeft size={15} strokeWidth={2} /> Back to Find Work</Link>

        <header className="krew-gd-head">
          <h1>{listing.title}</h1>
          <div className="krew-gd-tags">
            {listing.category && <span className="krew-fw-tag">{listing.category}</span>}
            {listing.location && <span className="krew-fw-tag">{listing.location}</span>}
          </div>
        </header>

        <div className="krew-gd-layout">
          <div className="krew-gd-main">
            <ListingPhoto listing={listing} className="krew-gd-photo" />

            <div className="krew-gd-tabs" role="tablist" aria-label="Gig details">
              {TABS.map((item) => (
                <button
                  type="button"
                  role="tab"
                  key={item.value}
                  aria-selected={tab === item.value}
                  className={`krew-gd-tab ${tab === item.value ? 'active' : ''}`}
                  onClick={() => setTab(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {tab === 'overview' && (
              <div className="krew-gd-panel" role="tabpanel">
                <p className={`krew-gd-description ${listing.job_description ? '' : 'empty'}`}>
                  {listing.job_description || "The organizer hasn't added more details about this gig yet."}
                </p>
                <p className="krew-gd-posted">Posted {formatPosted(listing.created_at)}</p>
              </div>
            )}

            {tab === 'organizer' && (
              <div className="krew-gd-panel" role="tabpanel">
                <h2 className="krew-gd-org-name">{listing.organizer_name}</h2>
                {hasRecord ? (
                  <ul className="krew-gd-org-stats">
                    <li>
                      <BadgeCheck size={26} strokeWidth={1.25} aria-hidden="true" />
                      <span className="krew-gd-org-stat-value">{record.confirmed_job_count}</span>
                      <span className="krew-gd-org-stat-label">
                        {record.confirmed_job_count === 1 ? 'job' : 'jobs'} paid and confirmed
                      </span>
                    </li>
                    <li>
                      <Clock size={26} strokeWidth={1.25} aria-hidden="true" />
                      <span className="krew-gd-org-stat-value">{record.on_time_percentage}%</span>
                      <span className="krew-gd-org-stat-label">paid on or before the due date</span>
                    </li>
                    {record.median_days_to_payment !== null && record.median_days_to_payment !== undefined && (
                      <li>
                        <Timer size={26} strokeWidth={1.25} aria-hidden="true" />
                        <span className="krew-gd-org-stat-value">
                          {record.median_days_to_payment <= 0
                            ? 'On time'
                            : `${record.median_days_to_payment} ${record.median_days_to_payment === 1 ? 'day' : 'days'}`}
                        </span>
                        <span className="krew-gd-org-stat-label">
                          {record.median_days_to_payment <= 0 ? 'typical payment timing' : 'typically paid after the due date'}
                        </span>
                      </li>
                    )}
                  </ul>
                ) : (
                  <p className="krew-gd-description">
                    <span className="krew-status-pill new">New here</span> {listing.organizer_name} hasn't had a job confirmed on
                    KREW yet - everyone starts without a track record, it isn't a red flag.
                  </p>
                )}
                <p className="krew-gd-posted">
                  Worked out automatically from payments both sides confirmed on KREW - not a self-reported rating.
                </p>
              </div>
            )}
          </div>

          <aside className="krew-gd-side">
            <div className="krew-gd-apply">
              <p className="krew-gd-amount-label">Pay</p>
              <p className="krew-gd-amount">KES {Number(listing.amount).toLocaleString()}</p>
              <ul className="krew-gd-facts">
                <li><CalendarDays size={20} strokeWidth={1.4} aria-hidden="true" /> Due {formatDate(listing.due_date)}</li>
                <li><MapPin size={20} strokeWidth={1.4} aria-hidden="true" /> {listing.location}</li>
                <li><Wallet size={20} strokeWidth={1.4} aria-hidden="true" /> Payment tracked until both sides confirm</li>
              </ul>
              {renderApplyAction()}
            </div>

            <div className="krew-gd-org-mini">
              <span className="krew-gd-org-mini-label">Posted by</span>
              <strong>{listing.organizer_name}</strong>
              <span className="krew-gd-org-mini-record">
                {hasRecord ? (
                  <>
                    {record.confirmed_job_count} completed {record.confirmed_job_count === 1 ? 'job' : 'jobs'} ·{' '}
                    {record.on_time_percentage}% on time
                    <InfoTooltip text="How many of this organizer's jobs were confirmed paid, and what percentage were paid by the due date - calculated automatically from payment confirmations, not a self-reported rating." />
                  </>
                ) : (
                  <>
                    <span className="krew-status-pill new">New here</span>
                    <InfoTooltip text="New here means this organizer hasn't had a job confirmed on KREW yet - everyone starts without a track record, it isn't a red flag." />
                  </>
                )}
              </span>
            </div>
          </aside>
        </div>

        {moreGigs.length > 0 && (
          <section className="krew-gd-more">
            <div className="krew-cp-block-head">
              <h2 className="krew-cp-section-title">More open gigs</h2>
              <Link to="/find-work" className="krew-text-link">
                Browse all gigs <ArrowRight size={15} strokeWidth={2} />
              </Link>
            </div>
            <div className="krew-gd-more-grid">
              {moreGigs.map((gig) => (
                <Link to={`/gigs/${gig.id}`} className="krew-gd-more-card" key={gig.id}>
                  <ListingPhoto listing={gig} className="krew-gd-more-photo" />
                  <div className="krew-gd-more-body">
                    <h3>{gig.title}</h3>
                    <p>{gig.location} · Due {formatDate(gig.due_date)}</p>
                    <strong>KES {Number(gig.amount).toLocaleString()}</strong>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      <PublicFooter />
    </div>
  );
}
