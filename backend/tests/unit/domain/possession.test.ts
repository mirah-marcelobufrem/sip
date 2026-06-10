import { resolvePossessionChange } from '../../../src/domain/stat-calculators.js';
import type { PossessionState, StatType } from '../../../src/domain/entities/game.entity.js';

const HOME_ID = '00000000-0000-0000-0000-000000000001';
const AWAY_ID = '00000000-0000-0000-0000-000000000002';
const ARROW_ID = HOME_ID;

function state(teamId: string | null, isPending = false): PossessionState {
  return { teamId, arrowTeamId: ARROW_ID, isPending };
}

function event(statType: StatType, teamId: string | null) {
  return { statType, teamId };
}

function ctx(
  opponentTeamId: string | null,
  lastFtIndex = 1,
  totalFtsInSequence = 1,
) {
  return { opponentTeamId, lastFtIndex, totalFtsInSequence };
}

describe('resolvePossessionChange', () => {
  it('2PM switches possession to the opponent', () => {
    const next = resolvePossessionChange(event('2PM', HOME_ID), state(HOME_ID), ctx(AWAY_ID));
    expect(next).toEqual(state(AWAY_ID));
  });

  it('3PM switches possession to the opponent', () => {
    const next = resolvePossessionChange(event('3PM', HOME_ID), state(HOME_ID), ctx(AWAY_ID));
    expect(next).toEqual(state(AWAY_ID));
  });

  it('DREB switches possession to the rebounding team', () => {
    const next = resolvePossessionChange(event('DREB', AWAY_ID), state(HOME_ID), ctx(HOME_ID));
    expect(next).toEqual(state(AWAY_ID));
  });

  it('OREB keeps the same possession (continuation)', () => {
    const next = resolvePossessionChange(event('OREB', HOME_ID), state(HOME_ID), ctx(AWAY_ID));
    expect(next).toEqual(state(HOME_ID));
  });

  it('TO switches possession to the non-offending team', () => {
    const next = resolvePossessionChange(event('TO', AWAY_ID), state(AWAY_ID), ctx(HOME_ID));
    expect(next).toEqual(state(HOME_ID));
  });

  it('STL switches possession to the stealing team', () => {
    const next = resolvePossessionChange(event('STL', HOME_ID), state(AWAY_ID), ctx(AWAY_ID));
    expect(next).toEqual(state(HOME_ID));
  });

  it('FTM on the last FT switches possession to the opponent', () => {
    const next = resolvePossessionChange(
      event('FTM', HOME_ID),
      state(HOME_ID),
      ctx(AWAY_ID, 2, 2),
    );
    expect(next).toEqual(state(AWAY_ID));
  });

  it('FTM on a non-last FT keeps possession unchanged', () => {
    const next = resolvePossessionChange(
      event('FTM', HOME_ID),
      state(HOME_ID),
      ctx(AWAY_ID, 1, 2),
    );
    expect(next).toEqual(state(HOME_ID));
  });

  it('FTA missed on the last FT marks possession as pending', () => {
    const next = resolvePossessionChange(
      event('FTA', HOME_ID),
      state(HOME_ID),
      ctx(AWAY_ID, 2, 2),
    );
    expect(next).toEqual(state(HOME_ID, true));
  });

  it('FTA missed on a non-last FT keeps possession unchanged', () => {
    const next = resolvePossessionChange(
      event('FTA', HOME_ID),
      state(HOME_ID),
      ctx(AWAY_ID, 1, 2),
    );
    expect(next).toEqual(state(HOME_ID));
  });

  it('PERIOD_START sets possession from the initial selection', () => {
    const next = resolvePossessionChange(event('PERIOD_START', AWAY_ID), state(null), ctx(HOME_ID));
    expect(next).toEqual(state(AWAY_ID));
  });

  it.each<StatType>(['SUB_IN', 'SUB_OUT', 'PERIOD_END', 'TIMEOUT'])(
    '%s does not change possession',
    (statType) => {
      const current = state(HOME_ID);
      const next = resolvePossessionChange(event(statType, AWAY_ID), current, ctx(HOME_ID));
      expect(next).toEqual(current);
    },
  );

  it.each<StatType>(['2PA', '3PA', 'AST', 'BLK', 'DFD', 'PF', 'TF', 'FF'])(
    '%s does not change possession',
    (statType) => {
      const current = state(HOME_ID);
      const next = resolvePossessionChange(event(statType, HOME_ID), current, ctx(AWAY_ID));
      expect(next).toEqual(current);
    },
  );

  it('preserves the alternating-possession arrow on every trigger', () => {
    const next = resolvePossessionChange(event('2PM', HOME_ID), state(HOME_ID), ctx(AWAY_ID));
    expect(next.arrowTeamId).toBe(ARROW_ID);
  });

  it('acceptance: 3PM Home → DREB Away → TO Away resolves Home → Away → Away → Home', () => {
    let possession = state(HOME_ID);

    possession = resolvePossessionChange(event('3PM', HOME_ID), possession, ctx(AWAY_ID));
    expect(possession.teamId).toBe(AWAY_ID);

    possession = resolvePossessionChange(event('DREB', AWAY_ID), possession, ctx(HOME_ID));
    expect(possession.teamId).toBe(AWAY_ID); // no effective change

    possession = resolvePossessionChange(event('TO', AWAY_ID), possession, ctx(HOME_ID));
    expect(possession.teamId).toBe(HOME_ID);
  });

  it('acceptance: last FTA missed by Away → OREB Away keeps possession with Away', () => {
    let possession = state(AWAY_ID);

    possession = resolvePossessionChange(
      event('FTA', AWAY_ID),
      possession,
      ctx(HOME_ID, 2, 2),
    );
    expect(possession.teamId).toBe(AWAY_ID);
    expect(possession.isPending).toBe(true);

    possession = resolvePossessionChange(event('OREB', AWAY_ID), possession, ctx(HOME_ID));
    expect(possession.teamId).toBe(AWAY_ID);
    expect(possession.isPending).toBe(false);
  });
});
