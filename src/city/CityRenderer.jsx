import React, { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { CityProvider, useCityContext } from './CityContext.jsx';
import SeafloorLayer from './layers/SeafloorLayer.jsx';
import WaterSurfaceLayer from './layers/WaterSurfaceLayer.jsx';
import TerrainLayer from './layers/TerrainLayer.jsx';
import WhaleLayer from './layers/WhaleLayer.jsx';
import CarLayer from './layers/CarLayer.jsx';
import CloudLayer from './layers/CloudLayer.jsx';
import BeaconLayer from './layers/BeaconLayer.jsx';
import DebugLayer from './layers/DebugLayer.jsx';
import InfoPopup from './InfoPopup.jsx';
import { buildingTypes } from './buildings.js';
import { getOffsets, screenToTile } from './isometric.js';
import { gridWidth, gridHeight } from './constants.js';

const ZoomContainer = ({ children, onClick }) => {
  const containerRef = useRef(null);
  const { setZoom, setPanX, setPanY } = useCityContext();
  const isDragging = useRef(false);
  const didDrag = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  // Pinch-to-zoom state
  const lastPinchDist = useRef(null);

  useEffect(() => {
    const el = containerRef.current;

    // Mouse wheel zoom
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

    // Touch handlers
    const handleTouchStart = (e) => {
      if (e.touches.length === 2) {
        // Pinch start
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        lastPinchDist.current = Math.sqrt(dx * dx + dy * dy);
        isDragging.current = false;
      } else if (e.touches.length === 1) {
        // Single finger pan
        isDragging.current = true;
        didDrag.current = false;
        lastMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };

    const handleTouchMove = (e) => {
      e.preventDefault();
      if (e.touches.length === 2 && lastPinchDist.current != null) {
        // Pinch zoom
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const delta = dist - lastPinchDist.current;
        lastPinchDist.current = dist;
        setZoom((z) => Math.min(3, Math.max(0.5, z + delta * 0.005)));
        // Also pan to midpoint
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        if (isDragging.current) {
          const ddx = midX - lastMouse.current.x;
          const ddy = midY - lastMouse.current.y;
          setPanX((px) => px + ddx);
          setPanY((py) => py + ddy);
        }
        lastMouse.current = { x: midX, y: midY };
        isDragging.current = true;
      } else if (e.touches.length === 1 && isDragging.current) {
        // Single finger pan
        const ddx = e.touches[0].clientX - lastMouse.current.x;
        const ddy = e.touches[0].clientY - lastMouse.current.y;
        if (Math.abs(ddx) > 2 || Math.abs(ddy) > 2) didDrag.current = true;
        lastMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        setPanX((px) => px + ddx);
        setPanY((py) => py + ddy);
      }
    };

    const handleTouchEnd = (e) => {
      if (e.touches.length === 0) {
        isDragging.current = false;
        lastPinchDist.current = null;
      } else if (e.touches.length === 1) {
        // Went from pinch to single finger — reset
        lastPinchDist.current = null;
        lastMouse.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    el.addEventListener("touchstart", handleTouchStart, { passive: false });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", handleTouchEnd);
    return () => {
      el.removeEventListener("wheel", handleWheel);
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [setZoom, setPanX, setPanY]);

  const handleMouseDown = (e) => {
    isDragging.current = true;
    didDrag.current = false;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    containerRef.current.style.cursor = "grabbing";
  };

  const handleMouseMove = (e) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) didDrag.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    setPanX((px) => px + dx);
    setPanY((py) => py + dy);
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    containerRef.current.style.cursor = "grab";
  };

  const handleClick = (e) => {
    if (didDrag.current) return;
    if (onClick) onClick(e);
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={handleClick}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "#222",
        zIndex: 1,
        cursor: "grab",
        touchAction: "none",
      }}
    >
      {children}
    </div>
  );
};

// Inner component that has access to CityContext for building click detection
const FadeOverlay = ({ loaded }) => {
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    if (loaded) {
      // Small delay so the first frame renders behind the overlay before fading
      const timeout = setTimeout(() => setOpacity(0), 100);
      return () => clearTimeout(timeout);
    }
  }, [loaded]);

  if (opacity === 0 && loaded) {
    // Keep mounted during transition, remove after fade completes
    return (
      <div
        style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: '#000', zIndex: 99999, pointerEvents: 'none',
          opacity: 0, transition: 'opacity 1.5s ease-in-out',
        }}
        onTransitionEnd={(e) => { e.target.style.display = 'none'; }}
      />
    );
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: '#000', zIndex: 99999, pointerEvents: loaded ? 'none' : 'all',
      opacity, transition: 'opacity 1.5s ease-in-out',
    }} />
  );
};

