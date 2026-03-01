import { tileWidth, tileHeight, elevationScale, gridWidth, gridHeight } from './constants.js';

// Building type definitions
// footprint: [width, height] in tiles
// spriteWidth/spriteHeight: pixel dimensions of the sprite canvas
// color: base color for placeholder sprite generation
// popupContent: optional { title, description } for InfoPopup on click
export const buildingTypes = {
  house: {
    footprint: [1, 1],
    spriteWidth: 64,
    spriteHeight: 80,
    color: "#a0522d",
  },
  apartment: {
    footprint: [1, 1],
    spriteWidth: 64,
    spriteHeight: 112,
    color: "#708090",
  },
  office: {
    footprint: [2, 2],
    spriteWidth: 128,
    spriteHeight: 160,
    color: "#4682b4",
  },
  landmark: {
    footprint: [3, 3],
    spriteWidth: 192,
    spriteHeight: 224,
    color: "#8b008b",
    popupContent: {
      title: "City Hall",
      description: "The heart of Rainy City.",
    },
  },
};

// Adjust a hex color brightness by a percentage (-100 to +100)
function adjustColor(hex, percent) {
  const num = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, Math.max(0, (num >> 16) + amt));
  const G = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amt));
  const B = Math.min(255, Math.max(0, (num & 0xff) + amt));
  return `rgb(${R},${G},${B})`;
}

// Generate a placeholder isometric block sprite for a building type.
// Returns an offscreen canvas that can be drawn with ctx.drawImage().
export function generateBuildingSprite(typeName) {
  const type = buildingTypes[typeName];
  if (!type) return null;

  const { spriteWidth, spriteHeight, footprint, color } = type;
  const [fw, fh] = footprint;

  const canvas = document.createElement("canvas");
  canvas.width = spriteWidth;
  canvas.height = spriteHeight;
  const ctx = canvas.getContext("2d");

  // The isometric diamond base dimensions for this footprint
  const baseW = fw * tileWidth; // diamond width in pixels (at zoom=1)
  const baseH = fh * tileHeight; // diamond height in pixels (at zoom=1)

  // Building height is the sprite height minus the base diamond half-height
  const buildingPixelHeight = spriteHeight - baseH / 2;

  // Center of the sprite horizontally, bottom of the sprite is the south corner
  const cx = spriteWidth / 2;
  const bottom = spriteHeight;

  // Diamond corners (south point at bottom-center)
  const south = { x: cx, y: bottom };
  const east = { x: cx + baseW / 2, y: bottom - baseH / 2 };
  const north = { x: cx, y: bottom - baseH };
  const west = { x: cx - baseW / 2, y: bottom - baseH / 2 };

  // Roof corners (same diamond shifted up by building height)
  const roofSouth = { x: south.x, y: south.y - buildingPixelHeight };
  const roofEast = { x: east.x, y: east.y - buildingPixelHeight };
  const roofNorth = { x: north.x, y: north.y - buildingPixelHeight };
  const roofWest = { x: west.x, y: west.y - buildingPixelHeight };

  // Left wall (west-south face) — darker
  ctx.fillStyle = adjustColor(color, -20);
  ctx.beginPath();
  ctx.moveTo(west.x, west.y);
  ctx.lineTo(south.x, south.y);
  ctx.lineTo(roofSouth.x, roofSouth.y);
  ctx.lineTo(roofWest.x, roofWest.y);
  ctx.closePath();
  ctx.fill();

  // Right wall (south-east face) — darkest
  ctx.fillStyle = adjustColor(color, -40);
  ctx.beginPath();
  ctx.moveTo(south.x, south.y);
  ctx.lineTo(east.x, east.y);
  ctx.lineTo(roofEast.x, roofEast.y);
  ctx.lineTo(roofSouth.x, roofSouth.y);
  ctx.closePath();
  ctx.fill();

  // Roof (top face) — lighter
  ctx.fillStyle = adjustColor(color, 15);
  ctx.beginPath();
  ctx.moveTo(roofNorth.x, roofNorth.y);
  ctx.lineTo(roofEast.x, roofEast.y);
  ctx.lineTo(roofSouth.x, roofSouth.y);
  ctx.lineTo(roofWest.x, roofWest.y);
  ctx.closePath();
  ctx.fill();

  // Outlines
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.lineWidth = 1;

  // Roof outline
  ctx.beginPath();
  ctx.moveTo(roofNorth.x, roofNorth.y);
  ctx.lineTo(roofEast.x, roofEast.y);
  ctx.lineTo(roofSouth.x, roofSouth.y);
  ctx.lineTo(roofWest.x, roofWest.y);
  ctx.closePath();
  ctx.stroke();

  // Vertical edges
  ctx.beginPath();
  ctx.moveTo(roofSouth.x, roofSouth.y);
  ctx.lineTo(south.x, south.y);
  ctx.moveTo(roofWest.x, roofWest.y);
  ctx.lineTo(west.x, west.y);
  ctx.moveTo(roofEast.x, roofEast.y);
  ctx.lineTo(east.x, east.y);
  ctx.stroke();

  // Bottom edges (visible walls)
  ctx.beginPath();
  ctx.moveTo(west.x, west.y);
  ctx.lineTo(south.x, south.y);
  ctx.lineTo(east.x, east.y);
  ctx.stroke();

  return canvas;
}

