import { Martini, UtensilsCrossed, ShieldCheck, Hammer, DoorOpen, Camera, AudioLines, Sparkles } from 'lucide-react';

// One icon per listing category - shown on the placeholder when an organizer hasn't
// uploaded a photo for their listing yet.
const CATEGORY_ICONS = {
  'Bar Service': Martini,
  Catering: UtensilsCrossed,
  Security: ShieldCheck,
  'Event Setup & Teardown': Hammer,
  'Ushering & Guest Services': DoorOpen,
  'Photography & Videography': Camera,
  'Sound & AV': AudioLines,
  Other: Sparkles,
};

// A listing's photo (uploaded by its organizer), or a branded placeholder - plum panel,
// violet shards and the category's icon - when there isn't one.
export default function ListingPhoto({ listing, className = '' }) {
  if (listing.photo_path) {
    return (
      <div className={`krew-listing-photo ${className}`}>
        <img src={`/uploads/${listing.photo_path}`} alt="" loading="lazy" />
      </div>
    );
  }

  const Icon = CATEGORY_ICONS[listing.category] || Sparkles;
  return (
    <div className={`krew-listing-photo placeholder ${className}`} aria-hidden="true">
      <span className="krew-shard krew-listing-photo-shard-1" />
      <span className="krew-shard krew-listing-photo-shard-2" />
      <Icon className="krew-listing-photo-icon" strokeWidth={1.3} />
    </div>
  );
}
