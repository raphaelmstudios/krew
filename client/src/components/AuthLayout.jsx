import Logo from './Logo.jsx';
import ThemeToggle from './ThemeToggle.jsx';

// This is the layout for the auth pages (login, register, etc).
// It has a split screen with the form on the left and a photo on the right.
// The logo and theme switch sit at the top of the form side, and the form itself is
// left-aligned in a narrow column with plenty of breathing room.
// The photo is hidden on small screens, and the form takes up the full width.

export default function AuthLayout({ children }) {
  return (
    <div className="krew-auth-split">
      <div className="krew-auth-form-panel">
        <div className="krew-auth-topbar">
          <Logo />
          <ThemeToggle />
        </div>
        <div className="krew-auth-form-inner">{children}</div>
      </div>

      <div className="krew-auth-visual" aria-hidden="true">
        <div className="krew-auth-photo" style={{ backgroundImage: "url('/images/auth/login-register.jpg')" }} />
        <span className="krew-auth-scrim" />
        <span className="krew-auth-shape krew-auth-shape-1" />
        <span className="krew-auth-shape krew-auth-shape-2" />
        <div className="krew-auth-visual-content">
          <p className="krew-auth-visual-tagline">Every payment logged. Every job on record.</p>
        </div>
      </div>
    </div>
  );
}
