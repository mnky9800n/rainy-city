import React, { useRef, useEffect } from "react";
import { useCityContext } from '../CityContext.jsx';
import { getOffsets, screenToTile } from '../isometric.js';
import { toScreenCoords } from '../rendering.js';
import { tileWidth, tileHeight, elevationScale, gridWidth, gridHeight } from '../constants.js';

const DebugLayer = () => {
  const canvasRef = useRef(null);
  const {
    dimensions, zoom, tiles, elevationMap, cornerMatrix,
    hoveredTile, setHoveredTile, debugMode,
  } = useCityContext();

  // Draw hover highlight
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    if (!debugMode || !hoveredTile) return;

    const { offsetX, offsetY } = getOffsets(dimensions, zoom);

    for (const tile of tiles) {
      if (tile.type === 'water') continue;
      if (tile.x === hoveredTile.x && tile.y === hoveredTile.y) {
        const { screenX, screenY } = toScreenCoords(tile.x, tile.y, zoom, offsetX, offsetY);
        const yOffset = -tile.elevation * elevationScale * zoom;
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = 'yellow';
        ctx.beginPath();
        ctx.moveTo(screenX, screenY + yOffset);
        ctx.lineTo(screenX + (tileWidth / 2) * zoom, screenY + (tileHeight / 2) * zoom + yOffset);
        ctx.lineTo(screenX, screenY + tileHeight * zoom + yOffset);
        ctx.lineTo(screenX - (tileWidth / 2) * zoom, screenY + (tileHeight / 2) * zoom + yOffset);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        break;
      }
    }
  }, [dimensions, zoom, tiles, hoveredTile, debugMode]);

  // Handle click and mousemove events
  useEffect(() => {
    if (!debugMode) return;

    const canvas = canvasRef.current;

    const handleClick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const { offsetX, offsetY } = getOffsets(dimensions, zoom);
      const { tileX, tileY } = screenToTile(
        e.clientX - rect.left, e.clientY - rect.top, zoom, offsetX, offsetY
      );

      if (tileX >= 0 && tileX < gridWidth && tileY >= 0 && tileY < gridHeight) {
        const elevation = elevationMap[tileY][tileX];
        const corners = cornerMatrix ? cornerMatrix[tileY][tileX] : null;
        const cornerStr = corners ? `n:${corners.n} e:${corners.e} s:${corners.s} w:${corners.w}` : 'unknown';
        console.log(`Tile [${tileX},${tileY}]: elevation=${elevation}, corners={${cornerStr}}`);
      } else {
        console.log(`Click outside grid bounds: X:${tileX}, Y:${tileY}`);
      }
    };

    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const { offsetX, offsetY } = getOffsets(dimensions, zoom);
      const { tileX, tileY } = screenToTile(
        e.clientX - rect.left, e.clientY - rect.top, zoom, offsetX, offsetY
      );

      if (tileX >= 0 && tileX < gridWidth && tileY >= 0 && tileY < gridHeight) {
        setHoveredTile({ x: tileX, y: tileY });
      } else {
        setHoveredTile(null);
      }
    };

    canvas.addEventListener("click", handleClick);
    canvas.addEventListener("mousemove", handleMouseMove);
    return () => {
      canvas.removeEventListener("click", handleClick);
      canvas.removeEventListener("mousemove", handleMouseMove);
    };
  }, [debugMode, dimensions, zoom, elevationMap, cornerMatrix, setHoveredTile]);

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
        zIndex: 5,
        pointerEvents: debugMode ? "auto" : "none",
        cursor: debugMode ? "crosshair" : "default",
      }}
    />
  );
};

export default DebugLayer;
