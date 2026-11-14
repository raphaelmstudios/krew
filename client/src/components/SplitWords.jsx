import { Fragment } from 'react';

// Splits a line of text into words that rise into place one after another (the hero
// headlines). Each word sits in a clipping box, so it slides up out of nothing rather than
// fading. `start` continues the count from an earlier piece of the same headline, so the
// stagger runs straight through italic or coloured words.
//
// The animation itself lives in index.css under .krew-motion, so with reduced motion on
// (or if the motion script never runs) the words are just ordinary text.
export default function SplitWords({ text, start = 0 }) {
  const words = text.split(' ').filter(Boolean);
  // The space between words sits outside each clipping box - a space at the end of an
  // inline-block is dropped by the browser, which would run the words together.
  return words.map((word, index) => (
    <Fragment key={`${word}-${index}`}>
      <span className="krew-word">
        <span className="krew-word-inner" style={{ '--i': start + index }}>
          {word}
        </span>
      </span>
      {index < words.length - 1 ? ' ' : null}
    </Fragment>
  ));
}
