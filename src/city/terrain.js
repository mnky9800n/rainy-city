// Seeded PRNG (mulberry32)
export function mulberry32(a) {
  return function() {
    var t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

export function generateCoastline(gridWidth, roughness = 7) {
  const rand = mulberry32(42);
  const coastlineBase = Math.floor(gridWidth * 0.67);

  let points = [
    coastlineBase + Math.floor((rand() - 0.5) * 10),
    coastlineBase + Math.floor((rand() - 0.5) * 10)
  ];

  for (let i = 0; i < roughness; i++) {
    let newPoints = [];
    for (let j = 0; j < points.length - 1; j++) {
      let mid = Math.floor((points[j] + points[j + 1]) / 2);
      mid += Math.floor((rand() - 0.5) * gridWidth / (4 * (i + 1)));
      mid = Math.max(Math.floor(gridWidth * 0.6), Math.min(Math.floor(gridWidth * 0.75), mid));
      newPoints.push(points[j], mid);
    }
    newPoints.push(points[points.length - 1]);
    points = newPoints;
  }
  return points;
}

export function generateElevationMap(width, height, coastline, seed = 42) {
  const rand = mulberry32(seed);
  const elevationMap = Array(height).fill().map(() => Array(width).fill(0));

  for (let x = 0; x < width; x++) {
    const coastY = coastline[Math.floor(x * coastline.length / width)];

    for (let y = 0; y < height; y++) {
      if (y >= coastY) {
        const distanceFromCoast = y - coastY;
        const depth = Math.min(Math.floor(distanceFromCoast / 5), 5);
        elevationMap[y][x] = -depth;
      } else {
        const distFromCoast = coastY - y;
        let baseLevel = 1;

        if (distFromCoast > 15) baseLevel = 2;
        if (distFromCoast > 30) baseLevel = 3;
        if (distFromCoast > 45) baseLevel = 4;

        elevationMap[y][x] = baseLevel;
      }
    }
  }

  // Add smooth hills
  const hills = [
    { x: width * 0.3, y: height * 0.2, radius: 12, height: 2 },
    { x: width * 0.7, y: height * 0.3, radius: 15, height: 3 },
    { x: width * 0.5, y: height * 0.15, radius: 10, height: 2 }
  ];

  for (const hill of hills) {
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        if (elevationMap[y][x] > 0) {
          const dist = Math.sqrt(Math.pow(x - hill.x, 2) + Math.pow(y - hill.y, 2));
          if (dist < hill.radius) {
            const ringLevel = Math.floor((hill.radius - dist) / (hill.radius / hill.height));
            if (ringLevel > 0) {
              elevationMap[y][x] = Math.min(elevationMap[y][x] + ringLevel, 8);
            }
          }
        }
      }
    }
  }

  // Smooth transitions
  const smoothedMap = Array(height).fill().map(() => Array(width).fill(0));

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (elevationMap[y][x] === 0) {
        smoothedMap[y][x] = 0;
      } else {
        let maxNeighbor = elevationMap[y][x];
        let minNeighbor = elevationMap[y][x];

        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (y + dy >= 0 && y + dy < height && x + dx >= 0 && x + dx < width) {
              const neighbor = elevationMap[y + dy][x + dx];
              if (neighbor > 0) {
                maxNeighbor = Math.max(maxNeighbor, neighbor);
                minNeighbor = Math.min(minNeighbor, neighbor);
              }
            }
          }
        }

        if (maxNeighbor - minNeighbor > 1) {
          smoothedMap[y][x] = Math.floor((maxNeighbor + minNeighbor) / 2);
        } else {
          smoothedMap[y][x] = elevationMap[y][x];
        }
      }
    }
  }

  // Median-like smoothing
  const finalMap = Array(height).fill().map(() => Array(width).fill(0));

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const current = smoothedMap[y][x];
      finalMap[y][x] = current;

      if (current > 0) {
        let higherNeighbors = 0;

        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;

            const nx = x + dx;
            const ny = y + dy;

            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              if (smoothedMap[ny][nx] > current) {
                higherNeighbors++;
              }
            }
          }
        }

        if (higherNeighbors >= 5) {
          finalMap[y][x] = current + 1;
        }
      }
    }
  }

  return finalMap;
}

