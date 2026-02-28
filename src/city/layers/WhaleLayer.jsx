import React, { useRef, useEffect } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { useCityContext } from '../CityContext.jsx';
import { getOffsets } from '../isometric.js';
import { tileWidth, tileHeight, elevationScale, gridWidth, gridHeight } from '../constants.js';

function isWater(elevationMap, x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  if (ix < 0 || ix >= gridWidth || iy < 0 || iy >= gridHeight) return false;
  return elevationMap[iy][ix] <= 0;
}

// Check that all tiles within `margin` distance are also water
function isDeepWater(elevationMap, x, y, margin) {
  for (let dy = -margin; dy <= margin; dy++) {
    for (let dx = -margin; dx <= margin; dx++) {
      if (!isWater(elevationMap, x + dx, y + dy)) return false;
    }
  }
  return true;
}

function getWaterCenter(elevationMap) {
  let cx = 0, cy = 0, count = 0;
  for (let y = 0; y < elevationMap.length; y++) {
    for (let x = 0; x < elevationMap[y].length; x++) {
      if (elevationMap[y][x] <= 0) { cx += x; cy += y; count++; }
    }
  }
  if (count === 0) return { x: gridWidth / 2, y: gridHeight / 2 };
  return { x: cx / count, y: cy / count };
}

function initWhaleInWater(elevationMap) {
  // Try to spawn in deep water first (at least 5 tiles from coast)
  for (let attempt = 0; attempt < 200; attempt++) {
    const x = Math.random() * gridWidth;
    const y = Math.random() * gridHeight;
    if (isDeepWater(elevationMap, x, y, 5)) return { x, y };
  }
  // Fallback: any water
  for (let attempt = 0; attempt < 200; attempt++) {
    const x = Math.random() * gridWidth;
    const y = Math.random() * gridHeight;
    if (isWater(elevationMap, x, y)) return { x, y };
  }
  return getWaterCenter(elevationMap);
}

const clamp = (num, min, max) => Math.min(Math.max(num, min), max);