const CityInner = ({ showSeafloor, showWaterSurface, showTerrain, showRoads, showDebugLayer, infoPopup, setInfoPopup, onLoaded }) => {
  const { dimensions, zoom, panX, panY, buildingMap, drawRoadsMode, destructionMode, loaded } = useCityContext();

  useEffect(() => {
    if (loaded && onLoaded) onLoaded();
  }, [loaded, onLoaded]);

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
  }, [setInfoPopup]);

  const handleBuildingClick = useCallback((popupContent, screenX, screenY) => {
    setInfoPopup({
      ...popupContent,
      screenX,
      screenY,
    });
  }, [setInfoPopup]);

  const handleContainerClick = useCallback((e) => {
    // Don't handle building clicks when in special modes (DebugLayer handles those)
    if (drawRoadsMode || destructionMode) return;

    const { offsetX, offsetY } = getOffsets(dimensions, zoom, panX, panY);
    const { tileX, tileY } = screenToTile(e.clientX, e.clientY, zoom, offsetX, offsetY);

    if (tileX < 0 || tileX >= gridWidth || tileY < 0 || tileY >= gridHeight) return;

    const buildingEntry = buildingMap.get(`${tileX},${tileY}`);
    if (buildingEntry) {
      const bType = buildingTypes[buildingEntry.type];
      if (bType && bType.popupContent) {
        setInfoPopup({
          ...bType.popupContent,
          screenX: e.clientX,
          screenY: e.clientY,
        });
      }
    }
  }, [dimensions, zoom, panX, panY, buildingMap, drawRoadsMode, destructionMode, setInfoPopup]);

  return (
    <>
      <FadeOverlay loaded={loaded} />
      <ZoomContainer onClick={handleContainerClick}>
        {showSeafloor && <SeafloorLayer />}
        {showWaterSurface && <WaterSurfaceLayer />}
        <WhaleLayer onWhaleClick={handleWhaleClick} />
        {showTerrain && <TerrainLayer showRoads={showRoads} />}
        <CarLayer />
        <CloudLayer />
        <BeaconLayer />
        {showDebugLayer && <DebugLayer onBuildingClick={handleBuildingClick} />}
      </ZoomContainer>
      {infoPopup && (
        <InfoPopup
          {...infoPopup}
          onClose={() => setInfoPopup(null)}
        />
      )}
    </>
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
  placeBuildingsMode = false,
  selectedBuildingType = "house",
  resetRoadsRef = null,
  onLoaded = null,
}) => {
  const [infoPopup, setInfoPopup] = useState(null);

  return (
    <CityProvider debugMode={debugMode} showWaterSurface={showWaterSurface} drawRoadsMode={drawRoadsMode} destructionMode={destructionMode} placeBuildingsMode={placeBuildingsMode} selectedBuildingType={selectedBuildingType} resetRoadsRef={resetRoadsRef}>
      <CityInner
        showSeafloor={showSeafloor}
        showWaterSurface={showWaterSurface}
        showTerrain={showTerrain}
        showRoads={showRoads}
        showDebugLayer={showDebugLayer}
        infoPopup={infoPopup}
        setInfoPopup={setInfoPopup}
        onLoaded={onLoaded}
      />
    </CityProvider>
  );
};

export default CityRenderer;
