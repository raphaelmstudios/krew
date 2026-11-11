import { Link } from 'react-router-dom';
import Logo from './Logo.jsx';

// Footer shared by every public page - the dark plum brand band from the visual identity:
// light logo, the tagline, legal/help links, and the diagonal brand shards on the right.
export default function PublicFooter() {
  return (
    <footer className="krew-public-footer">
      <span className="krew-footer-shard krew-footer-shard-1" aria-hidden="true" />
      <span className="krew-footer-shard krew-footer-shard-2" aria-hidden="true" />
      <div className="krew-public-footer-inner">
        <div className="krew-footer-brand">
          <Logo tone="light" className="krew-footer-logo" />
          <span className="krew-footer-divider" aria-hidden="true" />
          <span className="krew-footer-tagline">Create. Collaborate. Grow.</span>
        </div>
        <div className="krew-footer-meta">
          <div className="krew-public-footer-links">
            <Link to="/faq">FAQ</Link>
            <Link to="/terms">Terms of Service</Link>
            <Link to="/privacy">Privacy Policy</Link>
          </div>
          <span className="krew-footer-copy">© {new Date().getFullYear()} KREW</span>
        </div>
      </div>
    </footer>
  );
}
