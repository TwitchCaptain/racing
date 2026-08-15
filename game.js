import * as THREE from 'three';

// ============================================================
// GAME CONFIG
// ============================================================
const CONFIG = {
  LAPS: 3,
  TRACK_RADIUS: 80,
  TRACK_WIDTH: 12,
  MAX_SPEED: 120,
  BOOST_SPEED: 180,
  ACCELERATION: 120,
  BRAKE_FORCE: 6,
  TURN_SPEED: 4.0,
  TURN_DECAY: 3.0,
  LATERAL_FACTOR: 5.0,
  LEAN_FACTOR: 0.3,
  DRAG: 1.0,
  BOOST_DRAIN: 20,
  BOOST_REGEN: 12,
  BIKE_GROUND_OFFSET: -0.32,
  OFF_TRACK_DRAG: 2.0,
  OFF_TRACK_MAX: 40,
  COLORS: {
    TRACK: 0x6677aa,
    TRACK_LINE: 0x88ddff,
    GRASS: 0x55cc55,
    SKY: 0x88bbdd,
    BIKE: 0xff4488,
    BIKE_WHEEL: 0x444466,
    BOOST_GLOW: 0x00ff88,
    EDGE_WHITE: 0xf5f5f5,
    EDGE_RED: 0xcc3333,
    CHECKPOINT: 0x00ff88,
    DUST: 0x9c7a4d,
  }
};

// ============================================================
// DOM REFS
// ============================================================
const canvas = document.getElementById('game-canvas');
const speedEl = document.getElementById('speed-value');
const lapCurrentEl = document.getElementById('lap-current');
const lapTotalEl = document.getElementById('lap-total');
const positionEl = document.getElementById('position-value');
const timeEl = document.getElementById('time-value');
const startScreen = document.getElementById('start-screen');
const finishScreen = document.getElementById('finish-screen');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const finalTimeEl = document.getElementById('final-time');
const finalPositionEl = document.getElementById('final-position');
const minimapCanvas = document.getElementById('minimap-canvas');
const countdownEl = document.getElementById('countdown');
const countdownValueEl = document.getElementById('countdown-value');
const lapProgressFill = document.getElementById('lap-progress-fill');
const finalBestEl = document.getElementById('final-best');
const finalSplitsEl = document.getElementById('final-splits');

lapTotalEl.textContent = CONFIG.LAPS;

// Track length (approx circumference) — used to convert speed to track progress
const TRACK_CIRC = Math.PI * 2 * CONFIG.TRACK_RADIUS;

function formatTime(t) {
  if (!Number.isFinite(t)) return '--:--.-';
  const minutes = Math.floor(t / 60);
  const seconds = t % 60;
  return `${String(minutes).padStart(2, '0')}:${seconds.toFixed(1).padStart(4, '0')}`;
}

function ordinal(n) {
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
}

// ============================================================
// THREE.JS SETUP
// ============================================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(CONFIG.COLORS.SKY);
scene.fog = new THREE.Fog(CONFIG.COLORS.SKY, 200, 600);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 500);
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;

// ============================================================
// LIGHTING
// ============================================================
const ambientLight = new THREE.AmbientLight(0x8899bb, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xfff2dd, 2.6);
directionalLight.position.set(50, 100, 30);
directionalLight.target.position.set(0, 0, 0);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 400;
directionalLight.shadow.camera.left = -200;
directionalLight.shadow.camera.right = 200;
directionalLight.shadow.camera.top = 200;
directionalLight.shadow.camera.bottom = -200;
directionalLight.shadow.bias = -0.0005;
scene.add(directionalLight);
scene.add(directionalLight.target);

const hemisphereLight = new THREE.HemisphereLight(0x88bbff, 0x446644, 0.9);
scene.add(hemisphereLight);

// Subtle sun disc along the key-light direction
const sunMat = new THREE.MeshBasicMaterial({
  color: 0xfff6e0,
  fog: false,
});
const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(18, 32), sunMat);
sunDisc.position.set(156, 311, 94);
sunDisc.lookAt(0, 0, 0);
scene.add(sunDisc);

// ============================================================
// TRACK GENERATION
// ============================================================
class TrackGenerator {
  constructor() {
    this.trackPoints = [];
    this.trackWidth = CONFIG.TRACK_WIDTH;
    this.radius = CONFIG.TRACK_RADIUS;
    this.segments = 200;
    this.generateTrack();
  }

  generateTrack() {
    const points = [];
    const segments = this.segments;

    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) * Math.PI * 2;
      const baseRadius = this.radius;
      let x = Math.cos(t) * baseRadius;
      let z = Math.sin(t) * baseRadius;

      // Curves
      const variation = 0.15;
      const curveOffset = Math.sin(t * 3) * baseRadius * variation;
      x += Math.cos(t) * curveOffset;
      z += Math.sin(t) * curveOffset;

      // Sharp turns
      const sharpTurn = Math.sin(t * 2 + 1.5) * baseRadius * 0.08;
      x += Math.cos(t * 2) * sharpTurn;
      z += Math.sin(t * 2) * sharpTurn;

      // Elevation
      let y = 0;
      y += Math.sin(t * 2) * 8;
      y += Math.sin(t * 3 + 1) * 5;
      const loopFactor = Math.sin(t * 4 - 2) * 0.5 + 0.5;
      y += loopFactor * 12;
      const jumpFactor = Math.sin(t * 5 + 3) * 0.5 + 0.5;
      y += jumpFactor * 6;

