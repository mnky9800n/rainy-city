import React, { useRef, useState, useCallback } from "react";
import RainCanvas from "./RainCanvas";
import CityRenderer from "./city/CityRenderer";


const DraggableWindow = ({ children, initialPosition = { x: 100, y: 100 } }) => {
  const [position, setPosition] = useState(initialPosition);
  const [dragging, setDragging] = useState(false);
  const [rel, setRel] = useState({ x: 0, y: 0 });

  const onStart = (clientX, clientY) => {
    setDragging(true);
    setRel({ x: clientX - position.x, y: clientY - position.y });
  };

  const onMouseDown = (e) => { onStart(e.clientX, e.clientY); e.preventDefault(); };
  const onTouchStart = (e) => { onStart(e.touches[0].clientX, e.touches[0].clientY); e.preventDefault(); };

  const onMouseUp = () => setDragging(false);

  const onMouseMove = (e) => {
    if (!dragging) return;
    setPosition({ x: e.clientX - rel.x, y: e.clientY - rel.y });
  };

  const onTouchMove = (e) => {
    if (!dragging) return;
    setPosition({ x: e.touches[0].clientX - rel.x, y: e.touches[0].clientY - rel.y });
  };

  React.useEffect(() => {
    if (dragging) {
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
      window.addEventListener("touchmove", onTouchMove, { passive: false });
      window.addEventListener("touchend", onMouseUp);
    } else {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onMouseUp);
    };
  });

  return (
    <div
      style={{
        position: "fixed",
        left: position.x,
        top: position.y,
        zIndex: 9999,
        background: "rgba(0,0,0,0.8)",
        color: "#fff",
        borderRadius: "8px",
        boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
        minWidth: 250,
        userSelect: "none",
      }}
    >
      <div
        style={{
          cursor: "move",
          padding: "8px 12px",
          background: "#222",
          borderTopLeftRadius: "8px",
          borderTopRightRadius: "8px",
          fontWeight: "bold",
        }}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
      >
        Rainy City
      </div>
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  );
};

