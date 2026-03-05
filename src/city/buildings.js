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
    footprint: [2, 2],
    spriteWidth: 128,
    spriteHeight: 192,
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

// Helper: draw an isometric box (walls + flat roof) and return roof corner points.
// wallHeight is in pixels from the base diamond up.
function drawIsoBox(ctx, cx, bottom, baseW, baseH, wallHeight, color) {
  const south = { x: cx, y: bottom };
  const east = { x: cx + baseW / 2, y: bottom - baseH / 2 };
  const north = { x: cx, y: bottom - baseH };
  const west = { x: cx - baseW / 2, y: bottom - baseH / 2 };

  const roofSouth = { x: south.x, y: south.y - wallHeight };
  const roofEast = { x: east.x, y: east.y - wallHeight };
  const roofNorth = { x: north.x, y: north.y - wallHeight };
  const roofWest = { x: west.x, y: west.y - wallHeight };

  // Left wall
  ctx.fillStyle = adjustColor(color, -20);
  ctx.beginPath();
  ctx.moveTo(west.x, west.y);
  ctx.lineTo(south.x, south.y);
  ctx.lineTo(roofSouth.x, roofSouth.y);
  ctx.lineTo(roofWest.x, roofWest.y);
  ctx.closePath();
  ctx.fill();

  // Right wall
  ctx.fillStyle = adjustColor(color, -40);
  ctx.beginPath();
  ctx.moveTo(south.x, south.y);
  ctx.lineTo(east.x, east.y);
  ctx.lineTo(roofEast.x, roofEast.y);
  ctx.lineTo(roofSouth.x, roofSouth.y);
  ctx.closePath();
  ctx.fill();

  // Top face
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
  ctx.beginPath();
  ctx.moveTo(roofNorth.x, roofNorth.y);
  ctx.lineTo(roofEast.x, roofEast.y);
  ctx.lineTo(roofSouth.x, roofSouth.y);
  ctx.lineTo(roofWest.x, roofWest.y);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(roofSouth.x, roofSouth.y);
  ctx.lineTo(south.x, south.y);
  ctx.moveTo(roofWest.x, roofWest.y);
  ctx.lineTo(west.x, west.y);
  ctx.moveTo(roofEast.x, roofEast.y);
  ctx.lineTo(east.x, east.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(west.x, west.y);
  ctx.lineTo(south.x, south.y);
  ctx.lineTo(east.x, east.y);
  ctx.stroke();

  return { south, east, north, west, roofSouth, roofEast, roofNorth, roofWest };
}

// House: box with a peaked/gabled roof ridge running north-south
function generateHouseSprite(type) {
  const { spriteWidth, spriteHeight, footprint, color } = type;
  const [fw, fh] = footprint;
  const canvas = document.createElement("canvas");
  canvas.width = spriteWidth;
  canvas.height = spriteHeight;
  const ctx = canvas.getContext("2d");

  const baseW = fw * tileWidth;
  const baseH = fh * tileHeight;
  const wallHeight = (spriteHeight - baseH / 2) * 0.55;
  const cx = spriteWidth / 2;
  const bottom = spriteHeight;

  const { roofSouth, roofEast, roofNorth, roofWest } = drawIsoBox(ctx, cx, bottom, baseW, baseH, wallHeight, color);

  // Peaked ridge: a point above the roof center
  const ridgeHeight = (spriteHeight - baseH / 2) - wallHeight;
  const ridgeN = { x: roofNorth.x, y: roofNorth.y - ridgeHeight };
  const ridgeS = { x: roofSouth.x, y: roofSouth.y - ridgeHeight };

  // Left roof slope (west face of roof)
  ctx.fillStyle = adjustColor(color, 5);
  ctx.beginPath();
  ctx.moveTo(roofNorth.x, roofNorth.y);
  ctx.lineTo(roofWest.x, roofWest.y);
  ctx.lineTo(roofSouth.x, roofSouth.y);
  ctx.lineTo(ridgeS.x, ridgeS.y);
  ctx.lineTo(ridgeN.x, ridgeN.y);
  ctx.closePath();
  ctx.fill();

  // Right roof slope (east face of roof)
  ctx.fillStyle = adjustColor(color, -10);
  ctx.beginPath();
  ctx.moveTo(roofNorth.x, roofNorth.y);
  ctx.lineTo(roofEast.x, roofEast.y);
  ctx.lineTo(roofSouth.x, roofSouth.y);
  ctx.lineTo(ridgeS.x, ridgeS.y);
  ctx.lineTo(ridgeN.x, ridgeN.y);
  ctx.closePath();
  ctx.fill();

  // Ridge line and roof edges
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(ridgeN.x, ridgeN.y);
  ctx.lineTo(ridgeS.x, ridgeS.y);
  ctx.moveTo(ridgeN.x, ridgeN.y);
  ctx.lineTo(roofWest.x, roofWest.y);
  ctx.moveTo(ridgeN.x, ridgeN.y);
  ctx.lineTo(roofEast.x, roofEast.y);
  ctx.moveTo(ridgeS.x, ridgeS.y);
  ctx.lineTo(roofWest.x, roofWest.y);
  ctx.moveTo(ridgeS.x, ridgeS.y);
  ctx.lineTo(roofEast.x, roofEast.y);
  ctx.stroke();

  return canvas;
}

// Apartment: tall flat-roofed box with horizontal floor lines
function generateApartmentSprite(type) {
  const { spriteWidth, spriteHeight, footprint, color } = type;
  const [fw, fh] = footprint;
  const canvas = document.createElement("canvas");
  canvas.width = spriteWidth;
  canvas.height = spriteHeight;
  const ctx = canvas.getContext("2d");

  const baseW = fw * tileWidth;
  const baseH = fh * tileHeight;
  const wallHeight = spriteHeight - baseH / 2;
  const cx = spriteWidth / 2;
  const bottom = spriteHeight;

  const { south, east, west, roofSouth, roofEast, roofWest } = drawIsoBox(ctx, cx, bottom, baseW, baseH, wallHeight, color);

  // Draw floor separator lines on both visible walls
  const floors = 4;
  ctx.strokeStyle = "rgba(0,0,0,0.15)";
  ctx.lineWidth = 1;
  for (let i = 1; i < floors; i++) {
    const t = i / floors;
    // Left wall floor line
    const lx1 = west.x + (roofWest.x - west.x) * t;
    const ly1 = west.y + (roofWest.y - west.y) * t;
    const lx2 = south.x + (roofSouth.x - south.x) * t;
    const ly2 = south.y + (roofSouth.y - south.y) * t;
    ctx.beginPath();
    ctx.moveTo(lx1, ly1);
    ctx.lineTo(lx2, ly2);
    ctx.stroke();
    // Right wall floor line
    const rx1 = south.x + (roofSouth.x - south.x) * t;
    const ry1 = south.y + (roofSouth.y - south.y) * t;
    const rx2 = east.x + (roofEast.x - east.x) * t;
    const ry2 = east.y + (roofEast.y - east.y) * t;
    ctx.beginPath();
    ctx.moveTo(rx1, ry1);
    ctx.lineTo(rx2, ry2);
    ctx.stroke();
  }

  return canvas;
}

// Office: two stacked tiers (wider base, narrower top)
function generateOfficeSprite(type) {
  const { spriteWidth, spriteHeight, footprint, color } = type;
  const [fw, fh] = footprint;
  const canvas = document.createElement("canvas");
  canvas.width = spriteWidth;
  canvas.height = spriteHeight;
  const ctx = canvas.getContext("2d");

  const baseW = fw * tileWidth;
  const baseH = fh * tileHeight;
  const totalHeight = spriteHeight - baseH / 2;
  const cx = spriteWidth / 2;
  const bottom = spriteHeight;

  // Lower tier: full footprint, 60% of total height
  const lowerH = totalHeight * 0.6;
  drawIsoBox(ctx, cx, bottom, baseW, baseH, lowerH, color);

  // Upper tier: 60% footprint, remaining height, sitting on top
  const upperBaseW = baseW * 0.6;
  const upperBaseH = baseH * 0.6;
  const upperH = totalHeight * 0.4;
  const upperBottom = bottom - lowerH + upperBaseH / 2;
  drawIsoBox(ctx, cx, upperBottom, upperBaseW, upperBaseH, upperH, adjustColor(color, 10));

  return canvas;
}

// Landmark: box with a dome on top
function generateLandmarkSprite(type) {
  const { spriteWidth, spriteHeight, footprint, color } = type;
  const [fw, fh] = footprint;
  const canvas = document.createElement("canvas");
  canvas.width = spriteWidth;
  canvas.height = spriteHeight;
  const ctx = canvas.getContext("2d");

  const baseW = fw * tileWidth;
  const baseH = fh * tileHeight;
  const totalHeight = spriteHeight - baseH / 2;
  const wallHeight = totalHeight * 0.6;
  const cx = spriteWidth / 2;
  const bottom = spriteHeight;

  const { roofSouth, roofEast, roofNorth, roofWest } = drawIsoBox(ctx, cx, bottom, baseW, baseH, wallHeight, color);

  // Dome: an ellipse rising from the roof center
  const domeHeight = totalHeight - wallHeight;
  const roofCenterX = cx;
  const roofCenterY = (roofNorth.y + roofSouth.y) / 2;
  const domeRadiusX = baseW * 0.3;
  const domeRadiusY = baseH * 0.3;

  // Dome back half (lighter)
  ctx.fillStyle = adjustColor(color, 5);
  ctx.beginPath();
  ctx.ellipse(roofCenterX, roofCenterY, domeRadiusX, domeRadiusY, 0, Math.PI, 0);
  ctx.closePath();
  ctx.fill();

  // Dome front half (darker, gives 3D look)
  ctx.fillStyle = adjustColor(color, -15);
  ctx.beginPath();
  ctx.ellipse(roofCenterX, roofCenterY, domeRadiusX, domeRadiusY, 0, 0, Math.PI);
  ctx.closePath();
  ctx.fill();

  // Dome vertical rise (the dome extends upward)
  const domeTop = roofCenterY - domeHeight;
  ctx.fillStyle = adjustColor(color, 0);
  ctx.beginPath();
  ctx.ellipse(roofCenterX, domeTop + domeHeight * 0.5, domeRadiusX, domeHeight * 0.5, 0, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fill();

  // Dome highlight
  ctx.fillStyle = adjustColor(color, 25);
  ctx.beginPath();
  ctx.ellipse(roofCenterX - domeRadiusX * 0.2, domeTop + domeHeight * 0.35, domeRadiusX * 0.4, domeHeight * 0.25, -0.3, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fill();

  // Dome outline
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(roofCenterX, domeTop + domeHeight * 0.5, domeRadiusX, domeHeight * 0.5, 0, 0, Math.PI * 2);
  ctx.closePath();
  ctx.stroke();

  return canvas;
}

// Load a spritesheet image and slice it into 9 cells (3x3 grid).
// Detects gaps between buildings to find actual cell boundaries rather than
// assuming uniform grid spacing. Removes near-invisible pixels before
// extracting each building and scaling it to target dimensions.
function loadAndSliceSpritesheet(src, targetWidth, targetHeight) {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      // Draw full image to a work canvas to read pixel data
      const full = document.createElement("canvas");
      full.width = img.width;
      full.height = img.height;
      const fctx = full.getContext("2d");
      fctx.drawImage(img, 0, 0);
      const fullData = fctx.getImageData(0, 0, img.width, img.height).data;

      const alphaThreshold = 10;

      // Find vertical gaps (columns with no visible content)
      const colHasContent = new Array(img.width).fill(false);
      for (let x = 0; x < img.width; x++) {
        for (let y = 0; y < img.height; y++) {
          if (fullData[(y * img.width + x) * 4 + 3] > alphaThreshold) {
            colHasContent[x] = true;
            break;
          }
        }
      }

      // Find horizontal gaps (rows with no visible content)
      const rowHasContent = new Array(img.height).fill(false);
      for (let y = 0; y < img.height; y++) {
        for (let x = 0; x < img.width; x++) {
          if (fullData[(y * img.width + x) * 4 + 3] > alphaThreshold) {
            rowHasContent[y] = true;
            break;
          }
        }
      }

      // Extract contiguous content regions along each axis
      function findRegions(hasContent) {
        const regions = [];
        let inRegion = false;
        let start = 0;
        for (let i = 0; i < hasContent.length; i++) {
          if (hasContent[i] && !inRegion) {
            start = i;
            inRegion = true;
          } else if (!hasContent[i] && inRegion) {
            regions.push([start, i - 1]);
            inRegion = false;
          }
        }
        if (inRegion) regions.push([start, hasContent.length - 1]);
        return regions;
      }

      const colRegions = findRegions(colHasContent);
      const rowRegions = findRegions(rowHasContent);

      const canvases = [];
      for (let ri = 0; ri < rowRegions.length; ri++) {
        for (let ci = 0; ci < colRegions.length; ci++) {
          const [cx0, cx1] = colRegions[ci];
          const [ry0, ry1] = rowRegions[ri];
          const cellW = cx1 - cx0 + 1;
          const cellH = ry1 - ry0 + 1;

          // Find tight content bounds within this cell region
          let minX = cellW, minY = cellH, maxX = 0, maxY = 0;
          for (let py = 0; py < cellH; py++) {
            for (let px = 0; px < cellW; px++) {
              const idx = ((ry0 + py) * img.width + (cx0 + px)) * 4;
              if (fullData[idx + 3] > alphaThreshold) {
                if (px < minX) minX = px;
                if (px > maxX) maxX = px;
                if (py < minY) minY = py;
                if (py > maxY) maxY = py;
              }
            }
          }

          // Create final canvas at target dimensions
          const canvas = document.createElement("canvas");
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          const ctx = canvas.getContext("2d");

          if (maxX >= minX && maxY >= minY) {
            const contentW = maxX - minX + 1;
            const contentH = maxY - minY + 1;
            const scale = Math.min(targetWidth / contentW, targetHeight / contentH);
            const scaledW = contentW * scale;
            const scaledH = contentH * scale;
            const destX = (targetWidth - scaledW) / 2;
            const destY = targetHeight - scaledH;
            ctx.drawImage(
              img,
              cx0 + minX, ry0 + minY, contentW, contentH,
              destX, destY, scaledW, scaledH
            );
          }

          canvases.push(canvas);
        }
      }

      resolve(canvases);
    };
    img.onerror = () => reject(new Error(`Failed to load spritesheet: ${src}`));
    img.src = src;
  });
}

