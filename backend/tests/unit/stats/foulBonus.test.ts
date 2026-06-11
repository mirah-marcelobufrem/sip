import {
  FOUL_BONUS_THRESHOLD,
  getTeamFoulCountForPeriod,
  isTeamInBonus,
  aggregateTeamRebounds,
  aggregatePlayerEvents,
} from '../../../src/domain/stat-calculators.js';
import type { StatEvent, StatType } from '../../../src/domain/entities/game.entity.js';

const GAME_ID = '00000000-0000-0000-0000-000000000001';
const TEAM_A = '00000000-0000-0000-0000-00000000000a';
const TEAM_B = '00000000-0000-0000-0000-00000000000b';
const P1 = '00000000-0000-0000-0000-000000000101';

let idCounter = 0;
function makeEvent(overrides: Partial<StatEvent> = {}): StatEvent {
  idCounter += 1;
  return {
    id: `00000000-0000-0000-0000-0000000005${String(idCounter).padStart(2, '0')}`,
    gameId: GAME_ID,
    period: 1,
    clockTimeSeconds: 300,
    playerId: P1,
    teamId: TEAM_A,
    statType: 'PF',
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

function fouls(count: number, overrides: Partial<StatEvent> = {}): StatEvent[] {
  return Array.from({ length: count }, () => makeEvent({ statType: 'PF', ...overrides }));
}

describe('getTeamFoulCountForPeriod / isTeamInBonus (BR-STAT-9.2/9.3)', () => {
  it('exports the FIBA threshold of 5 team fouls per period', () => {
    expect(FOUL_BONUS_THRESHOLD).toBe(5);
  });

  it('counts PF, TF and FF as team fouls', () => {
    const events = (['PF', 'TF', 'FF'] as StatType[]).map((statType) => makeEvent({ statType }));
    expect(getTeamFoulCountForPeriod(events, TEAM_A, 1)).toBe(3);
  });

  it('coach/bench technical foul does NOT increment the team foul count', () => {
    const events = [...fouls(4), makeEvent({ statType: 'TF', playerId: null, isBenchFoul: true })];
    expect(getTeamFoulCountForPeriod(events, TEAM_A, 1)).toBe(4);
    expect(isTeamInBonus(events, TEAM_A, 1)).toBe(false);
  });

  it('4th team foul does not trigger the bonus', () => {
    expect(isTeamInBonus(fouls(4), TEAM_A, 1)).toBe(false);
  });

  it('5th team foul triggers the bonus', () => {
    expect(isTeamInBonus(fouls(5), TEAM_A, 1)).toBe(true);
  });

  it('only counts fouls by the requested team', () => {
    const events = [...fouls(5, { teamId: TEAM_B })];
    expect(getTeamFoulCountForPeriod(events, TEAM_A, 1)).toBe(0);
    expect(isTeamInBonus(events, TEAM_B, 1)).toBe(true);
  });

  it('foul count resets each period', () => {
    const events = [...fouls(5, { period: 1 }), ...fouls(2, { period: 2 })];
    expect(isTeamInBonus(events, TEAM_A, 1)).toBe(true);
    expect(getTeamFoulCountForPeriod(events, TEAM_A, 2)).toBe(2);
    expect(isTeamInBonus(events, TEAM_A, 2)).toBe(false);
  });

  it('overtime (period 5) starts with a fresh count', () => {
    const events = [...fouls(5, { period: 4 }), ...fouls(4, { period: 5 })];
    expect(isTeamInBonus(events, TEAM_A, 5)).toBe(false);
    expect(isTeamInBonus(events, TEAM_A, 4)).toBe(true);
  });
});

describe('team rebounds (BR-STAT-4.3, I-05)', () => {
  it('aggregateTeamRebounds counts only team-flagged rebounds for the team', () => {
    const events = [
      makeEvent({ statType: 'OREB', playerId: null, isTeamRebound: true }),
      makeEvent({ statType: 'DREB', playerId: null, isTeamRebound: true }),
      makeEvent({ statType: 'DREB', playerId: null, isTeamRebound: true, teamId: TEAM_B }),
      makeEvent({ statType: 'DREB', playerId: P1 }), // player rebound — excluded
    ];
    expect(aggregateTeamRebounds(events, TEAM_A)).toEqual({ teamOReb: 1, teamDReb: 1 });
    expect(aggregateTeamRebounds(events, TEAM_B)).toEqual({ teamOReb: 0, teamDReb: 1 });
  });

  it('aggregatePlayerEvents excludes team rebounds from the individual stat line', () => {
    const events = [
      makeEvent({ statType: 'OREB', playerId: P1 }),
      makeEvent({ statType: 'DREB', playerId: P1 }),
      makeEvent({ statType: 'DREB', playerId: null, isTeamRebound: true }),
    ];
    const box = aggregatePlayerEvents(events);
    expect(box.oreb).toBe(1);
    expect(box.dreb).toBe(1);
    expect(box.reb).toBe(2);
  });
});
