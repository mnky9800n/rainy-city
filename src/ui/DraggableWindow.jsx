import React, { useRef, useState, useEffect, useLayoutEffect, useCallback } from "react";

// Keep a window fully inside the viewport when it first appears...
const MARGIN = 12;
// ...but once you're dragging, only this much has to stay on screen.
const MIN_VISIBLE = 44;

/**
 * The Mac OS 9 window everything else is built on: pinstriped titlebar, close
 * box, drag by the titlebar with either a mouse or a finger.
 *
 * `anchor` positions the window next to a click point and flips it to the other
 * side when it would run off the right edge -- that's what the info popups want.
 * `clampToViewport` just tucks it inside the screen, which is what matters on
 * phones, where a window opened at x=140 would otherwise hang off the edge.
 */
const DraggableWindow = ({
  title = "Rainy City",
  children,
  initialPosition = { x: 100, y: 100 },
  anchor = null,
  clampToViewport = false,
  onClose,
  width,
  minWidth = 280,
  maxWidth,
  zIndex = 9999,
  noPadding = false,
}) => {
  const windowRef = useRef(null);
  const [position, setPosition] = useState(
    anchor ? { x: anchor.x + 20, y: anchor.y - 20 } : initialPosition
  );
  const [dragging, setDragging] = useState(false);
  const [rel, setRel] = useState({ x: 0, y: 0 });

  // Once dragging, keep a grabbable strip of the window on screen.
  const clampToEdges = useCallback((x, y) => {
    const el = windowRef.current;
    const w = el ? el.offsetWidth : minWidth;
    return {
      x: Math.min(Math.max(x, MIN_VISIBLE - w), window.innerWidth - MIN_VISIBLE),
      y: Math.min(Math.max(y, 0), window.innerHeight - MIN_VISIBLE),
    };
  }, [minWidth]);

  // Measure after the first paint so we know how big the window actually is.
  const anchorX = anchor ? anchor.x : null;
  const anchorY = anchor ? anchor.y : null;
  useLayoutEffect(() => {
    if (!clampToViewport && !anchor) return;
    const el = windowRef.current;
    if (!el) return;
    const { width: w, height: h } = el.getBoundingClientRect();

    let left = anchor ? anchor.x + 20 : initialPosition.x;
    let top = anchor ? anchor.y - 20 : initialPosition.y;

    // Anchored windows prefer to sit right of the click, and flip when they can't.
    if (anchor && left + w > window.innerWidth - MARGIN) left = anchor.x - w - 20;

    if (left + w > window.innerWidth - MARGIN) left = window.innerWidth - MARGIN - w;
    if (left < MARGIN) left = MARGIN;
    if (top + h > window.innerHeight - MARGIN) top = window.innerHeight - MARGIN - h;
    if (top < MARGIN) top = MARGIN;

    setPosition({ x: left, y: top });
    // Deliberately keyed on the anchor only: this repositions when the popup is
    // re-anchored to a new click, not on every render.
  }, [anchorX, anchorY, clampToViewport]);

  const onStart = (clientX, clientY) => {
    setDragging(true);
    setRel({ x: clientX - position.x, y: clientY - position.y });
  };

  const onMouseDown = (e) => { onStart(e.clientX, e.clientY); e.preventDefault(); };
  const onTouchStart = (e) => { onStart(e.touches[0].clientX, e.touches[0].clientY); e.preventDefault(); };

  useEffect(() => {
    if (!dragging) return;

    const onMouseMove = (e) => setPosition(clampToEdges(e.clientX - rel.x, e.clientY - rel.y));
    const onTouchMove = (e) => setPosition(
      clampToEdges(e.touches[0].clientX - rel.x, e.touches[0].clientY - rel.y)
    );
    const onEnd = () => setDragging(false);

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onEnd);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onEnd);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [dragging, rel.x, rel.y, clampToEdges]);

  return (
    <div
      ref={windowRef}
      className="os9-window"
      // WhaleLayer listens for clicks on window itself, so without this a click
      // on any chrome sitting over the water opens the whale popup underneath.
      onClick={(e) => e.stopPropagation()}
      style={{ position: "fixed", left: position.x, top: position.y, zIndex, width, minWidth, maxWidth }}
    >
      <div className="os9-titlebar" onMouseDown={onMouseDown} onTouchStart={onTouchStart}>
        {onClose && (
          <button
            className="os9-close-box"
            onClick={onClose}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            aria-label={"Close " + title}
          />
        )}
        <span className="os9-title-text">{title}</span>
      </div>
      <div className="os9-content" style={noPadding ? { padding: 0 } : undefined}>
        {children}
      </div>
    </div>
  );
};

export default DraggableWindow;
