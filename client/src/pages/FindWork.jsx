import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, MapPin, CalendarDays, ArrowRight, SlidersHorizontal, X } from 'lucide-react';
import PublicNav from '../components/PublicNav.jsx';
import PublicFooter from '../components/PublicFooter.jsx';
import InfoTooltip from '../components/InfoTooltip.jsx';
import ListingPhoto from '../components/ListingPhoto.jsx';
import usePageMeta from '../usePageMeta.js';
import { PAGE_META } from '../pageMeta.js';
import SkeletonCards from '../components/SkeletonCards.jsx';
import AmountInput from '../components/AmountInput.jsx';

// The public Find Work page, laid out like the moodboard's Find Work panel: a hero with a
// big search bar, a filter sidebar (category, location, date, pay), category tabs with
// counts above the results, and photo-led listing cards. Anyone can browse without an
// account; applying happens on the gig page and still needs an approved crew account.
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

const DATE_OPTIONS = [
  { value: 'any', label: 'Any time' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
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

function formatDate(value) {
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// True if the due date falls within the next 7 / 30 days (today included).
function withinDays(value, days) {
  const due = new Date(value);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + days);
  return due >= start && due <= end;
}

export default function FindWork() {
  usePageMeta(PAGE_META['/find-work']);
  const [listings, setListings] = useState(null);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [categories, setCategories] = useState([]); // empty = all
  const [location, setLocation] = useState(''); // empty = any
  const [dateRange, setDateRange] = useState('any');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false); // phone only - the sidebar is always open on desktop
  const resultsRef = useRef(null);

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

  // The location options come from the listings themselves (most common first), since
  // location is free text an organizer types rather than a fixed list.
  const locationOptions = useMemo(() => {
    if (!listings) return [];
    const counts = new Map();
    listings.forEach((listing) => {
      const name = (listing.location || '').trim();
      if (name) counts.set(name, (counts.get(name) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name]) => name);
  }, [listings]);

  // Everything except the category filter - the tabs' counts are worked out from this, so
  // each tab says how many gigs you'd see if you picked it.
  const matchingExceptCategory = useMemo(() => {
    if (!listings) return null;
    const searchLower = search.trim().toLowerCase();
    return listings.filter((listing) => {
      if (location && (listing.location || '').trim() !== location) return false;
      if (dateRange === 'week' && !withinDays(listing.due_date, 7)) return false;
      if (dateRange === 'month' && !withinDays(listing.due_date, 30)) return false;
      if (minAmount && Number(listing.amount) < Number(minAmount)) return false;
      if (maxAmount && Number(listing.amount) > Number(maxAmount)) return false;
      if (searchLower) {
        const haystack = `${listing.title || ''} ${listing.job_description || ''} ${listing.category || ''} ${listing.location || ''}`.toLowerCase();
        if (!haystack.includes(searchLower)) return false;
      }
      return true;
    });
  }, [listings, search, location, dateRange, minAmount, maxAmount]);

  const filtered = useMemo(() => {
    if (!matchingExceptCategory) return null;
    if (categories.length === 0) return matchingExceptCategory;
    return matchingExceptCategory.filter((listing) => categories.includes(listing.category));
  }, [matchingExceptCategory, categories]);

  // Tabs: "All Gigs" plus every category that has at least one matching gig right now.
  const tabs = useMemo(() => {
    if (!matchingExceptCategory) return [];
    return LISTING_CATEGORIES.map((name) => ({
      name,
      count: matchingExceptCategory.filter((listing) => listing.category === name).length,
    })).filter((tab) => tab.count > 0);
  }, [matchingExceptCategory]);

  function toggleCategory(name) {
    setCategories((current) => (current.includes(name) ? current.filter((c) => c !== name) : [...current, name]));
  }

  function clearFilters() {
    setSearch('');
    setCategories([]);
    setLocation('');
    setDateRange('any');
    setMinAmount('');
    setMaxAmount('');
  }

  function handleSearchSubmit(e) {
    e.preventDefault();
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const activeFilterCount =
    categories.length + (location ? 1 : 0) + (dateRange !== 'any' ? 1 : 0) + (minAmount || maxAmount ? 1 : 0);

  return (
    <div className="krew-public-page">
      <PublicNav />

      <section className="krew-fw-hero">
        <div className="krew-fw-hero-inner">
          <div className="krew-fw-hero-copy" data-reveal-children>
            <p className="krew-home-section-label">Open gigs in Nairobi</p>
            <h1>Find Work</h1>
            <p className="krew-fw-hero-sub">
              Discover paid event work - with the organizer's real payment record on every listing.
            </p>
            <form className="krew-fw-search" onSubmit={handleSearchSubmit} role="search">
              <Search size={19} strokeWidth={1.75} className="krew-fw-search-icon" aria-hidden="true" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search for gigs..."
                aria-label="Search open gigs"
              />
              <button type="submit" className="krew-fw-search-btn" aria-label="Show results">
                <Search size={18} strokeWidth={2} />
              </button>
            </form>
          </div>
        </div>
        <div className="krew-fw-hero-visual" aria-hidden="true">
          {/* Borrows the homepage's crew photo until Find Work gets its own (save it as images/find-work/hero.webp and point this at it) */}
          <div
            className="krew-photo-slot krew-fw-hero-photo"
            style={{ backgroundImage: "url('/images/home/crew-card.webp')" }}
          />
          <span className="krew-shard krew-fw-hero-shard-1" />
          <span className="krew-shard krew-fw-hero-shard-2" />
        </div>
      </section>

      <section className="krew-fw-body" ref={resultsRef}>
        <button
          type="button"
          className="krew-fw-filters-toggle"
          onClick={() => setFiltersOpen((current) => !current)}
          aria-expanded={filtersOpen}
        >
          {filtersOpen ? <X size={16} strokeWidth={1.75} /> : <SlidersHorizontal size={16} strokeWidth={1.75} />}
          Filters{activeFilterCount ? ` (${activeFilterCount})` : ''}
        </button>

        <aside className={`krew-fw-filters ${filtersOpen ? 'open' : ''}`} aria-label="Filters">
          <div className="krew-fw-filters-head">
            <h2>Filters</h2>
            {activeFilterCount > 0 && (
              <button type="button" className="krew-dash-text-btn" onClick={clearFilters}>Clear all</button>
            )}
          </div>

          <fieldset className="krew-fw-filter-group">
            <legend>Category</legend>
            {LISTING_CATEGORIES.map((name) => (
              <label className="krew-fw-check" key={name}>
                <input type="checkbox" checked={categories.includes(name)} onChange={() => toggleCategory(name)} />
                <span className="krew-fw-check-box" aria-hidden="true" />
                {name}
              </label>
            ))}
          </fieldset>

          <fieldset className="krew-fw-filter-group">
            <legend>Location</legend>
            <label className="krew-fw-check radio">
              <input type="radio" name="fw-location" checked={location === ''} onChange={() => setLocation('')} />
              <span className="krew-fw-check-box" aria-hidden="true" />
              Any location
            </label>
            {locationOptions.map((name) => (
              <label className="krew-fw-check radio" key={name}>
                <input type="radio" name="fw-location" checked={location === name} onChange={() => setLocation(name)} />
                <span className="krew-fw-check-box" aria-hidden="true" />
                {name}
              </label>
            ))}
          </fieldset>

          <fieldset className="krew-fw-filter-group">
            <legend>Due date</legend>
            {DATE_OPTIONS.map((option) => (
              <label className="krew-fw-check radio" key={option.value}>
                <input
                  type="radio"
                  name="fw-date"
                  checked={dateRange === option.value}
                  onChange={() => setDateRange(option.value)}
                />
                <span className="krew-fw-check-box" aria-hidden="true" />
                {option.label}
              </label>
            ))}
          </fieldset>

          <fieldset className="krew-fw-filter-group">
            <legend>Pay (KES)</legend>
            <div className="krew-fw-pay">
              <AmountInput
                className="krew-field-input"
                value={minAmount}
                onValueChange={setMinAmount}
                placeholder="Min"
                aria-label="Minimum pay in KES"
              />
              <span aria-hidden="true">-</span>
              <AmountInput
                className="krew-field-input"
                value={maxAmount}
                onValueChange={setMaxAmount}
                placeholder="Max"
                aria-label="Maximum pay in KES"
              />
            </div>
          </fieldset>
        </aside>

        <div className="krew-fw-results">
          {listings && (
            <div className="krew-fw-tabs" role="tablist" aria-label="Categories">
              <button
                type="button"
                role="tab"
                aria-selected={categories.length === 0}
                className={`krew-fw-tab ${categories.length === 0 ? 'active' : ''}`}
                onClick={() => setCategories([])}
              >
                All Gigs <span>({matchingExceptCategory.length})</span>
              </button>
              {tabs.map((tab) => {
                const active = categories.length === 1 && categories[0] === tab.name;
                return (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={active}
                    key={tab.name}
                    className={`krew-fw-tab ${active ? 'active' : ''}`}
                    onClick={() => setCategories([tab.name])}
                  >
                    {tab.name} <span>({tab.count})</span>
                  </button>
                );
              })}
            </div>
          )}

          {error && <div className="krew-form-banner error">{error}</div>}

          {listings === null && !error && <SkeletonCards count={3} label="Loading open gigs…" />}

          {filtered && filtered.length === 0 && (
            <div className="krew-dash-empty">
              <p>{listings.length === 0 ? 'No open gigs right now - check back soon.' : 'No open gigs match those filters right now.'}</p>
              {listings.length > 0 ? (
                <button type="button" className="krew-button-secondary krew-button-inline" onClick={clearFilters}>
                  Clear filters
                </button>
              ) : (
                <Link to="/register" className="krew-button-primary krew-button-inline">
                  Create a crew profile so organizers can find you
                </Link>
              )}
            </div>
          )}

          {filtered && filtered.length > 0 && (
            <div className="krew-fw-list" data-reveal-children>
              {filtered.map((listing) => (
                <Link to={`/gigs/${listing.id}`} className="krew-fw-card" key={listing.id}>
                  <ListingPhoto listing={listing} className="krew-fw-card-photo" />
                  <div className="krew-fw-card-body">
                    <div className="krew-fw-card-top">
                      <h3>{listing.title || 'Untitled listing'}</h3>
                      <div className="krew-fw-card-amount">KES {Number(listing.amount).toLocaleString()}</div>
                    </div>
                    <div className="krew-fw-card-meta">
                      <span><MapPin size={14} strokeWidth={1.75} /> {listing.location}</span>
                      <span><CalendarDays size={14} strokeWidth={1.75} /> Due {formatDate(listing.due_date)}</span>
                    </div>
                    <div className="krew-fw-card-org">
                      {listing.organizer_name} · {formatOrganizerRecord(listing.organizer_record)}
                    </div>
                    <div className="krew-fw-card-bottom">
                      {listing.category && <span className="krew-fw-tag">{listing.category}</span>}
                      <span className="krew-button-primary krew-button-inline krew-fw-card-cta">
                        Apply Now <ArrowRight size={15} strokeWidth={2} />
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
