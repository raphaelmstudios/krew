import { useEffect, useState } from 'react';

//Admin approval screen.
// This is the admin page where the admin can see all the pending user accounts and approve or reject them.
// NOTE: this screen has no login checks; anyone with the/admin URL can open it and approve or reject accounts
//Thats only acceptable since there's no real loging system yet
//Once built this screen will need to require an admin session to be able to approve or reject real accounts.

export default function Admin() {
    const [pendingUsers, setPendingUsers] = useState(null); //null means still loading
    const [actioningId, setActioningId] = useState(null); 
    const [error, setError] = useState(null);
    
     useEffect(() => {
    loadPendingUsers();
  }, []);

    async function loadPendingUsers() {
        try{
            const response = await fetch('/api/admin/users/pending');
            const data = await response.json();
            setPendingUsers(data);
        } catch (err) {
            setError(`Could not reach the server.`);    
        }
    }

    async function handleAction(userId, action) {
        setActioningId(userId);
        setError(null);
        try {
            const response = await fetch(`/api/admin/users/${userId}/${action}`, { method: 'POST' });
            const data = await response.json();
            if (!response.ok) {
                setError(data.error || 'Something went wrong. Please try again.');
                return;
            }

            //Takes the approved/rejected user out of the pending list instead of reloading the whole list from the server
            setPendingUsers((current) => current.filter((u) => u.id !== userId));
        } catch (err) {
            setError('Could not reach the server.');
        } finally {
            setActioningId(null);
        }
    }

    return (
        <div className="krew-admin-page">
            <h1 className="krew-admin-title">Pending Approvals </h1>
            <p className="krew-admin-subhead">Accounts waiting on ID verification before they can use KREW</p>

            {error && <div className="krew-form-banner error">{error}</div>}

            {pendingUsers === null && <div className="krew-admin-empty">Loading…</div>}
    
        {pendingUsers && pendingUsers.length === 0 && (
            <div className="krew-admin-empty">No accounts are waiting on review right now.</div>
        )}
    
        {pendingUsers && pendingUsers.length > 0 && (
            <div>
            {pendingUsers.map((user) => (
                <div className="krew-admin-row" key={user.id}>
                <div className="krew-admin-row-info">
                    <div className="krew-admin-row-name">{user.name}</div>
                    <div className="krew-admin-row-meta">
                    <span className="krew-admin-role-pill">{user.role.replace('_', ' ')}</span>
                    {user.phone}
                    {!user.id_document_path || !user.selfie_path ? ' · documents not uploaded yet' : ''}
                    </div>
                </div>
                <div className="krew-admin-actions">
                    <button
                    type="button"
                    className="krew-admin-btn approve"
                    disabled={actioningId === user.id}
                    onClick={() => handleAction(user.id, 'approve')}
                    >
                    Approve
                    </button>
                    <button
                    type="button"
                    className="krew-admin-btn reject"
                    disabled={actioningId === user.id}
                    onClick={() => handleAction(user.id, 'reject')}
                    >
                    Reject
                    </button>
                </div>
                </div>
            ))}
            </div>
        )}
        </div>
    );
}