import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export type UserPreferences = {
  language?: 'pt' | 'en';
  units?: 'metric' | 'imperial';
  defaultGameFormat?: 'quarters' | 'halves';
  defaultPeriodDuration?: number;
  defaultFoulLimit?: number;
  playerSortOrder?: 'jersey' | 'lastName';
  showAdvancedStats?: boolean;
  theme?: 'system' | 'light' | 'dark';
  boxScoreColumns?: Record<string, boolean>;
  shotChartPrompt?: 'always' | 'timed' | 'never';
  opponentTrackingMode?: 'individual' | 'team' | 'off';
  simplifiedMode?: boolean;
  foulTroubleThreshold?: number;
  scoringRunAlertThreshold?: number;
  notificationsEnabled?: Record<string, boolean>;
  primaryTeamColor?: string;
  secondaryTeamColor?: string;
};

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<{ preferences: UserPreferences }>('/settings').then((r) => r.preferences),
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (preferences: Partial<UserPreferences>) =>
      api.put<{ preferences: UserPreferences }>('/settings', preferences).then((r) => r.preferences),
    onSuccess: (data) => {
      qc.setQueryData(['settings'], data);
    },
  });
}
