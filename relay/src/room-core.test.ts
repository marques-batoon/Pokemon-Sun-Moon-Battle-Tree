import { describe, expect, it } from 'vitest';
import { RATE_LIMIT, RATE_WINDOW_MS } from '../../src/online/relay-protocol';
import { joinSeat, originAllowed, parseClientMessage, withinRate, type Attachment } from './room-core';

describe('relay rules', () => {
  it('seats the room maker first, then one friend; nobody else', () => {
    expect(joinSeat(true, [])).toBe(0);
    expect(joinSeat(true, [0])).toMatch(/already in use/);
    expect(joinSeat(false, [])).toMatch(/No room/);
    expect(joinSeat(false, [0])).toBe(1);
    expect(joinSeat(false, [0, 1])).toMatch(/full/);
  });

  it('accepts only known messages under the size limit', () => {
    expect(parseClientMessage('{"t":"hello","name":"Hau"}')).toEqual({ t: 'hello', name: 'Hau' });
    expect(parseClientMessage('{"t":"msg","data":{"k":"team"}}')).toEqual({ t: 'msg', data: { k: 'team' } });
    expect(parseClientMessage('{"t":"members"}')).toBeNull();
    expect(parseClientMessage('not json')).toBeNull();
    expect(parseClientMessage(new ArrayBuffer(4))).toBeNull();
    expect(parseClientMessage(`{"t":"msg","data":"${'x'.repeat(70_000)}"}`)).toBeNull();
  });

  it('limits how fast a connection can send', () => {
    const att: Attachment = { seat: 0, name: 'Hau', windowStart: 0, count: 0 };
    for (let i = 0; i < RATE_LIMIT; i++) expect(withinRate(att, 1000)).toBe(true);
    expect(withinRate(att, 1000)).toBe(false);
    expect(withinRate(att, RATE_WINDOW_MS + 1000)).toBe(true);
  });

  it('only lets the configured sites connect', () => {
    const allowed = 'https://battle-tree.netlify.app, http://localhost:5173/';
    expect(originAllowed('https://battle-tree.netlify.app', allowed)).toBe(true);
    expect(originAllowed('http://localhost:5173', allowed)).toBe(true);
    expect(originAllowed('https://evil.example', allowed)).toBe(false);
    expect(originAllowed(null, allowed)).toBe(false);
  });
});
