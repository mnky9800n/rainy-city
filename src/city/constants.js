// Texture configuration - add/remove textures here
export const tileConfig = {
  water: {
    color: "#2980b9"
    // No texture for water - always use color
  },
  grass: {
    color: "#3a6b47",
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
  road_cross: {
    color: "#34495e",
    texture: "./textures/road_cross.png"
  },
  road_intersection: {
    color: "#34495e",
    texture: "./textures/road_intersection.png"
  },
  marker: {
    color: "#7f8c8d",
    texture: "./textures/marker.png"
  }
};

// Tile dimensions
export const tileWidth = 64;
export const tileHeight = 32;

// Grid size
export const gridWidth = 75;
export const gridHeight = 75;

// Height of each elevation level in pixels
export const elevationScale = 24;
