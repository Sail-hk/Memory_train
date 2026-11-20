import type {
  AdminUserSummary,
  EffectivenessReport,
  FamilyReportData,
  GameResult,
  ModuleId,
  TrainingOverview,
  TrainingSessionRecord,
  User,
} from './types';

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `请求失败 (${res.status})`);
  }
  return data as T;
}

export const api = {
  me: () => request<{ user: User }>('/api/auth/me'),

  login: (username: string, password: string) =>
    request<{ user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  register: (username: string, password: string, displayName: string) =>
    request<{ user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, displayName }),
    }),

  demoLogin: () =>
    request<{ user: User }>('/api/auth/demo', {
      method: 'POST',
    }),

  logout: () =>
    request<{ ok: boolean }>('/api/auth/logout', {
      method: 'POST',
    }),

  updatePreferences: (prefs: Partial<Pick<User, 'fontScale' | 'soundEnabled' | 'dailyGoalMinutes' | 'displayName'>>) =>
    request<{ user: User }>('/api/auth/preferences', {
      method: 'PATCH',
      body: JSON.stringify(prefs),
    }),

  getOverview: () => request<TrainingOverview>('/api/training/overview'),

  saveSession: (moduleId: ModuleId, difficultyLevel: number, result: GameResult) =>
    request<{ saved: boolean; nextLevel: number; levelChange: number; bestScore: number }>(
      '/api/training/sessions',
      {
        method: 'POST',
        body: JSON.stringify({
          moduleId,
          difficultyLevel,
          ...result,
        }),
      }
    ),

  getSessions: (limit = 20) =>
    request<{ sessions: TrainingSessionRecord[] }>(`/api/training/sessions?limit=${limit}`),

  getDueSpacedItems: () =>
    request<{ dueItems: Array<{ item_key: string; repetitions: number }> }>('/api/spaced/due'),

  submitSpacedReview: (results: Array<{ itemKey: string; correct: boolean }>) =>
    request<{ ok: boolean }>('/api/spaced/review', {
      method: 'POST',
      body: JSON.stringify({ results }),
    }),

  getEffectiveness: () => request<EffectivenessReport>('/api/training/effectiveness'),

  getShareToken: () => request<{ shareToken: string | null }>('/api/auth/share-token'),

  createShareToken: () => request<{ shareToken: string }>('/api/auth/share-token', { method: 'POST' }),

  revokeShareToken: () => request<{ shareToken: null }>('/api/auth/share-token', { method: 'DELETE' }),

  getSharedReport: (token: string) => request<FamilyReportData>(`/api/share/${encodeURIComponent(token)}`),

  adminGetUsers: () => request<{ users: AdminUserSummary[] }>('/api/admin/users'),

  adminGetUserReport: (userId: number) =>
    request<FamilyReportData>(`/api/admin/users/${userId}/report`),

  adminResetPassword: (userId: number, newPassword: string) =>
    request<{ ok: boolean }>(`/api/admin/users/${userId}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    }),

  adminDeleteUser: (userId: number) =>
    request<{ ok: boolean }>(`/api/admin/users/${userId}`, {
      method: 'DELETE',
    }),
};