      points.push(new THREE.Vector3(x, y, z));
    }

    this.trackPoints = points;
    return points;
  }

  getPoint(t) {
    const idx = Math.floor(t * this.segments) % this.segments;
    const nextIdx = (idx + 1) % this.segments;
    const frac = (t * this.segments) % 1;
    const p1 = this.trackPoints[idx];
    const p2 = this.trackPoints[nextIdx];
    return new THREE.Vector3().lerpVectors(p1, p2, frac);
  }

  getNormal(t) {
    const idx = Math.floor(t * this.segments) % this.segments;
    const nextIdx = (idx + 1) % this.segments;
    const p1 = this.trackPoints[idx];
    const p2 = this.trackPoints[nextIdx];
    const dir = new THREE.Vector3().subVectors(p2, p1).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    return new THREE.Vector3().crossVectors(dir, up).normalize();
  }

  buildTrackMesh(scene) {
    const segments = this.segments;
    const halfWidth = this.trackWidth / 2;
    const trackHeight = 0.3;

    // Road surface
    const roadGeo = new THREE.BufferGeometry();
    const vertices = [];
    const uvs = [];
    const indices = [];
    const colors = [];

    for (let i = 0; i < segments; i++) {
      const t1 = i / segments;
      const t2 = (i + 1) / segments;
      const p1 = this.trackPoints[i];
      const p2 = this.trackPoints[(i + 1) % segments];
      const n1 = this.getNormal(t1);
      const n2 = this.getNormal(t2);

      const v1 = new THREE.Vector3().copy(p1).add(n1.clone().multiplyScalar(halfWidth));
      const v2 = new THREE.Vector3().copy(p1).add(n1.clone().multiplyScalar(-halfWidth));
      const v3 = new THREE.Vector3().copy(p2).add(n2.clone().multiplyScalar(halfWidth));
      const v4 = new THREE.Vector3().copy(p2).add(n2.clone().multiplyScalar(-halfWidth));

      v1.y -= trackHeight;
      v2.y -= trackHeight;
      v3.y -= trackHeight;
      v4.y -= trackHeight;

      const baseIdx = vertices.length / 3;
      vertices.push(v1.x, v1.y, v1.z);
      vertices.push(v2.x, v2.y, v2.z);
      vertices.push(v3.x, v3.y, v3.z);
      vertices.push(v4.x, v4.y, v4.z);

      uvs.push(0, 0, 0, 1, 1, 0, 1, 1);

      const color = new THREE.Color(CONFIG.COLORS.TRACK);
      const bright = 0.6 + (p1.y / 30) * 0.4;
      color.multiplyScalar(Math.max(0.6, Math.min(1, bright)));
      // Subtle deterministic per-vertex variation so the asphalt reads as a textured track
      for (let c = 0; c < 4; c++) {
        const v = 0.9 + 0.1 * Math.sin((i * 7 + c * 3) * 0.7);
        colors.push(color.r * v, color.g * v, color.b * v);
      }

      indices.push(baseIdx, baseIdx + 1, baseIdx + 2);
      indices.push(baseIdx + 1, baseIdx + 3, baseIdx + 2);
    }

    roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    roadGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    roadGeo.setIndex(indices);
    roadGeo.computeVertexNormals();

    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x8899cc,
      vertexColors: true,
      roughness: 0.85,
      metalness: 0.15,
      emissive: new THREE.Color(0x223355),
      emissiveIntensity: 0.35,
      side: THREE.DoubleSide,
    });
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.receiveShadow = true;
    road.castShadow = true;
    scene.add(road);

    // Edge curbs — alternating white/red strips along both road edges (single merged mesh)
    const curbGeo = new THREE.BufferGeometry();
    const curbVerts = [];
    const curbColors = [];
    const curbIdx = [];
    const curbWhite = new THREE.Color(CONFIG.COLORS.EDGE_WHITE);
    const curbRed = new THREE.Color(CONFIG.COLORS.EDGE_RED);
    const curbInner = halfWidth - 0.5;
    const curbOuter = halfWidth - 0.05;

    for (let i = 0; i < segments; i++) {
      const t1 = i / segments;
      const p1 = this.trackPoints[i];
      const p2 = this.trackPoints[(i + 1) % segments];
      const n1 = this.getNormal(t1);
      const n2 = this.getNormal(((i + 1) % segments) / segments);
      const curbColor = (i % 4 < 2) ? curbWhite : curbRed;

      for (let side = -1; side <= 1; side += 2) {
        const a1 = new THREE.Vector3().copy(p1).add(n1.clone().multiplyScalar(side * curbOuter));
        const b1 = new THREE.Vector3().copy(p1).add(n1.clone().multiplyScalar(side * curbInner));
        const a2 = new THREE.Vector3().copy(p2).add(n2.clone().multiplyScalar(side * curbOuter));
        const b2 = new THREE.Vector3().copy(p2).add(n2.clone().multiplyScalar(side * curbInner));

        const surfY1 = p1.y - trackHeight + 0.02;
        const surfY2 = p2.y - trackHeight + 0.02;
        a1.y = surfY1; b1.y = surfY1; a2.y = surfY2; b2.y = surfY2;

        const base = curbVerts.length / 3;
        curbVerts.push(a1.x, a1.y, a1.z);
        curbVerts.push(b1.x, b1.y, b1.z);
        curbVerts.push(b2.x, b2.y, b2.z);
        curbVerts.push(a2.x, a2.y, a2.z);
        for (let c = 0; c < 4; c++) {
          curbColors.push(curbColor.r, curbColor.g, curbColor.b);
        }
        curbIdx.push(base, base + 1, base + 2);
        curbIdx.push(base, base + 2, base + 3);
      }
    }
    curbGeo.setAttribute('position', new THREE.Float32BufferAttribute(curbVerts, 3));
    curbGeo.setAttribute('color', new THREE.Float32BufferAttribute(curbColors, 3));
    curbGeo.setIndex(curbIdx);
    curbGeo.computeVertexNormals();
    const curbMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.6,
      metalness: 0.1,
      emissive: 0x222222,
      emissiveIntensity: 0.3,
      side: THREE.DoubleSide,
    });
    const curbs = new THREE.Mesh(curbGeo, curbMat);
    curbs.receiveShadow = true;
    scene.add(curbs);

    // Terrain — slopes from flat ground up to track elevation
    const terrainGeo = new THREE.BufferGeometry();
    const tVerts = [];
    const tIdx = [];
    const terrainWidth = 30;
    const groundY = -14;
    for (let i = 0; i < segments; i++) {
      const p1 = this.trackPoints[i];
      const p2 = this.trackPoints[(i + 1) % segments];
      const n1 = this.getNormal(i / segments);
      const n2 = this.getNormal((i + 1) / segments);

      // Track center point (just below the road surface, closing the under-edge gap)
      const center1 = new THREE.Vector3().copy(p1);
      center1.y -= trackHeight + 0.05;
      const center2 = new THREE.Vector3().copy(p2);
      center2.y -= trackHeight + 0.05;

      // Outer edge (terrain width outward — away from track center, at ground level)
      const outer1 = new THREE.Vector3().copy(p1).add(n1.clone().multiplyScalar(terrainWidth));
      outer1.y = groundY;
      const outer2 = new THREE.Vector3().copy(p2).add(n2.clone().multiplyScalar(terrainWidth));
      outer2.y = groundY;

      // Inner side edge (terrain width inward — toward track center, at ground level)
      const innerSide1 = new THREE.Vector3().copy(p1).add(n1.clone().multiplyScalar(-terrainWidth));
      innerSide1.y = groundY;
      const innerSide2 = new THREE.Vector3().copy(p2).add(n2.clone().multiplyScalar(-terrainWidth));
      innerSide2.y = groundY;

      const base = tVerts.length / 3;
      // Outer side quad (slopes from track level down to ground)
      tVerts.push(center1.x, center1.y, center1.z);
      tVerts.push(outer1.x, outer1.y, outer1.z);
      tVerts.push(center2.x, center2.y, center2.z);
      tVerts.push(outer2.x, outer2.y, outer2.z);
      tIdx.push(base, base + 1, base + 2);
      tIdx.push(base + 1, base + 3, base + 2);

      // Inner side quad (slopes from track level down to ground)
      const base2 = tVerts.length / 3;
      tVerts.push(center1.x, center1.y, center1.z);
      tVerts.push(innerSide1.x, innerSide1.y, innerSide1.z);
      tVerts.push(center2.x, center2.y, center2.z);
      tVerts.push(innerSide2.x, innerSide2.y, innerSide2.z);
      tIdx.push(base2, base2 + 1, base2 + 2);
      tIdx.push(base2 + 1, base2 + 3, base2 + 2);
    }
    terrainGeo.setAttribute('position', new THREE.Float32BufferAttribute(tVerts, 3));
    terrainGeo.setIndex(tIdx);
    terrainGeo.computeVertexNormals();

    const terrainMat = new THREE.MeshStandardMaterial({
      color: 0x887755,
      roughness: 1,
      flatShading: true,
      side: THREE.DoubleSide,
    });
    const terrain = new THREE.Mesh(terrainGeo, terrainMat);
    terrain.receiveShadow = true;
    terrain.castShadow = true;
    scene.add(terrain);

    // Center line dashes
    const lineMat = new THREE.MeshStandardMaterial({
      color: CONFIG.COLORS.TRACK_LINE,
      emissive: CONFIG.COLORS.TRACK_LINE,
      emissiveIntensity: 0.1,
    });

    for (let i = 0; i < segments; i += 4) {
      const p = this.trackPoints[i];
      const n = this.getNormal(i / segments);
      const center = new THREE.Vector3().copy(p);
      center.y -= trackHeight - 0.01;

      // Direction of this track segment
      const nextP = this.trackPoints[(i + 1) % segments];
      const dir = new THREE.Vector3().subVectors(nextP, p).normalize();

      const lineGeo = new THREE.BoxGeometry(0.3, 0.05, 1.5);
      const line = new THREE.Mesh(lineGeo, lineMat);
      line.position.copy(center);
      line.position.y += 0.02;
      // Align with track direction
      line.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
      scene.add(line);
    }

    // Barrier posts
    const barrierMat = new THREE.MeshStandardMaterial({
      color: 0xff6644,
      emissive: 0xff6644,
      emissiveIntensity: 0.3,
    });

    for (let i = 0; i < segments; i += 2) {
      const t = i / segments;
      const p = this.trackPoints[i];
      const n = this.getNormal(t);

      for (let side = -1; side <= 1; side += 2) {
        const pos = new THREE.Vector3().copy(p).add(n.clone().multiplyScalar(side * (halfWidth + 0.3)));
        pos.y += 0.5;
        const barrier = new THREE.Mesh(
          new THREE.CylinderGeometry(0.15, 0.15, 1.0, 6),
          barrierMat
        );
        barrier.position.copy(pos);
        barrier.castShadow = true;
        scene.add(barrier);
      }
    }

    // Start/finish line — full track width, flush with the road surface, visible from above
    // 1.0-unit-wide band with 0.5x0.5 square checker cells (canvas aspect matches plane aspect)
    const checkerCanvas = document.createElement('canvas');
    checkerCanvas.width = 16;
    checkerCanvas.height = 192;
    const cctx = checkerCanvas.getContext('2d');
    for (let cx = 0; cx < 2; cx++) {
      for (let cy = 0; cy < 24; cy++) {
        cctx.fillStyle = (cx + cy) % 2 === 0 ? '#ffffff' : '#111111';
        cctx.fillRect(cx * 8, cy * 8, 8, 8);
      }
    }
    const checkerTex = new THREE.CanvasTexture(checkerCanvas);
    const startMat = new THREE.MeshStandardMaterial({
      map: checkerTex,
      emissive: 0xffffff,
      emissiveMap: checkerTex,
      emissiveIntensity: 0.6,
      side: THREE.DoubleSide,
    });
    const startLine = new THREE.Mesh(
      new THREE.PlaneGeometry(1.0, this.trackWidth),
      startMat
    );
    const startPos = this.trackPoints[0];
    const startNormal = this.getNormal(0);
    startLine.position.copy(startPos);
    startLine.position.y = startPos.y - 0.25; // flush with road (surface at startPos.y - 0.3)
    startLine.lookAt(startPos.clone().add(startNormal));
    startLine.rotateX(Math.PI / 2);
    scene.add(startLine);

    return road;
  }
}

