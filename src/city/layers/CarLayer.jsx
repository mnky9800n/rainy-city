import React, { useRef, useEffect } from "react";
import { useCityContext } from '../CityContext.jsx';
import { getOffsets } from '../isometric.js';
import { toScreenCoords } from '../rendering.js';
import { tileWidth, tileHeight, elevationScale } from '../constants.js';
import { buildingTypes } from '../buildings.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Muted rainy-city palette — no bright saturated hues
const CAR_COLORS = [
  '#2c3e50', '#34495e', '#5d6d7e', '#6b7b8d', '#922b21',
  '#1a5276', '#212f3d', '#b8b8b8', '#283747', '#4a235a',
];

// Yellow taxi color — spawned with ~15% probability
const TAXI_COLOR = '#c8a832';

const SPEED_MIN = 1.0; // tiles per second
const SPEED_MAX = 2.2;

// Screen-space direction vectors for each cardinal direction.
// These are the un-zoomed, un-scaled vectors describing how one full tile step
// moves in screen space under the isometric projection.
// North (dy -1): (tileX - tileY) increases by 0, (tileX + tileY) decreases by 1
//   → screenX += 0*32 but tileX same, tileY -1 → screenX += +32, screenY += -16
// Derived from toScreenCoords delta for (fracX+dx, fracY+dy) vs (fracX, fracY).
const DIR_SCREEN = {
  // { dx, dy } → { sx, sy } at zoom 1
  '0,-1': { sx:  32, sy: -16 }, // North
  '0,1':  { sx: -32, sy:  16 }, // South
  '1,0':  { sx:  32, sy:  16 }, // East
  '-1,0': { sx: -32, sy: -16 }, // West
};

// Road type → allowed direction vectors
const ROAD_DIRS = {
  road:              [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }],
  road_cross:        [{ dx: 1, dx: 1, dy: 0 }, { dx: -1, dy: 0 }],
  road_intersection: [{ dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: 1, dy: 0 }, { dx: -1, dy: 0 }],
};

// Correct road_cross entry (the duplicate key above was a typo guard — define cleanly):
ROAD_DIRS.road_cross = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }];

// ---------------------------------------------------------------------------
// Road graph construction
// ---------------------------------------------------------------------------

/**
 * Build an adjacency map from the roadSet. For each road tile, enumerate
 * neighbour tiles reachable from it given its road type. Only adds an edge
 * if the neighbour tile is also a road tile (cars must stay on roads).
 *
 * Returns Map<string, Array<{dx,dy}>> — key is "x,y", value is list of
 * valid exit directions from that tile.
 */
function buildRoadGraph(roadSet) {
  const graph = new Map();

  for (const [key, roadType] of roadSet) {
    const dirs = ROAD_DIRS[roadType];
    if (!dirs) continue;

    const [x, y] = key.split(',').map(Number);
    const validDirs = [];

    for (const dir of dirs) {
      const nx = x + dir.dx;
      const ny = y + dir.dy;
      const neighbourKey = `${nx},${ny}`;
      if (roadSet.has(neighbourKey)) {
        validDirs.push(dir);
      }
    }

    graph.set(key, validDirs);
  }

  return graph;
}

// ---------------------------------------------------------------------------
// Car spawning
// ---------------------------------------------------------------------------

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Spawn a car at a random road tile. Returns null if no road tiles exist.
 * Picks a random valid exit direction from that tile to start moving.
 */
function spawnCar(roadSet, graph) {
  const keys = Array.from(roadSet.keys());
  if (keys.length === 0) return null;

  // Try up to 20 times to find a tile that has at least one exit
  for (let attempt = 0; attempt < 20; attempt++) {
    const key = randomFrom(keys);
    const dirs = graph.get(key);
    if (!dirs || dirs.length === 0) continue;

    const [tileX, tileY] = key.split(',').map(Number);
    const dir = randomFrom(dirs);
    const isTaxi = Math.random() < 0.15;
    const color = isTaxi ? TAXI_COLOR : randomFrom(CAR_COLORS);
    const roofColor = isTaxi ? '#b0922a' : lightenHex(color, 25);

    return {
      tileX,
      tileY,
      progress: Math.random(),
      dir,
      nextTileX: tileX + dir.dx,
      nextTileY: tileY + dir.dy,
      speed: SPEED_MIN + Math.random() * (SPEED_MAX - SPEED_MIN),
      color,
      roofColor,
      // Stopping behavior: timer counts down, car stops when > 0
      stopTimer: 0,
      // Random chance to stop at intersections or just on the road
      stopChance: 0.03 + Math.random() * 0.04,
    };
  }

  return null;
}

