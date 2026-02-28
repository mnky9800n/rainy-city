import React, { useRef, useEffect } from "react";
import { useCityContext } from '../CityContext.jsx';
import { getOffsets, screenToTile } from '../isometric.js';
import { toScreenCoords } from '../rendering.js';
import { tileWidth, tileHeight, elevationScale, gridWidth, gridHeight } from '../constants.js';
import { findRoadPath } from '../pathfinding.js';

const DebugLayer = () => {
  const canvasRef = useRef(null);
  const {
    dimensions, zoom, panX, panY, tiles, elevationMap, cornerMatrix,
    hoveredTile, setHoveredTile, debugMode,
    drawRoadsMode, roadStartTile, setRoadStartTile,
    roadPreviewPath, setRoadPreviewPath, placeRoad,
    destructionMode, destroyTile,
  } = useCityContext();

  const interactionEnabled = debugMode || drawRoadsMode || destructionMode;

  const bulldozerCursor = 'url(/bulldozer.png) 16 16, auto';

  // Draw hover highlight and road preview
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    const { offsetX, offsetY } = getOffsets(dimensions, zoom, panX, panY);

    const drawDiamond = (x, y, elevation, color, alpha) => {
      const { screenX, screenY } = toScreenCoords(x, y, zoom, offsetX, offsetY);
      const yOffset = -elevation * elevationScale * zoom;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(screenX, screenY + yOffset);
      ctx.lineTo(screenX + (tileWidth / 2) * zoom, screenY + (tileHeight / 2) * zoom + yOffset);
      ctx.lineTo(screenX, screenY + tileHeight * zoom + yOffset);
      ctx.lineTo(screenX - (tileWidth / 2) * zoom, screenY + (tileHeight / 2) * zoom + yOffset);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    // Draw road start tile highlight
    if (drawRoadsMode && roadStartTile) {
      const elev = elevationMap[roadStartTile.y][roadStartTile.x];
      drawDiamond(roadStartTile.x, roadStartTile.y, elev, '#00ff00', 0.6);
    }

    // Draw road preview path
    if (drawRoadsMode && roadPreviewPath) {
      for (const { x, y } of roadPreviewPath) {
        const elev = elevationMap[y][x];
        drawDiamond(x, y, elev, '#888888', 0.4);
      }
    }

    // Draw hover highlight for debug, draw roads, or destruction mode
    if ((debugMode || drawRoadsMode || destructionMode) && hoveredTile) {
      const highlightColor = destructionMode ? 'red' : 'yellow';
      for (const tile of tiles) {
        if (tile.type === 'water') continue;
        if (tile.x === hoveredTile.x && tile.y === hoveredTile.y) {
          drawDiamond(tile.x, tile.y, tile.elevation, highlightColor, 0.5);
          break;
        }
      }
    }
  }, [dimensions, zoom, panX, panY, tiles, hoveredTile, debugMode, drawRoadsMode, destructionMode, roadStartTile, roadPreviewPath, elevationMap]);

  // Handle click and mousemove events
  useEffect(() => {
    if (!interactionEnabled) return;

    const canvas = canvasRef.current;

    const getTileAt = (e) => {
      const rect = canvas.getBoundingClientRect();
      const { offsetX, offsetY } = getOffsets(dimensions, zoom, panX, panY);
      return screenToTile(
        e.clientX - rect.left, e.clientY - rect.top, zoom, offsetX, offsetY
      );
    };

    const handleClick = (e) => {
      const { tileX, tileY } = getTileAt(e);

      if (tileX < 0 || tileX >= gridWidth || tileY < 0 || tileY >= gridHeight) {
        if (debugMode) console.log(`Click outside grid bounds: X:${tileX}, Y:${tileY}`);
        return;
      }

      if (destructionMode) {
        const elevation = elevationMap[tileY][tileX];
        if (elevation <= 0) return; // Can't destroy water tiles
        destroyTile(tileX, tileY);
        return;
      }

      if (drawRoadsMode) {
        const elevation = elevationMap[tileY][tileX];
        if (elevation <= 0) return; // Can't place roads on water

        if (!roadStartTile) {
          setRoadStartTile({ x: tileX, y: tileY });
          setRoadPreviewPath(null);
        } else {
          placeRoad(roadStartTile.x, roadStartTile.y, tileX, tileY);
          setRoadStartTile(null);
          setRoadPreviewPath(null);
        }
        return;
      }

      if (debugMode) {
        const elevation = elevationMap[tileY][tileX];
        const corners = cornerMatrix ? cornerMatrix[tileY][tileX] : null;
        const cornerStr = corners ? `n:${corners.n} e:${corners.e} s:${corners.s} w:${corners.w}` : 'unknown';
        console.log(`Tile [${tileX},${tileY}]: elevation=${elevation}, corners={${cornerStr}}`);
      }
    };

    const handleMouseMove = (e) => {
      const { tileX, tileY } = getTileAt(e);

      if (tileX >= 0 && tileX < gridWidth && tileY >= 0 && tileY < gridHeight) {
        setHoveredTile({ x: tileX, y: tileY });

        // Update preview path when in draw roads mode with a start tile set
        if (drawRoadsMode && roadStartTile) {
          if (elevationMap[tileY][tileX] > 0) {
            const path = findRoadPath(
              roadStartTile.x, roadStartTile.y, tileX, tileY,
              elevationMap, gridWidth, gridHeight
            );
            setRoadPreviewPath(path);
          } else {
            setRoadPreviewPath(null);
          }
        }
      } else {
        setHoveredTile(null);
        if (drawRoadsMode && roadStartTile) {
          setRoadPreviewPath(null);
        }
      }
    };

    const handleContextMenu = (e) => {
      if (drawRoadsMode && roadStartTile) {
        e.preventDefault();
        setRoadStartTile(null);
        setRoadPreviewPath(null);
      }
    };

    canvas.addEventListener("click", handleClick);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("contextmenu", handleContextMenu);
    return () => {
      canvas.removeEventListener("click", handleClick);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [interactionEnabled, debugMode, drawRoadsMode, destructionMode, destroyTile, dimensions, zoom, panX, panY, elevationMap, cornerMatrix, setHoveredTile, roadStartTile, setRoadStartTile, setRoadPreviewPath, placeRoad]);

  // Clear road drawing state when mode is disabled
  useEffect(() => {
    if (!drawRoadsMode) {
      setRoadStartTile(null);
      setRoadPreviewPath(null);
    }
  }, [drawRoadsMode, setRoadStartTile, setRoadPreviewPath]);

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
        pointerEvents: interactionEnabled ? "auto" : "none",
        cursor: destructionMode ? bulldozerCursor : drawRoadsMode ? "crosshair" : debugMode ? "crosshair" : "default",
      }}
    />
  );
};

export default DebugLayer;
