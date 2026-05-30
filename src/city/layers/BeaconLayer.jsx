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

// Beacons for the radio tower: antenna tip, upper observation deck corners,
// and lower observation deck corners.
const RADIO_TOWER_BEACONS = [
  { x: 0.5039, y: 0.0656 },
  { x: 0.4375, y: 0.2437 },
  { x: 0.5,    y: 0.2531 },
  { x: 0.5664, y: 0.2406 },
  { x: 0.2969, y: 0.5281 },
  { x: 0.4961, y: 0.5656 },
  { x: 0.707,  y: 0.5219 },
];

// Beacons for the Low Impact Fruit (NYT-style) tower: antenna tip and the
// four crown corners of the small setback box at the top of the building.
const NYT_TOWER_BEACONS = [
  { x: 0.5365, y: 0.0063 },
  { x: 0.1979, y: 0.2313 },
  { x: 0.4896, y: 0.2687 },
  { x: 0.7865, y: 0.2062 },
];

// Cinema lights — STAR neon (pulsing pink), marquee bulbs (warm yellow chase),
// roofline accent trim (cyan slow pulse). Placed via /cinema-beacon-tool.html.
const CINEMA_LIGHTS = [
  { x: 0.151, y: 0.3944, kind: "bulb" },
  { x: 0.1875, y: 0.4167, kind: "bulb" },
  { x: 0.2292, y: 0.4333, kind: "bulb" },
  { x: 0.276, y: 0.4611, kind: "bulb" },
  { x: 0.3229, y: 0.4778, kind: "bulb" },
  { x: 0.3594, y: 0.5, kind: "bulb" },
  { x: 0.401, y: 0.5167, kind: "bulb" },
  { x: 0.4427, y: 0.5389, kind: "bulb" },
  { x: 0.4844, y: 0.5667, kind: "bulb" },
  { x: 0.5313, y: 0.5778, kind: "bulb" },
  { x: 0.5677, y: 0.6056, kind: "bulb" },
  { x: 0.6146, y: 0.6167, kind: "bulb" },
  { x: 0.651, y: 0.6056, kind: "bulb" },
  { x: 0.651, y: 0.6889, kind: "bulb" },
  { x: 0.6146, y: 0.7111, kind: "bulb" },
  { x: 0.5729, y: 0.7056, kind: "bulb" },
  { x: 0.5417, y: 0.6778, kind: "bulb" },
  { x: 0.5052, y: 0.6611, kind: "bulb" },
  { x: 0.474, y: 0.6444, kind: "bulb" },
  { x: 0.4427, y: 0.6333, kind: "bulb" },
  { x: 0.4063, y: 0.6111, kind: "bulb" },
  { x: 0.3698, y: 0.6, kind: "bulb" },
  { x: 0.3385, y: 0.5778, kind: "bulb" },
  { x: 0.3021, y: 0.5556, kind: "bulb" },
  { x: 0.2656, y: 0.5389, kind: "bulb" },
  { x: 0.224, y: 0.5167, kind: "bulb" },
  { x: 0.1927, y: 0.5, kind: "bulb" },
  { x: 0.151, y: 0.4833, kind: "bulb" },
  { x: 0.3958, y: 0.1833, kind: "neon" },
  { x: 0.3906, y: 0.1833, kind: "neon" },
  { x: 0.3854, y: 0.1944, kind: "neon" },
  { x: 0.3906, y: 0.2111, kind: "neon" },
  { x: 0.401, y: 0.2222, kind: "neon" },
  { x: 0.401, y: 0.2278, kind: "neon" },
  { x: 0.3906, y: 0.2278, kind: "neon" },
  { x: 0.3802, y: 0.2556, kind: "neon" },
  { x: 0.3958, y: 0.2611, kind: "neon" },
  { x: 0.401, y: 0.2611, kind: "neon" },
  { x: 0.3906, y: 0.2667, kind: "neon" },
  { x: 0.3906, y: 0.2778, kind: "neon" },
  { x: 0.3906, y: 0.2944, kind: "neon" },
  { x: 0.3906, y: 0.3222, kind: "neon" },
  { x: 0.3854, y: 0.3278, kind: "neon" },
  { x: 0.3802, y: 0.3389, kind: "neon" },
  { x: 0.3802, y: 0.35, kind: "neon" },
  { x: 0.3958, y: 0.3278, kind: "neon" },
  { x: 0.3958, y: 0.3389, kind: "neon" },
  { x: 0.401, y: 0.3556, kind: "neon" },
  { x: 0.3906, y: 0.3444, kind: "neon" },
  { x: 0.3906, y: 0.3889, kind: "neon" },
  { x: 0.401, y: 0.3889, kind: "neon" },
  { x: 0.401, y: 0.4, kind: "neon" },
  { x: 0.3854, y: 0.4, kind: "neon" },
  { x: 0.3854, y: 0.3833, kind: "neon" },
  { x: 0.3906, y: 0.4222, kind: "neon" },
  { x: 0.3854, y: 0.4278, kind: "neon" },
  { x: 0.3958, y: 0.4222, kind: "neon" },
  { x: 0.401, y: 0.4278, kind: "neon" },
  { x: 0.401, y: 0.4389, kind: "neon" },
  { x: 0.4688, y: 0.2833, kind: "accent" },
  { x: 0.5, y: 0.3, kind: "accent" },
  { x: 0.5313, y: 0.3167, kind: "accent" },
  { x: 0.5625, y: 0.3278, kind: "accent" },
  { x: 0.599, y: 0.3444, kind: "accent" },
  { x: 0.6354, y: 0.3333, kind: "accent" },
  { x: 0.6563, y: 0.3611, kind: "accent" },
  { x: 0.6875, y: 0.35, kind: "accent" },
  { x: 0.724, y: 0.3333, kind: "accent" },
  { x: 0.7552, y: 0.3111, kind: "accent" },
  { x: 0.7917, y: 0.2944, kind: "accent" },
  { x: 0.8229, y: 0.2778, kind: "accent" },
  { x: 0.8542, y: 0.2556, kind: "accent" },
  { x: 0.3542, y: 0.2167, kind: "accent" },
  { x: 0.3281, y: 0.2111, kind: "accent" },
  { x: 0.3073, y: 0.1944, kind: "accent" },
  { x: 0.2865, y: 0.1667, kind: "accent" },
  { x: 0.2604, y: 0.1611, kind: "accent" },
];

