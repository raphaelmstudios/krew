import { createElement, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pause, Play } from 'lucide-react';
import { categoryIcon } from './ListingPhoto.jsx';
import { prefersReducedMotion } from '../motion.js';

// The homepage hero's moving row of cards: event photos and crew roles, drifting slowly
// sideways along a curve - the cards at the edges are larger and turned toward the middle,
// as if the row wraps around you. Each card opens Find Work filtered to that kind of work.
//
// Photos are labelled with the kind of event or work in them, never a name, so nobody in a
// photo is presented as a particular KREW member. To use new photos, add them to
// public/images/home/ and list them in CARDS below.
//
// The row pauses while the pointer is over it or a card has keyboard focus, and has its own
// pause button (moving content needs one). With reduced motion on it doesn't move at all.
const CARDS = [
  { type: 'photo', src: '/images/home/people-1.webp', focus: '78% center', label: 'Sound & AV', category: 'Sound & AV' },
  { type: 'role', label: 'Bar service', category: 'Bar Service', tone: 'plum' },
  { type: 'photo', src: '/images/auth/login-register.webp', focus: 'center 30%', label: 'Live music', category: 'Other' },
  { type: 'role', label: 'Security', category: 'Security', tone: 'violet' },
  { type: 'photo', src: '/images/home/people-2.webp', focus: '80% center', label: 'Lighting', category: 'Sound & AV' },
  { type: 'role', label: 'Ushering', category: 'Ushering & Guest Services', tone: 'lavender' },
  { type: 'photo', src: '/images/home/organizer-card.webp', focus: '45% center', label: 'DJ nights', category: 'Sound & AV' },
  { type: 'role', label: 'Photography', category: 'Photography & Videography', tone: 'plum' },
  { type: 'photo', src: '/images/home/crew-card.webp', focus: '58% center', label: 'Stage shows', category: 'Event Setup & Teardown' },
  { type: 'role', label: 'Catering', category: 'Catering', tone: 'violet' },
  { type: 'photo', src: '/images/home/hero.webp', focus: '40% center', label: 'Concerts', category: 'Other' },
  { type: 'role', label: 'Event setup', category: 'Event Setup & Teardown', tone: 'lavender' },
];

const SPEED_PX_PER_SECOND = 26;
const MAX_TURN_DEGREES = 30; // how far the edge cards turn toward the middle
const EDGE_GROWTH = 0.26; // how much bigger the edge cards are than the middle ones

function Card({ card, hidden }) {
  const to = `/find-work?category=${encodeURIComponent(card.category)}`;
  const linkProps = hidden ? { tabIndex: -1, 'aria-hidden': true } : { 'aria-label': `${card.label}: browse gigs` };
  if (card.type === 'photo') {
    return (
      <Link to={to} className="krew-hx-card photo" data-hx-card {...linkProps}>
        <span
          className="krew-hx-card-photo"
          style={{ backgroundImage: `url('${card.src}')`, backgroundPosition: card.focus }}
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
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

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
      if (!holdRef.current && !pausedRef.current) {
        offset -= (SPEED_PX_PER_SECOND * elapsed) / 1000;
        if (offset <= -setWidth) offset += setWidth;
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

  const reduced = typeof window !== 'undefined' && prefersReducedMotion();

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
      {!reduced && (
        <button
          type="button"
          className="krew-hx-pause"
          onClick={() => setPaused((current) => !current)}
          aria-label={paused ? 'Play the moving cards' : 'Pause the moving cards'}
          aria-pressed={paused}
        >
          {paused ? <Play size={15} strokeWidth={2} /> : <Pause size={15} strokeWidth={2} />}
        </button>
      )}
    </div>
  );
}
