import React, { useRef, useEffect } from "react";
import { CityProvider, useCityContext } from './CityContext.jsx';
import SeafloorLayer from './layers/SeafloorLayer.jsx';
import WaterSurfaceLayer from './layers/WaterSurfaceLayer.jsx';
import TerrainLayer from './layers/TerrainLayer.jsx';
import DebugLayer from './layers/DebugLayer.jsx';

const ZoomContainer = ({ children }) => {
  const containerRef = useRef(null);
  const { setZoom } = useCityContext();

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

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "#222",
        zIndex: 1,
      }}
    >
      {children}
    </div>
  );
};

const CityRenderer = ({ debugMode = false }) => {
  return (
    <CityProvider debugMode={debugMode}>
      <ZoomContainer>
        <SeafloorLayer />
        <WaterSurfaceLayer />
        <TerrainLayer />
        <DebugLayer />
      </ZoomContainer>
    </CityProvider>
  );
};

export default CityRenderer;
