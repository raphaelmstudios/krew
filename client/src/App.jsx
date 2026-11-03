import { useState } from 'react';
import Register from './pages/Register.jsx';
import IDUpload from './pages/IDUpload.jsx';
import AdminGate from './pages/AdminGate.jsx';
import './styles/forms.css';
import './styles/admin.css';

// The sign-up flow is three small steps: register, then verify identity,
// then wait for admin approval.
export default function App() {
  const [step, setStep] = useState('register');
  const [user, setUser] = useState(null);

  if (window.location.pathname === '/admin') {
    return <AdminGate />;
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
      </div>
    </div>
  );
}