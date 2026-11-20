import { useEffect, useRef, useState } from 'react';
import type { GameResult } from '../../types';
import { playTone } from '../../utils/sound';

interface Props {
  level: number;
  soundEnabled: boolean;
  onComplete: (result: GameResult) => void;
}

const SYMBOLS = [
  { icon: '🍎', label: '红苹果' },
  { icon: '🔑', label: '钥匙' },
  { icon: '⏰', label: '闹钟' },
  { icon: '☂️', label: '雨伞' },
  { icon: '🚲', label: '自行车' },
  { icon: '📖', label: '书本' },
  { icon: '🍵', label: '茶杯' },
  { icon: '👓', label: '眼镜' },
  { icon: '🏮', label: '灯笼' },
  { icon: '🌻', label: '向日葵' },
  { icon: '🍐', label: '梨子' },
  { icon: '🎧', label: '耳机' },
];

const TOTAL_TRIALS = 12;

export function SpeedGame({ level, soundEnabled, onComplete }: Props) {
  const [trialIndex, setTrialIndex] = useState(0);
  const [phase, setPhase] = useState<'cue' | 'search' | 'feedback'>('cue');
  const [target, setTarget] = useState(SYMBOLS[0]);
  const [gridItems, setGridItems] = useState<typeof SYMBOLS>([]);
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);

  const statsRef = useRef({
    correct: 0,
    reactionSum: 0,
    reactionCount: 0,
    startTime: Date.now(),
    trialStart: 0,
  });
  const timerRef = useRef<number | null>(null);

  // Adaptive grid size & cue duration based on level (1..10)
  const gridCount = level <= 2 ? 6 : level <= 5 ? 9 : level <= 8 ? 12 : 16;
  const cueMs = Math.max(700, 1600 - (level - 1) * 90);

  const setupTrial = (idx: number) => {
    const shuffled = [...SYMBOLS].sort(() => Math.random() - 0.5);
    const chosenTarget = shuffled[0];
    const pool = [chosenTarget];

    while (pool.length < gridCount) {
      const candidate = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
      if (candidate.icon !== chosenTarget.icon) {
        pool.push(candidate);
      }
    }
    pool.sort(() => Math.random() - 0.5);

    setTarget(chosenTarget);
    setGridItems(pool);
    setPhase('cue');
    setLastCorrect(null);

    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setPhase('search');
      statsRef.current.trialStart = performance.now();
    }, cueMs);
    setTrialIndex(idx);
  };

  useEffect(() => {
    statsRef.current.startTime = Date.now();
    setupTrial(0);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePick = (item: (typeof SYMBOLS)[number]) => {
    if (phase !== 'search') return;
    const rt = Math.round(performance.now() - statsRef.current.trialStart);
    const isRight = item.icon === target.icon;

    if (isRight) {
      statsRef.current.correct += 1;
      statsRef.current.reactionSum += rt;
      statsRef.current.reactionCount += 1;
      playTone('correct', soundEnabled);
    } else {
      playTone('wrong', soundEnabled);
    }

    setLastCorrect(isRight);
    setPhase('feedback');

    timerRef.current = window.setTimeout(() => {
      const next = trialIndex + 1;
      if (next >= TOTAL_TRIALS) {
        const durationSec = Math.max(1, Math.round((Date.now() - statsRef.current.startTime) / 1000));
        const accuracy = Math.round((statsRef.current.correct / TOTAL_TRIALS) * 100);
        const avgReactionMs =
          statsRef.current.reactionCount > 0
            ? Math.round(statsRef.current.reactionSum / statsRef.current.reactionCount)
            : 0;
        const speedBonus = avgReactionMs > 0 ? Math.max(0, Math.round((2500 - avgReactionMs) / 25)) : 0;
        const score = Math.round(accuracy * 8 + speedBonus + level * 20);

        playTone('complete', soundEnabled);
        onComplete({
          score,
          accuracy,
          avgReactionMs,
          durationSec,
          trialsCompleted: TOTAL_TRIALS,
        });
      } else {
        setupTrial(next);
      }
    }, 650);
  };

  const colsClass =
    gridCount <= 6 ? 'grid-cols-3' : gridCount <= 9 ? 'grid-cols-3' : 'grid-cols-4';

  return (
    <div className="flex flex-col items-center">
      <div className="mb-4 flex w-full items-center justify-between text-sm text-slate-600">
        <span>第 {trialIndex + 1} / {TOTAL_TRIALS} 题</span>
        <span>难度等级 Lv.{level}</span>
      </div>

      {phase === 'cue' && (
        <div className="flex min-h-[300px] w-full flex-col items-center justify-center rounded-2xl border-2 border-teal-200 bg-teal-50/70 p-8 text-center">
          <p className="mb-3 text-lg font-medium text-teal-900">请记住下面这个目标物品：</p>
          <div className="mb-2 text-7xl">{target.icon}</div>
          <p className="text-xl font-bold text-teal-800">{target.label}</p>
        </div>
      )}

      {phase !== 'cue' && (
        <div className="w-full">
          <div className="mb-4 flex items-center justify-center gap-3 rounded-xl bg-slate-100 px-4 py-2.5">
            <span className="text-base font-medium text-slate-700">请快速找出：</span>
            <span className="text-2xl font-bold text-teal-800">{target.label}</span>
          </div>

          <div className={`grid ${colsClass} gap-3`}>
            {gridItems.map((item, i) => (
              <button
                key={`${item.icon}-${i}`}
                onClick={() => handlePick(item)}
                disabled={phase !== 'search'}
                className="flex aspect-square flex-col items-center justify-center rounded-2xl border-2 border-slate-200 bg-white text-5xl shadow-sm transition hover:border-teal-400 hover:bg-teal-50 active:scale-95 disabled:opacity-75"
              >
                <span>{item.icon}</span>
              </button>
            ))}
          </div>

          {phase === 'feedback' && (
            <div
              className={`mt-4 rounded-xl py-2.5 text-center text-lg font-semibold ${
                lastCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}
            >
              {lastCorrect ? '找对了！反应很敏锐' : `差一点，刚才的目标是 ${target.icon} ${target.label}`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