// ============================================================
// SCENERY GENERATION
// ============================================================
// Checkpoint marker material (assigned in generateScenery, pulsed in updateCamera)
let checkpointMat = null;

function generateSky(scene) {
  // Stars
  const starsGeo = new THREE.BufferGeometry();
  const starPositions = [];
  for (let i = 0; i < 2000; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 400 + Math.random() * 100;
    starPositions.push(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta)
    );
  }
  starsGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
  const starsMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.5,
    transparent: true,
    opacity: 0.6,
  });
  const stars = new THREE.Points(starsGeo, starsMat);
  scene.add(stars);

  // Moon
  const moonMat = new THREE.MeshStandardMaterial({
    color: 0xeeeeff,
    emissive: 0xeeeeff,
    emissiveIntensity: 0.3,
  });
  const moon = new THREE.Mesh(new THREE.SphereGeometry(5, 16, 16), moonMat);
  moon.position.set(80, 60, -120);
  scene.add(moon);

  // Glow around moon
  const glowMat = new THREE.MeshStandardMaterial({
    color: 0x8888ff,
    emissive: 0x8888ff,
    emissiveIntensity: 0.2,
    transparent: true,
    opacity: 0.1,
  });
  const glow = new THREE.Mesh(new THREE.SphereGeometry(12, 16, 16), glowMat);
  glow.position.copy(moon.position);
  scene.add(glow);
}

function generateScenery(scene, trackGen) {
  // Ground plane with grid
  const groundGeo = new THREE.PlaneGeometry(400, 400, 40, 40);
  const groundMat = new THREE.MeshStandardMaterial({
    color: CONFIG.COLORS.GRASS,
    roughness: 1,
    emissive: CONFIG.COLORS.GRASS,
    emissiveIntensity: 0.08,
    wireframe: false,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -14;
  ground.receiveShadow = true;
  scene.add(ground);

  // Grid overlay for depth perception
  const gridHelper = new THREE.GridHelper(300, 30, 0x88bbdd, 0x446688);
  gridHelper.position.y = -14;
  scene.add(gridHelper);

  // Trees and rocks — rejected if too close to the track centerline, grounded on the ground plane
  const groundY = -14;
  const halfWidth = CONFIG.TRACK_WIDTH / 2;
  const clearDist = halfWidth + 8;
  const trackSamples = [];
  for (let i = 0; i < 16; i++) {
    trackSamples.push(trackGen.getPoint(i / 16));
  }
  function isClearOfTrack(x, z) {
    for (const tp of trackSamples) {
      const dx = x - tp.x;
      const dz = z - tp.z;
      if (dx * dx + dz * dz < clearDist * clearDist) return false;
    }
    return true;
  }

  // Trees
  const treeMat = new THREE.MeshStandardMaterial({ color: 0x44cc44, roughness: 0.9, emissive: 0x44cc44, emissiveIntensity: 0.05 });
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x886644, roughness: 1 });

  for (let i = 0; i < 200; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * 75;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    if (!isClearOfTrack(x, z)) continue;

    const height = 3 + Math.random() * 5;
    const trunkH = height * 0.3;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, trunkH, 6), trunkMat);
    trunk.position.set(x, groundY + trunkH / 2, z); // trunk bottom at ground level
    trunk.castShadow = true;
    scene.add(trunk);

    const foliage = new THREE.Mesh(new THREE.SphereGeometry(1 + Math.random() * 1.5, 6, 6), treeMat);
    foliage.position.set(x, groundY + height * 0.6, z);
    foliage.castShadow = true;
    scene.add(foliage);
  }

  // Rocks
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x888899, roughness: 0.9 });
  for (let i = 0; i < 80; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * 70;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    if (!isClearOfTrack(x, z)) continue;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3 + Math.random() * 0.5), rockMat);
    rock.position.set(x, -13.85, z); // sits on the ground plane
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    rock.castShadow = true;
    scene.add(rock);
  }

  // Light poles
  const poleMat = new THREE.MeshStandardMaterial({ color: 0xaaaacc, roughness: 0.5, metalness: 0.5 });
  const lightMat = new THREE.MeshStandardMaterial({
    color: 0xffffaa,
    emissive: 0xffffaa,
    emissiveIntensity: 1.0,
  });

  for (let i = 0; i < 40; i++) {
    const t = i / 40;
    const p = trackGen.getPoint(t);
    const n = trackGen.getNormal(t);
    const side = (i % 2 === 0) ? 1 : -1;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 3, 6), poleMat);
    pole.position.copy(p);
    pole.position.add(n.clone().multiplyScalar(side * (CONFIG.TRACK_WIDTH / 2 + 0.5)));
    pole.position.y += 1.5;
    pole.castShadow = true;
    scene.add(pole);

    const light = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 6), lightMat);
    light.position.copy(pole.position);
    light.position.y += 1.5;
    scene.add(light);
  }

  // Checkpoint markers — painted split-line style, flush with the road surface
  const cpMat = new THREE.MeshStandardMaterial({
    color: CONFIG.COLORS.CHECKPOINT,
    emissive: CONFIG.COLORS.CHECKPOINT,
    emissiveIntensity: 0.35,
    side: THREE.DoubleSide,
  });
  checkpointMat = cpMat;

  for (let i = 0; i < 8; i++) {
    const t = (i + 0.5) / 8;
    const p = trackGen.getPoint(t);
    const n = trackGen.getNormal(t);
    // Thin along the tangent, wide across the road, flat on the surface.
    const cp = new THREE.Mesh(new THREE.BoxGeometry(0.15, CONFIG.TRACK_WIDTH * 0.95, 0.04), cpMat);
    cp.position.copy(p);
    cp.position.y = p.y - 0.25; // flush with road (surface at p.y - 0.3)
    cp.lookAt(p.clone().add(n));
    cp.rotateX(Math.PI / 2);
    scene.add(cp);
  }
}

