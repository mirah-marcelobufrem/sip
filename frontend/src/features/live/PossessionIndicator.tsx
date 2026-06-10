// Compact possession indicator for the live scoreboard.
// Defensive against the backend contract landing later: both team-id fields
// may be undefined/null, in which case nothing is rendered.

interface PossessionIndicatorProps {
  currentPossessionTeamId?: string | null;
  possessionArrowTeamId?: string | null;
  homeTeamId: string | null;
  awayTeamId: string | null;
}

type Side = 'home' | 'away' | null;

export function PossessionIndicator({
  currentPossessionTeamId,
  possessionArrowTeamId,
  homeTeamId,
  awayTeamId,
}: PossessionIndicatorProps) {
  const sideOf = (teamId?: string | null): Side =>
    teamId == null ? null : teamId === homeTeamId ? 'home' : teamId === awayTeamId ? 'away' : null;

  const possession = sideOf(currentPossessionTeamId);
  const arrow = sideOf(possessionArrowTeamId);

  if (!possession && !arrow) return null;

  return (
    <div
      data-testid="possession-arrow"
      className="flex items-center justify-center gap-3 bg-gray-800/70 border-b border-gray-700 py-1 shrink-0"
    >
      {possession && (
        <span className="flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded">
          {possession === 'home' ? (
            <><span aria-hidden="true">{'◀'}</span> HOME BALL</>
          ) : (
            <>AWAY BALL <span aria-hidden="true">{'▶'}</span></>
          )}
        </span>
      )}
      {arrow && (
        <span
          className="text-[10px] font-medium text-gray-500 uppercase tracking-wide"
          title="Alternating possession arrow"
        >
          {arrow === 'home' ? (
            <><span aria-hidden="true">{'◁'}</span> HOME arrow</>
          ) : (
            <>AWAY arrow <span aria-hidden="true">{'▷'}</span></>
          )}
        </span>
      )}
    </div>
  );
}
