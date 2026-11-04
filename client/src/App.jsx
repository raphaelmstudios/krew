import { useState } from 'react';
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
// then wait for admin approval.
export default function App() {
  const [step, setStep] = useState('register');
  const [user, setUser] = useState(null);

  if (window.location.pathname === '/admin') {
    return <AdminGate />;
  }

  // Task d2-1: a logged-in home for organizers (and, later, crew members)
  // to actually reach the job form from, instead of only a bare URL.
  if (window.location.pathname === '/dashboard') {
    return (
      <RoleGate
        role={['organizer', 'crew_member']}
        loginHeading="Log in to KREW"
        loginSubhead="Sign in to post jobs and manage your account."
        forbiddenMessage="Admins don't have a dashboard yet — try /admin instead."
      >
        {({ user, onLogout }) => <Dashboard user={user} onLogout={onLogout} />}
      </RoleGate>
    );
  }

  // A plain login screen for anyone coming back after registering, rather
  // than only ever logging in by accident on their way into /dashboard.
  if (window.location.pathname === '/login') {
    return (
      <Login
        heading="Log in to KREW"
        subhead="Sign in to post jobs and manage your account."
        onLoggedIn={() => window.location.assign('/dashboard')}
      />
    );
  }

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
          Already approved? <a href="/login">Log in</a>.
        </p>
      </div>
    </div>
  );
}