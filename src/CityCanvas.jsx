import React, { useRef, useEffect, useState, useMemo } from "react";

// Texture configuration - add/remove textures here
const tileConfig = {
  water: {
    color: "#2980b9"
    // No texture for water - always use color
  },
  grass: {
    color: "#27ae60",
    texture: "./textures/grass.png"
  },
  building: {
    color: "#7f8c8d",
    texture: "./textures/building.png"
  },
  road: {
    color: "#34495e",
    texture: "./textures/road.png"
  },
  marker: {
    color: "#7f8c8d",
    texture: "./textures/marker.png"
  }
};

// this creates a random number for the coastal creation
// so it lets us set the seed
function mulberry32(a) {
  return function() {
    var t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

const rand = mulberry32(42); // Fixed seed for consistent coastline 

// sets the size of the map
const tileWidth = 64;
const tileHeight = 32;
const gridWidth = 75;   // Static grid size
const gridHeight = 75;  // Static grid size


// Generate elevation map with discrete levels like SimCity 2000
function generateElevationMap(width, height, coastline, seed = 42) {
  const rand = mulberry32(seed);
  const elevationMap = Array(height).fill().map(() => Array(width).fill(0));
  
  // Create base elevation based on distance from coastline
  for (let x = 0; x < width; x++) {
    const coastY = coastline[Math.floor(x * coastline.length / width)];
    
    for (let y = 0; y < height; y++) {
      if (y >= coastY) {
        // Water area - gets deeper away from coast
        const distanceFromCoast = y - coastY;
        const depth = Math.min(Math.floor(distanceFromCoast / 5), 5); // Max depth of -5
        elevationMap[y][x] = -depth;
      } else {
        // Land area - start at level 1, with gradual increase
        const distFromCoast = coastY - y;
        let baseLevel = 1;
        
        // Create natural terraces
        if (distFromCoast > 15) baseLevel = 2;
        if (distFromCoast > 30) baseLevel = 3;
        if (distFromCoast > 45) baseLevel = 4;
        
        elevationMap[y][x] = baseLevel;
      }
    }
  }
  
  // Add smooth hills that follow natural contours
  const hills = [
    { x: width * 0.3, y: height * 0.2, radius: 12, height: 2 },
    { x: width * 0.7, y: height * 0.3, radius: 15, height: 3 },
    { x: width * 0.5, y: height * 0.15, radius: 10, height: 2 }
  ];
  
  for (const hill of hills) {
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        if (elevationMap[y][x] > 0) { // Only add hills to land
          const dist = Math.sqrt(Math.pow(x - hill.x, 2) + Math.pow(y - hill.y, 2));
          if (dist < hill.radius) {
            // Create smooth elevation rings
            const ringLevel = Math.floor((hill.radius - dist) / (hill.radius / hill.height));
            if (ringLevel > 0) {
              elevationMap[y][x] = Math.min(elevationMap[y][x] + ringLevel, 8);
            }
          }
        }
      }
    }
  }
  
  // Smooth transitions to avoid random angles
  const smoothedMap = Array(height).fill().map(() => Array(width).fill(0));
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (elevationMap[y][x] === 0) {
        smoothedMap[y][x] = 0; // Keep water at 0
      } else {
        // Check neighbors and smooth if needed
        let maxNeighbor = elevationMap[y][x];
        let minNeighbor = elevationMap[y][x];
        
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (y + dy >= 0 && y + dy < height && x + dx >= 0 && x + dx < width) {
              const neighbor = elevationMap[y + dy][x + dx];
              if (neighbor > 0) { // Only consider land neighbors
                maxNeighbor = Math.max(maxNeighbor, neighbor);
                minNeighbor = Math.min(minNeighbor, neighbor);
              }
            }
          }
        }
        
        // Limit elevation jumps to 1 level
        if (maxNeighbor - minNeighbor > 1) {
          smoothedMap[y][x] = Math.floor((maxNeighbor + minNeighbor) / 2);
        } else {
          smoothedMap[y][x] = elevationMap[y][x];
        }
      }
    }
  }
  
  // Apply median-like smoothing: if a tile has 5+ neighbors higher than itself, raise it by 1
  const finalMap = Array(height).fill().map(() => Array(width).fill(0));
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const current = smoothedMap[y][x];
      finalMap[y][x] = current;
      
      // Only apply to land (elevation > 0)
      if (current > 0) {
        let higherNeighbors = 0;
        
        // Check all 8 neighbors
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue; // Skip the center tile
            
            const nx = x + dx;
            const ny = y + dy;
            
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              if (smoothedMap[ny][nx] > current) {
                higherNeighbors++;
              }
            }
          }
        }
        
        // If 5 or more neighbors are higher, raise this tile by 1
        if (higherNeighbors >= 5) {
          finalMap[y][x] = current + 1;
        }
      }
    }
  }
  
  return finalMap;
}