const CINEMA_BULBS = CINEMA_LIGHTS.filter((l) => l.kind === "bulb");
const CINEMA_NEONS = CINEMA_LIGHTS.filter((l) => l.kind === "neon");
const CINEMA_ACCENTS = CINEMA_LIGHTS.filter((l) => l.kind === "accent");

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

      // Draw a single glowing light: wide bloom + core + bright center.
      // Uses additive blending so multiple lights brighten each other.
      const drawLight = (bx, by, color, intensity, radius) => {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = intensity * 0.45;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(bx, by, radius * 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = intensity;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(bx, by, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = intensity;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(bx, by, radius * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      };

      // Cinema marquee chase: rolling wave of brightness through bulbs in
      // click order. Period chosen to feel like a retro chase, not a strobe.
      const CHASE_PERIOD = 1.6; // seconds for the wave to traverse all bulbs
      const BULB_BASE = 0.4;    // baseline brightness so unlit bulbs still glow

      // Neon gentle breathing pulse
      const NEON_PULSE_PERIOD = 2.4;

      // Accent slow shimmer
      const ACCENT_PULSE_PERIOD = 3.2;

      const drawn = new Set();
      for (const [key, building] of bMap) {
        const isTowerBlinker =
          building.type === 'skyscraper' ||
          building.type === 'radio_tower' ||
          building.type === 'nyt_tower';
        const isCinema = building.type === 'cinema';
        if (!isTowerBlinker && !isCinema) continue;

        const originKey = `${building.originX},${building.originY}`;
        if (drawn.has(originKey)) continue;
        drawn.add(originKey);

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
        const drawX = screenX - spriteW / 2;
        const drawY = screenY + yOffset - spriteH + (tileHeight * zoom);

        if (isCinema) {
          // Neon STAR sign — all neon pixels pulse together
          const neonI = 0.7 + 0.3 * Math.sin((elapsed / NEON_PULSE_PERIOD) * Math.PI * 2);
          for (const pos of CINEMA_NEONS) {
            drawLight(drawX + pos.x * spriteW, drawY + pos.y * spriteH, '#ff2a8e', neonI, 2.2 * zoom);
          }

          // Cyan accent trim — slow shimmer, slightly offset per-light for a
          // gentle traveling effect along the roofline
          const accentBase = 0.5 + 0.3 * Math.sin((elapsed / ACCENT_PULSE_PERIOD) * Math.PI * 2);
          for (let i = 0; i < CINEMA_ACCENTS.length; i++) {
            const pos = CINEMA_ACCENTS[i];
            const offset = 0.15 * Math.sin(((elapsed + i * 0.18) / ACCENT_PULSE_PERIOD) * Math.PI * 2);
            const ai = Math.max(0.2, accentBase + offset);
            drawLight(drawX + pos.x * spriteW, drawY + pos.y * spriteH, '#4ad8ff', ai, 1.8 * zoom);
          }

          // Marquee bulb chase — rolling wave of bright bulbs around the perimeter
          const N = CINEMA_BULBS.length;
          if (N > 0) {
            const head = (elapsed / CHASE_PERIOD) % 1; // 0..1 normalized position
            for (let i = 0; i < N; i++) {
              const phase = i / N;
              let d = phase - head;
              if (d < -0.5) d += 1;
              if (d >  0.5) d -= 1;
              // Trailing comet: bright at the head, fades behind
              const trail = 0.18;
              const t = d <= 0 && d > -trail ? 1 + d / trail : 0;
              const intensity = Math.min(1, BULB_BASE + t * 0.7);
              const pos = CINEMA_BULBS[i];
              drawLight(drawX + pos.x * spriteW, drawY + pos.y * spriteH, '#ffd24a', intensity, 1.7 * zoom);
            }
          }
          continue;
        }

        // Tower red aircraft-warning blink
        const variant = building.variant ?? 0;
        const positions =
          building.type === 'radio_tower' ? RADIO_TOWER_BEACONS :
          building.type === 'nyt_tower'   ? NYT_TOWER_BEACONS :
          BEACON_POSITIONS[variant];
        if (!positions) continue;

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
