import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PossessionIndicator } from '../../../src/features/live/PossessionIndicator';

const HOME_TEAM_ID = '00000000-0000-0000-0000-000000000001';
const AWAY_TEAM_ID = '00000000-0000-0000-0000-000000000002';

describe('PossessionIndicator', () => {
  it('shows the home possession indicator when home has the ball', () => {
    render(
      <PossessionIndicator
        currentPossessionTeamId={HOME_TEAM_ID}
        possessionArrowTeamId={null}
        homeTeamId={HOME_TEAM_ID}
        awayTeamId={AWAY_TEAM_ID}
      />,
    );
    expect(screen.getByTestId('possession-arrow')).toHaveTextContent('HOME BALL');
  });

  it('shows the away possession indicator when away has the ball', () => {
    render(
      <PossessionIndicator
        currentPossessionTeamId={AWAY_TEAM_ID}
        possessionArrowTeamId={null}
        homeTeamId={HOME_TEAM_ID}
        awayTeamId={AWAY_TEAM_ID}
      />,
    );
    expect(screen.getByTestId('possession-arrow')).toHaveTextContent('AWAY BALL');
  });

  it('shows the alternating-possession arrow as a secondary marker', () => {
    render(
      <PossessionIndicator
        currentPossessionTeamId={HOME_TEAM_ID}
        possessionArrowTeamId={AWAY_TEAM_ID}
        homeTeamId={HOME_TEAM_ID}
        awayTeamId={AWAY_TEAM_ID}
      />,
    );
    const indicator = screen.getByTestId('possession-arrow');
    expect(indicator).toHaveTextContent('HOME BALL');
    expect(indicator).toHaveTextContent('AWAY arrow');
  });

  it('renders nothing when both fields are null', () => {
    render(
      <PossessionIndicator
        currentPossessionTeamId={null}
        possessionArrowTeamId={null}
        homeTeamId={HOME_TEAM_ID}
        awayTeamId={AWAY_TEAM_ID}
      />,
    );
    expect(screen.queryByTestId('possession-arrow')).toBeNull();
  });

  it('renders nothing when the fields are undefined (backend not yet deployed)', () => {
    render(
      <PossessionIndicator homeTeamId={HOME_TEAM_ID} awayTeamId={AWAY_TEAM_ID} />,
    );
    expect(screen.queryByTestId('possession-arrow')).toBeNull();
  });
});
