import { z } from 'zod';
import type {
  IGameRepository,
  IStatEventRepository,
  ILineupSnapshotRepository,
} from '../../domain/repositories/game.repository.js';
import type { IPossessionSequenceRepository } from '../../domain/repositories/possession.repository.js';
import type { IRosterRepository } from '../../infrastructure/database/repositories/roster.repository.js';
import type { LinkRole, PossessionState, StatEvent, StatType } from '../../domain/entities/game.entity.js';
import { isThreePointAreaCourt, resolvePossessionChange } from '../../domain/stat-calculators.js';

export const RecordStatEventInput = z.object({
  gameId: z.string().uuid(),
  period: z.number().int().min(1),
  clockTimeSeconds: z.number().int().optional(),
  playerId: z.string().uuid().nullish(),
  teamId: z.string().uuid().optional(),
  statType: z.enum([
    '2PM', '2PA', '3PM', '3PA', 'FTM', 'FTA',
    'OREB', 'DREB', 'AST', 'TO', 'STL', 'BLK', 'DFD',
    'PF', 'TF', 'FF', 'SUB_IN', 'SUB_OUT',
    'PERIOD_START', 'PERIOD_END', 'TIMEOUT',
  ]),
  value: z.number().int().default(1),
  xCourt: z.number().min(0).max(1).optional(),
  yCourt: z.number().min(0).max(1).optional(),
  seq: z.number().optional(),
  linkedActionId: z.string().uuid().optional(),
  linkRole: z.enum([
    'rebound_after_miss', 'assist_after_made', 'turnover_after_steal',
    'foul_drawn', 'ft_for_foul', 'to_after_offensive_foul', 'wave_sub_member',
  ]).optional(),
  isTeamRebound: z.boolean().default(false),
  isBenchFoul: z.boolean().default(false),
}).superRefine((data, ctx) => {
  // BR-STAT-4.3 — a team rebound is never credited to an individual player
  if (data.isTeamRebound && data.playerId != null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['playerId'],
      message: 'A team rebound (isTeamRebound = true) must not carry a playerId',
    });
  }
});

export type RecordStatEventInput = z.infer<typeof RecordStatEventInput>;
export type RecordStatEventRawInput = z.input<typeof RecordStatEventInput>;

const SHOT_TYPES: StatType[] = ['2PM', '2PA', '3PM', '3PA'];

// On-court player actions whose author is expected to be on the game roster.
// Excludes substitution/period/timeout bookkeeping events.
const PLAYER_STAT_TYPES = new Set<StatType>([
  '2PM', '2PA', '3PM', '3PA', 'FTM', 'FTA',
  'OREB', 'DREB', 'AST', 'TO', 'STL', 'BLK', 'DFD', 'PF', 'TF', 'FF',
]);

