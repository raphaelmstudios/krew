import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  LayoutDashboard,
  UserRoundCheck,
  Scale,
  ChartColumn,
  BadgeCheck,
  Wallet,
  IdCard,
  ScanFace,
  ArrowRight,
  CircleCheck,
  CircleDashed,
  Megaphone,
  ChevronDown,
} from 'lucide-react';
import DashboardShell from '../components/DashboardShell.jsx';
import ListingPhoto from '../components/ListingPhoto.jsx';

// Admin screen, in the moodboard's sidebar layout (panel 9, DashboardShell.jsx). Four sections:
// - Overview: the two queues that need a person (account approvals, open disputes) plus headline numbers.
// - Account Approvals: accounts waiting on ID verification - view their ID and selfie, then approve or reject.
// - Disputes: jobs either side flagged, with both confirmed amounts side by side, and the resolve form.
// - Analytics: live counts across people, gigs, jobs and disputes (GET /api/admin/stats).
// The moodboard also shows a Settings item; there are no admin settings in KREW yet, so it's left
// out rather than linking to an empty page.
// NOTE: this screen used to have no login checks; AdminGate.jsx requires a real admin session
// now (Task d1-7), so anyone seeing this is a logged-in admin.

const SECTIONS = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'approvals', label: 'Approvals', icon: UserRoundCheck },
  { key: 'disputes', label: 'Disputes', icon: Scale },
  { key: 'analytics', label: 'Analytics', icon: ChartColumn },
];

