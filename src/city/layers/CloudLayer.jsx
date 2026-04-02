import React, { useRef, useEffect } from "react";
import { useCityContext } from '../CityContext.jsx';

// Number of clouds in the scene at any one time. Sparse by design.
const CLOUD_COUNT = 10;

// Clouds drift from the sea corner (top-left of isometric view) toward the
// city corner (bottom-right). In screen space that's rightward and slightly
// downward, matching the isometric diagonal.
const DRIFT_ANGLE = Math.PI * 0.08; // ~14° below horizontal
const DRIFT_SPEED_MIN = 18;  // px/s at zoom 1
const DRIFT_SPEED_MAX = 32;  // px/s at zoom 1

// Each cloud is a collection of puff circles. These parameters define the
// range of values used when randomly generating a cloud's shape.
const PUFF_COUNT_MIN = 4;
const PUFF_COUNT_MAX = 14;
const BASE_RADIUS_MIN = 60;
const BASE_RADIUS_MAX = 150;

/**
 * Generate a single cloud's immutable shape descriptor. The shape is a list
 * of "puffs" — circles with relative offsets and sizes. This is separated
 * from position so the shape stays stable while the cloud drifts.
 *
 * Rain clouds are rendered dark (blue-grey) with a lighter highlight cluster
 * near the top to sell the 3D volume.
 */
function generateCloudShape() {
  const baseRadius = BASE_RADIUS_MIN + Math.random() * (BASE_RADIUS_MAX - BASE_RADIUS_MIN);
  const puffCount = PUFF_COUNT_MIN + Math.floor(Math.random() * (PUFF_COUNT_MAX - PUFF_COUNT_MIN + 1));

  const puffs = [];
  const bodyWidth = baseRadius * (1.6 + Math.random() * 0.6);
  const bodyHeight = baseRadius * (0.6 + Math.random() * 0.3);

  // Helper to generate per-puff ellipsoid properties
  const makePuff = (xOff, yOff, radius) => ({
    xOff, yOff, radius,
    // Ellipsoid: stretch along one axis, rotated at a random angle
    stretch: 1.0 + Math.random() * 0.8,  // 1.0 to 1.8x along one axis
    rotation: Math.random() * Math.PI,     // random orientation
    driftVx: (Math.random() - 0.5) * 2.5,
    driftVy: (Math.random() - 0.5) * 1.2,
    breathePhase: Math.random() * Math.PI * 2,
    breatheSpeed: 0.15 + Math.random() * 0.25,
    breatheAmp: 0.06 + Math.random() * 0.08,
  });

  // Start with a large central puff
  puffs.push(makePuff(
    (Math.random() - 0.5) * baseRadius * 0.3,
    (Math.random() - 0.5) * baseRadius * 0.15,
    baseRadius * (0.8 + Math.random() * 0.3),
  ));

  // Scatter remaining puffs randomly within an elliptical area
  for (let i = 1; i < puffCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * 0.7 + 0.15;
    const xOff = Math.cos(angle) * dist * bodyWidth;
    const yOff = Math.sin(angle) * dist * bodyHeight;
    const distFromCenter = Math.sqrt((xOff / bodyWidth) ** 2 + (yOff / bodyHeight) ** 2);
    const radius = baseRadius * (0.45 + (1 - distFromCenter) * 0.5 + Math.random() * 0.2);
    puffs.push(makePuff(xOff, yOff, radius));
  }

  // Sort back to front so upper puffs render behind lower ones
  puffs.sort((a, b) => a.yOff - b.yOff);

  return { puffs, baseRadius, bodyWidth };
}

/**
 * Spawn a cloud at a position along the sea-side edge of the screen (left or
 * top edge, biased toward the top-left corner since that's the sea direction).
 * `width` and `height` are the current canvas dimensions.
 */
