import * as THREE from 'three';
import type { AvatarFrameState, AvatarInstance, AvatarMood, AvatarPalette } from '../types';

/**
 * Plush companion.
 *
 * Deliberately squat silhouette: a large mass sitting on the ground whose head is only a bulge,
 * with no visible neck or limbs. That is what gives this kind of companion its soft, good-natured
 * look - a realistically proportioned body would immediately read as stiff.
 *
 * Built from primitives: nothing to download, so nothing that can be missing offline. A character
 * imported from a glTF implements the same interface without changing anything else.
 */

interface Posture {
  /** Eye opening: below 1 narrows, above 1 widens. */
  readonly eyeOpen: number;
  /** Ear tilt, radians. Positive folds them back. */
  readonly earTilt: number;
  /** Breathing amplitude. */
  readonly breath: number;
  /** Rate of breathing and tail sway. */
  readonly tempo: number;
  /** Slump: the character hunches when tense. */
  readonly squash: number;
}

const POSTURES: Record<AvatarMood, Posture> = {
  calm: { eyeOpen: 0.78, earTilt: -0.04, breath: 0.03, tempo: 0.55, squash: 0 },
  neutral: { eyeOpen: 1, earTilt: 0, breath: 0.04, tempo: 1, squash: 0 },
  spirited: { eyeOpen: 1.2, earTilt: -0.2, breath: 0.07, tempo: 2.1, squash: -0.03 },
  tense: { eyeOpen: 0.58, earTilt: 0.5, breath: 0.05, tempo: 1.5, squash: 0.07 },
};

const BLINK_DURATION = 0.14;
const STARTLE_DURATION = 0.55;
const THRILL_DURATION = 0.45;
const TWITCH_DURATION = 0.3;

const FUR_LIGHT = 0xe9e7ee;
const FUR_PATCH = 0x9aa0b4;
const FUR_SHADOW = 0xc9ccd8;
const EYE_DARK = 0x2a2732;
const BLUSH = 0xff9db4;

class PlushCompanion implements AvatarInstance {
  #renderer: THREE.WebGLRenderer;
  #scene = new THREE.Scene();
  #camera = new THREE.PerspectiveCamera(32, 1, 0.1, 40);
  #canvas: HTMLCanvasElement;

  #root = new THREE.Group();
  #head = new THREE.Group();
  #body = new THREE.Group();
  #earLeft = new THREE.Group();
  #earRight = new THREE.Group();
  #eyeLeft = new THREE.Group();
  #eyeRight = new THREE.Group();
  #tail = new THREE.Group();

  #rimLight: THREE.PointLight;
  #keyLight: THREE.DirectionalLight;
  #disposables: Array<THREE.BufferGeometry | THREE.Material> = [];

  // Current values, eased towards the target posture: that glide is what avoids square-wave mood
  // changes.
  #eyeOpen = 1;
  #earTilt = 0;
  #breath = 0.04;
  #tempo = 1;
  #squash = 0;
  #lean = 0;
  #pitch = 0;

  #blink = 0;
  #startle = 0;
  #thrill = 0;
  #twitch = 0;

  constructor(container: HTMLElement, palette: AvatarPalette) {
    this.#canvas = document.createElement('canvas');
    this.#canvas.style.display = 'block';
    this.#canvas.style.width = '100%';
    this.#canvas.style.height = '100%';
    container.append(this.#canvas);

    this.#renderer = new THREE.WebGLRenderer({
      canvas: this.#canvas,
      // Transparent background: the screen background stays visible behind the character, with no
      // rectangular cut-out.
      alpha: true,
      antialias: true,
    });
    this.#renderer.setClearAlpha(0);
    // Capped: past 2 the gain is invisible and the cost very real on a phone.
    this.#renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.#camera.position.set(0, 0.15, 9.2);
    this.#camera.lookAt(0, -0.1, 0);

    this.#scene.add(new THREE.AmbientLight(0xffffff, 1.5));
    this.#scene.add(new THREE.HemisphereLight(0xdfe6ff, 0x2a2340, 1.2));

