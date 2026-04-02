import React, { createContext, useContext, useState, useRef, useEffect, useMemo, useCallback } from "react";
import { tileConfig, gridWidth, gridHeight } from './constants.js';
import { generateCoastline, generateElevationMap, generateRoads, flattenTerrainAtPoints, taperElevation } from './terrain.js';
import { getTileCornerHeights } from './rendering.js';
import { findRoadPath, assignRoadTypes } from './pathfinding.js';
import { buildingTypes, generateProceduralBuildingSprites, generateAllBuildingSprites, canPlaceBuilding, placeBuildingInMap, removeBuildingFromMap, autoFillBuildings, applyRainyFilter } from './buildings.js';

const CityContext = createContext(null);

export function useCityContext() {
  const ctx = useContext(CityContext);
  if (!ctx) throw new Error("useCityContext must be used within CityProvider");
  return ctx;
}

export function CityProvider({ debugMode = false, showWaterSurface = true, drawRoadsMode = false, destructionMode = false, placeBuildingsMode = false, selectedBuildingType = "house", resetRoadsRef = null, children }) {
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);

  // Shared mutable view ref for rAF loops to read without triggering re-renders
  const viewRef = useRef({ panX: 0, panY: 0, zoom: 1 });
  useEffect(() => { viewRef.current = { panX, panY, zoom }; }, [panX, panY, zoom]);
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

      // Apply rainy filter to all tile textures
      for (const [key, img] of Object.entries(loadedTextures)) {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const cctx = c.getContext('2d');
        cctx.drawImage(img, 0, 0);
        applyRainyFilter(c);
        loadedTextures[key] = c;
      }

      setTextures(loadedTextures);
    };

    loadTextures();
  }, []);

  // Generate coastline and elevation map (no roads initially)
  const [coastline] = useState(() => generateCoastline(gridWidth));
  const [baseElevation] = useState(() => generateElevationMap(gridWidth, gridHeight, coastline, 42));
  const [elevationMap, setElevationMap] = useState(baseElevation);
  const [roadSet, setRoadSet] = useState(() => new Map());

  // Building state
  const [buildingMap, setBuildingMap] = useState(() => new Map());
  const [buildingSprites, setBuildingSprites] = useState(() => generateProceduralBuildingSprites());

  // Load spritesheet-based building sprites asynchronously
  useEffect(() => {
    generateAllBuildingSprites().then(sprites => {
      setBuildingSprites(sprites);
    }).catch(err => {
      console.warn("Failed to load building spritesheets, keeping procedural sprites:", err);
    });
  }, []);

  // Road drawing state
  const [roadStartTile, setRoadStartTile] = useState(null);
  const [roadPreviewPath, setRoadPreviewPath] = useState(null);

  const placeRoad = useCallback((startX, startY, endX, endY) => {
    const path = findRoadPath(startX, startY, endX, endY, elevationMap, gridWidth, gridHeight);
    if (!path) return;

    // Deep copy elevation map
    const newElevation = elevationMap.map(row => [...row]);
    flattenTerrainAtPoints(newElevation, path, gridWidth, gridHeight);
    taperElevation(newElevation, gridWidth, gridHeight);

    const newRoads = assignRoadTypes(path, roadSet);

    setElevationMap(newElevation);
    setRoadSet(newRoads);
  }, [elevationMap, roadSet]);

  const placeBuilding = useCallback((x, y, typeName) => {
    if (!canPlaceBuilding(x, y, typeName, elevationMap, roadSet, buildingMap)) return false;
    const variant = Math.floor(Math.random() * 9);
    setBuildingMap(placeBuildingInMap(x, y, typeName, buildingMap, variant));
    return true;
  }, [elevationMap, roadSet, buildingMap]);

  const removeBuilding = useCallback((x, y) => {
    setBuildingMap(removeBuildingFromMap(x, y, buildingMap));
  }, [buildingMap]);

  const resetRoads = useCallback(() => {
    setElevationMap(baseElevation);
    setRoadSet(new Map());
    setBuildingMap(new Map());
    setRoadStartTile(null);
    setRoadPreviewPath(null);
  }, [baseElevation]);

  const drawRoadGrid = useCallback(() => {
    const newElevation = baseElevation.map(row => [...row]);
    const roads = generateRoads(gridWidth, gridHeight, newElevation);
    const newBuildings = autoFillBuildings(newElevation, roads, new Map());
    setElevationMap(newElevation);
    setRoadSet(roads);
    setBuildingMap(newBuildings);
    setRoadStartTile(null);
    setRoadPreviewPath(null);
  }, [baseElevation]);

  const destroyTile = useCallback((x, y) => {
    const newElevation = elevationMap.map(row => [...row]);
    newElevation[y][x] = baseElevation[y][x];
    taperElevation(newElevation, gridWidth, gridHeight);

    const newRoads = new Map(roadSet);
    newRoads.delete(`${x},${y}`);

    // Remove any building on this tile
    let newBuildings = buildingMap;
    if (buildingMap.has(`${x},${y}`)) {
      newBuildings = removeBuildingFromMap(x, y, buildingMap);
    }

    setElevationMap(newElevation);
    setRoadSet(newRoads);
    setBuildingMap(newBuildings);
  }, [elevationMap, baseElevation, roadSet, buildingMap]);

  const destroyTiles = useCallback((tileList) => {
    const newElevation = elevationMap.map(row => [...row]);
    const newRoads = new Map(roadSet);
    let newBuildings = buildingMap;
    for (const { x, y } of tileList) {
      newElevation[y][x] = baseElevation[y][x];
      newRoads.delete(`${x},${y}`);
      if (newBuildings.has(`${x},${y}`)) {
        newBuildings = removeBuildingFromMap(x, y, newBuildings);
      }
    }
    taperElevation(newElevation, gridWidth, gridHeight);
    setElevationMap(newElevation);
    setRoadSet(newRoads);
    setBuildingMap(newBuildings);
  }, [elevationMap, baseElevation, roadSet, buildingMap]);

  // Expose callbacks to parent via ref
  useEffect(() => {
    if (resetRoadsRef) {
      resetRoadsRef.current = { resetRoads, drawRoadGrid };
    }
  }, [resetRoadsRef, resetRoads, drawRoadGrid]);

  // Compute tiles and corner matrix from elevation map
  const { tiles, cornerMatrix } = useMemo(() => {
    const tiles = [];
    const cornerMatrix = Array(gridHeight).fill().map(() => Array(gridWidth).fill(null));

    for (let x = 0; x < gridWidth; x++) {
      for (let y = 0; y < gridHeight; y++) {
        const elevation = elevationMap[y][x];
        let visualType = elevation <= 0 ? "water" : "grass";
        const corners = getTileCornerHeights(elevationMap, x, y);
        const roadType = roadSet.get(`${x},${y}`);
        if (visualType === "grass" && roadType) {
          // Only place road if no cross-slope (slope perpendicular to road direction)
          // road (along y): enters N-E edge, exits W-S edge. Cross-slope if N≠E or W≠S
          // road_cross (along x): enters N-W edge, exits E-S edge. Cross-slope if N≠W or E≠S
          const hasCrossSlope =
            roadType === "road" ? (corners.n !== corners.e || corners.w !== corners.s) :
            roadType === "road_cross" ? (corners.n !== corners.w || corners.e !== corners.s) :
            (corners.n !== corners.e || corners.w !== corners.s || corners.n !== corners.w || corners.e !== corners.s);

          if (!hasCrossSlope) {
            visualType = roadType;
          }
        }

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
  }, [elevationMap, roadSet]);

  const value = {
    dimensions,
    zoom,
    setZoom,
    panX,
    setPanX,
    panY,
    setPanY,
    viewRef,
    textures,
    coastline,
    elevationMap,
    tiles,
    cornerMatrix,
    hoveredTile,
    setHoveredTile,
    debugMode,
    showWaterSurface,
    drawRoadsMode,
    destructionMode,
    destroyTile,
    destroyTiles,
    roadStartTile,
    setRoadStartTile,
    roadPreviewPath,
    setRoadPreviewPath,
    placeRoad,
    resetRoads,
    roadSet,
    buildingMap,
    buildingSprites,
    placeBuilding,
    removeBuilding,
    placeBuildingsMode,
    selectedBuildingType,
  };

  return <CityContext.Provider value={value}>{children}</CityContext.Provider>;
}
