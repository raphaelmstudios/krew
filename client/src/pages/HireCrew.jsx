import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import PublicNav from '../components/PublicNav.jsx';
import PublicFooter from '../components/PublicFooter.jsx';
import CrewCard from '../components/CrewCard.jsx';
import usePageMeta from '../usePageMeta.js';
import { PAGE_META } from '../pageMeta.js';
import SkeletonCards from '../components/SkeletonCards.jsx';

// The public Hire Crew page, laid out like the moodboard's Hire Crew panel: a hero with the
// headline, a search bar and a portrait photo on the right, then a grid of photo-led crew
// cards. Every profile here was set up by the crew member themselves - no filler bios, no
// invented reviews - and the completed-jobs count comes from confirmed payments.

const AVAILABILITY_TABS = [
  { value: '', label: 'Everyone' },
  { value: 'available', label: 'Available now' },
  { value: 'working', label: 'Currently working' },
];

export default function HireCrew() {
  usePageMeta(PAGE_META['/hire-crew']);
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

  // Search applies first, so each availability tab can show how many people it would leave.
  const matchingSearch = useMemo(() => {
    if (!crewMembers) return null;
    const searchLower = search.trim().toLowerCase();
    if (!searchLower) return crewMembers;
    return crewMembers.filter((crewMember) => {
      const haystack = `${crewMember.name} ${crewMember.professional_role || ''} ${crewMember.skills.join(' ')}`.toLowerCase();
      return haystack.includes(searchLower);
    });
  }, [crewMembers, search]);

  const filtered = useMemo(() => {
    if (!matchingSearch) return null;
    if (!availability) return matchingSearch;
    return matchingSearch.filter((crewMember) => crewMember.availability_status === availability);
  }, [matchingSearch, availability]);

  function countFor(value) {
    if (!matchingSearch) return 0;
    return value ? matchingSearch.filter((crewMember) => crewMember.availability_status === value).length : matchingSearch.length;
  }

  function clearFilters() {
    setSearch('');
    setAvailability('');
  }

  return (
    <div className="krew-public-page">
      <PublicNav />

      <section className="krew-hc-hero">
        <div className="krew-hc-hero-inner">
          <div className="krew-hc-hero-copy">
            <p className="krew-home-section-label">Nairobi's event crew</p>
            <h1>
              Hire the right <em>crew for your next project.</em>
            </h1>
            <p className="krew-hc-hero-sub">
              Explore talented professionals across Nairobi - each with a real record of completed, paid jobs.
            </p>
            <div className="krew-hc-search">
              <Search size={19} strokeWidth={1.75} className="krew-hc-search-icon" aria-hidden="true" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by skill or role..."
                aria-label="Search crew members by name, role or skill"
              />
            </div>
          </div>
        </div>
        <div className="krew-hc-hero-visual" aria-hidden="true">
          {/* Borrows the homepage's organizer photo until Hire Crew gets its own (save it as images/hire-crew/hero.webp and point this at it) */}
          <div
            className="krew-photo-slot krew-hc-hero-photo"
            style={{ backgroundImage: "url('/images/home/organizer-card.webp')" }}
          />
          <span className="krew-shard krew-hc-hero-shard-1" />
          <span className="krew-shard krew-hc-hero-shard-2" />
        </div>
      </section>

      <section className="krew-hc-body">
        {crewMembers && (
          <div className="krew-fw-tabs" role="tablist" aria-label="Availability">
            {AVAILABILITY_TABS.map((tab) => (
              <button
                type="button"
                role="tab"
                key={tab.value || 'all'}
                aria-selected={availability === tab.value}
                className={`krew-fw-tab ${availability === tab.value ? 'active' : ''}`}
                onClick={() => setAvailability(tab.value)}
              >
                {tab.label} <span>({countFor(tab.value)})</span>
              </button>
            ))}
          </div>
        )}

        {error && <div className="krew-form-banner error">{error}</div>}

        {crewMembers === null && !error && <SkeletonCards count={3} label="Loading crew members…" variant="grid" />}

        {filtered && filtered.length === 0 && (
          <div className="krew-dash-empty">
            <p>{crewMembers.length === 0 ? 'No crew members are listed yet - check back soon.' : 'No crew members match that search right now.'}</p>
            {crewMembers.length > 0 ? (
              <button type="button" className="krew-button-secondary krew-button-inline" onClick={clearFilters}>
                Clear search
              </button>
            ) : (
              <Link to="/dashboard?section=post" className="krew-button-primary krew-button-inline">
                Post a gig and let crew apply
              </Link>
            )}
          </div>
        )}

        {filtered && filtered.length > 0 && (
          <div className="krew-hc-grid">
            {filtered.map((crewMember) => (
              <CrewCard crewMember={crewMember} key={crewMember.id} />
            ))}
          </div>
        )}
      </section>

      <PublicFooter />
    </div>
  );
}
