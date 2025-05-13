import React, { useRef } from "react";
import RainCanvas from "./RainCanvas";

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
    <div className="relative w-full h-full bg-gray-900">
      <RainCanvas />
      <audio ref={rainRef} src="/sounds/rain.mp3" loop />
      <audio ref={cityRef} src="/sounds/city.mp3" loop />
      <div className="absolute top-4 left-4 z-10">
        <button onClick={playSounds} className="mr-2 px-4 py-2 bg-blue-700 text-white rounded">Play</button>
        <button onClick={pauseSounds} className="px-4 py-2 bg-gray-700 text-white rounded">Pause</button>
        <div className="mt-2">
          <label>Rain Volume</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            defaultValue="0.7"
            onChange={e => (rainRef.current.volume = e.target.value)}
          />
        </div>
        <div className="mt-2">
          <label>City Volume</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            defaultValue="0.5"
            onChange={e => (cityRef.current.volume = e.target.value)}
          />
        </div>
      </div>
    </div>
  );
};

export default App;
