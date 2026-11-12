import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  LayoutDashboard,
  Search,
  FileText,
  Briefcase,
  UserRound,
  ArrowRight,
  CalendarDays,
  MapPin,
  CircleCheck,
  Circle,
  X,
  Plus,
  User as UserIcon,
} from 'lucide-react';
import JobCard from './JobCard.jsx';
import DashboardShell from '../components/DashboardShell.jsx';
import PilotSurveyBanner from '../components/PilotSurveyBanner.jsx';
import InfoTooltip from '../components/InfoTooltip.jsx';
import ListingPhoto from '../components/ListingPhoto.jsx';

const MAX_PORTFOLIO_IMAGES = 12;

// The crew dashboard, in the moodboard's sidebar layout (DashboardShell.jsx). Five sections:
// - Overview: a greeting, the next upcoming gig, availability, the latest applications and how complete the profile is.
// - Find Gigs: open job listings to apply to.
// - Applications: every application and where it stands.
// - My Jobs: the jobs they're actually confirmed for (from either path), where they confirm their own side of the payment.
// - Profile: photo, role, skills, experience, bio, portfolio and availability - everything organizers see on the public profile.
// The section lives in the URL (?section=...) so a refresh or a shared link lands in the same place.

const SECTIONS = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'gigs', label: 'Find Gigs', icon: Search },
  { key: 'applications', label: 'Applications', icon: FileText },
  { key: 'jobs', label: 'My Jobs', icon: Briefcase },
  { key: 'profile', label: 'Profile', icon: UserRound },
];

const APPLICATION_STATUS = {
  pending: { label: 'Under review', className: 'pending' },
  accepted: { label: 'Accepted', className: 'accepted' },
  declined: { label: 'Not selected', className: 'declined' },
};

// Turns an organizer's payment record into something to show on an open listing's card,
// so a crew member has something to go on before applying. An organizer with no
// confirmed jobs yet gets a plain "New here" badge instead of a misleading 0% - new
// organizers still show up in this list exactly like everyone else, just without a track
// record yet to report.
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

