import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

// ============================================================
// GAME CONFIG
// ============================================================
const CONFIG = {
  LAPS: 3,
  TRACK_RADIUS: 80,
  TRACK_WIDTH: 12,
  MAX_SPEED: 120,
  BOOST_SPEED: 180,
  ACCELERATION: 8,
  BRAKE_FORCE: 6,
  TURN_SPEED: 2.5,
  FRICTION: 0.98,
  GRAVITY: 0.5,
  COLORS: {
    TRACK: 0x444466,
    TRACK_LINE: 0x88aaff,
    GRASS: 0x44aa44,
    SKY: 0x1a1a2e,
    BIKE: 0xff4488,
    BIKE_WHEEL: 0x222233,
    BOOST_GLOW: 0x00ff88,
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

lapTotalEl.textContent = CONFIG.LAPS;

// ============================================================
// THREE.JS SETUP
// ============================================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(CONFIG.COLORS.SKY);
scene.fog = new THREE.Fog(CONFIG.COLORS.SKY, 100, 300);

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
renderer.toneMappingExposure = 1.2;

// ============================================================
// LIGHTING
// ============================================================
const ambientLight = new THREE.AmbientLight(0x222244, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffeedd, 1.5);
directionalLight.position.set(50, 100, 30);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 1024;
directionalLight.shadow.mapSize.height = 1024;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 300;
directionalLight.shadow.camera.left = -150;
directionalLight.shadow.camera.right = 150;
directionalLight.shadow.camera.top = 150;
directionalLight.shadow.camera.bottom = -150;
scene.add(directionalLight);

const hemisphereLight = new THREE.HemisphereLight(0x4488ff, 0x002244, 0.6);
scene.add(hemisphereLight);

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

    // Generate a closed loop track with curves and elevation changes
    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) * Math.PI * 2;
      
      // Base circle
      const baseRadius = this.radius;
      let x = Math.cos(t) * baseRadius;
      let z = Math.sin(t) * baseRadius;
      
      // Add some variation - sine waves for curves
      const variation = 0.15;
      const curveOffset = Math.sin(t * 3) * baseRadius * variation;
      x += Math.cos(t) * curveOffset;
      z += Math.sin(t) * curveOffset;
      
      // Add some sharp turns
      const sharpTurn = Math.sin(t * 2 + 1.5) * baseRadius * 0.08;
      x += Math.cos(t * 2) * sharpTurn;
      z += Math.sin(t * 2) * sharpTurn;

      // Elevation - hills and loops
      let y = 0;
      // Main hills
      y += Math.sin(t * 2) * 8;
      y += Math.sin(t * 3 + 1) * 5;
      // Loop section - steep hill
      const loopFactor = Math.sin(t * 4 - 2) * 0.5 + 0.5;
      y += loopFactor * 12;
      // Jump ramp
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
    const frac = (t * this.segments) % 1;
    
    const p1 = this.trackPoints[idx];
    const p2 = this.trackPoints[nextIdx];
    
    const dir = new THREE.Vector3().subVectors(p2, p1).normalize();
    // Rotate 90 degrees to get normal (perpendicular to direction and up)
    const up = new THREE.Vector3(0, 1, 0);
    const normal = new THREE.Vector3().crossVectors(dir, up).normalize();
    return normal;
  }

  buildTrackMesh(scene) {
    const segments = this.segments;
    const halfWidth = this.trackWidth / 2;
    const trackHeight = 0.3;

    // Build road surface
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

      // Road surface vertices
      const v1 = new THREE.Vector3().copy(p1).add(n1.clone().multiplyScalar(halfWidth));
      const v2 = new THREE.Vector3().copy(p1).add(n1.clone().multiplyScalar(-halfWidth));
      const v3 = new THREE.Vector3().copy(p2).add(n2.clone().multiplyScalar(halfWidth));
      const v4 = new THREE.Vector3().copy(p2).add(n2.clone().multiplyScalar(-halfWidth));

      // Lower the road slightly into the ground
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

      // Color based on elevation
      const color = new THREE.Color(CONFIG.COLORS.TRACK);
      const bright = 0.3 + (p1.y / 30) * 0.4;
      color.multiplyScalar(Math.max(0.3, Math.min(1, bright)));
      for (let c = 0; c < 4; c++) {
        colors.push(color.r, color.g, color.b);
      }

      // Two triangles per quad
      indices.push(baseIdx, baseIdx + 1, baseIdx + 2);
      indices.push(baseIdx + 1, baseIdx + 3, baseIdx + 2);
    }

    roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    roadGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    roadGeo.setIndex(indices);
    roadGeo.computeVertexNormals();

    const roadMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.8,
      metalness: 0.2,
    });
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.receiveShadow = true;
    road.castShadow = true;
    scene.add(road);

    // Track center line (checkered pattern)
    const lineMat = new THREE.MeshStandardMaterial({
      color: CONFIG.COLORS.TRACK_LINE,
      emissive: CONFIG.COLORS.TRACK_LINE,
      emissiveIntensity: 0.1,
    });

    for (let i = 0; i < segments; i += 4) {
      const p = this.trackPoints[i];
      const n = this.getNormal(i / segments);
      const center = new THREE.Vector3().copy(p).add(n.clone().multiplyScalar(0));
      center.y -= trackHeight - 0.01;
      
      const lineGeo = new THREE.BoxGeometry(0.3, 0.05, 1.5);
      const line = new THREE.Mesh(lineGeo, lineMat);
      line.position.copy(center);
      line.position.y += 0.02;
      scene.add(line);
    }

    // Barriers / walls on edges
    const barrierMat = new THREE.MeshStandardMaterial({
      color: 0xff4444,
      emissive: 0xff4444,
      emissiveIntensity: 0.05,
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

    // Start/finish line
    const startMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 0.3,
    });
    const startLine = new THREE.Mesh(
      new THREE.PlaneGeometry(this.trackWidth * 0.8, 0.5),
      startMat
    );
    const startPos = this.trackPoints[0];
    const startNormal = this.getNormal(0);
    startLine.position.copy(startPos);
    startLine.position.y += 0.05;
    startLine.lookAt(startPos.clone().add(startNormal));
    startLine.rotateX(Math.PI / 2);
    scene.add(startLine);

    return road;
  }
}

