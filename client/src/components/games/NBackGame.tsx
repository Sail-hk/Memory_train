import { useEffect, useRef, useState } from 'react';
import type { GameResult } from '../../types';
import { playTone } from '../../utils/sound';

interface Props {
  level: number;
  soundEnabled: boolean;
  onComplete: (result: GameResult) => void;
}

const ITEMS = [
  { icon: '🍎', name: '苹果' },
  { icon: '🚗', name: '汽车' },
  { icon: '🏠', name: '房子' },
  { icon: '⏰', name: '闹钟' },
  { icon: '🔑', name: '钥匙' },
  { icon: '☂️', name: '雨伞' },
];

export function NBackGame({ level, soundEnabled, onComplete }: Props) {
  // Level 1-4: 1-Back; Level 5-8: 2-Back; Level 9-10: 3-Back
  const nValue = level <= 4 ? 1 : level <= 8 ? 2 : 3;
  const totalStimuli = 14 + nValue;

  const [sequence, setSequence] = useState<typeof ITEMS>([]);
  const [step, setStep] = useState(0);
  const [answered, setAnswered] = useState<boolean | null>(null);
  const [feedback, setFeedback] = useState<string>('');

  const statsRef = useRef({
    correct: 0,
    totalTestable: 0,
    reactionSum: 0,
    reactionCount: 0,
    startTime: Date.now(),
    stepStart: performance.now(),
  });
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const seq: typeof ITEMS = [];
    for (let i = 0; i < totalStimuli; i++) {
      if (i >= nValue && Math.random() < 0.38) {
        seq.push(seq[i - nValue]);
      } else {
        const pool =
          i >= nValue ? ITEMS.filter((x) => x.icon !== seq[i - nValue].icon) : ITEMS;
        seq.push(pool[Math.floor(Math.random() * pool.length)]);
      }
    }
    setSequence(seq);
    statsRef.current.startTime = Date.now();
    statsRef.current.stepStart = performance.now();

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [nValue, totalStimuli]);

  const advance = (currentStep: number) => {
    const next = currentStep + 1;
    if (next >= sequence.length) {
      const durationSec = Math.max(1, Math.round((Date.now() - statsRef.current.startTime) / 1000));
      const testable = Math.max(1, statsRef.current.totalTestable);
      const accuracy = Math.round((statsRef.current.correct / testable) * 100);
      const avgReactionMs =
        statsRef.current.reactionCount > 0
          ? Math.round(statsRef.current.reactionSum / statsRef.current.reactionCount)
          : 0;
      const score = Math.round(accuracy * 8 + nValue * 120 + level * 15);
      playTone('complete', soundEnabled);
      onComplete({
        score,
        accuracy,
        avgReactionMs,
        durationSec,
        trialsCompleted: testable,
        details: { nValue },
      });
    } else {
      setStep(next);
      setAnswered(null);
      setFeedback('');
      statsRef.current.stepStart = performance.now();
    }
  };

  const handleAnswer = (userSaysMatch: boolean) => {
    if (answered !== null || step < nValue) return;
    const rt = Math.round(performance.now() - statsRef.current.stepStart);
    const actualMatch = sequence[step].icon === sequence[step - nValue].icon;
    const isCorrect = userSaysMatch === actualMatch;

    statsRef.current.totalTestable += 1;
    statsRef.current.reactionSum += rt;
    statsRef.current.reactionCount += 1;

    if (isCorrect) {
      statsRef.current.correct += 1;
      playTone('correct', soundEnabled);
      setFeedback('判断正确！');
    } else {
      playTone('wrong', soundEnabled);
      setFeedback(
        actualMatch
          ? `其实是相同的（前 ${nValue} 步也是 ${sequence[step - nValue].name}）`
          : `其实是不同的（前 ${nValue} 步是 ${sequence[step - nValue].name}）`
      );
    }
    setAnswered(isCorrect);

    timerRef.current = window.setTimeout(() => advance(step), 900);
  };

  if (sequence.length === 0) return null;

  const currentItem = sequence[step];
  const isWarmup = step < nValue;

  return (
    <div className="flex flex-col items-center">
      <div className="mb-4 flex w-full items-center justify-between text-sm text-slate-600">
        <span>第 {step + 1} / {sequence.length} 步</span>
        <span className="rounded-full bg-indigo-100 px-3 py-0.5 font-semibold text-indigo-800">
          {nValue}-Back 模式
        </span>
      </div>

      <div className="mb-6 flex w-full flex-col items-center justify-center rounded-2xl border-2 border-indigo-200 bg-indigo-50/60 py-10">
        <div className="mb-3 text-8xl">{currentItem.icon}</div>
        <div className="text-2xl font-bold text-slate-800">{currentItem.name}</div>
      </div>

      {isWarmup ? (
        <div className="w-full text-center">
          <p className="mb-4 text-lg text-slate-700">
            请记住这个图标（起始第 {step + 1} 个，还需看 {nValue - step} 个后开始判断）
          </p>
          <button
            onClick={() => {
              playTone('tap', soundEnabled);
              advance(step);
            }}
            className="w-full rounded-2xl bg-indigo-600 px-6 py-4 text-xl font-bold text-white shadow-sm transition hover:bg-indigo-700 active:scale-98"
          >
            记住了，看下一个
          </button>
        </div>
      ) : (
        <div className="w-full">
          <p className="mb-4 text-center text-lg font-medium text-slate-700">
            当前图标和 <strong className="text-indigo-700">前 {nValue} 步</strong> 的图标一样吗？
          </p>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => handleAnswer(true)}
              disabled={answered !== null}
              className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 py-5 text-xl font-bold text-emerald-900 transition hover:bg-emerald-100 active:scale-95 disabled:opacity-60"
            >
              ✓ 相同
            </button>
            <button
              onClick={() => handleAnswer(false)}
              disabled={answered !== null}
              className="rounded-2xl border-2 border-slate-300 bg-white py-5 text-xl font-bold text-slate-800 transition hover:bg-slate-100 active:scale-95 disabled:opacity-60"
            >
              ✕ 不同
            </button>
          </div>
          {feedback && (
            <div
              className={`mt-4 rounded-xl py-2.5 text-center text-base font-semibold ${
                answered ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}
            >
              {feedback}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
