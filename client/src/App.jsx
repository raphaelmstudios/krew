import { useState } from 'react';
import Register from './pages/Register.jsx';
import IDUpload from './pages/IDUpload.jsx';
import './styles/forms.css';

// The sign-up flow is three small steps: register, then verify identity,
// then wait for admin approval. `step` tracks which one we're on, and
// `user` holds the account created in step one so step two knows whose
// documents it's uploading. There's no routing library yet, so this is
// just plain state — a real set of page URLs can replace this later
// without changing how Register or IDUpload themselves work.
export default function App() {
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

  // Task d1-6 builds the real "pending admin approval" screen and the
  // admin-side toggle to approve it. For now this is just a plain
  // confirmation that the documents made it to the server.
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