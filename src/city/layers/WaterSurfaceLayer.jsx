import React, { useRef, useEffect } from "react";
import { useCityContext } from '../CityContext.jsx';

const WaterSurfaceLayer = () => {
  const canvasRef = useRef(null);
  const { dimensions } = useCityContext();

  // Water surface is drawn in TerrainLayer for correct depth sorting.
  // This canvas is kept as a placeholder for future water effects.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, dimensions.width, dimensions.height);
  }, [dimensions]);

  return (
    <canvas
      ref={canvasRef}
      width={dimensions.width}
      height={dimensions.height}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        display: "block",
        zIndex: 2,
        pointerEvents: "none",
      }}
    />
  );
};

export default WaterSurfaceLayer;
