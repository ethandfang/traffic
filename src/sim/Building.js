import * as THREE from 'three';
import { clamp } from './utils.js';

export class Building {
  constructor(params) {
    const { position, footprint, height, rotationY, district = 'residential', random } = params;
    this.group = new THREE.Group();
    this.group.position.copy(position);
    this.group.rotation.y = rotationY;

    const districtTint = district === 'downtown' ? 0.85 : district === 'midrise' ? 0.95 : 1.05;
    const baseColor = new THREE.Color(
      clamp((0.26 + random() * 0.14) * districtTint, 0, 1),
      clamp((0.30 + random() * 0.14) * districtTint, 0, 1),
      clamp((0.36 + random() * 0.16) * districtTint, 0, 1),
    );

    this.mesh = new THREE.Mesh(
      new THREE.BoxGeometry(footprint.x, height, footprint.y),
      new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.85, metalness: 0.08 }),
    );
    this.mesh.position.y = height / 2;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.group.add(this.mesh);

    this.windowMeshes = [];
    this.windowLit = [];
    this.#makeWindows(footprint, height, random);
  }

  #makeWindows(footprint, height, random) {
    const sx = footprint.x;
    const sz = footprint.y;
    const floors = Math.max(2, Math.floor(height / 2.7));
    const colsX = Math.max(2, Math.floor(sx / 1.6));
    const colsZ = Math.max(2, Math.floor(sz / 1.6));

    const dark = new THREE.MeshStandardMaterial({ color: 0x1d222b, emissive: 0x000000, roughness: 0.5 });
    const lit = new THREE.MeshStandardMaterial({ color: 0x88a6c0, emissive: 0x9dd7ff, emissiveIntensity: 1.8, roughness: 0.35 });

    const quad = new THREE.PlaneGeometry(0.34, 0.22);
    for (let f = 1; f < floors; f += 1) {
      const y = -height / 2 + f * (height / floors);
      for (let i = 0; i < colsX; i += 1) {
        const x = -sx * 0.45 + (i + 0.5) * (sx * 0.9 / colsX);
        for (const side of [-1, 1]) {
          const m = new THREE.Mesh(quad, dark.clone());
          m.position.set(x, y + height / 2, side * (sz / 2 + 0.01));
          if (side < 0) m.rotation.y = Math.PI;
          this.group.add(m);
          this.windowMeshes.push({ mesh: m, litMaterial: lit.clone(), darkMaterial: m.material });
          this.windowLit.push(false);
        }
      }
      for (let i = 0; i < colsZ; i += 1) {
        const z = -sz * 0.45 + (i + 0.5) * (sz * 0.9 / colsZ);
        for (const side of [-1, 1]) {
          const m = new THREE.Mesh(quad, dark.clone());
          m.position.set(side * (sx / 2 + 0.01), y + height / 2, z);
          m.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
          this.group.add(m);
          this.windowMeshes.push({ mesh: m, litMaterial: lit.clone(), darkMaterial: m.material });
          this.windowLit.push(false);
        }
      }
    }
  }

  updateWindows(random, nightFactor) {
    const pLit = 0.1 + 0.75 * nightFactor;
    for (let i = 0; i < this.windowMeshes.length; i += 1) {
      if (random() < 0.07) {
        const state = random() < pLit;
        this.windowLit[i] = state;
        this.windowMeshes[i].mesh.material = state
          ? this.windowMeshes[i].litMaterial
          : this.windowMeshes[i].darkMaterial;
      }
    }
  }
}
