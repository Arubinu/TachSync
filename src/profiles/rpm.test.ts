import { describe, expect, it } from 'vitest';
import { DEFAULT_RANGES, rpmScale } from './types';

describe('rpmScale', () => {
  it('places the end of travel past the redline', () => {
    // An engine breaking at 5000 sits on a dial graduated to 6000: that margin is
    // what makes the red zone visible.
    expect(rpmScale({ ...DEFAULT_RANGES, redline: 5000 })).toBe(6000);
    expect(rpmScale({ ...DEFAULT_RANGES, redline: 7000 })).toBe(8000);
  });

  it('rounds to the thousand, for round graduations', () => {
    expect(rpmScale({ ...DEFAULT_RANGES, redline: 6500 })).toBe(8000);
    expect(rpmScale({ ...DEFAULT_RANGES, redline: 4200 })).toBe(6000);
  });

  it('always leaves room above the redline', () => {
    for (const redline of [2000, 3500, 5500, 9000, 12000]) {
      expect(rpmScale({ ...DEFAULT_RANGES, redline })).toBeGreaterThan(redline);
    }
  });
});
