import { Link } from 'react-router-dom';
import PublicNav from '../components/PublicNav.jsx';

// The Terms of Service page is a public-facing page that outlines the rules and guidelines for using the KREW platform.
// It includes sections on what KREW is and isn't, account verification, browsing without an account, acceptable use, and disclaimers about warranties and liabilities.
// The page also provides a link to the Privacy Policy for further information.

export default function Terms() {
  return (
    <div className="krew-public-page">
      <PublicNav />

      <div className="krew-legal-wrap">
        <p className="krew-home-section-label">Legal</p>
        <h1 className="krew-legal-title">Terms of Service</h1>
        <p className="krew-legal-updated">Last updated November 2026</p>

        <div className="krew-legal-body">
          <p>
            KREW is a student project built as part of an ALU Software Engineering course, connecting event and gig
            organizers in Nairobi with bar staff, security, ushers, photographers, setup crews and other crew
            members. These terms explain what you can expect when you use it. Because KREW is still being built, this
            page will change as the product does.
          </p>

          <h2>What KREW is and isn't</h2>
          <p>
            KREW helps organizers find crew and helps crew find work, and keeps a record of who paid and got paid on
            time. KREW does not process, hold, or transfer money. When an organizer and a crew member work together,
            payment happens directly between them - by cash, mobile money, or however they agree. Afterwards, each
            side confirms on KREW what was paid and when, and KREW uses that to calculate the completed-job counts and
            on-time percentages shown on public profiles and listings. KREW is not a party to any payment, and isn't
            responsible for a payment that doesn't happen as agreed - though a confirmed mismatch or a no-show is
            exactly the kind of thing the reliability record is there to surface.
          </p>

          <h2>Accounts and verification</h2>
          <p>
            Organizers and crew members both create an account with a phone number and password, and upload an ID
            document and a selfie as part of signing up. An admin reviews this before the account is approved -
            posting a paid listing, applying to one, or being hired directly all require an approved account. You're
            responsible for keeping your login details to yourself and for the accuracy of what you submit, including
            your ID documents.
          </p>

          <h2>Browsing without an account</h2>
          <p>
            Anyone can browse open gigs on Find Work and crew profiles on Hire Crew without creating an account. You
            only need to sign up when you want to actually apply, hire, or post a listing.
          </p>

          <h2>What you post</h2>
          <p>
            Job listings, your professional role, your skills, and your profile photo (for crew members) are shown
            publicly once you add them. Keep them accurate - a listing's title, category, location, amount and due
            date are what crew members are applying to, and a crew profile's role and skills are what organizers are
            hiring based on. Don't post anything false, misleading, or for work that isn't real.
          </p>

          <h2>Acceptable use</h2>
          <p>
            Use KREW to find and offer real event and gig work. Don't use it to defraud another user, misrepresent who
            you are, post fake listings or fake completed work, or try to get around the verification process. An
            admin can suspend or remove an account that does any of this.
          </p>

          <h2>No warranty</h2>
          <p>
            KREW is provided as-is, as an in-progress student project. It doesn't come with a guarantee that it will
            be available, error-free, or fit for any particular purpose, and KREW isn't liable for disputes between
            organizers and crew members, including disputes about payment, no-shows, or the quality of work. Use your
            own judgment when agreeing to and carrying out paid work with someone you meet through KREW.
          </p>

          <h2>Changes to these terms</h2>
          <p>
            These terms may change as KREW develops. The "last updated" date at the top of this page reflects the
            most recent version.
          </p>
        </div>

        <p className="krew-legal-footer-link">
          See also KREW's <Link to="/privacy">Privacy Policy</Link>.
        </p>
      </div>

      <footer className="krew-public-footer">
        <div className="krew-public-footer-inner">
          <span>© {new Date().getFullYear()} KREW</span>
          <div className="krew-public-footer-links">
            <Link to="/faq">FAQ</Link>
            <Link to="/terms">Terms of Service</Link>
            <Link to="/privacy">Privacy Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}