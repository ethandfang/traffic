import * as THREE from 'three';
import { rand } from './utils.js';

export class Pedestrian {
  constructor(id, sim, startPos) {
    this.id = id;
    this.type = 'pedestrian';
    this.sim = sim;
    this.random = sim.random;

    this.group = new THREE.Group();
    this.group.userData.agent = this;

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 1.6, 0.5),
      new THREE.MeshStandardMaterial({ color: 0xb8c6d8, roughness: 0.85 }),
    );
    body.position.y = 0.8;
    body.castShadow = true;
    this.group.add(body);

    this.group.position.copy(startPos);
    this.group.position.y = 0.02;
    this.speed = rand(this.random, 1.4, 2.3);
    this.wait = 0;
    this.target = startPos.clone();
    this.pickTarget();
  }

  pickTarget() {
    const points = this.sim.world.walkPoints;
    if (!points.length) return;
    this.target = points[Math.floor(this.random() * points.length)].clone();
  }

  update(dt) {
    if (this.wait > 0) {
      this.wait -= dt;
      return;
    }

    const v = this.target.clone().sub(this.group.position);
    v.y = 0;
    const d = v.length();

    if (d < 0.6) {
      this.pickTarget();
      this.wait = rand(this.random, 0.1, 0.5);
      return;
    }

    const node = this.sim.world.graph.closestNode(this.group.position);
    const nodePos = this.sim.world.graph.nodes[node];
    const signal = this.sim.world.trafficLightsByNode.get(node);
    if (signal && nodePos.distanceTo(this.group.position) < 2.2 && !signal.walkAllowed()) {
      this.wait = rand(this.random, 0.2, 0.6);
      return;
    }

    const move = v.normalize();

    for (const other of this.sim.pedestrians) {
      if (other === this) continue;
      const away = this.group.position.clone().sub(other.group.position);
      away.y = 0;
      const dist = away.length();
      if (dist > 0.001 && dist < 0.85) move.addScaledVector(away.normalize(), 0.9);
    }

    move.normalize();
    this.group.position.addScaledVector(move, this.speed * dt);
    this.group.rotation.y = Math.atan2(move.x, move.z);
  }
}
