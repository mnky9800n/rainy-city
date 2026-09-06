import React, { useRef, useState, useLayoutEffect } from "react";

/**
 * One row of an explorer list: picture on the left, title and description on
 * the right, links underneath.
 *
 * Descriptions come straight from the landmark popups, and those vary from one
 * sentence (the cinema) to a full paragraph (Low Impact Fruit). Left alone the
 * rows would be wildly uneven, so long text clamps to four lines and grows a
 * More/Less toggle. Short entries never see the toggle at all.
 */
const CatalogRow = ({ entry }) => {
  const descRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    const el = descRef.current;
    if (!el) return;
    // Only meaningful while clamped, which is exactly when expanded is false.
    if (!expanded) setOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [entry.description, expanded]);

  return (
    <div className="os9-row">
      <div className="os9-row-thumb">
        <img
          src={entry.image}
          alt={entry.title}
          loading="lazy"
          className={entry.fit === "contain" ? "contain" : undefined}
          style={entry.objectPosition ? { objectPosition: entry.objectPosition } : undefined}
        />
      </div>

      <div className="os9-row-body">
        <div className="os9-row-title">{entry.title}</div>

        {entry.description && (
          <div
            ref={descRef}
            className={"os9-row-desc" + (expanded ? "" : " clamped")}
          >
            {entry.description}
          </div>
        )}

        {(overflows || expanded) && (
          <button
            type="button"
            className="os9-link os9-row-more"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "Less" : "More"}
          </button>
        )}

        {entry.links && entry.links.length > 0 && (
          <div className="os9-row-links">
            {entry.links.map((link) => (
              <a
                key={link.url}
                className="os9-link"
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {link.text}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CatalogRow;
