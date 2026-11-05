import { useEffect, useState } from 'react';
import JobCard from './JobCard.jsx';

// The crew dashboard is the main interface for crew members to manage their job applications and availability status.
// It has two main sections: the Open Jobs tab, where crew members can view and apply to open job listings, and the My Applications tab, where they can track the status of their applications.
// The dashboard also handles loading states, error messages, and user interactions such as applying for a job and toggling availability status.
// It also has a My Jobs tab, where crew members can see the jobs they're actually confirmed for (from either path) and confirm their own side of the payment.

// Turns an organizer's payment record into one readable line on an open listing's card, so
// a crew member has something to go on before applying. on_time_percentage comes back null
// when the organizer has no confirmed jobs yet, so this just says that plainly for now
// instead of showing a misleading 0%.
function formatOrganizerRecord(record) {
  if (!record || record.confirmed_job_count === 0) {
    return 'New organizer - no completed jobs yet';
  }
  const jobWord = record.confirmed_job_count === 1 ? 'job' : 'jobs';
  return `${record.confirmed_job_count} completed ${jobWord} · ${record.on_time_percentage}% on time`;
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

  useEffect(() => {
    if (user.verification_status === 'approved') {
      loadOpenListings();
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
          <div className="krew-dash-availability">
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
                        <div className="krew-job-card-crew">{listing.organizer_name}</div>
                        <div className="krew-job-card-meta">{formatOrganizerRecord(listing.organizer_record)}</div>
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
                        <div className="krew-job-card-crew">{application.organizer_name}</div>
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