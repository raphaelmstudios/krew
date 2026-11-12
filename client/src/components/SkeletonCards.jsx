// Placeholder cards shown while a public list (Find Work, Hire Crew) is loading - the same
// shape as the real cards, gently pulsing, so the page doesn't jump when the data arrives.
// Screen readers get the label instead of the empty shapes.
export default function SkeletonCards({ count = 3, label = 'Loading…', variant = 'list' }) {
  return (
    <div className={`krew-skeleton-${variant}`} role="status" aria-live="polite">
      <span className="krew-visually-hidden">{label}</span>
      {Array.from({ length: count }, (_, i) => (
        <div className="krew-skeleton-card" key={i} aria-hidden="true">
          <div className="krew-skeleton-block krew-skeleton-photo" />
          <div className="krew-skeleton-lines">
            <div className="krew-skeleton-block" style={{ width: '70%' }} />
            <div className="krew-skeleton-block" style={{ width: '40%' }} />
            <div className="krew-skeleton-block" style={{ width: '55%' }} />
          </div>
        </div>
      ))}
    </div>
  );
}