// Generate all placeholder building sprites. Returns a Map<typeName, canvas>.
export function generateAllBuildingSprites() {
  const sprites = {};
  for (const typeName of Object.keys(buildingTypes)) {
    sprites[typeName] = generateBuildingSprite(typeName);
  }
  return sprites;
}

// Check if a building can be placed at (x, y) with the given footprint.
// Requires: all tiles in footprint are land, flat (same elevation), not road, not water, not already occupied.
export function canPlaceBuilding(x, y, typeName, elevationMap, roadSet, buildingMap) {
  const type = buildingTypes[typeName];
  if (!type) return false;
  const [fw, fh] = type.footprint;

  // Check bounds
  if (x < 0 || y < 0 || x + fw > gridWidth || y + fh > gridHeight) return false;

  const baseElev = elevationMap[y][x];
  if (baseElev <= 0) return false; // no water

  for (let dy = 0; dy < fh; dy++) {
    for (let dx = 0; dx < fw; dx++) {
      const tx = x + dx;
      const ty = y + dy;
      const elev = elevationMap[ty][tx];

      // Must be land, same elevation as origin, no road, no existing building
      if (elev <= 0) return false;
      if (elev !== baseElev) return false;
      if (roadSet.has(`${tx},${ty}`)) return false;
      if (buildingMap.has(`${tx},${ty}`)) return false;
    }
  }

  return true;
}

// Place a building into the buildingMap. Returns a new Map with the building added.
// Does NOT validate — call canPlaceBuilding first.
export function placeBuildingInMap(x, y, typeName, buildingMap) {
  const type = buildingTypes[typeName];
  const [fw, fh] = type.footprint;
  const newMap = new Map(buildingMap);

  for (let dy = 0; dy < fh; dy++) {
    for (let dx = 0; dx < fw; dx++) {
      newMap.set(`${x + dx},${y + dy}`, {
        type: typeName,
        originX: x,
        originY: y,
      });
    }
  }

  return newMap;
}

// Remove a building from the map. Finds the origin from any tile in the footprint.
export function removeBuildingFromMap(x, y, buildingMap) {
  const entry = buildingMap.get(`${x},${y}`);
  if (!entry) return buildingMap;

  const type = buildingTypes[entry.type];
  const [fw, fh] = type.footprint;
  const newMap = new Map(buildingMap);

  for (let dy = 0; dy < fh; dy++) {
    for (let dx = 0; dx < fw; dx++) {
      newMap.delete(`${entry.originX + dx},${entry.originY + dy}`);
    }
  }

  return newMap;
}

// Auto-place buildings near roads on flat terrain.
// Uses a seeded pseudo-random approach for determinism.
export function autoPlaceBuildings(elevationMap, roadSet) {
  let buildingMap = new Map();

  // Collect all road-adjacent flat grass tiles
  const roadAdjacent = new Set();
  for (const key of roadSet.keys()) {
    const [rx, ry] = key.split(",").map(Number);
    // Check 4-connected neighbors
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nx = rx + dx;
      const ny = ry + dy;
      if (nx < 0 || ny < 0 || nx >= gridWidth || ny >= gridHeight) continue;
      if (elevationMap[ny][nx] <= 0) continue; // skip water
      if (roadSet.has(`${nx},${ny}`)) continue; // skip roads
      roadAdjacent.add(`${nx},${ny}`);
    }
  }

  // Simple seeded PRNG
  let seed = 12345;
  const rand = () => {
    seed = (seed * 16807 + 0) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  // Shuffle road-adjacent tiles
  const candidates = Array.from(roadAdjacent);
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  // Try placing larger buildings first, then fill with small ones
  // Attempt a few landmarks and offices
  for (const candidate of candidates) {
    const [cx, cy] = candidate.split(",").map(Number);

    // Try landmark (3x3) with low probability
    if (rand() < 0.02) {
      // Try placing with origin at various offsets so the building overlaps this tile
      for (let oy = 0; oy < 3; oy++) {
        for (let ox = 0; ox < 3; ox++) {
          const bx = cx - ox;
          const by = cy - oy;
          if (canPlaceBuilding(bx, by, "landmark", elevationMap, roadSet, buildingMap)) {
            buildingMap = placeBuildingInMap(bx, by, "landmark", buildingMap);
            break;
          }
        }
        if (buildingMap.has(candidate)) break;
      }
      if (buildingMap.has(candidate)) continue;
    }

    // Try office (2x2) with moderate probability
    if (rand() < 0.08) {
      for (let oy = 0; oy < 2; oy++) {
        for (let ox = 0; ox < 2; ox++) {
          const bx = cx - ox;
          const by = cy - oy;
          if (canPlaceBuilding(bx, by, "office", elevationMap, roadSet, buildingMap)) {
            buildingMap = placeBuildingInMap(bx, by, "office", buildingMap);
            break;
          }
        }
        if (buildingMap.has(candidate)) break;
      }
      if (buildingMap.has(candidate)) continue;
    }

    // Skip some tiles for spacing
    if (rand() < 0.5) continue;
    if (buildingMap.has(candidate)) continue;

    // Place house or apartment (1x1)
    const typeName = rand() < 0.4 ? "apartment" : "house";
    if (canPlaceBuilding(cx, cy, typeName, elevationMap, roadSet, buildingMap)) {
      buildingMap = placeBuildingInMap(cx, cy, typeName, buildingMap);
    }
  }

  return buildingMap;
}
