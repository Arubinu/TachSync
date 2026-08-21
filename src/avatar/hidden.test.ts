import { describe, expect, it } from 'vitest';
import { wouldEmptyAvatar } from './hidden';

describe('refusing the hide that empties an avatar', () => {
  const parts = ['eyes', 'dial', 'panel'];

  it('allows a hide that leaves something drawn', () => {
    expect(wouldEmptyAvatar(parts, ['dial'], 'panel')).toBe(false);
  });

  it('refuses the hide that takes the last object', () => {
    expect(wouldEmptyAvatar(parts, ['dial', 'panel'], 'eyes')).toBe(true);
  });

  it('refuses when the avatar holds a single object', () => {
    expect(wouldEmptyAvatar(['whole'], [], 'whole')).toBe(true);
  });

  it('allows anything when the engine reports no objects', () => {
    // An avatar that names nothing has nothing to protect, and a rule that refused every hide
    // there would only be in the way.
    expect(wouldEmptyAvatar([], [], 'whatever')).toBe(false);
  });

  it('ignores a stored id the avatar does not have', () => {
    // Sets are kept per avatar, but a model edited since - or a hand-written file - can leave an
    // id behind. Counting it would refuse a hide that in fact leaves two objects drawn.
    expect(wouldEmptyAvatar(parts, ['tail-of-another-avatar'], 'dial')).toBe(false);
  });

  it('is unmoved by hiding something already hidden', () => {
    expect(wouldEmptyAvatar(parts, ['dial', 'panel'], 'dial')).toBe(false);
  });
});
