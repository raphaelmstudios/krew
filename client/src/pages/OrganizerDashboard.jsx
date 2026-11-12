import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  LayoutDashboard,
  CirclePlus,
  Briefcase,
  Users,
  Wallet,
  ArrowRight,
  BadgeCheck,
  Clock,
  Timer,
} from 'lucide-react';
import PostListingForm from './PostListingForm.jsx';
import ListingApplicants from './ListingApplicants.jsx';
import HireForm from './HireForm.jsx';
import JobCard from './JobCard.jsx';
import DashboardShell from '../components/DashboardShell.jsx';
import { notificationIcon } from '../components/NotificationBell.jsx';
import PilotSurveyBanner from '../components/PilotSurveyBanner.jsx';
import InfoTooltip from '../components/InfoTooltip.jsx';
import ListingPhoto from '../components/ListingPhoto.jsx';
import { initials } from '../components/CrewCard.jsx';

// The organizer dashboard, in the moodboard's sidebar layout (DashboardShell.jsx). Five sections:
// - Overview: a greeting, active gigs, recent activity (their notifications) and their own payment record - what crew see.
// - Post a Gig: the post-a-job form.
// - My Gigs: their listings - view and accept applicants, add a photo, cancel.
// - Find Crew: every approved crew member, with View profile and Hire (a direct hire, no listing needed).
// - Payments: every job they're part of, where they confirm what they paid.
// The section lives in the URL (?section=...) so a refresh or a shared link lands in the same place.

const SECTIONS = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'post', label: 'Post a Gig', icon: CirclePlus },
  { key: 'gigs', label: 'My Gigs', icon: Briefcase },
  { key: 'crew', label: 'Find Crew', icon: Users },
  { key: 'payments', label: 'Payments', icon: Wallet },
];

// Turns a crew member's completed jobs count into something to show on a crew directory
// card, so an organizer has something to go on before hiring. Shared with
// ListingApplicants.jsx, which shows the same badge for each applicant before the
// organizer accepts one. A crew member with no confirmed jobs yet gets a plain "New here"
// badge instead of a misleading zero - new crew members still show up in these lists
// exactly like everyone else, just without a track record yet to report.
export function formatCrewRecord(crewMember) {
  if (!crewMember.confirmed_job_count) {
    return (
      <>
        <span className="krew-status-pill new">New here</span>
        <InfoTooltip text="New here means this crew member hasn't completed a job on KREW yet - everyone starts without a track record, it isn't a red flag." />
      </>
    );
  }
  const jobWord = crewMember.confirmed_job_count === 1 ? 'job' : 'jobs';
  return (
    <>
      {crewMember.confirmed_job_count} completed {jobWord}
      <InfoTooltip text="The number of jobs this crew member has completed and had payment confirmed on KREW." />
    </>
  );
}

