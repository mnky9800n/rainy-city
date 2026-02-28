import { tileWidth, tileHeight, gridWidth, gridHeight } from './constants.js';

// Compute canvas offsets so the grid is centered
export function getOffsets(dimensions, zoom, panX = 0, panY = 0) {
  const gridPixelHeight = (gridWidth + gridHeight) * (tileHeight / 2) * zoom;
  const offsetX = dimensions.width / 2 + panX;
  const offsetY = dimensions.height / 2 - gridPixelHeight / 2 + panY;
  return { offsetX, offsetY };
}

// Convert screen (pixel) coordinates to tile coordinates (inverse projection)
export function screenToTile(screenX, screenY, zoom, offsetX, offsetY) {
  const relativeX = screenX - offsetX;
  const relativeY = screenY - offsetY;

  const tileX = Math.round((relativeX / (tileWidth / 2) + relativeY / (tileHeight / 2)) / (2 * zoom));
  const tileY = Math.round((relativeY / (tileHeight / 2) - relativeX / (tileWidth / 2)) / (2 * zoom));

  return { tileX, tileY };
}