// ============================================================
// BICYCLE CONSTRUCTION
// ============================================================
function buildBicycle(frameColor = CONFIG.COLORS.BIKE) {
  const group = new THREE.Group();

  const frameMat = new THREE.MeshStandardMaterial({
    color: frameColor,
    roughness: 0.3,
    metalness: 0.7,
    emissive: frameColor,
    emissiveIntensity: 0.3,
  });
  const wheelMat = new THREE.MeshStandardMaterial({
    color: CONFIG.COLORS.BIKE_WHEEL,
    roughness: 0.8,
    metalness: 0.2,
    emissive: CONFIG.COLORS.BIKE_WHEEL,
    emissiveIntensity: 0.1,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0x00ff88,
    emissive: 0x00ff88,
    emissiveIntensity: 0.5,
  });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x222233, roughness: 0.6, metalness: 0.4 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x99aacc, roughness: 0.4, metalness: 0.8 });
  const discMat = new THREE.MeshStandardMaterial({
    color: 0x334455,
    roughness: 0.9,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide,
  });
  const spokeMat = new THREE.MeshStandardMaterial({ color: 0x555566, metalness: 0.5 });
  const hubMat = new THREE.MeshStandardMaterial({ color: 0x888899, metalness: 0.5 });

  // Wheel: torus tire (bottom at local y=0, axle along local X) + rim + inner disc + spokes + hub
  const WHEEL_R = 0.35;
  const TIRE_T = 0.06;
  function buildWheel() {
    const wg = new THREE.Group();

    const tire = new THREE.Mesh(new THREE.TorusGeometry(WHEEL_R, TIRE_T, 8, 20), wheelMat);
    tire.rotation.y = Math.PI / 2; // torus axis (local Z) -> X, wheel plane = YZ
    tire.castShadow = true;
    wg.add(tire);

    const rim = new THREE.Mesh(new THREE.TorusGeometry(WHEEL_R - TIRE_T + 0.01, 0.02, 6, 20), rimMat);
    rim.rotation.y = Math.PI / 2;
    wg.add(rim);

    const disc = new THREE.Mesh(new THREE.CircleGeometry(WHEEL_R - TIRE_T, 16), discMat);
    disc.rotation.y = Math.PI / 2; // face normal along X
    wg.add(disc);

    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, WHEEL_R - TIRE_T - 0.03, 3), spokeMat);
      spoke.position.set(0, Math.sin(angle) * (WHEEL_R / 2), Math.cos(angle) * (WHEEL_R / 2));
      spoke.rotation.x = -angle; // cylinder axis (Y) -> radial direction in YZ plane
      wg.add(spoke);
    }

    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.1, 8), hubMat);
    hub.rotation.z = Math.PI / 2; // cylinder axis along X
    wg.add(hub);

    return wg;
  }

  // Rear wheel group — tire bottom at local y=0 (group origin at axle height)
  const wheelGroup1 = buildWheel();
  wheelGroup1.position.set(0, WHEEL_R + TIRE_T, -0.55);
  group.add(wheelGroup1);

  // Front wheel
  const wheelGroup2 = buildWheel();
  wheelGroup2.position.set(0, WHEEL_R + TIRE_T, 0.6);
  group.add(wheelGroup2);

  // Frame — main triangle (bottom bracket -> seat cluster -> head tube)
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 1.0), frameMat);
  frame.position.set(0, 0.5, 0.05);
  frame.castShadow = true;
  group.add(frame);

  // Down tube (bottom bracket -> head tube)
  const downTube = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.85, 8), frameMat);
  downTube.position.set(0, 0.45, 0.35);
  downTube.rotation.x = 0.6;
  downTube.castShadow = true;
  group.add(downTube);

  // Seat tube (bottom bracket -> seat cluster)
  const seatTube = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.45, 8), frameMat);
  seatTube.position.set(0, 0.6, -0.15);
  seatTube.rotation.x = -0.25;
  group.add(seatTube);

  // Seat stays (seat cluster -> rear axle)
  for (let side = -1; side <= 1; side += 2) {
    const stay = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.62, 6), frameMat);
    stay.position.set(side * 0.06, 0.55, -0.35);
    stay.rotation.x = 0.9;
    stay.rotation.z = side * 0.15;
    group.add(stay);
  }

  // Chain stays (bottom bracket -> rear axle)
  for (let side = -1; side <= 1; side += 2) {
    const stay = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.55, 6), frameMat);
    stay.position.set(side * 0.05, 0.36, -0.28);
    stay.rotation.x = 1.35;
    stay.rotation.z = side * 0.1;
    group.add(stay);
  }

  // Fork (head tube -> front axle)
  for (let side = -1; side <= 1; side += 2) {
    const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 6), frameMat);
    fork.position.set(side * 0.05, 0.5, 0.5);
    fork.rotation.x = 0.7;
    fork.rotation.z = side * 0.12;
    group.add(fork);
  }

  // Handlebar stem
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.2, 6), frameMat);
  stem.position.set(0, 0.85, 0.55);
  group.add(stem);

  // Handlebars
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 8), accentMat);
  bar.position.set(0, 0.95, 0.6);
  bar.rotation.z = Math.PI / 2;
  bar.castShadow = true;
  group.add(bar);

  // Grips
  for (let side = -1; side <= 1; side += 2) {
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 6), darkMat);
    grip.position.set(side * 0.3, 0.95, 0.6);
    grip.rotation.z = Math.PI / 2;
    group.add(grip);
  }

  // Seat
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.3), darkMat);
  seat.position.set(0, 0.9, -0.3);
  group.add(seat);

  // Seat post
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.25, 6), frameMat);
  post.position.set(0, 0.78, -0.28);
  group.add(post);

  // Chainring hint at bottom bracket
  const chainring = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.02, 6, 16), rimMat);
  chainring.position.set(0, 0.35, 0);
  group.add(chainring);

  // Pedal arms + pedals (opposite sides)
  const pedalMat = new THREE.MeshStandardMaterial({ color: 0x444455, roughness: 0.5, metalness: 0.5 });
  for (let side = -1; side <= 1; side += 2) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.24, 6), rimMat);
    arm.position.set(side * 0.09, 0.35, 0);
    arm.rotation.x = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    group.add(arm);

    const pedal = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.035, 0.07), pedalMat);
    pedal.position.set(side * 0.14, side > 0 ? 0.35 + 0.12 : 0.35 - 0.12, 0);
    group.add(pedal);
  }

  // Boost glow ring
  const glowMat = new THREE.MeshStandardMaterial({
    color: CONFIG.COLORS.BOOST_GLOW,
    emissive: CONFIG.COLORS.BOOST_GLOW,
    emissiveIntensity: 0.5,
    transparent: true,
    opacity: 0.3,
  });
  const glowRing = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.04, 8, 16), glowMat);
  glowRing.position.set(0, WHEEL_R + TIRE_T, -0.55);
  glowRing.rotation.y = Math.PI / 2; // ring axis along X, matching the wheel axle
  glowRing.visible = false;
  group.add(glowRing);

  // Store references for animation (wheel bottoms at local y=0, axles along local X)
  group.userData = { wheel1: wheelGroup1, wheel2: wheelGroup2, glowRing };

  return group;
}

