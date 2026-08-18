import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  GLB_MAGIC,
  GLTF_BLINK_MORPH,
  GLTF_IDLE_CLIP,
  GLTF_NODES,
  hasMagic,
  normalizeNodeName,
} from '../assets';
import { AvatarError } from '../types';
import type { AvatarFrameState, AvatarInstance, AvatarMood, AvatarPalette } from '../types';

/**
 * Character loaded from a glTF file.
 *
 * No skeleton is required: the model only has to expose named nodes (head, ears, eyes, tail) and
 * the code animates them, exactly as for the procedural companion. That is what makes a model from
 * a generator or a consumer modelling tool directly usable - rigging being precisely the weak point
 * of those tools.
 *
 * Everything is optional and detected at runtime: a model without a tail animates like the others,
 * minus the tail. A clip named `idle` and a `blink` morph target are used if present.
 */

interface Posture {
  readonly eyeOpen: number;
  readonly earTilt: number;
  readonly breath: number;
  readonly tempo: number;
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

type NodeKey = keyof typeof GLTF_NODES;

class GltfCompanion implements AvatarInstance {
  #renderer: THREE.WebGLRenderer;
  #scene = new THREE.Scene();
  #camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  #canvas: HTMLCanvasElement;
  #root: THREE.Object3D;
  #mixer: THREE.AnimationMixer | null = null;

  #nodes = new Map<NodeKey, THREE.Object3D>();
  /** Reference poses: every animation is relative to the original pose. */
  #restRotation = new Map<THREE.Object3D, THREE.Euler>();
  #restPosition = new Map<THREE.Object3D, THREE.Vector3>();
  #blinkMorphs: Array<{ mesh: THREE.Mesh; index: number }> = [];

  #rimLight: THREE.PointLight;
  #keyLight: THREE.DirectionalLight;
  #baseY = 0;

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

  constructor(
    container: HTMLElement,
    palette: AvatarPalette,
    gltf: { scene: THREE.Object3D; animations: THREE.AnimationClip[] },
  ) {
    this.#canvas = document.createElement('canvas');
    this.#canvas.style.display = 'block';
    this.#canvas.style.width = '100%';
    this.#canvas.style.height = '100%';
    container.append(this.#canvas);

    this.#renderer = new THREE.WebGLRenderer({
      canvas: this.#canvas,
      // Transparent background: the screen decor stays visible behind the character, with no
      // rectangular cut-out.
      alpha: true,
      antialias: true,
    });
    this.#renderer.setClearAlpha(0);
    this.#renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.#scene.add(new THREE.AmbientLight(0xffffff, 1.4));
    this.#scene.add(new THREE.HemisphereLight(0xdfe6ff, 0x2a2340, 1.1));

    this.#keyLight = new THREE.DirectionalLight(0xffffff, 1.6);
    this.#keyLight.position.set(2.4, 3.4, 4);
    this.#scene.add(this.#keyLight);

    this.#rimLight = new THREE.PointLight(0xffffff, 26, 40);
    this.#rimLight.position.set(-3.2, 1.4, -3);
    this.#scene.add(this.#rimLight);

    this.#root = gltf.scene;
    this.#collectNodes(this.#root);
    this.#frameModel();
    this.#scene.add(this.#root);

    const idle = gltf.animations.find(
      (clip) => normalizeNodeName(clip.name) === GLTF_IDLE_CLIP,
    );
    if (idle !== undefined) {
      // An idle clip, if present, runs under the procedural animation: the two overlap without
      // interfering since they do not target the same properties.
      this.#mixer = new THREE.AnimationMixer(this.#root);
      this.#mixer.clipAction(idle).play();
    }

    this.setPalette(palette);
  }

  /** Locates the known nodes and records their rest pose. */
  #collectNodes(root: THREE.Object3D): void {
    const wanted = new Map<string, NodeKey>();
    for (const [key, aliases] of Object.entries(GLTF_NODES) as Array<
      [NodeKey, readonly string[]]
    >) {
      for (const alias of aliases) wanted.set(normalizeNodeName(alias), key);
    }