// Load both building spritesheets and return sliced variants.
export async function loadBuildingSpritesheets() {
  const [houseVariants, apartmentVariants] = await Promise.all([
    loadAndSliceSpritesheet(
      "/textures/buildings/houses.png",
      buildingTypes.house.spriteWidth,
      buildingTypes.house.spriteHeight
    ),
    loadAndSliceSpritesheet(
      "/textures/buildings/midsizebuildings.png",
      buildingTypes.apartment.spriteWidth,
      buildingTypes.apartment.spriteHeight
    ),
  ]);
  return { house: houseVariants, apartment: apartmentVariants };
}

// Generate a building sprite based on type. Each type has a distinct shape.
export function generateBuildingSprite(typeName) {
  const type = buildingTypes[typeName];
  if (!type) return null;

  switch (typeName) {
    case "house": return generateHouseSprite(type);
    case "apartment": return generateApartmentSprite(type);
    case "office": return generateOfficeSprite(type);
    case "landmark": return generateLandmarkSprite(type);
    default: return generateHouseSprite(type);
  }
}

// Generate all placeholder building sprites (procedural only, synchronous).
export function generateProceduralBuildingSprites() {
  const sprites = {};
  for (const typeName of Object.keys(buildingTypes)) {
    sprites[typeName] = generateBuildingSprite(typeName);
  }
  return sprites;
}

