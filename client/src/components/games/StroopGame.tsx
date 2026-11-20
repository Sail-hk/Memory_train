import { useEffect, useRef, useState } from 'react';
import type { GameResult } from '../../types';
import { playTone } from '../../utils/sound';

interface Props {
  level: number;
  soundEnabled: boolean;
  onComplete: (result: GameResult) => void;
}

const COLORS = [
  { key: 'red', label: '红色', char: '红', hex: '#DC2626', btnBg: 'bg-red-600 hover:bg-red-700' },
  { key: 'blue', label: '蓝色', char: '蓝', hex: '#2563EB', btnBg: 'bg-blue-600 hover:bg-blue-700' },
  { key: 'green', label: '绿色', char: '绿', hex: '#16A34A', btnBg: 'bg-green-600 hover:bg-green-700' },
  { key: 'amber', label: '黄色', char: '黄', hex: '#D97706', btnBg: 'bg-amber-500 hover:bg-amber-600' },
];

const TOTAL_TRIALS = 15;

export function StroopGame({ level, soundEnabled, onComplete }: Props) {
  const [trial, setTrial] = useState(0);
  const [wordIdx, setWordIdx] = useState(0);
  const [inkIdx, setInkIdx] = useState(1);
  const [feedback, setFeedback] = useState<boolean | null>(null);

  const statsRef = useRef({
    correct: 0,
    reactionSum: 0,
    startTime: Date.now(),
    trialStart: performance.now(),
  });
  const timerRef = useRef<number | null>(null);

  const nextTrial = (idx: number) => {
    const w = Math.floor(Math.random() * COLORS.length);
    // Higher levels have higher probability of incongruent (mismatched) trials
    const incongruentProb = Math.min(0.9, 0.55 + level * 0.04);
    let ink = w;
    if (Math.random() < incongruentProb) {
      const others = COLORS.map((_, i) => i).filter((i) => i !== w);
      ink = others[Math.floor(Math.random() * others.length)];
    }
    setTrial(idx);
    setWordIdx(w);
    setInkIdx(ink);
    setFeedback(null);
    statsRef.current.trialStart = performance.now();
  };

  useEffect(() => {
    statsRef.current.startTime = Date.now();
    nextTrial(0);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePick = (pickedInkIdx: number) => {
    if (feedback !== null) return;
    const rt = Math.round(performance.now() - statsRef.current.trialStart);
    const ok = pickedInkIdx === inkIdx;
    statsRef.current.reactionSum += rt;
    if (ok) {
      statsRef.current.correct += 1;
      playTone('correct', soundEnabled);
    } else {
      playTone('wrong', soundEnabled);
    }
    setFeedback(ok);

    timerRef.current = window.setTimeout(() => {
      const next = trial + 1;
      if (next >= TOTAL_TRIALS) {
        const durationSec = Math.max(1, Math.round((Date.now() - statsRef.current.startTime) / 1000));
        const accuracy = Math.round((statsRef.current.correct / TOTAL_TRIALS) * 100);
        const avgReactionMs = Math.round(statsRef.current.reactionSum / TOTAL_TRIALS);
        const speedBonus = Math.max(0, Math.round((2200 - avgReactionMs) / 25));
        const score = Math.round(accuracy * 8 + speedBonus + level * 15);
        playTone('complete', soundEnabled);
        onComplete({
          score,
          accuracy,
          avgReactionMs,
          durationSec,
          trialsCompleted: TOTAL_TRIALS,
        });
      } else {
        nextTrial(next);
      }
    }, 550);
  };

  return (
    <div className="flex flex-col items-center">
      <div className="mb-4 flex w-full items-center justify-between text-sm text-slate-600">
        <span>第 {trial + 1} / {TOTAL_TRIALS} 题</span>
        <span>难度 Lv.{level}</span>
      </div>

      <p className="mb-4 rounded-xl bg-rose-50 px-4 py-2 text-center text-base font-medium text-rose-900">
        请忽略汉字的意思，选出<strong>“文字实际的颜色”</strong>
      </p>

      <div className="mb-6 flex h-44 w-full items-center justify-center rounded-2xl border-2 border-slate-200 bg-white shadow-inner">
        <span
          className="text-8xl font-black select-none"
          style={{ color: COLORS[inkIdx].hex }}
        >
          {COLORS[wordIdx].char}
        </span>
      </div>

      <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
        {COLORS.map((c, idx) => (
          <button
            key={c.key}
            onClick={() => handlePick(idx)}
            disabled={feedback !== null}
            className={`rounded-2xl py-4 text-xl font-bold text-white shadow-sm transition active:scale-95 disabled:opacity-75 ${c.btnBg}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {feedback !== null && (
        <div
          className={`mt-4 w-full rounded-xl py-2.5 text-center text-lg font-semibold ${
            feedback ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
          }`}
        >
          {feedback ? '选对了！专注力很强' : `实际字体颜色是：${COLORS[inkIdx].label}`}
        </div>
      )}
    </div>
  );
}
