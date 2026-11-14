import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Handshake,
  Pencil,
  Link2,
  Check,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import PublicNav from '../components/PublicNav.jsx';
import PublicFooter from '../components/PublicFooter.jsx';
import InfoTooltip from '../components/InfoTooltip.jsx';
import CrewCard, { initials } from '../components/CrewCard.jsx';
import { categoryIcon } from '../components/ListingPhoto.jsx';
import HireForm from './HireForm.jsx';
import { useCoverPhoto, CoverPhotoButton } from '../components/CoverPhoto.jsx';
import usePageMeta from '../usePageMeta.js';
import { PAGE_META, NOT_FOUND_META, crewMeta } from '../pageMeta.js';

// A crew member's public profile, full-screen rather than boxed: a full-width cover hero with
// the name, role and headline stats, a tall portrait card that overlaps the hero with the bio
// and skills under it, the portfolio (each photo opens full size) and their verified work
// history in the main column, and a "More crew" row at the bottom so it's easy to keep
// browsing without going back. The nav stays pinned at the top the whole way down.
// Read-only here - a crew member edits all of this from their own dashboard (CrewDashboard.jsx's "My profile" card), the same way a gig's organizer-side details are edited from the dashboard and only displayed on GigDetail.jsx. Linked to from HireCrew.jsx's directory cards.

const PORTFOLIO_PREVIEW_COUNT = 6;

function formatMonth(value) {
  // SQLite timestamps are UTC without a marker, plain due dates are YYYY-MM-DD - both parse fine this way.
  const date = new Date(value.includes(' ') ? `${value.replace(' ', 'T')}Z` : value);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}
const MORE_CREW_COUNT = 4;

function yearsLabel(years) {
  if (years === null || years === undefined) return null;
  return `${years}+ ${years === 1 ? 'year' : 'years'}`;
}

