import { useState } from 'react';
import { X } from 'lucide-react';

// This banner is shown to users during the pilot phase of KREW, encouraging them to take a survey about their experience. 
// It is dismissible, and the dismissal state is stored in localStorage so that it persists across page reloads and sessions in the same browser.

// One Google Form per role - organizers and crew answer different questions (the question
// set lives in the "KREW Pilot Feedback Surveys" doc). The dashboard passes the viewer's role.
const SURVEY_URLS = {
  organizer: 'https://forms.gle/7y6AxzACCZUZgzpa8',
  crew_member: 'https://forms.gle/fpRBJd9VR5MnGpHj6',
};

// The dismissal state is stored in localStorage under this key. It's a new key (v2) because the
// old banner pointed at a placeholder link - anyone who dismissed that one should still get one
// chance to see the real survey.
const DISMISS_KEY = 'krew_pilot_survey_dismissed_v2';

export default function PilotSurveyBanner({ role }) {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === 'true';
    } catch {
      // If localStorage is unavailable (e.g., in private browsing mode), we can't persist the dismissal state, so we just treat it as not dismissed.
      return false;
    }
  });

  const surveyUrl = SURVEY_URLS[role];
  if (dismissed || !surveyUrl) return null;

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
        We're running a pilot of KREW and would love your feedback. The survey takes about 6 minutes.
      </p>
      <div className="krew-pilot-banner-actions">
        <a href={surveyUrl} target="_blank" rel="noopener noreferrer" className="krew-pilot-banner-link">
          Take the survey
        </a>
        <button type="button" className="krew-pilot-banner-dismiss" onClick={handleDismiss} aria-label="Dismiss">
          <X size={18} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}