    root.traverse((object) => {
      const key = wanted.get(normalizeNodeName(object.name));
      if (key !== undefined && !this.#nodes.has(key)) {
        this.#nodes.set(key, object);
        this.#restRotation.set(object, object.rotation.clone());
        this.#restPosition.set(object, object.position.clone());
      }

      const mesh = object as THREE.Mesh;
      const dictionary = mesh.morphTargetDictionary;
      if (dictionary !== undefined) {
        const index = dictionary[GLTF_BLINK_MORPH];
        if (index !== undefined) this.#blinkMorphs.push({ mesh, index });
      }
    });
  }

  /**
   * Frames the model whatever its scale.
   *
   * A user-supplied file may measure two units or two hundred: it is normalised to a known size and
   * centred, rather than adding one more constraint to the specification.
   */
  #frameModel(): void {
    const box = new THREE.Box3().setFromObject(this.#root);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const largest = Math.max(size.x, size.y, size.z) || 1;
    const scale = 3.2 / largest;

    this.#root.scale.setScalar(scale);
    this.#root.position.sub(center.multiplyScalar(scale));
    this.#baseY = this.#root.position.y;

    this.#camera.position.set(0, 0.15, 9.2);
    this.#camera.lookAt(0, 0, 0);
  }

  setPalette(palette: AvatarPalette): void {
    this.#rimLight.color.set(palette.accent);
    this.#keyLight.color.set(
      new THREE.Color(0xffffff).lerp(new THREE.Color(palette.accentAlt), 0.14),
    );
  }

  resize(width: number, height: number): void {
    if (width === 0 || height === 0) return;
    this.#renderer.setSize(width, height, false);
    this.#camera.aspect = width / height;
    this.#camera.updateProjectionMatrix();
  }

  update(state: AvatarFrameState, dt: number): void {
    this.#advanceReactions(state, dt);
    this.#mixer?.update(dt);

    const posture = POSTURES[state.mood];
    const ease = (current: number, target: number, lambda: number): number =>
      THREE.MathUtils.damp(current, target, lambda, dt);

    this.#eyeOpen = ease(this.#eyeOpen, posture.eyeOpen, 6);
    this.#earTilt = ease(this.#earTilt, posture.earTilt, 5);
    this.#breath = ease(this.#breath, posture.breath, 3);
    this.#tempo = ease(this.#tempo, posture.tempo, 3);
    this.#squash = ease(this.#squash, posture.squash, 4);
    this.#lean = ease(this.#lean, THREE.MathUtils.clamp(-state.lateral * 0.4, -0.45, 0.45), 7);
    this.#pitch = ease(
      this.#pitch,
      THREE.MathUtils.clamp(state.longitudinal * 0.28, -0.38, 0.38),
      7,
    );

    const startle = this.#startle / STARTLE_DURATION;
    const thrill = this.#thrill / THRILL_DURATION;
    const twitch = this.#twitch / TWITCH_DURATION;

    const bob = Math.sin(state.time * this.#tempo * 2.4) * this.#breath;
    const sway = Math.sin(state.time * this.#tempo * 1.6);

    this.#root.position.y = this.#baseY + bob - this.#squash + thrill * 0.18;
    this.#root.rotation.z = this.#lean;
    this.#root.rotation.x = -this.#pitch + startle * 0.2;

    this.#animate('head', (node, rest) => {
      node.rotation.set(
        rest.x + this.#pitch * 0.3 - startle * 0.14,
        rest.y + THREE.MathUtils.clamp(-state.lateral * 0.34, -0.4, 0.4),
        rest.z - this.#lean * 0.45,
      );
    });

    const earTilt = this.#earTilt + startle * 0.65 + twitch * 0.32;
    this.#animate('earLeft', (node, rest) => {
      node.rotation.set(rest.x - earTilt, rest.y, rest.z - earTilt * 0.35);
    });
    this.#animate('earRight', (node, rest) => {
      node.rotation.set(rest.x - earTilt, rest.y, rest.z + earTilt * 0.35 + twitch * 0.22);
    });

    const blinkPhase = this.#blink > 0 ? Math.sin((1 - this.#blink / BLINK_DURATION) * Math.PI) : 0;
    const openness = Math.max(
      0.05,
      this.#eyeOpen * (1 - blinkPhase) + startle * 0.5 + thrill * 0.28,
    );

    if (this.#blinkMorphs.length > 0) {
      // The model knows how to close its own eyes: leave it in charge rather than crushing its lids
      // during scaling.
      for (const { mesh, index } of this.#blinkMorphs) {
        const influences = mesh.morphTargetInfluences;
        if (influences !== undefined) influences[index] = 1 - THREE.MathUtils.clamp(openness, 0, 1);
      }
    } else {
      for (const key of ['eyeLeft', 'eyeRight'] as const) {
        this.#animate(key, (node) => {
          node.scale.y = openness;
        });
      }
    }

    this.#animate('tail', (node, rest) => {
      node.rotation.set(
        rest.x + Math.cos(state.time * this.#tempo * 1.9) * 0.1,
        rest.y,
        rest.z + sway * (0.12 + state.revs * 0.3),
      );
    });

    this.#animate('body', (node, rest) => {
      const squash = 1 + bob * 0.35 + startle * 0.05;
      node.scale.set(1 + (1 - squash) * 0.6, squash, 1 + (1 - squash) * 0.6);
      void rest;
    });

    this.#renderer.render(this.#scene, this.#camera);
  }

  #animate(key: NodeKey, apply: (node: THREE.Object3D, rest: THREE.Euler) => void): void {
    const node = this.#nodes.get(key);
    if (node === undefined) return;
    const rest = this.#restRotation.get(node);
    if (rest === undefined) return;
    apply(node, rest);
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
    this.#mixer?.stopAllAction();
    this.#root.traverse((object) => {
      const mesh = object as THREE.Mesh;
      mesh.geometry?.dispose();
      const material = mesh.material;
      if (Array.isArray(material)) for (const item of material) item.dispose();
      else material?.dispose();
    });
    this.#renderer.dispose();
    this.#canvas.remove();
  }
}

export async function mountGltfCompanion(
  container: HTMLElement,
  palette: AvatarPalette,
  url: string,
): Promise<AvatarInstance> {
  const response = await fetch(url).catch(() => null);
  const buffer = response !== null && response.ok ? await response.arrayBuffer() : null;

  // Two failures worth telling apart: the blob went away, or the file was never a glTF model.
  if (buffer === null) throw new AvatarError('unreadableAvatarFile');
  if (!hasMagic(buffer, GLB_MAGIC)) throw new AvatarError('notGltfModel');

  // Parsed from the already-downloaded buffer rather than re-fetched by the loader: one request,
  // and the check applies to what is actually read.
  const loader = new GLTFLoader();
  const gltf = await new Promise<{ scene: THREE.Object3D; animations: THREE.AnimationClip[] }>(
    (resolve, reject) => {
      loader.parse(buffer, '', resolve, () => reject(new AvatarError('gltfDecodeFailed')));
    },
  );

  return new GltfCompanion(container, palette, gltf);
}
