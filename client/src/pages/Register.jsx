import { useState } from 'react';

//This is the sign up screen for new users. It collects the user's name, phone number, password, and role (organizer or crew member).
// Every check here also happens again on the server 
const PHONE_PATTERN = /^(?:\+?254|0)(7|1)\d{8}$/;

// `onRegistered` is called once the account is actually created, so the
// parent screen (App.jsx) can move on to the next step 
// without this component needing to know what that step is.
export default function Register({ onRegistered }) {
  const [role, setRole] = useState('organizer');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  //We show one error message per field, and we also show a banner for errors that aren't specific to one field (like "that phone number is already registered").
  const [fieldErrors, setFieldErrors] = useState({});

  // A banner to show a single error or success message at the top of the form. 
  // This is for errors that aren't specific to one field, like "that phone number is already registered".
  const [banner, setBanner] = useState(null); // { type: 'error' | 'success', text: '...' }

  const [submitting, setSubmitting] = useState(false);

  // Once the account is created, we show a message and a button to continue to the next step (ID verification).
  const [createdUser, setCreatedUser] = useState(null);

  // Checks the form the same way the server will. Returns an object of
  // field -> message for anything wrong, empty object if everything is fine.
  function validate() {
    const errors = {};
    if (!name.trim()) {
      errors.name = 'Name is required.';
    }
    if (!phone.trim() || !PHONE_PATTERN.test(phone.trim())) {
      errors.phone = 'Enter a valid Kenyan phone number, e.g. 0712345678.';
    }
    if (!password || password.length < 8) {
      errors.password = 'Password must be at least 8 characters.';
    }
    return errors;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setBanner(null);

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim(), password, role }),
      });
      const data = await response.json();

      if (!response.ok) {
        // The server sends back one error message as `data.error`. 
        // Show it in the banner rather than guessing which field it belongs to.
        setBanner({ type: 'error', text: data.error || 'Something went wrong. Please try again.' });
        return;
      }

      setCreatedUser(data);
    } catch (err) {
      // fetch itself throws when there's no network connection at all.
      setBanner({ type: 'error', text: 'Could not reach the server. Check your connection and try again.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="krew-auth-page">
      <div className="krew-wordmark">
        KRE<span>W</span>
      </div>

      <div className="krew-headline-wrap">
        <h1 className="krew-headline">Create your account</h1>
        <p className="krew-subhead">Join as an organizer to post jobs, or as crew to get hired and paid on time.</p>
      </div>

      <div className="krew-card">
        {createdUser ? (
          <>
            <div className="krew-form-banner success">
              Account created, {createdUser.name}. Next, we need a photo of your ID and a selfie to verify it's really you.
            </div>
            <button
              type="button"
              className="krew-button-primary"
              onClick={() => onRegistered && onRegistered(createdUser)}
            >
              Continue to ID Verification
            </button>
          </>
        ) : (
          <>
            {banner && <div className={`krew-form-banner ${banner.type}`}>{banner.text}</div>}

            <form onSubmit={handleSubmit}>
              <div className="krew-role-toggle">
                <button
                  type="button"
                  className={`krew-role-option ${role === 'organizer' ? 'selected' : ''}`}
                  onClick={() => setRole('organizer')}
                >
                  I'm an Organizer
                </button>
                <button
                  type="button"
                  className={`krew-role-option ${role === 'crew_member' ? 'selected' : ''}`}
                  onClick={() => setRole('crew_member')}
                >
                  I'm Crew
                </button>
              </div>

              <div className="krew-field">
                <label className="krew-field-label" htmlFor="name">Full Name</label>
                <input
                  id="name"
                  type="text"
                  className={`krew-field-input ${fieldErrors.name ? 'has-error' : ''}`}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Wanjiru Kamau"
                />
                {fieldErrors.name && <div className="krew-field-error">{fieldErrors.name}</div>}
              </div>

              <div className="krew-field">
                <label className="krew-field-label" htmlFor="phone">Phone Number</label>
                <input
                  id="phone"
                  type="tel"
                  className={`krew-field-input ${fieldErrors.phone ? 'has-error' : ''}`}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0712345678"
                />
                {fieldErrors.phone && <div className="krew-field-error">{fieldErrors.phone}</div>}
              </div>

              <div className="krew-field">
                <label className="krew-field-label" htmlFor="password">Password</label>
                <input
                  id="password"
                  type="password"
                  className={`krew-field-input ${fieldErrors.password ? 'has-error' : ''}`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                />
                {fieldErrors.password && <div className="krew-field-error">{fieldErrors.password}</div>}
              </div>

              <button type="submit" className="krew-button-primary" disabled={submitting}>
                {submitting ? 'Creating account…' : 'Create Account'}
              </button>
            </form>

            <div className="krew-fine-print">
              By creating an account you agree to KREW's Terms of Service and Privacy Policy.
            </div>
          </>
        )}
      </div>
    </div>
  );
}