// ============================================================
// GAME STATE
// ============================================================
const state = {
  started: false,
  finished: false,
  lap: 1,
  totalLaps: CONFIG.LAPS,
  time: 0,
  bestLap: Infinity,
  lapTimes: [],
  speed: 0,
  turn: 0,
  position: 0,
  lastPosition: 0,
  boost: false,
  boostEnergy: 100,
  offTrack: false,
  countdown: 0,
  lastCheckpointIdx: 0,
  checkpointsCollected: 0,
  lastLapTime: 0,
};

// Boost FOV kick (0..1) — driven by updatePlayer, read by updateCamera (visual)
let boostFovKick = 0;

// ============================================================
// PLAYER SETUP
// ============================================================
const trackGen = new TrackGenerator();
trackGen.buildTrackMesh(scene);
generateSky(scene);
generateScenery(scene, trackGen);

const playerBike = buildBicycle();
playerBike.scale.set(2.0, 2.0, 2.0);
scene.add(playerBike);

// Add a bright point light at the bike for visibility
const bikeLight = new THREE.PointLight(0xff4488, 2, 50);
bikeLight.position.set(0, 2, 0);
playerBike.add(bikeLight);

const startPos = trackGen.getPoint(0);
playerBike.position.copy(startPos);
playerBike.position.y += CONFIG.BIKE_GROUND_OFFSET;

// AI opponents — computer racers with distinct bikes and skill levels
const OPPONENT_COLORS = [0x00aaff, 0xffaa00, 0xaa44ff];
const OPPONENT_NAMES = ['Turbo', 'Rocket', 'Blaze'];
const opponents = [];
for (let i = 0; i < OPPONENT_COLORS.length; i++) {
  const bike = buildBicycle(OPPONENT_COLORS[i]);
  bike.scale.set(2.0, 2.0, 2.0);
  scene.add(bike);
  opponents.push({
    bike,
    name: OPPONENT_NAMES[i],
    color: OPPONENT_COLORS[i],
    pos: 0,
    prevPos: 0,
    lateral: [-0.55, 0.15, 0.55][i],
    speed: 0,
    targetSpeed: 0,
    skill: [0.86, 0.94, 1.0][i],
    boostUntil: 0,
    lap: 1,
    finished: false,
    phase: i * 2.1 + 1.0,
  });
}

// Place AI bikes on the starting grid for the menu orbit view
for (const o of opponents) {
  placeBike(o.bike, 0, o.lateral * (CONFIG.TRACK_WIDTH / 2 - 0.9), o.lateral * 0.3, 0);
}

// ============================================================
// INPUT HANDLING
// ============================================================
const keys = { up: false, down: false, left: false, right: false, boost: false };

document.addEventListener('keydown', (e) => {
  switch (e.code) {
    case 'ArrowUp': case 'KeyW': keys.up = true; e.preventDefault(); break;
    case 'ArrowDown': case 'KeyS': keys.down = true; e.preventDefault(); break;
    case 'ArrowLeft': case 'KeyA': keys.left = true; e.preventDefault(); break;
    case 'ArrowRight': case 'KeyD': keys.right = true; e.preventDefault(); break;
    case 'ShiftLeft': case 'ShiftRight': keys.boost = true; e.preventDefault(); break;
    case 'Enter':
      if (!state.started) startGame();
      break;
  }
});

document.addEventListener('keyup', (e) => {
  switch (e.code) {
    case 'ArrowUp': case 'KeyW': keys.up = false; break;
    case 'ArrowDown': case 'KeyS': keys.down = false; break;
    case 'ArrowLeft': case 'KeyA': keys.left = false; break;
    case 'ArrowRight': case 'KeyD': keys.right = false; break;
    case 'ShiftLeft': case 'ShiftRight': keys.boost = false; break;
  }
});

// Touch controls
let touchId = null;
canvas.addEventListener('touchstart', (e) => {
  if (!state.started) { startGame(); return; }
  touchId = e.touches[0].identifier;
  const rect = canvas.getBoundingClientRect();
  const x = (e.touches[0].clientX - rect.left) / rect.width;
  const y = (e.touches[0].clientY - rect.top) / rect.height;
  if (y < 0.4) keys.up = true;
  if (y > 0.6) keys.down = true;
  if (x < 0.3) keys.left = true;
  if (x > 0.7) keys.right = true;
});

canvas.addEventListener('touchmove', (e) => {
  const touch = Array.from(e.touches).find(t => t.identifier === touchId);
  if (!touch) return;
  const rect = canvas.getBoundingClientRect();
  const x = (touch.clientX - rect.left) / rect.width;
  const y = (touch.clientY - rect.top) / rect.height;
  keys.up = y < 0.4;
  keys.down = y > 0.6;
  keys.left = x < 0.3;
  keys.right = x > 0.7;
});

canvas.addEventListener('touchend', () => {
  keys.up = false; keys.down = false; keys.left = false; keys.right = false;
});

// On-screen touch buttons (mobile) — drive the same key state as the keyboard
const touchBtnKeys = {
  'touch-left': 'left',
  'touch-right': 'right',
  'touch-up': 'up',
  'touch-down': 'down',
};
for (const [id, key] of Object.entries(touchBtnKeys)) {
  const btn = document.getElementById(id);
  if (!btn) continue;
  const setKey = (value) => (e) => {
    keys[key] = value;
    e.preventDefault();
  };
  btn.addEventListener('pointerdown', setKey(true));
  btn.addEventListener('pointerup', setKey(false));
  btn.addEventListener('pointercancel', setKey(false));
  btn.addEventListener('pointerleave', setKey(false));
}