const WhaleLayer = ({ onWhaleClick }) => {
  const containerRef = useRef(null);
  const { dimensions, zoom, panX, panY, elevationMap } = useCityContext();

  // Refs so the animation loop always has current values
  const viewRef = useRef({ dimensions, zoom, panX, panY });
  useEffect(() => { viewRef.current = { dimensions, zoom, panX, panY }; }, [dimensions, zoom, panX, panY]);

  const elevationRef = useRef(elevationMap);
  useEffect(() => { elevationRef.current = elevationMap; }, [elevationMap]);

  const onWhaleClickRef = useRef(onWhaleClick);
  useEffect(() => { onWhaleClickRef.current = onWhaleClick; }, [onWhaleClick]);

  const threeRef = useRef(null);
  const whaleStateRef = useRef(null);

  // Initialize whale swimming state
  useEffect(() => {
    if (!elevationMap || elevationMap.length === 0) return;
    if (whaleStateRef.current) return;
    const center = getWaterCenter(elevationMap);
    // Spawn the first whale, then cluster the rest nearby
    const leader = initWhaleInWater(elevationMap);
    // Head northwest (tile -X direction) with slight variation
    const leaderAngle = Math.PI + (Math.random() - 0.5) * 0.4;
    const whales = [];
    for (let i = 0; i < 5; i++) {
      let wx, wy;
      if (i === 0) {
        wx = leader.x;
        wy = leader.y;
      } else {
        // Spawn within 3-6 tiles of the leader
        for (let attempt = 0; attempt < 100; attempt++) {
          const offX = (Math.random() - 0.5) * 10;
          const offY = (Math.random() - 0.5) * 10;
          wx = leader.x + offX;
          wy = leader.y + offY;
          if (isWater(elevationMap, wx, wy)) break;
        }
      }
      whales.push({
        x: wx, y: wy,
        angle: leaderAngle + (Math.random() - 0.5) * 0.5, // similar heading
        speed: 0.1 + Math.random() * 0.1,
        size: 0.8 + Math.random() * 0.4,
        phase: Math.random() * Math.PI * 2,
        // Blow state
        blowTimer: 10 + Math.random() * 20, // seconds until next blow
        blowing: false,
        blowElapsed: 0,
        blowDuration: 2.5, // seconds the blow lasts
        blowParticles: [], // active spray particles
      });
    }
    whaleStateRef.current = { whales, center };
  }, [elevationMap]);

  // Three.js setup + animation loop (runs once)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // --- Scene setup ---
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1000, 1000);
    camera.position.set(0, 0, 100);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, premultipliedAlpha: false });
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    // Sprite texture for particles
    const spriteCanvas = document.createElement('canvas');
    spriteCanvas.width = 32;
    spriteCanvas.height = 32;
    const sctx = spriteCanvas.getContext('2d');
    const grad = sctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.8)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, 32, 32);
    const sprite = new THREE.CanvasTexture(spriteCanvas);
    sprite.colorSpace = THREE.SRGBColorSpace;

    const state = {
      scene, camera, renderer, sprite,
      whaleGroups: [],
      loaded: false,
    };
    threeRef.current = state;

    // Load whale GLB
    const loader = new GLTFLoader();
    loader.load(
      "https://assets.codepen.io/10590426/Whale+Poly.glb",
      (gltf) => {
        if (!threeRef.current) return;

        const sourceGeometries = [];
        gltf.scene.traverse((child) => {
          if (child.geometry) sourceGeometries.push(child.geometry.clone());
        });
        if (sourceGeometries.length === 0) return;

        for (let i = 0; i < 5; i++) {
          const group = new THREE.Group();
          const geoData = []; // { obj, basePositions }

          for (const geom of sourceGeometries) {
            const geometry = geom.clone();
            const basePositions = new Float32Array(geometry.attributes.position.array);

            // Filled mesh — slate grey, solid
            const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
              color: 0x708090, side: THREE.DoubleSide, depthTest: false,
            }));

            // Wireframe — light grey
            const wfGeom = new THREE.WireframeGeometry(geometry);
            const wireframe = new THREE.LineSegments(wfGeom, new THREE.LineBasicMaterial({
              color: 0x9aaabb,
              transparent: true, opacity: 0.04, depthTest: false,
            }));

            // Particles — grey tones
            const points = new THREE.Points(geometry, new THREE.PointsMaterial({
              size: 0.6, alphaTest: 0.5, transparent: true,
              map: sprite, vertexColors: true, depthTest: false,
            }));

            group.add(mesh);
            group.add(wireframe);
            group.add(points);

            geoData.push({ obj: mesh, basePositions: new Float32Array(basePositions) });
            geoData.push({ obj: points, basePositions: new Float32Array(basePositions) });
            // wireframe doesn't need wave animation
          }

          // Blow spout particles — rendered in screen space (not child of whale group)
          const sprayGeom = new THREE.BufferGeometry();
          sprayGeom.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(300), 3)); // max 100 particles
          const sprayPoints = new THREE.Points(sprayGeom, new THREE.PointsMaterial({
            color: 0xddeeff, size: 3, transparent: true, opacity: 0.7,
            map: sprite, blending: THREE.NormalBlending, depthTest: false,
          }));
          sprayPoints.frustumCulled = false;
          scene.add(sprayPoints);

          scene.add(group);
          state.whaleGroups.push({ group, geoData, sprayPoints });
        }

        state.loaded = true;
      }
    );

    // --- Animation loop ---
    let rafId;
    let elapsed = 0;
    let lastTime = null;

    const tick = (timestamp) => {
      rafId = requestAnimationFrame(tick);

      if (!threeRef.current || !threeRef.current.loaded) return;
      const ws = whaleStateRef.current;
      const em = elevationRef.current;
      if (!ws || !em) return;

      // Timing
      if (lastTime == null) lastTime = timestamp;
      const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
      lastTime = timestamp;
      elapsed += dt * 0.5;

      // Current view
      const { dimensions: dim, zoom: z, panX: px, panY: py } = viewRef.current;
      const { offsetX, offsetY } = getOffsets(dim, z, px, py);
      const seaLevelOffset = -0.35 * elevationScale * z;

      // Update camera frustum to match screen
      const halfW = dim.width / 2;
      const halfH = dim.height / 2;
      camera.left = -halfW;
      camera.right = halfW;
      camera.top = halfH;
      camera.bottom = -halfH;
      camera.updateProjectionMatrix();

      // Update renderer size if needed
      if (renderer.domElement.width !== dim.width || renderer.domElement.height !== dim.height) {
        renderer.setSize(dim.width, dim.height);
      }

      const { whaleGroups } = threeRef.current;

      // Compute pod center (average position of all whales)
      let podCx = 0, podCy = 0;
      for (const w of ws.whales) { podCx += w.x; podCy += w.y; }
      podCx /= ws.whales.length;
      podCy /= ws.whales.length;

      for (let i = 0; i < ws.whales.length && i < whaleGroups.length; i++) {
        const whale = ws.whales[i];
        const { group, geoData } = whaleGroups[i];

        // --- Movement ---
        whale.x += Math.cos(whale.angle) * whale.speed * dt;
        whale.y += Math.sin(whale.angle) * whale.speed * dt;

        const drift = Math.sin(elapsed + whale.phase) * 0.02 * dt;
        whale.x += Math.cos(whale.angle + Math.PI / 2) * drift;
        whale.y += Math.sin(whale.angle + Math.PI / 2) * drift;

        // Coast avoidance — steer away earlier (check 4-10 tiles ahead)
        // and treat shallow water (near coast) as a boundary too
        let needsSteer = false;
        for (let d = 3; d <= 10; d += 1) {
          const ax = whale.x + Math.cos(whale.angle) * d;
          const ay = whale.y + Math.sin(whale.angle) * d;
          if (!isDeepWater(em, ax, ay, 3)) {
            needsSteer = true;
            break;
          }
        }
        if (needsSteer) {
          const toCenter = Math.atan2(ws.center.y - whale.y, ws.center.x - whale.x);
          let diff = toCenter - whale.angle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          whale.angle += diff * 3.0 * dt;
        }

        // Pod cohesion — gently steer toward the pod center if too far away
        const distToPod = Math.sqrt((whale.x - podCx) ** 2 + (whale.y - podCy) ** 2);
        const podRadius = 8; // max desired distance from pod center
        if (distToPod > podRadius) {
          const toPod = Math.atan2(podCy - whale.y, podCx - whale.x);
          let diff = toPod - whale.angle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          // Stronger pull the farther away
          const pullStrength = clamp((distToPod - podRadius) / podRadius, 0, 1);
          whale.angle += diff * pullStrength * 1.5 * dt;
        }

        whale.angle += (Math.random() - 0.5) * 0.1 * dt;

        // If somehow on land, teleport back to deep water
        if (!isWater(em, whale.x, whale.y)) {
          const pos = initWhaleInWater(em);
          whale.x = pos.x;
          whale.y = pos.y;
          whale.angle = Math.atan2(ws.center.y - whale.y, ws.center.x - whale.x);
        }

        // --- Blow (spout) behavior ---
        whale.blowTimer -= dt;
        if (!whale.blowing && whale.blowTimer <= 0) {
          // Start a blow
          whale.blowing = true;
          whale.blowElapsed = 0;
          whale.blowParticles = [];
        }

        if (whale.blowing) {
          whale.blowElapsed += dt;

          // Spawn spray particles during the first half of the blow
          if (whale.blowElapsed < whale.blowDuration * 0.4) {
            for (let p = 0; p < 2; p++) {
              whale.blowParticles.push({
                // Offset from whale head in tile space (small random spread)
                ox: (Math.random() - 0.5) * 0.3,
                oy: (Math.random() - 0.5) * 0.3,
                vx: (Math.random() - 0.5) * 0.4,
                vy: -1.5 - Math.random() * 1.0, // spray upward (screen -Y = Three.js +Y)
                life: 0,
                maxLife: 0.8 + Math.random() * 0.6,
                size: 1.5 + Math.random() * 2,
              });
            }
          }

          // Update particles
          for (const p of whale.blowParticles) {
            p.life += dt;
            p.ox += p.vx * dt;
            p.oy += p.vy * dt;
            p.vy += 0.8 * dt; // gravity pulls spray back down
            p.vx *= 0.98; // air resistance
          }

          // Remove dead particles
          whale.blowParticles = whale.blowParticles.filter(p => p.life < p.maxLife);

          // End blow
          if (whale.blowElapsed >= whale.blowDuration && whale.blowParticles.length === 0) {
            whale.blowing = false;
            whale.blowTimer = 15 + Math.random() * 25; // next blow in 15-40 seconds
          }
        }

        // --- Position: tile coords -> isometric screen coords -> Three.js coords ---
        // Isometric screen position (same formula as TerrainLayer)
        const screenX = (whale.x - whale.y) * (tileWidth / 2) * z + offsetX;
        const screenY = (whale.x + whale.y) * (tileHeight / 2) * z + offsetY + seaLevelOffset;

        // Three.js orthographic: origin at screen center, Y is up
        const tx = screenX - halfW;
        const ty = halfH - screenY; // flip Y

        group.position.set(tx, ty, 0);

        // Scale: whale model is ~36 units long along Z.
        // At zoom=1, one tile = 64px wide. Whale should be ~2 tiles long = ~128px.
        // 128 / 36 ≈ 3.5
        const s = z * whale.size * 3.5;
        group.scale.set(s, s, s);

        // Rotation: whale model has body along Z, height along Y.
        // We use quaternions to apply rotations in world space:
        // 1) Tilt: rotate π/2 around X so back faces camera, nose points -Y
        // 2) Heading: rotate around world Z (screen normal) to aim the nose
        //
        // Convert tile heading to screen heading (isometric projection)
        const dx = Math.cos(whale.angle);
        const dy = Math.sin(whale.angle);
        const sxDir = (dx - dy); // screen X component
        const syDir = -(dx + dy) * 0.5; // screen Y component (flipped, squashed)
        const screenAngle = Math.atan2(syDir, sxDir);

        // After tilt, nose is at -Y (270°). To aim at screenAngle, rotate by:
        const headingRotation = screenAngle + Math.PI / 2;

        const qTilt = new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(1, 0, 0), Math.PI / 2
        );
        const qHeading = new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 0, 1), headingRotation
        );
        // Apply tilt first (model space), then heading (world space)
        group.quaternion.copy(qHeading).multiply(qTilt);

        // --- Wave vertex animation ---
        for (const { obj, basePositions } of geoData) {
          const positions = obj.geometry.attributes.position.array;
          const colors = [];

          for (let j = 0; j < positions.length; j += 3) {
            const bx = basePositions[j];
            const by = basePositions[j + 1];
            const bz = basePositions[j + 2];

            const waveY = 0.03 * Math.cos(0.1 * (bx / 2) + bz / 12 + elapsed + whale.phase);
            positions[j] = bx;
            positions[j + 1] = by + waveY;
            positions[j + 2] = bz;

            // Grey with subtle lightness variation along the body
            const color = new THREE.Color();
            const lightness = 0.35 + 0.15 * clamp(Math.sin(0.1 * bz + elapsed + whale.phase), 0, 1);
            color.setHSL(0, 0, lightness);
            colors.push(color.r, color.g, color.b);
          }

          obj.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
          obj.geometry.attributes.position.needsUpdate = true;
          obj.geometry.attributes.color.needsUpdate = true;
        }

        // --- Blow spout spray rendering ---
        const { sprayPoints } = whaleGroups[i];
        const sprayPositions = sprayPoints.geometry.attributes.position.array;
        let sprayIdx = 0;

        if (whale.blowing && whale.blowParticles.length > 0) {
          // The whale head is at the front (nose at +Z in model space, ~13 units).
          // Position spray at the whale's screen position, offset toward the head.
          const headOffset = 5 * s; // blowhole is ~1/3 back from nose toward tail
          // Head screen position: offset along heading direction
          const headScreenX = tx + Math.cos(screenAngle) * headOffset;
          const headScreenY = ty + Math.sin(screenAngle) * headOffset;

          for (const p of whale.blowParticles) {
            if (sprayIdx >= 300) break; // max particles * 3 coords
            const alpha = 1 - (p.life / p.maxLife);
            // Particle position in screen space relative to head
            sprayPositions[sprayIdx++] = headScreenX + p.ox * z * tileWidth * 0.5;
            sprayPositions[sprayIdx++] = headScreenY - p.oy * z * tileWidth * 0.5; // -oy because spray goes up (+Y in Three.js)
            sprayPositions[sprayIdx++] = 0;
          }

          sprayPoints.material.opacity = 0.7;
          sprayPoints.material.size = 3 * z;
        }

        // Zero out remaining positions
        for (let j = sprayIdx; j < sprayPositions.length; j++) {
          sprayPositions[j] = 0;
        }
        // Hide unused particles by moving them off-screen
        for (let j = sprayIdx; j < sprayPositions.length; j += 3) {
          sprayPositions[j] = -99999;
        }
        sprayPoints.geometry.attributes.position.needsUpdate = true;
        sprayPoints.geometry.setDrawRange(0, Math.ceil(sprayIdx / 3));
      }

      renderer.render(scene, camera);
    };

    rafId = requestAnimationFrame(tick);

    // Click handler for whale raycasting — listen on window so we don't
    // block panning (the whale layer keeps pointerEvents: "none")
    const handleClick = (e) => {
      if (!threeRef.current || !threeRef.current.loaded || !onWhaleClickRef.current) return;

      const rect = renderer.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);

      // Test against all whale group meshes
      const meshes = [];
      for (const { group } of threeRef.current.whaleGroups) {
        group.traverse((child) => {
          if (child.isMesh) meshes.push(child);
        });
      }

      const intersects = raycaster.intersectObjects(meshes, false);
      if (intersects.length > 0) {
        onWhaleClickRef.current(e.clientX, e.clientY);
      }
    };

    window.addEventListener("click", handleClick);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("click", handleClick);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      threeRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 2,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    />
  );
};

export default WhaleLayer;
