import * as THREE from 'three';

export class TrafficLight {
  constructor(nodeId, position, random) {
    this.nodeId = nodeId;
    this.group = new THREE.Group();
    this.group.position.copy(position);
    this.timer = random() * 10;
    this.cycle = 8 + random() * 6;
    this.phase = 0;

    const pole = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 3, 0.15),
      new THREE.MeshStandardMaterial({ color: 0x3a3d45, roughness: 0.8 }),
    );
    pole.position.y = 1.5;
    this.group.add(pole);

    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.8, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x1d2028, roughness: 0.6 }),
    );
    head.position.y = 3;
    this.group.add(head);

    this.red = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0x440000, emissive: 0x220000, emissiveIntensity: 0.5 }),
    );
    this.red.position.set(0, 3.2, 0.18);
    this.group.add(this.red);

    this.green = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0x003300, emissive: 0x001100, emissiveIntensity: 0.4 }),
    );
    this.green.position.set(0, 2.85, 0.18);
    this.group.add(this.green);

    this.stateText = 'INIT';
  }

  update(dt) {
    this.timer += dt;
    if (this.timer > this.cycle) this.timer -= this.cycle;
    this.phase = this.timer < this.cycle * 0.5 ? 0 : 1;
    if (this.phase === 0) {
      this.red.material.emissive.setHex(0x7a0000);
      this.red.material.emissiveIntensity = 2.6;
      this.green.material.emissive.setHex(0x002000);
      this.green.material.emissiveIntensity = 0.2;
      this.stateText = 'EW STOP / NS GO';
    } else {
      this.red.material.emissive.setHex(0x220000);
      this.red.material.emissiveIntensity = 0.25;
      this.green.material.emissive.setHex(0x00aa33);
      this.green.material.emissiveIntensity = 2.4;
      this.stateText = 'EW GO / NS STOP';
    }
  }

  canCarPass(direction) {
    const movingNS = Math.abs(direction.z) >= Math.abs(direction.x);
    if (this.phase === 0) return movingNS;
    return !movingNS;
  }

  walkAllowed() {
    return this.phase === 1;
  }

  setNightFactor(night) {
    const glow = 0.4 + night * 0.6;
    this.red.material.emissiveIntensity *= glow;
    this.green.material.emissiveIntensity *= glow;
  }
}