// Generate all building sprites, loading spritesheets for house/apartment.
// Returns { house: [canvas x9], apartment: [canvas x9], office: canvas, landmark: canvas }
export async function generateAllBuildingSprites() {
  const sprites = {};
  // Procedural sprites for office and landmark
  sprites.office = generateBuildingSprite("office");
  sprites.landmark = generateBuildingSprite("landmark");

  // Load spritesheet variants for house and apartment
  const variants = await loadBuildingSpritesheets();
  sprites.house = variants.house;
  sprites.apartment = variants.apartment;

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
// variant: index 0-8 for spritesheet-based types (house, apartment), ignored for others.
export function placeBuildingInMap(x, y, typeName, buildingMap, variant = 0) {
  const type = buildingTypes[typeName];
  const [fw, fh] = type.footprint;
  const newMap = new Map(buildingMap);

  for (let dy = 0; dy < fh; dy++) {
    for (let dx = 0; dx < fw; dx++) {
      newMap.set(`${x + dx},${y + dy}`, {
        type: typeName,
        originX: x,
        originY: y,
        variant,
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

// Auto-fill buildings into all available space within road grid blocks.
// Packs larger buildings first, then fills remaining gaps with smaller ones.
export function autoFillBuildings(elevationMap, roadSet, existingBuildingMap) {
  let buildingMap = new Map(existingBuildingMap);

  // Simple seeded PRNG
  let seed = 54321;
  const rand = () => {
    seed = (seed * 16807 + 0) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  // Try building types from largest to smallest
  const typePriority = ["landmark", "office", "apartment", "house"];

  // Scan the entire grid for open land tiles, try to place buildings
  for (const typeName of typePriority) {
    const type = buildingTypes[typeName];
    const [fw, fh] = type.footprint;

    for (let y = 0; y < gridHeight - fh + 1; y++) {
      for (let x = 0; x < gridWidth - fw + 1; x++) {
        // Skip if any tile in footprint is already occupied
        if (buildingMap.has(`${x},${y}`)) continue;

        // For landmarks, only place occasionally to keep variety
        if (typeName === "landmark" && rand() > 0.03) continue;
        // For offices, moderate density
        if (typeName === "office" && rand() > 0.15) continue;
        // For apartments vs houses, randomize the mix
        if (typeName === "apartment" && rand() > 0.5) continue;

        if (canPlaceBuilding(x, y, typeName, elevationMap, roadSet, buildingMap)) {
          const variant = Math.floor(rand() * 9);
          buildingMap = placeBuildingInMap(x, y, typeName, buildingMap, variant);
        }
      }
    }
  }

  return buildingMap;
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

    // Place house or apartment
    const typeName = rand() < 0.4 ? "apartment" : "house";
    const variant = Math.floor(rand() * 9);
    if (typeName === "apartment") {
      // Apartment is 2x2 — try offsets so the footprint overlaps this tile
      let placed = false;
      for (let oy = 0; oy < 2 && !placed; oy++) {
        for (let ox = 0; ox < 2 && !placed; ox++) {
          const bx = cx - ox;
          const by = cy - oy;
          if (canPlaceBuilding(bx, by, "apartment", elevationMap, roadSet, buildingMap)) {
            buildingMap = placeBuildingInMap(bx, by, "apartment", buildingMap, variant);
            placed = true;
          }
        }
      }
    } else {
      if (canPlaceBuilding(cx, cy, typeName, elevationMap, roadSet, buildingMap)) {
        buildingMap = placeBuildingInMap(cx, cy, typeName, buildingMap, variant);
      }
    }
  }

  return buildingMap;
}