function formatDate(value) {
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Notification timestamps are SQLite UTC values without a timezone marker.
function timeAgo(value) {
  const minutes = Math.floor((Date.now() - new Date(`${value.replace(' ', 'T')}Z`).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function OrganizerDashboard({ user, onLogout }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('section');
  const section = SECTIONS.some((item) => item.key === requested) ? requested : 'overview';

  const [listings, setListings] = useState(null); // null = still loading
  const [selectedListing, setSelectedListing] = useState(null); // set = showing that listing's applicants
  const [jobs, setJobs] = useState(null);
  const [crewDirectory, setCrewDirectory] = useState(null);
  const [selectedCrewMember, setSelectedCrewMember] = useState(null); // set = showing the hire form
  const [activity, setActivity] = useState(null);
  const [record, setRecord] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [photoUploadingId, setPhotoUploadingId] = useState(null);

  const approved = user.verification_status === 'approved';

  useEffect(() => {
    if (approved) {
      loadListings();
      loadJobs();
      loadActivity();
      loadRecord();
      loadCrewDirectory();
    }
  }, []);

  function goTo(nextSection) {
    setError(null);
    setNotice(null);
    setSelectedListing(null);
    setSelectedCrewMember(null);
    setSearchParams(nextSection === 'overview' ? {} : { section: nextSection });
    window.scrollTo(0, 0);
    // Reloaded every time - applicants, payment confirmations and crew availability can all
    // change while another section is open.
    if (nextSection === 'overview') {
      loadListings();
      loadJobs();
      loadActivity();
      loadRecord();
    }
    if (nextSection === 'gigs') loadListings();
    if (nextSection === 'payments') loadJobs();
    if (nextSection === 'crew') loadCrewDirectory();
  }

  async function loadListings() {
    try {
      const response = await fetch('/api/job-listings/mine');
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Could not load your gigs.');
        return;
      }
      setListings(data);
    } catch (err) {
      setError('Could not reach the server.');
    }
  }

  async function loadJobs() {
    try {
      const response = await fetch('/api/jobs/mine');
      const data = await response.json();
      if (response.ok) setJobs(data);
    } catch (err) {
      // The rest of the dashboard still works without this.
    }
  }

  async function loadActivity() {
    try {
      const response = await fetch('/api/notifications/mine');
      const data = await response.json();
      if (response.ok) setActivity(data);
    } catch (err) {
      setActivity([]);
    }
  }

  async function loadRecord() {
    try {
      const response = await fetch(`/api/users/${user.id}/organizer-record`);
      const data = await response.json();
      if (response.ok) setRecord(data);
    } catch (err) {
      // Leave the record card on its loading state.
    }
  }

  async function loadCrewDirectory() {
    try {
      const response = await fetch('/api/users/crew-directory');
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Could not load the crew directory.');
        return;
      }
      setCrewDirectory(data);
    } catch (err) {
      setError('Could not reach the server.');
    }
  }

  function handleListingCreated(result) {
    goTo('gigs');
    if (result?.photoFailed) {
      setError("Your gig was posted, but the photo didn't upload. You can add it from the gig's card below.");
    } else {
      setNotice('Your gig is live on Find Work.');
    }
  }

  // Add or replace the photo on one of the organizer's own open listings (straight from its card).
  async function handleListingPhotoChange(listingId, e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setPhotoUploadingId(listingId);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('listing_photo', file);
      const response = await fetch(`/api/job-listings/${listingId}/photo`, { method: 'POST', body: formData });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Could not upload that photo.');
        return;
      }
      setListings((current) =>
        current.map((listing) => (listing.id === listingId ? { ...listing, photo_path: data.photo_path } : listing))
      );
    } catch (err) {
      setError('Could not reach the server.');
    } finally {
      setPhotoUploadingId(null);
    }
  }

  async function handleCancel(listingId) {
    try {
      await fetch(`/api/job-listings/${listingId}/cancel`, { method: 'POST' });
      loadListings();
    } catch (err) {
      setError('Could not reach the server.');
    }
  }

  function handleApplicantsAccepted() {
    setSelectedListing(null);
    setNotice('Applicant accepted - the job is now in Payments.');
    loadListings();
    loadJobs();
  }

  function handleHired() {
    setSelectedCrewMember(null);
    goTo('payments');
    setNotice('Hire confirmed - the job is now in Payments.');
  }

  // --- derived data ---
  const openListings = listings ? listings.filter((listing) => listing.status === 'open') : [];
  const waitingApplicants = openListings.reduce((sum, listing) => sum + listing.pending_applicant_count, 0);
  const jobsToConfirm = jobs ? jobs.filter((job) => job.status === 'pending' && !job.organizer_confirmed_at).length : 0;
  const featuredListing = [...openListings].sort((a, b) => b.pending_applicant_count - a.pending_applicant_count)[0];
  const firstName = user.name.split(' ')[0];

  const navItems = SECTIONS.map((item) => ({
    ...item,
    badge: item.key === 'gigs' && waitingApplicants ? waitingApplicants : item.key === 'payments' && jobsToConfirm ? jobsToConfirm : null,
  }));

  if (!approved) {
    return (
      <DashboardShell user={user} navItems={[SECTIONS[0]]} active="overview" onNavigate={() => {}} onLogout={onLogout}>
        <div className="krew-db-head">
          <h1>Welcome, {firstName}</h1>
          <p>Your account is still waiting on admin approval. Once you're approved, you'll be able to post gigs and hire crew here.</p>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell user={user} navItems={navItems} active={section} onNavigate={goTo} onLogout={onLogout}>
      {error && <div className="krew-form-banner error">{error}</div>}
      {notice && <div className="krew-form-banner success">{notice}</div>}

      {section === 'overview' && (
        <>
          <div className="krew-db-head">
            <h1>Welcome back, {firstName}</h1>
            <p>Let's make your next event exceptional.</p>
          </div>

          <PilotSurveyBanner />

          <div className="krew-db-overview">
            <section className="krew-db-upcoming">
              <div className="krew-db-upcoming-copy">
                <span className="krew-db-eyebrow">Active gigs</span>
                <h2 className="krew-db-big-number">{listings === null ? '–' : openListings.length}</h2>
                <p className="krew-db-upcoming-meta">
                  {listings === null
                    ? 'Loading…'
                    : openListings.length === 0
                    ? 'Nothing open right now - post a gig and crew can start applying.'
                    : `${waitingApplicants} ${waitingApplicants === 1 ? 'applicant' : 'applicants'} waiting for your decision.`}
                </p>
                <button
                  type="button"
                  className="krew-db-upcoming-link"
                  onClick={() => goTo(openListings.length === 0 ? 'post' : 'gigs')}
                >
                  {openListings.length === 0 ? 'Post a gig' : 'View all'} <ArrowRight size={15} strokeWidth={2} />
                </button>
              </div>
              {featuredListing ? (
                <ListingPhoto listing={featuredListing} className="krew-db-upcoming-photo" />
              ) : (
                <ListingPhoto listing={{ category: 'Other' }} className="krew-db-upcoming-photo" />
              )}
              <span className="krew-shard krew-db-upcoming-shard" aria-hidden="true" />
            </section>

            <section className="krew-db-card">
              <div className="krew-db-card-head">
                <h2>Recent activity</h2>
              </div>
              {activity === null && <div className="krew-dash-loading-note">Loading…</div>}
              {activity && activity.length === 0 && (
                <p className="krew-db-empty">Nothing yet - applications, hires and payment updates will show up here.</p>
              )}
              {activity && activity.length > 0 && (
                <ul className="krew-db-activity">
                  {activity.slice(0, 5).map((item) => {
                    const Icon = notificationIcon(item.type);
                    return (
                      <li key={item.id} className={item.read_at ? '' : 'unread'}>
                        <Icon size={20} strokeWidth={1.4} aria-hidden="true" />
                        <span className="krew-db-activity-text">
                          {item.message}
                          <small>{timeAgo(item.created_at)}</small>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="krew-db-card">
              <div className="krew-db-card-head">
                <h2>
                  Your payment record
                  <InfoTooltip text="This is what crew see on every gig you post - worked out automatically from payments both sides confirmed, not a self-reported rating." />
                </h2>
              </div>
              {record === null && <div className="krew-dash-loading-note">Loading…</div>}
              {record && record.confirmed_job_count === 0 && (
                <p className="krew-db-empty">
                  <span className="krew-status-pill new">New here</span> Once you've paid crew and both sides confirm, your on-time
                  record builds up here - and crew see it before they apply.
                </p>
              )}
              {record && record.confirmed_job_count > 0 && (
                <ul className="krew-db-stats">
                  <li>
                    <BadgeCheck size={24} strokeWidth={1.3} aria-hidden="true" />
                    <strong>{record.confirmed_job_count}</strong>
                    <span>{record.confirmed_job_count === 1 ? 'job' : 'jobs'} paid and confirmed</span>
                  </li>
                  <li>
                    <Clock size={24} strokeWidth={1.3} aria-hidden="true" />
                    <strong>{record.on_time_percentage}%</strong>
                    <span>paid on or before the due date</span>
                  </li>
                  {record.median_days_to_payment !== null && record.median_days_to_payment !== undefined && (
                    <li>
                      <Timer size={24} strokeWidth={1.3} aria-hidden="true" />
                      <strong>
                        {record.median_days_to_payment <= 0
                          ? 'On time'
                          : `${record.median_days_to_payment} ${record.median_days_to_payment === 1 ? 'day' : 'days'}`}
                      </strong>
                      <span>{record.median_days_to_payment <= 0 ? 'typical payment timing' : 'typically late'}</span>
                    </li>
                  )}
                </ul>
              )}
              {jobsToConfirm > 0 && (
                <button type="button" className="krew-text-link krew-db-link-btn" onClick={() => goTo('payments')}>
                  {jobsToConfirm} {jobsToConfirm === 1 ? 'payment' : 'payments'} to confirm <ArrowRight size={15} strokeWidth={2} />
                </button>
              )}
            </section>
          </div>

          <section className="krew-db-banner">
            <span className="krew-shard krew-db-banner-shard-1" aria-hidden="true" />
            <span className="krew-shard krew-db-banner-shard-2" aria-hidden="true" />
            <div>
              <h2>Find the perfect crew.</h2>
              <p>Browse verified crew with real, payment-confirmed work records - and hire directly.</p>
            </div>
            <button type="button" className="krew-db-banner-link krew-db-link-btn" onClick={() => goTo('crew')}>
              Browse crew <ArrowRight size={15} strokeWidth={2} />
            </button>
          </section>
        </>
      )}

      {section === 'post' && (
        <>
          <div className="krew-db-head">
            <h1>Post a gig</h1>
            <p>It goes live on Find Work straight away. Crew see the pay, the date and your payment record before they apply.</p>
          </div>
          <PostListingForm onCancel={() => goTo('gigs')} onCreated={handleListingCreated} />
        </>
      )}

      {section === 'gigs' && selectedListing && (
        <ListingApplicants listing={selectedListing} onBack={() => setSelectedListing(null)} onAccepted={handleApplicantsAccepted} />
      )}

      {section === 'gigs' && !selectedListing && (
        <>
          <div className="krew-db-head krew-db-head-row">
            <div>
              <h1>My gigs</h1>
              <p>
                Everything you've posted.
                {waitingApplicants > 0 ? ` ${waitingApplicants} ${waitingApplicants === 1 ? 'applicant is' : 'applicants are'} waiting.` : ''}
              </p>
            </div>
            <button type="button" className="krew-button-primary krew-button-inline krew-db-small-btn" onClick={() => goTo('post')}>
              Post a gig <ArrowRight size={15} strokeWidth={2} />
            </button>
          </div>

          {listings === null && !error && <div className="krew-dash-loading-note">Loading…</div>}

          {listings && listings.length === 0 && (
            <div className="krew-dash-empty">
              <p>You haven't posted any gigs yet.</p>
              <button type="button" className="krew-button-primary krew-button-inline" onClick={() => goTo('post')}>
                Post your first gig <ArrowRight size={16} strokeWidth={2} />
              </button>
            </div>
          )}

          {listings && listings.length > 0 && (
            <ul className="krew-db-gigs">
              {listings.map((listing) => (
                <li className="krew-db-gig" key={listing.id}>
                  <ListingPhoto listing={listing} className="krew-db-gig-photo" />
                  <div className="krew-db-gig-main">
                    {listing.status === 'open' ? (
                      <Link to={`/gigs/${listing.id}`} className="krew-db-gig-title">{listing.title || 'Untitled listing'}</Link>
                    ) : (
                      <span className="krew-db-gig-title">{listing.title || 'Untitled listing'}</span>
                    )}
                    <span className="krew-db-gig-meta">
                      <span>{listing.location}</span>
                      <span>Due {formatDate(listing.due_date)}</span>
                    </span>
                    <span className="krew-db-gig-org">
                      {listing.status === 'open'
                        ? `${listing.pending_applicant_count} ${listing.pending_applicant_count === 1 ? 'applicant' : 'applicants'} waiting`
                        : listing.status === 'filled'
                        ? 'Filled - see Payments'
                        : 'Cancelled'}
                    </span>
                    {listing.status === 'open' && (
                      <span className="krew-db-gig-actions">
                        <button type="button" className="krew-dash-text-btn" onClick={() => setSelectedListing(listing)}>
                          View applicants
                        </button>
                        <label className="krew-dash-text-btn krew-dash-photo-btn">
                          {photoUploadingId === listing.id ? 'Uploading…' : listing.photo_path ? 'Change photo' : 'Add photo'}
                          <input
                            type="file"
                            accept="image/jpeg,image/png"
                            onChange={(e) => handleListingPhotoChange(listing.id, e)}
                            disabled={photoUploadingId !== null}
                          />
                        </label>
                        <button type="button" className="krew-dash-text-btn danger" onClick={() => handleCancel(listing.id)}>
                          Cancel gig
                        </button>
                      </span>
                    )}
                  </div>
                  <div className="krew-db-gig-side">
                    <span className="krew-db-gig-amount">KES {Number(listing.amount).toLocaleString()}</span>
                    <span className={`krew-status-pill ${listing.status}`}>{listing.status}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {section === 'crew' && selectedCrewMember && (
        <HireForm crewMember={selectedCrewMember} onCancel={() => setSelectedCrewMember(null)} onCreated={handleHired} />
      )}

      {section === 'crew' && !selectedCrewMember && (
        <>
          <div className="krew-db-head">
            <h1>Find crew</h1>
            <p>Every verified crew member. Hire someone directly - no listing needed - or open their profile first.</p>
          </div>

          {crewDirectory === null && !error && <div className="krew-dash-loading-note">Loading…</div>}

          {crewDirectory && crewDirectory.length === 0 && (
            <div className="krew-dash-empty">
              <p>No approved crew members yet.</p>
            </div>
          )}

          {crewDirectory && crewDirectory.length > 0 && (
            <ul className="krew-db-crew">
              {crewDirectory.map((crewMember) => (
                <li className="krew-db-crew-row" key={crewMember.id}>
                  <span className="krew-db-crew-avatar">
                    {crewMember.profile_photo_path ? (
                      <img src={`/uploads/${crewMember.profile_photo_path}`} alt="" />
                    ) : (
                      <span aria-hidden="true">{initials(crewMember.name)}</span>
                    )}
                  </span>
                  <div className="krew-db-crew-main">
                    <strong>{crewMember.name}</strong>
                    <span>
                      {crewMember.professional_role || 'Event crew'}
                      {crewMember.years_experience ? ` · ${crewMember.years_experience}+ yrs` : ''}
                    </span>
                    <span className="krew-db-crew-record">
                      <span className={`krew-db-dot ${crewMember.availability_status === 'available' ? 'available' : 'working'}`}>
                        {crewMember.availability_status === 'available' ? 'Available' : 'Currently working'}
                      </span>
                      · {formatCrewRecord(crewMember)}
                    </span>
                  </div>
                  <div className="krew-db-crew-actions">
                    <Link to={`/crew/${crewMember.id}`} className="krew-dash-text-btn">View profile</Link>
                    <button
                      type="button"
                      className="krew-button-primary krew-button-inline krew-db-small-btn"
                      onClick={() => setSelectedCrewMember(crewMember)}
                    >
                      Hire
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {section === 'payments' && (
        <>
          <div className="krew-db-head">
            <h1>Payments</h1>
            <p>
              Every job you've hired for. Once you've paid, confirm the amount here - when the crew member confirms the same
              amount, it counts toward your on-time record.
            </p>
          </div>

          {jobs === null && <div className="krew-dash-loading-note">Loading…</div>}

          {jobs && jobs.length === 0 && (
            <div className="krew-dash-empty">
              <p>No jobs yet - accept an applicant or hire someone from Find Crew and it'll show up here.</p>
            </div>
          )}

          {jobs && jobs.length > 0 && (
            <div className="krew-job-list">
              {jobs.map((job) => (
                <JobCard key={job.id} job={job} viewerRole="organizer" onConfirmed={loadJobs} />
              ))}
            </div>
          )}
        </>
      )}
    </DashboardShell>
  );
}
