import type { Translation } from '../i18n';

/**
 * Avatar model.
 *
 * Animation layers a continuously held base posture, dictated by mood, with one-off reactions
 * triggered by driving events. That is what lets hard braking produce a visible flinch without
 * freezing the character in a "braking" state.
 *
 * The interface presumes no rendering technique: an avatar takes over an element and redraws itself
 * each frame. The project targets both a flat glowing face and a volumetric character, and
 * rendering the first in 3D would make no sense.
 */

/**
 * Why an avatar would not mount.
 *
 * A code rather than a sentence, because the sentence belongs to the user's language and these
 * engines know nothing of it. `AvatarStage` resolves the code when it renders, which also means a
 * message already on screen follows a language change instead of freezing in the old one.
 *
 * Mirrors `ArchiveError`, the same problem solved the same way one folder over.
 */
export type AvatarErrorCode =
  | 'unreadableAvatarFile'
  | 'notRiveDocument'
  | 'riveDecodeFailed'
  | 'riveNoStateMachine'
  | 'notGltfModel'
  | 'gltfDecodeFailed';

export class AvatarError extends Error {
  constructor(readonly code: AvatarErrorCode) {
    super(code);
    this.name = 'AvatarError';
  }
}

/** Base posture, slow to change. */
export type AvatarMood = 'calm' | 'neutral' | 'spirited' | 'tense';

export const AVATAR_MOODS: readonly AvatarMood[] = ['calm', 'neutral', 'spirited', 'tense'];


/** One-off reaction, played once then returned to the base posture. */
export type AvatarReaction = 'blink' | 'startle' | 'thrill' | 'shift';

/** What the avatar receives each frame. */
export interface AvatarFrameState {
  readonly mood: AvatarMood;
  /** Mood intensity, 0..1. */
  readonly intensity: number;
  /** Normalised engine speed, 0..1. */
  readonly revs: number;
  /** Engine demand (throttle), 0..1. */
  readonly effort: number;
  /** Lateral acceleration, signed g. Negative is a left-hand turn. */
  readonly lateral: number;
  /** Longitudinal acceleration, signed g. Negative is braking. */
  readonly longitudinal: number;
  /** Time since mount, in seconds. */
  readonly time: number;
  /** Reaction triggered on this frame, if any. */
  readonly reaction: AvatarReaction | null;
}

/** Colours inherited from the active theme. */
export interface AvatarPalette {
  readonly accent: string;
  readonly accentAlt: string;
}

/**
 * An avatar mounted in the document.
 *
 * `update` is called each frame; the avatar owns its reaction timers, which keeps the host ignorant
 * of animation details.
 */
export interface AvatarInstance {
  update(state: AvatarFrameState, dt: number): void;
  setPalette(palette: AvatarPalette): void;
  resize(width: number, height: number): void;
  dispose(): void;
}

/** Vector (Rive) or volumetric (glTF). Selects the rendering engine. */
export type AvatarKind = 'vector' | 'volumetric';

export interface AvatarDefinition {
  readonly id: string;
  /** Name of an imported avatar: its file name, not translatable. */
  readonly label?: string;
  /** Translation key for a built-in avatar. Mutually exclusive with `label`. */
  readonly labelKey?: keyof Translation['avatars'];
  readonly description?: string;
  readonly descriptionKey?: keyof Translation['avatars'];
  /** Indicative, to warn the user about rendering cost. */
  readonly kind: AvatarKind;
  /** True for an imported avatar: only those can be removed. */
  readonly imported?: boolean;
  /**
   * Mounting is asynchronous because each avatar imports its rendering engine on demand - neither
   * three.js nor Rive is downloaded until an avatar asks for it - and some fetch an asset file.
   *
   * An error here is expected while the file is missing: the caller must surface it rather than
   * hide it.
   */
  mount(container: HTMLElement, palette: AvatarPalette): Promise<AvatarInstance>;
}
