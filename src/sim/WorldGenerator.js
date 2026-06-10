import * as THREE from 'three';
import { Building } from './Building.js';
import { RoadGraph } from './RoadGraph.js';
import { TrafficLight } from './TrafficLight.js';
import { clamp, normalize2, perp2, rand } from './utils.js';

export class WorldGenerator {
  constructor(scene, random) {
    this.scene = scene;
    this.random = random;
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.graph = null;
    this.trafficLights = [];
    this.trafficLightsByNode = new Map();
    this.buildings = [];
    this.walkPoints = [];
    this.majorIntersections = [];
    this.riverSide = 1;

    this.daySky = new THREE.Color(0x7d9ac2);
    this.nightSky = new THREE.Color(0x101824);
  }

  clear() {
    this.scene.remove(this.group);
    this.group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    });
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.trafficLights = [];
    this.trafficLightsByNode.clear();
    this.buildings = [];
    this.walkPoints = [];
    this.majorIntersections = [];
  }

  generate(seedRandom) {
    this.random = seedRandom;
    this.clear();
    this.graph = new RoadGraph(this.random);

    this.#createGround();
    this.#generateRoadNetwork();
    this.#renderRoads();
    this.#spawnDistrictBuildings();
    this.#spawnParksAndRiver();
    this.#spawnTrafficLights();
  }

  #createGround() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(520, 520, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x2a313d, roughness: 0.95, metalness: 0.02 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.group.add(ground);
  }

  #avenuePoints(start, end, drift, steps) {
    const points = [];
    const a = new THREE.Vector2(start.x, start.z);
    const b = new THREE.Vector2(end.x, end.z);
    const axis = b.clone().sub(a);
    const n = new THREE.Vector2(-axis.y, axis.x).normalize();
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const p = a.clone().lerp(b, t);
      const wave = Math.sin((t + this.random() * 0.3) * Math.PI * (1.1 + this.random() * 0.8));
      p.addScaledVector(n, wave * drift * (0.5 + this.random() * 0.6));
      p.x += rand(this.random, -2.2, 2.2);
      p.y += rand(this.random, -2.2, 2.2);
      points.push(new THREE.Vector3(p.x, 0, p.y));
    }
    return points;
  }

  #addPolyline(points, width = 8, type = 'main') {
    const ids = points.map((p) => this.graph.addNode(p));
    for (let i = 0; i < ids.length - 1; i += 1) {
      this.graph.addEdge(ids[i], ids[i + 1], { width, type, wobble: type === 'main' ? 3.2 : 2.2 });
    }
    return ids;
  }

  #generateRoadNetwork() {
    const b = 180;
    const avenues = [
      this.#avenuePoints(new THREE.Vector3(-b, 0, -125), new THREE.Vector3(b, 0, 90), 20, 12),
      this.#avenuePoints(new THREE.Vector3(-150, 0, 140), new THREE.Vector3(150, 0, -120), 16, 11),
      this.#avenuePoints(new THREE.Vector3(-90, 0, -170), new THREE.Vector3(-25, 0, 170), 14, 9),
    ];

    const avenueIds = avenues.map((line) => this.#addPolyline(line, 8.5, 'main'));

    for (const ids of avenueIds) {
      const branches = Math.floor(rand(this.random, 10, 16));
      for (let k = 0; k < branches; k += 1) {
        const anchorIndex = Math.floor(rand(this.random, 1, ids.length - 2));
        const anchor = ids[anchorIndex];
        const pPrev = this.graph.nodes[ids[anchorIndex - 1]];
        const pNext = this.graph.nodes[ids[anchorIndex + 1]];
        const tangent = normalize2({ x: pNext.x - pPrev.x, y: pNext.z - pPrev.z });
        const normal = perp2(tangent);
        const side = this.random() < 0.5 ? -1 : 1;
        const base = normalize2({
          x: normal.x * side + tangent.x * rand(this.random, -0.4, 0.4),
          y: normal.y * side + tangent.y * rand(this.random, -0.4, 0.4),
        });

        let cursor = new THREE.Vector2(this.graph.nodes[anchor].x, this.graph.nodes[anchor].z);
        let dir = base;
        let prev = anchor;
        const segs = Math.floor(rand(this.random, 3, 7));
        const len = rand(this.random, 38, 95);

        for (let s = 0; s < segs; s += 1) {
          const turn = rand(this.random, -0.55, 0.55);
          const c = Math.cos(turn);
          const si = Math.sin(turn);
          dir = normalize2({ x: dir.x * c - dir.y * si, y: dir.x * si + dir.y * c });
          const step = (len / segs) * rand(this.random, 0.8, 1.25);
          cursor = cursor.clone().add(new THREE.Vector2(dir.x * step, dir.y * step));
          cursor.x = clamp(cursor.x, -180, 180);
          cursor.y = clamp(cursor.y, -180, 180);
          const node = this.graph.addNode(new THREE.Vector3(cursor.x, 0, cursor.y));
          this.graph.addEdge(prev, node, { width: 5.4, type: 'side', wobble: 2.2 });
          prev = node;
        }
      }
    }

    const ids = Array.from({ length: this.graph.nodes.length }, (_, i) => i);
    for (let i = 0; i < 120; i += 1) {
      const a = ids[Math.floor(this.random() * ids.length)];
      const b2 = ids[Math.floor(this.random() * ids.length)];
      if (a === b2) continue;
      if (this.graph.edgeBetween(a, b2) !== null) continue;
      const d = this.graph.nodes[a].distanceTo(this.graph.nodes[b2]);
      if (d > 15 && d < 45 && this.random() < 0.16) {
        this.graph.addEdge(a, b2, { width: 5.1, type: 'side', wobble: 1.6 });
      }
    }
  }

  #renderRoadChunk(p0, p1, width, type) {
    const v = p1.clone().sub(p0);
    const len = Math.max(0.001, v.length());
    const mid = p0.clone().add(p1).multiplyScalar(0.5);
    const yaw = Math.atan2(v.x, v.z);

    const road = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.05, len),
      new THREE.MeshStandardMaterial({ color: type === 'main' ? 0x3d434f : 0x424854, roughness: 0.95 }),
    );
    road.position.set(mid.x, 0.02, mid.z);
    road.rotation.y = yaw;
    road.receiveShadow = true;
    this.group.add(road);

    const side = width * 0.5 + 0.9;
    for (const s of [-1, 1]) {
      const sw = new THREE.Mesh(
        new THREE.BoxGeometry(1.0, 0.06, len),
        new THREE.MeshStandardMaterial({ color: 0x5a5f68, roughness: 0.92 }),
      );
      sw.position.set(mid.x + Math.cos(yaw) * side * s, 0.04, mid.z - Math.sin(yaw) * side * s);
      sw.rotation.y = yaw;
      this.group.add(sw);
    }

    const dashes = Math.floor(len / 3);
    for (let i = 0; i < dashes; i += 1) {
      const t = (i + 0.5) / dashes;
      const p = p0.clone().lerp(p1, t);
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.02, 1.15),
        new THREE.MeshStandardMaterial({ color: 0xd6dee9, transparent: true, opacity: 0.75 }),
      );
      stripe.position.set(p.x, 0.055, p.z);
      stripe.rotation.y = yaw;
      this.group.add(stripe);
    }

    if (type === 'main') {
      const poles = Math.max(1, Math.floor(len / 24));
      for (let i = 0; i < poles; i += 1) {
        const t = (i + 0.35) / (poles + 1);
        const p = p0.clone().lerp(p1, t);
        const offset = side + 0.8;
        const px = p.x + Math.cos(yaw) * offset;
        const pz = p.z - Math.sin(yaw) * offset;

        const pole = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, 4, 0.12),
          new THREE.MeshStandardMaterial({ color: 0x4d525d, roughness: 0.8 }),
        );
        pole.position.set(px, 2, pz);
        this.group.add(pole);

        const lamp = new THREE.Mesh(
          new THREE.SphereGeometry(0.22, 8, 8),
          new THREE.MeshStandardMaterial({ color: 0x8ec9f7, emissive: 0x8ec9f7, emissiveIntensity: 0.0 }),
        );
        lamp.position.set(px, 4.1, pz);
        lamp.userData.streetLamp = true;
        this.group.add(lamp);
      }
    }
  }

  #renderIntersection(nodeId) {
    const p = this.graph.nodes[nodeId];
    const deg = (this.graph.nodeEdges.get(nodeId) || []).length;
    const r = 3.4 + deg * 0.42;
    const disk = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r, 0.05, 20),
      new THREE.MeshStandardMaterial({ color: 0x404754, roughness: 0.93 }),
    );
    disk.position.set(p.x, 0.03, p.z);
    this.group.add(disk);

    for (const edgeId of this.graph.nodeEdges.get(nodeId) || []) {
      const edge = this.graph.edges[edgeId];
      const other = edge.a === nodeId ? edge.b : edge.a;
      const d = this.graph.nodes[other].clone().sub(p).normalize();
      const yaw = Math.atan2(d.x, d.z);
      const center = p.clone().addScaledVector(d, r + 2.3);
      for (let i = 0; i < 4; i += 1) {
        const off = (i - 1.5) * 0.6;
        const stripe = new THREE.Mesh(
          new THREE.BoxGeometry(0.35, 0.02, 2.1),
          new THREE.MeshStandardMaterial({ color: 0xebf2fb, transparent: true, opacity: 0.75 }),
        );
        stripe.position.set(center.x + Math.cos(yaw) * off, 0.06, center.z - Math.sin(yaw) * off);
        stripe.rotation.y = yaw;
        this.group.add(stripe);
      }
    }
  }

  #renderRoads() {
    for (const edge of this.graph.edges) {
      const points = edge.points;
      for (let i = 0; i < points.length - 1; i += 1) {
        this.#renderRoadChunk(points[i], points[i + 1], edge.width, edge.type);
      }
      const p0 = points[0];
      const p1 = points[points.length - 1];
      const d = new THREE.Vector2(p1.x - p0.x, p1.z - p0.z).normalize();
      const n = new THREE.Vector2(-d.y, d.x);
      const off = edge.width * 0.56 + 1.0;
      this.walkPoints.push(new THREE.Vector3(p0.x + n.x * off, 0, p0.z + n.y * off));
      this.walkPoints.push(new THREE.Vector3(p1.x + n.x * off, 0, p1.z + n.y * off));
      this.walkPoints.push(new THREE.Vector3(p0.x - n.x * off, 0, p0.z - n.y * off));
      this.walkPoints.push(new THREE.Vector3(p1.x - n.x * off, 0, p1.z - n.y * off));
    }

    for (let i = 0; i < this.graph.nodes.length; i += 1) {
      const degree = (this.graph.nodeEdges.get(i) || []).length;
      if (degree >= 2) this.#renderIntersection(i);
      if (degree >= 3) this.majorIntersections.push(i);
    }
  }

  #districtAt(pos, downtownCenter) {
    const d = pos.distanceTo(downtownCenter);
    if (d < 52) return 'downtown';
    if (d < 105) return 'midrise';
    return 'residential';
  }

  #spawnDistrictBuildings() {
    const downtown = new THREE.Vector3(rand(this.random, -18, 18), 0, rand(this.random, -18, 18));
    const occupied = [];

    for (const edge of this.graph.edges) {
      const p0 = edge.points[0];
      const p1 = edge.points[edge.points.length - 1];
      const dir = new THREE.Vector2(p1.x - p0.x, p1.z - p0.z).normalize();
      const n = new THREE.Vector2(-dir.y, dir.x);
      const yaw = Math.atan2(dir.x, dir.y);
      const slots = Math.floor(edge.length / rand(this.random, 7.5, 12.5));

      for (let i = 0; i < slots; i += 1) {
        if (this.random() < 0.15) continue;
        const t = (i + rand(this.random, 0.15, 0.85)) / Math.max(1, slots);
        const c = p0.clone().lerp(p1, t);
        const side = this.random() < 0.5 ? -1 : 1;
        const setback = edge.width * 0.5 + rand(this.random, 3.3, 9.4);
        const pos = new THREE.Vector3(c.x + n.x * side * setback, 0, c.z + n.y * side * setback);

        if (Math.abs(pos.x) > 195 || Math.abs(pos.z) > 195) continue;
        if (occupied.some((q) => q.distanceToSquared(pos) < 18)) continue;
        occupied.push(pos.clone());

        const district = this.#districtAt(pos, downtown);
        const h = district === 'downtown'
          ? rand(this.random, 28, 84)
          : district === 'midrise'
            ? rand(this.random, 12, 38)
            : rand(this.random, 4, 15);
        const footprint = {
          x: rand(this.random, 3.6, district === 'downtown' ? 13 : 10),
          y: rand(this.random, 3.6, district === 'downtown' ? 13 : 10),
        };

        const b = new Building({
          position: pos,
          footprint,
          height: h,
          rotationY: yaw + rand(this.random, -0.16, 0.16),
          district,
          random: this.random,
        });
        this.group.add(b.group);
        this.buildings.push(b);
      }
    }

    this.downtownCenter = downtown;
  }

  #spawnParksAndRiver() {
    this.riverSide = this.random() < 0.5 ? -1 : 1;
    const riverX = this.riverSide * 125;

    const river = new THREE.Mesh(
      new THREE.BoxGeometry(38, 0.04, 360),
      new THREE.MeshStandardMaterial({ color: 0x2b5f87, transparent: true, opacity: 0.8, roughness: 0.2, metalness: 0.2 }),
    );
    river.position.set(riverX, 0.03, 0);
    this.group.add(river);

    for (const edge of this.graph.edges) {
      if (edge.points.some((p) => Math.abs(p.x - riverX) < 12)) {
        const z = edge.points[Math.floor(edge.points.length / 2)].z;
        const bridge = new THREE.Mesh(
          new THREE.BoxGeometry(18, 0.12, 6),
          new THREE.MeshStandardMaterial({ color: 0x6d7582, roughness: 0.84 }),
        );
        bridge.position.set(riverX, 0.09, z);
        this.group.add(bridge);
      }
    }

    for (let i = 0; i < 20; i += 1) {
      const center = new THREE.Vector3(rand(this.random, -175, 175), 0, rand(this.random, -175, 175));
      const nearest = this.graph.nodes[this.graph.closestNode(center)];
      if (center.distanceTo(nearest) < 15) continue;

      if (this.random() < 0.2) {
        const pond = new THREE.Mesh(
          new THREE.CylinderGeometry(rand(this.random, 5, 10), rand(this.random, 5, 10), 0.05, 20),
          new THREE.MeshStandardMaterial({ color: 0x3f7198, transparent: true, opacity: 0.8 }),
        );
        pond.position.set(center.x, 0.035, center.z);
        this.group.add(pond);
        continue;
      }

      if (this.random() < 0.22) {
        const sx = rand(this.random, 7, 15);
        const sz = sx * rand(this.random, 0.75, 1.25);
        const plaza = new THREE.Mesh(
          new THREE.BoxGeometry(sx, 0.04, sz),
          new THREE.MeshStandardMaterial({ color: 0x6f737c, roughness: 0.95 }),
        );
        plaza.position.set(center.x, 0.03, center.z);
        this.group.add(plaza);
        continue;
      }

      const sx = rand(this.random, 8, 18);
      const sz = sx * rand(this.random, 0.7, 1.3);
      const park = new THREE.Mesh(
        new THREE.BoxGeometry(sx, 0.04, sz),
        new THREE.MeshStandardMaterial({ color: 0x3f614f, roughness: 1 }),
      );
      park.position.set(center.x, 0.03, center.z);
      this.group.add(park);

      const trees = Math.floor(rand(this.random, 6, 16));
      for (let t = 0; t < trees; t += 1) {
        const p = center.clone();
        p.x += rand(this.random, -sx * 0.45, sx * 0.45);
        p.z += rand(this.random, -sz * 0.45, sz * 0.45);

        const trunk = new THREE.Mesh(
          new THREE.BoxGeometry(0.22, 1.4, 0.22),
          new THREE.MeshStandardMaterial({ color: 0x5f5343 }),
        );
        trunk.position.set(p.x, 0.7, p.z);
        this.group.add(trunk);

        const crown = new THREE.Mesh(
          new THREE.BoxGeometry(1.3, 1.3, 1.3),
          new THREE.MeshStandardMaterial({ color: 0x4f775f, roughness: 0.9 }),
        );
        crown.position.set(p.x, 1.8, p.z);
        this.group.add(crown);

        this.walkPoints.push(p.clone());
      }
    }
  }

  #spawnTrafficLights() {
    for (let i = 0; i < this.graph.nodes.length; i += 1) {
      const degree = (this.graph.nodeEdges.get(i) || []).length;
      if (degree >= 3 && this.random() < 0.62) {
        const light = new TrafficLight(i, this.graph.nodes[i], this.random);
        this.group.add(light.group);
        this.trafficLights.push(light);
        this.trafficLightsByNode.set(i, light);
      }
    }
  }

  updateDayNight(nightFactor) {
    for (const b of this.buildings) b.updateWindows(this.random, nightFactor);
    for (const light of this.trafficLights) light.setNightFactor(nightFactor);

    this.group.traverse((obj) => {
      if (obj.userData.streetLamp && obj.material && obj.material.emissiveIntensity !== undefined) {
        obj.material.emissiveIntensity = nightFactor * 2.1;
      }
    });
  }
}
