import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { clamp } from './utils.js';

export class CameraRig {
  constructor(camera, domElement) {
    this.camera = camera;
    this.controls = new OrbitControls(camera, domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.rotateSpeed = 0.9;
    this.controls.panSpeed = 0.9;
    this.controls.zoomSpeed = 0.85;
    this.controls.enablePan = true;
    this.controls.screenSpacePanning = false;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 350;
    this.controls.maxPolarAngle = Math.PI * 0.495;
    this.controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.PAN,
      RIGHT: THREE.MOUSE.PAN,
    };

    this.keys = new Set();
    this.followTarget = null;
  }

  onKeyDown(e) {
    this.keys.add(e.key.toLowerCase());
  }

  onKeyUp(e) {
    this.keys.delete(e.key.toLowerCase());
  }

  setFollowTarget(obj3d) {
    this.followTarget = obj3d;
  }

  clearFollow() {
    this.followTarget = null;
  }

  update(dt) {
    if (this.followTarget) {
      const target = this.followTarget.position.clone();
      target.y += 1.2;
      this.controls.target.lerp(target, clamp(dt * 3.2, 0, 1));
    }

    const panSpeed = 30 * dt * Math.max(0.4, this.camera.position.distanceTo(this.controls.target) * 0.03);
    const rotSpeed = 1.1 * dt;

    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    if (this.keys.has('w')) {
      this.camera.position.addScaledVector(forward, panSpeed);
      this.controls.target.addScaledVector(forward, panSpeed);
    }
    if (this.keys.has('s')) {
      this.camera.position.addScaledVector(forward, -panSpeed);
      this.controls.target.addScaledVector(forward, -panSpeed);
    }
    if (this.keys.has('a')) {
      this.camera.position.addScaledVector(right, panSpeed);
      this.controls.target.addScaledVector(right, panSpeed);
    }
    if (this.keys.has('d')) {
      this.camera.position.addScaledVector(right, -panSpeed);
      this.controls.target.addScaledVector(right, -panSpeed);
    }

    if (this.keys.has('q')) this.controls.rotateLeft(-rotSpeed);
    if (this.keys.has('e')) this.controls.rotateLeft(rotSpeed);

    this.controls.target.y = Math.max(0.2, this.controls.target.y);
    this.camera.position.y = Math.max(1.1, this.camera.position.y);

    this.controls.update();
    this.camera.position.y = Math.max(1.1, this.camera.position.y);
  }
}
