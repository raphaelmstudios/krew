import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

// Lets people frame a photo before it's uploaded: drag to move it, and zoom with the slider,
// the mouse wheel, or two fingers on a phone. Only the part inside the frame is uploaded.
//
// Use it from any upload handler:
//   const cropped = await cropImage(file, { aspect: 4 / 5, title: 'Crop your profile photo' });
//   if (!cropped) return; // they cancelled
// cropImage opens the dialog on top of the page and resolves with a new File (or null).
//
// Options:
//   aspect            width divided by height of the frame (4 / 5 portrait, 1 square, 3 wide)
//   title             the dialog's heading
//   outputWidth       width of the uploaded image in pixels (height follows the aspect);
//                     never larger than the part of the original that was chosen
//   keepTransparency  keep PNGs as PNG (for logos); everything else becomes a JPG

const MAX_ZOOM = 4;
const STEP_PX = 12; // how far one arrow key press moves the photo

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function ImageCropDialog({ file, aspect, title, outputWidth, keepTransparency, onDone }) {
  const [source, setSource] = useState(null); // { url, width, height }
  const [frame, setFrame] = useState({ width: 320, height: 320 });
  // zoom, and the photo's top left corner relative to the frame (x, y), kept together so a
  // zoom and the move that goes with it always change in one step.
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const frameRef = useRef(null);
  const pointers = useRef(new Map());
  const gesture = useRef(null);

  // Load the chosen file.
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => setSource({ url, width: image.naturalWidth, height: image.naturalHeight, image });
    image.onerror = () => setError("That file couldn't be opened as a photo. Try a JPG or PNG.");
    image.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // The frame fills the space available, keeping its shape.
  useEffect(() => {
    function size() {
      const maxWidth = Math.min(460, window.innerWidth - 80);
      const maxHeight = Math.min(420, window.innerHeight * 0.5);
      let width = maxWidth;
      let height = width / aspect;
      if (height > maxHeight) {
        height = maxHeight;
        width = height * aspect;
      }
      setFrame({ width: Math.round(width), height: Math.round(height) });
    }
    size();
    window.addEventListener('resize', size);
    return () => window.removeEventListener('resize', size);
  }, [aspect]);

  // The smallest scale at which the photo still covers the whole frame.
  const baseScale = source ? Math.max(frame.width / source.width, frame.height / source.height) : 1;
  const { zoom } = view;
  const position = { x: view.x, y: view.y };
  const scale = baseScale * zoom;

  const keepInside = useCallback(
    (x, y, atScale) => {
      if (!source) return { x, y };
      const width = source.width * atScale;
      const height = source.height * atScale;
      return { x: clamp(x, frame.width - width, 0), y: clamp(y, frame.height - height, 0) };
    },
    [source, frame]
  );

  const centred = useCallback(() => {
    const width = source.width * baseScale;
    const height = source.height * baseScale;
    return { zoom: 1, x: (frame.width - width) / 2, y: (frame.height - height) / 2 };
  }, [source, frame, baseScale]);

  // Start centred whenever the photo or the frame size changes.
  useEffect(() => {
    if (source) setView(centred());
  }, [source, centred]);

  // Zooms around a point in the frame (its centre, unless the wheel or fingers say otherwise),
  // so the part of the photo under that point stays put.
  const zoomTo = useCallback(
    (nextZoom, anchor = { x: frame.width / 2, y: frame.height / 2 }) => {
      setView((current) => {
        const next = clamp(nextZoom, 1, MAX_ZOOM);
        const oldScale = baseScale * current.zoom;
        const newScale = baseScale * next;
        const pointX = (anchor.x - current.x) / oldScale;
        const pointY = (anchor.y - current.y) / oldScale;
        return { zoom: next, ...keepInside(anchor.x - pointX * newScale, anchor.y - pointY * newScale, newScale) };
      });
    },
    [baseScale, frame, keepInside]
  );

  const moveTo = useCallback((x, y) => setView((current) => ({ ...current, ...keepInside(x, y, baseScale * current.zoom) })), [baseScale, keepInside]);

  // Esc cancels; the page behind doesn't scroll while the dialog is open.
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onDone(null);
    }
    document.addEventListener('keydown', handleKey);
    document.body.classList.add('krew-modal-open');
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.classList.remove('krew-modal-open');
    };
  }, [onDone]);

  useEffect(() => {
    if (source) frameRef.current?.focus();
  }, [source]);

  // The wheel zooms. Added by hand because React's wheel listener can't stop the page scrolling.
  useEffect(() => {
    const element = frameRef.current;
    if (!element) return undefined;
    function handleWheel(e) {
      e.preventDefault();
      const box = element.getBoundingClientRect();
      zoomTo(zoom * Math.exp(-e.deltaY * 0.0015), { x: e.clientX - box.left, y: e.clientY - box.top });
    }
    element.addEventListener('wheel', handleWheel, { passive: false });
    return () => element.removeEventListener('wheel', handleWheel);
  }, [zoom, zoomTo]);

  function pointerPoint(e) {
    const box = frameRef.current.getBoundingClientRect();
    return { x: e.clientX - box.left, y: e.clientY - box.top };
  }

  // One finger or the mouse drags; two fingers pinch to zoom.
  function handlePointerDown(e) {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, pointerPoint(e));
    setDragging(true);
    startGesture();
  }

  function startGesture() {
    const points = [...pointers.current.values()];
    if (points.length === 1) {
      gesture.current = { kind: 'drag', start: points[0], from: position };
    } else if (points.length === 2) {
      gesture.current = { kind: 'pinch', distance: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y), zoom };
    }
  }

  function handlePointerMove(e) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, pointerPoint(e));
    const points = [...pointers.current.values()];
    const current = gesture.current;
    if (!current) return;
    if (current.kind === 'drag' && points.length === 1) {
      const dx = points[0].x - current.start.x;
      const dy = points[0].y - current.start.y;
      moveTo(current.from.x + dx, current.from.y + dy);
    } else if (current.kind === 'pinch' && points.length === 2) {
      const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      const middle = { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
      zoomTo(current.zoom * (distance / current.distance), middle);
    }
  }

  function handlePointerUp(e) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) {
      setDragging(false);
      gesture.current = null;
    } else {
      startGesture();
    }
  }

  function handleKeyDown(e) {
    const moves = { ArrowLeft: [STEP_PX, 0], ArrowRight: [-STEP_PX, 0], ArrowUp: [0, STEP_PX], ArrowDown: [0, -STEP_PX] };
    if (moves[e.key]) {
      e.preventDefault();
      const [dx, dy] = moves[e.key];
      moveTo(position.x + dx, position.y + dy);
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      zoomTo(zoom * 1.15);
    } else if (e.key === '-') {
      e.preventDefault();
      zoomTo(zoom / 1.15);
    }
  }

  function reset() {
    setView(centred());
  }

  // Draws the framed part of the photo onto a canvas and turns it into the file to upload.
  function save() {
    setSaving(true);
    const sourceX = -position.x / scale;
    const sourceY = -position.y / scale;
    const sourceWidth = frame.width / scale;
    const sourceHeight = frame.height / scale;
    const width = Math.round(Math.min(outputWidth, sourceWidth));
    const height = Math.round(width / aspect);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.imageSmoothingQuality = 'high';
    const asPng = keepTransparency && file.type === 'image/png';
    if (!asPng) {
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
    }
    context.drawImage(source.image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);

    const type = asPng ? 'image/png' : 'image/jpeg';
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setSaving(false);
          setError("That photo couldn't be prepared. Try a different one.");
          return;
        }
        const baseName = (file.name || 'photo').replace(/\.[^.]+$/, '');
        onDone(new File([blob], `${baseName}.${asPng ? 'png' : 'jpg'}`, { type }));
      },
      type,
      0.9
    );
  }

  const zoomPercent = Math.round(((zoom - 1) / (MAX_ZOOM - 1)) * 100);

  return (
    <div className="krew-moment-backdrop" onClick={() => onDone(null)}>
      <div className="krew-cp-hire-dialog krew-crop-dialog" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="krew-cp-hire-close" onClick={() => onDone(null)} aria-label="Cancel">
          <X size={20} strokeWidth={1.75} />
        </button>

        <div className="krew-card krew-dash-form-card">
          <h2 className="krew-dash-form-title">{title}</h2>
          <p className="krew-crop-hint">Drag to move the photo. Use the slider, the scroll wheel, or two fingers to zoom.</p>

          {error && <div className="krew-form-banner error">{error}</div>}

          <div className="krew-crop-stage">
            <div
              ref={frameRef}
              className={`krew-crop-frame ${dragging ? 'dragging' : ''}`}
              style={{ width: frame.width, height: frame.height }}
              tabIndex={0}
              role="application"
              aria-label="Photo framing area. Use the arrow keys to move the photo, and plus or minus to zoom."
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onKeyDown={handleKeyDown}
            >
              {source && (
                <img
                  src={source.url}
                  alt=""
                  draggable={false}
                  className="krew-crop-image"
                  style={{
                    width: source.width * scale,
                    height: source.height * scale,
                    transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
                  }}
                />
              )}
              <span className="krew-crop-grid" aria-hidden="true" />
            </div>
          </div>

          <div className="krew-crop-zoom">
            <button type="button" className="krew-crop-zoom-btn" onClick={() => zoomTo(zoom / 1.2)} aria-label="Zoom out" disabled={!source || zoom <= 1}>
              <ZoomOut size={18} strokeWidth={1.6} />
            </button>
            <input
              type="range"
              min="1"
              max={MAX_ZOOM}
              step="0.01"
              value={zoom}
              onChange={(e) => zoomTo(Number(e.target.value))}
              aria-label="Zoom"
              aria-valuetext={`${zoomPercent}% zoomed in`}
              disabled={!source}
              style={{ '--krew-crop-fill': `${zoomPercent}%` }}
            />
            <button type="button" className="krew-crop-zoom-btn" onClick={() => zoomTo(zoom * 1.2)} aria-label="Zoom in" disabled={!source || zoom >= MAX_ZOOM}>
              <ZoomIn size={18} strokeWidth={1.6} />
            </button>
            <button type="button" className="krew-crop-zoom-btn" onClick={reset} aria-label="Start again" disabled={!source}>
              <RotateCcw size={17} strokeWidth={1.6} />
            </button>
          </div>

          <div className="krew-dash-form-actions">
            <button type="button" className="krew-button-secondary" onClick={() => onDone(null)} disabled={saving}>
              Cancel
            </button>
            <button type="button" className="krew-button-primary krew-dash-form-submit" onClick={save} disabled={!source || saving}>
              {saving ? 'Preparing…' : 'Use this photo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Opens the crop dialog for `file` and resolves with the cropped File, or null if cancelled.
export function cropImage(file, { aspect = 1, title = 'Crop your photo', outputWidth = 1200, keepTransparency = false } = {}) {
  return new Promise((resolve) => {
    const holder = document.createElement('div');
    document.body.appendChild(holder);
    const root = createRoot(holder);
    const returnFocusTo = document.activeElement;

    function finish(result) {
      root.unmount();
      holder.remove();
      if (returnFocusTo && typeof returnFocusTo.focus === 'function') returnFocusTo.focus();
      resolve(result);
    }

    root.render(
      <ImageCropDialog
        file={file}
        aspect={aspect}
        title={title}
        outputWidth={outputWidth}
        keepTransparency={keepTransparency}
        onDone={finish}
      />
    );
  });
}