// Compute corner heights for smooth slope transitions.
// Each diamond corner is shared by 4 tiles: the current tile, two cardinal
// neighbors, and one diagonal neighbor. A corner must be raised if ANY of the
// 4 tiles sharing it is 1 level higher, otherwise adjacent tiles disagree on
// the shared corner height and gaps appear.
function getTileCornerHeights(elevationMap, x, y) {
  const current = elevationMap[y][x];

  // Sea level water is always flat
  if (current === 0) return { n: 0, e: 0, s: 0, w: 0 };

  const h = elevationMap.length;
  const w = elevationMap[0].length;
  const c1 = current + 1;

  // Cardinal neighbors (in isometric space)
  const ne = y > 0 ? elevationMap[y - 1][x] : current;
  const se = x < w - 1 ? elevationMap[y][x + 1] : current;
  const sw = y < h - 1 ? elevationMap[y + 1][x] : current;
  const nw = x > 0 ? elevationMap[y][x - 1] : current;

  // Diagonal neighbors
  const dNW = (y > 0 && x > 0) ? elevationMap[y - 1][x - 1] : current;
  const dNE = (y > 0 && x < w - 1) ? elevationMap[y - 1][x + 1] : current;
  const dSE = (y < h - 1 && x < w - 1) ? elevationMap[y + 1][x + 1] : current;
  const dSW = (y < h - 1 && x > 0) ? elevationMap[y + 1][x - 1] : current;

  // Each corner: raise if any of its 3 neighbor tiles (2 cardinal + 1 diagonal) is higher
  //   North corner: NE, NW, diagonal[y-1][x-1]
  //   East corner:  NE, SE, diagonal[y-1][x+1]
  //   South corner: SE, SW, diagonal[y+1][x+1]
  //   West corner:  NW, SW, diagonal[y+1][x-1]
  return {
    n: (ne === c1 || nw === c1 || dNW === c1) ? 1 : 0,
    e: (ne === c1 || se === c1 || dNE === c1) ? 1 : 0,
    s: (se === c1 || sw === c1 || dSE === c1) ? 1 : 0,
    w: (nw === c1 || sw === c1 || dSW === c1) ? 1 : 0,
  };
}

