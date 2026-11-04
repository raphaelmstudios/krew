import OrganizerDashboard from './OrganizerDashboard.jsx';
import CrewDashboard from './CrewDashboard.jsx';

// A dashboard that shows different content depending on the user's role.
export default function Dashboard({ user, onLogout }) {
  if (user.role === 'organizer') {
    return <OrganizerDashboard user={user} onLogout={onLogout} />;
  }

  return <CrewDashboard user={user} onLogout={onLogout} />;
}