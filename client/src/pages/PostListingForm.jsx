import { useState } from 'react';

// The fixed category list a listing can be filed under - mirrors
// LISTING_CATEGORIES in server/src/routes/listings.js. Kept as its own constant
// here (rather than fetched from the server) since it rarely changes and the
// form needs it before the user does anything that would justify a request.
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

      onCreated();
    } catch (err) {
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
          <input
            id="amount"
            type="number"
            min="1"
            step="1"
            className="krew-field-input"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 5000"
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