// drawTile function with SimCity 2000 style elevation
function drawTile(ctx, x, y, elevation, type, corners, zoom, textures, elevationMap, gridX, gridY) {
  ctx.save();
  
  // Calculate vertical offset based on elevation - much larger steps
  const elevationScale = 16; // Height of each elevation level in pixels (SimCity 2000 style)
  const yOffset = -elevation * elevationScale * zoom;
  
  // For water tiles between sea level and seafloor, render nothing (fully transparent)
  if (type === 'water' && elevation < 0) {
    // Check if any neighbor is deeper - if so, this is mid-water and should be transparent
    let hasDeeper = false;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = gridX + dx;
        const ny = gridY + dy;
        if (nx >= 0 && nx < elevationMap[0].length && ny >= 0 && ny < elevationMap.length) {
          if (elevationMap[ny][nx] < elevation) {
            hasDeeper = true;
            break;
          }
        }
      }
      if (hasDeeper) break;
    }
    
    // If this tile has deeper neighbors, it's mid-water - render nothing
    if (hasDeeper) {
      ctx.restore();
      return; // Exit early, render nothing
    }
  }
  
  // Draw cliff sides only for land (not for underwater terrain)
  if (elevation > 0 && type !== 'water') {
    const cliffColor = '#8B7355'; // Tan/brown cliff color for land

    // Left cliff face
    ctx.fillStyle = adjustBrightness(cliffColor, -20);
    ctx.beginPath();
    ctx.moveTo(x - (tileWidth / 2) * zoom, y + (tileHeight / 2) * zoom + yOffset);
    ctx.lineTo(x - (tileWidth / 2) * zoom, y + (tileHeight / 2) * zoom);
    ctx.lineTo(x, y + tileHeight * zoom);
    ctx.lineTo(x, y + tileHeight * zoom + yOffset);
    ctx.closePath();
    ctx.fill();

    // Right cliff face
    ctx.fillStyle = adjustBrightness(cliffColor, -40);
    ctx.beginPath();
    ctx.moveTo(x, y + tileHeight * zoom + yOffset);
    ctx.lineTo(x, y + tileHeight * zoom);
    ctx.lineTo(x + (tileWidth / 2) * zoom, y + (tileHeight / 2) * zoom);
    ctx.lineTo(x + (tileWidth / 2) * zoom, y + (tileHeight / 2) * zoom + yOffset);
    ctx.closePath();
    ctx.fill();
  }
  
  // For water tiles, draw surface at sea level (transparent horizontally)
  if (type === 'water') {
    const seaLevel = 0;
    const seaLevelOffset = -seaLevel * elevationScale * zoom;
    
    // Draw water surface
    ctx.fillStyle = adjustBrightness('#2980b9', 20); // Lighter blue for surface
    ctx.globalAlpha = 0.6; // Semi-transparent
    ctx.beginPath();
    ctx.moveTo(x, y + seaLevelOffset);
    ctx.lineTo(x + (tileWidth / 2) * zoom, y + (tileHeight / 2) * zoom + seaLevelOffset);
    ctx.lineTo(x, y + tileHeight * zoom + seaLevelOffset);
    ctx.lineTo(x - (tileWidth / 2) * zoom, y + (tileHeight / 2) * zoom + seaLevelOffset);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1.0; // Reset transparency
  }
  
  // Draw the tile surface
  ctx.beginPath();

  if (type === 'water') {
    // Water tiles are always flat
    ctx.moveTo(x, y + yOffset);
    ctx.lineTo(x + (tileWidth / 2) * zoom, y + (tileHeight / 2) * zoom + yOffset);
    ctx.lineTo(x, y + tileHeight * zoom + yOffset);
    ctx.lineTo(x - (tileWidth / 2) * zoom, y + (tileHeight / 2) * zoom + yOffset);
  } else {
    // Land tile - use per-corner heights for smooth slopes
    const sh = elevationScale * zoom;
    ctx.moveTo(x, y + yOffset - corners.n * sh);
    ctx.lineTo(x + (tileWidth / 2) * zoom, y + (tileHeight / 2) * zoom + yOffset - corners.e * sh);
    ctx.lineTo(x, y + tileHeight * zoom + yOffset - corners.s * sh);
    ctx.lineTo(x - (tileWidth / 2) * zoom, y + (tileHeight / 2) * zoom + yOffset - corners.w * sh);
  }
  
  ctx.closePath();
  
  // Fill the tile
  const config = tileConfig[type];
  const textureImage = textures[type];

  const isSloped = corners.n + corners.e + corners.s + corners.w > 0;

  if (textureImage?.complete && textureImage.naturalWidth > 0) {
    ctx.save();
    ctx.clip();
    ctx.drawImage(
      textureImage,
      x - (tileWidth / 2) * zoom,
      y + yOffset - (isSloped ? elevationScale * zoom : 0),
      tileWidth * zoom,
      tileHeight * zoom + (isSloped ? elevationScale * zoom : 0)
    );
    ctx.restore();
  } else {
    // Color with shading based on corner heights (light from NW)
    let brightness = 0;
    if (type !== 'water') {
      brightness = (corners.n + corners.w - corners.s - corners.e) * 5;
    }

    // Make water darker based on depth
    if (type === 'water' && elevation < 0) {
      brightness = elevation * 8;
    }

    ctx.fillStyle = adjustBrightness(config.color, brightness);
    ctx.fill();
  }
  
  // Draw tile outline
  ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
  ctx.lineWidth = 1;
  ctx.stroke();
  
  ctx.restore();
}

