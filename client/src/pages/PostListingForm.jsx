import { useEffect, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import AmountInput from '../components/AmountInput.jsx';

// The fixed category list a listing can be filed under - mirrors
// LISTING_CATEGORIES in server/src/routes/listings.js. Kept as its own constant
// here (rather than fetched from the server) since it rarely changes and the
// form needs it before the user does anything that would justify a request.
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png'];
const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // same 5MB limit the server enforces

const LISTING_CATEGORIES = [
  'Bar Service',
  'Catering',
  'Security',
  'Event Setup & Teardown',
  'Ushering & Guest Services',
  'Photography & Videography',
  'Sound & AV',
  'Other',
];

// A form for posting a new job listing.
// The organizer specifies the amount, due date, and an optional job description.
// When submitted, the form sends a POST request to the server to create a new job listing.
// The form handles validation, loading states, and displays error messages if the submission fails.
export default function PostListingForm({ onCreated, onCancel }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(LISTING_CATEGORIES[0]);
  const [location, setLocation] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [description, setDescription] = useState('');
  const [banner, setBanner] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Optional listing photo - shown on Find Work's cards and the gig page. Uploaded right
  // after the listing itself is created, since the upload route needs the new listing's id.
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreview(null);
      return undefined;
    }
    const url = URL.createObjectURL(photoFile);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  function handlePhotoChange(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      setBanner({ type: 'error', text: 'Please choose a JPG or PNG photo.' });
      return;
    }
    if (file.size > MAX_PHOTO_SIZE) {
      setBanner({ type: 'error', text: 'The photo must be smaller than 5MB.' });
      return;
    }
    setBanner(null);
    setPhotoFile(file);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setBanner(null);

    if (!title.trim()) {
      setBanner({ type: 'error', text: 'Give the job a short title.' });
      return;
    }
    if (!location.trim()) {
      setBanner({ type: 'error', text: 'Enter where the job is located.' });
      return;
    }
    if (!amount || Number(amount) <= 0) {
      setBanner({ type: 'error', text: 'Enter an amount greater than zero.' });
      return;
    }
    if (!dueDate) {
      setBanner({ type: 'error', text: 'Pick a due date.' });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/job-listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          category,
          location: location.trim(),
          amount: Number(amount),
          due_date: dueDate,
          job_description: description.trim() || undefined,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setBanner({ type: 'error', text: data.error || 'Something went wrong. Please try again.' });
        return;
      }

      // The listing exists now - if the photo upload fails, the listing still stands and
      // the organizer can add the photo from the listing's card on their dashboard.
      let photoFailed = false;
      if (photoFile) {
        try {
          const formData = new FormData();
          formData.append('listing_photo', photoFile);
          const photoResponse = await fetch(`/api/job-listings/${data.id}/photo`, { method: 'POST', body: formData });
          photoFailed = !photoResponse.ok;
        } catch {
          photoFailed = true;
        }
      }

      onCreated(photoFailed ? { photoFailed: true } : undefined);
    } catch {
      // fetch itself throws when there's no network connection at all.
      setBanner({ type: 'error', text: 'Could not reach the server. Check your connection and try again.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="krew-card krew-dash-form-card">
      <h2 className="krew-dash-form-title">Post a job</h2>

      {banner && <div className={`krew-form-banner ${banner.type}`}>{banner.text}</div>}

      <form onSubmit={handleSubmit}>
        <div className="krew-field">
          <label className="krew-field-label" htmlFor="title">Job title</label>
          <input
            id="title"
            type="text"
            className="krew-field-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Bar staff for a 200-guest wedding"
          />
        </div>

        <div className="krew-field">
          <label className="krew-field-label" htmlFor="category">Category</label>
          <select
            id="category"
            className="krew-field-input"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {LISTING_CATEGORIES.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>

        <div className="krew-field">
          <label className="krew-field-label" htmlFor="location">Location</label>
          <input
            id="location"
            type="text"
            className="krew-field-input"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Karen, Nairobi"
          />
        </div>

        <div className="krew-field">
          <label className="krew-field-label" htmlFor="amount">Amount (KES)</label>
          <AmountInput
            id="amount"
            className="krew-field-input"
            value={amount}
            onValueChange={setAmount}
            placeholder="e.g. 5,000"
          />
        </div>

        <div className="krew-field">
          <label className="krew-field-label" htmlFor="due-date">Due date</label>
          <input
            id="due-date"
            type="date"
            className="krew-field-input"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>

        <div className="krew-field">
          <label className="krew-field-label" htmlFor="description">What's the job? (optional)</label>
          <textarea
            id="description"
            className="krew-field-input"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Bar service for a 200-guest wedding, 6pm–midnight"
          />
        </div>

        <div className="krew-field">
          <span className="krew-field-label">Listing photo (optional)</span>
          <label className={`krew-upload-box krew-listing-upload ${photoFile ? 'has-file' : ''}`}>
            {photoPreview ? (
              <img src={photoPreview} alt="" className="krew-listing-upload-preview" />
            ) : (
              <span className="krew-upload-icon"><ImagePlus size={22} strokeWidth={1.5} /></span>
            )}
            <span className="krew-upload-hint">
              {photoFile ? (
                <>
                  <span className="krew-upload-filename">{photoFile.name}</span> · Click to change
                </>
              ) : (
                'Add a photo of the venue or the kind of work - JPG or PNG, up to 5MB'
              )}
            </span>
            <input type="file" accept="image/jpeg,image/png" onChange={handlePhotoChange} disabled={submitting} />
          </label>
          {photoFile && (
            <button type="button" className="krew-dash-text-btn" style={{ marginTop: 8 }} onClick={() => setPhotoFile(null)}>
              Remove photo
            </button>
          )}
        </div>

        <div className="krew-dash-form-actions">
          <button type="button" className="krew-button-secondary" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="krew-button-primary krew-dash-form-submit" disabled={submitting}>
            {submitting ? 'Posting…' : 'Post Job'}
          </button>
        </div>
      </form>
    </div>
  );
}