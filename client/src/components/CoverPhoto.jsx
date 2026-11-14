import { useEffect, useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';

// The wide cover photo behind a crew member's name on their public profile.
// Uploading and removing it is shared by the profile page itself (a "Change cover" button on
// the banner, for the profile's owner) and the Profile section of the crew dashboard.
// With loadCurrent, the current cover is fetched from the account on mount, since the
// details a dashboard was first loaded with go stale once the cover changes elsewhere.
export function useCoverPhoto(initialPath, { loadCurrent = false } = {}) {
  const [coverPath, setCoverPath] = useState(initialPath ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!loadCurrent) return undefined;
    let cancelled = false;
    fetch('/api/auth/me')
      .then((response) => (response.ok ? response.json() : null))
      .then((me) => {
        if (!cancelled && me) setCoverPath(me.cover_photo_path ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [loadCurrent]);

  async function upload(file) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('cover_photo', file);
      const response = await fetch('/api/users/me/cover', { method: 'POST', body: formData });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Could not upload your cover photo.');
        return;
      }
      setCoverPath(data.cover_photo_path);
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/users/me/cover', { method: 'DELETE' });
      if (!response.ok) {
        setError('Could not remove your cover photo.');
        return;
      }
      setCoverPath(null);
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  }

  return { coverPath, setCoverPath, upload, remove, busy, error };
}

// The "Change cover" control: a button that opens the file picker. Styled by the caller
// (className), so it can sit on the dark profile banner or in a dashboard card.
export function CoverPhotoButton({ cover, className, id = 'cover-photo-input', label }) {
  return (
    <label htmlFor={id} className={className} aria-disabled={cover.busy || undefined}>
      <ImagePlus size={16} strokeWidth={1.75} aria-hidden="true" />
      {cover.busy ? 'Uploading…' : label || (cover.coverPath ? 'Change cover' : 'Add cover photo')}
      <input
        id={id}
        type="file"
        accept="image/jpeg,image/png"
        className="krew-visually-hidden"
        disabled={cover.busy}
        onChange={(event) => {
          cover.upload(event.target.files[0]);
          event.target.value = '';
        }}
      />
    </label>
  );
}

// The dashboard version: a preview of the banner with change and remove buttons.
export function CoverPhotoCard({ cover, fallbackPath }) {
  const shown = cover.coverPath || fallbackPath;
  return (
    <section className="krew-db-card">
      <div className="krew-db-card-head">
        <h2>Cover photo</h2>
      </div>
      <p className="krew-db-card-sub">
        The wide banner behind your name on your public profile. A landscape photo of you at work looks best.
        {!cover.coverPath && fallbackPath ? ' Until you add one, your first portfolio photo is used.' : ''}
      </p>
      {cover.error && <div className="krew-form-banner error">{cover.error}</div>}
      <div className={`krew-cover-preview ${shown ? '' : 'empty'}`} style={shown ? { backgroundImage: `url('/uploads/${shown}')` } : undefined}>
        <span className="krew-shard krew-cover-preview-shard" aria-hidden="true" />
        <div className="krew-cover-preview-actions">
          <CoverPhotoButton cover={cover} id="dashboard-cover-input" className="krew-cp-hero-btn primary" />
          {cover.coverPath && (
            <button type="button" className="krew-cp-hero-btn" onClick={cover.remove} disabled={cover.busy}>
              <Trash2 size={16} strokeWidth={1.75} aria-hidden="true" /> Remove
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
