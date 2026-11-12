import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, HandCoins, Fingerprint, ScrollText } from 'lucide-react';
import PublicNav from '../components/PublicNav.jsx';
import PublicFooter from '../components/PublicFooter.jsx';
import usePageMeta from '../usePageMeta.js';
import { PAGE_META } from '../pageMeta.js';

// The homepage itself, which is a single-page scroll with multiple sections, laid out to match
// the moodboard's Homepage panel: the hero with a photo cut on a diagonal on the right, "The
// people behind events" with two staggered photos, then How It Works, the reputation band,
// the two sign-up cards, and the shared footer.
//
// Photos are slots, not hardcoded images - each one looks for a file in client/public/images/home/
// (see PHOTOS below). Until that file exists the slot just shows the brand's plum panel with the
// diagonal shards, so nothing looks broken while the photos are still being designed.
// Each photo also has a focus point (CSS background-position) so its subject stays in frame
// when the slot crops it - e.g. the portrait-shaped "people" slots only show a slice of a
// landscape photo, so the focus is pushed toward where the person actually is.
const PHOTOS = {
  hero: { src: '/images/home/hero.webp', focus: '30% 20%' },
  people1: { src: '/images/home/people-1.webp', focus: '90% center' },
  people2: { src: '/images/home/people-2.webp', focus: '85% center' },
  crewCard: { src: '/images/home/crew-card.webp', focus: 'center 62%' },
  organizerCard: { src: '/images/home/organizer-card.webp', focus: 'center 30%' },
};

// Photos below the fold are only fetched when they're about to scroll into view (300px
// early) - the hero passes eager so it starts loading straight away. Until then the slot
// shows its plum background, same as when a photo is missing.
function PhotoSlot({ photo, className = '', label, eager = false }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(eager);

  useEffect(() => {
    if (visible || !ref.current) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '300px' }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <div
      ref={ref}
      className={`krew-photo-slot ${className}`}
      style={{ backgroundImage: visible ? `url('${photo.src}')` : undefined, backgroundPosition: photo.focus }}
      role="img"
      aria-label={label}
    />
  );
}

