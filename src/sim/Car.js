import * as THREE from 'three';
import { clamp, rand } from './utils.js';

export class Car {
  constructor(id, sim, colorHex) {
    this.sim = sim;
    this.id = id;
    this.type = 'car';
    this.random = sim.random;

    this.group = new THREE.Group();
    this.group.userData.agent = this;

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.35, 0.65, 2.5),
      new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.52, metalness: 0.24 }),
    );
    body.position.y = 0.45;
    body.castShadow = true;
    this.group.add(body);

    this.headlightL = new THREE.Mesh(
      new THREE.ConeGeometry(0.25, 1.8, 8, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x9ad8ff, transparent: true, opacity: 0.0, depthWrite: false }),
    );
    this.headlightL.position.set(-0.35, 0.45, 1.8);
    this.headlightL.rotation.x = Math.PI / 2;
    this.group.add(this.headlightL);

    this.headlightR = this.headlightL.clone();
    this.headlightR.position.x = 0.35;
    this.group.add(this.headlightR);

    this.maxSpeed = rand(this.random, 8.0, 13.0);
    this.accel = rand(this.random, 4.5, 6.2);
    this.brake = rand(this.random, 7.0, 10.8);
    this.followDistance = rand(this.random, 4.5, 7.3);
    this.speed = 0;

    this.routeNodes = [];
    this.routeEdges = [];
    this.edgeIndex = 0;
    this.edgeDistance = 0;
    this.forward = true;
    this.laneOffset = 1.0;

    this.reroute();
  }

  reroute() {
    const g = this.sim.world.graph;
    let start = Math.floor(this.random() * g.nodes.length);
    let goal = Math.floor(this.random() * g.nodes.length);
    for (let i = 0; i < 8 && goal === start; i += 1) goal = Math.floor(this.random() * g.nodes.length);
    const path = g.findPath(start, goal);
    if (!path || path.edgePath.length === 0) return;
    this.routeNodes = path.nodePath;
    this.routeEdges = path.edgePath;
    this.edgeIndex = 0;
    this.edgeDistance = rand(this.random, 0, 1.0);
    const first = g.edges[this.routeEdges[0]];
    this.forward = first.a === this.routeNodes[0] && first.b === this.routeNodes[1];
    this.syncTransform();
  }

  currentEdgeId() {
    if (this.edgeIndex < 0 || this.edgeIndex >= this.routeEdges.length) return null;
    return this.routeEdges[this.edgeIndex];
  }

  syncTransform() {
    const edgeId = this.currentEdgeId();
    if (edgeId === null) return;
    const lane = this.forward ? this.laneOffset : -this.laneOffset;
    const sample = this.sim.world.graph.sampleEdge(edgeId, this.edgeDistance, this.forward, lane);
    this.group.position.copy(sample.pos);
    this.group.position.y = 0.02;
    this.group.rotation.y = Math.atan2(sample.dir.x, sample.dir.z);
  }

  desiredSpeed() {
    const edgeId = this.currentEdgeId();
    if (edgeId === null) return 0;
    let desired = this.maxSpeed;

    for (const other of this.sim.cars) {
      if (other === this) continue;
      if (other.currentEdgeId() !== edgeId || other.forward !== this.forward) continue;
      const gap = other.edgeDistance - this.edgeDistance;
      if (gap > 0 && gap < this.followDistance) {
        desired = Math.min(desired, this.maxSpeed * clamp((gap - 1.0) / this.followDistance, 0, 1));
      }
    }

    const g = this.sim.world.graph;
    const edge = g.edges[edgeId];
    const remaining = edge.length - this.edgeDistance;
    const endNode = this.forward ? edge.b : edge.a;

    const light = this.sim.world.trafficLightsByNode.get(endNode);
    if (light && remaining < 8.2) {
      const dir = g.edgeDirectionAtEnd(edgeId, this.forward);
      if (!light.canCarPass(dir)) {
        desired = Math.min(desired, this.maxSpeed * clamp((remaining - 0.8) / 6.2, 0, 1));
      }
    }

    if (!light && remaining < 4.8) {
      const p = g.nodes[endNode];
      for (const other of this.sim.cars) {
        if (other === this) continue;
        if (other.group.position.distanceTo(p) < 3.6) {
          desired = 0;
          break;
        }
      }
    }

    return desired;
  }

  update(dt, nightFactor) {
    if (this.routeEdges.length === 0) {
      this.reroute();
      return;
    }

    const desired = this.desiredSpeed();
    if (desired > this.speed) this.speed = Math.min(desired, this.speed + this.accel * dt);
    else this.speed = Math.max(desired, this.speed - this.brake * dt);

    let travel = this.speed * dt;
    const g = this.sim.world.graph;
    while (travel > 0.0001 && this.currentEdgeId() !== null) {
      const edge = g.edges[this.currentEdgeId()];
      const remain = edge.length - this.edgeDistance;
      const step = Math.min(remain, travel);
      this.edgeDistance += step;
      travel -= step;

      if (this.edgeDistance >= edge.length - 0.0001) {
        this.edgeIndex += 1;
        this.edgeDistance = 0;
        if (this.edgeIndex >= this.routeEdges.length) {
          this.reroute();
          break;
        }
        const cur = this.routeNodes[this.edgeIndex];
        const next = this.routeNodes[this.edgeIndex + 1];
        const e = g.edges[this.routeEdges[this.edgeIndex]];
        this.forward = e.a === cur && e.b === next;
      }
    }

    this.syncTransform();
    this.headlightL.material.opacity = nightFactor * 0.48;
    this.headlightR.material.opacity = nightFactor * 0.48;
  }
}
