import { BookOpen, HeartPulse, Moon, Sparkles } from 'lucide-react';
import { MODULE_LIST } from '../data/modules';

export function ScienceView() {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-teal-200 bg-teal-50/70 p-6 sm:p-8">
        <div className="flex items-center gap-2 text-teal-800">
          <BookOpen className="h-6 w-6" />
          <h2 className="text-xl font-bold">为什么本网站的训练依据医学论文设计？</h2>
        </div>
        <p className="mt-3 text-base leading-relaxed text-slate-700">
          50 多岁正处于构建“认知储备（Cognitive Reserve）”的关键窗口期。临床研究表明，单纯“背书”或“随便玩小游戏”很难迁移到日常生活，而<strong>自适应难度（Adaptive Process-Based Training）</strong>与<strong>多维度协同训练</strong>才能有效刺激大脑神经可塑性。
        </p>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-900">五大训练模块的临床文献依据</h3>
        {MODULE_LIST.map((mod) => (
          <div key={mod.id} className="rounded-2xl border border-stone-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-lg font-bold text-slate-900">{mod.title}</h4>
              <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${mod.colorBg} ${mod.colorText}`}>
                {mod.domain}
              </span>
            </div>
            <p className="mt-2 text-sm font-semibold text-teal-800">
              参考文献：{mod.paperCitation}
            </p>
            <p className="mt-2 text-base leading-relaxed text-slate-700">{mod.scienceSummary}</p>
          </div>
        ))}
      </div>

      <div className="rounded-3xl border border-stone-200 bg-white p-6">
        <h3 className="mb-4 text-lg font-bold text-slate-900">配合认知训练的 3 个日常护脑习惯</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-stone-50 p-4">
            <HeartPulse className="mb-2 h-6 w-6 text-rose-600" />
            <div className="font-bold text-slate-900">每周有氧运动</div>
            <p className="mt-1 text-sm text-slate-600">
              快走、太极或游泳每次 30 分钟，可促进脑源性神经营养因子（BDNF）分泌。
            </p>
          </div>
          <div className="rounded-2xl bg-stone-50 p-4">
            <Moon className="mb-2 h-6 w-6 text-indigo-600" />
            <div className="font-bold text-slate-900">规律深度睡眠</div>
            <p className="mt-1 text-sm text-slate-600">
              记忆巩固主要发生在深睡眠期，建议每天保持 7 小时左右规律作息。
            </p>
          </div>
          <div className="rounded-2xl bg-stone-50 p-4">
            <Sparkles className="mb-2 h-6 w-6 text-amber-600" />
            <div className="font-bold text-slate-900">控制血压血糖</div>
            <p className="mt-1 text-sm text-slate-600">
              心脑血管健康与 50 岁后的记忆力高度相关，清淡饮食、定期体检很关键。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
