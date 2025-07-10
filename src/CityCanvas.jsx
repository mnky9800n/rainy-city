import React, { useRef, useEffect, useState, useMemo } from "react";

// Texture configuration - add/remove textures here
const tileConfig = {
  water: {
    color: "#2980b9",
    texture: "./textures/water.png" // Path to your texture
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
        // Water area - always level 0
        elevationMap[y][x] = 0;
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
  
  return smoothedMap;
}

// Determine tile slope based on neighboring elevations
function getTileSlope(elevationMap, x, y) {
  const current = elevationMap[y][x];
  
  // Water is always flat
  if (current === 0) return 'flat';
  
  // In isometric view, the cardinal directions are actually diagonals:
  // Array y-1 = NE direction, x+1 = SE direction, y+1 = SW direction, x-1 = NW direction
  const northeast = y > 0 ? elevationMap[y - 1][x] : current;        // "north" in array = NE in isometric
  const southeast = x < elevationMap[0].length - 1 ? elevationMap[y][x + 1] : current;  // "east" in array = SE in isometric  
  const southwest = y < elevationMap.length - 1 ? elevationMap[y + 1][x] : current;     // "south" in array = SW in isometric
  const northwest = x > 0 ? elevationMap[y][x - 1] : current;        // "west" in array = NW in isometric
  
  // Only create slopes where there's exactly 1 level difference
  // and the slope connects properly to neighboring tiles
  
  // Check which isometric directions are higher by 1
  const higherByOne = [];
  if (northeast === current + 1) higherByOne.push('northeast');
  if (southeast === current + 1) higherByOne.push('southeast');
  if (southwest === current + 1) higherByOne.push('southwest');
  if (northwest === current + 1) higherByOne.push('northwest');
  
  // Only create slopes when we have clear elevation transitions
  if (higherByOne.length === 0) return 'flat';
  
  // In your example: NW=1, NE=2, SE=2, SW=1
  // X should slope from NW (low) to SE (high) = 'southeast' slope
  
  // Single direction slopes
  if (higherByOne.length === 1) {
    if (higherByOne.includes('northeast')) return 'northeast';
    if (higherByOne.includes('southeast')) return 'southeast';
    if (higherByOne.includes('southwest')) return 'southwest';
    if (higherByOne.includes('northwest')) return 'northwest';
  }
  
  // Multiple directions - choose the appropriate slope
  // If both NE and SE are higher, slope toward the east (SE direction)
  if (higherByOne.includes('northeast') && higherByOne.includes('southeast')) return 'southeast';
  // If both SE and SW are higher, slope toward the south (SW direction)  
  if (higherByOne.includes('southeast') && higherByOne.includes('southwest')) return 'southwest';
  // If both SW and NW are higher, slope toward the west (NW direction)
  if (higherByOne.includes('southwest') && higherByOne.includes('northwest')) return 'northwest';
  // If both NW and NE are higher, slope toward the north (NE direction)
  if (higherByOne.includes('northwest') && higherByOne.includes('northeast')) return 'northeast';
  
  // Opposite corners higher - this shouldn't happen with smooth terrain
  if (higherByOne.includes('northeast') && higherByOne.includes('southwest')) return 'northeast';
  if (higherByOne.includes('northwest') && higherByOne.includes('southeast')) return 'southeast';
  
  return 'flat';
}

// drawTile function with SimCity 2000 style elevation
function drawTile(ctx, x, y, elevation, type, slope, zoom, textures) {
  ctx.save();
  
  // Calculate vertical offset based on elevation - much larger steps
  const elevationScale = 16; // Height of each elevation level in pixels (SimCity 2000 style)
  const yOffset = -elevation * elevationScale * zoom;
  
  // Draw the foundation/cliff sides if elevated
  if (elevation > 0 && type !== 'water') {
    const cliffColor = '#8B7355'; // Tan/brown cliff color
    
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
  
  // Draw the tile surface
  ctx.beginPath();
  
  if (slope === 'flat' || type === 'water') {
    // Flat tile
    ctx.moveTo(x, y + yOffset);
    ctx.lineTo(x + (tileWidth / 2) * zoom, y + (tileHeight / 2) * zoom + yOffset);
    ctx.lineTo(x, y + tileHeight * zoom + yOffset);
    ctx.lineTo(x - (tileWidth / 2) * zoom, y + (tileHeight / 2) * zoom + yOffset);
  } else {
    // Sloped tile - create angled surface
    const slopeHeight = elevationScale * zoom;
    
    switch(slope) {
      case 'northeast':
        // Slope from SW (low) to NE (high)
        ctx.moveTo(x, y + yOffset - slopeHeight); // North point (high)
        ctx.lineTo(x + (tileWidth / 2) * zoom, y + (tileHeight / 2) * zoom + yOffset - slopeHeight); // East point (high)
        ctx.lineTo(x, y + tileHeight * zoom + yOffset); // South point (low)
        ctx.lineTo(x - (tileWidth / 2) * zoom, y + (tileHeight / 2) * zoom + yOffset); // West point (low)
        break;
      case 'northwest':
        // Slope from SE (low) to NW (high)
        ctx.moveTo(x, y + yOffset - slopeHeight); // North point (high)
        ctx.lineTo(x + (tileWidth / 2) * zoom, y + (tileHeight / 2) * zoom + yOffset); // East point (low)
        ctx.lineTo(x, y + tileHeight * zoom + yOffset); // South point (low)
        ctx.lineTo(x - (tileWidth / 2) * zoom, y + (tileHeight / 2) * zoom + yOffset - slopeHeight); // West point (high)
        break;
      case 'southeast':
        // Slope from NW (low) to SE (high)
        ctx.moveTo(x, y + yOffset); // North point (low)
        ctx.lineTo(x + (tileWidth / 2) * zoom, y + (tileHeight / 2) * zoom + yOffset - slopeHeight); // East point (high)
        ctx.lineTo(x, y + tileHeight * zoom + yOffset - slopeHeight); // South point (high)
        ctx.lineTo(x - (tileWidth / 2) * zoom, y + (tileHeight / 2) * zoom + yOffset); // West point (low)
        break;
      case 'southwest':
        // Slope from NE (low) to SW (high)
        ctx.moveTo(x, y + yOffset); // North point (low)
        ctx.lineTo(x + (tileWidth / 2) * zoom, y + (tileHeight / 2) * zoom + yOffset); // East point (low)
        ctx.lineTo(x, y + tileHeight * zoom + yOffset - slopeHeight); // South point (high)
        ctx.lineTo(x - (tileWidth / 2) * zoom, y + (tileHeight / 2) * zoom + yOffset - slopeHeight); // West point (high)
        break;
      default:
        // Flat tile for corner slopes for now
        ctx.moveTo(x, y + yOffset);
        ctx.lineTo(x + (tileWidth / 2) * zoom, y + (tileHeight / 2) * zoom + yOffset);
        ctx.lineTo(x, y + tileHeight * zoom + yOffset);
        ctx.lineTo(x - (tileWidth / 2) * zoom, y + (tileHeight / 2) * zoom + yOffset);
    }
  }
  
  ctx.closePath();
  
  // Fill the tile
  const config = tileConfig[type];
  const textureImage = textures[type];

  if (textureImage?.complete && textureImage.naturalWidth > 0) {
    ctx.save();
    ctx.clip();
    ctx.drawImage(
      textureImage,
      x - (tileWidth / 2) * zoom,
      y + yOffset - (slope !== 'flat' ? elevationScale * zoom : 0),
      tileWidth * zoom,
      tileHeight * zoom + (slope !== 'flat' ? elevationScale * zoom : 0)
    );
    ctx.restore();
  } else {
    // Color with shading based on slope
    let brightness = 0;
    if (slope === 'northeast' || slope === 'northwest') brightness = 10;
    if (slope === 'southeast' || slope === 'southwest') brightness = -10;
    
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

const IsometricCity = () => {
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
        if (cfg.texture) {
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


    // Create a sorted array of tiles by depth for proper rendering order
    const tiles = [];
    const cityGrid = Array(gridHeight).fill().map(() => Array(gridWidth).fill(null));
    
    // First pass: determine base tile types
    for (let x = 0; x < gridWidth; x++) {
      for (let y = 0; y < gridHeight; y++) {
        const elevation = elevationMap[y][x];
        let type = "grass";
        
        if (elevation === 0) {
          type = "water";
        } else {
          type = "grass"; // All land is grass
        }
        
        const slope = getTileSlope(elevationMap, x, y);
        
        cityGrid[y][x] = { type, elevation, slope };
        tiles.push({ x, y, elevation, type, slope });
      }
    }
    
    // No roads or buildings - just the terrain
    
    // Add center marker
    const centerX = Math.floor(gridWidth / 2);
    const centerY = Math.floor(gridHeight / 2);
    if (elevationMap[centerY][centerX] > 0) {
      const centerSlope = getTileSlope(elevationMap, centerX, centerY);
      tiles.push({ x: centerX, y: centerY, elevation: elevationMap[centerY][centerX], type: "marker", slope: centerSlope });
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
      drawTile(ctx, screenX, screenY, tile.elevation, tile.type, tile.slope, zoom, textures);
    }
  }, [dimensions, zoom, textures]);

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
        cursor: "grab"
      }}
    />
  );
};


export default IsometricCity;
