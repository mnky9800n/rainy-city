import React, { useRef, useEffect, useState, useMemo } from "react";

// TODO : put this somewhere else into a different file
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

const seed = 42;


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

// const rand = mulberry32(42); // Fixed seed for consistent coastline 
const rand = mulberry32(seed); // Fixed seed for consistent coastline 

// sets the size of the map
const tileWidth = 64;
const tileHeight = 32;
const gridWidth = 75;   // Static grid size
const gridHeight = 75;  // Static grid size

// Generate elevation map with discrete levels like SimCity 2000
function generate_ElevationMap(width, height, coastline, seed = 42) {
    // should return the inital elevation map
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
}

function smooth_hills(elevationMap) {
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
}

function generate_coastline(width, height,) {
    // generates a coastline using the mulberry function and 
    // so that it can be used in the generate_ElevationMap 
    // function
}

function generate_isSlope_map(smoothedMap) {
    // generates matrix same size as smoothedMap determines if a tile is
    // sloped or not. A tile is sloped if an adjacent tile is at a higher
    // elevation
    // returns this matrix
}

function generate_isOcean_map(smoothedMap) {
    // generates matrix same size as smoothedMap to determine
    // if a tile is in the ocean (if tile <= 0 elevation then ocean)
    // returns this matrix
}

function get_tileVector(loc_x, loc_y) {
    // returns the descriptive vector of the combination of all of the
    // different maps.
    // returns at (loc_x, loc_y): (elevationMap[[x-1:x+1], [y-1:y+1]], isSlope, isOcean)
}

function get_tile(tileVector) {
    // returns the tile for the map so it can be drawn based on the tileVector
    // if the tile is sloped, using the elevationMap 3x3 element, determines which direction 
    // the tile should slope. Tiles that slope along a diagonal should be flat on half
    // and sloped on half. tiles that slope orthogonal to to the direction of the higher
    // elevation tile, should not have a flat section. if a tile is an ocean tile then it 
    // follows the following rules, if it is between the minimum elevation and elevation=0
    // then the tile doesn't render. if it is the minimum
}

function draw_Ocean(Map) {
    // draws the ocean transparent layer at elevation 0
}

function draw_Map(elevationMap, isOceanMap, isSlopeMap) {
    // draws the map using the get_tile function iterating across the map matrices
    //
}