// ============================================================
// SCENERY GENERATION
// ============================================================
function generateScenery(scene, trackGen) {
  // Ground plane
  const groundGeo = new THREE.PlaneGeometry(400, 400);
  const groundMat = new THREE.MeshStandardMaterial({
    color: CONFIG.COLORS.GRASS,
    roughness: 1,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.5;
  ground.receiveShadow = true;
  scene.add(ground);

  // Trees around the track
  const treeMat = new THREE.MeshStandardMaterial({
    color: 0x338833,
    roughness: 0.9,
  });
  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x664422,
    roughness: 1,
  });

  for (let i = 0; i < 120; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = CONFIG.TRACK_RADIUS + 15 + Math.random() * 30;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    
    // Skip if too close to track
    const trackDist = Math.abs(Math.sqrt(x*x + z*z) - CONFIG.TRACK_RADIUS);
    if (trackDist < 10) continue;

    const height = 3 + Math.random() * 5;
    
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.3, height * 0.3, 6),
      trunkMat
    );
    trunk.position.set(x, height * 0.15, z);
    trunk.castShadow = true;
    scene.add(trunk);

    const foliage = new THREE.Mesh(
      new THREE.SphereGeometry(1 + Math.random() * 1.5, 6, 6),
      treeMat
    );
    foliage.position.set(x, height * 0.6, z);
    foliage.castShadow = true;
    scene.add(foliage);
  }

  // Scattered rocks
  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x666677,
    roughness: 0.9,
  });
  for (let i = 0; i < 50; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = CONFIG.TRACK_RADIUS + 5 + Math.random() * 25;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist;
    
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.3 + Math.random() * 0.5),
      rockMat
    );
    rock.position.set(x, 0, z);
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    rock.castShadow = true;
    scene.add(rock);
  }

  // Light poles along track
  const poleMat = new THREE.MeshStandardMaterial({
    color: 0x888899,
    roughness: 0.5,
    metalness: 0.5,
  });
  const lightMat = new THREE.MeshStandardMaterial({
    color: 0xffffaa,
    emissive: 0xffffaa,
    emissiveIntensity: 0.5,
  });

  for (let i = 0; i < 40; i++) {
    const t = i / 40;
    const p = trackGen.getPoint(t);
    const n = trackGen.getNormal(t);
    
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.12, 3, 6),
      poleMat
    );
    const side = (i % 2 === 0) ? 1 : -1;
    pole.position.copy(p);
    pole.position.add(n.clone().multiplyScalar(side * (CONFIG.TRACK_WIDTH / 2 + 0.5)));
    pole.position.y += 1.5;
    pole.castShadow = true;
    scene.add(pole);

    const light = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 6, 6),
      lightMat
    );
    light.position.copy(pole.position);
    light.position.y += 1.5;
    scene.add(light);
  }

  // Checkpoints with glow
  const cpMat = new THREE.MeshStandardMaterial({
    color: 0x00ff88,
    emissive: 0x00ff88,
    emissiveIntensity: 0.2,
    transparent: true,
    opacity: 0.3,
  });

  for (let i = 0; i < 8; i++) {
    const t = i / 8;
    const p = trackGen.getPoint(t);
    const n = trackGen.getNormal(t);
    
    const cp = new THREE.Mesh(
      new THREE.BoxGeometry(CONFIG.TRACK_WIDTH * 0.9, 0.1, 0.5),
      cpMat
    );
    cp.position.copy(p);
    cp.position.y += 0.1;
    cp.lookAt(p.clone().add(n));
    cp.rotateX(Math.PI / 2);
    scene.add(cp);
  }
}

