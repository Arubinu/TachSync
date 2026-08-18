import type { Unsubscribe } from '../telemetry/DataSource';
import type { ObdTransport } from './transport';

/**
 * Bluetooth Low Energy transport, via Web Bluetooth.
 *
 * Works in Chrome on Android, the primary target; the native application's WebView does not expose
 * it and will get a separate native bridge.
 *
 * Characteristics are found by their properties, never by their UUID. BLE ELM327 adapters have no
 * standardised profile: each manufacturer picks its own identifiers, and a hard-coded list would
 * only cover hardware we have held. Among the exposed services we therefore look for a
 * characteristic that can write and one that can notify - which describes a serial bridge exactly,
 * whatever its number.
 */

/**
 * Web Bluetooth is not in the standard type library and will not be until the specification
 * stabilises. The few members used are described here rather than pulling in a whole typings
 * package for a handful of methods - and what is described is exactly what this file depends on.
 */

interface GattCharacteristic {
  readonly properties: {
    readonly write: boolean;
    readonly writeWithoutResponse: boolean;
    readonly notify: boolean;
  };
  readonly value?: DataView | undefined;
  startNotifications(): Promise<unknown>;
  addEventListener(type: 'characteristicvaluechanged', listener: (event: Event) => void): void;
  writeValueWithResponse(value: BufferSource): Promise<void>;
  writeValueWithoutResponse(value: BufferSource): Promise<void>;
}

interface GattService {
  getCharacteristics(): Promise<GattCharacteristic[]>;
}

interface GattServer {
  connect(): Promise<GattServer>;
  disconnect(): void;
  getPrimaryServices(): Promise<GattService[]>;
}

interface BleDevice {
  /** Stable across sessions for one origin: this is the car. */
  readonly id: string;
  /** Name advertised by the adapter. Absent on some models. */
  readonly name?: string | undefined;
  readonly gatt?: GattServer | undefined;
  addEventListener(type: 'gattserverdisconnected', listener: () => void): void;
}

interface BluetoothApi {
  requestDevice(options: {
    filters?: Array<{ namePrefix: string }>;
    optionalServices?: ReadonlyArray<number | string>;
  }): Promise<BleDevice>;
}

/** Known services, requested at pairing time to gain the right to read them. */
const KNOWN_SERVICES: ReadonlyArray<number | string> = [
  0xfff0, // the most widespread ELM327 BLE
  0xffe0, // clones HM-10
  0xfff1,
  '00001101-0000-1000-8000-00805f9b34fb', // serial port
];

const NAME_HINTS = ['obd', 'elm', 'vlink', 'vgate', 'link'];

interface Chosen {
  readonly write: GattCharacteristic;
  readonly notify: GattCharacteristic;
}

export class WebBluetoothTransport implements ObdTransport {
  readonly #device: BleDevice;

  /**
   * Which adapter this is.
   *
   * Exposed because it is what allows recognising the car without asking: the id the browser
   * assigns is stable across sessions for one origin. The transport knows nothing about profiles -
   * it only says who it is talking to.
   */
  get device(): { readonly id: string; readonly name: string } {
    return { id: this.#device.id, name: this.#device.name ?? '' };
  }
  #chosen: Chosen | null = null;
  readonly #dataListeners = new Set<(chunk: string) => void>();
  readonly #lostListeners = new Set<() => void>();
  readonly #decoder = new TextDecoder();
  readonly #encoder = new TextEncoder();

  constructor(device: BleDevice) {
    this.#device = device;
    this.#device.addEventListener('gattserverdisconnected', () => {
      this.#chosen = null;
      this.#lostListeners.forEach((listener) => listener());
    });
  }

  /**
   * Opens the browser's chooser.
   *
   * A page may not enumerate Bluetooth: the browser shows the list and returns the chosen device.
   * Name filters help narrow it without excluding an adapter with an unexpected name, hence the
   * fallback to all devices.
   */
  static async request(): Promise<WebBluetoothTransport | null> {
    const bluetooth = (navigator as { bluetooth?: BluetoothApi }).bluetooth;
    if (bluetooth === undefined) return null;

    const device = await bluetooth.requestDevice({
      filters: NAME_HINTS.map((namePrefix) => ({ namePrefix })),
      optionalServices: KNOWN_SERVICES,
    });

    return new WebBluetoothTransport(device);
  }

  async connect(): Promise<void> {
    const server = await this.#device.gatt?.connect();
    if (server === undefined) throw new Error('GATT server unavailable.');

    this.#chosen = await pickCharacteristics(server);

    await this.#chosen.notify.startNotifications();
    this.#chosen.notify.addEventListener('characteristicvaluechanged', (event) => {
      const value = (event.target as unknown as GattCharacteristic).value;
      if (value === undefined) return;
      // Passed through as-is: a reply arrives across several notifications, and it is the ELM327
      // client's job to reassemble - only it knows where a frame ends.
      const chunk = this.#decoder.decode(value);
      this.#dataListeners.forEach((listener) => listener(chunk));
    });
  }

  async disconnect(): Promise<void> {
    this.#chosen = null;
    this.#device.gatt?.disconnect();
  }

  async write(data: string): Promise<void> {
    const chosen = this.#chosen;
    if (chosen === null) throw new Error('Not connected.');

    // Without response where the characteristic allows it: the GATT acknowledgement doubles the
    // round trip, and at ten polls per second that is the difference between a usable rate and a
    // sluggish one.
    const payload = this.#encoder.encode(data);
    if (chosen.write.properties.writeWithoutResponse) {
      await chosen.write.writeValueWithoutResponse(payload);
      return;
    }
    await chosen.write.writeValueWithResponse(payload);
  }

  onData(listener: (chunk: string) => void): Unsubscribe {
    this.#dataListeners.add(listener);
    return () => this.#dataListeners.delete(listener);
  }

  onDisconnect(listener: () => void): Unsubscribe {
    this.#lostListeners.add(listener);
    return () => this.#lostListeners.delete(listener);
  }
}

/**
 * Keeps the first write/notify pair found.
 *
 * The two may live in the same service or in two different ones depending on the adapter, so
 * everything is walked rather than presumed.
 */
async function pickCharacteristics(server: GattServer): Promise<Chosen> {
  let write: GattCharacteristic | null = null;
  let notify: GattCharacteristic | null = null;

  for (const service of await server.getPrimaryServices()) {
    for (const characteristic of await service.getCharacteristics()) {
      const { write: canWrite, writeWithoutResponse, notify: canNotify } = characteristic.properties;
      if (write === null && (canWrite || writeWithoutResponse)) write = characteristic;
      if (notify === null && canNotify) notify = characteristic;
    }
    if (write !== null && notify !== null) break;
  }

  if (write === null || notify === null) {
    throw new Error('No serial-like characteristic pair on this adapter.');
  }
  return { write, notify };
}
