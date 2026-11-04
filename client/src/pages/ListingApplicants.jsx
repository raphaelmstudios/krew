import { useEffect, useState } from 'react';

// A page for viewing the applicants to a specific job listing.
// The organizer can see the list of applicants, their application status, and the date they applied.
// The organizer can accept an applicant, which will create a formal job agreement and remove the listing from the open job board.
// The page handles loading states, error messages, and displays a back button to return to the organizer's listings.

export default function ListingApplicants({ listing, onBack, onAccepted }) {
  const [applicants, setApplicants] = useState(null); // null = still loading
  const [error, setError] = useState(null);
  const [acceptingId, setAcceptingId] = useState(null);

  useEffect(() => {
    loadApplicants();
  }, []);

  async function loadApplicants() {
    try {
      const response = await fetch(`/api/job-listings/${listing.id}/applicants`);
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Could not load applicants.');
        return;
      }
      setApplicants(data);
    } catch (err) {
      setError('Could not reach the server.');
    }
  }

  async function handleAccept(crewMemberId) {
    setAcceptingId(crewMemberId);
    setError(null);
    try {
      const response = await fetch(`/api/job-listings/${listing.id}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crew_member_id: crewMemberId }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Could not accept this applicant. Please try again.');
        return;
      }
      onAccepted();
    } catch (err) {
      setError('Could not reach the server.');
    } finally {
      setAcceptingId(null);
    }
  }

  return (
    <div>
      <button type="button" className="krew-dash-back-link" onClick={onBack}>
        ← Back to your jobs
      </button>

      <div className="krew-dash-title-row">
        <div>
          <h1 className="krew-dash-title">Applicants</h1>
          <p className="krew-dash-listing-summary">
            KES {Number(listing.amount).toLocaleString()} · Due {new Date(listing.due_date).toLocaleDateString()}
            {listing.job_description ? ` · ${listing.job_description}` : ''}
          </p>
        </div>
      </div>

      {error && <div className="krew-form-banner error">{error}</div>}

      {applicants === null && !error && <div className="krew-dash-loading-note">Loading…</div>}

      {applicants && applicants.length === 0 && (
        <div className="krew-dash-empty">
          <p>No one has applied yet. Check back soon.</p>
        </div>
      )}

      {applicants && applicants.length > 0 && (
        <div className="krew-job-list">
          {applicants.map((applicant) => (
            <div className="krew-job-card" key={applicant.application_id}>
              <div className="krew-job-card-main">
                <div className="krew-job-card-crew">{applicant.crew_member_name}</div>
                <div className="krew-job-card-meta">
                  Applied {new Date(applicant.created_at).toLocaleDateString()}
                </div>
              </div>
              <div className="krew-job-card-side">
                {applicant.status === 'pending' ? (
                  <button
                    type="button"
                    className="krew-button-primary krew-dash-post-btn"
                    disabled={acceptingId !== null}
                    onClick={() => handleAccept(applicant.crew_member_id)}
                  >
                    {acceptingId === applicant.crew_member_id ? 'Accepting…' : 'Accept'}
                  </button>
                ) : (
                  <span className={`krew-status-pill ${applicant.status}`}>{applicant.status}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}