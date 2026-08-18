import type { AvatarFrameState, AvatarInstance, AvatarMood, AvatarPalette } from '../types';

/**
 * Glowing face in the style of an in-car display.
 *
 * Rendered as SVG rather than 3D, and not as a fallback: the reference is itself a drawing shown on
 * a screen, not a volumetric object. Vector stays sharp at any tile size, costs almost nothing to
 * animate, and allows a crispness impossible with 3D primitives.
 *
 * The whole expression rests on two parameters per eye: lid OPENING and lid TILT. A lid dropping
 * inwards gives a hard look, outwards an anxious one, fully lowered a blink. The surrounding HUD
 * widgets are not decoration: they react to revs and throttle.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Drawing frame. Content is centred and scaled by the viewBox. */
const VIEW_WIDTH = 240;
const VIEW_HEIGHT = 180;

const EYE_RX = 31;
const EYE_RY = 19;
const EYE_Y = 86;
const EYE_OFFSET_X = 46;
/** Cheek offset, measured from the face axis. */
const BLUSH_OFFSET_X = 68;

interface Posture {
  /** Resting lid opening, 0..1. */
  readonly eyeOpen: number;
  /** Lid tilt, degrees. Positive drops the inner edge (hard). */
  readonly lidAngle: number;
  /** Cheek opacity. */
  readonly blush: number;
  /** Breathing rate of the face. */
  readonly tempo: number;
}

/**
 * The lid is never horizontal, even at rest: its inward tilt is what gives the assured, half-closed
 * look. Flat, the eye falls back to a plain half-moon and loses all character.
 */
const POSTURES: Record<AvatarMood, Posture> = {
  calm: { eyeOpen: 0.66, lidAngle: 9, blush: 0.5, tempo: 0.5 },
  neutral: { eyeOpen: 0.84, lidAngle: 14, blush: 0.65, tempo: 1 },
  spirited: { eyeOpen: 1.02, lidAngle: 9, blush: 0.95, tempo: 2 },
  tense: { eyeOpen: 0.52, lidAngle: 30, blush: 0.35, tempo: 1.6 },
};

const BLINK_DURATION = 0.14;
const STARTLE_DURATION = 0.5;
const THRILL_DURATION = 0.4;
const TWITCH_DURATION = 0.28;

function element<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attributes: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) {
    node.setAttribute(name, String(value));
  }
  return node;
}

class NeonFace implements AvatarInstance {
  #svg: SVGSVGElement;
  #root: SVGGElement;

  #eyes: Array<{ lid: SVGRectElement; group: SVGGElement; side: number }> = [];
  #blushes: SVGEllipseElement[] = [];
  #accentNodes: SVGElement[] = [];
  #altNodes: SVGElement[] = [];

  #revBar: SVGRectElement;
  #revDial: SVGCircleElement;
  #effortBars: SVGRectElement[] = [];
  #tickGroup: SVGGElement;

  #eyeOpen = 0.82;
  #lidAngle = 0;
  #blush = 0.65;
  #tempo = 1;
  #lean = 0;
  #pitch = 0;

  #blink = 0;
  #startle = 0;
  #thrill = 0;
  #twitch = 0;

  readonly #topCluster: SVGGElement;
  readonly #faceCluster: SVGGElement;
  readonly #bottomCluster: SVGGElement;

