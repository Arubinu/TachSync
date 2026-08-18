import { describe, expect, it } from 'vitest';
import {
  cleanLines,
  extractPidData,
  hexToBytes,
  parseReply,
  pidCommand,
  splitResponses,
} from './elm327';

describe('fragment reassembly', () => {
  it('returns a complete reply once the prompt arrives', () => {
    const { responses, pending } = splitResponses('', '41 0C 1A F8\r>');

    expect(responses).toEqual(['41 0C 1A F8']);
    expect(pending).toBe('');
  });

  it('holds an incomplete fragment until the prompt', () => {
    const first = splitResponses('', '41 0C');
    expect(first.responses).toEqual([]);

    const second = splitResponses(first.pending, ' 1A F8\r>');
    expect(second.responses).toEqual(['41 0C 1A F8']);
  });

  it('separates two replies that arrived in the same fragment', () => {
    const { responses } = splitResponses('', '41 0D 32\r>41 0C 1A F8\r>');

    expect(responses).toEqual(['41 0D 32', '41 0C 1A F8']);
  });

  it('supports a character-by-character split', () => {
    let pending = '';
    const collected: string[] = [];

    for (const character of '41 0D 32\r>') {
      const step = splitResponses(pending, character);
      pending = step.pending;
      collected.push(...step.responses);
    }

    expect(collected).toEqual(['41 0D 32']);
  });
});

describe('line cleanup', () => {
  it('strips the command echo', () => {
    expect(cleanLines('010C\r41 0C 1A F8', '010C')).toEqual(['41 0C 1A F8']);
  });

  it('strips the echo whatever the spacing', () => {
    expect(cleanLines('01 0c\r41 0C 1A F8', '010C')).toEqual(['41 0C 1A F8']);
  });

  it('drops the SEARCHING... waiting line', () => {
    expect(cleanLines('SEARCHING...\r41 0D 32')).toEqual(['41 0D 32']);
  });
});

describe('response recognition', () => {
  it('recognises data', () => {
    expect(parseReply('41 0C 1A F8')).toEqual({ kind: 'data', lines: ['41 0C 1A F8'] });
  });

  it('recognises an acknowledgement', () => {
    expect(parseReply('OK')).toEqual({ kind: 'ok' });
  });

  it('recognises a no-data reply', () => {
    expect(parseReply('NO DATA').kind).toBe('no-data');
  });

  it('treats an empty reply as a no-data reply', () => {
    expect(parseReply('').kind).toBe('no-data');
  });

  it('recognises a misunderstood command', () => {
    expect(parseReply('?').kind).toBe('error');
  });

  it.each(['UNABLE TO CONNECT', 'CAN ERROR', 'BUS INIT: ERROR', 'STOPPED', 'BUFFER FULL'])(
    'recognises the error “%s”',
    (message) => {
      expect(parseReply(message).kind).toBe('error');
    },
  );

  it('does not mistake SEARCHING... for an error', () => {
    // First read of a session: the adapter is still searching for the protocol.
    expect(parseReply('SEARCHING...\r41 0D 32')).toEqual({ kind: 'data', lines: ['41 0D 32'] });
  });
});

describe('data byte extraction', () => {
  it('strips the mode and the PID', () => {
    const reply = parseReply('41 0C 1A F8');
    expect(extractPidData(0x0c, reply)).toEqual([0x1a, 0xf8]);
  });

  it('works without spaces', () => {
    // What the adapter returns once `ATS0` is applied.
    expect(extractPidData(0x0c, parseReply('410C1AF8'))).toEqual([0x1a, 0xf8]);
  });

  it('refuses a reply about another PID', () => {
    expect(extractPidData(0x0d, parseReply('41 0C 1A F8'))).toBeNull();
  });

  it('keeps the first matching line when several ECUs answer', () => {
    const reply = parseReply('41 0C 1A F8\r41 0C 0B B8');
    expect(extractPidData(0x0c, reply)).toEqual([0x1a, 0xf8]);
  });

  it('ignores a line from another PID mixed into the replies', () => {
    const reply = parseReply('41 0D 32\r41 0C 1A F8');
    expect(extractPidData(0x0c, reply)).toEqual([0x1a, 0xf8]);
  });

  it('returns nothing on a no-data reply', () => {
    expect(extractPidData(0x0c, parseReply('NO DATA'))).toBeNull();
  });
});

describe('hexadecimal conversion', () => {
  it('accepts both spacings', () => {
    expect(hexToBytes('41 0C 1A F8')).toEqual([0x41, 0x0c, 0x1a, 0xf8]);
    expect(hexToBytes('410C1AF8')).toEqual([0x41, 0x0c, 0x1a, 0xf8]);
  });

  it('refuses an odd number of digits', () => {
    expect(hexToBytes('41 0C 1')).toBeNull();
  });

  it('refuses what is not hexadecimal', () => {
    expect(hexToBytes('NO DATA')).toBeNull();
  });
});

describe('command composition', () => {
  it('composes a mode 01 request', () => {
    expect(pidCommand(0x01, 0x0c)).toBe('010C');
    expect(pidCommand(0x01, 0x00)).toBe('0100');
  });
});
