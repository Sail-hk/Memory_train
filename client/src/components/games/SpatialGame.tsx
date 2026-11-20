import { useEffect, useRef, useState } from 'react';
import type { GameResult } from '../../types';
import { playTone } from '../../utils/sound';

interface Props {
  level: number;
  soundEnabled: boolean;
  onComplete: (result: GameResult) => void;
}

const TOTAL_ROUNDS = 5;

export function SpatialGame({ level, soundEnabled, onComplete }: Props) {
  const gridSize = level <= 5 ? 9 : 16; // 3x3 or 4x4
  const initialSpan = Math.min(7, 3 + Math.floor((level - 1) / 2));

  const [round, setRound] = useState(0);
  const [span, setSpan] = useState(initialSpan);
  const [sequence, setSequence] = useState<number[]>([]);
  const [activeTile, setActiveTile] = useState<number | null>(null);
  const [userInput, setUserInput] = useState<number[]>([]);
  const [phase, setPhase] = useState<'showing' | 'input' | 'feedback'>('showing');
  const [roundOk, setRoundOk] = useState<boolean | null>(null);

  const statsRef = useRef({
    correctRounds: 0,
    startTime: Date.now(),
    inputStart: 0,
    reactionSum: 0,
  });
  const timersRef = useRef<number[]>([]);

  const clearAllTimers = () => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  };

  const startRound = (roundIdx: number, currentSpan: number) => {
    clearAllTimers();
    const indices = Array.from({ length: gridSize }, (_, i) => i);
    const seq: number[] = [];
    for (let i = 0; i < currentSpan; i++) {
      const available = indices.filter((idx) => idx !== seq[seq.length - 1]);
      seq.push(available[Math.floor(Math.random() * available.length)]);
    }

    setRound(roundIdx);
    setSpan(currentSpan);
    setSequence(seq);
    setUserInput([]);
    setRoundOk(null);
    setPhase('showing');

    seq.forEach((tileIdx, step) => {
      const showAt = 500 + step * 750;
      const hideAt = showAt + 480;
      timersRef.current.push(
        window.setTimeout(() => {
          setActiveTile(tileIdx);
          playTone('tap', soundEnabled);
        }, showAt)
      );
      timersRef.current.push(
        window.setTimeout(() => {
          setActiveTile(null);
        }, hideAt)
      );
    });

    const endAt = 500 + seq.length * 750 + 200;
    timersRef.current.push(
      window.setTimeout(() => {
        setPhase('input');
        statsRef.current.inputStart = performance.now();
      }, endAt)
    );
  };

  useEffect(() => {
    statsRef.current.startTime = Date.now();
    startRound(0, initialSpan);
    return () => clearAllTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTileClick = (idx: number) => {
    if (phase !== 'input') return;
    playTone('tap', soundEnabled);
    const nextInput = [...userInput, idx];
    setUserInput(nextInput);

    const stepIdx = nextInput.length - 1;
    const isStepRight = nextInput[stepIdx] === sequence[stepIdx];

    if (!isStepRight || nextInput.length === sequence.length) {
      const allCorrect = isStepRight && nextInput.length === sequence.length;
      const rt = Math.round(performance.now() - statsRef.current.inputStart);
      statsRef.current.reactionSum += rt;

      if (allCorrect) {
        statsRef.current.correctRounds += 1;
        playTone('correct', soundEnabled);
      } else {
        playTone('wrong', soundEnabled);
      }

      setRoundOk(allCorrect);
      setPhase('feedback');

      const nextSpan = allCorrect ? Math.min(8, span + 1) : Math.max(3, span - 1);
      const nextRound = round + 1;

      timersRef.current.push(
        window.setTimeout(() => {
          if (nextRound >= TOTAL_ROUNDS) {
            const durationSec = Math.max(1, Math.round((Date.now() - statsRef.current.startTime) / 1000));
            const accuracy = Math.round((statsRef.current.correctRounds / TOTAL_ROUNDS) * 100);
            const avgReactionMs = Math.round(statsRef.current.reactionSum / TOTAL_ROUNDS);
            const score = Math.round(accuracy * 8 + span * 45 + level * 15);
            playTone('complete', soundEnabled);
            onComplete({
              score,
              accuracy,
              avgReactionMs,
              durationSec,
              trialsCompleted: TOTAL_ROUNDS,
              details: { maxSpanReached: span },
            });
          } else {
            startRound(nextRound, nextSpan);
          }
        }, 1000)
      );
    }
  };

  const cols = gridSize === 9 ? 'grid-cols-3' : 'grid-cols-4';

  return (
    <div className="flex flex-col items-center">
      <div className="mb-4 flex w-full items-center justify-between text-sm text-slate-600">
        <span>第 {round + 1} / {TOTAL_ROUNDS} 轮</span>
        <span className="rounded-full bg-sky-100 px-3 py-0.5 font-semibold text-sky-800">
          记忆长度：{span} 步
        </span>
      </div>

      <div className="mb-4 w-full rounded-xl bg-sky-50 py-2.5 text-center text-lg font-medium text-sky-900">
        {phase === 'showing' && '请仔细看方格亮起的顺序…'}
        {phase === 'input' && `请按顺序依次点击方格（已点 ${userInput.length} / ${sequence.length}）`}
        {phase === 'feedback' && (roundOk ? '太棒了，顺序完全正确！' : '顺序有误，下一轮继续加油')}
      </div>

      <div className={`grid w-full max-w-sm ${cols} gap-3`}>
        {Array.from({ length: gridSize }, (_, i) => {
          const isLit = activeTile === i;
          const pickedOrder = userInput.indexOf(i);
          return (
            <button
              key={i}
              onClick={() => handleTileClick(i)}
              disabled={phase !== 'input'}
              className={`flex aspect-square items-center justify-center rounded-2xl border-2 text-2xl font-bold transition ${
                isLit
                  ? 'scale-105 border-sky-600 bg-sky-500 text-white shadow-lg'
                  : pickedOrder !== -1
                  ? 'border-sky-400 bg-sky-100 text-sky-800'
                  : 'border-slate-200 bg-white text-slate-400 hover:border-sky-300'
              }`}
            >
              {pickedOrder !== -1 ? pickedOrder + 1 : ''}
            </button>
          );
        })}
      </div>
    </div>
  );
}
