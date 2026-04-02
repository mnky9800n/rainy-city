import { tileConfig, tileWidth, tileHeight, elevationScale } from './constants.js';

// Helper function to adjust color brightness
export function adjustBrightness(color, percent) {
  const num = parseInt(color.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = (num >> 8 & 0x00FF) + amt;
  const B = (num & 0x0000FF) + amt;
  return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
    (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
    (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
}

// Compute corner heights for smooth slope transitions.
export function getTileCornerHeights(elevationMap, x, y) {
  const current = elevationMap[y][x];

  const h = elevationMap.length;
  const w = elevationMap[0].length;
  const c1 = current + 1;

  const ne = y > 0 ? elevationMap[y - 1][x] : current;
  const se = x < w - 1 ? elevationMap[y][x + 1] : current;
  const sw = y < h - 1 ? elevationMap[y + 1][x] : current;
  const nw = x > 0 ? elevationMap[y][x - 1] : current;

  const dNW = (y > 0 && x > 0) ? elevationMap[y - 1][x - 1] : current;
  const dNE = (y > 0 && x < w - 1) ? elevationMap[y - 1][x + 1] : current;
  const dSE = (y < h - 1 && x < w - 1) ? elevationMap[y + 1][x + 1] : current;
  const dSW = (y < h - 1 && x > 0) ? elevationMap[y + 1][x - 1] : current;

  const isWater = current <= 0;
  const check = (val) => val === c1 && (!isWater || val <= 0);

  return {
    n: (check(ne) || check(nw) || check(dNW)) ? 1 : 0,
    e: (check(ne) || check(se) || check(dNE)) ? 1 : 0,
    s: (check(se) || check(sw) || check(dSE)) ? 1 : 0,
    w: (check(nw) || check(sw) || check(dSW)) ? 1 : 0,
  };
}

// Convert tile coordinates to screen coordinates
export function toScreenCoords(tileX, tileY, zoom, offsetX, offsetY) {
  const screenX = (tileX - tileY) * (tileWidth / 2) * zoom + offsetX;
  const screenY = (tileX + tileY) * (tileHeight / 2) * zoom + offsetY;
  return { screenX, screenY };
}

// Draw a single isometric tile
export function drawTile(ctx, x, y, elevation, type, corners, zoom, textures) {
  ctx.save();

  const yOffset = -elevation * elevationScale * zoom;

  // Draw cliff sides only for land
  if (elevation > 0 && type !== 'water') {
    const cliffColor = '#8B7355';
    // Extend cliffs below ground level to meet the water surface
    const cliffExtra = 0.5 * elevationScale * zoom;

    ctx.fillStyle = adjustBrightness(cliffColor, -20);
    ctx.beginPath();
    ctx.moveTo(x - (tileWidth / 2) * zoom, y + (tileHeight / 2) * zoom + yOffset);
    ctx.lineTo(x - (tileWidth / 2) * zoom, y + (tileHeight / 2) * zoom + cliffExtra);
    ctx.lineTo(x, y + tileHeight * zoom + cliffExtra);
    ctx.lineTo(x, y + tileHeight * zoom + yOffset);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = adjustBrightness(cliffColor, -40);
    ctx.beginPath();
    ctx.moveTo(x, y + tileHeight * zoom + yOffset);
    ctx.lineTo(x, y + tileHeight * zoom + cliffExtra);
    ctx.lineTo(x + (tileWidth / 2) * zoom, y + (tileHeight / 2) * zoom + cliffExtra);
    ctx.lineTo(x + (tileWidth / 2) * zoom, y + (tileHeight / 2) * zoom + yOffset);
    ctx.closePath();
    ctx.fill();
  }

  // Draw the tile surface
  ctx.beginPath();
  {
    const sh = elevationScale * zoom;
    ctx.moveTo(x, y + yOffset - corners.n * sh);
    ctx.lineTo(x + (tileWidth / 2) * zoom, y + (tileHeight / 2) * zoom + yOffset - corners.e * sh);
    ctx.lineTo(x, y + tileHeight * zoom + yOffset - corners.s * sh);
    ctx.lineTo(x - (tileWidth / 2) * zoom, y + (tileHeight / 2) * zoom + yOffset - corners.w * sh);
  }
  ctx.closePath();

  const config = tileConfig[type];
  const textureImage = textures[type];
  const isSloped = corners.n + corners.e + corners.s + corners.w > 0;

  const hasTexture = textureImage instanceof HTMLCanvasElement
    ? textureImage.width > 0
    : textureImage?.complete && textureImage.naturalWidth > 0;
  if (hasTexture) {
    ctx.save();
    ctx.clip();

    const isRoadType = type === 'road' || type === 'road_cross' || type === 'road_intersection';

    if (isRoadType && isSloped) {
      // Map texture to the sloped diamond using an affine transform.
      // On a flat tile, texture midpoints map to diamond corners:
      //   tex(W/2, 0) -> N,  tex(W, H/2) -> E,  tex(0, H/2) -> W,  tex(W/2, H) -> S
      // For road tiles (parallelograms), an affine transform can match all 4 exactly.
      const imgW = textureImage.naturalWidth || textureImage.width;
      const imgH = textureImage.naturalHeight || textureImage.height;
      const tw_s = tileWidth * zoom;
      const th_s = tileHeight * zoom;
      const hw = tw_s / 2;
      const sh = elevationScale * zoom;

      const a = tw_s / imgW;
      const b = (corners.w - corners.e) * sh / imgW;
      const c = 0;
      const d = (th_s + sh * (2 * corners.n - corners.w - corners.e)) / imgH;
      const e_val = x - hw;
      const f_val = y + yOffset - sh * (2 * corners.n + corners.w - corners.e) / 2;

      ctx.transform(a, b, c, d, e_val, f_val);
      ctx.drawImage(textureImage, 0, 0);
    } else {
      ctx.drawImage(
        textureImage,
        x - (tileWidth / 2) * zoom,
        y + yOffset - (isSloped ? elevationScale * zoom : 0),
        tileWidth * zoom,
        tileHeight * zoom + (isSloped ? elevationScale * zoom : 0)
      );
    }

    ctx.restore();
  } else {
    let brightness = 0;
    if (type !== 'water') {
      brightness = (corners.n + corners.w - corners.s - corners.e) * 5;
    }

    if (type === 'water' && elevation < 0) {
      brightness = elevation * 8;
    }

    ctx.fillStyle = adjustBrightness(config.color, brightness);
    ctx.fill();
  }

  ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.restore();
}
