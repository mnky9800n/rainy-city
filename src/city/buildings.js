import { gridWidth, gridHeight } from './constants.js';

// Building type definitions
// footprint: [width, height] in tiles
// spriteWidth/spriteHeight: pixel dimensions of the sprite canvas
// popupContent: optional { title, description } for InfoPopup on click
export const buildingTypes = {
  house: {
    sheet: "houses",
    footprint: [1, 1],
    spriteWidth: 64,
    spriteHeight: 80,
  },
  shop: {
    sheet: "shops",
    footprint: [1, 1],
    spriteWidth: 64,
    spriteHeight: 80,
  },
  commercial: {
    footprint: [2, 2],
    spriteWidth: 128,
    spriteHeight: 128,
  },
  apartment: {
    sheet: "midsizebuildings",
    footprint: [2, 2],
    spriteWidth: 128,
    spriteHeight: 192,
  },
  skyscraper: {
    sheet: "skyscrapers",
    footprint: [3, 3],
    spriteWidth: 192,
    spriteHeight: 320,
  },
  radio_tower: {
    singleton: true,
    footprint: [4, 4],
    spriteWidth: 256,
    spriteHeight: 640,
    fullSpriteHitTest: true,
    popupContent: {
      title: "Rainy City Radio 99.7FM",
      description: "Broadcasting live 24/7 in Rainy City on 99.7FM and YouTube everywhere -- local news, weather, and trip hop across the city.",
      linkUrl: "https://www.youtube.com/@rainy-city-radio/live",
      linkText: "Tune in →",
    },
  },
  nyt_tower: {
    singleton: true,
    footprint: [3, 3],
    spriteWidth: 192,
    spriteHeight: 480,
    fullSpriteHitTest: true,
    popupContent: {
      title: "Low Impact Fruit",
      description: "Low Impact Fruit is an online magazine for the expression of ideas that are somewhere between a post on social media and a scientific publication. We publish opinion articles, articles about technology and its overlap with culture, academia, life, scientific analysis articles, history of science and technology, and articles on managing technical people. This list of topics is non-exhaustive and set to expand. Low Impact Fruit will always be free but your paid subscriptions help us organize and publicize the magazine.",
      linkUrl: "https://lowimpactfruit.com",
      linkText: "Visit lowimpactfruit.com →",
    },
  },
  cinema: {
    singleton: true,
    footprint: [3, 3],
    spriteWidth: 192,
    spriteHeight: 180,
    fullSpriteHitTest: true,
    popupContent: {
      title: "The Star Cinema",
      description: "Rainy City's last single-screen theatre — neon marquee, sticky floors, and the best popcorn in town. Check the Rainy City Events calendar for screenings, listening parties, and other happenings around town.",
      linkUrl: "https://luma.com/calendar/cal-bWJ95iTQ0TVUUjt",
      linkText: "See what's on at Rainy City Events →",
    },
  },
  library: {
    singleton: true,
    // Low and wide, unlike the towers: the sprite includes the plaza it sits
    // on, which is exactly the 4x4 footprint diamond.
    footprint: [4, 4],
    spriteWidth: 256,
    spriteHeight: 180,
    // The plaza slab is 26.2px thick in the source art, which is 6.6px once
    // sliced. Without this the slicer plants the slab's underside on the
    // ground and the whole building floats by that much.
    groundInset: 6.6,
    fullSpriteHitTest: true,
    popupContent: {
      title: "Rainy City Public Library",
      description: "Timber, glass and a card catalog Lisa refused to let the city digitise. Two floors of reading rooms lit warm against the weather, solar panels on the roof, and a plaza out front that nobody sits in because it is always raining. Also the home of Rainy City Publishing.",
      linkUrl: "https://rainy-city.com/publishing",
      linkText: "Rainy City Publishing →",
    },
  },
};

// Load a spritesheet image and slice it into 9 cells (3x3 grid).
// Detects gaps between buildings to find actual cell boundaries rather than
// assuming uniform grid spacing. Removes near-invisible pixels before
// extracting each building and scaling it to target dimensions.
export function loadAndSliceSpritesheet(src, targetWidth, targetHeight) {
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
    img.onerror = () => {
      // Resolve rather than reject: Promise.all in loadBuildingSpritesheets
      // would otherwise let one missing PNG take down the entire city.
      console.error(`Failed to load spritesheet: ${src}`);
      resolve([]);
    };
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

// Load every building type's spritesheet and return its sliced variants.
//
// The sheet filename defaults to the type key, so a new building needs no edit
// here at all -- name the PNG after the key. Only the four older types whose
// filenames predate that convention carry an explicit `sheet`.
export async function loadBuildingSpritesheets() {
  const entries = Object.entries(buildingTypes);
  const sliced = await Promise.all(entries.map(([name, type]) =>
    loadAndSliceSpritesheet(
      `/textures/buildings/${type.sheet ?? name}.png`,
      type.spriteWidth,
      type.spriteHeight
    )
  ));

  const variants = {};
  entries.forEach(([name], i) => {
    sliced[i].forEach(applyRainyFilter);
    variants[name] = sliced[i];
  });
  return variants;
}

// Check if a building can be placed at (x, y) with the given footprint.
// Requires: all tiles in footprint are land, flat (same elevation), not road, not water, not already occupied.
export function canPlaceBuilding(x, y, typeName, elevationMap, roadSet, buildingMap) {
  const type = buildingTypes[typeName];
  if (!type) return false;
  const [fw, fh] = type.footprint;

  // Singleton landmarks — only one of each allowed.
  if (type.singleton) {
    for (const entry of buildingMap.values()) {
      if (entry.type === typeName) return false;
    }
  }

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

  // Place singleton landmark buildings near the city center.
  // Spiral outward from center until a valid spot is found for each.
  const ccx = Math.floor(gridWidth / 2);
  const ccy = Math.floor(gridHeight / 2);

  function placeLandmarkNearCenter(typeName, seedOffsetX = 0, seedOffsetY = 0) {
    const sx = ccx + seedOffsetX;
    const sy = ccy + seedOffsetY;
    for (let r = 0; r < Math.max(gridWidth, gridHeight); r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (r > 0 && Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const x = sx + dx;
          const y = sy + dy;
          if (canPlaceBuilding(x, y, typeName, elevationMap, roadSet, buildingMap)) {
            buildingMap = placeBuildingInMap(x, y, typeName, buildingMap, 0);
            return true;
          }
        }
      }
    }
    return false;
  }

  placeLandmarkNearCenter("radio_tower");
  // Place NYT tower offset from city center so it doesn't fight the radio tower.
  placeLandmarkNearCenter("nyt_tower", 8, -8);
  // Cinema sits on the opposite side from NYT tower so the three landmarks spread out.
  placeLandmarkNearCenter("cinema", -8, 8);
  // Library takes the remaining diagonal, so the four landmarks sit in a loose square.
  placeLandmarkNearCenter("library", 8, 8);

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
