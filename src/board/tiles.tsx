import { useEffect, useRef } from 'react';
import { AvatarStage } from '../avatar/AvatarStage';
import type { AvatarPalette } from '../avatar/types';
import type { TelemetrySnapshot, TelemetryStore } from '../telemetry/TelemetryStore';
import { boostPressure, consumptionPer100km, fuelRateLitresPerHour } from '../telemetry/types';
import { useTranslation } from '../i18n';
import { metricLabel, type MetricId, type TemplateNode, type TileCaption, type TileConfig } from './layout';
import { TileTemplate } from './TileTemplate';
import { DEFAULT_RANGES, rpmScale, type VehicleRanges } from '../profiles/types';
import { Dial } from './Dial';
import { angleAt, ARC_LENGTH, CENTER } from './dialGeometry';

/**
 * Tile rendering.
 *
 * No value passes through React state: each tile subscribes to the store and writes into its own
 * DOM node. A tile re-renders only when its configuration changes, never because the car is moving.
 */

type Extractor = (snapshot: TelemetrySnapshot) => number | null;

interface MetricSpec {
  readonly unit: string;
  readonly extract: Extractor;
  readonly format: (value: number) => string;
  /**
   * Fraction 0..1 for the level bar. Absent means no bar.
   *
   * Receives the vehicle's full-scale values: a hard-coded scale suits one car and one only.
   * Universal metrics - percentages, pressures - ignore them, which is the right way to say they do
   * not depend on the car.
   */
  readonly ratio?: (value: number, ranges: VehicleRanges) => number;
  /**
   * Where the red zone starts, as a fraction of the range. Absent means none.
   *
   * It belongs to the metric rather than the dial: only revs have a redline. Painted for everyone
   * at eighty percent, as it used to be, it announced a danger on boost or consumption that does
   * not exist.
   */
  readonly redlineAt?: (ranges: VehicleRanges) => number;
}

const fixed = (digits: number) => (value: number) => value.toFixed(digits);

export const METRIC_SPECS: Record<Exclude<MetricId, 'avatar' | 'gear'>, MetricSpec> = {
  speed: {
    unit: 'km/h',
    extract: (s) => s.frame.speed,
    format: fixed(0),
    ratio: (v, ranges) => v / ranges.speed,
  },
  rpm: {
    unit: 'tr/min',
    extract: (s) => s.frame.rpm,
    format: fixed(0),
    ratio: (v, ranges) => v / rpmScale(ranges),
    redlineAt: (ranges) => ranges.redline / rpmScale(ranges),
  },
  throttle: {
    unit: '%',
    extract: (s) => s.frame.throttle,
    format: fixed(0),
    ratio: (v) => v / 100,
  },
  boost: {
    unit: 'bar',
    // Relative kPa says little: display bar, like a boost gauge.
    extract: (s) => {
      const kpa = boostPressure(s.frame);
      return kpa === null ? null : kpa / 100;
    },
    format: (v) => (v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2)),
    // Classic gauge scale: -1 bar (vacuum) to +1.5 bar.
    ratio: (v) => (v + 1) / 2.5,
  },
  consumption: {
    unit: 'L/100',
    extract: (s) => consumptionPer100km(s.frame),
    format: fixed(1),
    ratio: (v) => v / 25,
  },
  consumptionRate: {
    unit: 'L/h',
    extract: (s) => fuelRateLitresPerHour(s.frame),
    format: fixed(1),
    ratio: (v) => v / 40,
  },
  engineLoad: {
    unit: '%',
    extract: (s) => s.frame.engineLoad,
    format: fixed(0),
    ratio: (v) => v / 100,
  },
  coolant: {
    unit: '°C',
    extract: (s) => s.frame.coolantTemp,
    format: fixed(0),
    ratio: (v) => v / 120,
  },
  maf: { unit: 'g/s', extract: (s) => s.frame.maf, format: fixed(1), ratio: (v) => v / 150 },
  lateralG: {
    unit: 'g',
    extract: (s) => s.frame.lateralG,
    format: (v) => v.toFixed(2),
    ratio: (v) => Math.abs(v),
  },
  longitudinalG: {
    unit: 'g',
    extract: (s) => s.frame.longitudinalG,
    format: (v) => v.toFixed(2),
    ratio: (v) => Math.abs(v),
  },
  tripDistance: { unit: 'km', extract: (s) => s.trip.distanceKm, format: fixed(1) },
  tripAverage: { unit: 'L/100', extract: (s) => s.trip.averagePer100km, format: fixed(1) },
  tripDuration: {
    unit: '',
    extract: (s) => s.trip.durationS,
    format: (v) => {
      const minutes = Math.floor(v / 60);
      const seconds = Math.floor(v % 60);
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    },
  },
};

