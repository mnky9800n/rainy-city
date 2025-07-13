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

// Determine tile slope based on neighboring elevations
function getTileSlope(elevationMap, x, y) {
  const current = elevationMap[y][x];
  
  
  // Sea level water (elevation 0) is always flat
  if (current === 0) return 'flat';
  
  // All other elevations (positive land, negative seafloor) can have slopes
  
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
  
  // Check which isometric directions are lower by 1
  const lowerByOne = [];
  if (northeast === current - 1) lowerByOne.push('northeast');
  if (southeast === current - 1) lowerByOne.push('southeast');
  if (southwest === current - 1) lowerByOne.push('southwest');
  if (northwest === current - 1) lowerByOne.push('northwest');
  
  // Only create slopes when we have clear elevation transitions
  if (higherByOne.length === 0 && lowerByOne.length === 0) return 'flat';
  
  // In your example: NW=1, NE=2, SE=2, SW=1
  // X should slope from NW (low) to SE (high) = 'southeast' slope
  
  // Single direction slopes
  if (higherByOne.length === 1) {
    if (higherByOne.includes('northeast')) return 'northeast';
    if (higherByOne.includes('southeast')) return 'southeast';
    if (higherByOne.includes('southwest')) return 'southwest';
    if (higherByOne.includes('northwest')) return 'northwest';
  }
  
  
  // Multiple directions - only create corner fill tiles when we have exactly 2 higher neighbors
  // and no lower neighbors (true corner situations)
  if (higherByOne.length === 2 && lowerByOne.length === 0) {
    // If both NE and SE are higher, create east corner fill
    if (higherByOne.includes('northeast') && higherByOne.includes('southeast')) return 'corner-east';
    // If both SE and SW are higher, create south corner fill  
    if (higherByOne.includes('southeast') && higherByOne.includes('southwest')) return 'corner-south';
    // If both SW and NW are higher, create west corner fill
    if (higherByOne.includes('southwest') && higherByOne.includes('northwest')) return 'corner-west';
    // If both NW and NE are higher, create north corner fill
    if (higherByOne.includes('northwest') && higherByOne.includes('northeast')) return 'corner-north';
  }
  
  // Opposite corners higher - create corner slopes
  if (higherByOne.includes('northeast') && higherByOne.includes('southwest')) return 'corner-ne-sw';
  if (higherByOne.includes('northwest') && higherByOne.includes('southeast')) return 'corner-nw-se';
  
  

  // Connecting tile detection: flat tile with 2 higher neighbors at 90 degrees
  if (higherByOne.length === 0 && lowerByOne.length === 0) {
    // Find neighbors that are higher (sloped areas)
    const higherNeighbors = [];
    
    if (northeast > current) higherNeighbors.push('northeast');
    if (southeast > current) higherNeighbors.push('southeast');
    if (southwest > current) higherNeighbors.push('southwest'); 
    if (northwest > current) higherNeighbors.push('northwest');
    
    // If we have at least 2 higher neighbors that are 90 degrees apart
    if (higherNeighbors.length >= 2) {
      // Check for 90-degree adjacency patterns
      if (higherNeighbors.includes('northeast') && higherNeighbors.includes('southeast')) {
        return 'connect-northeast'; // Slope toward the corner between NE and SE
      }
      if (higherNeighbors.includes('southeast') && higherNeighbors.includes('southwest')) {
        return 'connect-southeast'; // Slope toward the corner between SE and SW
      }
      if (higherNeighbors.includes('southwest') && higherNeighbors.includes('northwest')) {
        return 'connect-southwest'; // Slope toward the corner between SW and NW
      }
      if (higherNeighbors.includes('northwest') && higherNeighbors.includes('northeast')) {
        return 'connect-northwest'; // Slope toward the corner between NW and NE
      }
    }
  }

  return 'flat';
}

