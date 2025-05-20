import React, { useRef, useState } from "react";
import RainCanvas from "./RainCanvas";
import IsometricCity from "./CityCanvas";


const DraggableWindow = ({ children, initialPosition = { x: 100, y: 100 } }) => {
  const [position, setPosition] = useState(initialPosition);
  const [dragging, setDragging] = useState(false);
  const [rel, setRel] = useState({ x: 0, y: 0 });

  const onMouseDown = (e) => {
    setDragging(true);
    setRel({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
    e.preventDefault();
  };

  const onMouseUp = () => setDragging(false);

  const onMouseMove = (e) => {
    if (!dragging) return;
    setPosition({
      x: e.clientX - rel.x,
      y: e.clientY - rel.y,
    });
  };

  React.useEffect(() => {
    if (dragging) {
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    } else {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
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
      >
        Audio Controls
      </div>
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  );
};

const App = () => {
  const rainRef = useRef(null);
  const cityRef = useRef(null);

  const playSounds = () => {
    rainRef.current.play();
    cityRef.current.play();
  };

  const pauseSounds = () => {
    rainRef.current.pause();
    cityRef.current.pause();
  };

  return (
    <div className="relative w-full h-full bg-gray-900 min-h-screen">
      <IsometricCity />
      <RainCanvas />

      <audio ref={rainRef} src="/rain.mp3" loop />
      <audio ref={cityRef} src="/city.mp3" loop />

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
      </DraggableWindow>
    </div>
  );
};

export default App;
