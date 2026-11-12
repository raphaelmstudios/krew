import { Link } from 'react-router-dom';
import PublicNav from '../components/PublicNav.jsx';
import PublicFooter from '../components/PublicFooter.jsx';
import usePageMeta from '../usePageMeta.js';
import { PAGE_META } from '../pageMeta.js';

// The Privacy Policy page - what KREW stores about people, why, and who can see each part.
// Written from what the code actually does (server/src/routes/* and db.js), not from a
// template: if a feature changes what's stored or shown, this page has to change with it.
// (Until the pre-launch review this route showed a copy of the Terms page by mistake.)

export default function Privacy() {
  usePageMeta(PAGE_META['/privacy']);

  return (
    <div className="krew-public-page">
      <PublicNav />

      <div className="krew-legal-wrap">
        <p className="krew-home-section-label">Legal</p>
        <h1 className="krew-legal-title">Privacy Policy</h1>
        <p className="krew-legal-updated">Last updated November 2026</p>

        <div className="krew-legal-body">
          <p>
            KREW is a student project built as part of an ALU Software Engineering course. It connects event
            organizers in Nairobi with crew, and keeps a record of payments both sides confirm. This page explains
            what KREW stores about you, why, and who can see it. KREW aims to handle personal data in line with
            Kenya's Data Protection Act, 2019.
          </p>

          <h2>What you give us when you sign up</h2>
          <p>
            Your name, phone number, a password and whether you're an organizer or crew. Your password is never
            stored as you typed it - only a one-way scrambled version (a bcrypt hash) that can check a login but
            can't be turned back into the password.
          </p>

          <h2>Your ID and selfie</h2>
          <p>
            To get approved you upload a photo of your ID and a selfie. They are used for one thing: so a KREW admin
            can check you are who you say you are. They are never shown on your profile, never shared with
            organizers or crew, and can only be opened by a logged-in KREW admin. They're kept while your account
            exists; uploading new ones replaces the old files.
          </p>

          <h2>What's public</h2>
          <p>
            Anyone, logged in or not, can see what's on a crew profile and on open gigs:
          </p>
          <ul>
            <li>
              <strong>Crew:</strong> name, profile photo, professional role, skills, years of experience, bio,
              portfolio photos, availability, completed-job count and verified work history. Work history shows a
              gig's public title, category and month - never the amount, the organizer, or the private job
              description.
            </li>
            <li>
              <strong>Organizers:</strong> your name on gigs you post, and your payment record - how many jobs you've
              paid and had confirmed, the share paid on time, and how early or late payments typically are.
            </li>
          </ul>
          <p>Phone numbers are never shown publicly. Only you and KREW admins see yours.</p>

          <h2>What only the people involved see</h2>
          <p>
            A job's amount, due date, description and both sides' payment confirmations are visible only to the
            organizer and crew member on that job, and to KREW admins. If a dispute is raised, its reason and
            details are shared with the other person on the job and with admins, who use them to settle it.
          </p>

          <h2>How the numbers are worked out</h2>
          <p>
            Completed-job counts and on-time percentages are calculated automatically from payments both sides
            confirmed. Nobody types them in, and nobody can edit them. A disputed job is left out until an admin
            settles it.
          </p>

          <h2>Cookies and storage on your device</h2>
          <p>
            KREW uses one cookie, and only to keep you logged in. It can't be read by the page's own code and
            expires after 7 days or when you log out. Your browser also remembers your light or dark theme, whether
            you closed the survey banner, and which payment confirmations you've already seen. KREW uses no
            advertising or tracking cookies and no analytics.
          </p>

          <h2>Other services involved</h2>
          <ul>
            <li>
              <strong>Hosting:</strong> KREW's server, database and uploaded photos are hosted on Render.
            </li>
            <li>
              <strong>Fonts:</strong> the typefaces load from Google Fonts, so Google's servers see your IP address
              when a page loads.
            </li>
            <li>
              <strong>Pilot survey:</strong> the feedback survey is a Google Form. Opening it is optional, and
              Google's own privacy terms apply to what you enter there.
            </li>
            <li>
              <strong>Payments:</strong> KREW doesn't process, hold or move money, so it never sees your M-Pesa or
              bank details.
            </li>
          </ul>

          <h2>Your choices</h2>
          <p>
            You can change your profile, photos, availability and password at any time from your dashboard. If you
            forget your password, a KREW admin calls the phone number on your account to confirm it's you before
            giving you a one-time reset code - your number is used for nothing else.
          </p>

          <h2>Changes to this policy</h2>
          <p>
            This policy will change as KREW develops. The "last updated" date at the top reflects the most recent
            version.
          </p>
        </div>

        <p className="krew-legal-footer-link">
          See also KREW's <Link to="/terms">Terms of Service</Link>.
        </p>
      </div>

      <PublicFooter />
    </div>
  );
}