const App = () => {
  const rainRef = useRef(null);
  const cityRef = useRef(null);
  const thunderRef = useRef(null);
  const [debugMode, setDebugMode] = useState(false);
  const [showDebugTools, setShowDebugTools] = useState(false);
  const [showSeafloor, setShowSeafloor] = useState(true);
  const [showWaterSurface, setShowWaterSurface] = useState(true);
  const [showTerrain, setShowTerrain] = useState(true);
  const [showDebugLayer, setShowDebugLayer] = useState(true);
  const [showRoads, setShowRoads] = useState(true);
  const [showRain, setShowRain] = useState(true);
  const [drawRoadsMode, setDrawRoadsMode] = useState(false);
  const [destructionMode, setDestructionMode] = useState(false);
  const [placeBuildingsMode, setPlaceBuildingsMode] = useState(false);
  const [selectedBuildingType, setSelectedBuildingType] = useState("house");
  const resetRoadsRef = useRef(null);

  const playSounds = () => {
    rainRef.current.play();
    cityRef.current.play();
  };

  const pauseSounds = () => {
    rainRef.current.pause();
    cityRef.current.pause();
  };

  const handleLoaded = useCallback(() => {
    // Autoplay rain and city sounds
    rainRef.current.volume = 0.7;
    cityRef.current.volume = 0.5;
    rainRef.current.play().catch(() => {});
    cityRef.current.play().catch(() => {});
    // Thunder crack on fade-in
    thunderRef.current.volume = 0.8;
    thunderRef.current.play().catch(() => {});
  }, []);

  return (
    <div className="relative w-full h-full bg-gray-900 min-h-screen">
      <CityRenderer
        debugMode={debugMode}
        showSeafloor={showSeafloor}
        showWaterSurface={showWaterSurface}
        showTerrain={showTerrain}
        showRoads={showRoads}
        showDebugLayer={showDebugLayer}
        drawRoadsMode={drawRoadsMode}
        destructionMode={destructionMode}
        placeBuildingsMode={placeBuildingsMode}
        selectedBuildingType={selectedBuildingType}
        resetRoadsRef={resetRoadsRef}
        onLoaded={handleLoaded}
      />
      {showRain && <RainCanvas />}

      <audio ref={rainRef} src="./rain.mp3" loop />
      <audio ref={cityRef} src="./city.mp3" loop />
      <audio ref={thunderRef} src="./thunder.mp3" />

      <DraggableWindow>
        <div className="mb-2 flex gap-2">
          <button
            onClick={playSounds}
            className="px-4 py-2 bg-blue-700 text-white rounded"
          >
            Play
          </button>
          <button
            onClick={pauseSounds}
            className="px-4 py-2 bg-gray-700 text-white rounded"
          >
            Pause
          </button>
        </div>
        <div className="mb-2 w-full">
          <label className="block text-white text-sm mb-1">Rain Volume</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            defaultValue="0.7"
            onChange={e => (rainRef.current.volume = e.target.value)}
            className="w-full"
          />
        </div>
        <div className="w-full">
          <label className="block text-white text-sm mb-1">City Volume</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            defaultValue="0.5"
            onChange={e => (cityRef.current.volume = e.target.value)}
            className="w-full"
          />
        </div>
        
        <div className="mt-4 pt-4 border-t border-gray-600">
          <label className="flex items-center gap-2 text-white text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={showDebugTools}
              onChange={() => setShowDebugTools(!showDebugTools)}
            />
            Debug Tools
          </label>
          {showDebugTools && (
            <div style={{ marginLeft: 20, marginTop: 8, color: "#fff", fontSize: 14 }}>
              <label><input type="checkbox" checked={debugMode} onChange={() => setDebugMode(!debugMode)} /> Get Coordinates</label><br />
              <label><input type="checkbox" checked={showSeafloor} onChange={() => setShowSeafloor(!showSeafloor)} /> Seafloor</label><br />
              <label><input type="checkbox" checked={showWaterSurface} onChange={() => setShowWaterSurface(!showWaterSurface)} /> Water Surface</label><br />
              <label><input type="checkbox" checked={showTerrain} onChange={() => setShowTerrain(!showTerrain)} /> Terrain</label><br />
              <label><input type="checkbox" checked={showRoads} onChange={() => setShowRoads(!showRoads)} /> Roads</label><br />
              <label><input type="checkbox" checked={showDebugLayer} onChange={() => setShowDebugLayer(!showDebugLayer)} /> Debug Layer</label><br />
              <label><input type="checkbox" checked={showRain} onChange={() => setShowRain(!showRain)} /> Show Rain</label><br />
              <label><input type="checkbox" checked={drawRoadsMode} onChange={() => { setDrawRoadsMode(!drawRoadsMode); if (!drawRoadsMode) { setDestructionMode(false); setPlaceBuildingsMode(false); } }} /> Draw Roads</label><br />
              <label><input type="checkbox" checked={placeBuildingsMode} onChange={() => { setPlaceBuildingsMode(!placeBuildingsMode); if (!placeBuildingsMode) { setDrawRoadsMode(false); setDestructionMode(false); } }} /> Place Buildings</label>
              {placeBuildingsMode && (
                <select
                  value={selectedBuildingType}
                  onChange={e => setSelectedBuildingType(e.target.value)}
                  style={{ marginLeft: 8, fontSize: 12, background: '#444', color: '#fff', border: '1px solid #666', borderRadius: 4, padding: '2px 4px' }}
                >
                  <option value="house">House (1x1)</option>
                  <option value="shop">Shop (1x1)</option>
                  <option value="commercial">Commercial (2x2)</option>
                  <option value="apartment">Apartment (2x2)</option>
                  <option value="skyscraper">Skyscraper (2x2)</option>
                </select>
              )}<br />
              <label><input type="checkbox" checked={destructionMode} onChange={() => { setDestructionMode(!destructionMode); if (!destructionMode) { setDrawRoadsMode(false); setPlaceBuildingsMode(false); } }} /> Destruction</label>
              <div style={{ marginTop: 4, marginLeft: 20, display: 'flex', gap: 4 }}>
                <button
                  onClick={() => resetRoadsRef.current?.drawRoadGrid()}
                  style={{ padding: '2px 8px', fontSize: 12, background: '#556b2f', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                >
                  Build City
                </button>
                <button
                  onClick={() => resetRoadsRef.current?.resetRoads()}
                  style={{ padding: '2px 8px', fontSize: 12, background: '#555', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                >
                  Reset Roads
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 pt-4 border-t border-gray-600" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <a href="https://github.com/mnky9800n/rainy-city" target="_blank" rel="noopener noreferrer" title="GitHub Repo">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
          </a>
          <a href="https://johnspace.xyz" target="_blank" rel="noopener noreferrer" title="johnspace.xyz">
            <img src="./johnspace-icon.png" alt="johnspace" style={{ width: 24, height: 24, borderRadius: 4 }} />
          </a>
          <a href="https://www.recurse.com/scout/click?t=b58615edb1a9f39bd1da060941fc2656" target="_blank" rel="noopener noreferrer" title="Recurse Center">
            <img src="./rc.png" alt="Join the Recurse Center" style={{ width: 24, height: 24 }} />
          </a>
        </div>
      </DraggableWindow>
    </div>
  );
};

export default App;
