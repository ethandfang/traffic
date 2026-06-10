import * as THREE from 'three';
import { clamp, createLabelTexture } from './utils.js';

function createCornerTicks(size = new THREE.Vector3(1.6, 1.2, 2.2), color = 0x7ff4ff) {
  const sx = size.x / 2;
  const sy = size.y / 2;
  const sz = size.z / 2;
  const lx = sx * 0.42;
  const ly = sy * 0.42;
  const lz = sz * 0.42;

  const corners = [
    new THREE.Vector3(-sx, -sy, -sz),
    new THREE.Vector3(-sx, -sy, sz),
    new THREE.Vector3(-sx, sy, -sz),
    new THREE.Vector3(-sx, sy, sz),
    new THREE.Vector3(sx, -sy, -sz),
    new THREE.Vector3(sx, -sy, sz),
    new THREE.Vector3(sx, sy, -sz),
    new THREE.Vector3(sx, sy, sz),
  ];

  const vertices = [];
  for (const c of corners) {
    vertices.push(c.x, c.y, c.z, c.x - Math.sign(c.x) * lx, c.y - Math.sign(c.y) * ly, c.z - Math.sign(c.z) * lz);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  const m = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95 });
  return new THREE.LineSegments(g, m);
}

function createAgentLabel(text) {
  const tex = new THREE.CanvasTexture(createLabelTexture(text));
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const spr = new THREE.Sprite(mat);
  spr.scale.set(5.2, 1.3, 1);
  spr.position.set(0, 2.2, 0);
  return { sprite: spr, texture: tex };
}

class AgentOverlay {
  constructor(agent) {
    this.agent = agent;
    this.group = new THREE.Group();
    this.ticks = createCornerTicks(agent.type === 'car' ? new THREE.Vector3(1.8, 1.1, 2.9) : new THREE.Vector3(0.9, 1.7, 0.9));
    this.group.add(this.ticks);

    this.confidence = 0.82 + Math.random() * 0.14;
    const label = createAgentLabel(`${agent.id} ${this.confidence.toFixed(2)}`);
    this.label = label.sprite;
    this.labelTexture = label.texture;
    this.group.add(this.label);

    this.trailMax = 45;
    this.trail = [];
    this.trailGeom = new THREE.BufferGeometry();
    this.trailMat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.65, vertexColors: true });
    this.trailLine = new THREE.Line(this.trailGeom, this.trailMat);
  }

  update(camera, dt) {
    this.group.position.copy(this.agent.group.position);
    this.confidence = clamp(this.confidence + (Math.random() * 2 - 1) * dt * 0.25, 0.52, 0.99);

    const text = `${this.agent.id} ${this.confidence.toFixed(2)}`;
    const canvas = createLabelTexture(text);
    this.labelTexture.image = canvas;
    this.labelTexture.needsUpdate = true;

    const dist = camera.position.distanceTo(this.group.position);
    const s = clamp(0.9 + dist * 0.02, 0.9, 8.0);
    this.label.scale.set(4.8 * s * 0.22, 1.25 * s * 0.22, 1);
    this.label.lookAt(camera.position);

    this.trail.push(this.agent.group.position.clone().setY(0.08));
    if (this.trail.length > this.trailMax) this.trail.shift();
    this.trailGeom.setFromPoints(this.trail);

    const colors = [];
    for (let i = 0; i < this.trail.length; i += 1) {
      const t = i / Math.max(1, this.trail.length - 1);
      const glow = 0.2 + 0.8 * t;
      colors.push(0.2 * glow, 0.85 * glow, 1.0 * glow);
    }
    this.trailGeom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  }
}

export class DetectionSystem {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.entries = [];
    this.visible = true;
  }

  clear() {
    this.scene.remove(this.group);
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.entries = [];
  }

  register(agent) {
    const entry = new AgentOverlay(agent);
    this.entries.push(entry);
    this.group.add(entry.group);
    this.group.add(entry.trailLine);
  }

  setVisible(v) {
    this.visible = v;
    this.group.visible = v;
  }

  update(dt) {
    if (!this.visible) return;
    for (const e of this.entries) e.update(this.camera, dt);
  }
}
