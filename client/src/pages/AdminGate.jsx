import RoleGate from './RoleGate.jsx';
import Admin from './Admin.jsx';

// The admin gate is a special case of RoleGate that only allows admins to see the real content. 
// It shows a login form for anyone not logged in, and a forbidden message for anyone logged in but not an admin.

export default function AdminGate() {
  return (
    <RoleGate
      role="admin"
      loginHeading="Admin sign-in"
      loginSubhead="Sign in with an admin account to review pending approvals."
      forbiddenMessage="This account isn't an admin account."
    >
      {({ onLogout }) => <Admin onLogout={onLogout} />}
    </RoleGate>
  );
}