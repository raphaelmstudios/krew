import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, SlidersHorizontal, LayoutGrid, List as ListIcon } from 'lucide-react';
import PublicNav from '../components/PublicNav.jsx';
import PublicFooter from '../components/PublicFooter.jsx';
import InfoTooltip from '../components/InfoTooltip.jsx';

// The public, editorial opportunity-discovery page.
// Anyone can browse and search open listings without an account.
const LISTING_CATEGORIES = [
  'Bar Service',
  'Catering',
  'Security',
  'Event Setup & Teardown',
  'Ushering & Guest Services',
  'Photography & Videography',
  'Sound & AV',
  'Other',
];

// Formats the organizer's record for display in the listing, with a small info icon explaining what it means.
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

function truncate(text, max) {
  if (!text || text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
}

// The Find Work page is a public-facing page that allows users to browse and search for open job listings.
// It fetches the listings from the server, applies filters based on user input, and displays the results in either a list or grid view.
// The page includes a search bar, category filter, location filter, and advanced filters for minimum/maximum amount and due date.

export default function FindWork() {
  const [listings, setListings] = useState(null);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [dueBefore, setDueBefore] = useState('');
  const [view, setView] = useState('list'); // list | grid

  useEffect(() => {
    fetch('/api/job-listings/public')
      .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) {
          setError(data.error || 'Could not load open gigs.');
          return;
        }
        setListings(data);
      })
      .catch(() => setError('Could not reach the server.'));
  }, []);

  const filtered = useMemo(() => {
    if (!listings) return null;
    const searchLower = search.trim().toLowerCase();

    return listings.filter((listing) => {
      if (category && listing.category !== category) return false;
      if (location.trim() && !(listing.location || '').toLowerCase().includes(location.trim().toLowerCase())) {
        return false;
      }
      if (minAmount && Number(listing.amount) < Number(minAmount)) return false;
      if (maxAmount && Number(listing.amount) > Number(maxAmount)) return false;
      if (dueBefore && new Date(listing.due_date) > new Date(dueBefore)) return false;
      if (searchLower) {
        const haystack = `${listing.title || ''} ${listing.job_description || ''}`.toLowerCase();
        if (!haystack.includes(searchLower)) return false;
      }
      return true;
    });
  }, [listings, search, category, location, minAmount, maxAmount, dueBefore]);

  function clearFilters() {
    setSearch('');
    setCategory('');
    setLocation('');
    setMinAmount('');
    setMaxAmount('');
    setDueBefore('');
  }

  const hasAdvancedFilters = minAmount || maxAmount || dueBefore;

  return (
    <div className="krew-public-page">
      <PublicNav />

      <section className="krew-browse-hero">
        <p className="krew-home-section-label">Find Work</p>
        <h1>Open gigs across Nairobi, posted by real organizers.</h1>
        <p className="krew-browse-hero-sub">
          Every listing here is a real, open job - no placeholders, no filler. See the amount, the date and the
          organizer's payment record before you apply.
        </p>
      </section>

      <section className="krew-browse-toolbar">
        <div className="krew-browse-search">
          <Search size={17} strokeWidth={1.75} className="krew-browse-search-icon" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or description"
            aria-label="Search open gigs"
          />
        </div>

        <select
          className="krew-field-input krew-browse-select"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Filter by category"
        >
          <option value="">All categories</option>
          {LISTING_CATEGORIES.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>

        <input
          type="text"
          className="krew-field-input krew-browse-select"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Location"
          aria-label="Filter by location"
        />

        <button
          type="button"
          className="krew-browse-advanced-toggle"
          onClick={() => setShowAdvanced((current) => !current)}
        >
          <SlidersHorizontal size={15} strokeWidth={1.75} />
          More filters{hasAdvancedFilters ? ' ·' : ''}
        </button>

        <div className="krew-dash-tabs krew-browse-view-toggle">
          <button
            type="button"
            className={`krew-dash-tab ${view === 'list' ? 'active' : ''}`}
            onClick={() => setView('list')}
            aria-label="List view"
          >
            <ListIcon size={15} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className={`krew-dash-tab ${view === 'grid' ? 'active' : ''}`}
            onClick={() => setView('grid')}
            aria-label="Grid view"
          >
            <LayoutGrid size={15} strokeWidth={1.75} />
          </button>
        </div>
      </section>

      {showAdvanced && (
        <section className="krew-browse-advanced-panel">
          <div className="krew-field">
            <label className="krew-field-label" htmlFor="min-amount">Min amount (KES)</label>
            <input
              id="min-amount"
              type="number"
              min="0"
              className="krew-field-input"
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
            />
          </div>
          <div className="krew-field">
            <label className="krew-field-label" htmlFor="max-amount">Max amount (KES)</label>
            <input
              id="max-amount"
              type="number"
              min="0"
              className="krew-field-input"
              value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value)}
            />
          </div>
          <div className="krew-field">
            <label className="krew-field-label" htmlFor="due-before">Due before</label>
            <input
              id="due-before"
              type="date"
              className="krew-field-input"
              value={dueBefore}
              onChange={(e) => setDueBefore(e.target.value)}
            />
          </div>
          <button type="button" className="krew-dash-text-btn" onClick={clearFilters}>Clear all filters</button>
        </section>
      )}

      <section className="krew-browse-results">
        {error && <div className="krew-form-banner error">{error}</div>}

        {listings === null && !error && <div className="krew-dash-loading-note">Loading open gigs…</div>}

        {filtered && filtered.length === 0 && (
          <div className="krew-dash-empty">
            <p>No open gigs match those filters right now.</p>
            <button type="button" className="krew-button-secondary" onClick={clearFilters} style={{ width: 'auto' }}>
              Clear filters
            </button>
          </div>
        )}

        {filtered && filtered.length > 0 && (
          <div className={view === 'grid' ? 'krew-browse-grid' : 'krew-job-list'}>
            {filtered.map((listing) => (
              <Link to={`/gigs/${listing.id}`} className={`krew-job-card krew-browse-card ${view}`} key={listing.id}>
                <div className="krew-job-card-main">
                  <div className="krew-job-card-crew">{listing.title || 'Untitled listing'}</div>
                  <div className="krew-job-card-meta">
                    {listing.organizer_name} · {formatOrganizerRecord(listing.organizer_record)}
                  </div>
                  <div className="krew-job-card-meta">
                    {listing.category}{listing.category && listing.location ? ' · ' : ''}{listing.location}
                  </div>
                  {listing.job_description && (
                    <div className="krew-job-card-desc">{truncate(listing.job_description, 140)}</div>
                  )}
                  <div className="krew-job-card-meta">
                    Due {new Date(listing.due_date).toLocaleDateString()}
                  </div>
                </div>
                <div className="krew-job-card-side">
                  <div className="krew-job-card-amount">KES {Number(listing.amount).toLocaleString()}</div>
                  <span className="krew-button-primary krew-dash-post-btn krew-browse-card-cta">View &amp; Apply</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <PublicFooter />
    </div>
  );
}