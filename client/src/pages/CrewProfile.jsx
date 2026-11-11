import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { User as UserIcon } from 'lucide-react';
import PublicNav from '../components/PublicNav.jsx';
import PublicFooter from '../components/PublicFooter.jsx';
import InfoTooltip from '../components/InfoTooltip.jsx';

// A crew member's public profile (redesign moodboard panel 5, "Crew Profile"): portrait, role, skills, self-reported years of experience, a short bio, their real completed-jobs record, and a gallery of portfolio photos. 
// Read-only here - a crew member edits all of this from their own dashboard (CrewDashboard.jsx's "My profile" card), the same way a gig's organizer-side details are edited from the dashboard and only displayed on GigDetail.jsx. Linked to from HireCrew.jsx's directory cards.
function formatCrewRecord(profile) {
  if (!profile.confirmed_job_count) {
    return (
      <>
        <span className="krew-status-pill new">New here</span>
        <InfoTooltip text="New here means this crew member hasn't completed a job on KREW yet - everyone starts without a track record, it isn't a red flag." />
      </>
    );
  }
  const jobWord = profile.confirmed_job_count === 1 ? 'job' : 'jobs';
  return (
    <>
      {profile.confirmed_job_count} completed {jobWord}
      <InfoTooltip text="The number of jobs this crew member has completed and had payment confirmed on KREW." />
    </>
  );
}

// Main component for displaying a crew member's public profile.
export default function CrewProfile() {
  const { id } = useParams();

  const [profile, setProfile] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(null);

  const [session, setSession] = useState(undefined); // undefined = still checking, null = logged out

  useEffect(() => {
    let cancelled = false;
    setProfile(null);
    setNotFound(false);
    setError(null);
    fetch(`/api/users/${id}/public-profile`)
      .then((response) => response.json().then((data) => ({ ok: response.ok, status: response.status, data })))
      .then(({ ok, status, data }) => {
        if (cancelled) return;
        if (!ok) {
          if (status === 404) {
            setNotFound(true);
          } else {
            setError(data.error || 'Could not load this profile.');
          }
          return;
        }
        setProfile(data);
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

  const isOwnProfile = session && String(session.id) === String(id);

  return (
    <div className="krew-public-page">
      <PublicNav />

      <div className="krew-crew-profile-wrap">
        <Link to="/hire-crew" className="krew-gig-back-link">&larr; Back to Hire Crew</Link>

        {error && <div className="krew-form-banner error">{error}</div>}

        {notFound && (
          <div className="krew-dash-empty">
            <p>This crew member isn't listed, or doesn't exist.</p>
            <Link to="/hire-crew" className="krew-button-secondary" style={{ width: 'auto', display: 'inline-block' }}>
              Browse crew
            </Link>
          </div>
        )}

        {profile === null && !notFound && !error && (
          <div className="krew-dash-loading-note">Loading profile…</div>
        )}

        {profile && (
          <>
            {isOwnProfile && (
              <div className="krew-form-banner" style={{ marginBottom: 20 }}>
                This is your public profile. <Link to="/dashboard">Manage your photos and details from your dashboard.</Link>
              </div>
            )}

            <div className="krew-crew-profile-header">
              <div className="krew-crew-profile-portrait">
                {profile.profile_photo_path ? (
                  <img src={`/uploads/${profile.profile_photo_path}`} alt="" />
                ) : (
                  <div className="krew-crew-profile-portrait-placeholder">
                    <UserIcon size={40} strokeWidth={1.5} />
                  </div>
                )}
                <span className={`krew-status-pill ${profile.availability_status === 'available' ? 'confirmed' : 'pending'}`}>
                  {profile.availability_status === 'available' ? 'Available' : 'Currently working'}
                </span>
              </div>

              <div className="krew-crew-profile-info">
                <h1>{profile.name}</h1>
                {profile.professional_role && <p className="krew-crew-profile-role">{profile.professional_role}</p>}

                <div className="krew-crew-profile-stats">
                  <div className="krew-crew-profile-stat">{formatCrewRecord(profile)}</div>
                  {profile.years_experience !== null && profile.years_experience !== undefined && (
                    <div className="krew-crew-profile-stat">
                      {profile.years_experience}+ {profile.years_experience === 1 ? 'year' : 'years'} experience
                    </div>
                  )}
                </div>

                {profile.skills.length > 0 && (
                  <div className="krew-crew-card-skills" style={{ justifyContent: 'flex-start', marginTop: 16 }}>
                    {profile.skills.map((skill) => (
                      <span className="krew-crew-skill-chip" key={skill}>{skill}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {profile.bio && (
              <div className="krew-crew-profile-bio">
                <h2>About</h2>
                <p>{profile.bio}</p>
              </div>
            )}

            <div className="krew-crew-profile-portfolio">
              <h2>Portfolio</h2>
              {profile.portfolio.length === 0 ? (
                <p className="krew-dash-availability-note" style={{ marginTop: 0 }}>No portfolio photos yet.</p>
              ) : (
                <div className="krew-portfolio-grid krew-portfolio-grid-display">
                  {profile.portfolio.map((image) => (
                    <div className="krew-portfolio-thumb" key={image.id}>
                      <img src={`/uploads/${image.image_path}`} alt="" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <PublicFooter />
    </div>
  );
}