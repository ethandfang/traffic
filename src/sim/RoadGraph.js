import * as THREE from 'three';
import { clamp, normalize2, perp2 } from './utils.js';

export class RoadGraph {
  constructor(random) {
    this.random = random;
    this.nodes = [];
    this.edges = [];
    this.nodeEdges = new Map();
  }

  addNode(pos) {
    const i = this.nodes.length;
    this.nodes.push(pos.clone());
    this.nodeEdges.set(i, []);
    return i;
  }

  addEdge(a, b, opts = {}) {
    const points = this.#curvedPoints(this.nodes[a], this.nodes[b], opts.wobble ?? 6);
    const cum = [0];
    for (let i = 1; i < points.length; i += 1) {
      cum.push(cum[cum.length - 1] + points[i].distanceTo(points[i - 1]));
    }
    const edge = {
      a,
      b,
      type: opts.type ?? 'side',
      width: opts.width ?? 5,
      points,
      cum,
      length: cum[cum.length - 1],
    };
    const id = this.edges.length;
    this.edges.push(edge);
    this.nodeEdges.get(a).push(id);
    this.nodeEdges.get(b).push(id);
    return id;
  }

  #curvedPoints(pa, pb, wobble) {
    const a = new THREE.Vector2(pa.x, pa.z);
    const b = new THREE.Vector2(pb.x, pb.z);
    const axis = b.clone().sub(a);
    const n = new THREE.Vector2(-axis.y, axis.x).normalize();
    const mid = a.clone().lerp(b, 0.5);
    const bend = (this.random() * 2 - 1) * wobble;
    const control = mid.addScaledVector(n, bend);
    const out = [];
    const steps = 10;
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const p = new THREE.Vector2()
        .addScaledVector(a, (1 - t) * (1 - t))
        .addScaledVector(control, 2 * (1 - t) * t)
        .addScaledVector(b, t * t);
      out.push(new THREE.Vector3(p.x, 0, p.y));
    }
    return out;
  }

  neighbors(node) {
    const out = [];
    for (const edgeId of this.nodeEdges.get(node) || []) {
      const e = this.edges[edgeId];
      const n = e.a === node ? e.b : e.a;
      out.push({ node: n, edgeId, cost: e.length });
    }
    return out;
  }

  closestNode(pos) {
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < this.nodes.length; i += 1) {
      const d = this.nodes[i].distanceToSquared(pos);
      if (d < bestDist) {
        best = i;
        bestDist = d;
      }
    }
    return best;
  }

  edgeBetween(a, b) {
    for (const edgeId of this.nodeEdges.get(a) || []) {
      const e = this.edges[edgeId];
      if ((e.a === a && e.b === b) || (e.a === b && e.b === a)) return edgeId;
    }
    return null;
  }

  findPath(start, goal) {
    const frontier = [{ node: start, priority: 0 }];
    const came = new Map([[start, null]]);
    const cost = new Map([[start, 0]]);

    while (frontier.length > 0) {
      frontier.sort((x, y) => x.priority - y.priority);
      const current = frontier.shift().node;
      if (current === goal) break;
      for (const n of this.neighbors(current)) {
        const newCost = cost.get(current) + n.cost;
        if (!cost.has(n.node) || newCost < cost.get(n.node)) {
          cost.set(n.node, newCost);
          const h = this.nodes[n.node].distanceTo(this.nodes[goal]);
          frontier.push({ node: n.node, priority: newCost + h });
          came.set(n.node, { prev: current, edgeId: n.edgeId });
        }
      }
    }

    if (!came.has(goal)) return null;

    const nodePath = [];
    const edgePath = [];
    let cur = goal;
    while (cur !== start) {
      const c = came.get(cur);
      nodePath.push(cur);
      edgePath.push(c.edgeId);
      cur = c.prev;
    }
    nodePath.push(start);
    nodePath.reverse();
    edgePath.reverse();
    return { nodePath, edgePath };
  }

  sampleEdge(edgeId, distanceAlong, forward = true, laneOffset = 0) {
    const e = this.edges[edgeId];
    const dBase = clamp(distanceAlong, 0, e.length);
    const d = forward ? dBase : e.length - dBase;
    const cum = e.cum;
    let seg = 0;
    for (let i = 1; i < cum.length; i += 1) {
      if (cum[i] >= d) {
        seg = i - 1;
        break;
      }
      if (i === cum.length - 1) seg = i - 1;
    }
    const p0 = e.points[seg];
    const p1 = e.points[seg + 1];
    const segLen = Math.max(0.0001, cum[seg + 1] - cum[seg]);
    const t = (d - cum[seg]) / segLen;
    const pos = p0.clone().lerp(p1, t);

    const dir2 = normalize2({ x: p1.x - p0.x, y: p1.z - p0.z });
    const dir = new THREE.Vector3(dir2.x, 0, dir2.y);
    if (!forward) dir.negate();
    const n2 = perp2({ x: dir.x, y: dir.z });
    pos.x += n2.x * laneOffset;
    pos.z += n2.y * laneOffset;
    return { pos, dir };
  }

  edgeDirectionAtEnd(edgeId, towardB = true) {
    const e = this.edges[edgeId];
    const p0 = towardB ? e.points[e.points.length - 2] : e.points[1];
    const p1 = towardB ? e.points[e.points.length - 1] : e.points[0];
    const d = new THREE.Vector3(p1.x - p0.x, 0, p1.z - p0.z).normalize();
    return d;
  }
}
