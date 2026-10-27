import { useState } from 'react';

// This is an ID and selfie upload form that is used in the KREW identity verification flow. 
// It is used in the IDUpload.jsx page, which is shown to users after they register and log in for the first time. 
// The form allows users to upload a photo of their ID and a selfie, which are then sent to the server for verification.
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // must match server/src/routes/documents.js

export default function IDUpload({ user, onSubmitted }) {
  const [idDocument, setIdDocument] = useState(null);
  const [selfie, setSelfie] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  function pickFile(setter) {
    return (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setError('Each file must be smaller than 5MB.');
        return;
      }
      setError(null);
      setter(file);
    };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!idDocument || !selfie) {
      setError('Please choose both a photo of your ID and a selfie.');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('idDocument', idDocument);
      formData.append('selfie', selfie);

      const response = await fetch(`/api/users/${user.id}/documents`, {
        method: 'POST',
        body: formData, // No Content-Type header here on purpose — the
        // browser sets it itself, including the boundary marker multipart
        // form data needs, which we can't easily reproduce by hand.
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Something went wrong. Please try again.');
        return;
      }

      onSubmitted && onSubmitted(data);
    } catch (err) {
      setError('Could not reach the server. Check your connection and try again.');
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
        <h1 className="krew-headline">Verify your identity</h1>
        <p className="krew-subhead">
          Hi {user.name}, almost done. Upload a clear photo of your ID and a selfie so we can confirm it's really you.
        </p>
      </div>

      <div className="krew-card">
        {error && <div className="krew-form-banner error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="krew-field">
            <label className="krew-field-label" htmlFor="id-document">ID Document (JPG, PNG, or PDF)</label>
            <label htmlFor="id-document" className={`krew-upload-box ${idDocument ? 'has-file' : ''}`}>
              <div className="krew-upload-icon">🪪</div>
              {idDocument ? (
                <div className="krew-upload-filename">{idDocument.name}</div>
              ) : (
                <div className="krew-upload-hint">Tap to choose a file</div>
              )}
              <input
                id="id-document"
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                onChange={pickFile(setIdDocument)}
              />
            </label>
          </div>

          <div className="krew-field">
            <label className="krew-field-label" htmlFor="selfie">Selfie (JPG or PNG)</label>
            <label htmlFor="selfie" className={`krew-upload-box ${selfie ? 'has-file' : ''}`}>
              <div className="krew-upload-icon">🤳</div>
              {selfie ? (
                <div className="krew-upload-filename">{selfie.name}</div>
              ) : (
                <div className="krew-upload-hint">Tap to choose a file</div>
              )}
              <input id="selfie" type="file" accept="image/jpeg,image/png" onChange={pickFile(setSelfie)} />
            </label>
          </div>

          <button type="submit" className="krew-button-primary" disabled={submitting}>
            {submitting ? 'Uploading…' : 'Submit for Review'}
          </button>
        </form>

        <div className="krew-fine-print">
          Your documents are only used to verify your identity and are never shared publicly.
        </div>
      </div>
    </div>
  );
}