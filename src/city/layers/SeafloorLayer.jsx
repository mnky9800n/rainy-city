import React, { useRef, useEffect } from "react";
import { useCityContext } from '../CityContext.jsx';
import { getOffsets } from '../isometric.js';
import { toScreenCoords, drawTile } from '../rendering.js';

const SeafloorLayer = () => {
  const canvasRef = useRef(null);
  const { dimensions, zoom, panX, panY, textures, tiles, elevationMap } = useCityContext();

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    const { offsetX, offsetY } = getOffsets(dimensions, zoom, panX, panY);

    for (const tile of tiles) {
      if (tile.type !== 'water') continue;
      const { screenX, screenY } = toScreenCoords(tile.x, tile.y, zoom, offsetX, offsetY);
      drawTile(ctx, screenX, screenY, tile.elevation, tile.type, tile.corners, zoom, textures);
    }
  }, [dimensions, zoom, panX, panY, textures, tiles, elevationMap]);

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
        zIndex: 1,
        pointerEvents: "none",
      }}
    />
  );
};

export default SeafloorLayer;