// ============================================================
// GAME LOGIC
// ============================================================
function startGame() {
  state.started = true;
  state.finished = false;
  state.time = 0;
  state.lap = 1;
  state.speed = 0;
  state.turn = 0;
  state.position = 0;
  state.lastPosition = 0;
  state.boost = false;
  state.boostEnergy = 100;
  state.offTrack = false;
  state.countdown = 3.0;
  state.lastCheckpointIdx = 0;
  state.checkpointsCollected = 0;
  state.lastLapTime = 0;
  state.bestLap = Infinity;
  state.lapTimes = [];

  startScreen.classList.add('hidden');
  finishScreen.classList.add('hidden');

  // Reset HUD displays
  lapCurrentEl.textContent = state.lap;
  timeEl.textContent = '00:00.0';
  finalTimeEl.textContent = '';

  const pos = trackGen.getPoint(0);
  playerBike.position.copy(pos);
  playerBike.position.y += CONFIG.BIKE_GROUND_OFFSET;
  boostFovKick = 0;

  // Reset AI opponents to the grid
  for (const o of opponents) {
    o.pos = 0;
    o.prevPos = 0;
    o.speed = 0;
    o.targetSpeed = 0;
    o.boostUntil = 0;
    o.lap = 1;
    o.finished = false;
  }
}

function finishGame() {
  state.finished = true;
  state.finishTime = state.time;
  finalTimeEl.textContent = formatTime(state.time);
  finalPositionEl.textContent = ordinal(computePlayerRank());
  finalBestEl.textContent = formatTime(state.bestLap);
  finalSplitsEl.innerHTML = '';
  state.lapTimes.forEach((t, i) => {
    const li = document.createElement('li');
    const label = document.createElement('span');
    label.textContent = `LAP ${i + 1}`;
    const val = document.createElement('span');
    val.textContent = formatTime(t);
    li.append(label, val);
    finalSplitsEl.appendChild(li);
  });
  finishScreen.classList.remove('hidden');
}

// Shared bike placement: position on the track centerline + lateral offset, orient
// along the track direction, apply lean about the forward axis, spin the wheels.
function placeBike(bike, trackPos, lateralOffset, leanAngle, wheelSpin) {
  const pos = trackGen.getPoint(trackPos);
  const norm = trackGen.getNormal(trackPos);

  bike.position.copy(pos);
  bike.position.add(norm.clone().multiplyScalar(lateralOffset));
  bike.position.y += CONFIG.BIKE_GROUND_OFFSET;

  const nextPos = trackGen.getPoint((trackPos + 0.01) % 1);
  const dir = new THREE.Vector3().subVectors(nextPos, pos);
  if (dir.lengthSq() > 0.0001) dir.normalize();
  else dir.set(0, 0, 1);

  const m = new THREE.Matrix4();
  m.lookAt(pos.clone().add(dir), pos, new THREE.Vector3(0, 1, 0));
  const targetQuat = new THREE.Quaternion().setFromRotationMatrix(m);
  const leanQuat = new THREE.Quaternion().setFromAxisAngle(dir, leanAngle);
  targetQuat.multiply(leanQuat);
  bike.quaternion.slerp(targetQuat, 0.3);

  if (bike.userData.wheel1) bike.userData.wheel1.rotation.x += wheelSpin;
  if (bike.userData.wheel2) bike.userData.wheel2.rotation.x += wheelSpin;
}

// AI opponents — accelerate toward a skill-based target speed, occasional boost
// bursts, lane sway, forward-only lap counting. `racing` gates physics to the
// post-countdown window so the grid sits still (but placed) during 3-2-1-GO.
function updateOpponents(delta, racing) {
  const halfWidth = CONFIG.TRACK_WIDTH / 2;
  for (const o of opponents) {
    if (racing && !o.finished) {
      if (o.boostUntil > 0) {
        o.boostUntil -= delta;
        o.targetSpeed = CONFIG.MAX_SPEED * o.skill * 1.32;
      } else {
        o.targetSpeed = CONFIG.MAX_SPEED * o.skill;
        if (Math.random() < delta * 0.12) o.boostUntil = 1.0 + Math.random() * 1.6;
      }
      o.speed += (o.targetSpeed - o.speed) * Math.min(1, 1.5 * delta);
      o.pos = (o.pos + o.speed * delta / TRACK_CIRC) % 1;
      if (o.pos < 0) o.pos += 1;

      if (o.prevPos > 0.9 && o.pos < 0.1) {
        o.lap++;
        if (o.lap > state.totalLaps) {
          o.finished = true;
          o.finishTime = state.time;
          o.speed = 0;
        }
      }
      o.prevPos = o.pos;
    }

    // Lane sway — ride a racing line with slight lateral movement
    o.lateral += (Math.sin(o.pos * 24 + o.phase) * 0.55 - o.lateral) * Math.min(1, 2.2 * delta);
    placeBike(o.bike, o.pos, o.lateral * (halfWidth - 0.9), o.lateral * 0.3, o.speed * delta * 5);
  }
}

// Player's standing among all racers: finished racers rank above unfinished, then
// by lap count, then by track progress. Ties on finish time resolve player-first.
function computePlayerRank() {
  const racers = opponents.map(o => ({
    isPlayer: false,
    finished: o.finished,
    finishtime: o.finished ? o.finishTime : Infinity,
    lap: o.finished ? state.totalLaps + 1 : o.lap,
    pos: o.finished ? 2 : o.pos,
  }));
  racers.push({
    isPlayer: true,
    finished: state.finished,
    finishtime: state.finished ? state.finishTime : Infinity,
    lap: state.finished ? state.totalLaps + 1 : state.lap,
    pos: state.finished ? 2 : state.position,
  });
  racers.sort((a, b) => {
    if (b.finished !== a.finished) return b.finished - a.finished;
    if (a.finished && b.finished) return (a.finishtime - b.finishtime) || (b.isPlayer - a.isPlayer);
    return (b.lap - a.lap) || (b.pos - a.pos);
  });
  return racers.findIndex(r => r.isPlayer) + 1;
}

