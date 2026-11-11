import { Link } from 'react-router-dom';

// The KREW logo, always linking back to the homepage.
// variant: "full" = K mark + KREW text, "mark" = the K on its own.
// tone: "auto" swaps to the light version in dark mode (CSS in index.css decides which
// image shows), "light" always uses the light version - for logos sitting on a dark
// plum panel (footer, auth panel) regardless of the page theme.
export default function Logo({ variant = 'full', tone = 'auto', className = '', onClick }) {
  const base = variant === 'mark' ? '/brand/krew-mark' : '/brand/krew-logo';

  return (
    <Link to="/" className={`krew-logo krew-logo-${variant} ${className}`} onClick={onClick} aria-label="KREW home">
      {tone === 'auto' && <img src={`${base}.png`} alt="" className="krew-logo-for-light" />}
      <img src={`${base}-light.png`} alt="" className={tone === 'auto' ? 'krew-logo-for-dark' : ''} />
    </Link>
  );
}
