import { useState } from 'react';
import { ArrowLeft, Award, BookOpen, CheckCircle2, Play, RotateCcw } from 'lucide-react';
import { api } from '../api';
import { MODULES } from '../data/modules';
import type { GameResult, ModuleId } from '../types';
import { SpeedGame } from './games/SpeedGame';
import { NBackGame } from './games/NBackGame';
import { SpacedGame } from './games/SpacedGame';
import { SpatialGame } from './games/SpatialGame';
import { StroopGame } from './games/StroopGame';

interface Props {
  moduleId: ModuleId;
  initialLevel: number;
  soundEnabled: boolean;
  onExit: (didComplete: boolean) => void;
}

export function TrainingShell({ moduleId, initialLevel, soundEnabled, onExit }: Props) {
  const meta = MODULES[moduleId];
  const [stage, setStage] = useState<'intro' | 'playing' | 'summary'>('intro');
  const [level, setLevel] = useState(initialLevel);
  const [result, setResult] = useState<GameResult | null>(null);
  const [saveInfo, setSaveInfo] = useState<{
    nextLevel: number;
    levelChange: number;
    bestScore: number;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const handleComplete = async (res: GameResult) => {
    setResult(res);
    setStage('summary');
    setSaving(true);
    try {
      const saved = await api.saveSession(moduleId, level, res);
      setSaveInfo(saved);
      setLevel(saved.nextLevel);
    } catch {
      // Keep summary visible even if network blips
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <button
        onClick={() => onExit(stage === 'summary')}
        className="mb-4 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-base font-medium text-slate-600 hover:bg-stone-200/60 hover:text-slate-900"
      >
        <ArrowLeft className="h-5 w-5" />
        返回首页
      </button>

      <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        {stage === 'intro' && (
          <div>
            <span
              className={`inline-block rounded-full px-3.5 py-1 text-sm font-semibold ${meta.colorBg} ${meta.colorText}`}
            >
              {meta.domain} · 当前 Lv.{level}
            </span>
            <h2 className="mt-3 text-2xl font-bold text-slate-900">{meta.title}</h2>
            <p className="mt-1 text-base text-slate-600">{meta.subtitle}（{meta.durationHint}）</p>

            <div className="mt-6 rounded-2xl border border-stone-200 bg-stone-50 p-5">
              <h3 className="mb-2 text-lg font-bold text-slate-900">怎么玩？</h3>
              <p className="text-base leading-relaxed text-slate-700">{meta.howToPlay}</p>
            </div>

            <div className="mt-4 rounded-2xl border border-teal-100 bg-teal-50/50 p-5">
              <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-teal-800">
                <BookOpen className="h-4 w-4" />
                医学论文依据：{meta.paperCitation}
              </div>
              <p className="text-sm leading-relaxed text-slate-700">{meta.scienceSummary}</p>
            </div>

            <button
              onClick={() => setStage('playing')}
              className="mt-7 flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-700 py-4 text-xl font-bold text-white shadow-sm transition hover:bg-teal-800 active:scale-98"
            >
              <Play className="h-6 w-6 fill-current" />
              开始训练
            </button>
          </div>
        )}

        {stage === 'playing' && (
          <div>
            {moduleId === 'speed' && (
              <SpeedGame level={level} soundEnabled={soundEnabled} onComplete={handleComplete} />
            )}
            {moduleId === 'nback' && (
              <NBackGame level={level} soundEnabled={soundEnabled} onComplete={handleComplete} />
            )}
            {moduleId === 'spaced' && (
              <SpacedGame level={level} soundEnabled={soundEnabled} onComplete={handleComplete} />
            )}
            {moduleId === 'spatial' && (
              <SpatialGame level={level} soundEnabled={soundEnabled} onComplete={handleComplete} />
            )}
            {moduleId === 'stroop' && (
              <StroopGame level={level} soundEnabled={soundEnabled} onComplete={handleComplete} />
            )}
          </div>
        )}

        {stage === 'summary' && result && (
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">本次训练完成！</h2>
            <p className="mt-1 text-base text-slate-600">{meta.title}</p>

            <div className="mt-6 grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-stone-50 p-4">
                <div className="text-sm text-slate-500">准确率</div>
                <div className="mt-1 text-2xl font-bold text-teal-800">{result.accuracy}%</div>
              </div>
              <div className="rounded-2xl bg-stone-50 p-4">
                <div className="text-sm text-slate-500">平均反应</div>
                <div className="mt-1 text-2xl font-bold text-slate-800">
                  {result.avgReactionMs > 0 ? `${(result.avgReactionMs / 1000).toFixed(2)}秒` : '-'}
                </div>
              </div>
              <div className="rounded-2xl bg-stone-50 p-4">
                <div className="text-sm text-slate-500">综合得分</div>
                <div className="mt-1 text-2xl font-bold text-amber-700">{result.score}</div>
              </div>
            </div>

            {saving ? (
              <p className="mt-4 text-sm text-slate-500">正在保存训练记录…</p>
            ) : saveInfo ? (
              <div className="mt-5 flex items-center justify-center gap-2 rounded-2xl bg-teal-50 px-4 py-3 text-base font-semibold text-teal-900">
                <Award className="h-5 w-5 text-teal-700" />
                {saveInfo.levelChange > 0
                  ? `表现优秀！难度自动升级至 Lv.${saveInfo.nextLevel}`
                  : saveInfo.levelChange < 0
                  ? `已为您适当调整至 Lv.${saveInfo.nextLevel}，循序渐进更有效`
                  : `当前保持 Lv.${saveInfo.nextLevel}，历史最高分 ${saveInfo.bestScore}`}
              </div>
            ) : null}

            <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                onClick={() => setStage('playing')}
                className="flex items-center justify-center gap-2 rounded-2xl border-2 border-stone-300 bg-white py-3.5 text-lg font-bold text-slate-800 hover:bg-stone-50"
              >
                <RotateCcw className="h-5 w-5" />
                再练一次
              </button>
              <button
                onClick={() => onExit(true)}
                className="rounded-2xl bg-teal-700 py-3.5 text-lg font-bold text-white hover:bg-teal-800"
              >
                完成并返回
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
