import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Info } from 'lucide-react';

// This component renders an info icon that, when clicked, displays a tooltip with additional information.
// It uses a popover that can be dismissed by clicking outside of it, and it includes a link to the FAQ for more details.
// The tooltip is designed to be accessible, with appropriate ARIA attributes for screen readers.
export default function InfoTooltip({ text }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <span className="krew-info-tooltip" ref={wrapperRef}>
      <button
        type="button"
        className="krew-info-tooltip-trigger"
        onClick={(e) => {
          // Prevent the click from propagating to the document, which would immediately close the tooltip due to the outside click handler.
          // This ensures that clicking the info icon toggles the tooltip open and closed without interference.
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        aria-label="What does this mean?"
      >
        <Info size={15} strokeWidth={1.6} />
      </button>
      {open && (
        <span className="krew-info-tooltip-popover" role="tooltip">
          <span className="krew-info-tooltip-text">{text}</span>
          <Link to="/faq" className="krew-info-tooltip-link" onClick={(e) => e.stopPropagation()}>
            More in the FAQ
          </Link>
        </span>
      )}
    </span>
  );
}