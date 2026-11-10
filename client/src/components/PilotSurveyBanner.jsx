import { useState } from 'react';

// This banner is shown to users during the pilot phase of KREW, encouraging them to take a survey about their experience. 
// It is dismissible, and the dismissal state is stored in localStorage so that it persists across page reloads and sessions in the same browser.

const SURVEY_URL = 'PASTE_REAL_SURVEY_LINK_HERE';

// The dismissal state is stored in localStorage under the key 'krew_pilot_survey_dismissed'.
const DISMISS_KEY = 'krew_pilot_survey_dismissed';

export default function PilotSurveyBanner() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === 'true';
    } catch {
      // If localStorage is unavailable (e.g., in private browsing mode), we can't persist the dismissal state, so we just treat it as not dismissed.
      return false;
    }
  });

  if (dismissed) return null;

  function handleDismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, 'true');
    } catch {
      // If localStorage is unavailable, we can't persist the dismissal state, but we still update the component state so the banner disappears for this session.
    }
  }

  return (
    <div className="krew-pilot-banner">
      <p className="krew-pilot-banner-text">
        We're running a pilot of KREW and would love your feedback! Please take a few minutes to complete our survey.
      </p>
      <div className="krew-pilot-banner-actions">
        <a href={SURVEY_URL} target="_blank" rel="noopener noreferrer" className="krew-pilot-banner-link">
          Take the survey
        </a>
        <button type="button" className="krew-pilot-banner-dismiss" onClick={handleDismiss} aria-label="Dismiss">
          &times;
        </button>
      </div>
    </div>
  );
}