function formatDate(value) {
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function CrewDashboard({ user, onLogout }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('section');
  const section = SECTIONS.some((item) => item.key === requested) ? requested : 'overview';

  const [listings, setListings] = useState(null);
  const [applications, setApplications] = useState(null);
  const [myJobs, setMyJobs] = useState(null);
  const [error, setError] = useState(null);
  const [applyingId, setApplyingId] = useState(null);

  const [availability, setAvailability] = useState(user.availability_status);
  const [availabilitySaving, setAvailabilitySaving] = useState(false);

  // Self-service profile fields shown on the public Hire Crew directory and the crew
  // profile page - a photo, a professional role, skills, years of experience and a bio.
  // All optional and purely self-reported, same spirit as availability above.
  const [photoPath, setPhotoPath] = useState(user.profile_photo_path);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [professionalRole, setProfessionalRole] = useState(user.professional_role || '');
  const [skillsText, setSkillsText] = useState(user.skills || '');
  const [yearsExperience, setYearsExperience] = useState(
    user.years_experience === null || user.years_experience === undefined ? '' : String(user.years_experience)
  );
  const [bio, setBio] = useState(user.bio || '');
  const [profileBanner, setProfileBanner] = useState(null);
  const [profileSaving, setProfileSaving] = useState(false);

  // Portfolio photos - additive to the single profile photo above, any number of
  // work-sample images up to MAX_PORTFOLIO_IMAGES. There's no "my portfolio" endpoint of its
  // own - the public /users/:id/public-profile bundle already includes it, and since it's
  // public it works just as well fetched for one's own id here.
  const [portfolio, setPortfolio] = useState(null);
  const [portfolioUploading, setPortfolioUploading] = useState(false);
  const [portfolioBanner, setPortfolioBanner] = useState(null);
  const [deletingPortfolioId, setDeletingPortfolioId] = useState(null);

  const approved = user.verification_status === 'approved';

  useEffect(() => {
    if (approved) {
      loadOpenListings();
      loadApplications();
      loadMyJobs();
      loadPortfolio();
    }
  }, []);

  function goTo(nextSection) {
    setError(null);
    setSearchParams(nextSection === 'overview' ? {} : { section: nextSection });
    window.scrollTo(0, 0);
    // Reloaded every time, not just the first time - the organizer could confirm a payment
    // or accept an application while another section is open, so these shouldn't go stale.
    if (nextSection === 'jobs' || nextSection === 'overview') loadMyJobs();
    if (nextSection === 'applications' || nextSection === 'overview') loadApplications();
  }

  async function loadPortfolio() {
    try {
      const response = await fetch(`/api/users/${user.id}/public-profile`);
      const data = await response.json();
      if (response.ok) {
        setPortfolio(data.portfolio);
      }
    } catch (err) {
      // Silently leave the portfolio section empty - the rest of the dashboard still works.
    }
  }

  async function loadOpenListings() {
    try {
      const response = await fetch('/api/job-listings/open');
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Could not load open jobs.');
        return;
      }
      setListings(data);
    } catch (err) {
      setError('Could not reach the server.');
    }
  }

  async function loadApplications() {
    try {
      const response = await fetch('/api/job-listings/mine-applications');
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Could not load your applications.');
        return;
      }
      setApplications(data);
    } catch (err) {
      setError('Could not reach the server.');
    }
  }

  async function loadMyJobs() {
    try {
      const response = await fetch('/api/jobs/mine');
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Could not load your jobs.');
        return;
      }
      setMyJobs(data);
    } catch (err) {
      setError('Could not reach the server.');
    }
  }

  async function handleApply(listingId) {
    setApplyingId(listingId);
    setError(null);
    try {
      const response = await fetch(`/api/job-listings/${listingId}/apply`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Could not apply. Please try again.');
        return;
      }
      setListings((current) =>
        current.map((listing) => (listing.id === listingId ? { ...listing, already_applied: true } : listing))
      );
      loadApplications();
    } catch (err) {
      setError('Could not reach the server.');
    } finally {
      setApplyingId(null);
    }
  }

  async function handleAvailabilityToggle() {
    const nextStatus = availability === 'available' ? 'working' : 'available';
    setAvailabilitySaving(true);
    try {
      const response = await fetch('/api/users/me/availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Could not update your status.');
        return;
      }
      setAvailability(data.availability_status);
    } catch (err) {
      setError('Could not reach the server.');
    } finally {
      setAvailabilitySaving(false);
    }
  }

  async function handlePhotoChange(e) {
    const file = e.target.files[0];
    if (!file) return;

    setPhotoUploading(true);
    setProfileBanner(null);
    try {
      const formData = new FormData();
      formData.append('profile_photo', file);
      const response = await fetch('/api/users/me/photo', { method: 'POST', body: formData });
      const data = await response.json();
      if (!response.ok) {
        setProfileBanner({ type: 'error', text: data.error || 'Could not upload your photo.' });
        return;
      }
      setPhotoPath(data.profile_photo_path);
    } catch (err) {
      setProfileBanner({ type: 'error', text: 'Could not reach the server.' });
    } finally {
      setPhotoUploading(false);
      e.target.value = '';
    }
  }

  async function handleProfileSave(e) {
    e.preventDefault();
    setProfileSaving(true);
    setProfileBanner(null);
    try {
      const response = await fetch('/api/users/me/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          professional_role: professionalRole,
          skills: skillsText.split(',').map((skill) => skill.trim()).filter(Boolean),
          years_experience: yearsExperience === '' ? null : Number(yearsExperience),
          bio,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setProfileBanner({ type: 'error', text: data.error || 'Could not save your profile.' });
        return;
      }
      setProfessionalRole(data.professional_role || '');
      setSkillsText(data.skills.join(', '));
      setYearsExperience(data.years_experience === null || data.years_experience === undefined ? '' : String(data.years_experience));
      setBio(data.bio || '');
      setProfileBanner({ type: 'success', text: 'Profile saved.' });
    } catch (err) {
      setProfileBanner({ type: 'error', text: 'Could not reach the server.' });
    } finally {
      setProfileSaving(false);
    }
  }

  async function handlePortfolioUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    setPortfolioUploading(true);
    setPortfolioBanner(null);
    try {
      const formData = new FormData();
      formData.append('portfolio_photo', file);
      const response = await fetch('/api/users/me/portfolio', { method: 'POST', body: formData });
      const data = await response.json();
      if (!response.ok) {
        setPortfolioBanner({ type: 'error', text: data.error || 'Could not upload that photo.' });
        return;
      }
      setPortfolio((current) => [...(current || []), { id: data.id, image_path: data.image_path }]);
    } catch (err) {
      setPortfolioBanner({ type: 'error', text: 'Could not reach the server.' });
    } finally {
      setPortfolioUploading(false);
      e.target.value = '';
    }
  }

  async function handlePortfolioDelete(imageId) {
    setDeletingPortfolioId(imageId);
    setPortfolioBanner(null);
    try {
      const response = await fetch(`/api/users/me/portfolio/${imageId}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json();
        setPortfolioBanner({ type: 'error', text: data.error || 'Could not remove that photo.' });
        return;
      }
      setPortfolio((current) => current.filter((image) => image.id !== imageId));
    } catch (err) {
      setPortfolioBanner({ type: 'error', text: 'Could not reach the server.' });
    } finally {
      setDeletingPortfolioId(null);
    }
  }

  // --- derived data for the overview ---
  const pendingApplications = applications ? applications.filter((application) => application.status === 'pending').length : 0;
  const openJobsToConfirm = myJobs
    ? myJobs.filter((job) => job.status === 'pending' && !job.crew_confirmed_at).length
    : 0;
  // The next gig: the confirmed job that hasn't been paid and confirmed yet with the earliest due date.
  const upcomingJob = myJobs
    ? [...myJobs].filter((job) => job.status === 'pending').sort((a, b) => new Date(a.due_date) - new Date(b.due_date))[0]
    : null;

  const profileChecklist = [
    { done: Boolean(photoPath), label: 'Add a profile photo' },
    { done: Boolean(professionalRole.trim()), label: 'Add your professional role' },
    { done: Boolean(skillsText.trim()), label: 'List your skills' },
    { done: yearsExperience !== '', label: 'Add your years of experience' },
    { done: Boolean(bio.trim()), label: 'Write a short bio' },
    { done: Boolean(portfolio && portfolio.length), label: 'Upload a portfolio photo' },
  ];
  const profilePercent = Math.round((profileChecklist.filter((item) => item.done).length / profileChecklist.length) * 100);

  const navItems = SECTIONS.map((item) => ({
    ...item,
    badge: item.key === 'jobs' && openJobsToConfirm ? openJobsToConfirm : null,
  }));

  const firstName = user.name.split(' ')[0];

  function renderAvailability() {
    return (
      <div className="krew-db-availability">
        <div>
          <span className={`krew-db-availability-status ${availability === 'available' ? 'available' : 'working'}`}>
            {availability === 'available' ? 'Available for work' : 'Currently working'}
          </span>
          <p>Organizers see this on Hire Crew and your public profile.</p>
        </div>
        <button
          type="button"
          className="krew-button-secondary krew-button-inline krew-db-small-btn"
          onClick={handleAvailabilityToggle}
          disabled={availabilitySaving}
        >
          {availabilitySaving ? 'Saving…' : availability === 'available' ? 'Mark as currently working' : 'Mark as available'}
        </button>
      </div>
    );
  }

  function renderApplicationRow(application) {
    const status = APPLICATION_STATUS[application.status] || { label: application.status, className: application.status };
    return (
      <li className="krew-db-row" key={application.id}>
        <ListingPhoto listing={application} className="krew-db-row-photo" />
        <div className="krew-db-row-main">
          <strong>{application.title || 'Untitled listing'}</strong>
          <span>
            {application.organizer_name} · Due {formatDate(application.due_date)}
          </span>
        </div>
        <span className="krew-db-row-amount">KES {Number(application.amount).toLocaleString()}</span>
        <span className={`krew-status-pill ${status.className}`}>{status.label}</span>
      </li>
    );
  }

  if (!approved) {
    return (
      <DashboardShell user={{ ...user, profile_photo_path: photoPath }} navItems={[SECTIONS[0]]} active="overview" onNavigate={() => {}} onLogout={onLogout}>
        <div className="krew-db-head">
          <h1>Welcome, {firstName}</h1>
          <p>Your account is still waiting on admin approval. Once you're approved, you'll be able to find gigs and apply here.</p>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      user={{ ...user, profile_photo_path: photoPath }}
      navItems={navItems}
      active={section}
      onNavigate={goTo}
      onLogout={onLogout}
    >
      {error && <div className="krew-form-banner error">{error}</div>}

      {section === 'overview' && (
        <>
          <div className="krew-db-head">
            <h1>{greeting()}, {firstName}</h1>
            <p>Here's what's happening with your work.</p>
          </div>

          <PilotSurveyBanner />

          <div className="krew-db-overview">
            <section className="krew-db-upcoming">
              {upcomingJob ? (
                <>
                  <div className="krew-db-upcoming-copy">
                    <span className="krew-db-eyebrow">Upcoming gig</span>
                    <h2>{upcomingJob.title || upcomingJob.job_description || 'Direct hire'}</h2>
                    <ul>
                      <li><CalendarDays size={17} strokeWidth={1.5} aria-hidden="true" /> Due {formatDate(upcomingJob.due_date)}</li>
                      {upcomingJob.location && <li><MapPin size={17} strokeWidth={1.5} aria-hidden="true" /> {upcomingJob.location}</li>}
                    </ul>
                    <p className="krew-db-upcoming-meta">
                      {upcomingJob.organizer_name} · KES {Number(upcomingJob.amount).toLocaleString()}
                      {upcomingJob.crew_confirmed_at ? ' · You confirmed payment' : ''}
                    </p>
                    <button type="button" className="krew-db-upcoming-link" onClick={() => goTo('jobs')}>
                      View in My Jobs <ArrowRight size={15} strokeWidth={2} />
                    </button>
                  </div>
                  <ListingPhoto listing={upcomingJob} className="krew-db-upcoming-photo" />
                </>
              ) : (
                <div className="krew-db-upcoming-copy">
                  <span className="krew-db-eyebrow">Upcoming gig</span>
                  <h2>{myJobs === null ? 'Loading…' : 'Nothing booked yet'}</h2>
                  <p className="krew-db-upcoming-meta">
                    When an organizer hires you or accepts your application, your next gig shows up here.
                  </p>
                  <button type="button" className="krew-db-upcoming-link" onClick={() => goTo('gigs')}>
                    Find gigs <ArrowRight size={15} strokeWidth={2} />
                  </button>
                </div>
              )}
              <span className="krew-shard krew-db-upcoming-shard" aria-hidden="true" />
            </section>

            <section className="krew-db-card">
              <div className="krew-db-card-head">
                <h2>Your applications</h2>
                <button type="button" className="krew-text-link krew-db-link-btn" onClick={() => goTo('applications')}>
                  View all <ArrowRight size={15} strokeWidth={2} />
                </button>
              </div>
              {applications === null && <div className="krew-dash-loading-note">Loading…</div>}
              {applications && applications.length === 0 && (
                <p className="krew-db-empty">
                  You haven't applied to anything yet.{' '}
                  <button type="button" className="krew-dash-text-btn" onClick={() => goTo('gigs')}>Browse open gigs</button>
                </p>
              )}
              {applications && applications.length > 0 && (
                <ul className="krew-db-rows">{applications.slice(0, 3).map(renderApplicationRow)}</ul>
              )}
            </section>

            <section className="krew-db-card">
              <div className="krew-db-card-head">
                <h2>Profile strength</h2>
                <span className="krew-db-percent">{profilePercent}%</span>
              </div>
              <div className="krew-db-progress" role="progressbar" aria-valuenow={profilePercent} aria-valuemin={0} aria-valuemax={100}>
                <span style={{ width: `${profilePercent}%` }} />
              </div>
              <ul className="krew-db-checklist">
                {profileChecklist.map((item) => (
                  <li key={item.label} className={item.done ? 'done' : ''}>
                    {item.done ? (
                      <CircleCheck size={19} strokeWidth={1.5} aria-hidden="true" />
                    ) : (
                      <Circle size={19} strokeWidth={1.5} aria-hidden="true" />
                    )}
                    {item.label}
                  </li>
                ))}
              </ul>
              {profilePercent < 100 && (
                <button type="button" className="krew-text-link krew-db-link-btn" onClick={() => goTo('profile')}>
                  Finish your profile <ArrowRight size={15} strokeWidth={2} />
                </button>
              )}
            </section>

            <section className="krew-db-card krew-db-availability-card">
              <div className="krew-db-card-head">
                <h2>Availability</h2>
              </div>
              {renderAvailability()}
            </section>
          </div>

          <section className="krew-db-banner">
            <span className="krew-shard krew-db-banner-shard-1" aria-hidden="true" />
            <span className="krew-shard krew-db-banner-shard-2" aria-hidden="true" />
            <div>
              <h2>Keep creating.</h2>
              <p>You're on the right track - every confirmed job builds your record on KREW.</p>
            </div>
            <Link to={`/crew/${user.id}`} className="krew-db-banner-link">
              View your public profile <ArrowRight size={15} strokeWidth={2} />
            </Link>
          </section>
        </>
      )}

      {section === 'gigs' && (
        <>
          <div className="krew-db-head">
            <h1>Find gigs</h1>
            <p>Open listings you can apply to right now. Each one shows the organizer's real payment record.</p>
          </div>

          {listings === null && !error && <div className="krew-dash-loading-note">Loading…</div>}

          {listings && listings.length === 0 && (
            <div className="krew-dash-empty">
              <p>No open gigs right now. Check back soon.</p>
            </div>
          )}

          {listings && listings.length > 0 && (
            <ul className="krew-db-gigs">
              {listings.map((listing) => (
                <li className="krew-db-gig" key={listing.id}>
                  <ListingPhoto listing={listing} className="krew-db-gig-photo" />
                  <div className="krew-db-gig-main">
                    <Link to={`/gigs/${listing.id}`} className="krew-db-gig-title">{listing.title || 'Untitled listing'}</Link>
                    <span className="krew-db-gig-meta">
                      <span><MapPin size={14} strokeWidth={1.75} aria-hidden="true" /> {listing.location}</span>
                      <span><CalendarDays size={14} strokeWidth={1.75} aria-hidden="true" /> Due {formatDate(listing.due_date)}</span>
                    </span>
                    <span className="krew-db-gig-org">
                      {listing.organizer_name} · {formatOrganizerRecord(listing.organizer_record)}
                    </span>
                    {listing.category && <span className="krew-fw-tag">{listing.category}</span>}
                  </div>
                  <div className="krew-db-gig-side">
                    <span className="krew-db-gig-amount">KES {Number(listing.amount).toLocaleString()}</span>
                    <button
                      type="button"
                      className="krew-button-primary krew-button-inline krew-db-small-btn"
                      disabled={listing.already_applied || applyingId !== null}
                      onClick={() => handleApply(listing.id)}
                    >
                      {listing.already_applied ? 'Applied' : applyingId === listing.id ? 'Applying…' : 'Apply'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {section === 'applications' && (
        <>
          <div className="krew-db-head">
            <h1>Applications</h1>
            <p>
              Every gig you've applied to.
              {pendingApplications > 0 ? ` ${pendingApplications} still under review.` : ''}
            </p>
          </div>

          {applications === null && !error && <div className="krew-dash-loading-note">Loading…</div>}

          {applications && applications.length === 0 && (
            <div className="krew-dash-empty">
              <p>You haven't applied to any jobs yet.</p>
              <button type="button" className="krew-button-primary krew-button-inline" onClick={() => goTo('gigs')}>
                Find gigs <ArrowRight size={16} strokeWidth={2} />
              </button>
            </div>
          )}

          {applications && applications.length > 0 && (
            <section className="krew-db-card">
              <ul className="krew-db-rows">{applications.map(renderApplicationRow)}</ul>
            </section>
          )}
        </>
      )}

      {section === 'jobs' && (
        <>
          <div className="krew-db-head">
            <h1>My jobs</h1>
            <p>Jobs you're hired for. Once you've been paid, confirm the amount here - when both sides confirm, it counts toward your record.</p>
          </div>

          {myJobs === null && !error && <div className="krew-dash-loading-note">Loading…</div>}

          {myJobs && myJobs.length === 0 && (
            <div className="krew-dash-empty">
              <p>No confirmed jobs yet - once an organizer hires you or accepts your application, it'll show up here.</p>
            </div>
          )}

          {myJobs && myJobs.length > 0 && (
            <div className="krew-job-list">
              {myJobs.map((job) => (
                <JobCard key={job.id} job={job} viewerRole="crew_member" onConfirmed={loadMyJobs} />
              ))}
            </div>
          )}
        </>
      )}

      {section === 'profile' && (
        <>
          <div className="krew-db-head krew-db-head-row">
            <div>
              <h1>Profile</h1>
              <p>This is what organizers see on Hire Crew and your public profile.</p>
            </div>
            <Link to={`/crew/${user.id}`} className="krew-button-secondary krew-button-inline krew-db-small-btn">
              View public profile <ArrowRight size={15} strokeWidth={2} />
            </Link>
          </div>

          <section className="krew-db-card">
            {profileBanner && <div className={`krew-form-banner ${profileBanner.type}`}>{profileBanner.text}</div>}

            <div className="krew-dash-profile-top">
              <label htmlFor="profile-photo-input" className="krew-dash-avatar">
                {photoPath ? (
                  <img src={`/uploads/${photoPath}`} alt="" />
                ) : (
                  <span className="krew-dash-avatar-placeholder"><UserIcon size={28} strokeWidth={1.5} /></span>
                )}
                <span className="krew-dash-avatar-edit">{photoUploading ? 'Uploading…' : 'Change photo'}</span>
                <input
                  id="profile-photo-input"
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={handlePhotoChange}
                  disabled={photoUploading}
                />
              </label>

              <form className="krew-dash-profile-fields" onSubmit={handleProfileSave}>
                <div className="krew-field">
                  <label className="krew-field-label" htmlFor="professional-role">Professional role</label>
                  <input
                    id="professional-role"
                    type="text"
                    className="krew-field-input"
                    value={professionalRole}
                    onChange={(e) => setProfessionalRole(e.target.value)}
                    placeholder="e.g. Bartender, Event Photographer"
                  />
                </div>
                <div className="krew-field">
                  <label className="krew-field-label" htmlFor="skills">Skills (comma-separated)</label>
                  <input
                    id="skills"
                    type="text"
                    className="krew-field-input"
                    value={skillsText}
                    onChange={(e) => setSkillsText(e.target.value)}
                    placeholder="e.g. Mixology, Crowd Management, Setup"
                  />
                </div>
                <div className="krew-field">
                  <label className="krew-field-label" htmlFor="years-experience">Years of experience</label>
                  <input
                    id="years-experience"
                    type="number"
                    min="0"
                    max="80"
                    className="krew-field-input"
                    value={yearsExperience}
                    onChange={(e) => setYearsExperience(e.target.value)}
                    placeholder="e.g. 3"
                  />
                </div>
                <div className="krew-field">
                  <label className="krew-field-label" htmlFor="bio">
                    Bio <span className="krew-dash-availability-note" style={{ display: 'inline', marginTop: 0 }}>(max 400 characters)</span>
                  </label>
                  <textarea
                    id="bio"
                    className="krew-field-input krew-field-textarea"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    maxLength={400}
                    rows={3}
                    placeholder="A couple of sentences about the work you do and how you do it."
                  />
                </div>
                <button type="submit" className="krew-button-primary krew-button-inline" disabled={profileSaving}>
                  {profileSaving ? 'Saving…' : 'Save profile'}
                </button>
              </form>
            </div>
          </section>

          <section className="krew-db-card">
            <div className="krew-db-card-head">
              <h2>Portfolio</h2>
              {portfolio && <span className="krew-db-card-note">{portfolio.length} of {MAX_PORTFOLIO_IMAGES} photos</span>}
            </div>
            <p className="krew-db-card-sub">Work samples shown on your public profile. The first one is also your profile's cover.</p>

            {portfolioBanner && <div className={`krew-form-banner ${portfolioBanner.type}`}>{portfolioBanner.text}</div>}

            <div className="krew-portfolio-grid">
              {portfolio && portfolio.map((image) => (
                <div className="krew-portfolio-thumb" key={image.id}>
                  <img src={`/uploads/${image.image_path}`} alt="" />
                  <button
                    type="button"
                    className="krew-portfolio-thumb-remove"
                    onClick={() => handlePortfolioDelete(image.id)}
                    disabled={deletingPortfolioId === image.id}
                    aria-label="Remove this photo"
                  >
                    <X size={14} strokeWidth={2} />
                  </button>
                </div>
              ))}

              {portfolio && portfolio.length < MAX_PORTFOLIO_IMAGES && (
                <label className="krew-portfolio-add" htmlFor="portfolio-photo-input">
                  {portfolioUploading ? (
                    <span className="krew-dash-loading-note" style={{ margin: 0 }}>Uploading…</span>
                  ) : (
                    <>
                      <Plus size={20} strokeWidth={1.5} />
                      <span>Add photo</span>
                    </>
                  )}
                  <input
                    id="portfolio-photo-input"
                    type="file"
                    accept="image/jpeg,image/png"
                    onChange={handlePortfolioUpload}
                    disabled={portfolioUploading}
                  />
                </label>
              )}
            </div>

            {portfolio === null && <div className="krew-dash-loading-note">Loading portfolio…</div>}
          </section>

          <section className="krew-db-card">
            <div className="krew-db-card-head">
              <h2>Availability</h2>
            </div>
            {renderAvailability()}
          </section>
        </>
      )}
    </DashboardShell>
  );
}