  constructor(container: HTMLElement, palette: AvatarPalette) {
    this.#svg = element('svg', {
      viewBox: `0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`,
      // `meet` keeps the whole face visible whatever the tile aspect.
      preserveAspectRatio: 'xMidYMid meet',
      width: '100%',
      height: '100%',
    });
    this.#svg.style.display = 'block';
    this.#svg.style.overflow = 'visible';

    this.#root = element('g', {});
    this.#svg.append(this.#root);

    // Three clusters rather than one layer: in a tall tile the face is bounded by width - two eyes
    // side by side will never grow past it - and all the remaining height was empty. The widgets
    // spread towards the edges to fill it, the face keeps the centre.
    this.#topCluster = element('g', {});
    this.#faceCluster = element('g', {});
    this.#bottomCluster = element('g', {});
    this.#root.append(this.#topCluster, this.#faceCluster, this.#bottomCluster);

    this.#tickGroup = this.#buildTicks();
    this.#revDial = this.#buildDial();
    this.#revBar = this.#buildRevBar();
    this.#buildPanel();
    this.#buildEffortBars();
    this.#buildBlushes();
    this.#buildEyes();

    container.append(this.#svg);
    this.setPalette(palette);
  }

  // --- construction --------------------------------------------------

  /** Horizontal graduated rule at the top: suggests a speed readout scrolling by. */
  #buildTicks(): SVGGElement {
    const group = element('g', { opacity: 0.75 });
    for (let i = 0; i < 22; i += 1) {
      const tall = i % 5 === 0;
      const tick = element('rect', {
        x: 62 + i * 5.4,
        y: tall ? 22 : 25,
        width: 1.4,
        height: tall ? 10 : 5,
        rx: 0.7,
      });
      this.#accentNodes.push(tick);
      group.append(tick);
    }
    this.#topCluster.append(group);
    return group;
  }

  /** Segmented dial top left, like a miniature rev counter. */
  #buildDial(): SVGCircleElement {
    const group = element('g', {});
    const outer = element('circle', { cx: 34, cy: 34, r: 15, fill: 'none', 'stroke-width': 1.2 });
    outer.setAttribute('opacity', '0.45');
    this.#accentNodes.push(outer);

    for (let i = 0; i < 12; i += 1) {
      const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
      const spoke = element('rect', {
        x: 33.2,
        y: 20,
        width: 1.6,
        height: 5,
        transform: `rotate(${(i / 12) * 360} 34 34)`,
      });
      this.#accentNodes.push(spoke);
      group.append(spoke);
      void angle;
    }

    // Fill arc: its length follows engine speed.
    const arc = element('circle', {
      cx: 34,
      cy: 34,
      r: 9.5,
      fill: 'none',
      'stroke-width': 3,
      'stroke-linecap': 'round',
      transform: 'rotate(-90 34 34)',
      'stroke-dasharray': `0 ${2 * Math.PI * 9.5}`,
    });
    this.#altNodes.push(arc);
    group.append(outer, arc);
    this.#topCluster.append(group);
    return arc;
  }

  /** Vertical bar right of the dial, also tied to engine speed. */
  #buildRevBar(): SVGRectElement {
    const track = element('rect', { x: 54, y: 22, width: 3, height: 34, rx: 1.5, opacity: 0.25 });
    this.#accentNodes.push(track);
    const fill = element('rect', { x: 54, y: 56, width: 3, height: 0, rx: 1.5 });
    this.#altNodes.push(fill);
    this.#topCluster.append(track, fill);
    return fill;
  }

  /** Small technical panel top right, purely decorative. */
  #buildPanel(): void {
    const group = element('g', { opacity: 0.6 });
    const frame = element('rect', {
      x: 186,
      y: 20,
      width: 30,
      height: 34,
      rx: 4,
      fill: 'none',
      'stroke-width': 1.2,
    });
    this.#accentNodes.push(frame);
    group.append(frame);

    for (let i = 0; i < 4; i += 1) {
      const line = element('rect', {
        x: 191,
        y: 26 + i * 7,
        width: i % 2 === 0 ? 20 : 13,
        height: 2,
        rx: 1,
      });
      this.#accentNodes.push(line);
      group.append(line);
    }
    this.#topCluster.append(group);
  }

  /** Bars bottom left: they rise with throttle opening. */
  #buildEffortBars(): void {
    const group = element('g', {});
    for (let i = 0; i < 5; i += 1) {
      const bar = element('rect', { x: 22 + i * 8, y: 148, width: 5, height: 4, rx: 1.5 });
      this.#altNodes.push(bar);
      this.#effortBars.push(bar);
      group.append(bar);
    }
    this.#bottomCluster.append(group);
  }

  #buildBlushes(): void {
    for (const side of [-1, 1]) {
      const blush = element('ellipse', {
        cx: VIEW_WIDTH / 2 + side * BLUSH_OFFSET_X,
        cy: 114,
        rx: 15,
        ry: 7,
      });
      this.#altNodes.push(blush);
      this.#blushes.push(blush);
      this.#faceCluster.append(blush);
    }
  }

  /**
   * Each eye is a solid almond clipped by a rectangular lid. Lowering the lid closes the eye,
   * rotating it hardens or softens the look: two parameters cover the whole expressive range.
   */
  #buildEyes(): void {
    for (const side of [-1, 1]) {
      const cx = VIEW_WIDTH / 2 + side * EYE_OFFSET_X;
      const clipId = `eye-clip-${side === -1 ? 'l' : 'r'}-${Math.random().toString(36).slice(2, 8)}`;

      const clip = element('clipPath', { id: clipId });
      const lid = element('rect', {
        x: cx - EYE_RX - 12,
        y: EYE_Y - EYE_RY,
        width: EYE_RX * 2 + 24,
        height: EYE_RY * 2 + 30,
      });
      clip.append(lid);

      const defs = element('defs', {});
      defs.append(clip);

      const group = element('g', { 'clip-path': `url(#${clipId})` });
      const eye = element('ellipse', { cx, cy: EYE_Y, rx: EYE_RX, ry: EYE_RY });
      this.#accentNodes.push(eye);

      // Light reflection offset outwards: gives relief and life.
      const highlight = element('ellipse', {
        cx: cx - side * 12,
        cy: EYE_Y - 5,
        rx: 7.5,
        ry: 5,
        fill: '#ffffff',
        opacity: 0.9,
      });

      group.append(eye, highlight);
      this.#faceCluster.append(defs, group);
      this.#eyes.push({ lid, group, side });
    }
  }

  // --- animation -----------------------------------------------------

  setPalette(palette: AvatarPalette): void {
    for (const node of this.#accentNodes) {
      const isStroked = node.getAttribute('fill') === 'none';
      node.setAttribute(isStroked ? 'stroke' : 'fill', palette.accent);
    }
    for (const node of this.#altNodes) {
      const isStroked = node.getAttribute('fill') === 'none';
      node.setAttribute(isStroked ? 'stroke' : 'fill', palette.accentAlt);
    }
    // One glow over the whole group costs far less than an SVG filter per element, and is enough to
    // suggest an emissive display.
    this.#svg.style.filter = `drop-shadow(0 0 6px ${palette.accent}) drop-shadow(0 0 18px ${palette.accentAlt}55)`;
  }

  /**
   * Recomposes the scene for the tile's aspect.
   *
   * A face is wide: two eyes side by side fix a minimum width, and in a tall tile that is what
   * bounds the scale. The remaining height can only be filled by what surrounds the face. The
   * widgets spread up and down, the face keeps the centre, and the composition fills the tile
   * instead of floating in a middle band.
   */
  resize(width: number, height: number): void {
    if (width <= 0 || height <= 0) return;

    // Height of the drawing frame that would make the viewBox coincide with the tile. Bounded:
    // beyond that the spread would dislocate the composition rather than air it, and `meet` takes
    // over.
    const frame = clamp((VIEW_WIDTH * height) / width, 150, 420);
    this.#svg.setAttribute('viewBox', `0 0 ${VIEW_WIDTH} ${frame}`);

    const slack = frame - VIEW_HEIGHT;
    // The face follows half the play, the clusters all of it: they move away from it twice as fast
    // as it descends, which opens space without ever decentring it.
    this.#faceCluster.setAttribute('transform', `translate(0 ${(slack / 2).toFixed(2)})`);
    this.#topCluster.setAttribute('transform', 'translate(0 0)');
    this.#bottomCluster.setAttribute('transform', `translate(0 ${slack.toFixed(2)})`);
  }

  update(state: AvatarFrameState, dt: number): void {
    this.#advanceReactions(state, dt);

    const posture = POSTURES[state.mood];
    const ease = (current: number, target: number, rate: number): number =>
      current + (target - current) * Math.min(1, rate * dt);

    this.#eyeOpen = ease(this.#eyeOpen, posture.eyeOpen, 7);
    this.#lidAngle = ease(this.#lidAngle, posture.lidAngle, 6);
    this.#blush = ease(this.#blush, posture.blush, 4);
    this.#tempo = ease(this.#tempo, posture.tempo, 3);

    // The face leans into corners and pulls back under braking: it feels the same forces as whoever
    // is looking at it.
    this.#lean = ease(this.#lean, clamp(-state.lateral * 7, -9, 9), 8);
    this.#pitch = ease(this.#pitch, clamp(state.longitudinal * 8, -7, 7), 8);

    const startle = this.#startle / STARTLE_DURATION;
    const thrill = this.#thrill / THRILL_DURATION;
    const twitch = this.#twitch / TWITCH_DURATION;

    const breath = Math.sin(state.time * this.#tempo * 2.2) * (1 + state.intensity * 1.6);

    this.#root.setAttribute(
      'transform',
      `translate(${(this.#lean * 0.8).toFixed(2)} ${(breath - this.#pitch * 0.6 + startle * 3).toFixed(2)}) ` +
        `rotate(${(this.#lean * 0.35).toFixed(2)} ${VIEW_WIDTH / 2} ${VIEW_HEIGHT / 2})`,
    );

    // Blink: the lid falls then rises over a half sine.
    const blinkPhase = this.#blink > 0 ? Math.sin((1 - this.#blink / BLINK_DURATION) * Math.PI) : 0;
    const openness = clamp(
      this.#eyeOpen * (1 - blinkPhase) + startle * 0.45 + thrill * 0.3,
      0.02,
      1.25,
    );
    // A startle widens the eyes: the lid straightens as it opens.
    const lidAngle = this.#lidAngle * (1 - startle) + twitch * 6;
    const gaze = clamp(-state.lateral * 7, -6, 6);

    for (const { lid, side } of this.#eyes) {
      const cx = VIEW_WIDTH / 2 + side * EYE_OFFSET_X;
      const top = EYE_Y + EYE_RY - EYE_RY * 2 * openness;
      lid.setAttribute('y', top.toFixed(2));
      lid.setAttribute('x', (cx - EYE_RX - 12 + gaze * 0.35).toFixed(2));
      // The angle is mirrored from one eye to the other to stay symmetrical.
      lid.setAttribute('transform', `rotate(${(lidAngle * side).toFixed(2)} ${cx} ${EYE_Y})`);
    }

    for (const blush of this.#blushes) {
      blush.setAttribute(
        'opacity',
        clamp(this.#blush * (0.55 + state.effort * 0.5) + thrill * 0.3, 0, 1).toFixed(3),
      );
    }

    const circumference = 2 * Math.PI * 9.5;
    const revLength = circumference * clamp(state.revs, 0, 1) * 0.78;
    this.#revDial.setAttribute('stroke-dasharray', `${revLength.toFixed(2)} ${circumference}`);

    const revHeight = 34 * clamp(state.revs, 0, 1);
    this.#revBar.setAttribute('height', revHeight.toFixed(2));
    this.#revBar.setAttribute('y', (56 - revHeight).toFixed(2));

    this.#effortBars.forEach((bar, index) => {
      // Each bar lights at its threshold, like a VU meter.
      const threshold = index / this.#effortBars.length;
      const active = state.effort > threshold;
      const height = active ? 4 + (state.effort - threshold) * 26 : 4;
      bar.setAttribute('height', height.toFixed(2));
      bar.setAttribute('y', (152 - height).toFixed(2));
      bar.setAttribute('opacity', active ? '1' : '0.28');
    });

    this.#tickGroup.setAttribute('opacity', (0.4 + state.intensity * 0.5).toFixed(3));
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
    this.#svg.remove();
    this.#eyes = [];
    this.#blushes = [];
    this.#accentNodes = [];
    this.#altNodes = [];
    this.#effortBars = [];
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function mountNeonFace(container: HTMLElement, palette: AvatarPalette): AvatarInstance {
  return new NeonFace(container, palette);
}