function updatePlayer(delta) {
  const dt = Math.min(delta, 0.05);

  // Boost
  if (keys.boost && state.boostEnergy > 0) {
    state.boost = true;
    state.boostEnergy -= CONFIG.BOOST_DRAIN * dt;
  } else {
    state.boost = false;
    if (state.boostEnergy < 100) state.boostEnergy += CONFIG.BOOST_REGEN * dt;
  }
  state.boostEnergy = Math.max(0, Math.min(100, state.boostEnergy));

  // Boost FOV kick (drives the visual FOV in updateCamera)
  if (state.boost) {
    boostFovKick = 1;
  } else {
    boostFovKick *= Math.exp(-8 * dt);
    if (boostFovKick < 0.01) boostFovKick = 0;
  }

  // Turning (frame-rate-independent decay)
  const turnAmount = CONFIG.TURN_SPEED * dt;
  if (keys.left) state.turn -= turnAmount;
  if (keys.right) state.turn += turnAmount;
  state.turn *= Math.exp(-CONFIG.TURN_DECAY * dt);

  // Acceleration / braking with frame-rate-independent drag
  if (keys.up) state.speed += CONFIG.ACCELERATION * dt * (state.boost ? 1.5 : 1);
  if (keys.down) state.speed -= CONFIG.BRAKE_FORCE * dt * 2;
  state.speed *= Math.exp(-CONFIG.DRAG * dt);

  const maxSpeed = state.boost ? CONFIG.BOOST_SPEED : CONFIG.MAX_SPEED;
  state.speed = Math.max(-20, Math.min(maxSpeed, state.speed));

  // Movement — convert speed (units/s) to track progress using the track length
  const moveAmount = state.speed * dt / TRACK_CIRC;
  state.position = (state.position + moveAmount) % 1;
  if (state.position < 0) state.position += 1;

  // Lateral offset clamped to the drivable road; off-track when steering past it
  const halfWidth = CONFIG.TRACK_WIDTH / 2;
  const driveLimit = halfWidth - 0.4;
  const desiredOffset = state.turn * CONFIG.LATERAL_FACTOR;
  const lateralOffset = Math.max(-driveLimit, Math.min(driveLimit, desiredOffset));
  state.offTrack = Math.abs(desiredOffset) > driveLimit;

  // Off-track: strong slowdown on the grass
  if (state.offTrack) {
    state.speed *= Math.exp(-CONFIG.OFF_TRACK_DRAG * dt);
    if (state.speed > CONFIG.OFF_TRACK_MAX) state.speed = CONFIG.OFF_TRACK_MAX;
  }

  // Place + orient the bike (shared with AI opponents)
  placeBike(playerBike, state.position, lateralOffset, state.turn * CONFIG.LEAN_FACTOR, state.speed * dt * 5);

  // Boost glow
  const glowRing = playerBike.userData.glowRing;
  if (glowRing) {
    glowRing.visible = state.boost;
    glowRing.material.emissiveIntensity = state.boost ? 0.5 + Math.sin(state.time * 10) * 0.3 : 0;
  }

  // Checkpoint detection — forward motion only, strictly in order (no reverse farming)
  const CP_COUNT = 8;
  const cpIdx = Math.floor(state.position * CP_COUNT) % CP_COUNT;
  if (state.speed >= 0) {
    const expected = (state.lastCheckpointIdx + 1) % CP_COUNT;
    if (cpIdx === expected) {
      state.lastCheckpointIdx = cpIdx;
      state.checkpointsCollected++;
    }
  }

  // Lap detection — cross the start line forward with all checkpoints collected
  const crossedLine = state.lastPosition > 0.9 && state.position < 0.1;
  if (crossedLine && state.speed >= 0 && state.checkpointsCollected >= CP_COUNT) {
    const lapTime = state.time - state.lastLapTime;
    state.lapTimes.push(lapTime);
    if (lapTime < state.bestLap) state.bestLap = lapTime;
    state.lastLapTime = state.time;

    state.checkpointsCollected = 0;
    state.lastCheckpointIdx = 0;

    if (state.lap >= state.totalLaps) {
      finishGame();
      return;
    }
    state.lap++;
    lapCurrentEl.textContent = state.lap;
  }
  state.lastPosition = state.position;

  // HUD
  speedEl.textContent = Math.round(Math.abs(state.speed));
  timeEl.textContent = formatTime(state.time);
}

// ============================================================
// CAMERA
// ============================================================
function updateCamera() {
  // Subtle emissive pulse on checkpoint markers
  if (checkpointMat) {
    checkpointMat.emissiveIntensity = 0.3 + Math.sin(Date.now() / 400) * 0.15;
  }

  if (!state.started) {
    const t = Date.now() / 1000;
    const orbitRadius = 120;
    const height = 40 + Math.sin(t * 0.2) * 10;
    camera.position.set(
      Math.cos(t * 0.08) * orbitRadius,
      height,
      Math.sin(t * 0.08) * orbitRadius
    );
    camera.lookAt(0, 0, 0);
    return;
  }

  if (debugOrbitMode) {
    const t = Date.now() / 1000;
    const orbitRadius = 120;
    camera.position.set(
      Math.cos(t * 0.08) * orbitRadius,
      40,
      Math.sin(t * 0.08) * orbitRadius
    );
    camera.lookAt(playerBike.position);
    return;
  }

  // Follow camera: position behind the bike (bike's +z is forward)
  const playerPos = playerBike.position;
  let trackDir = new THREE.Vector3(0, 0, 1).applyQuaternion(playerBike.quaternion);
  
  // Guard against NaN quaternion
  if (isNaN(trackDir.x) || isNaN(trackDir.y) || isNaN(trackDir.z)) {
    trackDir.set(0, 0, 1);
  } else {
    trackDir.normalize();
  }
  
  const behind = trackDir.clone().multiplyScalar(-debugCamDist);
  const targetPos = playerPos.clone().add(behind);
  targetPos.y += debugCamHeight;

  camera.position.lerp(targetPos, 0.1);
  camera.lookAt(playerPos);

  // Boost FOV kick (visual) — widen field of view while boosting
  const targetFov = 70 + 10 * (typeof boostFovKick === 'number' ? boostFovKick : 0);
  camera.fov += (targetFov - camera.fov) * 0.15;
  camera.updateProjectionMatrix();
}

// ============================================================
// MINIMAP
// ============================================================
function updateMinimap() {
  const ctx = minimapCanvas.getContext('2d');
  const size = 120;
  const cx = size / 2;
  const cy = size / 2;

  ctx.clearRect(0, 0, size, size);

  // Background
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  ctx.fill();

  // Track outline
  ctx.strokeStyle = '#4488ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i <= 100; i++) {
    const t = i / 100;
    const p = trackGen.getPoint(t);
    const x = cx + (p.x / CONFIG.TRACK_RADIUS) * cx * 0.8;
    const y = cy - (p.z / CONFIG.TRACK_RADIUS) * cy * 0.8;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();

  // Start/finish marker
  ctx.fillStyle = '#ffffff';
  const startP = trackGen.getPoint(0);
  const sx = cx + (startP.x / CONFIG.TRACK_RADIUS) * cx * 0.8;
  const sy = cy - (startP.z / CONFIG.TRACK_RADIUS) * cy * 0.8;
  ctx.fillRect(sx - 3, sy - 3, 6, 6);

  // Player dot
  if (state.started) {
    const pp = playerBike.position;
    const px = cx + (pp.x / CONFIG.TRACK_RADIUS) * cx * 0.8;
    const py = cy - (pp.z / CONFIG.TRACK_RADIUS) * cy * 0.8;

    ctx.fillStyle = '#ff4488';
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#ff4488';
    ctx.lineWidth = 2;
    const dir = new THREE.Vector3(0, 0, 1).applyQuaternion(playerBike.quaternion);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + dir.x * 8, py - dir.z * 8);
    ctx.stroke();

    // Opponent dots
    for (const o of opponents) {
      const op = trackGen.getPoint(o.pos);
      const ox = cx + (op.x / CONFIG.TRACK_RADIUS) * cx * 0.8;
      const oy = cy - (op.z / CONFIG.TRACK_RADIUS) * cy * 0.8;
      ctx.fillStyle = `#${o.color.toString(16).padStart(6, '0')}`;
      ctx.beginPath();
      ctx.arc(ox, oy, 3, 0, Math.P * 2);
      ctx.fill();
    }
  }
}

// ============================================================
// PARTICLES
// ============================================================
class ParticleSystem {
  constructor(scene) {
    this.particles = [];
    this.scene = scene;
  }