// ============================================================
// BICYCLE CONSTRUCTION
// ============================================================
function buildBicycle() {
  const group = new THREE.Group();

  // Materials
  const frameMat = new THREE.MeshStandardMaterial({
    color: CONFIG.COLORS.BIKE,
    roughness: 0.3,
    metalness: 0.7,
    emissive: CONFIG.COLORS.BIKE,
    emissiveIntensity: 0.05,
  });
  const wheelMat = new THREE.MeshStandardMaterial({
    color: CONFIG.COLORS.BIKE_WHEEL,
    roughness: 0.8,
    metalness: 0.2,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0x00ff88,
    emissive: 0x00ff88,
    emissiveIntensity: 0.1,
  });

  // Frame - main triangle
  const frameGeo = new THREE.BoxGeometry(0.3, 0.3, 1.2);
  const frame = new THREE.Mesh(frameGeo, frameMat);
  frame.position.set(0, 0.4, 0);
  frame.castShadow = true;
  group.add(frame);

  // Frame - front tube
  const tubeGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.8, 8);
  const tube = new THREE.Mesh(tubeGeo, frameMat);
  tube.position.set(0, 0.8, 0.6);
  tube.rotation.x = 0.2;
  tube.castShadow = true;
  group.add(tube);

  // Handlebars
  const barGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.6, 8);
  const bar = new THREE.Mesh(barGeo, accentMat);
  bar.position.set(0, 1.0, 0.65);
  bar.rotation.z = Math.PI / 2;
  bar.castShadow = true;
  group.add(bar);

  // Handlebar grips
  const gripMat = new THREE.MeshStandardMaterial({ color: 0x222233 });
  for (let side = -1; side <= 1; side += 2) {
    const grip = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 6, 6),
      gripMat
    );
    grip.position.set(side * 0.35, 1.0, 0.65);
    group.add(grip);
  }

  // Seat
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x222233 });
  const seat = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.05, 0.3),
    seatMat
  );
  seat.position.set(0, 0.9, -0.3);
  group.add(seat);

  // Seat post
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 0.3, 6),
    frameMat
  );
  post.position.set(0, 0.75, -0.3);
  group.add(post);

  // Rear wheel
  const wheelGroup1 = new THREE.Group();
  const wheelGeo = new THREE.TorusGeometry(0.35, 0.06, 8, 16);
  const wheel1 = new THREE.Mesh(wheelGeo, wheelMat);
  wheel1.castShadow = true;
  wheelGroup1.add(wheel1);

  // Spokes
  const spokeMat = new THREE.MeshStandardMaterial({ color: 0x555566 });
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const spoke = new THREE.Mesh(
      new THREE.CylinderGeometry(0.01, 0.01, 0.3, 3),
      spokeMat
    );
    spoke.position.set(Math.cos(angle) * 0.17, Math.sin(angle) * 0.17, 0);
    spoke.rotation.x = Math.PI / 2;
    spoke.lookAt(new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0));
    wheelGroup1.add(spoke);
  }

  // Hub
  const hubMat = new THREE.MeshStandardMaterial({ color: 0x888899, metalness: 0.5 });
  const hub = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 8, 8),
    hubMat
  );
  hub.position.set(0, 0, 0);
  wheelGroup1.add(hub);

  wheelGroup1.position.set(0, 0.35, -0.55);
  group.add(wheelGroup1);

  // Front wheel
  const wheelGroup2 = wheelGroup1.clone();
  wheelGroup2.position.set(0, 0.35, 0.6);
  group.add(wheelGroup2);

  // Pedals
  const pedalMat = new THREE.MeshStandardMaterial({ color: 0x444455 });
  for (let side = -1; side <= 1; side += 2) {
    const pedal = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.04, 0.12),
      pedalMat
    );
    pedal.position.set(side * 0.15, 0.35, 0);
    group.add(pedal);
  }

  // Chain (decorative)
  const chainMat = new THREE.MeshStandardMaterial({ color: 0x555566 });
  for (let i = 0; i < 8; i++) {
    const t = i / 8;
    const chain = new THREE.Mesh(
      new THREE.TorusGeometry(0.02, 0.01, 4, 4),
      chainMat
    );
    chain.position.set(0, 0.35 + Math.sin(t * Math.PI * 2) * 0.1, -0.1 + Math.cos(t * Math.PI * 2) * 0.1);
    group.add(chain);
  }

  // Boost glow ring (around rear wheel)
  const glowMat = new THREE.MeshStandardMaterial({
    color: CONFIG.COLORS.BOOST_GLOW,
    emissive: CONFIG.COLORS.BOOST_GLOW,
    emissiveIntensity: 0.5,
    transparent: true,
    opacity: 0.3,
  });
  const glowRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.4, 0.04, 8, 16),
    glowMat
  );
  glowRing.position.set(0, 0.35, -0.55);
  glowRing.visible = false;
  group.add(glowRing);

  group.userData = { wheel1: wheelGroup1, wheel2: wheelGroup2, glowRing };

  return group;
}

