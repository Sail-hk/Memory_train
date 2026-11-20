import { useEffect, useRef, useState } from 'react';
import { api } from '../../api';
import type { GameResult } from '../../types';
import { playTone } from '../../utils/sound';

interface Props {
  level: number;
  soundEnabled: boolean;
  onComplete: (result: GameResult) => void;
}

interface PairItem {
  key: string;
  cue: string;
  answer: string;
  distractors: string[];
  tip: string;
}

const PAIR_BANK: PairItem[] = [
  { key: 'p1', cue: '老张的爱好', answer: '下象棋', distractors: ['打太极', '钓鱼', '养花'], tip: '想象老张拿着“帅”字棋子' },
  { key: 'p2', cue: '老花镜放哪里', answer: '茶几抽屉', distractors: ['床头柜', '玄关鞋柜', '书架上'], tip: '坐客厅看报时顺手拉开茶几' },
  { key: 'p3', cue: '王阿姨养的宠物', answer: '橘猫', distractors: ['金毛犬', '八哥鸟', '金鱼'], tip: '橘猫暖烘烘地趴在阳台晒太阳' },
  { key: 'p4', cue: '备用钥匙放在', answer: '蓝色铁盒', distractors: ['红色钱包', '花盆底下', '衣柜顶层'], tip: '金属钥匙碰上蓝色铁盒发出清脆声' },
  { key: 'p5', cue: '陈医生的门诊时间', answer: '每周三上午', distractors: ['每周一全天', '每周五下午', '每周六上午'], tip: '记“三”：周三上午去复查' },
  { key: 'p6', cue: '小区北门菜摊买', answer: '西红柿和豆腐', distractors: ['黄瓜和鸡蛋', '土豆和排骨', '青菜和鱼'], tip: '一红一白：红西红柿配白豆腐' },
  { key: 'p7', cue: '血压药服用时间', answer: '早饭后半小时', distractors: ['睡前服用', '午饭前空腹', '晚饭后立即'], tip: '吃完早饭歇半小时再吃药' },
  { key: 'p8', cue: '刘叔的老家在', answer: '苏州', distractors: ['杭州', '成都', '青岛'], tip: '苏州园林小桥流水' },
  { key: 'p9', cue: '水电费缴费日', answer: '每月 15 号', distractors: ['每月 1 号', '每月 20 号', '每月 28 号'], tip: '十五月亮圆，正好交水电' },
  { key: 'p10', cue: '雨伞平时挂在', answer: '门后挂钩', distractors: ['阳台晾衣架', '客厅沙发旁', '车后备箱'], tip: '一进门就能看见门后挂钩' },
];

