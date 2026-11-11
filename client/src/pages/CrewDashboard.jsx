import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { User as UserIcon, X, Plus } from 'lucide-react';
import JobCard from './JobCard.jsx';
import NotificationBell from '../components/NotificationBell.jsx';
import PilotSurveyBanner from '../components/PilotSurveyBanner.jsx';
import InfoTooltip from '../components/InfoTooltip.jsx';

const MAX_PORTFOLIO_IMAGES = 12;

// The crew dashboard is the main interface for crew members to manage their job applications and availability status.
// It has two main sections: the Open Jobs tab, where crew members can view and apply to open job listings, and the My Applications tab, where they can track the status of their applications.
// The dashboard also handles loading states, error messages, and user interactions such as applying for a job and toggling availability status.
// It also has a My Jobs tab, where crew members can see the jobs they're actually confirmed for (from either path) and confirm their own side of the payment.

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

export default function CrewDashboard({ user, onLogout }) {
  const [tab, setTab] = useState('open'); // open | applications | jobs
  const [listings, setListings] = useState(null);
  const [applications, setApplications] = useState(null);
  const [myJobs, setMyJobs] = useState(null);
  const [error, setError] = useState(null);
  const [applyingId, setApplyingId] = useState(null);

  const [availability, setAvailability] = useState(user.availability_status);
  const [availabilitySaving, setAvailabilitySaving] = useState(false);

  // Self-service profile fields shown on the public Hire Crew directory
  // (redesign brief section 7.4) - a photo, a professional role, and a
  // comma-separated list of skills. All three are optional and purely
  // self-reported, same spirit as availability above.
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

  // Portfolio photos (redesign moodboard's Crew Profile page) - additive to
  // the single profile_photo_path above, any number of work-sample images up
  // to MAX_PORTFOLIO_IMAGES. There's no "my portfolio" endpoint of its own -
  // the public /users/:id/public-profile bundle already includes it, and
  // since it's public it works just as well fetched for one's own id here.
  const [portfolio, setPortfolio] = useState(null);
  const [portfolioUploading, setPortfolioUploading] = useState(false);
  const [portfolioBanner, setPortfolioBanner] = useState(null);
  const [deletingPortfolioId, setDeletingPortfolioId] = useState(null);

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

  useEffect(() => {
    if (user.verification_status === 'approved') {
      loadOpenListings();
      loadPortfolio();
    }
  }, []);

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

  function switchTab(nextTab) {
    setTab(nextTab);
    setError(null);
    if (nextTab === 'applications' && applications === null) {
      loadApplications();
    }
    // Reloaded every time, not just the first time - the organizer could
    // confirm a payment on one of these jobs while this tab isn't open, so
    // this tab shouldn't keep showing an old confirmation state.
    if (nextTab === 'jobs') {
      loadMyJobs();
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
    } catch (err) {
      setError('Could not reach the server.');
    } finally {
      setApplyingId(null);
    }
  }

  return (
    <div className="krew-dash-page">
      <header className="krew-dash-header">
        <div className="krew-wordmark">
          KRE<span>W</span>
        </div>
        <div className="krew-dash-header-right">
          <span className="krew-dash-greeting">Hi, {user.name}</span>
          <NotificationBell />
          <button type="button" className="krew-admin-logout" onClick={onLogout}>
            Log out
          </button>
        </div>
      </header>

      {user.verification_status !== 'approved' ? (
        <div className="krew-admin-empty" style={{ maxWidth: 480, margin: '60px auto' }}>
          Your account is still waiting on admin approval. Once you're approved, you'll be able to apply for jobs here.
        </div>
      ) : (
        <div className="krew-dash-body">
          <PilotSurveyBanner />
          <div className="krew-dash-profile-card">
            <h2 className="krew-dash-form-title">My profile</h2>
            <p className="krew-dash-availability-note" style={{ marginBottom: 18 }}>
              This is what organizers see when they browse the public Hire Crew directory.{' '}
              <Link to={`/crew/${user.id}`} className="krew-dash-text-btn">View my public profile</Link>
            </p>

            {profileBanner && <div className={`krew-form-banner ${profileBanner.type}`}>{profileBanner.text}</div>}

            <div className="krew-dash-profile-top">
              <label htmlFor="profile-photo-input" className="krew-dash-avatar">
                {photoPath ? (
                  <img src={`/uploads/${photoPath}`} alt="" />
                ) : (
                  <span className="krew-dash-avatar-placeholder"><UserIcon size={28} strokeWidth={1.75} /></span>
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
                <button type="submit" className="krew-button-primary krew-dash-post-btn" disabled={profileSaving}>
                  {profileSaving ? 'Saving…' : 'Save profile'}
                </button>
              </form>
            </div>

            <div className="krew-dash-portfolio">
              <h3 className="krew-dash-subtitle" style={{ marginBottom: 4 }}>Portfolio</h3>
              <p className="krew-dash-availability-note" style={{ marginBottom: 14 }}>
                Work samples shown on your public profile. {portfolio ? `${portfolio.length} of ${MAX_PORTFOLIO_IMAGES} photos.` : ''}
              </p>

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
                        <Plus size={20} strokeWidth={1.75} />
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
            </div>

            <div className="krew-dash-availability krew-dash-availability-inline">
              <div>
                <span className={`krew-status-pill ${availability === 'available' ? 'confirmed' : 'pending'}`}>
                  {availability === 'available' ? 'Available' : 'Currently working'}
                </span>
                <span className="krew-dash-availability-note">
                  Organizers see this when they browse the crew directory.
                </span>
              </div>
              <button
                type="button"
                className="krew-button-secondary krew-dash-post-btn"
                onClick={handleAvailabilityToggle}
                disabled={availabilitySaving}
              >
                {availabilitySaving
                  ? 'Saving…'
                  : availability === 'available'
                  ? "Mark as currently working"
                  : 'Mark as available'}
              </button>
            </div>
          </div>

          <div className="krew-dash-tabs">
            <button
              type="button"
              className={`krew-dash-tab ${tab === 'open' ? 'active' : ''}`}
              onClick={() => switchTab('open')}
            >
              Open Jobs
            </button>
            <button
              type="button"
              className={`krew-dash-tab ${tab === 'applications' ? 'active' : ''}`}
              onClick={() => switchTab('applications')}
            >
              My Applications
            </button>
            <button
              type="button"
              className={`krew-dash-tab ${tab === 'jobs' ? 'active' : ''}`}
              onClick={() => switchTab('jobs')}
            >
              My Jobs
            </button>
          </div>

          {error && <div className="krew-form-banner error">{error}</div>}

          {tab === 'open' && (
            <>
              {listings === null && !error && <div className="krew-dash-loading-note">Loading…</div>}

              {listings && listings.length === 0 && (
                <div className="krew-dash-empty">
                  <p>No open jobs right now. Check back soon.</p>
                </div>
              )}

              {listings && listings.length > 0 && (
                <div className="krew-job-list">
                  {listings.map((listing) => (
                    <div className="krew-job-card" key={listing.id}>
                      <div className="krew-job-card-main">
                        <div className="krew-job-card-crew">{listing.title || 'Untitled listing'}</div>
                        <div className="krew-job-card-meta">
                          {listing.organizer_name} · {formatOrganizerRecord(listing.organizer_record)}
                        </div>
                        <div className="krew-job-card-meta">
                          {listing.category}{listing.category && listing.location ? ' · ' : ''}{listing.location}
                        </div>
                        {listing.job_description && <div className="krew-job-card-desc">{listing.job_description}</div>}
                        <div className="krew-job-card-meta">
                          Due {new Date(listing.due_date).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="krew-job-card-side">
                        <div className="krew-job-card-amount">KES {Number(listing.amount).toLocaleString()}</div>
                        <button
                          type="button"
                          className="krew-button-primary krew-dash-post-btn"
                          disabled={listing.already_applied || applyingId !== null}
                          onClick={() => handleApply(listing.id)}
                        >
                          {listing.already_applied ? 'Applied' : applyingId === listing.id ? 'Applying…' : 'Apply'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'applications' && (
            <>
              {applications === null && !error && <div className="krew-dash-loading-note">Loading…</div>}

              {applications && applications.length === 0 && (
                <div className="krew-dash-empty">
                  <p>You haven't applied to any jobs yet.</p>
                </div>
              )}

              {applications && applications.length > 0 && (
                <div className="krew-job-list">
                  {applications.map((application) => (
                    <div className="krew-job-card" key={application.id}>
                      <div className="krew-job-card-main">
                        <div className="krew-job-card-crew">{application.title || 'Untitled listing'}</div>
                        <div className="krew-job-card-meta">{application.organizer_name}</div>
                        {application.job_description && (
                          <div className="krew-job-card-desc">{application.job_description}</div>
                        )}
                        <div className="krew-job-card-meta">
                          Due {new Date(application.due_date).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="krew-job-card-side">
                        <div className="krew-job-card-amount">KES {Number(application.amount).toLocaleString()}</div>
                        <span className={`krew-status-pill ${application.status}`}>{application.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'jobs' && (
            <>
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
        </div>
      )}
    </div>
  );
}