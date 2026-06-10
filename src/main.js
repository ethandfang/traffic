import * as THREE from 'three';
import './style.css';
import { CameraRig } from './sim/CameraRig.js';
import { WorldGenerator } from './sim/WorldGenerator.js';
import { Car } from './sim/Car.js';
import { Pedestrian } from './sim/Pedestrian.js';
import { DetectionSystem } from './sim/DetectionSystem.js';
import { clamp, hashRandom, lerp, TAU } from './sim/utils.js';

const canvas = document.getElementById('app');
const hud = document.getElementById('hud');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101824);
scene.fog = new THREE.Fog(0x101824, 120, 420);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
camera.position.set(60, 62, 88);

const cameraRig = new CameraRig(camera, renderer.domElement);
cameraRig.controls.target.set(0, 0.8, 0);
cameraRig.controls.update();

const hemi = new THREE.HemisphereLight(0x9bc3e2, 0x151b25, 0.72);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xd8e4f5, 1.3);
sun.position.set(120, 180, 70);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 500;
sun.shadow.camera.left = -180;
sun.shadow.camera.right = 180;
sun.shadow.camera.top = 180;
sun.shadow.camera.bottom = -180;
scene.add(sun);

let random = hashRandom(Date.now() >>> 0);
const world = new WorldGenerator(scene, random);
const detection = new DetectionSystem(scene, camera);

let cars = [];
let pedestrians = [];
let paused = false;
let overlayEnabled = true;
let fastTime = false;
let awaitingFollowClick = false;
let followedCar = null;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let simSeconds = 0;
let fps = 60;
let fpsAccumulator = 0;
let fpsCounter = 0;
let signalState = 'NO SIGNALS';

function resetWorld() {
  random = hashRandom((Date.now() + Math.floor(Math.random() * 99999)) >>> 0);
  world.generate(random);
  detection.clear();

  for (const car of cars) scene.remove(car.group);
  for (const ped of pedestrians) scene.remove(ped.group);
  cars = [];
  pedestrians = [];

  const carPalette = [0xd85a73, 0x74b9e7, 0xcfc474, 0x8dd3a2, 0x8b8ecf, 0xdb965f, 0xb5bdcf, 0x66c3b5];

  for (let i = 0; i < 34; i += 1) {
    const car = new Car(`CAR-${101 + i}`, { world, cars, pedestrians, random }, carPalette[i % carPalette.length]);
    cars.push(car);
    scene.add(car.group);
    detection.register(car);
  }

  if (world.walkPoints.length < 24) {
    for (let i = 0; i < 30; i += 1) world.walkPoints.push(new THREE.Vector3((Math.random() - 0.5) * 180, 0, (Math.random() - 0.5) * 180));
  }

  for (let i = 0; i < 14; i += 1) {
    const start = world.walkPoints[Math.floor(random() * world.walkPoints.length)].clone();
    const ped = new Pedestrian(`PED-${String(i + 1).padStart(3, '0')}`, { world, cars, pedestrians, random }, start);
    pedestrians.push(ped);
    scene.add(ped.group);
    detection.register(ped);
  }

  followedCar = null;
  cameraRig.clearFollow();
}

function updateDayNight(dt) {
  simSeconds += dt;
  const cycle = 120;
  const t = (simSeconds % cycle) / cycle;
  const day = clamp(0.5 + 0.5 * Math.sin(TAU * (t - 0.02)), 0, 1);
  const night = 1 - day;

  const sky = world.nightSky.clone().lerp(world.daySky, day);
  scene.background.copy(sky);
  scene.fog.color.copy(sky);

  hemi.intensity = lerp(0.22, 0.8, day);
  hemi.color.setRGB(lerp(0.3, 0.62, day), lerp(0.36, 0.74, day), lerp(0.46, 0.88, day));
  sun.intensity = lerp(0.08, 1.25, day);

  const theta = t * TAU;
  sun.position.set(Math.cos(theta) * 170, lerp(12, 185, day), Math.sin(theta) * 170);

  world.updateDayNight(night);
  for (const car of cars) car.update(0, night);

  const glowCenter = world.downtownCenter || new THREE.Vector3();
  if (!scene.userData.glow) {
    const g = new THREE.Mesh(
      new THREE.SphereGeometry(40, 18, 18),
      new THREE.MeshBasicMaterial({ color: 0x6bbce8, transparent: true, opacity: 0.0, depthWrite: false }),
    );
    scene.userData.glow = g;
    scene.add(g);
  }
  scene.userData.glow.position.copy(glowCenter).setY(30);
  scene.userData.glow.material.opacity = night * 0.22;

  return { day, night };
}