// ============================================================
// GAME STATE
// ============================================================
const state = {
  started: false,
  finished: false,
  paused: false,
  lap: 1,
  totalLaps: CONFIG.LAPS,
  time: 0,
  bestLap: Infinity,
  speed: 0,
  turn: 0,
  position: 0, // track progress (0-1)
  boost: false,
  boostEnergy: 100,
  boostRecharge: 0,
  checkpoints: 0,
  totalCheckpoints: 8,
  ghostData: null,
};

// ============================================================
// PLAYER SETUP
// ============================================================
const trackGen = new TrackGenerator();
trackGen.buildTrackMesh(scene);
generateScenery(scene, trackGen);

const playerBike = buildBicycle();
playerBike.scale.set(0.8, 0.8, 0.8);
scene.add(playerBike);

// Position at start
const startPos = trackGen.getPoint(0);
const startNormal = trackGen.getNormal(0);
playerBike.position.copy(startPos);
playerBike.position.y += 0.5;

// Ghost bike
const ghostBike = buildBicycle();
ghostBike.scale.set(0.8, 0.8, 0.8);
ghostBike.visible = false;
const ghostMat = new THREE.MeshStandardMaterial({
  color: 0x4488ff,
  transparent: true,
  opacity: 0.3,
  roughness: 0.5,
});
ghostBike.children.forEach(child => {
  if (child.isMesh) {
    child.material = ghostMat;
  }
});
scene.add(ghostBike);

// ============================================================
// INPUT HANDLING
// ============================================================
const keys = {
  up: false,
  down: false,
  left: false,
  right: false,
  boost: false,
};

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

