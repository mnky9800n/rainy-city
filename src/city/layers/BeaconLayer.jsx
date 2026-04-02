import React, { useRef, useEffect } from "react";
import { useCityContext } from '../CityContext.jsx';
import { getOffsets } from '../isometric.js';
import { toScreenCoords } from '../rendering.js';
import { tileHeight, elevationScale } from '../constants.js';
import { buildingTypes } from '../buildings.js';

// Blink cycle: on for 0.15s, off for 1.5s
const BLINK_PERIOD = 1.65;
const BLINK_ON = 0.15;

// Beacon positions per variant, as fractions of sprite width/height.
// Only variants with tall structures get beacons.
const BEACON_POSITIONS = {
  0: [{ x: 0.4219, y: 0.1031 }],
  3: [{ x: 0.3594, y: 0.2 }, { x: 0.4115, y: 0.2125 }, { x: 0.4792, y: 0.2 }],
  4: [{ x: 0.6198, y: 0.4844 }, { x: 0.4792, y: 0.5125 }, { x: 0.2969, y: 0.4688 }, { x: 0.4427, y: 0.4281 }],
  6: [{ x: 0.4375, y: 0.2531 }],
  8: [{ x: 0.4688, y: 0.3156 }, { x: 0.2604, y: 0.3688 }, { x: 0.4583, y: 0.4094 }, { x: 0.6563, y: 0.3656 }],
};

const BeaconLayer = React.memo(() => {
  const canvasRef = useRef(null);
  const { dimensions, viewRef, buildingMap, elevationMap } = useCityContext();

  const dimensionsRef = useRef(dimensions);
  useEffect(() => { dimensionsRef.current = dimensions; }, [dimensions]);

  const buildingMapRef = useRef(buildingMap);
  useEffect(() => { buildingMapRef.current = buildingMap; }, [buildingMap]);

  const elevationMapRef = useRef(elevationMap);
  useEffect(() => { elevationMapRef.current = elevationMap; }, [elevationMap]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let rafId;
    let startTime = null;

    const tick = (timestamp) => {
      rafId = requestAnimationFrame(tick);
      if (startTime == null) startTime = timestamp;

      const { width, height } = dimensionsRef.current;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, width, height);

      const bMap = buildingMapRef.current;
      const eMap = elevationMapRef.current;
      if (!bMap || bMap.size === 0) return;

      const { panX, panY, zoom } = viewRef.current;
      const { offsetX, offsetY } = getOffsets({ width, height }, zoom, panX, panY);

      const elapsed = (timestamp - startTime) / 1000;

      // Collect unique skyscraper origins
      const drawn = new Set();
      for (const [key, building] of bMap) {
        if (building.type !== 'skyscraper') continue;
        const originKey = `${building.originX},${building.originY}`;
        if (drawn.has(originKey)) continue;
        drawn.add(originKey);

        const variant = building.variant ?? 0;
        const positions = BEACON_POSITIONS[variant];
        if (!positions) continue;

        const bType = buildingTypes[building.type];
        const [fw, fh] = bType.footprint;
        // South corner tile
        const sx = building.originX + fw - 1;
        const sy = building.originY + fh - 1;
        const { screenX, screenY } = toScreenCoords(sx, sy, zoom, offsetX, offsetY);
        const elevation = eMap[sy]?.[sx] ?? 0;
        const yOffset = -elevation * elevationScale * zoom;
        const spriteW = bType.spriteWidth * zoom;
        const spriteH = bType.spriteHeight * zoom;

        // Sprite draw origin (same as TerrainLayer)
        const drawX = screenX - spriteW / 2;
        const drawY = screenY + yOffset - spriteH + (tileHeight * zoom);

        // Phase offset so buildings don't blink in unison
        const phase = variant * 0.3;
        const t = (elapsed + phase) % BLINK_PERIOD;
        if (t > BLINK_ON) continue;

        const halfOn = BLINK_ON / 2;
        const intensity = t < halfOn ? t / halfOn : (BLINK_ON - t) / halfOn;
        const radius = 3 * zoom;

        for (const pos of positions) {
          const bx = drawX + pos.x * spriteW;
          const by = drawY + pos.y * spriteH;

          ctx.save();
          // Glow
          ctx.globalAlpha = intensity * 0.5;
          ctx.fillStyle = '#ff2020';
          ctx.beginPath();
          ctx.arc(bx, by, radius * 3, 0, Math.PI * 2);
          ctx.fill();

          // Core light
          ctx.globalAlpha = intensity;
          ctx.fillStyle = '#ff4444';
          ctx.beginPath();
          ctx.arc(bx, by, radius, 0, Math.PI * 2);
          ctx.fill();

          // Bright center
          ctx.globalAlpha = intensity;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(bx, by, radius * 0.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [viewRef]);

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
        pointerEvents: "none",
      }}
    />
  );
});

BeaconLayer.displayName = 'BeaconLayer';
export default BeaconLayer;
