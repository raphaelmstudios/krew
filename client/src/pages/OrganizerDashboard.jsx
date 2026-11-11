import { useEffect, useState } from 'react';
import PostListingForm from './PostListingForm.jsx';
import ListingApplicants from './ListingApplicants.jsx';
import HireForm from './HireForm.jsx';
import JobCard from './JobCard.jsx';
import NotificationBell from '../components/NotificationBell.jsx';
import Logo from '../components/Logo.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import PilotSurveyBanner from '../components/PilotSurveyBanner.jsx';
import InfoTooltip from '../components/InfoTooltip.jsx';

// The organizer dashboard is the main interface for organizers to manage their job postings and hire crew members directly.
// It has two main sections: the Job Board, where organizers can post jobs and view applicants, and the Find Crew section, where organizers can browse approved crew members and hire them directly.
// The dashboard also handles loading states, error messages, and user interactions such as posting a job, viewing applicants, and hiring crew members.

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

export default function OrganizerDashboard({ user, onLogout }) {
  const [section, setSection] = useState('board'); // board | directory

  // --- Job Board tab state ---
  const [view, setView] = useState('list'); // list | new | applicants
  const [selectedListing, setSelectedListing] = useState(null);
  const [listings, setListings] = useState(null); // null = still loading
  const [error, setError] = useState(null);

  // --- Find Crew tab state ---
  const [directoryView, setDirectoryView] = useState('list'); // list | hire
  const [crewDirectory, setCrewDirectory] = useState(null);
  const [directHires, setDirectHires] = useState(null);
  const [selectedCrewMember, setSelectedCrewMember] = useState(null);
  const [directoryError, setDirectoryError] = useState(null);

  useEffect(() => {
    if (user.verification_status === 'approved') {
      loadListings();
    }
  }, []);

  async function loadListings() {
    try {
      const response = await fetch('/api/job-listings/mine');
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Could not load your jobs.');
        return;
      }
      setListings(data);
    } catch (err) {
      setError('Could not reach the server.');
    }
  }

  function handleListingCreated() {
    setView('list');
    setListings(null);
    loadListings();
  }

  async function handleCancel(listingId) {
    try {
      await fetch(`/api/job-listings/${listingId}/cancel`, { method: 'POST' });
      setListings(null);
      loadListings();
    } catch (err) {
      setError('Could not reach the server.');
    }
  }

  function handleApplicantsAccepted() {
    setView('list');
    setSelectedListing(null);
    setListings(null);
    loadListings();
  }

  function switchSection(nextSection) {
    setSection(nextSection);
    // Reload every time this tab is opened, not just the first time - crew
    // availability and, now that jobs can be confirmed, each job's payment
    // confirmations can change while the organizer was looking at the Job
    // Board tab instead, so this tab shouldn't keep showing old data.
    if (nextSection === 'directory') {
      loadCrewDirectory();
      loadDirectHires();
    }
  }

  async function loadCrewDirectory() {
    setDirectoryError(null);
    try {
      const response = await fetch('/api/users/crew-directory');
      const data = await response.json();
      if (!response.ok) {
        setDirectoryError(data.error || 'Could not load the crew directory.');
        return;
      }
      setCrewDirectory(data);
    } catch (err) {
      setDirectoryError('Could not reach the server.');
    }
  }

  async function loadDirectHires() {
    try {
      const response = await fetch('/api/jobs/mine');
      const data = await response.json();
      if (response.ok) {
        setDirectHires(data);
      }
    } catch (err) {
      // We don't show an error here because this is just a convenience feature
      // the main job board and crew directory are still usable even if this fails.
    }
  }

  function handleHired() {
    setDirectoryView('list');
    setSelectedCrewMember(null);
    setDirectHires(null);
    loadDirectHires();
  }

  return (
    <div className="krew-dash-page">
      <header className="krew-dash-header">
        <Logo />
        <div className="krew-dash-header-right">
          <span className="krew-dash-greeting">Hi, {user.name}</span>
          <ThemeToggle />
          <NotificationBell />
          <button type="button" className="krew-admin-logout" onClick={onLogout}>
            Log out
          </button>
        </div>
      </header>

      {user.verification_status !== 'approved' ? (
        <div className="krew-admin-empty" style={{ maxWidth: 480, margin: '60px auto' }}>
          Your account is still waiting on admin approval. Once you're approved, you'll be able to post jobs here.
        </div>
      ) : (
        <div className="krew-dash-body">
          <PilotSurveyBanner />
          <div className="krew-dash-tabs">
            <button
              type="button"
              className={`krew-dash-tab ${section === 'board' ? 'active' : ''}`}
              onClick={() => switchSection('board')}
            >
              Job Board
            </button>
            <button
              type="button"
              className={`krew-dash-tab ${section === 'directory' ? 'active' : ''}`}
              onClick={() => switchSection('directory')}
            >
              Find Crew
            </button>
          </div>

          {section === 'board' && (
            <>
              {view === 'new' && <PostListingForm onCancel={() => setView('list')} onCreated={handleListingCreated} />}

              {view === 'applicants' && selectedListing && (
                <ListingApplicants
                  listing={selectedListing}
                  onBack={() => {
                    setView('list');
                    setSelectedListing(null);
                  }}
                  onAccepted={handleApplicantsAccepted}
                />
              )}

              {view === 'list' && (
                <>
                  <div className="krew-dash-title-row">
                    <h1 className="krew-dash-title">Your jobs</h1>
                    <button type="button" className="krew-button-primary krew-dash-post-btn" onClick={() => setView('new')}>
                      + Post a Job
                    </button>
                  </div>

                  {error && <div className="krew-form-banner error">{error}</div>}

                  {listings === null && !error && <div className="krew-dash-loading-note">Loading…</div>}

                  {listings && listings.length === 0 && (
                    <div className="krew-dash-empty">
                      <p>You haven't posted any jobs yet.</p>
                      <button type="button" className="krew-button-primary krew-dash-post-btn" onClick={() => setView('new')}>
                        Post your first job
                      </button>
                    </div>
                  )}

                  {listings && listings.length > 0 && (
                    <div className="krew-job-list">
                      {listings.map((listing) => (
                        <div className="krew-job-card" key={listing.id}>
                          <div className="krew-job-card-main">
                            <div className="krew-job-card-crew">{listing.title || 'Untitled listing'}</div>
                            <div className="krew-job-card-meta">
                              {listing.category}{listing.category && listing.location ? ' · ' : ''}{listing.location}
                            </div>
                            {listing.job_description && <div className="krew-job-card-desc">{listing.job_description}</div>}
                            <div className="krew-job-card-meta">
                              Due {new Date(listing.due_date).toLocaleDateString()}
                              {listing.status === 'open' &&
                                ` · ${listing.pending_applicant_count} applicant${listing.pending_applicant_count === 1 ? '' : 's'}`}
                            </div>
                          </div>
                          <div className="krew-job-card-side">
                            <div className="krew-job-card-amount">KES {Number(listing.amount).toLocaleString()}</div>
                            <span className={`krew-status-pill ${listing.status}`}>{listing.status}</span>
                            {listing.status === 'open' && (
                              <div className="krew-job-card-actions">
                                <button
                                  type="button"
                                  className="krew-dash-text-btn"
                                  onClick={() => {
                                    setSelectedListing(listing);
                                    setView('applicants');
                                  }}
                                >
                                  View applicants
                                </button>
                                <button type="button" className="krew-dash-text-btn danger" onClick={() => handleCancel(listing.id)}>
                                  Cancel
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {section === 'directory' && (
            <>
              {directoryView === 'hire' && selectedCrewMember && (
                <HireForm
                  crewMember={selectedCrewMember}
                  onCancel={() => {
                    setDirectoryView('list');
                    setSelectedCrewMember(null);
                  }}
                  onCreated={handleHired}
                />
              )}

              {directoryView === 'list' && (
                <>
                  <div className="krew-dash-title-row">
                    <h1 className="krew-dash-title">Find crew</h1>
                  </div>

                  {directoryError && <div className="krew-form-banner error">{directoryError}</div>}

                  {crewDirectory === null && !directoryError && <div className="krew-dash-loading-note">Loading…</div>}

                  {crewDirectory && crewDirectory.length === 0 && (
                    <div className="krew-dash-empty">
                      <p>No approved crew members yet.</p>
                    </div>
                  )}

                  {crewDirectory && crewDirectory.length > 0 && (
                    <div className="krew-job-list">
                      {crewDirectory.map((crewMember) => (
                        <div className="krew-job-card" key={crewMember.id}>
                          <div className="krew-job-card-main">
                            <div className="krew-job-card-crew">{crewMember.name}</div>
                            <span className={`krew-status-pill ${crewMember.availability_status === 'available' ? 'confirmed' : 'pending'}`}>
                              {crewMember.availability_status === 'available' ? 'Available' : 'Currently working'}
                            </span>
                            <div className="krew-job-card-meta">{formatCrewRecord(crewMember)}</div>
                          </div>
                          <div className="krew-job-card-side">
                            <button
                              type="button"
                              className="krew-button-primary krew-dash-post-btn"
                              onClick={() => {
                                setSelectedCrewMember(crewMember);
                                setDirectoryView('hire');
                              }}
                            >
                              Hire
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {directHires && directHires.length > 0 && (
                    <div className="krew-dash-directory-hires">
                      {/* this is the only screen that shows a confirmed job's crew member and amount together */}
                      <h2 className="krew-dash-subtitle">Your confirmed jobs</h2>
                      <div className="krew-job-list">
                        {directHires.map((job) => (
                          <JobCard key={job.id} job={job} viewerRole="organizer" onConfirmed={loadDirectHires} />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}