// Helper function to adjust color brightness
function adjustBrightness(color, percent) {
  const num = parseInt(color.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = (num >> 8 & 0x00FF) + amt;
  const B = (num & 0x0000FF) + amt;
  return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
    (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
    (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
}

function generateCoastline(gridWidth, roughness = 7) {
  // Ocean should only take up bottom 1/3 of the map
  // So coastline should be around 2/3 down the map
  const coastlineBase = Math.floor(gridWidth * 0.67); // 2/3 down the map
  
  // Start with points near the base coastline
  let points = [
    coastlineBase + Math.floor((rand() - 0.5) * 10),  // Left side with small variation
    coastlineBase + Math.floor((rand() - 0.5) * 10)   // Right side with small variation
  ];

  for (let i = 0; i < roughness; i++) {
    let newPoints = [];
    for (let j = 0; j < points.length - 1; j++) {
      let mid = Math.floor((points[j] + points[j + 1]) / 2);
      // Smaller displacement for more gentle coastline
      mid += Math.floor((rand() - 0.5) * gridWidth / (4 * (i + 1)));
      // Keep coastline roughly around the 2/3 mark
      mid = Math.max(Math.floor(gridWidth * 0.6), Math.min(Math.floor(gridWidth * 0.75), mid));
      newPoints.push(points[j], mid);
    }
    newPoints.push(points[points.length - 1]);
    points = newPoints;
  }
  return points;
}

function generateRiverPath(gridWidth, gridHeight, seed = 42) {
  const rand = mulberry32(seed);
  const river = [];
  let x = Math.floor(gridWidth / 2);

  for (let y = 0; y < gridHeight; y++) {
    // Optionally allow the river to meander left/right
    if (y > 0 && rand() < 0.3) {
      x += rand() < 0.5 ? -1 : 1;
      x = Math.max(1, Math.min(gridWidth - 2, x)); // keep river in bounds
    }
    river.push(x);
  }
  return river;
}

const IsometricCity = ({ debugMode = false }) => {
  const canvasRef = useRef(null);
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const [zoom, setZoom] = useState(1);
  const [textures, setTextures] = useState({});
  
  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Handle mouse wheel for zoom
  useEffect(() => {
    const handleWheel = (e) => {
      if (e.ctrlKey) return; // Allow browser zoom with ctrl+wheel
      e.preventDefault();
      const zoomStep = 0.1;
      setZoom((z) => {
        let next = z;
        if (e.deltaY < 0) {
          next = Math.min(z + zoomStep, 3);
        } else {
          next = Math.max(z - zoomStep, 0.5);
        }
        return next;
      });
    };
    const canvas = canvasRef.current;
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  }, []);


  // Load textures
  useEffect(() => {
    const loadTextures = async () => {
      const loadedTextures = {};
      
      await Promise.all(Object.entries(tileConfig).map(async ([key, cfg]) => {
        if (cfg.texture && key !== 'water') {
          const img = new window.Image();
          await new Promise(resolve => {
            img.onload = () => {
              if (img.complete && img.naturalWidth > 0) {
                loadedTextures[key] = img;
              }
              resolve();
            };
            img.onerror = () => {
              console.warn(`Failed to load texture: ${cfg.texture}`);
              resolve(); // Fallback to color if texture fails
            };
            img.src = cfg.texture;
          });
        }
      }));
      
      setTextures(loadedTextures);
    };

    loadTextures();
  }, []);

    // Generate coastline first
    const [coastline] = useState(() => generateCoastline(gridWidth));
    // Generate elevation map based on coastline
    const [elevationMap] = useState(() => generateElevationMap(gridWidth, gridHeight, coastline, 42));
    const [currentSlopeMatrix, setCurrentSlopeMatrix] = useState(null);
  const [hoveredTile, setHoveredTile] = useState(null);
    const [riverPath] = useMemo(() => generateRiverPath(gridWidth, gridHeight, 123), []);

  // rendering useEffect
  useEffect(() => {
    const { width, height } = dimensions;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, width, height);

    const gridPixelWidth = (gridWidth + gridHeight) * (tileWidth / 2) * zoom;
    const gridPixelHeight = (gridWidth + gridHeight) * (tileHeight / 2) * zoom;
    const offsetX = width / 2;
    const offsetY = height / 2 - gridPixelHeight / 2;


    // Create tiles with corner heights for smooth slope rendering
    const tiles = [];
    const cornerMatrix = Array(gridHeight).fill().map(() => Array(gridWidth).fill(null));

    for (let x = 0; x < gridWidth; x++) {
      for (let y = 0; y < gridHeight; y++) {
        const elevation = elevationMap[y][x];
        const visualType = elevation <= 0 ? "water" : "grass";
        const corners = getTileCornerHeights(elevationMap, x, y);

        cornerMatrix[y][x] = corners;
        tiles.push({ x, y, elevation, type: visualType, corners });
      }
    }

    // Store corner matrix for debug tool
    setCurrentSlopeMatrix(cornerMatrix);
    
    // No roads or buildings - just the terrain
    
    // Add center marker
    const centerX = Math.floor(gridWidth / 2);
    const centerY = Math.floor(gridHeight / 2);
    if (elevationMap[centerY][centerX] > 0) {
      tiles.push({ x: centerX, y: centerY, elevation: elevationMap[centerY][centerX], type: "marker", corners: { n: 0, e: 0, s: 0, w: 0 } });
    }
    
    
    
    // Sort tiles for proper rendering order (back to front)
    tiles.sort((a, b) => {
      const depthA = a.x + a.y;
      const depthB = b.x + b.y;
      if (depthA !== depthB) return depthA - depthB;
      // If same depth, render higher elevation first to avoid holes
      return b.elevation - a.elevation;
    });
    
    // Render all tiles
    for (const tile of tiles) {
      const screenX = (tile.x - tile.y) * (tileWidth / 2) * zoom + offsetX;
      const screenY = (tile.x + tile.y) * (tileHeight / 2) * zoom + offsetY;
      drawTile(ctx, screenX, screenY, tile.elevation, tile.type, tile.corners, zoom, textures, elevationMap, tile.x, tile.y);
      
      // Draw yellow highlight for hovered tile in debug mode
      if (debugMode && hoveredTile && tile.x === hoveredTile.x && tile.y === hoveredTile.y) {
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = 'yellow';
        
        // Calculate vertical offset for elevation
        const elevationScale = 16;
        const yOffset = -tile.elevation * elevationScale * zoom;
        
        // Draw yellow diamond over the tile
        ctx.beginPath();
        ctx.moveTo(screenX, screenY + yOffset);
        ctx.lineTo(screenX + (tileWidth / 2) * zoom, screenY + (tileHeight / 2) * zoom + yOffset);
        ctx.lineTo(screenX, screenY + tileHeight * zoom + yOffset);
        ctx.lineTo(screenX - (tileWidth / 2) * zoom, screenY + (tileHeight / 2) * zoom + yOffset);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
  }, [dimensions, zoom, textures, debugMode, hoveredTile]);

  // Handle debug mode clicks - moved after elevationMap is available
  useEffect(() => {
    if (!debugMode) return;
    
    const handleClick = (e) => {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      
      // Convert screen coordinates to tile coordinates
      const { width, height } = dimensions;
      const offsetX = width / 2;
      const offsetY = height / 2 - ((gridWidth + gridHeight) * (tileHeight / 2) * zoom) / 2;
      
      // Adjust for offset
      const relativeX = screenX - offsetX;
      const relativeY = screenY - offsetY;
      
      // Convert from screen to isometric tile coordinates
      // This is the inverse of the isometric projection formula
      const tileX = Math.round((relativeX / (tileWidth / 2) + relativeY / (tileHeight / 2)) / (2 * zoom));
      const tileY = Math.round((relativeY / (tileHeight / 2) - relativeX / (tileWidth / 2)) / (2 * zoom));
      
      // Check if coordinates are within bounds
      if (tileX >= 0 && tileX < gridWidth && tileY >= 0 && tileY < gridHeight) {
        const elevation = elevationMap[tileY][tileX];
        const corners = currentSlopeMatrix ? currentSlopeMatrix[tileY][tileX] : null;
        const cornerStr = corners ? `n:${corners.n} e:${corners.e} s:${corners.s} w:${corners.w}` : 'unknown';
        console.log(`Tile [${tileX},${tileY}]: elevation=${elevation}, corners={${cornerStr}}`);
      } else {
        console.log(`Click outside grid bounds: X:${tileX}, Y:${tileY}`);
      }
    };
    
    const handleMouseMove = (e) => {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      
      // Convert screen coordinates to tile coordinates
      const { width, height } = dimensions;
      const offsetX = width / 2;
      const offsetY = height / 2 - ((gridWidth + gridHeight) * (tileHeight / 2) * zoom) / 2;
      
      // Adjust for offset
      const relativeX = screenX - offsetX;
      const relativeY = screenY - offsetY;
      
      // Convert from screen to isometric tile coordinates
      const tileX = Math.round((relativeX / (tileWidth / 2) + relativeY / (tileHeight / 2)) / (2 * zoom));
      const tileY = Math.round((relativeY / (tileHeight / 2) - relativeX / (tileWidth / 2)) / (2 * zoom));
      
      // Check if coordinates are within bounds and update hover highlight
      if (tileX >= 0 && tileX < gridWidth && tileY >= 0 && tileY < gridHeight) {
        setHoveredTile({ x: tileX, y: tileY });
      } else {
        setHoveredTile(null);
      }
    };
    
    const canvas = canvasRef.current;
    canvas.addEventListener("click", handleClick);
    canvas.addEventListener("mousemove", handleMouseMove);
    return () => {
      canvas.removeEventListener("click", handleClick);
      canvas.removeEventListener("mousemove", handleMouseMove);
    };
  }, [debugMode, dimensions, zoom, elevationMap, currentSlopeMatrix]);

  return (
    <canvas
      ref={canvasRef}
      width={dimensions.width}
      height={dimensions.height}
      style={{
        width: "100vw",
        height: "100vh",
        display: "block",
        position: "absolute",
        top: 0,
        left: 0,
        zIndex: 1,
        background: "#222",
        cursor: debugMode ? "crosshair" : "grab"
      }}
    />
  );
};


export default IsometricCity;