export default function Home() {
  usePageMeta(PAGE_META['/']);
  const location = useLocation();

  // Coming from another page's "About" / "How It Works" nav link lands on /#about etc. -
  // scroll to that section once the page has drawn, since the router doesn't do it itself.
  useEffect(() => {
    if (location.hash) {
      document.querySelector(location.hash)?.scrollIntoView();
    }
  }, [location.hash]);

  return (
    <div className="krew-public-page">
      <PublicNav />

      <section className="krew-hero">
        <div className="krew-hero-inner">
          <div className="krew-hero-copy">
            <h1>
              Every great moment has a <em>crew</em> behind it.
            </h1>
            <span className="krew-hero-rule" aria-hidden="true" />
            <p className="krew-hero-sub">
              Find skilled event crew or land paid gigs in Nairobi - with every payment tracked until it's confirmed.
            </p>
            <div className="krew-hero-ctas">
              <Link to="/find-work" className="krew-button-primary krew-button-inline">
                Find Work <ArrowRight size={16} strokeWidth={2} />
              </Link>
              <Link to="/hire-crew" className="krew-button-secondary krew-button-inline">
                Hire Crew <ArrowRight size={16} strokeWidth={2} />
              </Link>
            </div>
          </div>
        </div>

        <div className="krew-hero-visual">
          <PhotoSlot photo={PHOTOS.hero} className="krew-hero-photo" label="Musicians performing on stage" eager />
          <span className="krew-shard krew-hero-shard-1" aria-hidden="true" />
          <span className="krew-shard krew-hero-shard-2" aria-hidden="true" />
          <span className="krew-shard krew-hero-shard-3" aria-hidden="true" />
        </div>
      </section>

      <section id="about" className="krew-home-people">
        <div className="krew-home-people-copy">
          <h2>The people behind events.</h2>
          <p>
            From concerts to conferences, KREW powers creativity. Bartenders, security, ushers, photographers and
            sound engineers - the crew most guests never notice - finally get a proper place to find paid work, and
            organizers get a place to find them.
          </p>
          <a href="#how-it-works" className="krew-text-link">
            Learn More <ArrowRight size={15} strokeWidth={2} />
          </a>
        </div>
        <div className="krew-home-people-photos">
          <PhotoSlot photo={PHOTOS.people1} className="krew-home-people-photo first" label="Sound technician at a control desk" />
          <PhotoSlot photo={PHOTOS.people2} className="krew-home-people-photo second" label="Lighting technician adjusting a stage light" />
        </div>
      </section>

      <section id="how-it-works" className="krew-home-section">
        <p className="krew-home-section-label">How It Works</p>
        <h2>Organizers post the job. Crew apply. Both sides see each other's track record first.</h2>
        <p className="krew-home-section-body">
          An organizer posts an open listing with the amount, the date and what the job actually involves, or hires
          someone directly from the crew directory. Crew members browse open listings or set themselves as available
          to be hired. Either way, nobody has to commit blind - an organizer's on-time payment record and a crew
          member's completed job count are both visible before anyone agrees to anything.
        </p>

        <div className="krew-home-trust-grid">
          <div className="krew-trust-card light">
            <HandCoins className="krew-trust-icon" size={38} strokeWidth={1.3} aria-hidden="true" />
            <h3>Real payment records</h3>
            <p>
              Every job agreement is logged. Once both sides confirm a payment, it becomes part of that organizer's
              on-time record - an actual history of whether people got paid when they were supposed to.
            </p>
            <span className="krew-trust-notch"><span className="krew-trust-tag">01 · Payments</span></span>
          </div>
          <div className="krew-trust-card accent">
            <span className="krew-trust-rings" aria-hidden="true" />
            <Fingerprint className="krew-trust-icon" size={38} strokeWidth={1.3} aria-hidden="true" />
            <h3>Verified identities</h3>
            <p>
              Every account - organizer or crew - goes through ID verification before they can post a job, apply to
              one, or get hired. KREW doesn't let unverified accounts transact.
            </p>
            <span className="krew-trust-notch"><span className="krew-trust-tag">02 · Identity</span></span>
          </div>
          <div className="krew-trust-card dark">
            <span className="krew-shard krew-trust-shard" aria-hidden="true" />
            <ScrollText className="krew-trust-icon" size={38} strokeWidth={1.3} aria-hidden="true" />
            <h3>A paper trail if something goes wrong</h3>
            <p>
              If a payment doesn't match what was agreed, either side can flag it. Disputes are reviewed, not just
              left to argue out in a group chat after the event is over.
            </p>
            <span className="krew-trust-notch"><span className="krew-trust-tag">03 · Disputes</span></span>
          </div>
        </div>
      </section>

      <section className="krew-home-band">
        <span className="krew-shard krew-band-shard-1" aria-hidden="true" />
        <span className="krew-shard krew-band-shard-2" aria-hidden="true" />
        <div className="krew-home-band-inner">
          <p className="krew-home-section-label">Professional reputation</p>
          <h2>
            Your work history follows you, not just your <em>word</em>.
          </h2>
          <p>
            A crew member's completed-jobs count and an organizer's on-time payment percentage are both calculated from
            confirmed transactions - not reviews, not star ratings, nothing either side can write themselves. The more
            jobs you complete on KREW, the more that record speaks for you.
          </p>
        </div>
      </section>

      <section className="krew-home-section">
        <div className="krew-home-cta-split">
          <div className="krew-home-cta-card crew">
            <PhotoSlot photo={PHOTOS.crewCard} className="krew-home-cta-photo" label="Performer on stage with a live band" />
            <div className="krew-home-cta-body">
              <h3>Looking for work</h3>
              <p>
                Browse open gigs across bar service, security, event setup, ushering, photography and more - or set
                yourself as available and let organizers come to you.
              </p>
              <div className="krew-home-cta-actions">
                <Link to="/register" className="krew-button-primary krew-button-inline">
                  Create a crew account <ArrowRight size={16} strokeWidth={2} />
                </Link>
                <Link to="/find-work" className="krew-text-link on-dark">
                  Browse open gigs first <ArrowRight size={15} strokeWidth={2} />
                </Link>
              </div>
            </div>
          </div>
          <div className="krew-home-cta-card organizer">
            <PhotoSlot photo={PHOTOS.organizerCard} className="krew-home-cta-photo" label="DJ at the decks" />
            <div className="krew-home-cta-body">
              <h3>Need to hire crew</h3>
              <p>
                Post a job and let crew apply, or hire someone directly from the crew directory - complete with their
                real completed-jobs record.
              </p>
              <div className="krew-home-cta-actions">
                <Link to="/register" className="krew-button-primary krew-button-inline">
                  Create an organizer account <ArrowRight size={16} strokeWidth={2} />
                </Link>
                <Link to="/hire-crew" className="krew-text-link">
                  Browse crew first <ArrowRight size={15} strokeWidth={2} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}