/**
 * Class per caption state, written out rather than composed.
 *
 * A template string built the class from the state name and silently stopped matching the
 * stylesheet the day the state was renamed - the hidden caption simply showed again, with nothing
 * to fail. Spelling each one out puts the class where a search for it will find it, and makes a new
 * state a type error rather than a missing rule.
 */
const CAPTION_CLASS: Record<TileCaption, string> = {
  show: 'tile__label',
  hide: 'tile__label is-hide',
  spread: 'tile__label is-spread',
};

export interface TileContentProps {
  readonly tile: TileConfig;
  readonly store: TelemetryStore;
  readonly avatarId: string;
  readonly palette: AvatarPalette;
  /** Structure imported with the preset. Absent means the standard arrangement. */
  readonly template?: readonly TemplateNode[] | null;
  /** Gauge shape, dictated by the theme. Bar by default. */
  readonly gauge?: GaugeShape;
  /** Personal shift for the style engine, 0 when the trip history is not being used. */
  readonly baselineShift?: number;
  /**
   * Vehicle full-scale values.
   *
   * Defaulted outside the board - catalogue, edit preview: those views show a tile in general, not
   * in a particular car.
   */
  readonly ranges?: VehicleRanges;
}

export function TileContent({
  tile,
  store,
  avatarId,
  palette,
  template = null,
  gauge = 'bar',
  ranges = DEFAULT_RANGES,
  baselineShift = 0,
}: TileContentProps): React.JSX.Element {
  const t = useTranslation();
  const [primary, ...secondaries] = tile.metrics;
  if (primary === undefined) return <span className="tile__label">{t.editor.tile}</span>;

  // A template replaces the standard arrangement entirely: mixing the two would produce duplicates,
  // the author having already placed what they want.
  if (template !== null && template.length > 0) {
    return <TileTemplate nodes={template} store={store} />;
  }

  // The avatar is not a measurement: labelling it would drop a floating word onto the screen
  // background, its tile having no dressing.
  //
  /*
   * The caption is always rendered, whatever its state.
   *
   * Removing it looked simpler and broke the dial: the tile is a grid of `auto 1fr auto`, the dial
   * reads its height from the `1fr` row, and losing a child shifted it up into the `auto` one -
   * where a height of 100% resolves against nothing and the dial vanished entirely.
   *
   * So the slot stays and only its height goes, which is what `spread` means anyway: the row gives
   * up its space to the row below rather than disappearing from the layout.
   */
  const caption = primary === 'avatar' ? 'spread' : tile.caption;
  const captionClass = CAPTION_CLASS[caption];

  return (
    <>
      <span className={captionClass} aria-hidden={caption !== 'show'}>
        {metricLabel(primary, t)}
      </span>
      {primary === 'avatar' ? (
        <AvatarStage
          store={store}
          avatarId={avatarId}
          palette={palette}
          mirrored={tile.mirrored}
          redline={ranges.redline}
          baselineShift={baselineShift}
        />
      ) : (
        <PrimaryValue metric={primary} store={store} gauge={gauge} ranges={ranges} />
      )}
      {secondaries.length > 0 && (
        <span className="tile__secondaries">
          {secondaries.map((metric) => (
            <SecondaryValue key={metric} metric={metric} store={store} />
          ))}
        </span>
      )}
    </>
  );
}

interface ValueProps {
  readonly metric: MetricId;
  readonly store: TelemetryStore;
}

/**
 * Gauge shape, dictated by the theme.
 *
 * A bar by default. The dial needs a tile tall enough to hold it, which is why it belongs to the
 * theme - which also sets tile footprints - rather than to the metric shown.
 */
export type GaugeShape = 'bar' | 'dial';