// drawTile function with SimCity 2000 style elevation
function drawTile(ctx, x, y, elevation, type, slope, zoom, textures, elevationMap, gridX, gridY) {
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
      case 'north':
        // Slope from south (low) at current elevation to north (high) at +1 elevation
        ctx.moveTo(x, y + yOffset - slopeHeight); // North point (high - at elevation+1)
        ctx.lineTo(x + (tileWidth / 2) * zoom, y + (tileHeight / 2) * zoom + yOffset); // East point (low - at current elevation)
        ctx.lineTo(x, y + tileHeight * zoom + yOffset); // South point (low - at current elevation)
        ctx.lineTo(x - (tileWidth / 2) * zoom, y + (tileHeight / 2) * zoom + yOffset); // West point (low - at current elevation)
        break;
      case 'south':
        // Slope from north (low) at current elevation to south (high) at +1 elevation
        ctx.moveTo(x, y + yOffset); // North point (low - at current elevation)
        ctx.lineTo(x + (tileWidth / 2) * zoom, y + (tileHeight / 2) * zoom + yOffset); // East point (low - at current elevation)
        ctx.lineTo(x, y + tileHeight * zoom + yOffset - slopeHeight); // South point (high - at elevation+1)
        ctx.lineTo(x - (tileWidth / 2) * zoom, y + (tileHeight / 2) * zoom + yOffset); // West point (low - at current elevation)
        break;
      case 'east':
        // Slope from west (low) at current elevation to east (high) at +1 elevation
        ctx.moveTo(x, y + yOffset); // North point (low - at current elevation)
        ctx.lineTo(x + (tileWidth / 2) * zoom, y + (tileHeight / 2) * zoom + yOffset - slopeHeight); // East point (high - at elevation+1)
        ctx.lineTo(x, y + tileHeight * zoom + yOffset); // South point (low - at current elevation)
        ctx.lineTo(x - (tileWidth / 2) * zoom, y + (tileHeight / 2) * zoom + yOffset); // West point (low - at current elevation)
        break;
      case 'west':
        // Slope from east (low) at current elevation to west (high) at +1 elevation
        ctx.moveTo(x, y + yOffset); // North point (low - at current elevation)
        ctx.lineTo(x + (tileWidth / 2) * zoom, y + (tileHeight / 2) * zoom + yOffset); // East point (low - at current elevation)
        ctx.lineTo(x, y + tileHeight * zoom + yOffset); // South point (low - at current elevation)
        ctx.lineTo(x - (tileWidth / 2) * zoom, y + (tileHeight / 2) * zoom + yOffset - slopeHeight); // West point (high - at elevation+1)
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
      case 'corner-ne-sw':
        // Corner slope from NW and SE (low) to NE and SW (high)
        ctx.moveTo(x, y + yOffset - slopeHeight); // North point (high)
        ctx.lineTo(x + (tileWidth / 2) * zoom, y + (tileHeight / 2) * zoom + yOffset); // East point (low)
        ctx.lineTo(x, y + tileHeight * zoom + yOffset - slopeHeight); // South point (high)
        ctx.lineTo(x - (tileWidth / 2) * zoom, y + (tileHeight / 2) * zoom + yOffset); // West point (low)
        break;
      case 'corner-nw-se':
        // Corner slope from NE and SW (low) to NW and SE (high)
        ctx.moveTo(x, y + yOffset); // North point (low)
        ctx.lineTo(x + (tileWidth / 2) * zoom, y + (tileHeight / 2) * zoom + yOffset - slopeHeight); // East point (high)
        ctx.lineTo(x, y + tileHeight * zoom + yOffset); // South point (low)
        ctx.lineTo(x - (tileWidth / 2) * zoom, y + (tileHeight / 2) * zoom + yOffset - slopeHeight); // West point (high)
        break;
      case 'corner-north':
        // Complete diamond - North, East, West corners high, South corner low
        ctx.moveTo(x, y + yOffset - slopeHeight); // North point (high)
        ctx.lineTo(x + (tileWidth / 2) * zoom, y + (tileHeight / 2) * zoom + yOffset - slopeHeight); // East point (high)
        ctx.lineTo(x, y + tileHeight * zoom + yOffset); // South point (low)
        ctx.lineTo(x - (tileWidth / 2) * zoom, y + (tileHeight / 2) * zoom + yOffset - slopeHeight); // West point (high)
        break;
      case 'corner-east':
        // Complete diamond - North, East, South corners high, West corner low
        ctx.moveTo(x, y + yOffset - slopeHeight); // North point (high)
        ctx.lineTo(x + (tileWidth / 2) * zoom, y + (tileHeight / 2) * zoom + yOffset - slopeHeight); // East point (high)
        ctx.lineTo(x, y + tileHeight * zoom + yOffset - slopeHeight); // South point (high)
        ctx.lineTo(x - (tileWidth / 2) * zoom, y + (tileHeight / 2) * zoom + yOffset); // West point (low)
        break;
      case 'corner-south':
        // Complete diamond - East, South, West corners high, North corner low
        ctx.moveTo(x, y + yOffset); // North point (low)
        ctx.lineTo(x + (tileWidth / 2) * zoom, y + (tileHeight / 2) * zoom + yOffset - slopeHeight); // East point (high)
        ctx.lineTo(x, y + tileHeight * zoom + yOffset - slopeHeight); // South point (high)
        ctx.lineTo(x - (tileWidth / 2) * zoom, y + (tileHeight / 2) * zoom + yOffset - slopeHeight); // West point (high)
        break;
      case 'corner-west':
        // Complete diamond - North, West, South corners high, East corner low
        ctx.moveTo(x, y + yOffset - slopeHeight); // North point (high)
        ctx.lineTo(x + (tileWidth / 2) * zoom, y + (tileHeight / 2) * zoom + yOffset); // East point (low)
        ctx.lineTo(x, y + tileHeight * zoom + yOffset - slopeHeight); // South point (high)
        ctx.lineTo(x - (tileWidth / 2) * zoom, y + (tileHeight / 2) * zoom + yOffset - slopeHeight); // West point (high)
        break;
      case 'connect-northeast':
        // Connecting tile - flat on SW side, slopes up along diagonal from SE to NW corners toward NE
        // The tile is split diagonally: SW half is flat at low elevation, NE half slopes up
        ctx.moveTo(x, y + yOffset - slopeHeight); // North point (high)
        ctx.lineTo(x + (tileWidth / 2) * zoom, y + (tileHeight / 2) * zoom + yOffset); // East point (mid - on diagonal)
        ctx.lineTo(x, y + tileHeight * zoom + yOffset); // South point (low)
        ctx.lineTo(x - (tileWidth / 2) * zoom, y + (tileHeight / 2) * zoom + yOffset); // West point (mid - on diagonal)
        break;
      case 'connect-southeast':
        // Connecting tile - flat on NW side, slopes up along diagonal from NE to SW corners toward SE
        ctx.moveTo(x, y + yOffset); // North point (mid - on diagonal)
        ctx.lineTo(x + (tileWidth / 2) * zoom, y + (tileHeight / 2) * zoom + yOffset - slopeHeight); // East point (high)
        ctx.lineTo(x, y + tileHeight * zoom + yOffset); // South point (mid - on diagonal)
        ctx.lineTo(x - (tileWidth / 2) * zoom, y + (tileHeight / 2) * zoom + yOffset); // West point (low)
        break;
      case 'connect-southwest':
        // Connecting tile - flat on NE side, slopes up along diagonal from NW to SE corners toward SW
        ctx.moveTo(x, y + yOffset); // North point (low)
        ctx.lineTo(x + (tileWidth / 2) * zoom, y + (tileHeight / 2) * zoom + yOffset); // East point (mid - on diagonal)
        ctx.lineTo(x, y + tileHeight * zoom + yOffset - slopeHeight); // South point (high)
        ctx.lineTo(x - (tileWidth / 2) * zoom, y + (tileHeight / 2) * zoom + yOffset); // West point (mid - on diagonal)
        break;
      case 'connect-northwest':
        // Connecting tile - flat on SE side, slopes up along diagonal from SW to NE corners toward NW
        ctx.moveTo(x, y + yOffset); // North point (mid - on diagonal)
        ctx.lineTo(x + (tileWidth / 2) * zoom, y + (tileHeight / 2) * zoom + yOffset); // East point (low)
        ctx.lineTo(x, y + tileHeight * zoom + yOffset); // South point (mid - on diagonal)
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
    // Color with shading based on slope or water depth
    let brightness = 0;
    if (slope === 'northeast' || slope === 'northwest') brightness = 10;
    if (slope === 'southeast' || slope === 'southwest') brightness = -10;
    
    // Make water darker based on depth
    if (type === 'water' && elevation < 0) {
      brightness = elevation * 8; // Deeper water is darker
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


    // Create slope matrix to track all tile slopes
    const slopeMatrix = Array(gridHeight).fill().map(() => Array(gridWidth).fill('flat'));
    
    // First pass: determine all slopes
    for (let x = 0; x < gridWidth; x++) {
      for (let y = 0; y < gridHeight; y++) {
        slopeMatrix[y][x] = getTileSlope(elevationMap, x, y);
      }
    }
    
    // Create a sorted array of tiles by depth for proper rendering order
    const tiles = [];
    const cityGrid = Array(gridHeight).fill().map(() => Array(gridWidth).fill(null));
    
    // Second pass: determine base tile types and detect connecting tiles
    for (let x = 0; x < gridWidth; x++) {
      for (let y = 0; y < gridHeight; y++) {
        const elevation = elevationMap[y][x];
        let type = "grass";
        
        if (elevation <= 0) {
          type = "water";
        } else {
          type = "grass"; // All land is grass
        }
        
        let slope = slopeMatrix[y][x];
        
        // Check for connecting tiles: flat tile with sloped neighbors at 90 degrees
        if (slope === 'flat' && elevation > 0) {
          // Get neighbor slopes
          const neSlope = (y > 0) ? slopeMatrix[y - 1][x] : 'flat';
          const seSlope = (x < gridWidth - 1) ? slopeMatrix[y][x + 1] : 'flat';
          const swSlope = (y < gridHeight - 1) ? slopeMatrix[y + 1][x] : 'flat';
          const nwSlope = (x > 0) ? slopeMatrix[y][x - 1] : 'flat';
          
          // Check for 90-degree adjacent sloped neighbors
          const isSloped = (s) => s !== 'flat';
          
          if (isSloped(neSlope) && isSloped(seSlope)) {
            slope = 'east'; // Slope toward east (between NE and SE)
          } else if (isSloped(seSlope) && isSloped(swSlope)) {
            slope = 'south'; // Slope toward south (between SE and SW)
          } else if (isSloped(swSlope) && isSloped(nwSlope)) {
            slope = 'west'; // Slope toward west (between SW and NW)
          } else if (isSloped(nwSlope) && isSloped(neSlope)) {
            slope = 'north'; // Slope toward north (between NW and NE)
          }
        }
        
        cityGrid[y][x] = { type, elevation, slope };
        tiles.push({ x, y, elevation, type, slope });
      }
    }
    
    // Store slope matrix for debug tool
    setCurrentSlopeMatrix(slopeMatrix);
    
    // No roads or buildings - just the terrain
    
    // Add center marker
    const centerX = Math.floor(gridWidth / 2);
    const centerY = Math.floor(gridHeight / 2);
    if (elevationMap[centerY][centerX] > 0) {
      tiles.push({ x: centerX, y: centerY, elevation: elevationMap[centerY][centerX], type: "marker", slope: "north" });
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
      drawTile(ctx, screenX, screenY, tile.elevation, tile.type, tile.slope, zoom, textures, elevationMap, tile.x, tile.y);
      
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
        const slope = currentSlopeMatrix ? currentSlopeMatrix[tileY][tileX] : 'unknown';
        console.log(`Tile location X:${tileX}, Y:${tileY}, elevation:${elevation}, slope:${slope}`);
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
