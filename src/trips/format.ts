import type { LanguageCode } from '../i18n';
import type { TripRecord } from './types';

/**
 * Trip formatting for the list.
 *
 * Separate from the component: these are writing rules, not rendering, and they are verifiable
 * without mounting a React tree.
 */

/**
 * Start date and time, in the interface language.
 *
 * `Intl` rather than a home-made format: the order of day and month, the separator and the use of a
 * 24-hour clock change between languages, and none of that can be guessed from the country code.
 */
export function tripDate(startedAt: number, language: LanguageCode): string {
  return new Intl.DateTimeFormat(language, {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(startedAt));
}

/**
 * Duration in h and min, without seconds.
 *
 * Nobody reads a trip back to the second, and "1 h 04" reads at a glance where "3847 s" needs
 * arithmetic.
 */
export function tripDuration(durationS: number): string {
  const minutes = Math.round(durationS / 60);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours === 0 ? `${rest} min` : `${hours} h ${String(rest).padStart(2, '0')}`;
}

/** The trip's figures, in the order they are looked for. */
export function tripFigures(trip: TripRecord): readonly string[] {
  const figures = [
    `${trip.distanceKm.toFixed(1)} km`,
    tripDuration(trip.durationS),
    `${Math.round(trip.averageKmh)} km/h`,
  ];
  // The average is missing under a hundred metres, and on a vehicle publishing neither fuel rate
  // nor mass air flow: no zero is written in its place.
  if (trip.averagePer100km !== null) figures.push(`${trip.averagePer100km.toFixed(1)} L/100`);
  return figures;
}

/**
 * A size, in the units the reader uses.
 *
 * `Intl` carries the abbreviations, so "ko" and "Mo" come out in French and "kB" and "MB" in
 * English without seven more strings to keep in step - and without inventing a translation for a
 * unit that already has an official one in every locale.
 *
 * Kilobytes up to a megabyte, then megabytes with one decimal: "1433 ko" says less at a glance
 * than "1,4 Mo", and a tenth is all the precision a decision to delete needs.
 */
export function byteSize(bytes: number, language: LanguageCode): string {
  const mega = bytes >= 1024 * 1024;
  const value = mega ? bytes / 1024 / 1024 : bytes / 1024;

  return new Intl.NumberFormat(language, {
    style: 'unit',
    unit: mega ? 'megabyte' : 'kilobyte',
    maximumFractionDigits: mega ? 1 : 0,
  }).format(value);
}