/**
 * Minimal hex colour brightening — adds `amount` to each RGB channel,
 * clamped to [0, 255]. Input must be a 6-digit hex string starting with '#'.
 */
function lightenHex(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, (n >> 16) + amount);
  const g = Math.min(255, ((n >> 8) & 0xff) + amount);
  const b = Math.min(255, (n & 0xff) + amount);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

// ---------------------------------------------------------------------------
// Car drawing
// ---------------------------------------------------------------------------

/**
 * Draw a single glow light dot at (cx, cy) with the given colour.
 * Uses the 3-pass technique: outer glow → core fill → bright white centre.
 */
function drawLight(ctx, cx, cy, color, radius) {
  // Outer glow
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Core
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  // Bright white centre
  ctx.globalAlpha = 1.0;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.4, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Draw a single car onto ctx at screen position (sx, sy) facing `dir`.
 *
 * The car body is a small isometric parallelogram. We derive the forward and
 * right screen vectors from the direction the car is travelling, then build
 * four corners as: centre ± half_forward ± half_right.
 *
 * Headlights sit at the two front corners; taillights at the two rear corners.
 */
function drawCar(ctx, sx, sy, dir, color, roofColor, zoom) {
  const key = `${dir.dx},${dir.dy}`;
  const fwd = DIR_SCREEN[key];
  if (!fwd) return;

  // Half-extents in screen pixels at zoom 1, then scaled.
  // Car is ~12 px long × 6 px wide at zoom 1.
  const halfLen = 6 * zoom;  // along the direction of travel
  const halfWid = 3 * zoom;  // perpendicular

  // Forward unit vector in screen space
  const fMag = Math.sqrt(fwd.sx * fwd.sx + fwd.sy * fwd.sy);
  const fx = (fwd.sx / fMag) * halfLen;
  const fy = (fwd.sy / fMag) * halfLen;

  // Right-perpendicular unit vector (rotate forward 90° clockwise)
  const rx = (fwd.sy / fMag) * halfWid;
  const ry = (-fwd.sx / fMag) * halfWid;

  // Four body corners
  const fl = { x: sx + fx - rx, y: sy + fy - ry }; // front-left
  const fr = { x: sx + fx + rx, y: sy + fy + ry }; // front-right
  const rl = { x: sx - fx - rx, y: sy - fy - ry }; // rear-left
  const rr = { x: sx - fx + rx, y: sy - fy + ry }; // rear-right

  ctx.save();

  // Car body
  ctx.globalAlpha = 1.0;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(fl.x, fl.y);
  ctx.lineTo(fr.x, fr.y);
  ctx.lineTo(rr.x, rr.y);
  ctx.lineTo(rl.x, rl.y);
  ctx.closePath();
  ctx.fill();

  // Thin dark outline to separate from road
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 0.5 * zoom;
  ctx.stroke();

  // Roof — offset upward by 2px, slightly inset
  const roofLift = 2 * zoom;
  const roofInset = 0.65;
  ctx.fillStyle = roofColor;
  ctx.beginPath();
  ctx.moveTo(fl.x * roofInset + sx * (1 - roofInset), fl.y * roofInset + (sy - roofLift) * (1 - roofInset) - roofLift);
  ctx.lineTo(fr.x * roofInset + sx * (1 - roofInset), fr.y * roofInset + (sy - roofLift) * (1 - roofInset) - roofLift);
  ctx.lineTo(rr.x * roofInset + sx * (1 - roofInset), rr.y * roofInset + (sy - roofLift) * (1 - roofInset) - roofLift);
  ctx.lineTo(rl.x * roofInset + sx * (1 - roofInset), rl.y * roofInset + (sy - roofLift) * (1 - roofInset) - roofLift);
  ctx.closePath();
  ctx.fill();

  // Lights — only draw when zoom is large enough to be visible
  if (zoom >= 0.6) {
    const lightR = Math.max(0.8, 1.2 * zoom);
    const frontMid = { x: (fl.x + fr.x) / 2, y: (fl.y + fr.y) / 2 };
    const rearMid  = { x: (rl.x + rr.x) / 2, y: (rl.y + rr.y) / 2 };

    // Headlights (warm white) at front
    drawLight(ctx, frontMid.x - rx * 0.5, frontMid.y - ry * 0.5, '#ffffcc', lightR);
    drawLight(ctx, frontMid.x + rx * 0.5, frontMid.y + ry * 0.5, '#ffffcc', lightR);

    // Taillights (red) at rear
    drawLight(ctx, rearMid.x - rx * 0.5, rearMid.y - ry * 0.5, '#ff2020', lightR);
    drawLight(ctx, rearMid.x + rx * 0.5, rearMid.y + ry * 0.5, '#ff2020', lightR);
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const CarLayer = React.memo(() => {
  const canvasRef = useRef(null);
  const { dimensions, viewRef, roadSet, elevationMap, buildingMap, buildingSprites, tiles } = useCityContext();

  // Mirror mutable context values into refs so the rAF loop always reads the
  // latest values without being listed as effect dependencies (which would
  // restart the loop on every road edit).
  const dimensionsRef = useRef(dimensions);
  useEffect(() => { dimensionsRef.current = dimensions; }, [dimensions]);

  const roadSetRef = useRef(roadSet);
  useEffect(() => { roadSetRef.current = roadSet; }, [roadSet]);

  const elevationMapRef = useRef(elevationMap);
  useEffect(() => { elevationMapRef.current = elevationMap; }, [elevationMap]);

  const buildingMapRef = useRef(buildingMap);
  useEffect(() => { buildingMapRef.current = buildingMap; }, [buildingMap]);

  const buildingSpritesRef = useRef(buildingSprites);
  useEffect(() => { buildingSpritesRef.current = buildingSprites; }, [buildingSprites]);

  const tilesRef = useRef(tiles);
  useEffect(() => { tilesRef.current = tiles; }, [tiles]);

  // Road graph and car fleet — simulation state, never triggers re-renders.
  const graphRef = useRef(new Map());
  const carsRef = useRef([]);

  // Rebuild the road graph and respawn the fleet whenever roadSet changes.
  // This effect runs on the React side (not inside the rAF loop) so it's safe
  // to read roadSet directly here.
  useEffect(() => {
    const graph = buildRoadGraph(roadSet);
    graphRef.current = graph;

    const targetCount = Math.min(60, Math.max(15, Math.floor(roadSet.size / 15)));
    const cars = [];
    for (let i = 0; i < targetCount; i++) {
      const car = spawnCar(roadSet, graph);
      if (car) cars.push(car);
    }
    carsRef.current = cars;
  }, [roadSet]);

  // Animation loop — started once on mount and never restarted.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let rafId;
    let lastTime = null;

    const tick = (timestamp) => {
      rafId = requestAnimationFrame(tick);

      const { width, height } = dimensionsRef.current;
      const dt = lastTime == null ? 0 : Math.min((timestamp - lastTime) / 1000, 0.1);
      lastTime = timestamp;

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, width, height);

      const cars = carsRef.current;
      const { panX, panY, zoom } = viewRef.current;
      const { offsetX, offsetY } = getOffsets({ width, height }, zoom, panX, panY);
      const rSet  = roadSetRef.current;
      const graph = graphRef.current;
      const eMap  = elevationMapRef.current;
      const bMap  = buildingMapRef.current;
      const bSprites = buildingSpritesRef.current;
      const allTiles = tilesRef.current;

      // --- Build a lookup of car positions for traffic jam detection ---
      const carTileMap = new Map(); // "x,y" -> array of cars on that tile
      for (const car of cars) {
        const key = `${car.tileX},${car.tileY}`;
        if (!carTileMap.has(key)) carTileMap.set(key, []);
        carTileMap.get(key).push(car);
      }

      // --- Advance all cars ---
      for (let i = 0; i < cars.length; i++) {
        const car = cars[i];

        // Handle stopped cars
        if (car.stopTimer > 0) {
          car.stopTimer -= dt;
          continue;
        }

        // Check for car ahead (traffic jam) — slow down if another car
        // is on the next tile or same tile and ahead of us
        const nextKey = `${car.nextTileX},${car.nextTileY}`;
        const carsAhead = carTileMap.get(nextKey);
        let blocked = false;
        if (carsAhead) {
          for (const other of carsAhead) {
            if (other === car) continue;
            // If another car is on our next tile and moving same direction, slow down
            if (other.dir.dx === car.dir.dx && other.dir.dy === car.dir.dy && other.progress < 0.5) {
              blocked = true;
              break;
            }
          }
        }

        const effectiveSpeed = blocked ? car.speed * 0.15 : car.speed;
        car.progress += effectiveSpeed * dt;

        if (car.progress >= 1) {
          car.tileX = car.nextTileX;
          car.tileY = car.nextTileY;
          car.progress -= 1;

          const currentKey = `${car.tileX},${car.tileY}`;
          const exits = graph.get(currentKey) ?? [];
          const nonUTurn = exits.filter(
            d => !(d.dx === -car.dir.dx && d.dy === -car.dir.dy)
          );
          const candidates = nonUTurn.length > 0 ? nonUTurn : exits;

          if (candidates.length === 0) {
            const fresh = spawnCar(rSet, graph);
            if (fresh) cars[i] = fresh;
            continue;
          }

          // Random chance to stop (parked, picking someone up, red light, etc.)
          if (Math.random() < car.stopChance) {
            car.stopTimer = 1.5 + Math.random() * 4; // stop for 1.5-5.5 seconds
          }

          car.dir = randomFrom(candidates);
          car.nextTileX = car.tileX + car.dir.dx;
          car.nextTileY = car.tileY + car.dir.dy;
        }
      }

      // --- Compute car screen positions and depths ---
      const carDrawList = [];
      for (const car of cars) {
        const fracX = car.tileX + car.dir.dx * car.progress;
        const fracY = car.tileY + car.dir.dy * car.progress;
        const { screenX, screenY } = toScreenCoords(fracX, fracY, zoom, offsetX, offsetY);
        const curElev = eMap[car.tileY]?.[car.tileX] ?? 0;
        const nxtElev = eMap[car.nextTileY]?.[car.nextTileX] ?? 0;
        const elev = curElev + (nxtElev - curElev) * car.progress;
        const elevOff = -elev * elevationScale * zoom;

        const cullRadius = 20 * zoom;
        if (screenX + cullRadius < 0 || screenX - cullRadius > width ||
            screenY + elevOff + cullRadius < 0 || screenY + elevOff - cullRadius > height) continue;

        carDrawList.push({
          type: 'car',
          depth: fracX + fracY,
          car,
          sx: screenX,
          sy: screenY + elevOff,
        });
      }

      // --- Collect buildings that need drawing ---
      const buildingDrawList = [];
      const drawnOrigins = new Set();
      if (bMap && allTiles) {
        for (const tile of allTiles) {
          const building = bMap.get(`${tile.x},${tile.y}`);
          if (!building) continue;
          const bType = buildingTypes[building.type];
          if (!bType) continue;
          const [fw, fh] = bType.footprint;
          if (tile.x !== building.originX + fw - 1 || tile.y !== building.originY + fh - 1) continue;
          const originKey = `${building.originX},${building.originY}`;
          if (drawnOrigins.has(originKey)) continue;
          drawnOrigins.add(originKey);

          const spriteEntry = bSprites?.[building.type];
          const sprite = Array.isArray(spriteEntry) ? spriteEntry[building.variant ?? 0] : spriteEntry;
          if (!sprite) continue;

          const { screenX, screenY } = toScreenCoords(tile.x, tile.y, zoom, offsetX, offsetY);
          const yOffset = -tile.elevation * elevationScale * zoom;
          const spriteW = bType.spriteWidth * zoom;
          const spriteH = bType.spriteHeight * zoom;

          buildingDrawList.push({
            type: 'building',
            depth: tile.x + tile.y,
            sprite,
            drawX: screenX - spriteW / 2,
            drawY: screenY + yOffset - spriteH + (tileHeight * zoom),
            spriteW,
            spriteH,
          });
        }
      }

      // --- Merge and sort by depth (back to front) ---
      const drawList = [...buildingDrawList, ...carDrawList];
      drawList.sort((a, b) => a.depth - b.depth);

      // --- Draw everything ---
      for (const item of drawList) {
        if (item.type === 'building') {
          ctx.drawImage(item.sprite, item.drawX, item.drawY, item.spriteW, item.spriteH);
        } else {
          drawCar(ctx, item.sx, item.sy, item.car.dir, item.car.color, item.car.roofColor, zoom);
        }
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
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        display: 'block',
        zIndex: 3,
        pointerEvents: 'none',
      }}
    />
  );
});

CarLayer.displayName = 'CarLayer';
export default CarLayer;
