import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, User as UserIcon } from 'lucide-react';
import PublicNav from '../components/PublicNav.jsx';
import PublicFooter from '../components/PublicFooter.jsx';
import InfoTooltip from '../components/InfoTooltip.jsx';

// Formats the crew member's record for display in the directory.
// If they have no confirmed jobs, show a "New here" badge. Otherwise, show the number of completed jobs with proper pluralization. Either way it comes with a small info icon explaining what the badge means.
function formatCrewRecord(crewMember) {
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

// The Hire Crew page is a public-facing page that allows users to browse and search for crew members.
export default function HireCrew() {
  const [crewMembers, setCrewMembers] = useState(null);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [availability, setAvailability] = useState('');

  useEffect(() => {
    fetch('/api/users/crew-directory/public')
      .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) {
          setError(data.error || 'Could not load the crew directory.');
          return;
        }
        setCrewMembers(data);
      })
      .catch(() => setError('Could not reach the server.'));
  }, []);

  const filtered = useMemo(() => {
    if (!crewMembers) return null;
    const searchLower = search.trim().toLowerCase();

    return crewMembers.filter((crewMember) => {
      if (availability && crewMember.availability_status !== availability) return false;
      if (searchLower) {
        const haystack = `${crewMember.name} ${crewMember.professional_role || ''} ${crewMember.skills.join(' ')}`.toLowerCase();
        if (!haystack.includes(searchLower)) return false;
      }
      return true;
    });
  }, [crewMembers, search, availability]);

  function clearFilters() {
    setSearch('');
    setAvailability('');
  }

  return (
    <div className="krew-public-page">
      <PublicNav />

      <section className="krew-browse-hero">
        <p className="krew-home-section-label">Hire Crew</p>
        <h1>Nairobi's event crew, with a real track record.</h1>
        <p className="krew-browse-hero-sub">
          Every person here set up their own profile - no filler bios, no invented reviews. See their role, their
          skills and how many jobs they've actually completed and gotten paid for before you reach out.
        </p>
      </section>

      <section className="krew-browse-toolbar">
        <div className="krew-browse-search">
          <Search size={17} strokeWidth={1.75} className="krew-browse-search-icon" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, role or skill"
            aria-label="Search crew members"
          />
        </div>

        <select
          className="krew-field-input krew-browse-select"
          value={availability}
          onChange={(e) => setAvailability(e.target.value)}
          aria-label="Filter by availability"
        >
          <option value="">Any availability</option>
          <option value="available">Available</option>
          <option value="working">Currently working</option>
        </select>

        {(search || availability) && (
          <button type="button" className="krew-dash-text-btn" onClick={clearFilters}>Clear filters</button>
        )}
      </section>

      <section className="krew-browse-results">
        {error && <div className="krew-form-banner error">{error}</div>}

        {crewMembers === null && !error && <div className="krew-dash-loading-note">Loading crew members…</div>}

        {filtered && filtered.length === 0 && (
          <div className="krew-dash-empty">
            <p>No crew members match those filters right now.</p>
            <button type="button" className="krew-button-secondary" onClick={clearFilters} style={{ width: 'auto' }}>
              Clear filters
            </button>
          </div>
        )}

        {filtered && filtered.length > 0 && (
          <div className="krew-crew-grid">
            {filtered.map((crewMember) => (
              <Link to={`/crew/${crewMember.id}`} className="krew-crew-card" key={crewMember.id}>
                <div className="krew-crew-card-portrait">
                  {crewMember.profile_photo_path ? (
                    <img src={`/uploads/${crewMember.profile_photo_path}`} alt="" />
                  ) : (
                    <div className="krew-crew-card-portrait-placeholder">
                      <UserIcon size={32} strokeWidth={1.5} />
                    </div>
                  )}
                  <span className={`krew-status-pill ${crewMember.availability_status === 'available' ? 'confirmed' : 'pending'} krew-crew-card-availability`}>
                    {crewMember.availability_status === 'available' ? 'Available' : 'Currently working'}
                  </span>
                </div>
                <div className="krew-crew-card-body">
                  <div className="krew-crew-card-name">{crewMember.name}</div>
                  {crewMember.professional_role && (
                    <div className="krew-crew-card-role">{crewMember.professional_role}</div>
                  )}
                  {crewMember.skills.length > 0 && (
                    <div className="krew-crew-card-skills">
                      {crewMember.skills.slice(0, 4).map((skill) => (
                        <span className="krew-crew-skill-chip" key={skill}>{skill}</span>
                      ))}
                      {crewMember.skills.length > 4 && (
                        <span className="krew-crew-skill-chip more">+{crewMember.skills.length - 4}</span>
                      )}
                    </div>
                  )}
                  <div className="krew-crew-card-record">{formatCrewRecord(crewMember)}</div>
                </div>
                <span className="krew-button-secondary krew-crew-card-cta">View profile</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <PublicFooter />
    </div>
  );
}