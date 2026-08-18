import {
  Rive,
  Layout,
  Fit,
  Alignment,
  RuntimeLoader,
  type StateMachineInput,
} from '@rive-app/canvas';
import { RIVE_WASM_URL } from '../riveWasm';
import {
  hasMagic,
  RIVE_ARTBOARD,
  RIVE_INPUTS,
  RIVE_MAGIC,
  RIVE_STATE_MACHINE,
  RIVE_TRIGGERS,
} from '../assets';
import { AvatarError } from '../types';
import type { AvatarFrameState, AvatarInstance, AvatarMood, AvatarPalette } from '../types';

// Served from our own origin, and no CDN fallback: a missing local runtime must fail loudly
// rather than quietly reach for jsdelivr, which is how the dependency went unnoticed.
RuntimeLoader.setWasmUrl(RIVE_WASM_URL);
RuntimeLoader.setWasmFallbackUrl(null);

/**
 * Animated face loaded from a Rive file.
 *
 * Rive exposes a state machine driven by typed inputs, which maps exactly onto our model:
 * continuous quantities (revs, throttle, lateral load) feed number inputs, one-off reactions feed
 * triggers. The whole staging lives in the file rather than the code, so changing an expression
 * needs no rebuild.
 *
 * Missing inputs are ignored silently - a file still being authored, exposing only `mood`, already
 * animates.
 */

const MOOD_VALUES: Record<AvatarMood, number> = {
  calm: 0,
  neutral: 1,
  spirited: 2,
  tense: 3,
};

class RiveFace implements AvatarInstance {
  #canvas: HTMLCanvasElement;
  #rive: Rive;
  #numbers = new Map<string, StateMachineInput>();
  #triggers = new Map<string, StateMachineInput>();

  constructor(canvas: HTMLCanvasElement, rive: Rive, stateMachine: string) {
    this.#canvas = canvas;
    this.#rive = rive;

    for (const input of rive.stateMachineInputs(stateMachine) ?? []) {
      // Rive distinguishes numbers, booleans and triggers; each input is filed by the use we want
      // to make of it.
      if (Object.values(RIVE_TRIGGERS).some((name) => name === input.name)) {
        this.#triggers.set(input.name, input);
      } else {
        this.#numbers.set(input.name, input);
      }
    }
  }

  setPalette(_palette: AvatarPalette): void {
    // Colours belong to the Rive file. Forcing them from code would undo the work done in the
    // editor; a file that wants to follow the theme can expose its own tint inputs.
  }

  resize(width: number, height: number): void {
    if (width === 0 || height === 0) return;
    const ratio = Math.min(window.devicePixelRatio, 2);
    this.#canvas.width = Math.round(width * ratio);
    this.#canvas.height = Math.round(height * ratio);
    this.#rive.resizeToCanvas();
  }

  update(state: AvatarFrameState): void {
    this.#setNumber(RIVE_INPUTS.mood, MOOD_VALUES[state.mood]);
    this.#setNumber(RIVE_INPUTS.intensity, state.intensity * 100);
    this.#setNumber(RIVE_INPUTS.revs, state.revs * 100);
    this.#setNumber(RIVE_INPUTS.effort, state.effort * 100);
    // G values are mapped onto -100..100, a scale easier to work with in the editor than a physical
    // value.
    this.#setNumber(RIVE_INPUTS.lateral, clamp(state.lateral * 100, -100, 100));
    this.#setNumber(RIVE_INPUTS.longitudinal, clamp(state.longitudinal * 100, -100, 100));

    if (state.reaction !== null) this.#triggers.get(state.reaction)?.fire();
  }

