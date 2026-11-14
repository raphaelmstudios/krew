// Site-wide motion: scroll reveals, parallax, magnetic buttons and click ripples.
// Started once from main.jsx. Pages opt in with data attributes, so the effects survive a
// redesign as long as the attributes are kept:
//
//   data-reveal             fades and rises into view the first time it scrolls on screen
//   data-reveal-children    every direct child reveals, staggered (lists, grids, hero copy)
//   data-parallax="0.1"     drifts at a different speed to the page while scrolling (desktop)
//   data-parallax-clamp="down"  only ever drifts downward (for shapes pinned to a bottom edge)
//   data-magnetic           leans toward the cursor while it's over the element (mouse only)
//
// Two effects work from class names instead, so every card and form gets them without
// extra markup: cards in TILT_TARGETS tip toward the cursor in 3D, and error messages
// (.krew-form-banner.error, .krew-field-error) shake when they appear or change.
//
// If the visitor has asked their device for reduced motion, none of this runs and every
// element simply shows as normal. Without the 'krew-motion' class on <html> nothing is hidden,
// so a script failure can never leave content invisible.

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
const wideScreen = window.matchMedia('(min-width: 861px)');

export function prefersReducedMotion() {
  return reduceMotion.matches;
}

export function startMotion() {
  if (reduceMotion.matches) return;
  document.documentElement.classList.add('krew-motion');
  startRipples();
  startReveals();
  startParallax();
  startMagnetic();
  startTilt();
  startFeedback();
}

// --- Scroll reveals ----------------------------------------------------------------------
// Elements that enter the screen together (a row of cards, a hero's heading and text) are
// staggered in the order they appear on the page.
const STAGGER_MS = 80;
const MAX_STAGGER_STEPS = 6;

function startReveals() {
  if (typeof IntersectionObserver === 'undefined') {
    document.documentElement.classList.remove('krew-motion');
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      const entering = entries.filter((entry) => entry.isIntersecting).map((entry) => entry.target);
      entering.forEach((element, index) => {
        if (!element.style.getPropertyValue('--reveal-delay')) {
          element.style.setProperty('--reveal-delay', `${Math.min(index, MAX_STAGGER_STEPS) * STAGGER_MS}ms`);
        }
        element.setAttribute('data-revealed', '');
        observer.unobserve(element);
      });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0 }
  );

  const watched = new WeakSet();

  function scan() {
    document.querySelectorAll('[data-reveal-children]').forEach((group) => {
      for (const child of group.children) {
        // A child that staggers its own children is revealed through them instead.
        if (child.hasAttribute('data-reveal') || child.hasAttribute('data-reveal-children')) continue;
        child.setAttribute('data-reveal', '');
      }
    });
    document.querySelectorAll('[data-reveal]:not([data-revealed])').forEach((element) => {
      if (watched.has(element)) return;
      watched.add(element);
      observer.observe(element);
    });
  }

  // Pages and lists load after the first paint (and change as filters change), so new
  // elements are picked up as React adds them.
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      scan();
    });
  }).observe(document.body, { childList: true, subtree: true });

  scan();
}

// --- Parallax ----------------------------------------------------------------------------
// Position is measured from the element's parent, so the drift never feeds back into the
// measurement. Uses the CSS `translate` property, which stacks with any transform the
// element already has (hover lifts, rotations).
const MAX_DRIFT = 140;

function startParallax() {
  let frameQueued = false;

  function update() {
    frameQueued = false;
    const items = document.querySelectorAll('[data-parallax]');
    if (!wideScreen.matches) {
      items.forEach((element) => {
        element.style.translate = '';
      });
      return;
    }
    const viewportMiddle = window.innerHeight / 2;
    items.forEach((element) => {
      const host = element.parentElement;
      if (!host) return;
      const rect = host.getBoundingClientRect();
      if (rect.bottom < -200 || rect.top > window.innerHeight + 200) return;
      const factor = Number.parseFloat(element.dataset.parallax) || 0;
      let drift = (viewportMiddle - (rect.top + rect.height / 2)) * factor;
      if (element.dataset.parallaxClamp === 'down') drift = Math.max(0, drift);
      drift = Math.max(-MAX_DRIFT, Math.min(MAX_DRIFT, drift));
      element.style.translate = `0 ${drift.toFixed(1)}px`;
    });
  }

  function queue() {
    if (frameQueued) return;
    frameQueued = true;
    requestAnimationFrame(update);
  }

  window.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('resize', queue);
  // New pages bring new parallax elements.
  new MutationObserver(queue).observe(document.body, { childList: true, subtree: true });
  queue();
}

// --- Magnetic buttons --------------------------------------------------------------------
// The button drifts a few pixels toward the cursor, then springs back when it leaves.
const MAGNET_PULL = 0.28;
const MAGNET_LIMIT = 9;

