import React, { useRef, useState, useCallback } from "react";
import RainCanvas from "./RainCanvas";
import CityRenderer from "./city/CityRenderer";
import DraggableWindow from "./ui/DraggableWindow.jsx";
import ExplorerWindow from "./ui/ExplorerWindow.jsx";
import { buildingCatalog } from "./data/buildingCatalog.js";
import { characterCatalog } from "./data/characterCatalog.js";


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
  const [controlPanelOpen, setControlPanelOpen] = useState(
    () => typeof window === "undefined" || window.innerWidth > 768
  );
  const [buildingsOpen, setBuildingsOpen] = useState(false);
  const [charactersOpen, setCharactersOpen] = useState(false);
  const resetRoadsRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);

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
    <div>
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

      <audio
        ref={rainRef}
        src="./rain.mp3"
        loop
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />
      <audio ref={cityRef} src="./city.mp3" loop />
      <audio ref={thunderRef} src="./thunder.mp3" />

      {controlPanelOpen && (
        <DraggableWindow
          title="Control Panel"
          onClose={() => setControlPanelOpen(false)}
        >
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <button
              className={"os9-button default" + (isPlaying ? " active" : "")}
              onClick={playSounds}
            >
              Play
            </button>
            <button
              className={"os9-button" + (!isPlaying ? " active" : "")}
              onClick={pauseSounds}
            >
              Pause
            </button>
          </div>

          <label className="os9-label">Rain Volume</label>
          <input
            type="range"
            className="os9-slider"
            min="0"
            max="1"
            step="0.01"
            defaultValue="0.7"
            onChange={(e) => (rainRef.current.volume = e.target.value)}
          />

          <label className="os9-label">City Volume</label>
          <input
            type="range"
            className="os9-slider"
            min="0"
            max="1"
            step="0.01"
            defaultValue="0.5"
            onChange={(e) => (cityRef.current.volume = e.target.value)}
          />

          <div className="os9-divider" />

          <label className="os9-checkbox-label">
            <input
              type="checkbox"
              className="os9-checkbox"
              checked={showDebugTools}
              onChange={() => setShowDebugTools(!showDebugTools)}
            />
            Debug Tools
          </label>

          {showDebugTools && (
            <div style={{ marginLeft: 16, marginTop: 6, display: "flex", flexDirection: "column", gap: 3 }}>
              <label className="os9-checkbox-label"><input type="checkbox" className="os9-checkbox" checked={debugMode} onChange={() => setDebugMode(!debugMode)} />Get Coordinates</label>
              <label className="os9-checkbox-label"><input type="checkbox" className="os9-checkbox" checked={showSeafloor} onChange={() => setShowSeafloor(!showSeafloor)} />Seafloor</label>
              <label className="os9-checkbox-label"><input type="checkbox" className="os9-checkbox" checked={showWaterSurface} onChange={() => setShowWaterSurface(!showWaterSurface)} />Water Surface</label>
              <label className="os9-checkbox-label"><input type="checkbox" className="os9-checkbox" checked={showTerrain} onChange={() => setShowTerrain(!showTerrain)} />Terrain</label>
              <label className="os9-checkbox-label"><input type="checkbox" className="os9-checkbox" checked={showRoads} onChange={() => setShowRoads(!showRoads)} />Roads</label>
              <label className="os9-checkbox-label"><input type="checkbox" className="os9-checkbox" checked={showDebugLayer} onChange={() => setShowDebugLayer(!showDebugLayer)} />Debug Layer</label>
              <label className="os9-checkbox-label"><input type="checkbox" className="os9-checkbox" checked={showRain} onChange={() => setShowRain(!showRain)} />Show Rain</label>
              <label className="os9-checkbox-label">
                <input
                  type="checkbox"
                  className="os9-checkbox"
                  checked={drawRoadsMode}
                  onChange={() => {
                    setDrawRoadsMode(!drawRoadsMode);
                    if (!drawRoadsMode) { setDestructionMode(false); setPlaceBuildingsMode(false); }
                  }}
                />
                Draw Roads
              </label>

              <label className="os9-checkbox-label" style={{ alignItems: "center" }}>
                <input
                  type="checkbox"
                  className="os9-checkbox"
                  checked={placeBuildingsMode}
                  onChange={() => {
                    setPlaceBuildingsMode(!placeBuildingsMode);
                    if (!placeBuildingsMode) { setDrawRoadsMode(false); setDestructionMode(false); }
                  }}
                />
                Place Buildings
                {placeBuildingsMode && (
                  <select
                    className="os9-select"
                    value={selectedBuildingType}
                    onChange={(e) => setSelectedBuildingType(e.target.value)}
                    style={{ marginLeft: 8 }}
                  >
                    <option value="house">House (1x1)</option>
                    <option value="shop">Shop (1x1)</option>
                    <option value="commercial">Commercial (2x2)</option>
                    <option value="apartment">Apartment (2x2)</option>
                    <option value="skyscraper">Skyscraper (2x2)</option>
                    <option value="radio_tower">Radio Tower (4x4)</option>
                    <option value="nyt_tower">Low Impact Fruit Tower (3x3)</option>
                    <option value="cinema">Star Cinema (3x3)</option>
                    <option value="library">Public Library (4x4)</option>
                  </select>
                )}
              </label>

              <label className="os9-checkbox-label">
                <input
                  type="checkbox"
                  className="os9-checkbox"
                  checked={destructionMode}
                  onChange={() => {
                    setDestructionMode(!destructionMode);
                    if (!destructionMode) { setDrawRoadsMode(false); setPlaceBuildingsMode(false); }
                  }}
                />
                Destruction
              </label>

              <div style={{ marginTop: 6, marginLeft: 16, display: "flex", gap: 6 }}>
                <button className="os9-button" onClick={() => resetRoadsRef.current?.drawRoadGrid()}>Build City</button>
                <button className="os9-button" onClick={() => resetRoadsRef.current?.resetRoads()}>Reset Roads</button>
              </div>
            </div>
          )}

          <div className="os9-divider" />

          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 6 }}>
            <a className="os9-icon-button" href="https://github.com/mnky9800n/rainy-city" target="_blank" rel="noopener noreferrer" title="GitHub Repo">
              <svg viewBox="0 0 24 24" fill="#000"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" /></svg>
            </a>
            <a className="os9-icon-button" href="https://johnspace.xyz" target="_blank" rel="noopener noreferrer" title="johnspace.xyz">
              <img src="./johnspace-icon.png" alt="johnspace" />
            </a>
            <a className="os9-icon-button" href="https://www.recurse.com/scout/click?t=b58615edb1a9f39bd1da060941fc2656" target="_blank" rel="noopener noreferrer" title="Recurse Center">
              <img src="./rc.png" alt="Join the Recurse Center" />
            </a>
            <a className="os9-icon-button" href="https://rcade.dev/games/streets-of-rainy-city" target="_blank" rel="noopener noreferrer" title="Streets of Rainy City">
              <img src="./streets.png" alt="Streets of Rainy City" />
            </a>
            <a className="os9-icon-button" href="https://www.lowimpactfruit.com/p/rainy-citycom-a-side-project-i-have" target="_blank" rel="noopener noreferrer" title="Low Impact Fruit: rainy-city.com">
              <img src="./banana.png" alt="Low Impact Fruit" />
            </a>
          </div>
        </DraggableWindow>
      )}

      {buildingsOpen && (
        <ExplorerWindow
          title="Buildings"
          entries={buildingCatalog}
          initialPosition={{ x: 150, y: 90 }}
          onClose={() => setBuildingsOpen(false)}
        />
      )}

      {charactersOpen && (
        <ExplorerWindow
          title="Characters"
          entries={characterCatalog}
          initialPosition={{ x: 210, y: 130 }}
          onClose={() => setCharactersOpen(false)}
        />
      )}

      {/* Each icon hides while its window is open, so the column never grows
          past the three things you can actually open. */}
      <div className="os9-desktop-icons">
        {!controlPanelOpen && (
          <div
            className="os9-desktop-icon"
            onClick={() => setControlPanelOpen(true)}
            title="Open Control Panel"
          >
            <div className="icon-glyph">⚙</div>
            <div>Control<br />Panel</div>
          </div>
        )}
        {!buildingsOpen && (
          <div
            className="os9-desktop-icon"
            onClick={() => setBuildingsOpen(true)}
            title="Open Buildings"
          >
            <div className="icon-glyph">▤</div>
            <div>Buildings</div>
          </div>
        )}
        {!charactersOpen && (
          <div
            className="os9-desktop-icon"
            onClick={() => setCharactersOpen(true)}
            title="Open Characters"
          >
            <div className="icon-glyph">☺</div>
            <div>Characters</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
