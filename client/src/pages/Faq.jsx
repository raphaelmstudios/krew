import { Link } from 'react-router-dom';
import PublicNav from '../components/PublicNav.jsx';
import PublicFooter from '../components/PublicFooter.jsx';

// This page provides answers to frequently asked questions about KREW, including explanations of terms like "New here", "on time" percentage, "completed jobs", and "verified". 
// It also explains how payment confirmation works, how to file a dispute, and what information is visible to other users. 
// The page includes links to the Terms of Service and Privacy Policy for further details.
export default function Faq() {
  return (
    <div className="krew-public-page">
      <PublicNav />

      <div className="krew-legal-wrap">
        <p className="krew-home-section-label">Help</p>
        <h1 className="krew-legal-title">Frequently asked questions</h1>

        <div className="krew-legal-body">
          <h2>Why does a new account say "New here" instead of 0?</h2>
          <p>
            Every organizer and crew member starts on KREW without a track record, since nobody has worked with them
            through the platform yet. "New here" instead of "0 completed jobs" or "0% on time" is just KREW being
            upfront that there's no history yet, rather than making a brand new account look like it already failed
            at something. It isn't a flag against that person, and it changes automatically the moment their first
            job is confirmed as paid.
          </p>

          <h2>What does an organizer's "on time" percentage mean?</h2>
          <p>
            It's the share of an organizer's past jobs that were confirmed as paid by the agreed due date, out of
            every job they've had confirmed on KREW. It's calculated automatically from both sides' payment
            confirmations, not something an organizer fills in about themselves or that crew members rate them on -
            the same reasoning Privacy Policy describes for how these numbers are produced.
          </p>

          <h2>What does a crew member's "completed jobs" count mean?</h2>
          <p>
            The number of jobs a crew member has actually finished and had the payment for confirmed by both sides.
            An application that's still pending, or a job that's been agreed but not yet paid, doesn't count yet -
            only ones where both the organizer and the crew member have confirmed the amount.
          </p>

          <h2>What does "verified" mean on KREW?</h2>
          <p>
            Every account - organizer or crew member - submits an ID document and a selfie when they sign up, and an
            admin reviews and approves it before that account can post a job, apply to one, or be hired. An account
            that hasn't been approved yet can browse KREW but can't transact. Verified doesn't mean KREW has
            background-checked someone's history - it means a real admin has confirmed the ID they signed up with
            matches a real person.
          </p>

          <h2>How does payment confirmation work?</h2>
          <p>
            Once a job is agreed, either side can confirm it from their dashboard once the work is done: each side
            separately enters the amount they believe was paid. If both entries match, the job moves to "confirmed"
            and counts toward both people's track record. If they don't match, the job stays "pending" and the other
            person is notified, so either side can go back and fix a mistaken entry, or raise a dispute if they
            genuinely disagree about what was paid.
          </p>

          <h2>How do I file a dispute?</h2>
          <p>
            From your dashboard's job list, open the job in question and select "Raise a dispute" - this is
            available any time a job isn't already confirmed or already disputed. Describe what's wrong, and an admin
            will review it and resolve it from their side; both people on the job are notified once that happens.
            Filing a dispute doesn't block the other person's account - it just holds that one job open until an
            admin looks at it.
          </p>

          <h2>Who can see my reliability numbers?</h2>
          <p>
            Anyone browsing KREW can see the completed-jobs count and, for organizers, the on-time percentage - the
            same information shown on public listings and the crew directory. The actual amount paid on any given
            job, and your phone number, stay private. See the <Link to="/privacy">Privacy Policy</Link> for the full
            breakdown of what's public and what isn't.
          </p>
        </div>

        <p className="krew-legal-footer-link">
          Still stuck? See KREW's <Link to="/terms">Terms of Service</Link> and{' '}
          <Link to="/privacy">Privacy Policy</Link>.
        </p>
      </div>

      <PublicFooter />
    </div>
  );
}