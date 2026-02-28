// A* pathfinding for road placement

const DIRECTIONS = [
  { dx: 0, dy: -1 }, // north
  { dx: 1, dy: 0 },  // east
  { dx: 0, dy: 1 },  // south
  { dx: -1, dy: 0 }, // west
];

export function findRoadPath(startX, startY, endX, endY, elevationMap, gridWidth, gridHeight) {
  const key = (x, y) => `${x},${y}`;

  if (elevationMap[startY][startX] <= 0 || elevationMap[endY][endX] <= 0) return null;

  const openSet = [{ x: startX, y: startY, g: 0, f: 0, parent: null, dir: null }];
  const closed = new Set();
  const gScores = new Map();
  gScores.set(key(startX, startY), 0);

  const heuristic = (x, y) => Math.abs(x - endX) + Math.abs(y - endY);

  while (openSet.length > 0) {
    // Find lowest f
    let bestIdx = 0;
    for (let i = 1; i < openSet.length; i++) {
      if (openSet[i].f < openSet[bestIdx].f) bestIdx = i;
    }
    const current = openSet.splice(bestIdx, 1)[0];

    if (current.x === endX && current.y === endY) {
      // Reconstruct path
      const path = [];
      let node = current;
      while (node) {
        path.unshift({ x: node.x, y: node.y });
        node = node.parent;
      }
      return path;
    }

    closed.add(key(current.x, current.y));

    for (const { dx, dy } of DIRECTIONS) {
      const nx = current.x + dx;
      const ny = current.y + dy;

      if (nx < 0 || nx >= gridWidth || ny < 0 || ny >= gridHeight) continue;
      if (elevationMap[ny][nx] <= 0) continue;
      if (closed.has(key(nx, ny))) continue;

      // Small penalty for direction changes to prefer L-shaped routes
      const dirKey = `${dx},${dy}`;
      const turnPenalty = (current.dir && current.dir !== dirKey) ? 0.1 : 0;
      const tentativeG = current.g + 1 + turnPenalty;

      const existingG = gScores.get(key(nx, ny));
      if (existingG !== undefined && tentativeG >= existingG) continue;

      gScores.set(key(nx, ny), tentativeG);
      openSet.push({
        x: nx,
        y: ny,
        g: tentativeG,
        f: tentativeG + heuristic(nx, ny),
        parent: current,
        dir: dirKey,
      });
    }
  }

  return null; // No path found
}

export function assignRoadTypes(path, existingRoads) {
  const result = new Map(existingRoads);

  for (let i = 0; i < path.length; i++) {
    const { x, y } = path[i];
    const k = `${x},${y}`;

    // Determine direction from prev/next
    const prev = path[i - 1] || null;
    const next = path[i + 1] || null;

    let type;

    if (!prev || !next) {
      // Endpoints: determine from the one neighbor we have
      const neighbor = prev || next;
      if (neighbor) {
        const dx = neighbor.x - x;
        // If neighbor differs in y, this segment runs along Y → "road"
        // If neighbor differs in x, this segment runs along X → "road_cross"
        type = dx === 0 ? "road" : "road_cross";
      } else {
        type = "road_intersection";
      }
    } else {
      const prevDx = x - prev.x;
      const prevDy = y - prev.y;
      const nextDx = next.x - x;
      const nextDy = next.y - y;

      if (prevDx === nextDx && prevDy === nextDy) {
        // Straight segment
        type = prevDx === 0 ? "road" : "road_cross";
      } else {
        // Direction change = intersection/turn
        type = "road_intersection";
      }
    }

    // Merge: upgrade to intersection on overlap with different type
    const existing = result.get(k);
    if (existing && existing !== type) {
      result.set(k, "road_intersection");
    } else {
      result.set(k, type);
    }
  }

  return result;
}