function startMagnetic() {
  let current = null;

  function release() {
    if (!current) return;
    current.style.removeProperty('--mx');
    current.style.removeProperty('--my');
    current = null;
  }

  document.addEventListener(
    'pointermove',
    (event) => {
      if (!finePointer.matches || event.pointerType !== 'mouse') return;
      const target = event.target instanceof Element ? event.target.closest('[data-magnetic]') : null;
      if (target !== current) release();
      if (!target) return;
      current = target;
      const rect = target.getBoundingClientRect();
      const clamp = (value) => Math.max(-MAGNET_LIMIT, Math.min(MAGNET_LIMIT, value));
      const x = clamp((event.clientX - (rect.left + rect.width / 2)) * MAGNET_PULL);
      const y = clamp((event.clientY - (rect.top + rect.height / 2)) * MAGNET_PULL);
      target.style.setProperty('--mx', `${x.toFixed(1)}px`);
      target.style.setProperty('--my', `${y.toFixed(1)}px`);
    },
    { passive: true }
  );
  document.addEventListener('pointerleave', release);
  window.addEventListener('blur', release);
}

// --- Click ripples -------------------------------------------------------------------------
// A soft circle spreads from wherever the button was pressed.
const RIPPLE_TARGETS = '.krew-button-primary, .krew-button-secondary';

function startRipples() {
  document.addEventListener(
    'pointerdown',
    (event) => {
      if (event.button !== 0) return;
      const button = event.target instanceof Element ? event.target.closest(RIPPLE_TARGETS) : null;
      if (!button || button.disabled || button.getAttribute('aria-disabled') === 'true') return;
      const rect = button.getBoundingClientRect();
      const size = Math.hypot(rect.width, rect.height) * 2;
      const ripple = document.createElement('span');
      ripple.className = 'krew-ripple';
      ripple.setAttribute('aria-hidden', 'true');
      ripple.style.width = `${size}px`;
      ripple.style.height = `${size}px`;
      ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
      button.appendChild(ripple);
      ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
      // Fallback in case the animation never runs (tab hidden mid-click).
      setTimeout(() => ripple.remove(), 1200);
    },
    { passive: true }
  );
}

// --- 3D tilt -----------------------------------------------------------------------------
// The card tips a few degrees toward the cursor, as if it were a real object with depth.
// Sets --rx / --ry, which motion.css feeds into the card's transform.
const TILT_TARGETS = '.krew-trust-card, .krew-hc-card';
const TILT_MAX_DEGREES = 5;

function startTilt() {
  let current = null;

  function release() {
    if (!current) return;
    current.style.removeProperty('--rx');
    current.style.removeProperty('--ry');
    current = null;
  }

  document.addEventListener(
    'pointermove',
    (event) => {
      if (!finePointer.matches || event.pointerType !== 'mouse') return;
      const card = event.target instanceof Element ? event.target.closest(TILT_TARGETS) : null;
      if (card !== current) release();
      if (!card) return;
      current = card;
      const rect = card.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5; // -0.5 (left) to 0.5 (right)
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      card.style.setProperty('--rx', `${(-y * TILT_MAX_DEGREES * 2).toFixed(2)}deg`);
      card.style.setProperty('--ry', `${(x * TILT_MAX_DEGREES * 2).toFixed(2)}deg`);
    },
    { passive: true }
  );
  document.addEventListener('pointerleave', release);
  window.addEventListener('blur', release);
}

// --- Feedback ------------------------------------------------------------------------------
// An error shakes its head (a quick, damped side-to-side), so it's noticed even when the eye
// is on the button; a success message pops in. Runs again whenever the message text changes,
// so a second failed attempt is acknowledged too, not met with a message that just sits there.
const ERROR_SELECTOR = '.krew-form-banner.error, .krew-field-error';
const SUCCESS_SELECTOR = '.krew-form-banner.success';

function startFeedback() {
  if (typeof Element.prototype.animate !== 'function') return;

  function play(element) {
    if (element.matches(ERROR_SELECTOR)) {
      element.animate(
        { translate: ['0 0', '-9px 0', '8px 0', '-6px 0', '4px 0', '-2px 0', '0 0'] },
        { duration: 460, easing: 'ease-out' }
      );
    } else if (element.matches(SUCCESS_SELECTOR)) {
      element.animate(
        { scale: ['0.94', '1.02', '1'], opacity: [0, 1, 1] },
        { duration: 420, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }
      );
    }
  }

  const selector = `${ERROR_SELECTOR}, ${SUCCESS_SELECTOR}`;
  new MutationObserver((mutations) => {
    const touched = new Set();
    for (const mutation of mutations) {
      const node = mutation.target.nodeType === Node.ELEMENT_NODE ? mutation.target : mutation.target.parentElement;
      const changed = node?.closest(selector);
      if (changed) touched.add(changed);
      mutation.addedNodes.forEach((added) => {
        if (!(added instanceof Element)) return;
        if (added.matches(selector)) touched.add(added);
        added.querySelectorAll(selector).forEach((inner) => touched.add(inner));
      });
    }
    touched.forEach(play);
  }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class'] });
}