// Touch controls for mobile
let touchId = null;
canvas.addEventListener('touchstart', (e) => {
  if (!state.started) {
    startGame();
    return;
  }
  touchId = e.touches[0].identifier;
  // Map touch position to controls
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

canvas.addEventListener('touchend', (e) => {
  keys.up = false;
  keys.down = false;
  keys.left = false;
  keys.right = false;
});

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
  state.boostEnergy = 100;
  state.checkpoints = 0;
  
  startScreen.classList.add('hidden');
  finishScreen.classList.add('hidden');
  
  // Reset player position
  const pos = trackGen.getPoint(0);
  const norm = trackGen.getNormal(0);
  playerBike.position.copy(pos);
  playerBike.position.y += 0.5;
  
  // Reset ghost
  ghostBike.visible = false;
}

function finishGame() {
  state.finished = true;
  const totalTime = state.time;
  const minutes = Math.floor(totalTime / 60);
  const seconds = totalTime % 60;
  finalTimeEl.textContent = `${String(minutes).padStart(2, '0')}:${seconds.toFixed(1).padStart(4, '0')}`;
  finalPositionEl.textContent = '1st';
  finishScreen.classList.remove('hidden');
}

function updatePlayer(delta) {
  if (!state.started || state.finished) return;

  const dt = Math.min(delta, 0.05); // Cap delta
  
  // Boost
  if (keys.boost && state.boostEnergy > 0) {
    state.boost = true;
    state.boostEnergy -= 0.5;
  } else {
    state.boost = false;
    if (state.boostEnergy < 100) state.boostEnergy += 0.3;
  }
  state.boostEnergy = Math.max(0, Math.min(100, state.boostEnergy));

  // Acceleration
  if (keys.up) {
    state.speed += CONFIG.ACCELERATION * dt * (state.boost ? 1.5 : 1);
  }
  if (keys.down) {
    state.speed -= CONFIG.BRAKE_FORCE * dt * 2;
  }

  // Friction
  state.speed *= CONFIG.FRICTION;

  // Speed limits
  const maxSpeed = state.boost ? CONFIG.BOOST_SPEED : CONFIG.MAX_SPEED;
  state.speed = Math.max(-20, Math.min(maxSpeed, state.speed));

  // Turning
  const turnAmount = CONFIG.TURN_SPEED * dt;
  if (keys.left) state.turn -= turnAmount;
  if (keys.right) state.turn += turnAmount;
  state.turn *= 0.95; // Return to center

  // Movement along track
  const speedFactor = state.speed / CONFIG.MAX_SPEED;
  const moveAmount = state.speed * dt / CONFIG.TRACK_RADIUS;
  state.position = (state.position + moveAmount) % 1;
  if (state.position < 0) state.position += 1;

  // Get current track position
  const pos = trackGen.getPoint(state.position);
  const norm = trackGen.getNormal(state.position);
  
  // Apply lateral offset based on turning
  const lateralOffset = state.turn * 0.5;
  const lateralVec = norm.clone().multiplyScalar(lateralOffset);
  
  playerBike.position.copy(pos);
  playerBike.position.add(lateralVec);
  playerBike.position.y += 0.5;

  // Orient bike along track direction
  const nextPos = trackGen.getPoint((state.position + 0.01) % 1);
  const dir = new THREE.Vector3().subVectors(nextPos, pos).normalize();
  
  // Bike lean based on turn
  const leanAngle = state.turn * 0.3;
  const targetQuat = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const forward = dir.clone();
  const right = new THREE.Vector3().crossVectors(forward, up).normalize();
  const adjustedUp = new THREE.Vector3().lerp(up, right.clone().multiplyScalar(Math.sin(leanAngle)).add(up.clone().multiplyScalar(Math.cos(leanAngle))), 0.5).normalize();
  
  const m = new THREE.Matrix4();
  m.lookAt(new THREE.Vector3(), forward, adjustedUp);
  targetQuat.setFromRotationMatrix(m);
  playerBike.quaternion.slerp(targetQuat, 0.3);

  // Wheel rotation animation
  const wheelRot = state.speed * dt * 5;
  playerBike.userData.wheel1.rotation.x += wheelRot;
  playerBike.userData.wheel2.rotation.x += wheelRot;

  // Boost glow
  const glowRing = playerBike.children.find(c => c.userData?.glowRing);
  if (glowRing) {
    glowRing.visible = state.boost;
    glowRing.material.emissiveIntensity = state.boost ? 0.5 + Math.sin(state.time * 10) * 0.3 : 0;
  }

  // Checkpoint detection
  const checkpointIdx = Math.floor(state.position * state.totalCheckpoints);
  if (checkpointIdx > state.checkpoints) {
    state.checkpoints = checkpointIdx;
  }

  // Lap detection (cross start/finish)
  if (state.position > 0.9 && state.position < 0.95) {
    // Check if we've completed a lap
    if (state.checkpoints >= state.totalCheckpoints - 1) {
      state.lap++;
      state.checkpoints = 0;
      
      if (state.lap > state.totalLaps) {
        finishGame();
        return;
      }
      
      // Update lap display
      lapCurrentEl.textContent = state.lap;
      
      // Store ghost data
      if (state.time < state.bestLap) {
        state.bestLap = state.time;
        state.ghostData = {
          positions: [],
          times: [],
        };
      }
    }
  }

  // Update HUD
  speedEl.textContent = Math.round(Math.abs(state.speed));
  const totalTime = state.time;
  const minutes = Math.floor(totalTime / 60);
  const seconds = totalTime % 60;
  timeEl.textContent = `${String(minutes).padStart(2, '0')}:${seconds.toFixed(1).padStart(4, '0')}`;
}

// ============================================================
// CAMERA
// ============================================================
function updateCamera() {
  if (!state.started) {
    // Orbit around start position
    const time = Date.now() / 1000;
    const radius = 30;
    camera.position.set(
      Math.cos(time * 0.1) * radius,
      15 + Math.sin(time * 0.15) * 5,
      Math.sin(time * 0.1) * radius
    );
    camera.lookAt(0, 0, 0);
    return;
  }

  // Third-person camera following player
  const playerPos = playerBike.position;
  const cameraOffset = new THREE.Vector3(0, 6, -10);
  
  // Transform offset by player rotation
  const offset = cameraOffset.clone().applyQuaternion(playerBike.quaternion);
  const targetPos = playerPos.clone().add(offset);
  
  // Smooth follow
  camera.position.lerp(targetPos, 0.1);
  camera.lookAt(playerPos);
}

// ============================================================
// MINIMAP
// ============================================================
function updateMinimap() {
  const ctx = minimapCanvas.getContext('2d');
  const size = 120;
  const cx = size / 2;
  const cy = size / 2;
  const scale = 1.5;

  ctx.clearRect(0, 0, size, size);

  // Background
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.beginPath();
  ctx.arc(cx, cy, size/2, 0, Math.PI * 2);
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
    
    // Direction indicator
    ctx.strokeStyle = '#ff4488';
    ctx.lineWidth = 2;
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(playerBike.quaternion);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + dir.x * 8, py - dir.z * 8);
    ctx.stroke();
  }
}

// ============================================================
// PARTICLES / EFFECTS
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
          color: color,
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
        vel: vel,
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
let frameCount = 0;

function gameLoop(time) {
  const delta = lastTime ? (time - lastTime) / 1000 : 0.016;
  lastTime = time;
  frameCount++;

  // Update game state
  if (state.started && !state.finished) {
    state.time += delta;
    updatePlayer(delta);
    
    // Emit particles when moving fast
    if (state.speed > 30) {
      const pos = playerBike.position.clone();
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(playerBike.quaternion);
      pos.add(dir.clone().multiplyScalar(-0.8));
      particles.emit(pos, 0x00ff88, 2, state.speed * 0.02);
    }
  }

  particles.update(delta);
  updateCamera();
  updateMinimap();

  // Render
  renderer.render(scene, camera);
  requestAnimationFrame(gameLoop);
}

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

// Start the loop
requestAnimationFrame(gameLoop);

// ============================================================
// KEYBOARD SHORTCUTS
// ============================================================
console.log('🏁 Twitch Captain Bicycle Racing loaded!');
console.log('Controls: Arrow/WASD to move, Shift to boost');
