import React, { useRef, useEffect, useState, useMemo } from "react";

function mulberry32(a) {
  return function() {
    var t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

// Usage:
const rand = mulberry32(10000); 


const tileWidth = 64;
const tileHeight = 32;
const gridWidth = 75;   // Static grid size
const gridHeight = 75;  // Static grid size

function drawTile(ctx, x, y, color, zoom = 1) {
  // draws tiles with given color at given location
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + (tileWidth / 2) * zoom, y + (tileHeight / 2) * zoom);
  ctx.lineTo(x, y + tileHeight * zoom);
  ctx.lineTo(x - (tileWidth / 2) * zoom, y + (tileHeight / 2) * zoom);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}


function generateCoastline(gridWidth, roughness = 7) {  // Changed to use gridWidth
  // Start with different initial points for variation
  let points = [
    Math.floor(gridWidth * 0.25),  // Left side starting point
    Math.floor(gridWidth * 0.75)   // Right side starting point
  ];

  for (let i = 0; i < roughness; i++) {
    let newPoints = [];
    for (let j = 0; j < points.length - 1; j++) {
      let mid = Math.floor((points[j] + points[j + 1]) / 2);
      // Increase displacement range for more variation
      mid += Math.floor((rand() - 0.5) * gridWidth / (2.5 * (i + 1)));
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

  // Responsive canvas dimensions
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  // Zoom state
  const [zoom, setZoom] = useState(1);

  // set coastline to constant
  const [coastline] = useState(() => generateCoastline(gridWidth));
  const [riverPath] = useMemo(() => generateRiverPath(gridWidth, gridHeight, 123), []);

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

  // pull the water tile texture
  // const [tileImage, setTileImage] = useState(null);

  // useEffect(() => {
  //   const img = new window.Image();
  //   img.src = 'water.png';
  //   img.onload = () => setTileImage(img);
  // }, []);

  // Draw the grid and center it
  useEffect(() => {
    const { width, height } = dimensions;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, width, height);

    // Calculate grid's pixel size at current zoom
    const gridPixelWidth = (gridWidth + gridHeight) * (tileWidth / 2) * zoom;
    const gridPixelHeight = (gridWidth + gridHeight) * (tileHeight / 2) * zoom;

    // Center the grid in the canvas
    const offsetX = width / 2;
    const offsetY = height / 2 - gridPixelHeight / 2;

    // Proper coastline application
    for (let x = 0; x < gridWidth; x++) {
        // Get coastline Y for this X column (was using y before)
        const coastY = coastline[Math.floor(x * coastline.length / gridWidth)];
        const riverY = riverPath[Math.floor(x * riverPath.length / gridWidth)];
        
        for (let y = 0; y < gridHeight; y++) {
            const isWater = y >= coastY;
            const isWaterWithRiver = isWater >= riverY;
            const color = isWater ? "#3498db" : "#2ecc71"; // Changed land color for contrast
            // const color = isWaterWithRiver ? "#3498db" : "#2ecc71"; // Changed land color for contrast

            const screenX = (x - y) * (tileWidth / 2) * zoom + offsetX;
            const screenY = (x + y) * (tileHeight / 2) * zoom + offsetY;
            drawTile(ctx, screenX, screenY, color, zoom);
            // drawTile(ctx, screenX, screenY, color, tileImage, zoom);
        }
    }

    // Example: Draw a "building" tile in the center
    const bx = Math.floor(gridWidth / 2);
    const by = Math.floor(gridHeight / 2);
    const buildingX = ((bx - by) * (tileWidth / 2) * zoom) + offsetX;
    const buildingY = ((bx + by) * (tileHeight / 2) * zoom) + offsetY;
    drawTile(ctx, buildingX, buildingY, "#6cf", zoom);
  }, [dimensions, zoom]);

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
