export type ModuleId = 'speed' | 'nback' | 'spaced' | 'spatial' | 'stroop';

export interface User {
  id: number;
  username: string;
  displayName: string;
  role: 'admin' | 'user';
  fontScale: 'normal' | 'large';
  soundEnabled: boolean;
  dailyGoalMinutes: number;
  createdAt: string;
}

export interface AdminUserSummary {
  id: number;
  username: string;
  displayName: string;
  role: 'admin' | 'user';
  createdAt: string;
  totalSessions: number;
  lastActiveAt: string | null;
}

export interface ModuleLevel {
  module_id: ModuleId;
  current_level: number;
  best_score: number;
  total_sessions: number;
  updated_at: string;
}

export interface DomainStat {
  module_id: ModuleId;
  count: number;
  avg_accuracy: number;
  avg_reaction_ms: number;
  max_score: number;
}

export interface RecentDay {
  day: string;
  sessions: number;
  total_sec: number;
  avg_accuracy: number;
}

export interface TrainingOverview {
  levels: ModuleLevel[];
  today: {
    minutes: number;
    seconds: number;
    sessionsCount: number;
    completedModules: ModuleId[];
  };
  streakDays: number;
  recentDays: RecentDay[];
  domainStats: DomainStat[];
}

export interface TrainingSessionRecord {
  id: number;
  module_id: ModuleId;
  difficulty_level: number;
  score: number;
  accuracy: number;
  avg_reaction_ms: number;
  duration_sec: number;
  trials_completed: number;
  created_at: string;
}

export interface GameResult {
  score: number;
  accuracy: number;
  avgReactionMs: number;
  durationSec: number;
  trialsCompleted: number;
  details?: Record<string, unknown>;
}

export interface ModuleEffectiveness {
  moduleId: ModuleId;
  sessionsCount: number;
  baselineAccuracy: number | null;
  recentAccuracy: number | null;
  baselineReactionMs: number | null;
  recentReactionMs: number | null;
  startLevel: number;
  currentLevel: number;
}

export interface EffectivenessTrendPoint {
  id: number;
  moduleId: ModuleId;
  accuracy: number;
  reactionMs: number;
  level: number;
  date: string;
}

export interface EffectivenessReport {
  byModule: ModuleEffectiveness[];
  trend: EffectivenessTrendPoint[];
}

export interface FamilyReportData {
  displayName: string;
  overview: TrainingOverview;
  effectiveness: EffectivenessReport;
  sessions: TrainingSessionRecord[];
}

