import {
  Emitter,
  type ConnectionStatus,
  type DataSource,
  type DataSourceInfo,
  type Unsubscribe,
} from '../telemetry/DataSource';
import { EMPTY_FRAME, type AnyChannel, type TelemetryFrame } from '../telemetry/types';
import {
  createDriverState,
  createRandom,
  stepDriver,
  PROFILE_PARAMS,
  type DriverState,
  type DrivingProfile,
} from './driver';
import {
  BAROMETRIC_KPA,
  createVehicleState,
  engineLoad,
  GRAVITY,
  HOT_HATCH_TURBO,
  massAirFlow,
  MS_TO_KMH,
  stepVehicle,
  type VehicleSpec,
  type VehicleState,
} from './vehicle';

export interface SimulatedSourceOptions {
  readonly vehicle?: VehicleSpec;
  readonly profile?: DrivingProfile;
  /** Frame emission rate, Hz. A real ELM327 tops out around 5-10 Hz. */
  readonly frequencyHz?: number;
  /** Random generator seed - fix it for reproducible tests. */
  readonly seed?: number;
}

/**
 * Simulated telemetry source.
 *
 * Serves two purposes, one temporary and one permanent: developing the whole application before the
 * OBD adapter arrives, and afterwards replaying typed drives deterministically, which makes the
 * analysis engines testable without going for a drive.
 */
export class SimulatedSource implements DataSource {
  readonly info: DataSourceInfo = {
    id: 'simulated',
    label: 'Simulateur',
    kind: 'simulated',
  };

  #status: ConnectionStatus = 'disconnected';
  #frames = new Emitter<[TelemetryFrame]>();
  #statuses = new Emitter<[ConnectionStatus, Error?]>();

  #spec: VehicleSpec;
  #profile: DrivingProfile;
  #frequencyHz: number;
  #random: () => number;

  #vehicle: VehicleState;
  #driver: DriverState;
  #timer: ReturnType<typeof setInterval> | null = null;
  #lastTick = 0;

  constructor(options: SimulatedSourceOptions = {}) {
    this.#spec = options.vehicle ?? HOT_HATCH_TURBO;
    this.#profile = options.profile ?? 'normal';
    this.#frequencyHz = options.frequencyHz ?? 10;
    this.#random = createRandom(options.seed ?? 1);
    this.#vehicle = createVehicleState(this.#spec);
    this.#driver = createDriverState();
  }

  getStatus(): ConnectionStatus {
    return this.#status;
  }

  getAvailableChannels(): ReadonlySet<AnyChannel> {
    const channels: AnyChannel[] = [
      'speed',
      'rpm',
      'throttle',
      'engineLoad',
      'map',
      'barometric',
      'maf',
      'coolantTemp',
      'gear',
      'lateralG',
      'longitudinalG',
      // Derived from MAF, so always available here.
      'consumption',
    ];
    // `fuelRate` (PID 0x5E) is rarely supported: the simulator reproduces that gap so the MAF-based
    // fallback is developed from the start.

    // Without a turbo there is no boost to show: the corresponding tile must disappear, not display
    // 0.
    if (this.#spec.turbocharged) channels.push('boost');

    return new Set(channels);
  }

  async connect(): Promise<void> {
    if (this.#status === 'connected') return;
    this.#setStatus('connecting');

    this.#lastTick = performance.now();
    const intervalMs = 1000 / this.#frequencyHz;
    this.#timer = setInterval(() => this.#tick(), intervalMs);

    this.#setStatus('connected');
  }

  async disconnect(): Promise<void> {
    if (this.#timer !== null) {
      clearInterval(this.#timer);
      this.#timer = null;
    }
    this.#setStatus('disconnected');
  }

  onFrame(listener: (frame: TelemetryFrame) => void): Unsubscribe {
    return this.#frames.add(listener);
  }

  onStatusChange(listener: (status: ConnectionStatus, error?: Error) => void): Unsubscribe {
    return this.#statuses.add(listener);
  }

  /** Changes the simulated driving style on the fly, without breaking the session. */
  setProfile(profile: DrivingProfile): void {
    this.#profile = profile;
  }

  getProfile(): DrivingProfile {
    return this.#profile;
  }

  /** Changes the simulated vehicle. Resets the physical state. */
  setVehicle(spec: VehicleSpec): void {
    this.#spec = spec;
    this.#vehicle = createVehicleState(spec);
  }

  getVehicle(): VehicleSpec {
    return this.#spec;
  }

  #tick(): void {
    const now = performance.now();
    // Clamped: a backgrounded tab can make `dt` enormous and diverge the integration.
    const dt = Math.min((now - this.#lastTick) / 1000, 0.25);
    this.#lastTick = now;
    this.#frames.emit(this.advance(dt));
  }

  /**
   * Advances the simulation one step and produces the corresponding frame.
   *
   * Public so tests can run a whole trip at a fixed step, with no clock and no `setInterval`.
   */
  advance(dt: number): TelemetryFrame {
    const params = PROFILE_PARAMS[this.#profile];
    const inputs = stepDriver(this.#driver, this.#profile, this.#vehicle.speed, dt, this.#random);

    stepVehicle(
      this.#spec,
      this.#vehicle,
      {
        throttle: inputs.throttle,
        brake: inputs.brake,
        shiftUpRpm: params.shiftUpRpm,
        shiftDownRpm: params.shiftDownRpm,
      },
      dt,
    );

    const map = this.#vehicle.map;
    const maf = massAirFlow(this.#spec, this.#vehicle.rpm, map);

    return {
      ...EMPTY_FRAME,
      timestamp: Date.now(),
      speed: this.#vehicle.speed * MS_TO_KMH,
      rpm: this.#vehicle.rpm,
      throttle: inputs.throttle * 100,
      engineLoad: engineLoad(this.#spec, map),
      map,
      barometric: BAROMETRIC_KPA,
      maf,
      // fuelRate left null: see getAvailableChannels().
      coolantTemp: this.#vehicle.coolantTemp,
      gear: this.#vehicle.speed > 1 ? this.#vehicle.gear : 0,
      lateralG: inputs.lateralG,
      longitudinalG: this.#vehicle.acceleration / GRAVITY,
    };
  }

  #setStatus(status: ConnectionStatus, error?: Error): void {
    this.#status = status;
    this.#statuses.emit(status, error);
  }
}