function spawnCloud(width, height, allowOffscreen = false) {
  const shape = generateCloudShape();

  let x, y;

  if (allowOffscreen) {
    // Respawn: place along the entire left or top edge so clouds enter spread out
    const edge = Math.random();
    if (edge < 0.5) {
      x = -shape.baseRadius * 2;
      y = (Math.random() - 0.3) * height * 1.4;
    } else {
      x = (Math.random() - 0.3) * width * 1.4;
      y = -shape.baseRadius * 2;
    }
  } else {
    // Initial spawn: scatter across the full visible area
    x = Math.random() * width;
    y = Math.random() * height;
  }

  const speed = DRIFT_SPEED_MIN + Math.random() * (DRIFT_SPEED_MAX - DRIFT_SPEED_MIN);
  const angle = DRIFT_ANGLE + (Math.random() - 0.5) * 0.25;
  const opacity = 0.35 + Math.random() * 0.4;

  return { x, y, shape, speed, angle, opacity };
}

/**
 * Determine whether a cloud has drifted fully off the right/bottom edge of
 * the screen and should be recycled.
 */
function isOffscreenRight(cloud, width, height) {
  const { baseRadius, bodyWidth } = cloud.shape;
  const halfW = bodyWidth + baseRadius;
  const halfH = baseRadius * 1.5;
  return cloud.x - halfW > width || cloud.y - halfH > height;
}

/**
 * Draw a single rain cloud onto the canvas context at its current (cx, cy)
 * center position. Rain clouds are rendered dark (slate blue-grey) with
 * subtle lighter highlights to create 3D volume. A soft shadow ellipse at
 * the base anchors the cloud visually.
 */