export function generateRoads(gridWidth, gridHeight, elevationMap, spacing = 8) {
  const roads = new Map();

  // Flatten terrain around road tiles that have elevation conflicts.
  // Splat a 5x5 flat patch at the median elevation where needed.
  const radius = 2;
  const flattenAt = [];

  for (let x = 0; x < gridWidth; x++) {
    for (let y = 0; y < gridHeight; y++) {
      if (elevationMap[y][x] <= 0) continue;
      if (x % spacing !== 0 && y % spacing !== 0) continue;

      // Check if this road tile has conflicting neighbor elevations
      const elev = elevationMap[y][x];
      const isXRoad = x % spacing === 0;
      const isYRoad = y % spacing === 0;
      let hasConflict = false;

      if (isXRoad) {
        // Check perpendicular (x) neighbors and diagonals
        for (let dy = -1; dy <= 1 && !hasConflict; dy++) {
          const ny = y + dy;
          if (ny < 0 || ny >= gridHeight) continue;
          if (x > 0 && elevationMap[ny][x - 1] > 0 && elevationMap[ny][x - 1] !== elev) hasConflict = true;
          if (x < gridWidth - 1 && elevationMap[ny][x + 1] > 0 && elevationMap[ny][x + 1] !== elev) hasConflict = true;
        }
      }
      if (isYRoad) {
        for (let dx = -1; dx <= 1 && !hasConflict; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= gridWidth) continue;
          if (y > 0 && elevationMap[y - 1][nx] > 0 && elevationMap[y - 1][nx] !== elev) hasConflict = true;
          if (y < gridHeight - 1 && elevationMap[y + 1][nx] > 0 && elevationMap[y + 1][nx] !== elev) hasConflict = true;
        }
      }

      if (hasConflict) {
        flattenAt.push({ x, y });
      }
    }
  }

  // Apply 5x5 flat patches at median elevation
  for (const { x: cx, y: cy } of flattenAt) {
    const elevations = [];
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = cx + dx, ny = cy + dy;
        if (nx >= 0 && nx < gridWidth && ny >= 0 && ny < gridHeight && elevationMap[ny][nx] > 0) {
          elevations.push(elevationMap[ny][nx]);
        }
      }
    }
    elevations.sort((a, b) => a - b);
    const median = elevations[Math.floor(elevations.length / 2)];

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = cx + dx, ny = cy + dy;
        if (nx >= 0 && nx < gridWidth && ny >= 0 && ny < gridHeight && elevationMap[ny][nx] > 0) {
          elevationMap[ny][nx] = median;
        }
      }
    }
  }

  // Taper edges: ensure no two adjacent land tiles differ by more than 1 level.
  // Repeat until stable to propagate gradual slopes outward.
  let changed = true;
  while (changed) {
    changed = false;
    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        if (elevationMap[y][x] <= 0) continue;
        const elev = elevationMap[y][x];

        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= gridWidth || ny < 0 || ny >= gridHeight) continue;
            if (elevationMap[ny][nx] <= 0) continue;

            if (elevationMap[ny][nx] - elev > 1) {
              elevationMap[ny][nx] = elev + 1;
              changed = true;
            } else if (elev - elevationMap[ny][nx] > 1) {
              elevationMap[y][x] = elevationMap[ny][nx] + 1;
              changed = true;
            }
          }
        }
      }
    }
  }

  // Now assign road types
  for (let x = 0; x < gridWidth; x++) {
    for (let y = 0; y < gridHeight; y++) {
      if (elevationMap[y][x] <= 0) continue;

      const onXRoad = x % spacing === 0;
      const onYRoad = y % spacing === 0;

      if (onXRoad && onYRoad) {
        roads.set(`${x},${y}`, "road_intersection");
      } else if (onXRoad) {
        roads.set(`${x},${y}`, "road");
      } else if (onYRoad) {
        roads.set(`${x},${y}`, "road_cross");
      }
    }
  }

  return roads;
}

export function generateRiverPath(gridWidth, gridHeight, seed = 42) {
  const rand = mulberry32(seed);
  const river = [];
  let x = Math.floor(gridWidth / 2);

  for (let y = 0; y < gridHeight; y++) {
    if (y > 0 && rand() < 0.3) {
      x += rand() < 0.5 ? -1 : 1;
      x = Math.max(1, Math.min(gridWidth - 2, x));
    }
    river.push(x);
  }
  return river;
}
