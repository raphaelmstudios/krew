import { useState } from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import Register from './pages/Register.jsx';
import IDUpload from './pages/IDUpload.jsx';
import AdminGate from './pages/AdminGate.jsx';
import RoleGate from './pages/RoleGate.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Login from './pages/Login.jsx';
import './styles/forms.css';
import './styles/admin.css';
import './styles/dashboard.css';

// The sign-up flow is three small steps: register, then verify identity,
// then wait for admin approval. Pulled out into its own component so it can
// be the route for both "/" and any URL that doesn't match anything else
// below - that second part matches how this worked before the router was
// added, when every unrecognised path fell through to this same flow.
function RegisterFlow() {
  const [step, setStep] = useState('register');
  const [user, setUser] = useState(null);

  if (step === 'register') {
    return (
      <Register
        onRegistered={(createdUser) => {
          setUser(createdUser);
          setStep('upload');
        }}
      />
    );
  }

  if (step === 'upload') {
    return (
      <IDUpload
        user={user}
        onSubmitted={() => setStep('submitted')}
      />
    );
  }

  // This confirmation page is shown after the user has submitted their documents and is waiting for admin approval.
  // It does not require any further action from the user.
  return (
    <div className="krew-auth-page">
      <div className="krew-wordmark">
        KRE<span>W</span>
      </div>
      <div className="krew-card" style={{ textAlign: 'center' }}>
        <div className="krew-headline" style={{ marginBottom: 8 }}>You're all set, {user.name}</div>
        <p className="krew-subhead">
          Your documents were received and your account is pending admin approval. We'll notify you once it's reviewed.
        </p>
        <p className="krew-fine-print" style={{ marginTop: 20 }}>
          Already approved? <Link to="/login">Log in</Link>.
        </p>
      </div>
    </div>
  );
}

// A plain login screen for anyone coming back after registering, rather than
// only ever logging in by accident on their way into /dashboard. Its own
// small component just so it can call useNavigate() - that hook only works
// inside a component that's actually rendered under the router.
function LoginRoute() {
  const navigate = useNavigate();
  return (
    <Login
      heading="Log in to KREW"
      subhead="Sign in to post jobs and manage your account."
      onLoggedIn={() => navigate('/dashboard')}
    />
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />

      {/* Task d2-1: a logged-in home for organizers (and, later, crew
          members) to actually reach the job form from, instead of only a
          bare URL. */}
      <Route
        path="/dashboard"
        element={
          <RoleGate
            role={['organizer', 'crew_member']}
            loginHeading="Log in to KREW"
            loginSubhead="Sign in to post jobs and manage your account."
            forbiddenMessage="Admins don't have a dashboard yet — try /admin instead."
          >
            {({ user, onLogout }) => <Dashboard user={user} onLogout={onLogout} />}
          </RoleGate>
        }
      />

      <Route path="/admin" element={<AdminGate />} />

      <Route path="/" element={<RegisterFlow />} />
      <Route path="*" element={<RegisterFlow />} />
    </Routes>
  );
}