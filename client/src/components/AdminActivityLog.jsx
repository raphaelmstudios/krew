import { useEffect, useState } from 'react';

// Admin: the change log (NFR9 in the SRS). Every change to a job, a payment, a dispute or an
// account's trust status, newest first, with who made it and when (see server/src/audit.js).
// Entries are never edited or deleted, so this is the record to go back to when someone asks
// "who changed this?".

const GROUPS = [
  { key: 'all', label: 'Everything' },
  { key: 'jobs', label: 'Jobs and payments' },
  { key: 'disputes', label: 'Disputes' },
  { key: 'accounts', label: 'Accounts' },
  { key: 'data', label: 'Data requests' },
];

function formatWhen(value) {
  const date = new Date(`${value.replace(' ', 'T')}Z`);
  return {
    day: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
  };
}

function kes(amount) {
  return `KES ${Number(amount).toLocaleString()}`;
}

function roleWord(role) {
  return role === 'crew_member' ? 'crew' : role;
}

// One plain sentence for each kind of change, plus an optional second line of detail.
function describe(entry) {
  const who = entry.actor_id ? entry.actor_name : 'KREW';
  const target = entry.target_name || 'an account';
  const details = entry.details || {};
  const job = `job #${entry.target_id}`;
  switch (entry.action) {
    case 'account_created':
      return { text: `${who} created a ${roleWord(details.role)} account` };
    case 'account_approved':
      return { text: `${who} approved ${target}'s account` };
    case 'account_rejected':
      return { text: `${who} rejected ${target}'s account` };
    case 'password_changed':
      return { text: `${who} changed their password` };
    case 'password_reset_code_issued':
      return { text: `${who} gave ${target} a password reset code` };
    case 'password_reset_used':
      return { text: `${who} reset their password with a code` };
    case 'gig_posted':
      return { text: `${who} posted the gig "${details.title}"`, more: `${kes(details.amount)}, due ${details.due_date}` };
    case 'gig_cancelled':
      return { text: `${who} closed gig #${entry.target_id}` };
    case 'job_created':
      return { text: `${who} set up ${job} for ${kes(details.amount)}`, more: `Due ${details.due_date} · ${details.how}` };
    case 'payment_confirmed':
      return {
        text: `${who} confirmed ${kes(details.amount)} paid for ${job}`,
        more: details.previous_amount != null ? `Changed from ${kes(details.previous_amount)}` : null,
      };
    case 'job_completed':
      return { text: `Job #${entry.target_id} is complete: both sides confirmed ${kes(details.amount)}` };
    case 'dispute_raised':
      return { text: `${who} disputed ${job}`, more: details.reason ? `"${details.reason}"` : null };
    case 'dispute_resolved': {
      const before = `Before: organizer ${details.organizer_amount_before != null ? kes(details.organizer_amount_before) : 'not confirmed'}, crew ${
        details.crew_amount_before != null ? kes(details.crew_amount_before) : 'not confirmed'
      }`;
      return details.outcome === 'confirm'
        ? { text: `${who} settled the dispute on ${job} at ${kes(details.final_amount)}`, more: before }
        : { text: `${who} reopened ${job} so both sides confirm again`, more: before };
    }
    case 'data_copy_downloaded':
      return { text: `${who} downloaded a copy of their data` };
    case 'deletion_requested':
      return { text: `${who} asked for their account to be deleted` };
    case 'deletion_cancelled':
      return { text: `${who} cancelled their deletion request` };
    case 'deletion_completed':
      return { text: `${who} deleted an account at its owner's request` };
    case 'deletion_declined':
      return { text: `${who} declined ${target}'s deletion request`, more: details.note ? `"${details.note}"` : null };
    default:
      return { text: `${who}: ${entry.action.replace(/_/g, ' ')}` };
  }
}

export default function AdminActivityLog() {
  const [group, setGroup] = useState('all');
  const [entries, setEntries] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setEntries(null);
    load(null);
  }, [group]);

  async function load(before) {
    setError(null);
    const params = new URLSearchParams();
    if (group !== 'all') params.set('group', group);
    if (before) params.set('before', before);
    try {
      const response = await fetch(`/api/admin/activity?${params}`);
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Could not load the change log.');
        return;
      }
      setEntries((current) => (before && current ? [...current, ...data.entries] : data.entries));
      setHasMore(data.has_more);
    } catch {
      setError('Could not reach the server.');
    }
  }

  async function loadMore() {
    setLoadingMore(true);
    await load(entries[entries.length - 1].id);
    setLoadingMore(false);
  }

  return (
    <>
      <div className="krew-db-head">
        <h1>Change log</h1>
        <p>
          Every change to a job, a payment, a dispute or an account, with who made it and when. Entries are never edited or
          deleted.
        </p>
      </div>

      <div className="krew-adm-log-filters" role="group" aria-label="Show">
        {GROUPS.map((item) => (
          <button
            type="button"
            key={item.key}
            className={`krew-adm-log-filter ${group === item.key ? 'active' : ''}`}
            aria-pressed={group === item.key}
            onClick={() => setGroup(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error && <div className="krew-form-banner error">{error}</div>}
      {entries === null && !error && <div className="krew-dash-loading-note" role="status">Loading…</div>}

      {entries && entries.length === 0 && (
        <div className="krew-dash-empty">
          <p>Nothing here yet. Changes show up as people use KREW.</p>
        </div>
      )}

      {entries && entries.length > 0 && (
        <ol className="krew-adm-log krew-adm-list-card">
          {entries.map((entry) => {
            const when = formatWhen(entry.created_at);
            const { text, more } = describe(entry);
            return (
              <li key={entry.id}>
                <time dateTime={`${entry.created_at.replace(' ', 'T')}Z`}>
                  <span>{when.day}</span>
                  <small>{when.time}</small>
                </time>
                <div>
                  <span className="krew-adm-log-text">{text}</span>
                  {more && <small className="krew-adm-log-more">{more}</small>}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {entries && hasMore && (
        <div className="krew-adm-log-more-wrap">
          <button type="button" className="krew-button-secondary krew-button-inline krew-db-small-btn" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : 'Show older changes'}
          </button>
        </div>
      )}
    </>
  );
}
