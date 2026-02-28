import React, { useRef, useEffect, useState, useCallback } from "react";
import { CityProvider, useCityContext } from './CityContext.jsx';
import SeafloorLayer from './layers/SeafloorLayer.jsx';
import WaterSurfaceLayer from './layers/WaterSurfaceLayer.jsx';
import TerrainLayer from './layers/TerrainLayer.jsx';
import WhaleLayer from './layers/WhaleLayer.jsx';
import DebugLayer from './layers/DebugLayer.jsx';
import InfoPopup from './InfoPopup.jsx';

const ZoomContainer = ({ children }) => {
  const containerRef = useRef(null);
  const { setZoom, setPanX, setPanY } = useCityContext();
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const el = containerRef.current;
    const handleWheel = (e) => {
      if (e.ctrlKey) return;
      e.preventDefault();
      const zoomStep = 0.1;
      setZoom((z) => {
        if (e.deltaY < 0) {
          return Math.min(z + zoomStep, 3);
        } else {
          return Math.max(z - zoomStep, 0.5);
        }
      });
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [setZoom]);

  const handleMouseDown = (e) => {
    isDragging.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    containerRef.current.style.cursor = "grabbing";
  };

  const handleMouseMove = (e) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    setPanX((px) => px + dx);
    setPanY((py) => py + dy);
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    containerRef.current.style.cursor = "grab";
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "#222",
        zIndex: 1,
        cursor: "grab",
      }}
    >
      {children}
    </div>
  );
};

const CityRenderer = ({
  debugMode = false,
  showSeafloor = true,
  showWaterSurface = true,
  showTerrain = true,
  showRoads = true,
  showDebugLayer = true,
  drawRoadsMode = false,
  destructionMode = false,
  resetRoadsRef = null,
}) => {
  const [infoPopup, setInfoPopup] = useState(null);

  const handleWhaleClick = useCallback((screenX, screenY) => {
    setInfoPopup({
      title: "Project CETI",
      logoUrl: "https://cdn.prod.website-files.com/643ddd7ffdf12273933a8cec/645d24eb63dfb01f70696649_logo-ceti.svg",
      description: "Project CETI is a nonprofit initiative using advanced AI and linguistics to decode sperm whale communication, with the goal of understanding what these animals are saying to each other.",
      linkUrl: "https://www.projectceti.org/",
      linkText: "Visit projectceti.org",
      screenX,
      screenY,
    });
  }, []);

  return (
    <CityProvider debugMode={debugMode} showWaterSurface={showWaterSurface} drawRoadsMode={drawRoadsMode} destructionMode={destructionMode} resetRoadsRef={resetRoadsRef}>
      <ZoomContainer>
        {showSeafloor && <SeafloorLayer />}
        {showWaterSurface && <WaterSurfaceLayer />}
        <WhaleLayer onWhaleClick={handleWhaleClick} />
        {showTerrain && <TerrainLayer showRoads={showRoads} />}
        {showDebugLayer && <DebugLayer />}
      </ZoomContainer>
      {infoPopup && (
        <InfoPopup
          {...infoPopup}
          onClose={() => setInfoPopup(null)}
        />
      )}
    </CityProvider>
  );
};

export default CityRenderer;
