import { useEffect, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  Check,
  Copy,
  Flame,
  Link2,
  Share2,
  TrendingUp,
} from 'lucide-react';
import { api } from '../api';
import { MODULE_LIST, MODULES } from '../data/modules';
import type {
  EffectivenessReport,
  TrainingOverview,
  TrainingSessionRecord,
} from '../types';

interface Props {
  overview: TrainingOverview;
  readOnly?: boolean;
  initialEffectiveness?: EffectivenessReport;
  initialSessions?: TrainingSessionRecord[];
}

export function ProgressView({
  overview,
  readOnly = false,
  initialEffectiveness,
  initialSessions,
}: Props) {
  const [sessions, setSessions] = useState<TrainingSessionRecord[]>(initialSessions || []);
  const [effectiveness, setEffectiveness] = useState<EffectivenessReport | null>(
    initialEffectiveness || null
  );
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (readOnly) return;
    api.getSessions(15).then((res) => setSessions(res.sessions)).catch(() => {});
    api.getEffectiveness().then((res) => setEffectiveness(res)).catch(() => {});
    api.getShareToken().then((res) => setShareToken(res.shareToken)).catch(() => {});
  }, [readOnly]);

  const handleCreateShare = async () => {
    const res = await api.createShareToken();
    setShareToken(res.shareToken);
  };

  const handleCopyShare = async () => {
    if (!shareToken) return;
    const url = `${window.location.origin}/share/${shareToken}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('请复制下方家属查看链接：', url);
    }
  };

  const maxMinutes = Math.max(
    10,
    ...overview.recentDays.map((d) => Math.ceil((d.total_sec || 0) / 60))
  );

  const shareUrl = shareToken ? `${window.location.origin}/share/${shareToken}` : '';

  return (
    <div className="space-y-6">
      {/* Family Share Card (only for logged-in user) */}
      {!readOnly && (
        <div className="rounded-3xl border border-teal-200 bg-teal-50/70 p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2 font-bold text-teal-900">
                <Share2 className="h-5 w-5" />
                家属远程查看训练效果
              </div>
              <p className="mt-1 text-sm text-slate-700">
                生成专属只读链接发给子女或家人，无需登录账号即可在手机上随时查看训练记录与进步情况。
              </p>
            </div>
            {!shareToken ? (
              <button
                onClick={handleCreateShare}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-teal-700 px-5 py-3 text-base font-bold text-white shadow-sm hover:bg-teal-800"
              >
                <Link2 className="h-5 w-5" />
                生成家属查看链接
              </button>
            ) : (
              <button
                onClick={handleCopyShare}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-teal-700 px-5 py-3 text-base font-bold text-white shadow-sm hover:bg-teal-800"
              >
                {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                {copied ? '已复制链接' : '复制家属查看链接'}
              </button>
            )}
          </div>
          {shareToken && (
            <div className="mt-3 rounded-xl bg-white/90 px-3 py-2 text-xs break-all text-slate-600">
              专属链接：{shareUrl}
            </div>
          )}
        </div>
      )}

      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Flame className="h-4 w-4 text-amber-600" />
            连续坚持训练
          </div>
          <div className="mt-2 text-3xl font-bold text-slate-900">{overview.streakDays} 天</div>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Calendar className="h-4 w-4 text-teal-600" />
            今日累计时长
          </div>
          <div className="mt-2 text-3xl font-bold text-slate-900">{overview.today.minutes} 分钟</div>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <TrendingUp className="h-4 w-4 text-indigo-600" />
            累计训练次数
          </div>
          <div className="mt-2 text-3xl font-bold text-slate-900">
            {overview.levels.reduce((s, l) => s + l.total_sessions, 0)} 次
          </div>
        </div>
      </div>

      {/* Baseline vs Recent Effectiveness Comparison */}
      {effectiveness && (
        <div className="rounded-3xl border border-stone-200 bg-white p-6">
          <h3 className="text-lg font-bold text-slate-900">训练效果评估（初期 vs 最近表现对比）</h3>
          <p className="mt-1 text-sm text-slate-500">
            对比每个模块最初几轮与最近几轮的准确率、反应速度及自适应难度等级变化
          </p>

          <div className="mt-4 space-y-3">
            {effectiveness.byModule.map((m) => {
              const mod = MODULES[m.moduleId];
              const accDiff =
                m.baselineAccuracy !== null && m.recentAccuracy !== null
                  ? m.recentAccuracy - m.baselineAccuracy
                  : null;
              const rtDiff =
                m.baselineReactionMs !== null && m.recentReactionMs !== null
                  ? m.recentReactionMs - m.baselineReactionMs
                  : null;

              return (
                <div
                  key={m.moduleId}
                  className="rounded-2xl border border-stone-100 bg-stone-50/70 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-slate-900">{mod.title}</span>
                    <span className="text-xs text-slate-500">共训练 {m.sessionsCount} 次</span>
                  </div>

                  {m.sessionsCount === 0 ? (
                    <p className="mt-2 text-sm text-slate-500">尚未开始此项训练</p>
                  ) : m.sessionsCount === 1 ? (
                    <p className="mt-2 text-sm text-slate-600">
                      已完成 1 次基线测试（准确率 {m.recentAccuracy}%，难度 Lv.{m.currentLevel}），再练几次即可看到前后对比趋势。
                    </p>
                  ) : (
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="rounded-xl bg-white p-3">
                        <div className="text-xs text-slate-500">准确率变化</div>
                        <div className="mt-1 flex items-center gap-1.5 text-base font-bold text-slate-900">
                          <span>
                            {m.baselineAccuracy}% → {m.recentAccuracy}%
                          </span>
                          {accDiff !== null && accDiff !== 0 && (
                            <span
                              className={`inline-flex items-center text-xs ${
                                accDiff > 0 ? 'text-emerald-700' : 'text-amber-700'
                              }`}
                            >
                              {accDiff > 0 ? (
                                <ArrowUpRight className="h-3.5 w-3.5" />
                              ) : (
                                <ArrowDownRight className="h-3.5 w-3.5" />
                              )}
                              {accDiff > 0 ? `+${accDiff}%` : `${accDiff}%`}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="rounded-xl bg-white p-3">
                        <div className="text-xs text-slate-500">平均反应速度</div>
                        <div className="mt-1 flex items-center gap-1.5 text-base font-bold text-slate-900">
                          {m.recentReactionMs ? (
                            <>
                              <span>{(m.recentReactionMs / 1000).toFixed(2)} 秒</span>
                              {rtDiff !== null && rtDiff !== 0 && (
                                <span
                                  className={`text-xs ${
                                    rtDiff < 0 ? 'text-emerald-700' : 'text-slate-500'
                                  }`}
                                >
                                  {rtDiff < 0
                                    ? `快了 ${Math.abs(rtDiff / 1000).toFixed(2)}s`
                                    : `慢了 ${(rtDiff / 1000).toFixed(2)}s`}
                                </span>
                              )}
                            </>
                          ) : (
                            <span>-</span>
                          )}
                        </div>
                      </div>

                      <div className="rounded-xl bg-white p-3">
                        <div className="text-xs text-slate-500">自适应难度</div>
                        <div className="mt-1 text-base font-bold text-teal-800">
                          Lv.{m.startLevel} → Lv.{m.currentLevel}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Accuracy Trend Line Chart (SVG) */}
      {effectiveness && effectiveness.trend.length >= 2 && (
        <div className="rounded-3xl border border-stone-200 bg-white p-6">
          <h3 className="mb-1 text-lg font-bold text-slate-900">近期训练准确率曲线（近 {effectiveness.trend.length} 次）</h3>
          <p className="mb-4 text-sm text-slate-500">
            注意：当准确率连续高于 85% 时系统会自动升级难度，因此准确率在 75%~95% 之间稳步波动属于理想状态。
          </p>
          <div className="w-full overflow-x-auto">
            <svg viewBox="0 0 600 180" className="h-44 w-full min-w-[360px]">
              {[0, 50, 100].map((v) => {
                const y = 150 - (v / 100) * 120;
                return (
                  <g key={v}>
                    <line x1="36" y1={y} x2="584" y2={y} stroke="#E7E5E4" strokeDasharray="4 4" />
                    <text x="4" y={y + 4} fontSize="11" fill="#78716C">
                      {v}%
                    </text>
                  </g>
                );
              })}
              <polyline
                fill="none"
                stroke="#0F766E"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={effectiveness.trend
                  .map((pt, i) => {
                    const x =
                      36 +
                      (i / Math.max(1, effectiveness.trend.length - 1)) * (584 - 36);
                    const y = 150 - (pt.accuracy / 100) * 120;
                    return `${x},${y}`;
                  })
                  .join(' ')}
              />
              {effectiveness.trend.map((pt, i) => {
                const x =
                  36 +
                  (i / Math.max(1, effectiveness.trend.length - 1)) * (584 - 36);
                const y = 150 - (pt.accuracy / 100) * 120;
                return (
                  <g key={pt.id}>
                    <circle cx={x} cy={y} r="4.5" fill="#0F766E" stroke="#fff" strokeWidth="1.5" />
                    <title>{`${MODULES[pt.moduleId]?.title || pt.moduleId} (${pt.date}): 准确率 ${pt.accuracy}%, Lv.${pt.level}`}</title>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      )}

      {/* 14-day bar chart */}
      <div className="rounded-3xl border border-stone-200 bg-white p-6">
        <h3 className="mb-4 text-lg font-bold text-slate-900">近 14 天训练时长趋势</h3>
        {overview.recentDays.length === 0 ? (
          <p className="py-8 text-center text-base text-slate-500">
            暂无训练记录，完成一次训练后这里会显示每日进步曲线。
          </p>
        ) : (
          <div className="flex h-44 items-end gap-2 pt-4">
            {overview.recentDays.map((d) => {
              const mins = Math.max(1, Math.round((d.total_sec || 0) / 60));
              const pct = Math.min(100, Math.round((mins / maxMinutes) * 100));
              return (
                <div key={d.day} className="flex flex-1 flex-col items-center">
                  <span className="mb-1 text-xs font-medium text-slate-600">{mins}分</span>
                  <div className="flex h-28 w-full items-end justify-center">
                    <div
                      className="w-full max-w-[28px] rounded-t-lg bg-teal-600 transition-all"
                      style={{ height: `${Math.max(12, pct)}%` }}
                      title={`${d.day}: ${mins} 分钟，平均正确率 ${d.avg_accuracy}%`}
                    />
                  </div>
                  <span className="mt-2 text-xs text-slate-500">{d.day.slice(5)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5 Domains breakdown */}
      <div className="rounded-3xl border border-stone-200 bg-white p-6">
        <h3 className="mb-4 text-lg font-bold text-slate-900">五大认知维度能力概况</h3>
        <div className="space-y-3">
          {MODULE_LIST.map((mod) => {
            const lvl = overview.levels.find((l) => l.module_id === mod.id);
            const stat = overview.domainStats.find((s) => s.module_id === mod.id);
            return (
              <div
                key={mod.id}
                className="flex flex-col justify-between gap-2 rounded-2xl border border-stone-100 bg-stone-50/70 p-4 sm:flex-row sm:items-center"
              >
                <div>
                  <div className="font-bold text-slate-900">{mod.title}</div>
                  <div className="text-sm text-slate-600">
                    已练 {lvl?.total_sessions || 0} 次 · 最高分 {lvl?.best_score || 0}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-xs text-slate-500">平均准确率</div>
                    <div className="font-bold text-teal-800">
                      {stat ? `${stat.avg_accuracy}%` : '-'}
                    </div>
                  </div>
                  <span
                    className={`rounded-xl px-3 py-1.5 text-sm font-bold ${mod.colorBg} ${mod.colorText}`}
                  >
                    Lv.{lvl?.current_level || 1}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent sessions */}
      <div className="rounded-3xl border border-stone-200 bg-white p-6">
        <h3 className="mb-4 text-lg font-bold text-slate-900">最近训练明细</h3>
        {sessions.length === 0 ? (
          <p className="py-4 text-center text-slate-500">暂无记录</p>
        ) : (
          <div className="divide-y divide-stone-100">
            {sessions.map((s) => {
              const mod = MODULES[s.module_id];
              return (
                <div key={s.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="font-semibold text-slate-800">{mod?.title || s.module_id}</div>
                    <div className="text-xs text-slate-500">
                      {s.created_at} · 难度 Lv.{s.difficulty_level}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-teal-800">准确率 {s.accuracy}%</div>
                    <div className="text-xs text-slate-500">得分 {s.score}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
