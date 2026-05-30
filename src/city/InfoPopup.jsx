import React, { useRef, useEffect, useState } from "react";

const InfoPopup = ({ title, logoUrl, description, linkUrl, linkText, screenX, screenY, onClose }) => {
  const popupRef = useRef(null);
  const [position, setPosition] = useState({ left: screenX + 20, top: screenY - 20 });
  const [dragging, setDragging] = useState(false);
  const dragRel = useRef({ x: 0, y: 0 });

  // Clamp to viewport on mount
  useEffect(() => {
    const el = popupRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 12;
    let left = screenX + 20;
    let top = screenY - 20;

    if (left + rect.width > window.innerWidth - margin) {
      left = screenX - rect.width - 20;
    }
    if (left < margin) left = margin;
    if (top + rect.height > window.innerHeight - margin) {
      top = window.innerHeight - margin - rect.height;
    }
    if (top < margin) top = margin;

    setPosition({ left, top });
  }, [screenX, screenY]);

  // Drag handling
  const onTitleBarMouseDown = (e) => {
    setDragging(true);
    dragRel.current = {
      x: e.clientX - position.left,
      y: e.clientY - position.top,
    };
    e.preventDefault();
  };

  useEffect(() => {
    if (!dragging) return;
    const onMouseMove = (e) => {
      setPosition({
        left: e.clientX - dragRel.current.x,
        top: e.clientY - dragRel.current.y,
      });
    };
    const onMouseUp = () => setDragging(false);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [dragging]);


  return (
    <div
      ref={popupRef}
      className="os9-window"
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "fixed",
        left: position.left,
        top: position.top,
        zIndex: 9998,
        minWidth: 260,
        maxWidth: 340,
      }}
    >
      <div className="os9-titlebar" onMouseDown={onTitleBarMouseDown}>
        <button
          className="os9-close-box"
          onClick={onClose}
          onMouseDown={(e) => e.stopPropagation()}
          aria-label="Close"
        />
        <span className="os9-title-text">{title || "Info"}</span>
      </div>

      <div className="os9-content">
        {logoUrl && (
          <img
            src={logoUrl}
            alt={title}
            style={{
              height: 32,
              marginBottom: 10,
              display: "block",
            }}
          />
        )}

        {description && (
          <div style={{ fontSize: 12, lineHeight: 1.45, color: "#000", marginBottom: 10 }}>
            {description}
          </div>
        )}

        {linkUrl && (
          <a
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="os9-link"
          >
            {linkText || linkUrl}
          </a>
        )}
      </div>
    </div>
  );
};

export default InfoPopup;