function updateHUD(mode) {
  const clockSecs = Math.floor((simSeconds * 12) % (24 * 3600));
  const hh = String(Math.floor(clockSecs / 3600) % 24).padStart(2, '0');
  const mm = String(Math.floor((clockSecs % 3600) / 60)).padStart(2, '0');
  const tracked = cars.length + pedestrians.length;

  hud.textContent = [
    'CITYWORLD-01',
    `SIM ${hh}:${mm}`,
    `FPS ${Math.round(fps)}`,
    `TRACKED ${tracked}`,
    `SIGNALS ${signalState}`,
    `MODE ${mode}${awaitingFollowClick ? ' | CLICK CAR' : ''}`,
  ].join('\n');
  hud.style.display = overlayEnabled ? 'block' : 'none';
}

function onPointerDown(ev) {
  if (!awaitingFollowClick) return;
  pointer.x = (ev.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(ev.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(cars.map((c) => c.group), true);
  if (hits.length) {
    const match = cars.find((c) => c.group === hits[0].object || c.group.children.includes(hits[0].object) || c.group === hits[0].object.parent);
    if (match) {
      followedCar = match;
      cameraRig.setFollowTarget(match.group);
    }
  }
  awaitingFollowClick = false;
}

function tick(nowMs = 0) {
  requestAnimationFrame(tick);

  const now = nowMs * 0.001;
  const prev = tick.prev ?? now;
  const dt = Math.min(0.05, now - prev);
  tick.prev = now;

  fpsAccumulator += dt;
  fpsCounter += 1;
  if (fpsAccumulator > 0.3) {
    fps = fpsCounter / fpsAccumulator;
    fpsAccumulator = 0;
    fpsCounter = 0;
  }

  const timeScale = fastTime ? 4 : 1;
  cameraRig.update(dt);

  if (!paused) {
    const timed = dt * timeScale;
    const { night } = updateDayNight(timed);

    for (const light of world.trafficLights) light.update(timed);
    signalState = world.trafficLights.slice(0, 2).map((s) => s.stateText).join(' | ') || 'NO SIGNALS';

    for (const car of cars) car.update(timed, night);
    for (const ped of pedestrians) ped.update(timed);

    const all = [...cars.map((c) => c.group), ...pedestrians.map((p) => p.group)];
    for (let i = 0; i < all.length; i += 1) {
      for (let j = i + 1; j < all.length; j += 1) {
        const a = all[i];
        const b = all[j];
        const v = a.position.clone().sub(b.position);
        v.y = 0;
        const d = v.length();
        const minD = 0.5;
        if (d > 0.0001 && d < minD) {
          const n = v.normalize();
          const push = (minD - d) * 0.5;
          a.position.addScaledVector(n, push);
          b.position.addScaledVector(n, -push);
        }
      }
    }

    if (followedCar && !cars.includes(followedCar)) {
      followedCar = null;
      cameraRig.clearFollow();
    }

    detection.update(timed);
  }

  camera.position.y = Math.max(1.1, camera.position.y);
  cameraRig.controls.target.y = Math.max(0.2, cameraRig.controls.target.y);

  const mode = paused ? 'PAUSED' : fastTime ? 'FAST' : followedCar ? `FOLLOW ${followedCar.id}` : 'LIVE';
  updateHUD(mode);

  renderer.render(scene, camera);
}

window.addEventListener('pointerdown', onPointerDown);
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === ' ') {
    paused = !paused;
    return;
  }
  if (k === 'd') {
    overlayEnabled = !overlayEnabled;
    detection.setVisible(overlayEnabled);
    return;
  }
  if (k === 't') {
    fastTime = !fastTime;
    return;
  }
  if (k === 'r') {
    resetWorld();
    return;
  }
  if (k === 'f') {
    awaitingFollowClick = true;
    return;
  }
  if (k === 'escape') {
    awaitingFollowClick = false;
    followedCar = null;
    cameraRig.clearFollow();
    return;
  }
  cameraRig.onKeyDown(e);
});
window.addEventListener('keyup', (e) => cameraRig.onKeyUp(e));

resetWorld();
tick();
