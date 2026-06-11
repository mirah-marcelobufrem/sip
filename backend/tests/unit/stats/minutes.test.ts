import { formatMinutesPlayed, isDNP } from '../../../src/domain/stat-calculators.js';
import type { StatEvent } from '../../../src/domain/entities/game.entity.js';

const GAME_ID = '00000000-0000-0000-0000-000000000001';
const TEAM_ID = '00000000-0000-0000-0000-000000000002';
const STARTER_ID = '00000000-0000-0000-0000-000000000010';
const SUB_ID = '00000000-0000-0000-0000-000000000011';
const BENCH_ID = '00000000-0000-0000-0000-000000000012';

const GAME_40_MIN = 40 * 60; // 2400 s

function makeEvent(overrides: Partial<StatEvent> = {}): StatEvent {
  return {
    id: '00000000-0000-0000-0000-000000000100',
    gameId: GAME_ID,
    period: 1,
    clockTimeSeconds: 300,
    playerId: SUB_ID,
    teamId: TEAM_ID,
    statType: 'SUB_IN',
    value: 1,
    xCourt: null,
    yCourt: null,
    lineupSnapshotId: null,
    seq: null,
    linkedActionId: null,
    linkRole: null,
    waveSubGroupId: null,
    isTeamRebound: false,
    isBenchFoul: false,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('formatMinutesPlayed (BR-MET-1.1–1.5)', () => {
  it('BR-MET-1.1: 29 s in a 40-min game → "0" (under 30 s rounds down)', () => {
    expect(formatMinutesPlayed(29, GAME_40_MIN)).toBe('0');
  });

  it('BR-MET-1.2: 30 s in a 40-min game → "1" (30 s or more rounds up)', () => {
    expect(formatMinutesPlayed(30, GAME_40_MIN)).toBe('1');
  });

  it('BR-MET-1.5: 2399 s (39:59) in a 40-min game → "39" (final minute below max always rounds down)', () => {
    expect(formatMinutesPlayed(2399, GAME_40_MIN)).toBe('39');
  });

  it('BR-MET-1.5: 2370 s (39:30) in a 40-min game → "39" (still inside the final minute)', () => {
    expect(formatMinutesPlayed(2370, GAME_40_MIN)).toBe('39');
  });

  it('2400 s (40:00) in a 40-min game → "40" (played the entire game)', () => {
    expect(formatMinutesPlayed(2400, GAME_40_MIN)).toBe('40');
  });

  it('0 s → "0" (DNP is decided by isDNP, not by the formatter)', () => {
    expect(formatMinutesPlayed(0, GAME_40_MIN)).toBe('0');
  });

  it('BR-MET-1.4: 0.5 s rounds up to a full second first → "0"', () => {
    expect(formatMinutesPlayed(0.5, GAME_40_MIN)).toBe('0');
  });

  it('BR-MET-1.4: 29.2 s rounds up to 30 s first → "1"', () => {
    expect(formatMinutesPlayed(29.2, GAME_40_MIN)).toBe('1');
  });

  it('BR-MET-1.4: 89.5 s rounds up to 90 s (1:30) → "2"', () => {
    expect(formatMinutesPlayed(89.5, GAME_40_MIN)).toBe('2');
  });

  it('regular rounding mid-game: 605 s (10:05) → "10"', () => {
    expect(formatMinutesPlayed(605, GAME_40_MIN)).toBe('10');
  });
});

describe('isDNP (BR-MET-1.3)', () => {
  it('0 s, never subbed in and not a starter → DNP', () => {
    const events = [makeEvent({ statType: 'SUB_IN', playerId: SUB_ID })];
    expect(isDNP(events, BENCH_ID, [STARTER_ID])).toBe(true);
  });

  it('0 s but a starter → not DNP (shows "0" minutes)', () => {
    expect(isDNP([], STARTER_ID, [STARTER_ID])).toBe(false);
    expect(formatMinutesPlayed(0, GAME_40_MIN)).toBe('0');
  });

  it('player with a SUB_IN event → not DNP', () => {
    const events = [makeEvent({ statType: 'SUB_IN', playerId: SUB_ID })];
    expect(isDNP(events, SUB_ID, [STARTER_ID])).toBe(false);
  });

  it('SUB_OUT alone does not count as entering the game', () => {
    const events = [makeEvent({ statType: 'SUB_OUT', playerId: BENCH_ID })];
    expect(isDNP(events, BENCH_ID, [STARTER_ID])).toBe(true);
  });
});
