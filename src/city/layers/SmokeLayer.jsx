import React, { useRef, useEffect } from "react";
import { useCityContext } from '../CityContext.jsx';
import { getOffsets } from '../isometric.js';
import { tileWidth, tileHeight, elevationScale } from '../constants.js';
import { buildingTypes } from '../buildings.js';

const SmokeLayer = () => {
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const lastSpawnRef = useRef(new Map());
  const stateRef = useRef({});
  const { dimensions, zoom, panX, panY, buildingMap, elevationMap } = useCityContext();

  // Keep a mutable ref to latest state so the rAF loop always reads current values
  stateRef.current = { dimensions, zoom, panX, panY, buildingMap, elevationMap };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let frameId;
    let lastTime = performance.now();

    function animate(now) {
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      const { dimensions, zoom, panX, panY, buildingMap, elevationMap } = stateRef.current;

      if (canvas.width !== dimensions.width || canvas.height !== dimensions.height) {
        canvas.width = dimensions.width;
        canvas.height = dimensions.height;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const { offsetX, offsetY } = getOffsets(dimensions, zoom, panX, panY);
      const particles = particlesRef.current;
      const lastSpawn = lastSpawnRef.current;

      // Find all cabin buildings (house variant 2) and spawn particles
      const seen = new Set();
      for (const [key, building] of buildingMap) {
        if (building.type !== "house" || building.variant !== 2) continue;
        const originKey = `${building.originX},${building.originY}`;
        if (seen.has(originKey)) continue;
        seen.add(originKey);

        const bType = buildingTypes.house;
        const [fw, fh] = bType.footprint;
        const southX = building.originX + fw - 1;
        const southY = building.originY + fh - 1;

        const sx = (southX - southY) * (tileWidth / 2) * zoom + offsetX;
        const sy = (southX + southY) * (tileHeight / 2) * zoom + offsetY;
        const elev = elevationMap[southY]?.[southX] ?? 0;
        const yOff = -elev * elevationScale * zoom;

        const spriteW = bType.spriteWidth * zoom;
        const spriteH = bType.spriteHeight * zoom;
        const chimneyX = sx + spriteW * 0.15;
        const chimneyY = sy + yOff - spriteH + (tileHeight * zoom) + spriteH * 0.08;

        // Spawn new puff every ~400ms per cabin
        const lastT = lastSpawn.get(originKey) || 0;
        if (now - lastT > 400) {
          lastSpawn.set(originKey, now);
          particles.push({
            x: chimneyX + (Math.random() - 0.5) * 2 * zoom,
            y: chimneyY,
            vx: (Math.random() - 0.3) * 4 * zoom,
            vy: -12 * zoom,
            radius: 2 * zoom,
            maxRadius: (6 + Math.random() * 2) * zoom,
            life: 0,
            maxLife: 1.5 + Math.random(),
            opacity: 0.6,
          });
        }
      }

      // Update and draw particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life += dt;
        if (p.life >= p.maxLife) {
          particles.splice(i, 1);
          continue;
        }

        const t = p.life / p.maxLife;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy *= 0.99;
        p.vx += (Math.random() - 0.5) * 0.5 * zoom;

        const currentRadius = p.radius + (p.maxRadius - p.radius) * t;
        const currentOpacity = p.opacity * (1 - t);

        // Chunky puff: overlapping circles
        ctx.fillStyle = `rgba(180, 180, 180, ${currentOpacity})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, currentRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(p.x + currentRadius * 0.4, p.y - currentRadius * 0.3, currentRadius * 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(p.x - currentRadius * 0.3, p.y + currentRadius * 0.2, currentRadius * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }

      frameId = requestAnimationFrame(animate);
    }

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, []);

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
        zIndex: 4,
        pointerEvents: "none",
      }}
    />
  );
};

export default SmokeLayer;
