import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import Logo from './Logo.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import { prefersReducedMotion } from '../motion.js';

// The links in the public navigation bar, in order. Each one either scrolls to a section of
// the homepage (href) or opens another page (to). `match` lists the paths that count as
// being "on" that link, so a gig's own page still shows Find Work as the current section.
const NAV_LINKS = [
  { label: 'About', href: '#about' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Find Work', to: '/find-work', match: ['/find-work', '/gigs/'] },
  { label: 'Hire Crew', to: '/hire-crew', match: ['/hire-crew', '/crew/'] },
];

function findActiveIndex(pathname) {
  const index = NAV_LINKS.findIndex((link) => link.match?.some((path) => pathname.startsWith(path)));
  return index === -1 ? null : index;
}

// --- The blob ------------------------------------------------------------------------------
// A soft shape behind the links that follows the cursor across the bar. It's pulled toward
// whichever link the cursor is over, but still leans toward the cursor inside it, and it
// stretches in the direction it's moving and squashes back when it lands, like something
// with a little weight to it. Lavender while you browse; it fills violet when you press a
// link, and stays violet on the page you're currently on.
//
// The motion is a small spring run with requestAnimationFrame, writing straight to the
// element's style so the page doesn't re-render 60 times a second.
const SPRING_STIFFNESS = 0.15;
const SPRING_DAMPING = 0.74;
const CURSOR_LEAN = 0.24; // how far the blob leans from the link's centre toward the cursor
const PRESS_HOLD_MS = 380; // how long the violet fill lingers after pressing a section link

function NavLinks({ activeIndex, onSectionLink }) {
  const navRef = useRef(null);
  const blobRef = useRef(null);
  const linkRefs = useRef([]);
  const sim = useRef({ x: 0, w: 0, vx: 0, vw: 0, tx: 0, tw: 0, placed: false, frame: 0 });
  const releaseTimer = useRef(0);
  const [hoverIndex, setHoverIndex] = useState(null);
  const [pressed, setPressed] = useState(false);

  // Where the blob is (or is heading): the hovered link, otherwise the current page's link.
  const blobIndex = hoverIndex ?? activeIndex;
  const filled = pressed || (blobIndex !== null && blobIndex === activeIndex);

  const draw = useCallback((speed = 0) => {
    const blob = blobRef.current;
    if (!blob) return;
    const s = sim.current;
    const stretch = 1 + speed / 130;
    const squash = 1 - speed / 420;
    blob.style.width = `${s.w.toFixed(2)}px`;
    blob.style.transform = `translateX(${(s.x - s.w / 2).toFixed(2)}px) scale(${stretch.toFixed(3)}, ${squash.toFixed(3)})`;
  }, []);

  const step = useCallback(function tick() {
    const s = sim.current;
    s.vx = (s.vx + (s.tx - s.x) * SPRING_STIFFNESS) * SPRING_DAMPING;
    s.vw = (s.vw + (s.tw - s.w) * SPRING_STIFFNESS) * SPRING_DAMPING;
    s.x += s.vx;
    s.w += s.vw;
    const settled =
      Math.abs(s.tx - s.x) < 0.25 && Math.abs(s.tw - s.w) < 0.25 && Math.abs(s.vx) < 0.05 && Math.abs(s.vw) < 0.05;
    if (settled) {
      s.x = s.tx;
      s.w = s.tw;
      s.vx = 0;
      s.vw = 0;
      s.frame = 0;
      draw(0);
      return;
    }
    draw(Math.min(Math.abs(s.vx), 40));
    s.frame = requestAnimationFrame(tick);
  }, [draw]);

  // Point the blob at a link. cursorX (relative to the bar) makes it lean toward the cursor;
  // `snap` places it instantly (first appearance, window resize) instead of springing there.
  const aim = useCallback(
    (index, cursorX = null, snap = false) => {
      const nav = navRef.current;
      const link = linkRefs.current[index];
      if (!nav || !link) return;
      const navRect = nav.getBoundingClientRect();
      const linkRect = link.getBoundingClientRect();
      const center = linkRect.left - navRect.left + linkRect.width / 2;
      const s = sim.current;
      s.tx = cursorX === null ? center : center + (cursorX - center) * CURSOR_LEAN;
      s.tw = linkRect.width;
      if (snap || !s.placed || prefersReducedMotion()) {
        cancelAnimationFrame(s.frame);
        s.frame = 0;
        s.x = s.tx;
        s.w = s.tw;
        s.vx = 0;
        s.vw = 0;
        s.placed = true;
        draw(0);
        return;
      }
      if (!s.frame) s.frame = requestAnimationFrame(step);
    },
    [draw, step]
  );

  // Rest on the current page's link when the cursor isn't over the bar (and on first draw).
  useLayoutEffect(() => {
    if (hoverIndex !== null) return;
    if (activeIndex === null) {
      sim.current.placed = false; // hidden: next hover appears in place rather than flying in
      return;
    }
    aim(activeIndex);
  }, [activeIndex, hoverIndex, aim]);

  // Link widths change when the window resizes or the web font finishes loading.
  useEffect(() => {
    const reposition = () => {
      const index = hoverIndex ?? activeIndex;
      if (index !== null) aim(index, null, true);
    };
    window.addEventListener('resize', reposition);
    document.fonts?.ready.then(reposition).catch(() => {});
    return () => window.removeEventListener('resize', reposition);
  }, [hoverIndex, activeIndex, aim]);

  useEffect(
    () => () => {
      cancelAnimationFrame(sim.current.frame);
      clearTimeout(releaseTimer.current);
    },
    []
  );

  function indexFromEvent(event) {
    const link = event.target instanceof Element ? event.target.closest('[data-nav-index]') : null;
    return link ? Number(link.dataset.navIndex) : null;
  }

  function handlePointerMove(event) {
    if (event.pointerType !== 'mouse') return;
    const overIndex = indexFromEvent(event);
    // In the gaps between links, keep following the last link rather than dropping out.
    const index = overIndex ?? hoverIndex;
    if (index === null) return;
    if (index !== hoverIndex) setHoverIndex(index);
    const navRect = navRef.current.getBoundingClientRect();
    aim(index, event.clientX - navRect.left);
  }

  function handlePointerLeave() {
    setHoverIndex(null);
    setPressed(false);
  }

  function handlePointerDown(event) {
    if (event.button !== 0) return;
    const index = indexFromEvent(event);
    if (index === null) return;
    clearTimeout(releaseTimer.current);
    if (index !== hoverIndex) {
      setHoverIndex(index);
      aim(index);
    }
    setPressed(true);
  }

  function handlePointerUp() {
    clearTimeout(releaseTimer.current);
    releaseTimer.current = setTimeout(() => setPressed(false), PRESS_HOLD_MS);
  }

  // Keyboard focus moves the blob too. A mouse click also focuses the link, but the
  // pointer handlers already have the blob there, leaning toward the cursor.
  function handleFocus(event, index) {
    if (!event.currentTarget.matches(':focus-visible')) return;
    setHoverIndex(index);
    aim(index);
  }

  function handleBlur(event) {
    if (!navRef.current?.contains(event.relatedTarget)) setHoverIndex(null);
  }

  const blobClass = [
    'krew-public-nav-blob',
    blobIndex !== null ? 'is-visible' : '',
    filled ? 'is-filled' : '',
    pressed ? 'is-pressed' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <nav
      className="krew-public-nav-links"
      ref={navRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onBlur={handleBlur}
      aria-label="Main"
    >
      <span className={blobClass} ref={blobRef} aria-hidden="true" />
      {NAV_LINKS.map((link, index) => {
        const className = `krew-public-nav-link${index === blobIndex && filled ? ' is-on-fill' : ''}`;
        const shared = {
          className,
          'data-nav-index': index,
          ref: (element) => {
            linkRefs.current[index] = element;
          },
          onFocus: (event) => handleFocus(event, index),
        };
        return link.to ? (
          <Link key={link.label} to={link.to} aria-current={index === activeIndex ? 'page' : undefined} {...shared}>
            {link.label}
          </Link>
        ) : (
          <a key={link.label} href={`/${link.href}`} onClick={(event) => onSectionLink(event, link.href)} {...shared}>
            {link.label}
          </a>
        );
      })}
    </nav>
  );
}

export default function PublicNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [session, setSession] = useState(undefined); // undefined = still checking, null = logged out
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const progressRef = useRef(null);
  const activeIndex = findActiveIndex(location.pathname);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/session')
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled) setSession(data?.user ?? null);
      })
      .catch(() => {
        if (!cancelled) setSession(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Once the page scrolls, the bar turns frosted with a soft shadow, and a thin violet line
  // along its bottom edge shows how far down the page you are.
  useEffect(() => {
    let frameQueued = false;
    function update() {
      frameQueued = false;
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const progress = scrollable > 40 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0;
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${progress.toFixed(4)})`;
      setScrolled(window.scrollY > 8);
    }
    function queue() {
      if (frameQueued) return;
      frameQueued = true;
      requestAnimationFrame(update);
    }
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    queue();
    return () => {
      window.removeEventListener('scroll', queue);
      window.removeEventListener('resize', queue);
    };
  }, []);

  // A link to a section of the homepage scrolls there if we're already on the homepage,
  // otherwise it opens the homepage at that section.
  function handleSectionLink(event, href) {
    event.preventDefault();
    setMobileOpen(false);
    if (location.pathname === '/') {
      document.querySelector(href)?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    } else {
      navigate(`/${href}`);
    }
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setSession(null);
    setMobileOpen(false);
  }

  const dashboardPath = session?.role === 'admin' ? '/admin' : '/dashboard';

  return (
    <header className={`krew-public-nav${scrolled ? ' is-scrolled' : ''}`}>
      <div className="krew-public-nav-inner">
        <Logo className="krew-public-nav-logo" onClick={() => setMobileOpen(false)} />

        <NavLinks activeIndex={activeIndex} onSectionLink={handleSectionLink} />

        <div className="krew-public-nav-actions">
          <ThemeToggle />
          {session ? (
            <>
              <Link to={dashboardPath} className="krew-button-secondary krew-public-nav-btn" data-magnetic>
                Dashboard
              </Link>
              <button type="button" className="krew-dash-text-btn" onClick={handleLogout}>Log out</button>
            </>
          ) : (
            <Link to="/login" className="krew-button-primary krew-public-nav-btn" data-magnetic>
              Sign in
            </Link>
          )}
        </div>

        <ThemeToggle className="krew-public-nav-theme-mobile" />

        <button
          type="button"
          className="krew-public-nav-toggle"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((current) => !current)}
        >
          <span className="krew-public-nav-toggle-icon" key={mobileOpen ? 'close' : 'open'}>
            {mobileOpen ? <X size={22} strokeWidth={1.75} /> : <Menu size={22} strokeWidth={1.75} />}
          </span>
        </button>
      </div>

      {mobileOpen && (
        <nav className="krew-public-nav-mobile" aria-label="Main">
          {NAV_LINKS.map((link, index) =>
            link.to ? (
              <Link
                key={link.label}
                to={link.to}
                className="krew-public-nav-mobile-link"
                aria-current={index === activeIndex ? 'page' : undefined}
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ) : (
              <a
                key={link.label}
                href={`/${link.href}`}
                className="krew-public-nav-mobile-link"
                onClick={(event) => handleSectionLink(event, link.href)}
              >
                {link.label}
              </a>
            )
          )}
          <div className="krew-public-nav-mobile-actions">
            {session ? (
              <>
                <Link to={dashboardPath} className="krew-button-secondary krew-public-nav-btn" onClick={() => setMobileOpen(false)}>Dashboard</Link>
                <button type="button" className="krew-dash-text-btn" onClick={handleLogout}>Log out</button>
              </>
            ) : (
              <Link to="/login" className="krew-button-primary krew-public-nav-btn" onClick={() => setMobileOpen(false)}>Sign in</Link>
            )}
          </div>
        </nav>
      )}

      <span className="krew-public-nav-progress" ref={progressRef} aria-hidden="true" />
    </header>
  );
}
