import * as THREE from 'three';
import type { AvatarPicking } from './types';

/**
 * Picking for the characters drawn with three.js.
 *
 * Shared by the two of them because the technique owes nothing to what the scene contains: cast a
 * ray through the pointer, keep the nearest surface it meets, and name it.
 *
 * Naming is the part that matters to the user. A model is a tree, and the leaf under the finger is
 * rarely what one meant - clicking a plush's ear should offer the ear, not one of the four meshes
 * it happens to be welded from. So the id is taken from the nearest ANCESTOR that carries a name,
 * and only a model that names nothing falls back to the leaf's own identity.
 *
 * That also makes the stored set portable across sessions: a name survives reloading the file,
 * where three.js hands out a fresh `uuid` every time.
 */

/** Nearest named ancestor, or the object itself when a model names nothing. */
function partIdOf(object: THREE.Object3D, root: THREE.Object3D): string {
  let node: THREE.Object3D | null = object;
  while (node !== null && node !== root) {
    if (node.name !== '') return node.name;
    node = node.parent;
  }
  // `uuid` is regenerated on each load, so a set stored against it will not survive a restart.
  // Accepted rather than refusing to pick: an unnamed model is still worth tidying for the session,
  // and nothing else identifies its pieces.
  return object.uuid;
}

export function meshPicking(
  canvas: HTMLCanvasElement,
  camera: THREE.Camera,
  root: THREE.Object3D,
): AvatarPicking {
  const raycaster = new THREE.Raycaster();

  return {
    pick(x, y) {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;

      // Normalised device coordinates: the centre is the origin and the edges are ±1, with y up
      // where the pointer counts down.
      const point = new THREE.Vector2((x / rect.width) * 2 - 1, -((y / rect.height) * 2 - 1));
      raycaster.setFromCamera(point, camera);

      // Hidden objects are skipped by the raycaster, which is what lets a second click reach
      // whatever was behind the piece just removed.
      const hits = raycaster.intersectObject(root, true);
      const first = hits[0];
      return first === undefined ? null : partIdOf(first.object, root);
    },

    parts() {
      // Collected through the same naming as `pick`, so the two always speak of the same objects:
      // a model whose leaves all resolve to one named group holds exactly one hideable object.
      const found = new Set<string>();
      root.traverse((object) => {
        if (object === root) return;
        found.add(partIdOf(object, root));
      });
      return [...found];
    },

    setHidden(ids) {
      root.traverse((object) => {
        if (object === root) return;
        // Resolved per object rather than matched by name, so hiding a group takes its children
        // with it however deep they sit.
        object.visible = !ids.has(partIdOf(object, root));
      });
    },
  };
}
