import { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';

const MAX_BIO_LENGTH = 400;

// The organizer's public details, edited in the Profile section of their dashboard: a logo
// or photo, the events company or brand they hire under, and a short bio. Crew see all three
// on every gig the organizer posts (Find Work and the gig's Organizer tab), next to their
// payment record.
export default function OrganizerProfileForm({ user, photoPath, onPhotoChange }) {
  const [companyName, setCompanyName] = useState(user.company_name || '');
  const [bio, setBio] = useState(user.bio || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [banner, setBanner] = useState(null);

  // The account details passed in are from when the dashboard first loaded - fetch the
  // current ones, so coming back to this section after saving shows what was saved.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me')
      .then((response) => (response.ok ? response.json() : null))
      .then((me) => {
        if (cancelled || !me) return;
        setCompanyName(me.company_name || '');
        setBio(me.bio || '');
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function handlePhoto(event) {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    setUploading(true);
    setBanner(null);
    try {
      const formData = new FormData();
      formData.append('profile_photo', file);
      const response = await fetch('/api/users/me/photo', { method: 'POST', body: formData });
      const data = await response.json();
      if (!response.ok) {
        setBanner({ type: 'error', text: data.error || 'Could not upload your logo.' });
        return;
      }
      onPhotoChange(data.profile_photo_path);
    } catch {
      setBanner({ type: 'error', text: 'Could not reach the server.' });
    } finally {
      setUploading(false);
    }
  }

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);
    setBanner(null);
    try {
      const response = await fetch('/api/users/me/organizer-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_name: companyName, bio }),
      });
      const data = await response.json();
      if (!response.ok) {
        setBanner({ type: 'error', text: data.error || 'Could not save your profile.' });
        return;
      }
      setCompanyName(data.company_name || '');
      setBio(data.bio || '');
      setBanner({ type: 'success', text: 'Saved. Crew will see this on your gigs.' });
    } catch {
      setBanner({ type: 'error', text: 'Could not reach the server.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="krew-db-card">
      {banner && <div className={`krew-form-banner ${banner.type}`}>{banner.text}</div>}

      <div className="krew-dash-profile-top">
        <label htmlFor="organizer-photo-input" className="krew-dash-avatar">
          {photoPath ? (
            <img src={`/uploads/${photoPath}`} alt="" />
          ) : (
            <span className="krew-dash-avatar-placeholder"><Building2 size={28} strokeWidth={1.5} /></span>
          )}
          <span className="krew-dash-avatar-edit">{uploading ? 'Uploading…' : photoPath ? 'Change logo' : 'Add logo'}</span>
          <input
            id="organizer-photo-input"
            type="file"
            accept="image/jpeg,image/png"
            onChange={handlePhoto}
            disabled={uploading}
          />
        </label>

        <form className="krew-dash-profile-fields" onSubmit={handleSave}>
          <div className="krew-field">
            <label className="krew-field-label" htmlFor="company-name">Company or brand name</label>
            <input
              id="company-name"
              type="text"
              className="krew-field-input"
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              maxLength={80}
              autoComplete="organization"
              placeholder={`e.g. ${user.name.split(' ')[0]} Events`}
            />
            <p className="krew-dash-availability-note">Shown on your gigs instead of your own name. Leave it empty to use your name.</p>
          </div>
          <div className="krew-field">
            <label className="krew-field-label" htmlFor="organizer-bio">
              Bio <span className="krew-dash-availability-note" style={{ display: 'inline', marginTop: 0 }}>(max {MAX_BIO_LENGTH} characters)</span>
            </label>
            <textarea
              id="organizer-bio"
              className="krew-field-input krew-field-textarea"
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              maxLength={MAX_BIO_LENGTH}
              rows={4}
              placeholder="The kind of events you run, how big they are, and what crew can expect working with you."
            />
          </div>
          <button type="submit" className="krew-button-primary krew-button-inline" disabled={saving}>
            {saving ? 'Saving…' : 'Save profile'}
          </button>
        </form>
      </div>
    </section>
  );
}