function initials(name) {
  return (name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

// Timestamps from SQLite are UTC without a timezone marker.
function formatServerDay(value) {
  if (!value) return '';
  return new Date(`${value.replace(' ', 'T')}Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDate(value) {
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function roleLabel(role) {
  return role === 'crew_member' ? 'Crew member' : role === 'organizer' ? 'Organizer' : role;
}

export default function Admin({ user, onLogout }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('section');
  const section = SECTIONS.some((item) => item.key === requested) ? requested : 'overview';

  const [pendingUsers, setPendingUsers] = useState(null); //null means still loading
  const [actioningId, setActioningId] = useState(null);
  const [confirmRejectId, setConfirmRejectId] = useState(null); // reject asks once more before it goes through
  const [approvalsError, setApprovalsError] = useState(null);
  const [approvalsNotice, setApprovalsNotice] = useState(null);

  const [disputes, setDisputes] = useState(null);
  const [disputesError, setDisputesError] = useState(null);
  const [resolvingId, setResolvingId] = useState(null); // which dispute's resolve form is open
  const [outcome, setOutcome] = useState('confirm');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [finalAmount, setFinalAmount] = useState('');
  const [resolveError, setResolveError] = useState(null);
  const [resolveSubmitting, setResolveSubmitting] = useState(false);
  const [showResolved, setShowResolved] = useState(false);

  const [stats, setStats] = useState(null);

  useEffect(() => {
    loadPendingUsers();
    loadDisputes();
    loadStats();
  }, []);

  function goTo(nextSection) {
    setSearchParams(nextSection === 'overview' ? {} : { section: nextSection });
    setApprovalsNotice(null);
    window.scrollTo(0, 0);
    // Other admins (or the people involved) can change these while another section is open.
    if (nextSection === 'overview' || nextSection === 'approvals') loadPendingUsers();
    if (nextSection === 'overview' || nextSection === 'disputes') loadDisputes();
    if (nextSection === 'overview' || nextSection === 'analytics') loadStats();
  }

  async function loadPendingUsers() {
    try {
      const response = await fetch('/api/admin/users/pending');
      const data = await response.json();
      if (!response.ok) {
        setApprovalsError(data.error || 'Could not load pending accounts.');
        return;
      }
      setPendingUsers(data);
    } catch (err) {
      setApprovalsError('Could not reach the server.');
    }
  }

  async function loadStats() {
    try {
      const response = await fetch('/api/admin/stats');
      if (response.ok) setStats(await response.json());
    } catch (err) {
      // The tiles just stay on their loading state.
    }
  }

  async function handleAction(pendingUser, action) {
    setActioningId(pendingUser.id);
    setApprovalsError(null);
    setApprovalsNotice(null);
    try {
      const response = await fetch(`/api/admin/users/${pendingUser.id}/${action}`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) {
        setApprovalsError(data.error || 'Something went wrong. Please try again.');
        return;
      }

      //Takes the approved/rejected user out of the pending list instead of reloading the whole list from the server
      setPendingUsers((current) => current.filter((u) => u.id !== pendingUser.id));
      setConfirmRejectId(null);
      setApprovalsNotice(
        action === 'approve' ? `${pendingUser.name} is approved and has been notified.` : `${pendingUser.name}'s account was rejected.`
      );
      loadStats();
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
      if (!response.ok) {
        setDisputesError(data.error || 'Could not load disputes.');
        return;
      }
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
      loadStats();
    } catch (err) {
      setResolveError('Could not reach the server.');
    } finally {
      setResolveSubmitting(false);
    }
  }

  const openDisputes = disputes ? disputes.filter((d) => d.status === 'open') : null;
  const resolvedDisputes = disputes ? disputes.filter((d) => d.status !== 'open') : null;
  const firstName = (user?.name || 'Admin').split(' ')[0];

  const navItems = SECTIONS.map((item) => ({
    ...item,
    badge:
      item.key === 'approvals' && pendingUsers?.length
        ? pendingUsers.length
        : item.key === 'disputes' && openDisputes?.length
        ? openDisputes.length
        : null,
  }));

  // --- pieces shared by Overview and the full sections ---

  function renderDocLinks(pendingUser) {
    if (!pendingUser.id_document_path || !pendingUser.selfie_path) {
      return <span className="krew-adm-docs missing">Documents not uploaded yet</span>;
    }
    return (
      <span className="krew-adm-docs">
        <a href={`/api/admin/users/${pendingUser.id}/files/id`} target="_blank" rel="noopener noreferrer">
          <IdCard size={18} strokeWidth={1.5} aria-hidden="true" /> ID document
        </a>
        <a href={`/api/admin/users/${pendingUser.id}/files/selfie`} target="_blank" rel="noopener noreferrer">
          <ScanFace size={18} strokeWidth={1.5} aria-hidden="true" /> Selfie
        </a>
      </span>
    );
  }

  function renderApprovalRow(pendingUser, compact = false) {
    const busy = actioningId === pendingUser.id;
    // Approving is the ID check itself, so it waits until there's an ID and selfie to look at.
    const hasDocuments = Boolean(pendingUser.id_document_path && pendingUser.selfie_path);
    return (
      <li className={`krew-adm-row ${compact ? 'compact' : ''}`} key={pendingUser.id}>
        <span className="krew-db-crew-avatar krew-adm-avatar" aria-hidden="true">
          {initials(pendingUser.name)}
        </span>
        <div className="krew-adm-row-main">
          <strong>{pendingUser.name}</strong>
          <span>
            {roleLabel(pendingUser.role)} · {pendingUser.phone} · Signed up {formatServerDay(pendingUser.created_at)}
          </span>
        </div>
        {!compact && renderDocLinks(pendingUser)}
        {compact ? (
          <button type="button" className="krew-dash-text-btn" onClick={() => goTo('approvals')}>
            Review
          </button>
        ) : (
          <div className="krew-adm-actions">
            {confirmRejectId === pendingUser.id ? (
              <>
                <button
                  type="button"
                  className="krew-button-secondary krew-button-inline krew-db-small-btn krew-adm-reject"
                  disabled={busy}
                  onClick={() => handleAction(pendingUser, 'reject')}
                >
                  {busy ? 'Rejecting…' : 'Confirm reject'}
                </button>
                <button type="button" className="krew-dash-text-btn" onClick={() => setConfirmRejectId(null)} disabled={busy}>
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="krew-button-primary krew-button-inline krew-db-small-btn"
                  disabled={busy || !hasDocuments}
                  title={hasDocuments ? undefined : 'Waiting for their ID and selfie'}
                  onClick={() => handleAction(pendingUser, 'approve')}
                >
                  {busy ? 'Approving…' : 'Approve'}
                </button>
                <button
                  type="button"
                  className="krew-button-secondary krew-button-inline krew-db-small-btn krew-adm-reject"
                  disabled={busy}
                  onClick={() => setConfirmRejectId(pendingUser.id)}
                >
                  Reject
                </button>
              </>
            )}
          </div>
        )}
      </li>
    );
  }

  function renderAmountStep(label, confirmedAt, amount) {
    const done = amount != null;
    const Icon = done ? CircleCheck : CircleDashed;
    return (
      <div className={`krew-jc-step ${done ? 'done' : ''}`}>
        <Icon size={22} strokeWidth={1.4} aria-hidden="true" />
        <span>
          <strong>{label}</strong>
          <small>
            {done ? `Confirmed KES ${Number(amount).toLocaleString()}${confirmedAt ? ` · ${formatServerDay(confirmedAt)}` : ''}` : 'Has not confirmed'}
          </small>
        </span>
      </div>
    );
  }

  function renderStat(Icon, value, label, onClick) {
    const content = (
      <>
        <Icon size={24} strokeWidth={1.3} aria-hidden="true" />
        <strong>{value}</strong>
        <span>{label}</span>
      </>
    );
    return onClick ? (
      <button type="button" className="krew-adm-stat clickable" onClick={onClick}>
        {content}
      </button>
    ) : (
      <div className="krew-adm-stat">{content}</div>
    );
  }

  const loadingValue = '–';

  return (
    <DashboardShell user={user || { name: 'Admin' }} navItems={navItems} active={section} onNavigate={goTo} onLogout={onLogout}>
      {section === 'overview' && (
        <>
          <div className="krew-db-head">
            <h1>Welcome back, {firstName}</h1>
            <p>Here's what needs a person today.</p>
          </div>

          <div className="krew-adm-stats">
            {renderStat(UserRoundCheck, pendingUsers ? pendingUsers.length : loadingValue, 'accounts waiting for approval', () => goTo('approvals'))}
            {renderStat(Scale, openDisputes ? openDisputes.length : loadingValue, 'open disputes', () => goTo('disputes'))}
            {renderStat(BadgeCheck, stats ? stats.jobs.confirmed : loadingValue, 'jobs paid and confirmed')}
            {renderStat(
              Wallet,
              stats ? `KES ${Number(stats.jobs.confirmed_volume).toLocaleString()}` : loadingValue,
              'in confirmed payments'
            )}
          </div>

          <div className="krew-db-overview">
            <section className="krew-db-card">
              <div className="krew-db-card-head">
                <h2>Waiting for approval</h2>
                {pendingUsers && pendingUsers.length > 0 && (
                  <button type="button" className="krew-text-link krew-db-link-btn krew-adm-link" onClick={() => goTo('approvals')}>
                    Review all <ArrowRight size={15} strokeWidth={2} />
                  </button>
                )}
              </div>
              {pendingUsers === null && <div className="krew-dash-loading-note">Loading…</div>}
              {pendingUsers && pendingUsers.length === 0 && <p className="krew-db-empty">You're all caught up - no accounts waiting.</p>}
              {pendingUsers && pendingUsers.length > 0 && (
                <ul className="krew-adm-list">{pendingUsers.slice(0, 4).map((u) => renderApprovalRow(u, true))}</ul>
              )}
            </section>

            <section className="krew-db-card">
              <div className="krew-db-card-head">
                <h2>Open disputes</h2>
                {openDisputes && openDisputes.length > 0 && (
                  <button type="button" className="krew-text-link krew-db-link-btn krew-adm-link" onClick={() => goTo('disputes')}>
                    Review all <ArrowRight size={15} strokeWidth={2} />
                  </button>
                )}
              </div>
              {disputes === null && !disputesError && <div className="krew-dash-loading-note">Loading…</div>}
              {openDisputes && openDisputes.length === 0 && <p className="krew-db-empty">No open disputes right now.</p>}
              {openDisputes && openDisputes.length > 0 && (
                <ul className="krew-adm-list">
                  {openDisputes.slice(0, 4).map((dispute) => (
                    <li className="krew-adm-row compact" key={dispute.id}>
                      <Scale className="krew-adm-row-icon" size={22} strokeWidth={1.4} aria-hidden="true" />
                      <div className="krew-adm-row-main">
                        <strong>{dispute.title || 'Direct hire'}</strong>
                        <span>
                          {dispute.organizer_name} &amp; {dispute.crew_member_name} · KES {Number(dispute.amount).toLocaleString()}
                        </span>
                      </div>
                      <button type="button" className="krew-dash-text-btn" onClick={() => goTo('disputes')}>
                        Review
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}

      {section === 'approvals' && (
        <>
          <div className="krew-db-head">
            <h1>Account approvals</h1>
            <p>Accounts waiting on ID verification before they can use KREW. Open the ID and selfie, check they match the name, then decide.</p>
          </div>

          {approvalsError && <div className="krew-form-banner error">{approvalsError}</div>}
          {approvalsNotice && <div className="krew-form-banner success">{approvalsNotice}</div>}

          {pendingUsers === null && !approvalsError && <div className="krew-dash-loading-note">Loading…</div>}

          {pendingUsers && pendingUsers.length === 0 && (
            <div className="krew-dash-empty">
              <p>No accounts are waiting on review right now.</p>
            </div>
          )}

          {pendingUsers && pendingUsers.length > 0 && (
            <ul className="krew-adm-list krew-adm-list-card">{pendingUsers.map((u) => renderApprovalRow(u))}</ul>
          )}
        </>
      )}

      {section === 'disputes' && (
        <>
          <div className="krew-db-head">
            <h1>Disputes</h1>
            <p>Jobs either side has flagged, waiting on a decision. A disputed job is left out of both people's records until it's resolved here.</p>
          </div>

          {disputesError && <div className="krew-form-banner error">{disputesError}</div>}

          {disputes === null && !disputesError && <div className="krew-dash-loading-note">Loading…</div>}

          {disputes && disputes.length === 0 && (
            <div className="krew-dash-empty">
              <p>No disputes have been raised.</p>
            </div>
          )}

          {/* disputes.length > 0 but every one of them is already resolved - without this,
              the screen would show nothing above the Resolved section, which looks
              identical to the tab having failed to load rather than meaning "you're caught
              up". */}
          {openDisputes && openDisputes.length === 0 && disputes && disputes.length > 0 && (
            <div className="krew-dash-empty">
              <p>No open disputes right now - you're caught up.</p>
            </div>
          )}

          {openDisputes && openDisputes.length > 0 && (
            <div className="krew-job-list">
              {openDisputes.map((dispute) => (
                <article className="krew-jc krew-adm-dispute" key={dispute.id}>
                  <div className="krew-jc-top">
                    <ListingPhoto listing={{ category: dispute.category }} className="krew-jc-photo" />
                    <div className="krew-jc-main">
                      <h3 className="krew-jc-title">{dispute.title || 'Direct hire'}</h3>
                      <span className="krew-jc-meta">
                        <span>
                          Organizer: <strong>{dispute.organizer_name}</strong>
                        </span>
                        <span>
                          Crew: <strong>{dispute.crew_member_name}</strong>
                        </span>
                        <span>Due {formatDate(dispute.due_date)}</span>
                      </span>
                      {dispute.job_description && <p className="krew-jc-desc">{dispute.job_description}</p>}
                    </div>
                    <div className="krew-jc-side">
                      <span className="krew-jc-amount">KES {Number(dispute.amount).toLocaleString()}</span>
                      <span className="krew-status-pill disputed">Opened {formatServerDay(dispute.created_at)}</span>
                    </div>
                  </div>

                  <div className="krew-adm-reason">
                    <Megaphone size={20} strokeWidth={1.4} aria-hidden="true" />
                    <div>
                      <span className="krew-adm-reason-by">
                        Raised by {dispute.raised_by_name} ({roleLabel(dispute.raised_by_role).toLowerCase()})
                      </span>
                      <p>“{dispute.reason}”</p>
                      {dispute.details && <p className="krew-adm-reason-details">{dispute.details}</p>}
                    </div>
                  </div>

                  <div className="krew-jc-track" aria-label="What each side confirmed">
                    {renderAmountStep(dispute.organizer_name, dispute.organizer_confirmed_at, dispute.organizer_confirmed_amount)}
                    <span className="krew-jc-track-line" aria-hidden="true" />
                    {renderAmountStep(dispute.crew_member_name, dispute.crew_confirmed_at, dispute.crew_confirmed_amount)}
                  </div>

                  {resolvingId !== dispute.id && (
                    <div className="krew-jc-actions">
                      <button
                        type="button"
                        className="krew-button-primary krew-button-inline krew-db-small-btn"
                        onClick={() => openResolveForm(dispute.id)}
                      >
                        Resolve <ArrowRight size={15} strokeWidth={2} />
                      </button>
                    </div>
                  )}

                  {resolvingId === dispute.id && (
                    <div className="krew-adm-resolve">
                      {resolveError && <div className="krew-form-banner error">{resolveError}</div>}

                      <div className="krew-adm-outcomes" role="radiogroup" aria-label="Outcome">
                        <label className={`krew-adm-outcome ${outcome === 'confirm' ? 'selected' : ''}`}>
                          <input
                            type="radio"
                            name={`outcome-${dispute.id}`}
                            value="confirm"
                            checked={outcome === 'confirm'}
                            onChange={() => setOutcome('confirm')}
                          />
                          <span>
                            <strong>The job was paid - confirm it</strong>
                            <small>You set the final amount. It counts toward both records, like an agreed confirmation.</small>
                          </span>
                        </label>
                        <label className={`krew-adm-outcome ${outcome === 'reopen' ? 'selected' : ''}`}>
                          <input
                            type="radio"
                            name={`outcome-${dispute.id}`}
                            value="reopen"
                            checked={outcome === 'reopen'}
                            onChange={() => setOutcome('reopen')}
                          />
                          <span>
                            <strong>Reopen it</strong>
                            <small>Both confirmations are cleared so each side confirms again from scratch.</small>
                          </span>
                        </label>
                      </div>

                      {outcome === 'confirm' && (
                        <div className="krew-field">
                          <label className="krew-field-label" htmlFor={`final-amount-${dispute.id}`}>Final amount</label>
                          <span className="krew-jc-input">
                            <span aria-hidden="true">KES</span>
                            <input
                              id={`final-amount-${dispute.id}`}
                              type="number"
                              min="0"
                              className="krew-field-input"
                              value={finalAmount}
                              onChange={(e) => setFinalAmount(e.target.value)}
                            />
                          </span>
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
                          placeholder="Explain what you decided and why - both sides are notified and it's kept as part of the record."
                        />
                      </div>

                      <div className="krew-jc-form-row">
                        <button
                          type="button"
                          className="krew-button-primary krew-button-inline krew-db-small-btn"
                          disabled={resolveSubmitting}
                          onClick={() => handleResolve(dispute.id)}
                        >
                          {resolveSubmitting ? 'Saving…' : 'Save resolution'}
                        </button>
                        <button type="button" className="krew-dash-text-btn" onClick={() => setResolvingId(null)} disabled={resolveSubmitting}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}

          {resolvedDisputes && resolvedDisputes.length > 0 && (
            <section className="krew-adm-resolved">
              <button
                type="button"
                className={`krew-adm-resolved-toggle ${showResolved ? 'open' : ''}`}
                onClick={() => setShowResolved((current) => !current)}
                aria-expanded={showResolved}
              >
                Resolved ({resolvedDisputes.length})
                <ChevronDown size={18} strokeWidth={1.75} aria-hidden="true" />
              </button>
              {showResolved && (
                <ul className="krew-adm-list krew-adm-list-card">
                  {resolvedDisputes.map((dispute) => (
                    <li className="krew-adm-row resolved" key={dispute.id}>
                      <BadgeCheck className="krew-adm-row-icon" size={22} strokeWidth={1.4} aria-hidden="true" />
                      <div className="krew-adm-row-main">
                        <strong>
                          {dispute.title || 'Direct hire'} · {dispute.organizer_name} &amp; {dispute.crew_member_name}
                        </strong>
                        <span>
                          KES {Number(dispute.amount).toLocaleString()} · resolved {formatServerDay(dispute.resolved_at)}
                        </span>
                        {dispute.resolution_notes && <p>{dispute.resolution_notes}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}

      {section === 'analytics' && (
        <>
          <div className="krew-db-head">
            <h1>Analytics</h1>
            <p>Live counts from KREW's own records. Payments are only counted once both sides confirmed them (or an admin settled a dispute) - KREW tracks payments, it doesn't process them.</p>
          </div>

          {stats === null && <div className="krew-dash-loading-note">Loading…</div>}

          {stats && (
            <div className="krew-adm-analytics">
              <section className="krew-db-card">
                <div className="krew-db-card-head">
                  <h2>People</h2>
                </div>
                <dl className="krew-adm-figures">
                  <div><dt>Approved crew</dt><dd>{stats.users.crew}</dd></div>
                  <div><dt>Approved organizers</dt><dd>{stats.users.organizers}</dd></div>
                  <div><dt>Waiting for approval</dt><dd>{stats.users.pending}</dd></div>
                  <div><dt>Rejected</dt><dd>{stats.users.rejected}</dd></div>
                  <div><dt>Joined in the last 7 days</dt><dd>{stats.users.joined_last_7_days}</dd></div>
                </dl>
              </section>

              <section className="krew-db-card">
                <div className="krew-db-card-head">
                  <h2>Gigs</h2>
                </div>
                <dl className="krew-adm-figures">
                  <div><dt>Open</dt><dd>{stats.listings.open}</dd></div>
                  <div><dt>Filled</dt><dd>{stats.listings.filled}</dd></div>
                  <div><dt>Cancelled</dt><dd>{stats.listings.cancelled}</dd></div>
                  <div><dt>Applications sent</dt><dd>{stats.listings.applications}</dd></div>
                </dl>
              </section>

              <section className="krew-db-card">
                <div className="krew-db-card-head">
                  <h2>Jobs &amp; payments</h2>
                </div>
                <dl className="krew-adm-figures">
                  <div><dt>Jobs created</dt><dd>{stats.jobs.total}</dd></div>
                  <div><dt>Awaiting confirmation</dt><dd>{stats.jobs.pending}</dd></div>
                  <div><dt>Paid and confirmed</dt><dd>{stats.jobs.confirmed}</dd></div>
                  <div><dt>Disputed</dt><dd>{stats.jobs.disputed}</dd></div>
                  <div><dt>Confirmed payment volume</dt><dd>KES {Number(stats.jobs.confirmed_volume).toLocaleString()}</dd></div>
                </dl>
              </section>

              <section className="krew-db-card">
                <div className="krew-db-card-head">
                  <h2>Disputes</h2>
                </div>
                <dl className="krew-adm-figures">
                  <div><dt>Open</dt><dd>{stats.disputes.open}</dd></div>
                  <div><dt>Resolved</dt><dd>{stats.disputes.resolved}</dd></div>
                </dl>
              </section>
            </div>
          )}
        </>
      )}
    </DashboardShell>
  );
}
