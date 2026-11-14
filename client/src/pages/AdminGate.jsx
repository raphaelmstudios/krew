import RoleGate from './RoleGate.jsx';
import Admin from './Admin.jsx';

// The admin gate is a special case of RoleGate that only allows admins to see the real content.
// It shows a login form for anyone not logged in, and sends an organizer or crew member who
// signs in here to their own dashboard.
export default function AdminGate() {
  return (
    <RoleGate
      role="admin"
      loginHeading="Admin sign-in"
      loginSubhead="Sign in with an admin account to review pending approvals."
      forbiddenMessage="This account isn't an admin account."
      showSignupLink={false}
      redirects={{ organizer: '/dashboard', crew_member: '/dashboard' }}
    >
      {({ user, onLogout }) => <Admin user={user} onLogout={onLogout} />}
    </RoleGate>
  );
}