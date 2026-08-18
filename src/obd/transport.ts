import type { Unsubscribe } from '../telemetry/DataSource';

/**
 * Transport to the adapter: it moves characters and understands nothing.
 *
 * This is the only piece that differs between the two targets, which is why it is reduced to the
 * strict minimum:
 *
 * - in the browser, Web Bluetooth (`navigator.bluetooth`); - in the Android application, a native
 * plugin - Android's WebView does not support Web Bluetooth, which makes a second implementation
 * unavoidable.
 *
 * Everything above it - reply framing, initialisation sequence, PID decoding - knows neither. That
 * is what allows writing and testing it all without hardware.
 *
 * The ELM327 dialogue being pure ASCII, the interface speaks in strings: conversion from bytes
 * belongs to each transport, and no multi-byte character can end up split across two notifications.
 */
export interface ObdTransport {
  connect(): Promise<void>;
  disconnect(): Promise<void>;

  /**
   * Sends a command. The `\r` terminator is added by the caller: the transport need not know what
   * ends an ELM327 command.
   */
  write(data: string): Promise<void>;

  /** Notifies each fragment received, as-is - the splits are arbitrary. */
  onData(listener: (chunk: string) => void): Unsubscribe;

  /** Notifies an unsolicited link loss (adapter unplugged, out of range). */
  onDisconnect(listener: () => void): Unsubscribe;
}