export async function recordStatEvent(
  rawInput: RecordStatEventRawInput,
  statEventRepo: IStatEventRepository,
  lineupRepo: ILineupSnapshotRepository,
  gameRepo?: IGameRepository,
  possessionRepo?: IPossessionSequenceRepository,
  rosterRepo?: IRosterRepository,
) {
  const input = RecordStatEventInput.parse(rawInput);
  const lineup = await lineupRepo.findLatestByGameAndTeam(
    input.gameId,
    input.teamId ?? '',
  );

  // U-04 eligibility — warn (never hard-fail) when a player records an action
  // while not on that side's game-day roster. Best-effort: a failure here must
  // never lose the event. The flag is consumed by the F-03 capture engine later.
  if (rosterRepo && gameRepo && input.playerId && input.teamId && PLAYER_STAT_TYPES.has(input.statType)) {
    try {
      const game = await gameRepo.findById(input.gameId);
      const rosterId =
        game?.homeTeamId === input.teamId ? game?.homeRosterId
        : game?.awayTeamId === input.teamId ? game?.awayRosterId
        : null;
      if (rosterId) {
        const rosterPlayerIds = await rosterRepo.getPlayerIds(rosterId);
        if (!rosterPlayerIds.includes(input.playerId)) {
          console.warn(
            `[recordStatEvent] eligibility: player ${input.playerId} is not on the ` +
              `game roster (${rosterId}) for team ${input.teamId} in game ${input.gameId}`,
          );
        }
      }
    } catch (err) {
      console.warn(
        `[recordStatEvent] eligibility check failed for game ${input.gameId}: ` +
          `${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // I-02: shot location vs statType validation — warn only, never hard-fail
  // (referee may correct the location after the fact)
  if (
    input.xCourt !== undefined &&
    input.yCourt !== undefined &&
    SHOT_TYPES.includes(input.statType as StatType)
  ) {
    // xCourt/yCourt arrive in the STORAGE frame (basket at (0.5, 0.113));
    // the adapter mirrors y into the spec frame before classifying.
    const locationIsThree = isThreePointAreaCourt(input.xCourt, input.yCourt);
    const recordedAsThree = input.statType.startsWith('3');
    if (locationIsThree !== recordedAsThree) {
      console.warn(
        `[recordStatEvent] statType ${input.statType} does not match court location ` +
          `(x=${input.xCourt}, y=${input.yCourt}): location is in the ` +
          `${locationIsThree ? '3pt' : '2pt'} area`,
      );
    }
  }

  // F-08: auto-link rule — a DFD recorded alongside a foul is the foul-drawn child
  let linkRole: LinkRole | null = input.linkRole ?? null;
  if (input.statType === 'DFD' && input.linkedActionId && !linkRole) {
    linkRole = 'foul_drawn';
  }

  const event = await statEventRepo.create({
    gameId: input.gameId,
    period: input.period,
    clockTimeSeconds: input.clockTimeSeconds ?? null,
    playerId: input.playerId ?? null,
    teamId: input.teamId ?? null,
    statType: input.statType as StatType,
    value: input.value,
    xCourt: input.xCourt ?? null,
    yCourt: input.yCourt ?? null,
    lineupSnapshotId: lineup?.id ?? null,
    seq: input.seq ?? null,
    linkedActionId: input.linkedActionId ?? null,
    linkRole,
    waveSubGroupId: null,
    isTeamRebound: input.isTeamRebound,
    isBenchFoul: input.isBenchFoul,
  });

  // F-01: possession tracking (only when the possession dependencies are wired).
  // Best-effort bookkeeping: a failure here (e.g. FK rejection when possession
  // belongs to an opponent_teams entry) must never lose the recorded event.
  try {
    await updatePossession(input, event, gameRepo, possessionRepo);
  } catch (err) {
    console.warn(
      `[recordStatEvent] possession update failed for game ${input.gameId}: ` +
        `${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return event;
}

async function updatePossession(
  input: RecordStatEventInput,
  event: StatEvent,
  gameRepo?: IGameRepository,
  possessionRepo?: IPossessionSequenceRepository,
): Promise<void> {
  if (gameRepo && possessionRepo) {
    const game = await gameRepo.findById(input.gameId);
    if (game) {
      const current: PossessionState = {
        teamId: game.currentPossessionTeamId,
        arrowTeamId: game.possessionArrowTeamId,
        isPending: false,
      };

      // U-02 — both sides are unified teams now; possession resolves for
      // external (scouted) away teams just like managed ones.
      const homeId = game.homeTeamId;
      const awayId = game.awayTeamId;
      const opponentTeamId =
        input.teamId === homeId ? awayId : input.teamId === awayId ? homeId : null;

      const next = resolvePossessionChange(event, current, {
        opponentTeamId,
        // FT sequence position is not tracked yet (F-06); treat each FT event
        // as the last of its sequence until the guided workflow provides it.
        lastFtIndex: 1,
        totalFtsInSequence: 1,
      });

      if (next.teamId !== current.teamId) {
        await possessionRepo.closeSequence(input.gameId, event.id);
        if (next.teamId) {
          await possessionRepo.create({
            gameId: input.gameId,
            period: input.period,
            clockTimeSeconds: input.clockTimeSeconds ?? 0,
            teamId: next.teamId,
            startActionId: event.id,
            endActionId: null,
            isOffensiveReboundContinuation: false,
          });
        }
        await gameRepo.update(input.gameId, {
          currentPossessionTeamId: next.teamId,
          possessionArrowTeamId: next.arrowTeamId,
        });
      }
    }
  }
}
