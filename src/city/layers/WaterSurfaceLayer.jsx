import React, { useRef, useEffect } from "react";
import { useCityContext } from '../CityContext.jsx';
import { getOffsets } from '../isometric.js';
import { tileWidth, tileHeight, elevationScale } from '../constants.js';
import { adjustBrightness } from '../rendering.js';

const WaterSurfaceLayer = () => {
  const canvasRef = useRef(null);
  const { dimensions, zoom, tiles } = useCityContext();

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    const { offsetX, offsetY } = getOffsets(dimensions, zoom);
    const seaLevelOffset = 0.5 * elevationScale * zoom;

    ctx.fillStyle = adjustBrightness('#2980b9', 20);
    ctx.globalAlpha = 0.6;

    for (const tile of tiles) {
      if (tile.type !== 'water') continue;
      const sx = (tile.x - tile.y) * (tileWidth / 2) * zoom + offsetX;
      const sy = (tile.x + tile.y) * (tileHeight / 2) * zoom + offsetY;
      ctx.beginPath();
      ctx.moveTo(sx, sy + seaLevelOffset);
      ctx.lineTo(sx + (tileWidth / 2) * zoom, sy + (tileHeight / 2) * zoom + seaLevelOffset);
      ctx.lineTo(sx, sy + tileHeight * zoom + seaLevelOffset);
      ctx.lineTo(sx - (tileWidth / 2) * zoom, sy + (tileHeight / 2) * zoom + seaLevelOffset);
      ctx.closePath();
      ctx.fill();
    }

    ctx.globalAlpha = 1.0;
  }, [dimensions, zoom, tiles]);

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