function PrimaryValue({
  metric,
  store,
  gauge,
  ranges,
}: ValueProps & { readonly gauge: GaugeShape; readonly ranges: VehicleRanges }): React.JSX.Element {
  const valueRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const needleRef = useRef<SVGGElement>(null);
  const progressRef = useRef<SVGPathElement>(null);

  // The engaged gear is not a continuous measurement: no bar, no decimals.
  const isGear = metric === 'gear';
  const spec = isGear ? null : METRIC_SPECS[metric as keyof typeof METRIC_SPECS];

  useEffect(() => {
    return store.subscribe((snapshot) => {
      const valueNode = valueRef.current;
      if (valueNode !== null) {
        const text = isGear ? formatGear(snapshot) : formatValue(spec, snapshot);
        if (valueNode.textContent !== text) valueNode.textContent = text;

        // Outside the guard above, deliberately: on the first snapshot the text is already the
        // dash, so nothing would change and the marker would never be set. Without it the em dash
        // inherits the size and glow of a real reading and looks like a full bar - the exact
        // opposite of "no data". The toggle touches the DOM only when the state really differs.
        valueNode.parentElement?.classList.toggle('tile__value--idle', text === NO_VALUE);
      }

      if (spec?.ratio === undefined) return;
      const value = spec.extract(snapshot);
      const ratio = value === null ? 0 : clamp01(spec.ratio(value, ranges));

      const barNode = barRef.current;
      if (barNode !== null) {
        barNode.style.transform = `scaleX(${ratio.toFixed(3)})`;
        // Drives the gauge's colour and glow: the stylesheet mixes towards the danger token from
        // it, so the needle warms up on its own.
        barNode.style.setProperty('--gauge-ratio', ratio.toFixed(3));
      }

      // Two attributes per frame and nothing else: the needle angle and the fraction of arc
      // revealed. The rest of the dial is static.
      const needleNode = needleRef.current;
      if (needleNode !== null) {
        const angle = angleAt(ratio).toFixed(2);
        needleNode.setAttribute('transform', `rotate(${angle} ${CENTER.x} ${CENTER.y})`);
        needleNode.style.setProperty('--gauge-ratio', ratio.toFixed(3));
      }

      const progressNode = progressRef.current;
      if (progressNode !== null) {
        progressNode.setAttribute('stroke-dashoffset', (ARC_LENGTH * (1 - ratio)).toFixed(2));
        progressNode.style.setProperty('--gauge-ratio', ratio.toFixed(3));
      }
    });
  }, [spec, isGear, store]);

  // The gauge belongs to its value: left as siblings in the tile grid they were separated by all
  // the free height, and the bar ended up pinned at the bottom with no readable link to the figure
  // it qualifies.
  //
  // The dial encircles the value instead of preceding it, which is what separates a dial from a
  // bent bar. It therefore appears only where there is a range to travel.
  const dialed = gauge === 'dial' && spec?.ratio !== undefined;

  return (
    <span className={dialed ? 'tile__readout tile__readout--dial' : 'tile__readout'}>
      {dialed && (
        <Dial
          needleRef={needleRef}
          progressRef={progressRef}
          {...(spec?.redlineAt === undefined ? {} : { redlineFrom: spec.redlineAt(ranges) })}
        />
      )}

      {/*
        The "no data" state is set by the subscription, never here: two competing mechanisms on the
        same class end up contradicting each other on remount. React therefore keeps a fixed
        `className`.
      */}
      <span className={isGear ? 'tile__value tile__value--glyph' : 'tile__value'}>
        <span ref={valueRef}>{NO_VALUE}</span>
        {spec !== null && spec.unit !== '' && <span className="tile__unit">{spec.unit}</span>}
      </span>

      {!dialed && spec?.ratio !== undefined && (
        <span className="tile__bar">
          <span ref={barRef} className="tile__bar-fill" />
        </span>
      )}
    </span>
  );
}

function SecondaryValue({ metric, store }: ValueProps): React.JSX.Element {
  const t = useTranslation();
  const valueRef = useRef<HTMLSpanElement>(null);
  const isGear = metric === 'gear';
  const spec = isGear ? null : METRIC_SPECS[metric as keyof typeof METRIC_SPECS];

  useEffect(() => {
    return store.subscribe((snapshot) => {
      const node = valueRef.current;
      if (node === null) return;
      const text = isGear ? formatGear(snapshot) : formatValue(spec, snapshot);
      if (node.textContent !== text) node.textContent = text;
    });
  }, [spec, isGear, store]);

  return (
    <span className="tile__secondary">
      <span className="tile__secondary-label">{metricLabel(metric, t)}</span>
      <span ref={valueRef}>—</span>
      {spec !== null && spec.unit !== '' && (
        <span className="tile__secondary-unit">{spec.unit}</span>
      )}
    </span>
  );
}

/** Metric unavailable. Never a zero, which would pass for a real reading. */
const NO_VALUE = '—';

function formatValue(spec: MetricSpec | null, snapshot: TelemetrySnapshot): string {
  if (spec === null) return NO_VALUE;
  const value = spec.extract(snapshot);
  // The em dash marks an unavailable metric - never a zero, which would suggest a real reading.
  return value === null ? NO_VALUE : spec.format(value);
}

function formatGear(snapshot: TelemetrySnapshot): string {
  const gear = snapshot.frame.gear;
  return gear === null ? NO_VALUE : gear === 0 ? 'N' : String(gear);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
