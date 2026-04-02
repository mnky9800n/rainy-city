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
  shop: {
    footprint: [1, 1],
    spriteWidth: 64,
    spriteHeight: 80,
    color: "#cd853f",
  },
  commercial: {
    footprint: [2, 2],
    spriteWidth: 128,
    spriteHeight: 128,
    color: "#8b7355",
  },
  apartment: {
    footprint: [2, 2],
    spriteWidth: 128,
    spriteHeight: 192,
    color: "#708090",
  },
  skyscraper: {
    footprint: [3, 3],
    spriteWidth: 192,
    spriteHeight: 320,
    color: "#4a6a8a",
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

// Apply a rainy/overcast color filter to a sprite canvas.
// Desaturates, darkens slightly, and shifts toward cool blue-grey.
export function applyRainyFilter(canvas) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue; // skip transparent
    const r = d[i], g = d[i + 1], b = d[i + 2];
    // Desaturate ~40%: blend toward luminance
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const desat = 0.4;
    let nr = r + (lum - r) * desat;
    let ng = g + (lum - g) * desat;
    let nb = b + (lum - b) * desat;
    // Shift toward cool blue-grey
    nr = nr * 0.88;
    ng = ng * 0.91;
    nb = nb * 0.98 + 8;
    // Darken slightly
    nr *= 0.85;
    ng *= 0.85;
    nb *= 0.88;
    d[i]     = Math.min(255, Math.max(0, nr));
    d[i + 1] = Math.min(255, Math.max(0, ng));
    d[i + 2] = Math.min(255, Math.max(0, nb));
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

// Load building spritesheets and return sliced variants.
export async function loadBuildingSpritesheets() {
  const [houseVariants, shopVariants, commercialVariants, apartmentVariants, skyscraperVariants] = await Promise.all([
    loadAndSliceSpritesheet(
      "/textures/buildings/houses.png",
      buildingTypes.house.spriteWidth,
      buildingTypes.house.spriteHeight
    ),
    loadAndSliceSpritesheet(
      "/textures/buildings/shops.png",
      buildingTypes.shop.spriteWidth,
      buildingTypes.shop.spriteHeight
    ),
    loadAndSliceSpritesheet(
      "/textures/buildings/commercial.png",
      buildingTypes.commercial.spriteWidth,
      buildingTypes.commercial.spriteHeight
    ),
    loadAndSliceSpritesheet(
      "/textures/buildings/midsizebuildings.png",
      buildingTypes.apartment.spriteWidth,
      buildingTypes.apartment.spriteHeight
    ),
    loadAndSliceSpritesheet(
      "/textures/buildings/skyscrapers.png",
      buildingTypes.skyscraper.spriteWidth,
      buildingTypes.skyscraper.spriteHeight
    ),
  ]);
  // Apply rainy filter to all sprites
  const filtered = { house: houseVariants, shop: shopVariants, commercial: commercialVariants, apartment: apartmentVariants, skyscraper: skyscraperVariants };
  for (const variants of Object.values(filtered)) {
    if (Array.isArray(variants)) {
      variants.forEach(applyRainyFilter);
    } else if (variants) {
      applyRainyFilter(variants);
    }
  }
  return filtered;
}

// Generate a building sprite based on type. Each type has a distinct shape.
export function generateBuildingSprite(typeName) {
  const type = buildingTypes[typeName];
  if (!type) return null;

  switch (typeName) {
    case "house": return generateHouseSprite(type);
    case "apartment": return generateApartmentSprite(type);
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

// Generate all building sprites, loading spritesheets.
export async function generateAllBuildingSprites() {
  const variants = await loadBuildingSpritesheets();
  return { house: variants.house, shop: variants.shop, commercial: variants.commercial, apartment: variants.apartment, skyscraper: variants.skyscraper };
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
  const typePriority = ["skyscraper", "apartment", "commercial", "shop", "house"];

  // Scan the entire grid for open land tiles, try to place buildings
  for (const typeName of typePriority) {
    const type = buildingTypes[typeName];
    const [fw, fh] = type.footprint;

    for (let y = 0; y < gridHeight - fh + 1; y++) {
      for (let x = 0; x < gridWidth - fw + 1; x++) {
        // Skip if any tile in footprint is already occupied
        if (buildingMap.has(`${x},${y}`)) continue;

        // Randomize the mix of building types
        if (typeName === "skyscraper" && rand() > 0.08) continue;
        if (typeName === "apartment" && rand() > 0.4) continue;
        if (typeName === "commercial" && rand() > 0.35) continue;
        if (typeName === "shop" && rand() > 0.3) continue;

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

  // Place buildings near roads
  for (const candidate of candidates) {
    const [cx, cy] = candidate.split(",").map(Number);

    // Skip some tiles for spacing
    if (rand() < 0.5) continue;
    if (buildingMap.has(candidate)) continue;

    // Place house, shop, commercial, apartment, or skyscraper
    const roll = rand();
    const typeName = roll < 0.05 ? "skyscraper" : roll < 0.2 ? "apartment" : roll < 0.4 ? "commercial" : roll < 0.6 ? "shop" : "house";
    const variant = Math.floor(rand() * 9);
    const [fw, fh] = buildingTypes[typeName].footprint;
    if (fw > 1 || fh > 1) {
      // Multi-tile building — try offsets so the footprint overlaps this tile
      let placed = false;
      for (let oy = 0; oy < fh && !placed; oy++) {
        for (let ox = 0; ox < fw && !placed; ox++) {
          const bx = cx - ox;
          const by = cy - oy;
          if (canPlaceBuilding(bx, by, typeName, elevationMap, roadSet, buildingMap)) {
            buildingMap = placeBuildingInMap(bx, by, typeName, buildingMap, variant);
            placed = true;
          }
        }
      }
    } else {
      // shop and house are both 1x1
      if (canPlaceBuilding(cx, cy, typeName, elevationMap, roadSet, buildingMap)) {
        buildingMap = placeBuildingInMap(cx, cy, typeName, buildingMap, variant);
      }
    }
  }

  return buildingMap;
}
