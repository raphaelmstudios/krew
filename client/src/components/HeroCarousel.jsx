import { createElement, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { categoryIcon } from './ListingPhoto.jsx';
import { prefersReducedMotion } from '../motion.js';

// The homepage hero's moving row of cards: event photos and crew roles, drifting slowly
// from left to right along a curve - the cards at the edges are larger and turned toward the middle,
// as if the row wraps around you. Each card opens Find Work filtered to that kind of work.
//
// Photos are labelled with the kind of event or work in them, never a name, so nobody in a
// photo is presented as a particular KREW member. To use new photos, add them to
// public/images/home/ and list them in CARDS below.
//
// Role cards show their line icon until a photo exists at their `src` (in
// public/images/home/roles/). Drop a photo there with that exact name and the card shows it
// instead - no code change needed.
//
// The row pauses while the pointer is over it or a card has keyboard focus. With reduced
// motion on it doesn't move at all.
const CARDS = [
  { type: 'photo', src: '/images/home/people-1.webp', focus: '78% center', label: 'Sound & AV', category: 'Sound & AV' },
  { type: 'role', label: 'Bar service', category: 'Bar Service', tone: 'plum', src: '/images/home/roles/bar-service.webp' },
  { type: 'photo', src: '/images/auth/login-register.webp', focus: 'center 30%', label: 'Live music', category: 'Other' },
  { type: 'role', label: 'Security', category: 'Security', tone: 'violet', src: '/images/home/roles/security.webp' },
  { type: 'photo', src: '/images/home/people-2.webp', focus: '80% center', label: 'Lighting', category: 'Sound & AV' },
  { type: 'role', label: 'Ushering', category: 'Ushering & Guest Services', tone: 'lavender', src: '/images/home/roles/ushering.webp' },
  { type: 'photo', src: '/images/home/organizer-card.webp', focus: '45% center', label: 'DJ nights', category: 'Sound & AV' },
  { type: 'role', label: 'Photography', category: 'Photography & Videography', tone: 'plum', src: '/images/home/roles/photography.webp' },
  { type: 'photo', src: '/images/home/crew-card.webp', focus: '58% center', label: 'Stage shows', category: 'Event Setup & Teardown' },
  { type: 'role', label: 'Catering', category: 'Catering', tone: 'violet', src: '/images/home/roles/catering.webp' },
  { type: 'photo', src: '/images/home/hero.webp', focus: '40% center', label: 'Concerts', category: 'Other' },
  { type: 'role', label: 'Event setup', category: 'Event Setup & Teardown', tone: 'lavender', src: '/images/home/roles/event-setup.webp' },
];

const SPEED_PX_PER_SECOND = 26;
const MAX_TURN_DEGREES = 30; // how far the edge cards turn toward the middle
const EDGE_GROWTH = 0.26; // how much bigger the edge cards are than the middle ones

// True once the role card's photo has loaded; false while it loads or if there isn't one yet.
function usePhotoExists(src) {
  const [exists, setExists] = useState(false);
  useEffect(() => {
    if (!src) return undefined;
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (!cancelled) setExists(true);
    };
    image.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);
  return exists;
}

function Card({ card, hidden }) {
  const to = `/find-work?category=${encodeURIComponent(card.category)}`;
  const linkProps = hidden ? { tabIndex: -1, 'aria-hidden': true } : { 'aria-label': `${card.label}: browse gigs` };
  const rolePhoto = usePhotoExists(card.type === 'role' ? card.src : null);
  if (card.type === 'photo' || rolePhoto) {
    return (
      <Link to={to} className="krew-hx-card photo" data-hx-card {...linkProps}>
        <span
          className="krew-hx-card-photo"
          style={{ backgroundImage: `url('${card.src}')`, backgroundPosition: card.focus || 'center' }}
          aria-hidden="true"
        />
        <span className="krew-hx-card-label">{card.label}</span>
      </Link>
    );
  }
  return (
    <Link to={to} className={`krew-hx-card role ${card.tone}`} data-hx-card {...linkProps}>
      <span className="krew-shard krew-hx-card-shard" aria-hidden="true" />
      {createElement(categoryIcon(card.category), { className: 'krew-hx-card-icon', strokeWidth: 1.2, 'aria-hidden': true })}
      <span className="krew-hx-card-label">{card.label}</span>
    </Link>
  );
}

export default function HeroCarousel() {
  const viewportRef = useRef(null);
  const trackRef = useRef(null);
  const holdRef = useRef(false); // pointer over the row, or a card focused
  useEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track) return undefined;

    let cards = [];
    let cardCenters = []; // each card's centre within the track, measured once (and on resize)
    let setWidth = 0; // width of one full set of cards - the row loops after this
    let viewportWidth = 0;
    let offset = 0;
    let frame = 0;
    let last = 0;

    function measure() {
      cards = [...track.querySelectorAll('[data-hx-card]')];
      cardCenters = cards.map((card) => card.offsetLeft + card.offsetWidth / 2);
      const firstOfSecondSet = cards[CARDS.length];
      setWidth = firstOfSecondSet ? firstOfSecondSet.offsetLeft - cards[0].offsetLeft : track.scrollWidth / 2;
      viewportWidth = viewport.clientWidth;
      // Start with the middle of the first set in the middle of the screen.
      if (!last) offset = -(setWidth / 2 - viewportWidth / 2);
    }

    function draw() {
      track.style.transform = `translate3d(${offset.toFixed(2)}px, 0, 0)`;
      const middle = viewportWidth / 2;
      for (let index = 0; index < cards.length; index += 1) {
        const position = (offset + cardCenters[index] - middle) / middle; // -1 left edge, 1 right edge
        const t = Math.max(-1.4, Math.min(1.4, position));
        const turn = -t * MAX_TURN_DEGREES;
        const scale = 1 + t * t * EDGE_GROWTH;
        cards[index].style.transform = `perspective(1100px) rotateY(${turn.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
      }
    }

    function tick(now) {
      const elapsed = last ? Math.min(64, now - last) : 0;
      last = now;
      // Drifts left to right: the row moves right, and jumps back one full set when it has
      // moved a whole set's width (the second copy of the cards makes the jump invisible).
      if (!holdRef.current) {
        offset += (SPEED_PX_PER_SECOND * elapsed) / 1000;
        if (offset > 0) offset -= setWidth;
      }
      draw();
      frame = requestAnimationFrame(tick);
    }

    measure();
    draw();
    if (!prefersReducedMotion()) frame = requestAnimationFrame(tick);

    const handleResize = () => {
      measure();
      draw();
    };
    window.addEventListener('resize', handleResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div className="krew-hx-carousel">
      <div
        className="krew-hx-viewport"
        ref={viewportRef}
        onPointerEnter={(event) => {
          if (event.pointerType === 'mouse') holdRef.current = true;
        }}
        onPointerLeave={() => {
          holdRef.current = false;
        }}
        onFocus={() => {
          holdRef.current = true;
        }}
        onBlur={() => {
          holdRef.current = false;
        }}
      >
        <div className="krew-hx-track" ref={trackRef} role="list" aria-label="Kinds of event work on KREW">
          {[0, 1].map((copy) =>
            CARDS.map((card, index) => (
              <div role="listitem" key={`${copy}-${index}`} className="krew-hx-slot" aria-hidden={copy === 1 || undefined}>
                <Card card={card} hidden={copy === 1} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
