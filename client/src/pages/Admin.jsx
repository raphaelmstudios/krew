import { useEffect, useState } from 'react';
import NotificationBell from '../components/NotificationBell.jsx';

//Admin screen - two tabs: pending account approvals, and dispute resolution.
//NOTE: this screen used to have no login checks; anyone with the /admin URL could open it
//and approve or reject accounts. Thats only acceptable since there was no real loging system yet.
//Now that AdminGate.jsx requires a real admin session (Task d1-7), that note is no longer
//true, so its been updated instead of left here to mislead whoever reads this next.
export default function Admin({ onLogout }) {
  const [tab, setTab] = useState('approvals'); // approvals | disputes

  const [pendingUsers, setPendingUsers] = useState(null); //null means still loading
  const [actioningId, setActioningId] = useState(null);
  const [approvalsError, setApprovalsError] = useState(null);

  const [disputes, setDisputes] = useState(null);
  const [disputesError, setDisputesError] = useState(null);
  const [resolvingId, setResolvingId] = useState(null); // which dispute's resolve form is open
  const [outcome, setOutcome] = useState('confirm');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [finalAmount, setFinalAmount] = useState('');
  const [resolveError, setResolveError] = useState(null);
  const [resolveSubmitting, setResolveSubmitting] = useState(false);

  useEffect(() => {
    loadPendingUsers();
    loadDisputes();
  }, []);

  async function loadPendingUsers() {
    try {
      const response = await fetch('/api/admin/users/pending');
      const data = await response.json();
      setPendingUsers(data);
    } catch (err) {
      setApprovalsError('Could not reach the server.');
    }
  }

  async function handleAction(userId, action) {
    setActioningId(userId);
    setApprovalsError(null);
    try {
      const response = await fetch(`/api/admin/users/${userId}/${action}`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) {
        setApprovalsError(data.error || 'Something went wrong. Please try again.');
        return;
      }

      //Takes the approved/rejected user out of the pending list instead of reloading the whole list from the server
      setPendingUsers((current) => current.filter((u) => u.id !== userId));
    } catch (err) {
      setApprovalsError('Could not reach the server.');
    } finally {
      setActioningId(null);
    }
  }

  async function loadDisputes() {
    try {
      const response = await fetch('/api/admin/disputes');
      const data = await response.json();
      setDisputes(data);
    } catch (err) {
      setDisputesError('Could not reach the server.');
    }
  }

  // Opens the resolve form for one dispute and resets it to a clean state - without this,
  // switching from resolving one dispute straight to another would carry over whatever
  // notes or amount were typed for the first one.
  function openResolveForm(disputeId) {
    setResolvingId(disputeId);
    setOutcome('confirm');
    setResolutionNotes('');
    setFinalAmount('');
    setResolveError(null);
  }

  async function handleResolve(disputeId) {
    setResolveSubmitting(true);
    setResolveError(null);
    try {
      const response = await fetch(`/api/admin/disputes/${disputeId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outcome,
          resolution_notes: resolutionNotes,
          final_amount: outcome === 'confirm' ? finalAmount : undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setResolveError(data.error || 'Something went wrong. Please try again.');
        return;
      }
      setResolvingId(null);
      loadDisputes();
    } catch (err) {
      setResolveError('Could not reach the server.');
    } finally {
      setResolveSubmitting(false);
    }
  }

  const openDisputes = disputes ? disputes.filter((d) => d.status === 'open') : null;
  const resolvedDisputes = disputes ? disputes.filter((d) => d.status !== 'open') : null;

  return (
    <div className="krew-admin-page">
      <div className="krew-admin-header">
        <div>
          <h1 className="krew-admin-title">Admin</h1>
          <p className="krew-admin-subhead">
            {tab === 'approvals'
              ? 'Accounts waiting on ID verification before they can use KREW'
              : "Jobs either side has flagged as disputed, waiting on a decision"}
          </p>
        </div>
        <div className="krew-dash-header-right">
          <NotificationBell />
          {onLogout && <button type="button" className="krew-admin-logout" onClick={onLogout}>Log out</button>}
        </div>
      </div>

      <div className="krew-dash-tabs">
        <button
          type="button"
          className={`krew-dash-tab ${tab === 'approvals' ? 'active' : ''}`}
          onClick={() => setTab('approvals')}
        >
          Pending Approvals{pendingUsers && pendingUsers.length > 0 ? ` (${pendingUsers.length})` : ''}
        </button>
        <button
          type="button"
          className={`krew-dash-tab ${tab === 'disputes' ? 'active' : ''}`}
          onClick={() => setTab('disputes')}
        >
          Disputes{openDisputes && openDisputes.length > 0 ? ` (${openDisputes.length})` : ''}
        </button>
      </div>

      {tab === 'approvals' && (
        <>
          {approvalsError && <div className="krew-form-banner error">{approvalsError}</div>}

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
        </>
      )}

      {tab === 'disputes' && (
        <>
          {disputesError && <div className="krew-form-banner error">{disputesError}</div>}

          {disputes === null && !disputesError && <div className="krew-admin-empty">Loading…</div>}

          {disputes && disputes.length === 0 && (
            <div className="krew-admin-empty">No disputes have been raised.</div>
          )}

          {/* disputes.length > 0 but every one of them is already resolved - without this,
              the screen would show nothing above the Resolved section, which looks
              identical to the tab having failed to load rather than meaning "you're caught
              up". */}
          {openDisputes && openDisputes.length === 0 && disputes && disputes.length > 0 && (
            <div className="krew-admin-empty">No open disputes right now.</div>
          )}

          {openDisputes && openDisputes.length > 0 && (
            <div>
              {openDisputes.map((dispute) => (
                <div className="krew-admin-dispute" key={dispute.id}>
                  <div className="krew-admin-row">
                    <div className="krew-admin-row-info">
                      <div className="krew-admin-row-name">
                        {dispute.organizer_name} &amp; {dispute.crew_member_name}
                      </div>
                      <div className="krew-admin-row-meta">
                        KES {Number(dispute.amount).toLocaleString()} · due {new Date(dispute.due_date).toLocaleDateString()}
                      </div>
                      <div className="krew-admin-row-meta">
                        Raised by <span className="krew-admin-role-pill">{dispute.raised_by_role?.replace('_', ' ')}</span>
                        {dispute.raised_by_name}: "{dispute.reason}"
                      </div>
                      {dispute.details && (
                        <div className="krew-admin-row-meta krew-admin-dispute-details">{dispute.details}</div>
                      )}
                      <div className="krew-admin-row-meta">
                        {dispute.organizer_confirmed_amount != null
                          ? `Organizer confirmed KES ${Number(dispute.organizer_confirmed_amount).toLocaleString()}`
                          : 'Organizer has not confirmed'}
                        {' · '}
                        {dispute.crew_confirmed_amount != null
                          ? `Crew confirmed KES ${Number(dispute.crew_confirmed_amount).toLocaleString()}`
                          : 'Crew has not confirmed'}
                      </div>
                    </div>
                    <div className="krew-admin-actions">
                      <button
                        type="button"
                        className="krew-admin-btn resolve"
                        onClick={() => (resolvingId === dispute.id ? setResolvingId(null) : openResolveForm(dispute.id))}
                      >
                        {resolvingId === dispute.id ? 'Close' : 'Resolve'}
                      </button>
                    </div>
                  </div>

                  {resolvingId === dispute.id && (
                    <div className="krew-admin-resolve-form">
                      {resolveError && <div className="krew-form-banner error">{resolveError}</div>}

                      <div className="krew-admin-resolve-outcome">
                        <label>
                          <input
                            type="radio"
                            name="outcome"
                            value="confirm"
                            checked={outcome === 'confirm'}
                            onChange={() => setOutcome('confirm')}
                          />
                          The job was paid - confirm it
                        </label>
                        <label>
                          <input
                            type="radio"
                            name="outcome"
                            value="reopen"
                            checked={outcome === 'reopen'}
                            onChange={() => setOutcome('reopen')}
                          />
                          Reopen - let both sides confirm again
                        </label>
                      </div>

                      {outcome === 'confirm' && (
                        <div className="krew-field">
                          <label className="krew-field-label" htmlFor={`final-amount-${dispute.id}`}>Final amount (KES)</label>
                          <input
                            id={`final-amount-${dispute.id}`}
                            type="number"
                            min="0"
                            className="krew-field-input"
                            value={finalAmount}
                            onChange={(e) => setFinalAmount(e.target.value)}
                          />
                        </div>
                      )}

                      <div className="krew-field">
                        <label className="krew-field-label" htmlFor={`resolution-notes-${dispute.id}`}>Resolution notes</label>
                        <textarea
                          id={`resolution-notes-${dispute.id}`}
                          className="krew-field-input"
                          rows={3}
                          value={resolutionNotes}
                          onChange={(e) => setResolutionNotes(e.target.value)}
                          placeholder="Explain what you decided and why - this is kept as part of the record."
                        />
                      </div>

                      <div className="krew-admin-resolve-actions">
                        <button
                          type="button"
                          className="krew-admin-btn resolve"
                          disabled={resolveSubmitting}
                          onClick={() => handleResolve(dispute.id)}
                        >
                          {resolveSubmitting ? 'Saving…' : 'Save resolution'}
                        </button>
                        <button type="button" className="krew-dash-text-btn" onClick={() => setResolvingId(null)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {resolvedDisputes && resolvedDisputes.length > 0 && (
            <>
              <h2 className="krew-admin-resolved-heading">Resolved</h2>
              {resolvedDisputes.map((dispute) => (
                <div className="krew-admin-row krew-admin-row-resolved" key={dispute.id}>
                  <div className="krew-admin-row-info">
                    <div className="krew-admin-row-name">
                      {dispute.organizer_name} &amp; {dispute.crew_member_name}
                    </div>
                    <div className="krew-admin-row-meta">
                      KES {Number(dispute.amount).toLocaleString()} · resolved {new Date(dispute.resolved_at).toLocaleDateString()}
                    </div>
                    {dispute.resolution_notes && (
                      <div className="krew-admin-row-meta krew-admin-dispute-details">{dispute.resolution_notes}</div>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}