function drawCloud(ctx, cx, cy, shape, opacity, zoom = 1) {
  const { puffs, baseRadius, bodyWidth } = shape;

  ctx.save();
  ctx.globalAlpha = opacity;

  // --- Bottom shadow ellipse ---
  const sr = baseRadius * zoom;
  const sw = bodyWidth * zoom;
  const shadowGrad = ctx.createRadialGradient(
    cx, cy + sr * 0.55, 0,
    cx, cy + sr * 0.55, sw * 0.85
  );
  shadowGrad.addColorStop(0, 'rgba(30, 35, 50, 0.35)');
  shadowGrad.addColorStop(0.6, 'rgba(30, 35, 50, 0.12)');
  shadowGrad.addColorStop(1, 'rgba(30, 35, 50, 0)');
  ctx.fillStyle = shadowGrad;
  ctx.beginPath();
  ctx.ellipse(cx, cy + sr * 0.6, sw * 0.85, sr * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();

  // --- Puff circles ---
  for (const puff of puffs) {
    const px = cx + puff.xOff * zoom;
    const py = cy + puff.yOff * zoom;
    const breathe = 1 + Math.sin(puff.breathePhase) * puff.breatheAmp;
    const r = puff.radius * breathe * zoom;

    // Draw as ellipsoid: translate to puff center, rotate, scale, draw unit circle
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(puff.rotation);
    ctx.scale(puff.stretch, 1);

    const puffGrad = ctx.createRadialGradient(
      -r * 0.15 / puff.stretch, -r * 0.2, r * 0.05,
      0, 0, r
    );
    puffGrad.addColorStop(0,   'rgba(90, 100, 120, 0.92)');
    puffGrad.addColorStop(0.3, 'rgba(70,  80, 105, 0.88)');
    puffGrad.addColorStop(0.7, 'rgba(55,  65,  90, 0.80)');
    puffGrad.addColorStop(1,   'rgba(40,  50,  75, 0)');

    ctx.fillStyle = puffGrad;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // --- Highlight pass ---
  const highestPuff = puffs.reduce((hi, p) => p.yOff < hi.yOff ? p : hi, puffs[0]);
  const hx = cx + highestPuff.xOff * zoom;
  const hy = cy + highestPuff.yOff * zoom;
  const hr = highestPuff.radius * 0.7 * zoom;

  ctx.save();
  ctx.translate(hx, hy - hr * 0.2);
  ctx.rotate(highestPuff.rotation);
  ctx.scale(highestPuff.stretch, 1);

  const highlightGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, hr);
  highlightGrad.addColorStop(0,   'rgba(160, 170, 195, 0.55)');
  highlightGrad.addColorStop(0.5, 'rgba(120, 135, 165, 0.25)');
  highlightGrad.addColorStop(1,   'rgba(100, 115, 145, 0)');

  ctx.fillStyle = highlightGrad;
  ctx.beginPath();
  ctx.arc(0, 0, hr, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.restore();
}

const CloudLayer = React.memo(() => {
  const canvasRef = useRef(null);
  const { dimensions, viewRef } = useCityContext();

  const dimensionsRef = useRef(dimensions);
  useEffect(() => { dimensionsRef.current = dimensions; }, [dimensions]);

  // Cloud state lives entirely in a ref — it's mutable simulation state,
  // not React state, because we never want a state change to trigger a render.
  const cloudsRef = useRef(null);

  // Initialize clouds once on mount, distributed across the visible area so
  // the screen doesn't start empty.
  useEffect(() => {
    const { width, height } = dimensionsRef.current;
    const { panX, panY, zoom } = viewRef.current;
    const visibleWidth = width / zoom;
    const visibleHeight = height / zoom;
    const visibleLeft = -panX / zoom;
    const visibleTop = -panY / zoom;
    const clouds = [];
    for (let i = 0; i < CLOUD_COUNT; i++) {
      const cloud = spawnCloud(visibleWidth, visibleHeight, false);
      cloud.x += visibleLeft;
      cloud.y += visibleTop;
      clouds.push(cloud);
    }
    cloudsRef.current = clouds;
  }, []);

  // Animation loop — runs once on mount, reads dimensionsRef each frame.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let rafId;
    let lastTime = null;

    const tick = (timestamp) => {
      rafId = requestAnimationFrame(tick);

      if (!cloudsRef.current) return;

      const { width, height } = dimensionsRef.current;
      const dt = lastTime == null ? 0 : Math.min((timestamp - lastTime) / 1000, 0.1);
      lastTime = timestamp;

      // Sync canvas resolution to current dimensions
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, width, height);

      const { panX, panY, zoom } = viewRef.current;

      // Compute the visible world-space bounds so we can recycle/spawn correctly
      const visibleLeft = -panX / zoom;
      const visibleTop = -panY / zoom;
      const visibleWidth = width / zoom;
      const visibleHeight = height / zoom;

      const clouds = cloudsRef.current;
      for (let i = 0; i < clouds.length; i++) {
        const cloud = clouds[i];

        // Advance position in world space
        cloud.x += Math.cos(cloud.angle) * cloud.speed * dt;
        cloud.y += Math.sin(cloud.angle) * cloud.speed * dt;

        // Evolve puff positions and sizes slowly over time
        for (const puff of cloud.shape.puffs) {
          puff.xOff += puff.driftVx * dt;
          puff.yOff += puff.driftVy * dt;
          puff.breathePhase += puff.breatheSpeed * dt;
        }

        // Recycle clouds that have left the visible area
        if (isOffscreenRight(cloud, visibleLeft + visibleWidth, visibleTop + visibleHeight)) {
          // Respawn at the sea-side edge of the current view
          const newCloud = spawnCloud(visibleWidth, visibleHeight, true);
          newCloud.x += visibleLeft;
          newCloud.y += visibleTop;
          clouds[i] = newCloud;
          continue;
        }

        // Convert world position to screen position and skip if off-screen
        const screenX = cloud.x * zoom + panX;
        const screenY = cloud.y * zoom + panY;
        const cloudRadius = (cloud.shape.bodyWidth + cloud.shape.baseRadius) * zoom;
        if (screenX + cloudRadius < 0 || screenX - cloudRadius > width ||
            screenY + cloudRadius < 0 || screenY - cloudRadius > height) continue;

        drawCloud(ctx, screenX, screenY, cloud.shape, cloud.opacity, zoom);
      }
    };

    rafId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafId);
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
});

CloudLayer.displayName = 'CloudLayer';
export default CloudLayer;
