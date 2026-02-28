import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { tileConfig, gridWidth, gridHeight } from './constants.js';
import { generateCoastline, generateElevationMap } from './terrain.js';
import { getTileCornerHeights } from './rendering.js';

const CityContext = createContext(null);

export function useCityContext() {
  const ctx = useContext(CityContext);
  if (!ctx) throw new Error("useCityContext must be used within CityProvider");
  return ctx;
}

export function CityProvider({ debugMode = false, children }) {
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const [zoom, setZoom] = useState(1);
  const [textures, setTextures] = useState({});
  const [hoveredTile, setHoveredTile] = useState(null);

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
              resolve();
            };
            img.src = cfg.texture;
          });
        }
      }));

      setTextures(loadedTextures);
    };

    loadTextures();
  }, []);

  // Generate coastline and elevation map once
  const [coastline] = useState(() => generateCoastline(gridWidth));
  const [elevationMap] = useState(() => generateElevationMap(gridWidth, gridHeight, coastline, 42));

  // Compute tiles and corner matrix from elevation map
  const { tiles, cornerMatrix } = useMemo(() => {
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
      return b.elevation - a.elevation;
    });

    return { tiles, cornerMatrix };
  }, [elevationMap]);

  const value = {
    dimensions,
    zoom,
    setZoom,
    textures,
    coastline,
    elevationMap,
    tiles,
    cornerMatrix,
    hoveredTile,
    setHoveredTile,
    debugMode,
  };

  return <CityContext.Provider value={value}>{children}</CityContext.Provider>;
}
