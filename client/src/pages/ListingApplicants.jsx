import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { formatCrewRecord } from './OrganizerDashboard.jsx';
import { initials } from '../components/CrewCard.jsx';

// A page for viewing the applicants to a specific job listing.
// The organizer can see the list of applicants, their application status, and the date they applied.
// The organizer can accept an applicant, which will create a formal job agreement and remove the listing from the open job board.
// The page handles loading states, error messages, and displays a back button to return to the organizer's listings.
// Each applicant also comes with their completed jobs count (see formatCrewRecord in
// OrganizerDashboard.jsx), so the organizer has something to go on before picking who to
// accept - the same number the crew directory shows for a direct hire.
// The rows match Find Crew's (photo or initials, role, record), with a View profile link so the
// organizer can check someone's portfolio and work history before accepting them.

const STATUS_LABELS = { accepted: 'Accepted', declined: 'Not selected' };

function formatDate(value) {
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Application timestamps are SQLite UTC values without a timezone marker.
function formatServerDay(value) {
  return new Date(`${value.replace(' ', 'T')}Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

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
    } catch {
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
    } catch {
      setError('Could not reach the server.');
    } finally {
      setAcceptingId(null);
    }
  }

  return (
    <div>
      <button type="button" className="krew-db-back" onClick={onBack}>
        <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" /> Back to My Gigs
      </button>

      <div className="krew-db-head">
        <h1>Applicants</h1>
        <p>
          {listing.title || 'Untitled listing'} · KES {Number(listing.amount).toLocaleString()} · Due {formatDate(listing.due_date)}
        </p>
      </div>

      {error && <div className="krew-form-banner error">{error}</div>}

      {applicants === null && !error && <div className="krew-dash-loading-note" role="status">Loading…</div>}

      {applicants && applicants.length === 0 && (
        <div className="krew-dash-empty">
          <p>No one has applied yet. Share the gig's page so crew can find it.</p>
          <Link to={`/gigs/${listing.id}`} className="krew-button-secondary krew-button-inline">
            Open the gig page
          </Link>
        </div>
      )}

      {applicants && applicants.length > 0 && (
        <ul className="krew-db-crew">
          {applicants.map((applicant) => (
            <li className="krew-db-crew-row" key={applicant.application_id}>
              <span className="krew-db-crew-avatar">
                {applicant.profile_photo_path ? (
                  <img src={`/uploads/${applicant.profile_photo_path}`} alt="" loading="lazy" decoding="async" />
                ) : (
                  <span aria-hidden="true">{initials(applicant.crew_member_name)}</span>
                )}
              </span>
              <div className="krew-db-crew-main">
                <strong>{applicant.crew_member_name}</strong>
                <span>
                  {applicant.professional_role || 'Event crew'}
                  {applicant.years_experience ? ` · ${applicant.years_experience}+ yrs` : ''} · Applied{' '}
                  {formatServerDay(applicant.created_at)}
                </span>
                <span className="krew-db-crew-record">{formatCrewRecord(applicant)}</span>
              </div>
              <div className="krew-db-crew-actions">
                <Link to={`/crew/${applicant.crew_member_id}`} className="krew-dash-text-btn">
                  View profile
                </Link>
                {applicant.status === 'pending' ? (
                  <button
                    type="button"
                    className="krew-button-primary krew-button-inline krew-db-small-btn"
                    disabled={acceptingId !== null}
                    onClick={() => handleAccept(applicant.crew_member_id)}
                  >
                    {acceptingId === applicant.crew_member_id ? 'Accepting…' : 'Accept'}
                  </button>
                ) : (
                  <span className={`krew-status-pill ${applicant.status}`}>{STATUS_LABELS[applicant.status] || applicant.status}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
