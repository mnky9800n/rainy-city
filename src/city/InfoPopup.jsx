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
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "fixed",
        left: position.left,
        top: position.top,
        zIndex: 9998,
        background: "rgba(0,0,0,0.8)",
        color: "#fff",
        borderRadius: 8,
        boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
        minWidth: 260,
        maxWidth: 320,
        userSelect: "none",
        fontFamily: "sans-serif",
      }}
    >
      {/* Title bar — drag to move */}
      <div
        onMouseDown={onTitleBarMouseDown}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          background: "#222",
          borderTopLeftRadius: 8,
          borderTopRightRadius: 8,
          borderBottom: "1px solid #444",
          cursor: "move",
        }}
      >
        <span style={{ fontWeight: "bold", fontSize: 14 }}>
          {title || "Info"}
        </span>
        <button
          onClick={onClose}
          style={{
            background: "#444",
            border: "1px solid #666",
            borderRadius: 4,
            color: "#ccc",
            fontSize: 14,
            cursor: "pointer",
            lineHeight: 1,
            padding: "2px 7px",
            fontFamily: "monospace",
          }}
        >
          X
        </button>
      </div>

      {/* Content area */}
      <div style={{ padding: 16 }}>
        {logoUrl && (
          <img
            src={logoUrl}
            alt={title}
            style={{
              height: 32,
              marginBottom: 10,
              display: "block",
              filter: "brightness(0) invert(1)",
            }}
          />
        )}

        {description && (
          <div style={{ fontSize: 13, lineHeight: 1.5, color: "#ccc", marginBottom: 12 }}>
            {description}
          </div>
        )}

        {linkUrl && (
          <a
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 13,
              color: "#6cb4ee",
              textDecoration: "none",
            }}
          >
            {linkText || linkUrl}
          </a>
        )}
      </div>
    </div>
  );
};

export default InfoPopup;
