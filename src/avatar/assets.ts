/**
 * Contract an avatar file has to meet.
 *
 * Nothing here names a path. Imported avatars are held in IndexedDB and mounted from an object URL
 * minted per session, so there is no location to agree on - only what the file must contain for an
 * engine to drive it.
 */

/**
 * Expected input names in the Rive state machine.
 *
 * None is required: only those actually present are driven, so a partial file still works while it
 * is being authored.
 */
export const RIVE_INPUTS = {
  /** Number 0..3 - 0 calm, 1 neutral, 2 spirited, 3 tense. */
  mood: 'mood',
  /** Number 0..100 - intensity of the current mood. */
  intensity: 'intensity',
  /** Number 0..100 - engine speed. */
  revs: 'revs',
  /** Number 0..100 - throttle opening. */
  effort: 'effort',
  /** Number -100..100 - lateral load, negative to the left. */
  lateral: 'lateral',
  /** Number -100..100 - longitudinal acceleration, negative under braking. */
  longitudinal: 'longitudinal',
} as const;

/** Expected triggers, matching the one-off reactions. */
export const RIVE_TRIGGERS = {
  blink: 'blink',
  startle: 'startle',
  thrill: 'thrill',
  shift: 'shift',
} as const;

/** Preferred state machine name. */
export const RIVE_STATE_MACHINE = 'Face';

/** Preferred artboard name. */
export const RIVE_ARTBOARD = 'Face';

/**
 * Node names looked up in the glTF model.
 *
 * Aliases and model names both go through `normalizeNodeName`, so case and the `_ - .` separators
 * collapse together: `Ear.L`, `ear-l` and `EAR L` are one entry, not three. What has to be listed
 * is what genuinely differs between rigs - the side before or after the part, spelled out or
 * abbreviated. `EarLeft` and `Ear Left` are two entries, since only the second carries a
 * separator to normalise.
 *
 * A missing node is skipped: a model without a tail animates like the others, minus the tail.
 */
export const GLTF_NODES = {
  head: ['head'],
  earLeft: ['ear_l', 'ear_left', 'earleft', 'l_ear', 'left_ear', 'leftear'],
  earRight: ['ear_r', 'ear_right', 'earright', 'r_ear', 'right_ear', 'rightear'],
  eyeLeft: ['eye_l', 'eye_left', 'eyeleft', 'l_eye', 'left_eye', 'lefteye'],
  eyeRight: ['eye_r', 'eye_right', 'eyeright', 'r_eye', 'right_eye', 'righteye'],
  tail: ['tail'],
  body: ['body'],
} as const;

/** Morph target used for blinking, if the model offers one. */
export const GLTF_BLINK_MORPH = 'blink';

/** Animation clip played as a background loop, if present. */
export const GLTF_IDLE_CLIP = 'idle';

/** Normalises a node name for comparison. */
export function normalizeNodeName(name: string): string {
  return name.toLowerCase().replace(/[\s\-.]/g, '_');
}

/**
 * Checks a file signature.
 *
 * Import decides the engine from the extension alone, without opening the file. This is where that
 * bet is settled: a `.riv` that is really a PNG reaches the runtime and fails at decode time with
 * an opaque message, where the first four bytes name the problem outright.
 */
export function hasMagic(buffer: ArrayBuffer, magic: string): boolean {
  if (buffer.byteLength < magic.length) return false;
  const head = new Uint8Array(buffer, 0, magic.length);
  return magic.split('').every((character, index) => head[index] === character.charCodeAt(0));
}

/** Rive file signature. */
export const RIVE_MAGIC = 'RIVE';
/** Binary glTF file signature. */
export const GLB_MAGIC = 'glTF';
