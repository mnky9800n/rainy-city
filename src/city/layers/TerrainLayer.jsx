import React, { useRef, useEffect } from "react";
import { useCityContext } from '../CityContext.jsx';
import { getOffsets } from '../isometric.js';
import { tileWidth, tileHeight, elevationScale } from '../constants.js';
import { toScreenCoords, drawTile, adjustBrightness } from '../rendering.js';
import { buildingTypes } from '../buildings.js';

const TerrainLayer = ({ showRoads = true }) => {
  const canvasRef = useRef(null);
  const { dimensions, zoom, panX, panY, textures, tiles, elevationMap, showWaterSurface, buildingMap, buildingSprites } = useCityContext();

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    const { offsetX, offsetY } = getOffsets(dimensions, zoom, panX, panY);
    const seaLevelOffset = -0.35 * elevationScale * zoom;

    for (const tile of tiles) {
      if (tile.type === 'water') {
        if (showWaterSurface) {
          // Draw water surface in the same pass so land tiles paint over it
          const sx = (tile.x - tile.y) * (tileWidth / 2) * zoom + offsetX;
          const sy = (tile.x + tile.y) * (tileHeight / 2) * zoom + offsetY;
          ctx.save();
          ctx.fillStyle = adjustBrightness('#2980b9', 20);
          ctx.globalAlpha = 0.6;
          ctx.beginPath();
          ctx.moveTo(sx, sy + seaLevelOffset);
          ctx.lineTo(sx + (tileWidth / 2) * zoom, sy + (tileHeight / 2) * zoom + seaLevelOffset);
          ctx.lineTo(sx, sy + tileHeight * zoom + seaLevelOffset);
          ctx.lineTo(sx - (tileWidth / 2) * zoom, sy + (tileHeight / 2) * zoom + seaLevelOffset);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
        continue; // always skip water tiles from drawTile
      }
      const { screenX, screenY } = toScreenCoords(tile.x, tile.y, zoom, offsetX, offsetY);
      const renderType = (!showRoads && (tile.type === 'road' || tile.type === 'road_cross' || tile.type === 'road_intersection'))
        ? 'grass' : tile.type;
      drawTile(ctx, screenX, screenY, tile.elevation, renderType, tile.corners, zoom, textures);

      // Buildings are drawn by CarLayer for proper depth sorting with cars
    }
  }, [dimensions, zoom, panX, panY, textures, tiles, elevationMap, showWaterSurface, showRoads, buildingMap, buildingSprites]);

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
        zIndex: 3,
        pointerEvents: "none",
      }}
    />
  );
};

export default TerrainLayer;