// Main component for displaying a crew member's public profile.
export default function CrewProfile() {
  const { id } = useParams();

  const [profile, setProfile] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(null);

  const [session, setSession] = useState(undefined); // undefined = still checking, null = logged out
  const [moreCrew, setMoreCrew] = useState([]);
  const [showAllPortfolio, setShowAllPortfolio] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null); // null = closed
  const [linkCopied, setLinkCopied] = useState(false);
  const [hireStep, setHireStep] = useState(null); // null = closed, 'form' = hiring, 'done' = hire created
  const cover = useCoverPhoto(null); // the owner can change their cover photo right here

  usePageMeta(profile ? crewMeta(profile) : notFound ? NOT_FOUND_META : PAGE_META['/hire-crew']);

  useEffect(() => {
    let cancelled = false;
    setProfile(null);
    setNotFound(false);
    setError(null);
    setShowAllPortfolio(false);
    setLightboxIndex(null);
    window.scrollTo(0, 0);
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
        cover.setCoverPath(data.cover_photo_path);
      })
      .catch(() => {
        if (!cancelled) setError('Could not reach the server.');
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // A few other crew members for the "More crew" row - available people first.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/users/crew-directory/public')
      .then((response) => (response.ok ? response.json() : []))
      .then((data) => {
        if (cancelled) return;
        const others = data.filter((crewMember) => String(crewMember.id) !== String(id));
        others.sort((a, b) => (a.availability_status === 'available' ? 0 : 1) - (b.availability_status === 'available' ? 0 : 1));
        setMoreCrew(others.slice(0, MORE_CREW_COUNT));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/session')
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled) setSession(data?.user ?? null);
      })
      .catch(() => {
        if (!cancelled) setSession(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // Clipboard blocked - nothing else to do, the address bar still has the link.
    }
  }

  const isOwnProfile = session && String(session.id) === String(id);
  // Hire straight from the profile (same direct hire as Find Crew in the organizer dashboard):
  // approved organizers get the form, organizers still waiting on approval see why they can't
  // yet, and anyone logged out is pointed at signing up. Crew and admins don't see it at all.
  const isOrganizer = session?.role === 'organizer';
  const canHire = isOrganizer && session.verification_status === 'approved';
  const showSignUpToHire = session === null;
  const portfolio = profile?.portfolio || [];
  const workHistory = profile?.work_history || [];
  const visiblePortfolio = showAllPortfolio ? portfolio : portfolio.slice(0, PORTFOLIO_PREVIEW_COUNT);
  // The banner uses the crew member's own cover photo, then their first portfolio photo, then
  // the plain plum brand panel.
  const coverImage = cover.coverPath || portfolio[0]?.image_path;
  const available = profile?.availability_status === 'available';

  if (!profile) {
    return (
      <div className="krew-public-page">
        <PublicNav />
        <div className="krew-cp-status">
          <Link to="/hire-crew" className="krew-gig-back-link">
            <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" /> Back to Hire Crew
          </Link>
          {error && <div className="krew-form-banner error">{error}</div>}
          {notFound && (
            <div className="krew-dash-empty">
              <p>This crew member isn't listed, or doesn't exist.</p>
              <Link to="/hire-crew" className="krew-button-secondary krew-button-inline">Browse crew</Link>
            </div>
          )}
          {!notFound && !error && <div className="krew-dash-loading-note" role="status">Loading profile…</div>}
        </div>
        <PublicFooter />
      </div>
    );
  }

  const firstName = profile.name.split(' ')[0];

  return (
    <div className="krew-public-page">
      <PublicNav />

      <section
        className={`krew-cp-hero ${coverImage ? '' : 'empty'}`}
        style={coverImage ? { backgroundImage: `url('/uploads/${coverImage}')` } : undefined}
      >
        <span className="krew-cp-hero-tint" aria-hidden="true" />
        <span className="krew-shard krew-cp-hero-shard-1" aria-hidden="true" />
        <span className="krew-shard krew-cp-hero-shard-2" aria-hidden="true" />

        <div className="krew-cp-hero-inner">
          <div className="krew-cp-hero-spacer" aria-hidden="true" />
          <div className="krew-cp-hero-copy">
            <Link to="/hire-crew" className="krew-cp-back">
              <ArrowLeft size={15} strokeWidth={2} /> Hire Crew
            </Link>
            <h1>{profile.name}</h1>
            <p className="krew-cp-hero-role">{profile.professional_role || 'Event crew'}</p>
            <ul className="krew-cp-hero-stats">
              {yearsLabel(profile.years_experience) && <li>{yearsLabel(profile.years_experience)} experience</li>}
              <li>
                {profile.confirmed_job_count
                  ? `${profile.confirmed_job_count} completed ${profile.confirmed_job_count === 1 ? 'gig' : 'gigs'}`
                  : 'New on KREW'}
                <InfoTooltip text="Completed gigs are jobs this crew member finished and had payment confirmed on KREW - worked out from confirmed payments, not self-reported." />
              </li>
              <li className={available ? 'available' : 'working'}>{available ? 'Available' : 'Currently working'}</li>
            </ul>
            <div className="krew-cp-hero-actions">
              {isOwnProfile && (
                <>
                  <Link to="/dashboard?section=profile" className="krew-cp-hero-btn primary">
                    <Pencil size={15} strokeWidth={2} /> Edit Profile
                  </Link>
                  <CoverPhotoButton cover={cover} className="krew-cp-hero-btn" />
                </>
              )}
              {canHire && (
                <button type="button" className="krew-cp-hero-btn primary" onClick={() => setHireStep('form')}>
                  <Handshake size={16} strokeWidth={1.75} /> Hire {profile.name.split(' ')[0]}
                </button>
              )}
              {isOrganizer && !canHire && (
                <span className="krew-cp-hero-btn disabled" title="You can hire once your account is approved.">
                  <Handshake size={16} strokeWidth={1.75} /> Hire after approval
                </span>
              )}
              {showSignUpToHire && (
                <Link to="/register" className="krew-cp-hero-btn primary">
                  <Handshake size={16} strokeWidth={1.75} /> Sign up to hire
                </Link>
              )}
              <button type="button" className="krew-cp-hero-btn" onClick={handleCopyLink}>
                {linkCopied ? <Check size={15} strokeWidth={2} /> : <Link2 size={15} strokeWidth={2} />}
                {linkCopied ? 'Link copied' : 'Copy profile link'}
              </button>
            </div>
            {isOwnProfile && cover.error && <div className="krew-form-banner error krew-cp-cover-error">{cover.error}</div>}
          </div>
        </div>
      </section>

      <div className="krew-cp-body">
        <aside className="krew-cp-side">
          <div className="krew-cp-portrait">
            {profile.profile_photo_path ? (
              <img src={`/uploads/${profile.profile_photo_path}`} alt={profile.name} />
            ) : (
              <div className="krew-cp-portrait-empty" aria-hidden="true">
                <span className="krew-shard krew-cp-portrait-shard" />
                <span>{initials(profile.name)}</span>
              </div>
            )}
          </div>
          <div className="krew-cp-about">
            <h2>About</h2>
            <p className={profile.bio ? '' : 'empty'}>{profile.bio || `${firstName} hasn't written a bio yet.`}</p>
            {profile.skills.length > 0 && (
              <>
                <h2 className="krew-cp-about-skills-title">Skills</h2>
                <div className="krew-cp-skills">
                  {profile.skills.map((skill) => (
                    <span className="krew-cp-skill" key={skill}>{skill}</span>
                  ))}
                </div>
              </>
            )}
          </div>
        </aside>

        <div className="krew-cp-main">
          <section className="krew-cp-block">
            <div className="krew-cp-block-head">
              <h2 className="krew-cp-section-title">Portfolio</h2>
              {portfolio.length > PORTFOLIO_PREVIEW_COUNT && (
                <button type="button" className="krew-text-link krew-cp-view-all" onClick={() => setShowAllPortfolio((v) => !v)}>
                  {showAllPortfolio ? 'Show less' : `View All (${portfolio.length})`} <ArrowRight size={15} strokeWidth={2} />
                </button>
              )}
            </div>
            {portfolio.length === 0 ? (
              <p className="krew-cp-empty">
                No portfolio photos yet.
                {isOwnProfile && (
                  <>
                    {' '}
                    <Link to="/dashboard?section=profile">Add your first photos</Link>
                  </>
                )}
              </p>
            ) : (
              <div className="krew-cp-portfolio-grid" data-reveal-children>
                {visiblePortfolio.map((image, index) => (
                  <button
                    type="button"
                    className="krew-cp-thumb"
                    key={image.id}
                    onClick={() => setLightboxIndex(index)}
                    aria-label={`Open portfolio photo ${index + 1} of ${portfolio.length}`}
                  >
                    <img src={`/uploads/${image.image_path}`} alt="" loading="lazy" decoding="async" />
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="krew-cp-block">
            <div className="krew-cp-block-head">
              <h2 className="krew-cp-section-title">
                Verified work history
                <InfoTooltip text="Every job here was paid and confirmed through KREW - nobody can add to this list by hand. The amount, the organizer and the job's private details are never shown." />
              </h2>
              {profile.confirmed_job_count > workHistory.length && (
                <span className="krew-cp-block-note">Latest {workHistory.length} of {profile.confirmed_job_count}</span>
              )}
            </div>
            {workHistory.length === 0 ? (
              <p className="krew-cp-empty">No confirmed jobs yet - every job {firstName} is paid for through KREW will show up here.</p>
            ) : (
              <ul className="krew-cp-history">
                {workHistory.map((job) => {
                  const Icon = job.title ? categoryIcon(job.category) : Handshake;
                  return (
                    <li className="krew-cp-history-row" key={job.id}>
                      <span className="krew-cp-history-icon"><Icon size={28} strokeWidth={1.25} aria-hidden="true" /></span>
                      <span className="krew-cp-history-title">
                        <strong>{job.title || 'Direct hire'}</strong>
                        <span>{job.title ? job.category : 'Hired directly by an organizer'}</span>
                      </span>
                      <span className="krew-cp-history-date">{formatMonth(job.confirmed_on)}</span>
                      <span className="krew-cp-history-badge">
                        <BadgeCheck size={17} strokeWidth={1.5} aria-hidden="true" /> Payment confirmed
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>

      {moreCrew.length > 0 && (
        <section className="krew-cp-more">
          <div className="krew-cp-block-head">
            <h2 className="krew-cp-section-title">More crew on KREW</h2>
            <Link to="/hire-crew" className="krew-text-link">
              Browse all crew <ArrowRight size={15} strokeWidth={2} />
            </Link>
          </div>
          <div className="krew-hc-grid" data-reveal-children>
            {moreCrew.map((crewMember) => (
              <CrewCard crewMember={crewMember} key={crewMember.id} />
            ))}
          </div>
        </section>
      )}

      {lightboxIndex !== null && portfolio.length > 0 && (
        <Lightbox
          images={portfolio}
          index={lightboxIndex}
          onChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
          name={profile.name}
        />
      )}

      {hireStep && (
        <HireDialog
          crewMember={{ id: profile.id, name: profile.name }}
          step={hireStep}
          onCreated={() => setHireStep('done')}
          onClose={() => setHireStep(null)}
        />
      )}

      <PublicFooter />
    </div>
  );
}

// Full-size portfolio viewer - arrows (or the keyboard's left/right) step through the photos,
// Esc or the X or a click on the backdrop closes it.
function Lightbox({ images, index, onChange, onClose, name }) {
  const closeRef = useRef(null);
  const count = images.length;

  const step = useCallback((delta) => onChange((index + delta + count) % count), [index, count, onChange]);

  useEffect(() => {
    closeRef.current?.focus();
    function handleKey(e) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    }
    document.addEventListener('keydown', handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, step]);

  return (
    <div className="krew-lightbox" role="dialog" aria-modal="true" aria-label={`${name}'s portfolio`} onClick={onClose}>
      <button type="button" className="krew-lightbox-close" onClick={onClose} ref={closeRef} aria-label="Close">
        <X size={22} strokeWidth={1.75} />
      </button>
      {count > 1 && (
        <button
          type="button"
          className="krew-lightbox-nav prev"
          onClick={(e) => {
            e.stopPropagation();
            step(-1);
          }}
          aria-label="Previous photo"
        >
          <ChevronLeft size={26} strokeWidth={1.75} />
        </button>
      )}
      <img
        src={`/uploads/${images[index].image_path}`}
        alt={`${name}'s portfolio photo ${index + 1} of ${count}`}
        className="krew-lightbox-image"
        onClick={(e) => e.stopPropagation()}
      />
      {count > 1 && (
        <button
          type="button"
          className="krew-lightbox-nav next"
          onClick={(e) => {
            e.stopPropagation();
            step(1);
          }}
          aria-label="Next photo"
        >
          <ChevronRight size={26} strokeWidth={1.75} />
        </button>
      )}
      <span className="krew-lightbox-count">{index + 1} / {count}</span>
    </div>
  );
}

// The hire form from the organizer dashboard, opened over the profile so the organizer doesn't
// lose their place. Once the hire goes through it says where the job now lives (Payments).
function HireDialog({ crewMember, step, onCreated, onClose }) {
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    document.body.classList.add('krew-modal-open');
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.classList.remove('krew-modal-open');
    };
  }, []);

  return (
    <div className="krew-moment-backdrop" onClick={onClose}>
      <div
        className="krew-cp-hire-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`Hire ${crewMember.name}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="krew-cp-hire-close" onClick={onClose} aria-label="Close">
          <X size={20} strokeWidth={1.75} />
        </button>
        {step === 'form' ? (
          <HireForm crewMember={crewMember} onCreated={onCreated} onCancel={onClose} />
        ) : (
          <div className="krew-cp-hire-done">
            <BadgeCheck size={44} strokeWidth={1.2} aria-hidden="true" />
            <h2>{crewMember.name.split(' ')[0]} is hired</h2>
            <p>
              The job is in your Payments. Once you've paid, confirm the amount there - when{' '}
              {crewMember.name.split(' ')[0]} confirms the same amount, it counts toward both of your records.
            </p>
            <div className="krew-cp-hire-done-actions">
              <Link to="/dashboard?section=payments" className="krew-button-primary krew-button-inline">
                Go to Payments <ArrowRight size={16} strokeWidth={2} />
              </Link>
              <button type="button" className="krew-button-secondary krew-button-inline" onClick={onClose}>
                Stay here
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
