import { Link } from 'react-router-dom';

// This is the layout for the auth pages (login, register, etc). 
// It has a split screen with a visual on the left and the form on the right. 
// The visual is hidden on small screens, and the form takes up the full width. 
// The form is centered vertically and horizontally.

export default function AuthLayout({ children }) {
  return (
    <div className="krew-auth-split">
      <div className="krew-auth-visual" aria-hidden="true">
        <span className="krew-auth-shape krew-auth-shape-1" />
        <span className="krew-auth-shape krew-auth-shape-2" />
        <span className="krew-auth-shape krew-auth-shape-3" />
        <div className="krew-auth-visual-content">
          <div className="krew-wordmark krew-wordmark-on-dark">
            KRE<span>W</span>
          </div>
          <p className="krew-auth-visual-tagline">Every payment logged. Every job on record.</p>
        </div>
      </div>

      <div className="krew-auth-form-panel">
        <Link to="/" className="krew-wordmark krew-auth-mobile-wordmark">
          KRE<span>W</span>
        </Link>
        {children}
      </div>
    </div>
  );
}