  emit(position, color, count = 5, speed = 2) {
    for (let i = 0; i < count; i++) {
      const particle = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 4, 4),
        new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 0.5,
          transparent: true,
          opacity: 0.8,
        })
      );
      particle.position.copy(position);
      particle.position.y += 0.3;

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * speed,
        Math.random() * speed * 0.5,
        (Math.random() - 0.5) * speed
      );

      this.particles.push({
        mesh: particle,
        vel,
        life: 1.0,
        decay: 0.5 + Math.random() * 0.5,
      });

      this.scene.add(particle);
    }
  }

  update(delta) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= p.decay * delta;
      p.mesh.position.add(p.vel.clone().multiplyScalar(delta));
      p.vel.y -= 1 * delta;
      p.mesh.material.opacity = p.life * 0.8;
      p.mesh.scale.setScalar(p.life);

      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
      }
    }
  }
}

const particles = new ParticleSystem(scene);

// ============================================================
// MAIN GAME LOOP
// ============================================================
let lastTime = 0;

function gameLoop(time) {
  const delta = lastTime ? (time - lastTime) / 1000 : 0.016;
  lastTime = time;

  if (state.started && !state.finished) {
    // 3-2-1-GO countdown: freeze movement + timer until it reaches 0
    if (state.countdown > -1.0) {
      state.countdown = Math.max(-1.0, state.countdown - delta);
    }

    // Countdown overlay (3-2-1-GO!)
    if (state.countdown > 0) {
      countdownEl.classList.remove('hidden');
      countdownValueEl.textContent = String(Math.ceil(state.countdown));
    } else if (state.countdown > -0.6) {
      countdownEl.classList.remove('hidden');
      countdownValueEl.textContent = 'GO!';
    } else {
      countdownEl.classList.add('hidden');
    }

    // AI opponents — physics only after the countdown, placement always
    updateOpponents(delta, state.countdown <= 0);

    // Only run the race once the countdown has hit 0
    if (state.countdown <= 0) {
      state.time += delta;
      updatePlayer(delta);

      // HUD: player standing + lap progress
      positionEl.textContent = ordinal(computePlayerRank());
      lapProgressFill.style.width = `${state.position * 100}%`;

      // Emit particles at high speed
      if (state.speed > 30) {
        const pos = playerBike.position.clone();
        const dir = new THREE.Vector3(0, 0, 1).applyQuaternion(playerBike.quaternion);
        pos.add(dir.clone().multiplyScalar(-0.8));
        particles.emit(pos, 0x00ff88, 2, state.speed * 0.02);
      }

      // Off-track dust cue (visual) — brown dust kicked up at the bike's rear
      if (state.offTrack) {
        const dpos = playerBike.position.clone();
        const ddir = new THREE.Vector3(0, 0, 1).applyQuaternion(playerBike.quaternion);
        dpos.add(ddir.clone().multiplyScalar(-0.7));
        dpos.y -= 0.2;
        particles.emit(dpos, CONFIG.COLORS.DUST, 3, 1.5);
      }
    }
  } else if (state.started) {
    // Race over — make sure the countdown overlay is gone
    countdownEl.classList.add('hidden');
  }

  particles.update(delta);
  updateCamera();
  updateMinimap();

  renderer.render(scene, camera);
  requestAnimationFrame(gameLoop);
}
// ============================================================
// DEBUG PANEL
// ============================================================
const debugPanel = document.getElementById('debug-panel');
const dbgCamDist = document.getElementById('dbg-cam-dist');
const dbgCamHeight = document.getElementById('dbg-cam-height');
const dbgCamFov = document.getElementById('dbg-cam-fov');
const dbgLightInt = document.getElementById('dbg-light-int');
const dbgAmbientInt = document.getElementById('dbg-ambient-int');
const dbgLogPos = document.getElementById('dbg-log-pos');
const dbgResetCam = document.getElementById('dbg-reset-cam');
const dbgToggleCam = document.getElementById('dbg-toggle-cam');
const dbgInfo = document.getElementById('dbg-info');

let debugOrbitMode = false;
let debugCamDist = 10;
let debugCamHeight = 6;

// Toggle debug panel with backtick key
document.addEventListener('keydown', (e) => {
  if (e.code === 'Backquote') {
    debugPanel.classList.toggle('hidden');
  }
});

// Debug slider handlers
dbgCamDist.addEventListener('input', () => {
  debugCamDist = parseFloat(dbgCamDist.value);
  dbgInfo.textContent = `camDist=${debugCamDist} camH=${debugCamHeight}`;
});

dbgCamHeight.addEventListener('input', () => {
  debugCamHeight = parseFloat(dbgCamHeight.value);
  dbgInfo.textContent = `camDist=${debugCamDist} camH=${debugCamHeight}`;
});

dbgCamFov.addEventListener('input', () => {
  const fov = parseFloat(dbgCamFov.value);
  camera.fov = fov;
  camera.updateProjectionMatrix();
  dbgInfo.textContent = `FOV=${fov}`;
});

dbgLightInt.addEventListener('input', () => {
  const val = parseFloat(dbgLightInt.value);
  directionalLight.intensity = val;
  dbgInfo.textContent = `light=${val}`;
});

dbgAmbientInt.addEventListener('input', () => {
  const val = parseFloat(dbgAmbientInt.value);
  ambientLight.intensity = val;
  dbgInfo.textContent = `ambient=${val}`;
});

dbgLogPos.addEventListener('click', () => {
  const pp = playerBike.position;
  const cp = camera.position;
  let dir = new THREE.Vector3(0, 0, 1).applyQuaternion(playerBike.quaternion);
  if (isNaN(dir.x)) dir.set(0, 0, 1);
  
  const q = playerBike.quaternion;
  const qValid = !isNaN(q.x) && !isNaN(q.y) && !isNaN(q.z) && !isNaN(q.w);
  
  dbgInfo.innerHTML = `bike: (${pp.x.toFixed(1)}, ${pp.y.toFixed(1)}, ${pp.z.toFixed(1)})<br>cam: (${cp.x.toFixed(1)}, ${cp.y.toFixed(1)}, ${cp.z.toFixed(1)})<br>dir: (${dir.x.toFixed(2)}, ${dir.y.toFixed(2)}, ${dir.z.toFixed(2)})<br>qValid: ${qValid}<br>speed: ${Math.round(state.speed)} pos: ${state.position.toFixed(3)}`;
  console.log('=== DEBUG ===');
  console.log('Bike position:', pp);
  console.log('Camera position:', cp);
  console.log('Bike direction:', dir);
  console.log('Bike quaternion:', playerBike.quaternion);
  console.log('Quaternion valid:', qValid);
  console.log('State:', state);
});

dbgResetCam.addEventListener('click', () => {
  debugCamDist = 10;
  debugCamHeight = 6;
  dbgCamDist.value = '10';
  dbgCamHeight.value = '6';
  camera.fov = 70;
  dbgCamFov.value = '70';
  camera.updateProjectionMatrix();
  dbgInfo.textContent = 'Camera reset';
});

dbgToggleCam.addEventListener('click', () => {
  debugOrbitMode = !debugOrbitMode;
  dbgInfo.textContent = debugOrbitMode ? 'Orbit mode ON' : 'Follow mode ON';
});

// No override needed — updateCamera() already uses debugOrbitMode + debugCamDist/Height

// ============================================================
// RESIZE
// ============================================================
window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
});

// ============================================================
// START
// ============================================================
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

requestAnimationFrame(gameLoop);

console.log('🏁 Twitch Captain Bicycle Racing loaded!');
console.log('Controls: Arrow/WASD to move, Shift to boost');
console.log('Press ` (backtick) to open debug panel');
