import React from "react";
import DraggableWindow from "./DraggableWindow.jsx";
import CatalogRow from "./CatalogRow.jsx";

/**
 * A scrolling catalog in an OS 9 window -- the Buildings and Characters
 * explorers are both just this with a different list handed to them.
 */
const ExplorerWindow = ({ title, entries, initialPosition, onClose }) => (
  <DraggableWindow
    title={title}
    onClose={onClose}
    initialPosition={initialPosition}
    clampToViewport
    width="min(400px, calc(100vw - 24px))"
    minWidth={0}
  >
    <div className="os9-scroll-area" style={{ maxHeight: "min(440px, 62vh)" }}>
      <div className="os9-list">
        {entries.map((entry) => (
          <CatalogRow key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  </DraggableWindow>
);

export default ExplorerWindow;
