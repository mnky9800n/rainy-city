import React from "react";
import DraggableWindow from "../ui/DraggableWindow.jsx";

/**
 * The little window that opens when you click a landmark or a whale.
 *
 * All the window behaviour -- anchoring beside the click, flipping when it
 * would run off the right edge, dragging with a mouse or a finger -- lives in
 * DraggableWindow now. This is just the contents.
 */
const InfoPopup = ({ title, logoUrl, description, linkUrl, linkText, screenX, screenY, onClose }) => (
  <DraggableWindow
    title={title || "Info"}
    onClose={onClose}
    anchor={{ x: screenX, y: screenY }}
    zIndex={9998}
    minWidth={260}
    maxWidth={340}
  >
    {logoUrl && (
      <img
        src={logoUrl}
        alt={title}
        style={{ height: 32, marginBottom: 10, display: "block" }}
      />
    )}

    {description && (
      <div style={{ fontSize: 12, lineHeight: 1.45, color: "#000", marginBottom: 10 }}>
        {description}
      </div>
    )}

    {linkUrl && (
      <a href={linkUrl} target="_blank" rel="noopener noreferrer" className="os9-link">
        {linkText || linkUrl}
      </a>
    )}
  </DraggableWindow>
);

export default InfoPopup;