export function SpacedGame({ level, soundEnabled, onComplete }: Props) {
  const itemCount = Math.min(6, 3 + Math.floor((level - 1) / 3));

  const [items, setItems] = useState<PairItem[]>([]);
  const [phase, setPhase] = useState<'study' | 'distractor' | 'test'>('study');
  const [studyIdx, setStudyIdx] = useState(0);
  const [testIdx, setTestIdx] = useState(0);
  const [options, setOptions] = useState<string[]>([]);
  const [mathQ, setMathQ] = useState({ a: 14, b: 8, ans: 22, choices: [20, 22, 24, 21] });
  const [mathFeedback, setMathFeedback] = useState('');
  const [testFeedback, setTestFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const statsRef = useRef({
    correct: 0,
    reactionSum: 0,
    startTime: Date.now(),
    qStart: performance.now(),
    reviews: [] as Array<{ itemKey: string; correct: boolean }>,
  });
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const picked = [...PAIR_BANK].sort(() => Math.random() - 0.5).slice(0, itemCount);
    setItems(picked);

    const a = 12 + Math.floor(Math.random() * 15);
    const b = 6 + Math.floor(Math.random() * 9);
    const ans = a + b;
    const choices = [ans, ans - 2, ans + 3, ans + 1].sort(() => Math.random() - 0.5);
    setMathQ({ a, b, ans, choices });

    statsRef.current.startTime = Date.now();
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [itemCount]);

  const prepareTestQuestion = (idx: number, list: PairItem[]) => {
    const item = list[idx];
    const opts = [item.answer, ...item.distractors].sort(() => Math.random() - 0.5);
    setOptions(opts);
    setTestIdx(idx);
    setTestFeedback(null);
    statsRef.current.qStart = performance.now();
  };

  const handleNextStudy = () => {
    playTone('tap', soundEnabled);
    if (studyIdx + 1 < items.length) {
      setStudyIdx(studyIdx + 1);
    } else {
      setPhase('distractor');
    }
  };

  const handleMathPick = (val: number) => {
    if (val === mathQ.ans) {
      playTone('correct', soundEnabled);
      setMathFeedback('算对了！现在开始回忆刚才记住的内容');
      timerRef.current = window.setTimeout(() => {
        setPhase('test');
        prepareTestQuestion(0, items);
      }, 900);
    } else {
      playTone('wrong', soundEnabled);
      setMathFeedback('再算一次看看哦');
    }
  };

  const handleTestPick = (choice: string) => {
    if (testFeedback) return;
    const rt = Math.round(performance.now() - statsRef.current.qStart);
    const current = items[testIdx];
    const ok = choice === current.answer;

    statsRef.current.reactionSum += rt;
    statsRef.current.reviews.push({ itemKey: current.key, correct: ok });

    if (ok) {
      statsRef.current.correct += 1;
      playTone('correct', soundEnabled);
      setTestFeedback({ ok: true, msg: '记忆准确！' });
    } else {
      playTone('wrong', soundEnabled);
      setTestFeedback({ ok: false, msg: `正确答案是：${current.answer}` });
    }

    timerRef.current = window.setTimeout(() => {
      const next = testIdx + 1;
      if (next >= items.length) {
        api.submitSpacedReview(statsRef.current.reviews).catch(() => {});
        const durationSec = Math.max(1, Math.round((Date.now() - statsRef.current.startTime) / 1000));
        const accuracy = Math.round((statsRef.current.correct / items.length) * 100);
        const avgReactionMs = Math.round(statsRef.current.reactionSum / items.length);
        const score = Math.round(accuracy * 8 + items.length * 35 + level * 15);
        playTone('complete', soundEnabled);
        onComplete({
          score,
          accuracy,
          avgReactionMs,
          durationSec,
          trialsCompleted: items.length,
        });
      } else {
        prepareTestQuestion(next, items);
      }
    }, 1000);
  };

  if (items.length === 0) return null;

  return (
    <div className="flex flex-col items-center">
      {phase === 'study' && (
        <div className="w-full">
          <div className="mb-3 flex justify-between text-sm text-slate-600">
            <span>第一阶段：联想记忆 ({studyIdx + 1} / {items.length})</span>
            <span>难度 Lv.{level}</span>
          </div>
          <div className="mb-6 rounded-2xl border-2 border-amber-200 bg-amber-50/70 p-8 text-center">
            <p className="mb-2 text-lg text-amber-900">{items[studyIdx].cue}</p>
            <p className="mb-4 text-3xl font-bold text-slate-900">{items[studyIdx].answer}</p>
            <p className="inline-block rounded-lg bg-white/80 px-4 py-2 text-sm text-amber-800">
              💡 记忆小窍门：{items[studyIdx].tip}
            </p>
          </div>
          <button
            onClick={handleNextStudy}
            className="w-full rounded-2xl bg-amber-600 py-4 text-xl font-bold text-white shadow-sm transition hover:bg-amber-700"
          >
            {studyIdx + 1 < items.length ? '记住了，看下一条' : '全部记住了，进入间隔小测试'}
          </button>
        </div>
      )}

      {phase === 'distractor' && (
        <div className="w-full text-center">
          <p className="mb-2 text-sm font-medium text-slate-500">第二阶段：短暂间隔（清理瞬时记忆，检验长时巩固）</p>
          <div className="mb-6 rounded-2xl border-2 border-slate-200 bg-slate-50 p-8">
            <p className="mb-2 text-lg text-slate-700">先做一道简单口算题：</p>
            <p className="text-4xl font-bold text-slate-900">{mathQ.a} + {mathQ.b} = ?</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {mathQ.choices.map((c) => (
              <button
                key={c}
                onClick={() => handleMathPick(c)}
                className="rounded-2xl border-2 border-slate-200 bg-white py-4 text-2xl font-bold text-slate-800 hover:border-amber-400 hover:bg-amber-50"
              >
                {c}
              </button>
            ))}
          </div>
          {mathFeedback && (
            <p className="mt-4 text-lg font-semibold text-amber-800">{mathFeedback}</p>
          )}
        </div>
      )}

      {phase === 'test' && (
        <div className="w-full">
          <div className="mb-3 flex justify-between text-sm text-slate-600">
            <span>第三阶段：间隔回忆 ({testIdx + 1} / {items.length})</span>
            <span>回忆配对</span>
          </div>
          <div className="mb-5 rounded-2xl border-2 border-amber-200 bg-amber-50/50 p-6 text-center">
            <p className="mb-1 text-base text-slate-600">请问刚才记住的：</p>
            <p className="text-2xl font-bold text-slate-900">{items[testIdx].cue} 是？</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {options.map((opt) => (
              <button
                key={opt}
                onClick={() => handleTestPick(opt)}
                disabled={Boolean(testFeedback)}
                className="rounded-2xl border-2 border-slate-200 bg-white px-4 py-4 text-xl font-bold text-slate-800 transition hover:border-amber-400 hover:bg-amber-50 disabled:opacity-75"
              >
                {opt}
              </button>
            ))}
          </div>
          {testFeedback && (
            <div
              className={`mt-4 rounded-xl py-2.5 text-center text-lg font-semibold ${
                testFeedback.ok ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}
            >
              {testFeedback.msg}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
