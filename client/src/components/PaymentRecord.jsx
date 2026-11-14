import { Check, Clock } from 'lucide-react';

// An organizer's payment record, drawn rather than listed:
// - the on-time rate as one big figure, with a meter under it,
// - their latest payments as a row of marks, oldest to latest - a check for on time, a clock
//   for late - so a run of late payments (or a recent turnaround) is visible at a glance,
// - the job count and how early or late they usually pay.
// Used on the organizer's own dashboard and on each gig's Organizer tab, so crew see exactly
// what the organizer sees. Everything comes from payments both sides confirmed.

function plural(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

// "1 day early", "3 days late", "on time" - from days relative to the due date
// (negative is before it).
function timingPhrase(days) {
  const rounded = Math.round(Math.abs(days));
  if (days > 0) return `${plural(Math.max(1, rounded), 'day')} late`;
  if (rounded === 0) return 'on time';
  return `${plural(rounded, 'day')} early`;
}

function formatPaidOn(value) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export default function PaymentRecord({ record }) {
  const percentage = record.on_time_percentage ?? 0;
  const onTimeCount = record.on_time_count ?? Math.round((percentage / 100) * record.confirmed_job_count);
  const recent = record.recent_payments || [];
  const usual = record.median_days_to_payment;

  return (
    <div className="krew-prec">
      <div className="krew-prec-hero">
        <span className="krew-prec-figure">{percentage}%</span>
        <span className="krew-prec-figure-label">
          paid on time
          <span className="krew-prec-figure-sub">
            {onTimeCount} of {plural(record.confirmed_job_count, 'job')} paid on or before the due date
          </span>
        </span>
      </div>

      <div
        className="krew-prec-meter"
        role="img"
        aria-label={`${percentage}% of payments made on or before the due date`}
      >
        <span style={{ width: `${percentage}%` }} />
      </div>

      {recent.length > 0 && (
        <div className="krew-prec-recent">
          <div className="krew-prec-recent-head">
            <span className="krew-prec-recent-title">Last {plural(recent.length, 'payment')}</span>
            <span className="krew-prec-legend" aria-hidden="true">
              <span><i className="on" /> On time</span>
              <span><i className="late" /> Late</span>
            </span>
          </div>
          <ol className="krew-prec-cells" aria-label={`Last ${plural(recent.length, 'payment')}, oldest first`}>
            {recent.map((payment, index) => {
              const tip = `Paid ${formatPaidOn(payment.paid_on)} · ${timingPhrase(payment.days)}`;
              return (
                // Each mark can be focused, so keyboard users get the same detail as the hover.
                <li key={index} className={payment.on_time ? 'on' : 'late'} tabIndex={0} data-tip={tip} aria-label={tip}>
                  {payment.on_time ? <Check size={14} strokeWidth={2.5} /> : <Clock size={14} strokeWidth={2.25} />}
                </li>
              );
            })}
          </ol>
          <div className="krew-prec-ends" aria-hidden="true">
            <span>Oldest</span>
            <span>Latest</span>
          </div>
        </div>
      )}

      <dl className="krew-prec-facts">
        <div>
          <dt>Jobs paid and confirmed</dt>
          <dd>{record.confirmed_job_count}</dd>
        </div>
        {usual !== null && usual !== undefined && (
          <div>
            <dt>Usually paid</dt>
            <dd>{timingPhrase(usual).replace(/^o/, 'O')}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