    this.#keyLight = new THREE.DirectionalLight(0xffffff, 1.6);
    this.#keyLight.position.set(2.4, 3.4, 4);
    this.#scene.add(this.#keyLight);

    // Rim light in the theme's hue: it is what ties the character to the screen's ambience.
    this.#rimLight = new THREE.PointLight(0xffffff, 26, 22);
    this.#rimLight.position.set(-3.2, 1.4, -3);
    this.#scene.add(this.#rimLight);

    this.#build();
    this.#scene.add(this.#root);
    this.setPalette(palette);
  }

  #track<T extends THREE.BufferGeometry | THREE.Material>(item: T): T {
    this.#disposables.push(item);
    return item;
  }

  #matte(color: number): THREE.MeshStandardMaterial {
    // High roughness and no metalness: the felted look comes from there.
    return this.#track(
      new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0 }),
    );
  }

  #build(): void {
    const fur = this.#matte(FUR_LIGHT);
    const patch = this.#matte(FUR_PATCH);
    const shadow = this.#matte(FUR_SHADOW);

    // --- main mass ---------------------------------------------
    const bodyGeometry = this.#track(new THREE.SphereGeometry(1.25, 40, 30));
    const bodyMesh = new THREE.Mesh(bodyGeometry, fur);
    bodyMesh.scale.set(1, 0.88, 0.92);
    bodyMesh.position.y = -0.95;
    this.#body.add(bodyMesh);

    // Coat patches, simple caps laid on the mass.
    const patchGeometry = this.#track(new THREE.SphereGeometry(0.42, 20, 16));
    const patchPlacements: ReadonlyArray<readonly [number, number, number, number]> = [
      [-0.72, -1.28, 0.72, 1],
      [0.86, -0.72, 0.5, 0.8],
      [0.24, -1.72, 0.68, 0.7],
    ];
    for (const [x, y, z, scale] of patchPlacements) {
      const spot = new THREE.Mesh(patchGeometry, patch);
      spot.position.set(x, y, z);
      spot.scale.setScalar(scale);
      this.#body.add(spot);
    }

    const footGeometry = this.#track(new THREE.SphereGeometry(0.24, 18, 14));
    for (const side of [-1, 1]) {
      const foot = new THREE.Mesh(footGeometry, shadow);
      foot.position.set(side * 0.42, -1.92, 0.72);
      foot.scale.set(1.15, 0.6, 1.35);
      this.#body.add(foot);
    }

    // Striped tail, curled to one side.
    //
    // Segments are chained inside one another rather than aligned: the rotations compose, which
    // gives a real curve. Aligned then rotated as a block, they would form a rigid rod.
    const tailSegment = this.#track(new THREE.CapsuleGeometry(0.115, 0.3, 5, 14));
    let parent: THREE.Object3D = this.#tail;
    for (let i = 0; i < 6; i += 1) {
      const joint = new THREE.Group();
      joint.position.y = i === 0 ? 0.1 : 0.3;
      // Increasing curvature towards the tip: the tail curls.
      joint.rotation.z = 0.13 + i * 0.055;

      const ring = new THREE.Mesh(tailSegment, i % 2 === 0 ? fur : patch);
      ring.position.y = 0.15;
        ring.scale.setScalar(1 - i * 0.07);
      joint.add(ring);

      parent.add(joint);
      parent = joint;
    }
    // Held away from the body and slightly forward: otherwise the curvature hides it behind the
    // mass.
    this.#tail.position.set(1.02, -1.62, 0.12);
    this.#tail.rotation.set(0.18, 0, -1.05);
    this.#body.add(this.#tail);

    // --- head ---------------------------------------------------- Sphere barely smaller than the
    // body, sitting on it with no neck: the two volumes merge into one silhouette.
    const headMesh = new THREE.Mesh(this.#track(new THREE.SphereGeometry(1.02, 40, 30)), fur);
    headMesh.scale.set(1.04, 0.97, 0.96);
    this.#head.add(headMesh);

    const cheekPatch = new THREE.Mesh(patchGeometry, patch);
    cheekPatch.position.set(-0.62, 0.2, 0.66);
    cheekPatch.scale.setScalar(0.78);
    this.#head.add(cheekPatch);

    // --- ears ------------------------------------------------------
    const earGeometry = this.#track(new THREE.SphereGeometry(0.3, 18, 14));
    const earInnerGeometry = this.#track(new THREE.SphereGeometry(0.19, 14, 12));
    const earInner = this.#matte(BLUSH);

    for (const [side, group] of [
      [-1, this.#earLeft],
      [1, this.#earRight],
    ] as const) {
      const ear = new THREE.Mesh(earGeometry, fur);
      ear.scale.set(0.8, 1.05, 0.45);
      group.add(ear);

      const inner = new THREE.Mesh(earInnerGeometry, earInner);
      inner.scale.set(0.72, 0.95, 0.3);
      inner.position.z = 0.12;
      group.add(inner);

      group.position.set(side * 0.62, 0.78, 0.06);
      group.rotation.set(0, 0, side * 0.34);
      this.#head.add(group);
    }

    // --- face ---------------------------------------------------------
    const eyeGeometry = this.#track(new THREE.SphereGeometry(0.15, 20, 16));
    const eyeMaterial = this.#matte(EYE_DARK);
    const highlightGeometry = this.#track(new THREE.SphereGeometry(0.05, 10, 8));
    const highlightMaterial = this.#track(
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );

    for (const [side, group] of [
      [-1, this.#eyeLeft],
      [1, this.#eyeRight],
    ] as const) {
      const eye = new THREE.Mesh(eyeGeometry, eyeMaterial);
      eye.scale.set(0.92, 1.18, 0.6);
      group.add(eye);

      const highlight = new THREE.Mesh(highlightGeometry, highlightMaterial);
      highlight.position.set(side * -0.045, 0.07, 0.13);
      group.add(highlight);

      group.position.set(side * 0.37, 0.06, 0.92);
      this.#head.add(group);
    }

    const blushGeometry = this.#track(new THREE.SphereGeometry(0.2, 16, 12));
    const blushMaterial = this.#track(
      new THREE.MeshStandardMaterial({ color: BLUSH, roughness: 1, transparent: true, opacity: 0.75 }),
    );
    for (const side of [-1, 1]) {
      const blush = new THREE.Mesh(blushGeometry, blushMaterial);
      blush.position.set(side * 0.62, -0.22, 0.76);
      blush.scale.set(1.15, 0.62, 0.35);
      this.#head.add(blush);
    }

    const muzzle = new THREE.Mesh(this.#track(new THREE.SphereGeometry(0.12, 14, 12)), shadow);
    muzzle.position.set(0, -0.24, 0.98);
    muzzle.scale.set(1.5, 0.85, 0.6);
    this.#head.add(muzzle);

    this.#head.position.y = 0.62;
    this.#root.add(this.#body, this.#head);
    this.#root.position.y = 0.5;
  }

  setPalette(palette: AvatarPalette): void {
    this.#rimLight.color.set(palette.accent);
    this.#keyLight.color.set(new THREE.Color(0xffffff).lerp(new THREE.Color(palette.accentAlt), 0.14));
  }

  resize(width: number, height: number): void {
    if (width === 0 || height === 0) return;
    this.#renderer.setSize(width, height, false);
    this.#camera.aspect = width / height;
    this.#camera.updateProjectionMatrix();
  }

  update(state: AvatarFrameState, dt: number): void {
    this.#advanceReactions(state, dt);

    const posture = POSTURES[state.mood];
    // `damp` is frame-rate independent: the animation is identical at 60 or 120 Hz.
    const ease = (current: number, target: number, lambda: number): number =>
      THREE.MathUtils.damp(current, target, lambda, dt);

    this.#eyeOpen = ease(this.#eyeOpen, posture.eyeOpen, 6);
    this.#earTilt = ease(this.#earTilt, posture.earTilt, 5);
    this.#breath = ease(this.#breath, posture.breath, 3);
    this.#tempo = ease(this.#tempo, posture.tempo, 3);
    this.#squash = ease(this.#squash, posture.squash, 4);

    this.#lean = ease(this.#lean, THREE.MathUtils.clamp(-state.lateral * 0.4, -0.45, 0.45), 7);
    this.#pitch = ease(this.#pitch, THREE.MathUtils.clamp(state.longitudinal * 0.28, -0.38, 0.38), 7);

    const startle = this.#startle / STARTLE_DURATION;
    const thrill = this.#thrill / THRILL_DURATION;
    const twitch = this.#twitch / TWITCH_DURATION;

    const bob = Math.sin(state.time * this.#tempo * 2.4) * this.#breath;
    const sway = Math.sin(state.time * this.#tempo * 1.6);

    this.#root.position.y = 0.5 + bob - this.#squash + thrill * 0.18;
    this.#root.rotation.z = this.#lean;
    this.#root.rotation.x = -this.#pitch + startle * 0.2;

    // The body squashes and stretches slightly out of phase with the breathing: without that
    // elasticity a mass this round looks rigid.
    const squashScale = 1 + bob * 0.35 + startle * 0.05;
    this.#body.scale.set(1 + (1 - squashScale) * 0.6, squashScale, 1 + (1 - squashScale) * 0.6);

    // The head counterbalances the body: without the offset the whole thing moves as one block and
    // loses its life.
    this.#head.rotation.z = -this.#lean * 0.45;
    this.#head.rotation.x = this.#pitch * 0.3 - startle * 0.14;
    this.#head.rotation.y = THREE.MathUtils.clamp(-state.lateral * 0.34, -0.4, 0.4);
    this.#head.position.y = 0.62 + bob * 0.5;

    const earTilt = this.#earTilt + startle * 0.65 + twitch * 0.32;
    this.#earLeft.rotation.set(-earTilt, 0, -0.34 - earTilt * 0.35);
    this.#earRight.rotation.set(-earTilt, 0, 0.34 + earTilt * 0.35 + twitch * 0.22);

    const blinkPhase = this.#blink > 0 ? Math.sin((1 - this.#blink / BLINK_DURATION) * Math.PI) : 0;
    const openness = Math.max(
      0.05,
      this.#eyeOpen * (1 - blinkPhase) + startle * 0.5 + thrill * 0.28,
    );
    this.#eyeLeft.scale.y = openness;
    this.#eyeRight.scale.y = openness;

    // The gaze turns towards the inside of the corner.
    const gaze = THREE.MathUtils.clamp(-state.lateral * 0.1, -0.07, 0.07);
    this.#eyeLeft.position.x = -0.37 + gaze;
    this.#eyeRight.position.x = 0.37 + gaze;

    this.#tail.rotation.z = -1.05 + sway * (0.12 + state.revs * 0.3);
    this.#tail.rotation.x = 0.18 + Math.cos(state.time * this.#tempo * 1.9) * 0.1;

    this.#renderer.render(this.#scene, this.#camera);
  }

  #advanceReactions(state: AvatarFrameState, dt: number): void {
    this.#blink = Math.max(0, this.#blink - dt);
    this.#startle = Math.max(0, this.#startle - dt);
    this.#thrill = Math.max(0, this.#thrill - dt);
    this.#twitch = Math.max(0, this.#twitch - dt);

    switch (state.reaction) {
      case 'blink':
        this.#blink = BLINK_DURATION;
        break;
      case 'startle':
        this.#startle = STARTLE_DURATION;
        break;
      case 'thrill':
        this.#thrill = THRILL_DURATION;
        break;
      case 'shift':
        this.#twitch = TWITCH_DURATION;
        break;
      case null:
        break;
    }
  }

  dispose(): void {
    for (const item of this.#disposables) item.dispose();
    this.#disposables = [];
    this.#renderer.dispose();
    this.#canvas.remove();
  }
}

export function mountPlushCompanion(
  container: HTMLElement,
  palette: AvatarPalette,
): AvatarInstance {
  return new PlushCompanion(container, palette);
}
