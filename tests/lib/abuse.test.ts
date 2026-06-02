import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import 'dotenv/config';
import { classifyMessage, getBlockState, recordStrike, clearStrikes } from '@/lib/abuse';
import { pool, query } from '@/lib/db/client';

const TEST_IP = '198.51.100.42'; // TEST-NET-2, never a real client

async function reset() {
  await query('DELETE FROM rate_limit_buckets WHERE ip = $1', [TEST_IP]);
  // seed the row the way checkRateLimit would have
  await query(
    'INSERT INTO rate_limit_buckets (ip, window_start, count) VALUES ($1, now(), 1)',
    [TEST_IP],
  );
}

describe('classifyMessage (free heuristic pre-filter)', () => {
  it('passes a genuine question', () => {
    expect(classifyMessage('Does Dalgo connect to KoboToolbox?')).toBe('ok');
  });
  it('passes a non-Latin-script message (Hindi must NOT be junk)', () => {
    expect(classifyMessage('क्या डालगो हमारे डेटा को जोड़ सकता है?')).toBe('ok');
  });
  it('flags empty / whitespace', () => {
    expect(classifyMessage('   ')).toBe('junk');
  });
  it('flags symbol/emoji-only gibberish', () => {
    expect(classifyMessage('!!! @#$%^& 🙂🙂')).toBe('junk');
  });
  it('flags an exact repeat of the previous user message', () => {
    expect(classifyMessage('hello', 'hello')).toBe('junk');
  });
  it('rejects an over-long message as too_long (not a strike)', () => {
    expect(classifyMessage('a'.repeat(5000))).toBe('too_long');
  });
});

describe('strike / block lifecycle (DB)', () => {
  beforeEach(reset);

  it('blocks only after the 5th consecutive strike, then reports retry-after', async () => {
    for (let i = 1; i <= 4; i++) {
      const r = await recordStrike(TEST_IP);
      expect(r.blocked, `strike ${i} should not block`).toBe(false);
    }
    const fifth = await recordStrike(TEST_IP);
    expect(fifth.blocked).toBe(true);
    expect(fifth.retryAfterSec).toBeGreaterThan(0);

    const state = await getBlockState(TEST_IP);
    expect(state.blocked).toBe(true);
  });

  it('clearStrikes resets the counter so the block never trips', async () => {
    await recordStrike(TEST_IP);
    await recordStrike(TEST_IP);
    await clearStrikes(TEST_IP);
    for (let i = 0; i < 4; i++) await recordStrike(TEST_IP);
    // only 4 strikes since the reset → still not blocked
    expect((await getBlockState(TEST_IP)).blocked).toBe(false);
  });

  afterAll(async () => {
    await query('DELETE FROM rate_limit_buckets WHERE ip = $1', [TEST_IP]);
    await pool().end();
  });
});
