import { Link } from 'react-router-dom';
import PublicNav from '../components/PublicNav.jsx';

// The homepage itself, which is a single-page scroll with multiple sections.
// Each section has a label, a heading, and a body. Some sections have a grid
// of cards or a split layout with two cards side by side. The hero section at the top has a large heading, a subheading, and two call-to-action buttons, along with an image on the right. 
// The footer has links and copyright information.

export default function Home() {
  return (
    <div className="krew-public-page">
      <PublicNav />

      <section className="krew-home-hero">
        <div className="krew-home-hero-copy">
          <h1>Every great moment has a crew behind it.</h1>
          <p className="krew-home-hero-sub">
            KREW connects organizers with the bar staff, security, ushers, photographers and setup crews who make
            events happen in Nairobi - and makes sure everyone actually gets paid what was agreed, on time.
          </p>
          <div className="krew-home-hero-ctas">
            <Link to="/find-work" className="krew-button-primary krew-public-nav-btn">Find Work</Link>
            <Link to="/hire-crew" className="krew-button-secondary krew-public-nav-btn">Hire Crew</Link>
          </div>
        </div>
        <div className="krew-home-hero-visual" aria-hidden="true">
          <span className="krew-home-hero-shape krew-home-hero-shape-1" />
          <span className="krew-home-hero-shape krew-home-hero-shape-2" />
        </div>
      </section>

      <section id="about" className="krew-home-section">
        <p className="krew-home-section-label">The people behind events</p>
        <h2>Bartenders, security, ushers, photographers, sound engineers - the crew most guests never notice.</h2>
        <p className="krew-home-section-body">
          Every wedding, launch party and corporate event in Nairobi runs on short-term, skilled work - the kind that's
          usually arranged through a chain of phone calls, group chats and favors owed. KREW gives that work a proper
          home: a place where organizers can find vetted crew, and crew can find paid work, without either side having
          to go in on trust alone.
        </p>
      </section>

      <section id="how-it-works" className="krew-home-section alt">
        <p className="krew-home-section-label">How It Works</p>
        <h2>Organizers post the job. Crew apply. Both sides see each other's track record first.</h2>
        <p className="krew-home-section-body">
          An organizer posts an open listing with the amount, the date and what the job actually involves, or hires
          someone directly from the crew directory. Crew members browse open listings or set themselves as available
          to be hired. Either way, nobody has to commit blind - an organizer's on-time payment record and a crew
          member's completed job count are both visible before anyone agrees to anything.
        </p>

        <div className="krew-home-trust-grid">
          <div className="krew-home-trust-card">
            <h3>Real payment records</h3>
            <p>
              Every job agreement is logged. Once both sides confirm a payment, it becomes part of that organizer's
              on-time record - not a self-reported star rating, an actual history of whether people got paid when they
              were supposed to.
            </p>
          </div>
          <div className="krew-home-trust-card">
            <h3>Verified identities</h3>
            <p>
              Every account - organizer or crew - goes through ID verification before they can post a job, apply to
              one, or get hired. KREW doesn't let unverified accounts transact.
            </p>
          </div>
          <div className="krew-home-trust-card">
            <h3>A paper trail if something goes wrong</h3>
            <p>
              If a payment doesn't match what was agreed, either side can flag it. Disputes are reviewed, not just
              left to argue out in a group chat after the event is over.
            </p>
          </div>
        </div>
      </section>

      <section className="krew-home-section">
        <p className="krew-home-section-label">Professional reputation</p>
        <h2>Your work history follows you, not just your word.</h2>
        <p className="krew-home-section-body">
          A crew member's completed-jobs count and an organizer's on-time payment percentage are both calculated from
          confirmed transactions - not reviews, not star ratings, nothing either side can write themselves. The more
          jobs you complete on KREW, the more that record speaks for you the next time someone's deciding whether to
          hire or apply.
        </p>
      </section>

      <section className="krew-home-section alt">
        <div className="krew-home-cta-split">
          <div className="krew-home-cta-card crew">
            <h3>Looking for work</h3>
            <p>
              Browse open gigs across bar service, security, event setup, ushering, photography and more - or set
              yourself as available and let organizers come to you.
            </p>
            <Link to="/register" className="krew-button-primary">Create a crew account</Link>
            <Link to="/find-work" className="krew-dash-text-btn" style={{ color: 'var(--color-soft-violet)' }}>
              Browse open gigs first →
            </Link>
          </div>
          <div className="krew-home-cta-card organizer">
            <h3>Need to hire crew</h3>
            <p>
              Post a job and let crew apply, or hire someone directly from the crew directory - complete with their
              real completed-jobs record.
            </p>
            <Link to="/register" className="krew-button-primary">Create an organizer account</Link>
            <Link to="/hire-crew" className="krew-dash-text-btn">Browse crew first →</Link>
          </div>
        </div>
      </section>

      <footer className="krew-public-footer">
        <div className="krew-public-footer-inner">
          <span>© {new Date().getFullYear()} KREW</span>
          <div className="krew-public-footer-links">
            <Link to="/terms">Terms of Service</Link>
            <Link to="/privacy">Privacy Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}