import { Link } from 'react-router-dom';
import PublicNav from '../components/PublicNav.jsx';

// The Privacy Policy page is a public-facing page that explains what information KREW collects, what's shown publicly, and what stays private. 
// The page also provides a link to the Terms of Service for further information.

export default function Privacy() {
  return (
    <div className="krew-public-page">
      <PublicNav />

      <div className="krew-legal-wrap">
        <p className="krew-home-section-label">Legal</p>
        <h1 className="krew-legal-title">Privacy Policy</h1>
        <p className="krew-legal-updated">Last updated November 2026</p>

        <div className="krew-legal-body">
          <p>
            This page explains what information KREW collects, what's shown publicly, and what stays private. KREW is
            a student project, still being built, and this policy will be updated as it grows.
          </p>

          <h2>What we collect</h2>
          <p>
            When you create an account: your name, phone number, and a password (stored as a hash, never in plain
            text). When you verify your identity: a photo of your ID document and a selfie. If you're a crew member
            and choose to fill them in: a profile photo, your professional role, and a list of skills. When you use
            the job board: the listings you post or apply to, and, once a job is paid, each side's confirmation of
            the amount and date.
          </p>

          <h2>What's public</h2>
          <p>
            Anyone, including visitors without an account, can see: open job listings (title, category, location,
            amount, due date, description, and the organizer's name); crew profiles on Hire Crew (name, profile
            photo if you've added one, professional role, skills, and self-reported availability); and a reliability
            summary for both organizers and crew members - how many jobs they've completed and, for organizers, what
            percentage were paid on time. That summary is calculated from payment confirmations, not shown as raw
            transaction data.
          </p>

          <h2>What's private</h2>
          <p>
            Your phone number, your password, and your ID document and selfie are never shown publicly. The ID
            document and selfie are only ever visible to an admin reviewing your account for approval, and are stored
            outside the app's public file directory so they can't be reached by URL. The specific amount you confirm
            for a given job, and who you've applied to or been hired by, are also private - only the two people
            involved in that job, and admins handling a dispute, can see them.
          </p>

          <h2>How we use it</h2>
          <p>
            To verify accounts before they can post, apply, or be hired. To show your public profile or listings to
            the people you're trying to reach. To calculate and display the reliability stats described above. To
            keep you signed in between visits. KREW doesn't sell your information or share it with anyone outside the
            app.
          </p>

          <h2>Your choices</h2>
          <p>
            Crew members can update or remove their profile photo, professional role, skills, and availability status
            at any time from their dashboard. Since KREW doesn't yet have a self-service way to delete an account or
            export your data, reach out directly if you need that done.
          </p>

          <h2>Children's privacy</h2>
          <p>KREW is for people old enough to take on paid event and gig work, and isn't intended for children.</p>

          <h2>Changes to this policy</h2>
          <p>
            This policy may change as KREW develops. The "last updated" date at the top of this page reflects the
            most recent version.
          </p>
        </div>

        <p className="krew-legal-footer-link">
          See also KREW's <Link to="/terms">Terms of Service</Link>.
        </p>
      </div>

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