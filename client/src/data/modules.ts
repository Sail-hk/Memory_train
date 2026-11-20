import type { ModuleId } from '../types';

export interface ModuleMeta {
  id: ModuleId;
  title: string;
  subtitle: string;
  domain: string;
  durationHint: string;
  colorBg: string;
  colorText: string;
  colorBorder: string;
  paperCitation: string;
  scienceSummary: string;
  howToPlay: string;
}

export const MODULES: Record<ModuleId, ModuleMeta> = {
  speed: {
    id: 'speed',
    title: '火眼金睛 · 信息处理速度',
    subtitle: '快速视觉搜索与反应训练',
    domain: '信息处理速度 (Processing Speed)',
    durationHint: '约 2-3 分钟',
    colorBg: 'bg-teal-50',
    colorText: 'text-teal-800',
    colorBorder: 'border-teal-200',
    paperCitation: 'ACTIVE 临床试验 (Ball et al., JAMA 2002; Rebok et al., JAGS 2014; 20年随访)',
    scienceSummary:
      '美国 NIH 赞助的 ACTIVE 大型随机对照试验（2800+名中老年人）20年随访显示，自适应视觉处理速度训练可显著维持日常认知功能，并使长期痴呆发生风险降低约 25%。',
    howToPlay:
      '屏幕短暂闪现目标物品后，在多个相似物品中快速找出目标并点击。难度会根据您的正确率自动调节。',
  },
  nback: {
    id: 'nback',
    title: '前瞻后顾 · N-Back 工作记忆',
    subtitle: '动态刷新与短期记忆容量训练',
    domain: '工作记忆 (Working Memory)',
    durationHint: '约 3 分钟',
    colorBg: 'bg-indigo-50',
    colorText: 'text-indigo-800',
    colorBorder: 'border-indigo-200',
    paperCitation: 'Jaeggi et al., PNAS 2008; Karbach & Verhaeghen, Psychology and Aging 2014',
    scienceSummary:
      'N-Back 范式是神经科学中验证工作记忆可塑性最经典的训练任务。研究表明，自适应 N-Back 训练能强化前额叶执行刷新能力，改善中老年人日常“刚想做的事转头就忘”的困扰。',
    howToPlay:
      '记住依次出现的物品图标，判断当前出现的图标是否与“前 1 步（或前 2 步）”出现的图标相同。',
  },
  spaced: {
    id: 'spaced',
    title: '温故知新 · 间隔联想记忆',
    subtitle: '生活场景配对与间隔提取训练',
    domain: '情景与长时记忆 (Episodic Memory)',
    durationHint: '约 3-4 分钟',
    colorBg: 'bg-amber-50',
    colorText: 'text-amber-800',
    colorBorder: 'border-amber-200',
    paperCitation: 'Camp et al. Spaced Retrieval 范式; ACTIVE 记忆策略干预臂',
    scienceSummary:
      '“间隔提取（Spaced Retrieval）”结合联想编码策略，通过先记忆、短暂间隔后再主动回忆，利用艾宾浩斯遗忘曲线规律巩固海马体长时记忆，特别适合人名、物品位置等日常记忆。',
    howToPlay:
      '先记住几组生活中的配对信息（例如“老张 — 喜欢下象棋”或“老花镜 — 放在茶几抽屉”），经过短暂干扰后，回忆正确配对。',
  },
  spatial: {
    id: 'spatial',
    title: '步步为营 · 空间顺序记忆',
    subtitle: 'Corsi 视觉空间广度训练',
    domain: '空间工作记忆 (Visuospatial Span)',
    durationHint: '约 2-3 分钟',
    colorBg: 'bg-sky-50',
    colorText: 'text-sky-800',
    colorBorder: 'border-sky-200',
    paperCitation: 'Corsi Block-Tapping 神经心理学范式',
    scienceSummary:
      'Corsi 空间广度任务直接锻炼右半球顶叶与海马旁回的空间序列记忆能力，有助于改善认路、记停车位以及按步骤操作事务的能力。',
    howToPlay:
      '观察方格依次亮起的顺序，亮灯结束后，按“一模一样的顺序”把它们依次点出来。',
  },
  stroop: {
    id: 'stroop',
    title: '去伪存真 · 抗干扰专注力',
    subtitle: 'Stroop 执行控制与抑制训练',
    domain: '执行功能 (Executive Control)',
    durationHint: '约 2 分钟',
    colorBg: 'bg-rose-50',
    colorText: 'text-rose-800',
    colorBorder: 'border-rose-200',
    paperCitation: 'Stroop 范式; Anguera et al., Nature 2013 (中老年认知控制研究)',
    scienceSummary:
      '50岁以后大脑抑制无关干扰的能力会逐渐下降。Stroop 抗干扰训练能增强前扣带回与前额叶的注意力控制，减少分心与粗心失误。',
    howToPlay:
      '屏幕会出现一个表示颜色的汉字（比如“红”字），但字本身是蓝色的。请忽略字的意思，选出“字体实际的颜色”。',
  },
};

export const MODULE_LIST: ModuleMeta[] = [
  MODULES.speed,
  MODULES.nback,
  MODULES.spaced,
  MODULES.spatial,
  MODULES.stroop,
];