  #setNumber(name: string, value: number): void {
    const input = this.#numbers.get(name);
    if (input === undefined) return;
    input.value = value;
  }

  dispose(): void {
    this.#rive.cleanup();
    this.#canvas.remove();
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Minimal artboard description, as reported by the runtime. */
interface ArtboardContents {
  readonly name: string;
  readonly stateMachines?: ReadonlyArray<{
    readonly name: string;
    readonly inputs?: ReadonlyArray<unknown>;
  }>;
}

/**
 * Picks the state machine of the chosen artboard: the agreed name if present, the first one
 * otherwise. Rejecting a file over a naming difference would be needlessly strict.
 */
function chooseStateMachine(
  artboards: readonly ArtboardContents[],
  artboardName: string | undefined,
): string | undefined {
  const artboard = artboards.find((candidate) => candidate.name === artboardName) ?? artboards[0];
  const machines = artboard?.stateMachines ?? [];
  const named = machines.find((machine) => machine.name === RIVE_STATE_MACHINE);
  return (named ?? machines[0])?.name;
}

/**
 * Picks the artboard to display.
 *
 * A file from a template or a library often contains a presentation artboard - white card,
 * background, drop shadow - wrapping the real illustration. Shown as-is, that decor hides the
 * application background. Selecting the artboard that is actually drivable avoids having to edit
 * the file.
 *
 * Returns `null` if the default artboard already suits.
 */
function chooseArtboard(artboards: readonly ArtboardContents[]): string | null {
  if (artboards.length <= 1) return null;

  const named = artboards.find((artboard) => artboard.name === RIVE_ARTBOARD);
  if (named !== undefined) return named.name;

  // Failing an agreed name, the one exposing the most inputs: that is the one its author meant to
  // drive, so the illustration rather than the decor.
  const countInputs = (artboard: ArtboardContents): number =>
    (artboard.stateMachines ?? []).reduce(
      (total, machine) => total + (machine.inputs?.length ?? 0),
      0,
    );

  const best = [...artboards].sort((a, b) => countInputs(b) - countInputs(a))[0];
  if (best === undefined || countInputs(best) === 0) return null;
  return best.name;
}

function loadRive(
  buffer: ArrayBuffer,
  canvas: HTMLCanvasElement,
  artboard?: string,
  stateMachines?: string,
): Promise<Rive> {
  return new Promise((resolve, reject) => {
    const instance = new Rive({
      buffer,
      canvas,
      ...(artboard === undefined ? {} : { artboard }),
      ...(stateMachines === undefined ? {} : { stateMachines }),
      autoplay: true,
      // `Contain` keeps the whole illustration visible whatever the tile aspect, without ever
      // cropping it.
      layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
      onLoad: () => resolve(instance),
      onLoadError: () => reject(new AvatarError('riveDecodeFailed')),
    });
  });
}

export async function mountRiveFace(
  container: HTMLElement,
  _palette: AvatarPalette,
  url: string,
): Promise<AvatarInstance> {
  const response = await fetch(url).catch(() => null);
  const buffer = response !== null && response.ok ? await response.arrayBuffer() : null;

  // Two failures worth telling apart: the blob went away, or the file was never a Rive document.
  if (buffer === null) throw new AvatarError('unreadableAvatarFile');
  if (!hasMagic(buffer, RIVE_MAGIC)) throw new AvatarError('notRiveDocument');

  const canvas = document.createElement('canvas');
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  container.append(canvas);

  // First pass: the file's structure is only readable once loaded.
  const probe = await loadRive(buffer, canvas);
  const artboards = probe.contents?.artboards ?? [];
  const artboard = chooseArtboard(artboards) ?? artboards[0]?.name;
  const machine = chooseStateMachine(artboards, artboard);
  probe.cleanup();

  if (machine === undefined) {
    canvas.remove();
    throw new AvatarError('riveNoStateMachine');
  }

  /**
   * Second pass: artboard AND state machine named explicitly.
   *
   * Naming the machine is not cosmetic. Without it, `autoplay` starts the file's first linear
   * animation instead of initialising the machine: elements are never brought to their rest pose,
   * and some end up plainly misplaced - an ear over the glasses, for instance.
   */
  const rive = await loadRive(buffer, canvas, artboard, machine);
  return new RiveFace(canvas, rive, machine);
}
