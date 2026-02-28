import React, { useRef, useEffect, useCallback } from "react";
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

  // Explosion particle system state
  const explosionsRef = useRef([]);
  const rafIdRef = useRef(null);

  // Spawn particles for an explosion at a tile position
  const spawnExplosion = useCallback((tileX, tileY, elevation) => {
    const fireColors = ['#ffff00', '#ffee00', '#ffcc00', '#ff8800', '#ff6600', '#ff4400', '#cc3300'];
    const debrisColors = ['#888888', '#776655', '#665544', '#999999', '#aa8866'];
    const particles = [];
    const hw = tileWidth / 2;  // half tile width for isometric spread
    const hh = tileHeight / 2; // half tile height
    // Dense fire particles — packed onto tile surface, twice as high
    for (let i = 0; i < 30; i++) {
      const isoU = (Math.random() - 0.5) * 0.8;
      const isoV = (Math.random() - 0.5) * 0.8;
      particles.push({
        dx: (isoU * hw + isoV * hw),
        dy: (isoU * hh - isoV * hh),
        vx: (Math.random() - 0.5) * 0.08,
        vy: -(0.1 + Math.random() * 0.3),
        gravity: 0.1 + Math.random() * 0.1,
        size: 3 + Math.random() * 4,
        color: fireColors[Math.floor(Math.random() * fireColors.length)],
        life: 300 + Math.random() * 300,
      });
    }
    // Debris/smoke particles
    for (let i = 0; i < 14; i++) {
      const isoU = (Math.random() - 0.5) * 0.7;
      const isoV = (Math.random() - 0.5) * 0.7;
      particles.push({
        dx: (isoU * hw + isoV * hw),
        dy: (isoU * hh - isoV * hh),
        vx: (Math.random() - 0.5) * 0.06,
        vy: -(0.06 + Math.random() * 0.2),
        gravity: 0.05 + Math.random() * 0.08,
        size: 2 + Math.random() * 3,
        color: debrisColors[Math.floor(Math.random() * debrisColors.length)],
        life: 360 + Math.random() * 300,
      });
    }
    explosionsRef.current.push({
      tileX, tileY, elevation,
      startTime: performance.now(),
      duration: 700,
      particles,
    });
  }, []);

  // Redraw static overlays (hover highlights, road preview)
  const redrawOverlays = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
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

    if (drawRoadsMode && roadStartTile) {
      const elev = elevationMap[roadStartTile.y][roadStartTile.x];
      drawDiamond(roadStartTile.x, roadStartTile.y, elev, '#00ff00', 0.6);
    }

    if (drawRoadsMode && roadPreviewPath) {
      for (const { x, y } of roadPreviewPath) {
        const elev = elevationMap[y][x];
        drawDiamond(x, y, elev, '#888888', 0.4);
      }
    }

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

    return { offsetX, offsetY };
  }, [dimensions, zoom, panX, panY, tiles, hoveredTile, debugMode, drawRoadsMode, destructionMode, roadStartTile, roadPreviewPath, elevationMap]);

  // Animation loop for explosions
  const runExplosionLoop = useCallback(() => {
    if (rafIdRef.current != null) return; // already running

    const tick = () => {
      const now = performance.now();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");

      const offsets = redrawOverlays();
      if (!offsets) return;
      const { offsetX, offsetY } = offsets;

      // Draw each active explosion's particles
      explosionsRef.current = explosionsRef.current.filter((exp) => {
        const elapsed = now - exp.startTime;
        if (elapsed >= exp.duration) return false;
        const t = elapsed / exp.duration; // 0..1 progress

        // Tile center in screen coords
        const { screenX, screenY } = toScreenCoords(exp.tileX, exp.tileY, zoom, offsetX, offsetY);
        const baseY = screenY - exp.elevation * elevationScale * zoom + (tileHeight / 2) * zoom;

        for (const p of exp.particles) {
          const pt = Math.min(elapsed / p.life, 1); // particle's own progress
          if (pt >= 1) continue;

          // Position: start on tile surface, drift gently upward
          const px = screenX + (p.dx + p.vx * elapsed) * zoom;
          const py = baseY + (p.dy + p.vy * elapsed + p.gravity * pt * pt * elapsed * 0.4) * zoom;

          const alpha = pt < 0.3 ? 1 : 1 - ((pt - 0.3) / 0.7) * ((pt - 0.3) / 0.7); // hold then fade
          const sz = p.size * zoom * (1 - pt * 0.3); // shrink slightly

          // Draw as small isometric diamond
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.moveTo(px, py - sz);
          ctx.lineTo(px + sz * 0.7, py);
          ctx.lineTo(px, py + sz * 0.5);
          ctx.lineTo(px - sz * 0.7, py);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
        return true;
      });

      if (explosionsRef.current.length > 0) {
        rafIdRef.current = requestAnimationFrame(tick);
      } else {
        rafIdRef.current = null;
        redrawOverlays(); // final clean redraw
      }
    };

    rafIdRef.current = requestAnimationFrame(tick);
  }, [redrawOverlays, zoom]);

  // Cleanup rAF on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current != null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, []);

  // Draw hover highlight and road preview
  useEffect(() => {
    redrawOverlays();
  }, [redrawOverlays]);

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
        spawnExplosion(tileX, tileY, elevation);
        runExplosionLoop();
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
  }, [interactionEnabled, debugMode, drawRoadsMode, destructionMode, destroyTile, dimensions, zoom, panX, panY, elevationMap, cornerMatrix, setHoveredTile, roadStartTile, setRoadStartTile, setRoadPreviewPath, placeRoad, spawnExplosion, runExplosionLoop]);

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
