import { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  Brain,
  CheckCircle2,
  Flame,
  LayoutGrid,
  LogOut,
  Play,
  Shield,
  Sparkles,
  Type,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { api } from './api';
import { AdminView } from './components/AdminView';
import { AuthScreen } from './components/AuthScreen';
import { FamilyReportView } from './components/FamilyReportView';
import { ProgressView } from './components/ProgressView';
import { ScienceView } from './components/ScienceView';
import { TrainingShell } from './components/TrainingShell';
import { MODULE_LIST, MODULES } from './data/modules';
import type { ModuleId, TrainingOverview, User } from './types';

type Tab = 'today' | 'all' | 'progress' | 'science' | 'admin';

function getDailyPlan(): ModuleId[] {
  const all: ModuleId[] = ['speed', 'nback', 'spaced', 'spatial', 'stroop'];
  const dayOfYear = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
  const start = dayOfYear % all.length;
  return [
    all[start],
    all[(start + 1) % all.length],
    all[(start + 2) % all.length],
  ];
}

export function App() {
  const shareMatch =
    typeof window !== 'undefined'
      ? window.location.pathname.match(/^\/share\/([a-zA-Z0-9_-]+)/)
      : null;

  if (shareMatch) {
    return <FamilyReportView token={shareMatch[1]} />;
  }

  return <MainApp />;
}

function MainApp() {
  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [tab, setTab] = useState<Tab>('today');
  const [overview, setOverview] = useState<TrainingOverview | null>(null);
  const [activeModule, setActiveModule] = useState<ModuleId | null>(null);

  const loadOverview = useCallback(async () => {
    try {
      const data = await api.getOverview();
      setOverview(data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    api
      .me()
      .then((res) => {
        setUser(res.user);
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => setCheckingAuth(false));
  }, []);

  useEffect(() => {
    if (user) {
      loadOverview();
      document.documentElement.classList.remove('font-large', 'font-normal');
      document.documentElement.classList.add(
        user.fontScale === 'large' ? 'font-large' : 'font-normal'
      );
    } else {
      document.documentElement.classList.remove('font-large');
      document.documentElement.classList.add('font-large');
    }
  }, [user, loadOverview]);

  const toggleFont = async () => {
    if (!user) return;
    const next = user.fontScale === 'large' ? 'normal' : 'large';
    const res = await api.updatePreferences({ fontScale: next });
    setUser(res.user);
  };

  const toggleSound = async () => {
    if (!user) return;
    const res = await api.updatePreferences({ soundEnabled: !user.soundEnabled });
    setUser(res.user);
  };

  const handleLogout = async () => {
    await api.logout().catch(() => {});
    setUser(null);
    setOverview(null);
    setActiveModule(null);
  };

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF8F5] text-lg text-slate-600">
        正在加载…
      </div>
    );
  }

  if (!user) {
    return <AuthScreen onSuccess={(u) => setUser(u)} />;
  }

  const dailyPlan = getDailyPlan();
  const completedToday = overview?.today.completedModules || [];
  const dailyDoneCount = dailyPlan.filter((id) => completedToday.includes(id)).length;

  const getLevel = (id: ModuleId) =>
    overview?.levels.find((l) => l.module_id === id)?.current_level || 1;
  const getBest = (id: ModuleId) =>
    overview?.levels.find((l) => l.module_id === id)?.best_score || 0;

  return (
    <div className="min-h-screen bg-[#FAF8F5] pb-12">
      {/* Top Bar */}
      <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700 text-white">
              <Brain className="h-6 w-6" />
            </div>
            <div>
              <div className="text-lg font-bold text-slate-900">智忆训练</div>
              <div className="text-xs text-slate-500">你好，{user.displayName}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleFont}
              title="切换字体大小"
              className="flex items-center gap-1 rounded-xl border border-stone-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-stone-100"
            >
              <Type className="h-4 w-4" />
              <span className="hidden sm:inline">
                {user.fontScale === 'large' ? '大字版' : '标准字'}
              </span>
            </button>
            <button
              onClick={toggleSound}
              title="切换提示音"
              className="flex items-center gap-1 rounded-xl border border-stone-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-stone-100"
            >
              {user.soundEnabled ? (
                <Volume2 className="h-4 w-4 text-teal-700" />
              ) : (
                <VolumeX className="h-4 w-4 text-slate-400" />
              )}
              <span className="hidden sm:inline">{user.soundEnabled ? '声音开' : '静音'}</span>
            </button>
            <button
              onClick={handleLogout}
              title="退出登录"
              className="flex items-center gap-1 rounded-xl border border-stone-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-rose-50 hover:text-rose-700"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">退出</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        {!activeModule && (
          <nav className="mx-auto flex max-w-4xl gap-1 px-4 pb-2">
            {[
              { id: 'today', label: '今日计划', icon: Sparkles },
              { id: 'all', label: '全部训练', icon: LayoutGrid },
              { id: 'progress', label: '训练报告', icon: BarChart3 },
              { id: 'science', label: '科学依据', icon: BookOpen },
              ...(user.role === 'admin'
                ? [{ id: 'admin', label: '管理后台', icon: Shield }]
                : []),
            ].map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setTab(item.id as Tab)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold transition sm:text-base ${
                    active
                      ? 'bg-teal-700 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-stone-100'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-4xl px-4 pt-6">
        {activeModule ? (
          <TrainingShell
            moduleId={activeModule}
            initialLevel={getLevel(activeModule)}
            soundEnabled={user.soundEnabled}
            onExit={(didComplete) => {
              setActiveModule(null);
              if (didComplete) loadOverview();
            }}
          />
        ) : (
          <>
            {tab === 'today' && (
              <div className="space-y-6">
                {/* Summary Banner */}
                <div className="rounded-3xl bg-gradient-to-br from-teal-700 to-teal-900 p-6 text-white shadow-md sm:p-8">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-sm text-teal-100">今日科学护脑处方</p>
                      <h2 className="mt-1 text-2xl font-bold sm:text-3xl">
                        已完成 {dailyDoneCount} / {dailyPlan.length} 项训练
                      </h2>
                      <p className="mt-1.5 text-sm text-teal-100">
                        每天 10-15 分钟，重点刺激速度、工作记忆与长时提取
                      </p>
                    </div>
                    <div className="flex items-center gap-3 rounded-2xl bg-white/15 px-4 py-3 backdrop-blur">
                      <Flame className="h-7 w-7 text-amber-300" />
                      <div>
                        <div className="text-xs text-teal-100">连续坚持</div>
                        <div className="text-xl font-bold">{overview?.streakDays || 0} 天</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Today's 3 Recommended Modules */}
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-slate-900">今日推荐训练（点击即可开始）</h3>
                  {dailyPlan.map((id, idx) => {
                    const mod = MODULES[id];
                    const done = completedToday.includes(id);
                    return (
                      <div
                        key={id}
                        className="flex flex-col justify-between gap-4 rounded-3xl border border-stone-200 bg-white p-5 shadow-sm transition hover:border-teal-300 sm:flex-row sm:items-center"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="rounded-lg bg-stone-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">
                              第 {idx + 1} 项
                            </span>
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${mod.colorBg} ${mod.colorText}`}
                            >
                              Lv.{getLevel(id)}
                            </span>
                            {done && (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                                <CheckCircle2 className="h-4 w-4" /> 今日已完成
                              </span>
                            )}
                          </div>
                          <h4 className="text-xl font-bold text-slate-900">{mod.title}</h4>
                          <p className="text-sm text-slate-600">
                            {mod.subtitle} · {mod.durationHint}
                          </p>
                        </div>
                        <button
                          onClick={() => setActiveModule(id)}
                          className={`flex items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-base font-bold transition ${
                            done
                              ? 'border-2 border-teal-200 bg-teal-50 text-teal-800 hover:bg-teal-100'
                              : 'bg-teal-700 text-white shadow-sm hover:bg-teal-800'
                          }`}
                        >
                          <Play className="h-5 w-5 fill-current" />
                          {done ? '再练一遍' : '开始训练'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {tab === 'all' && (
              <div>
                <h2 className="mb-4 text-xl font-bold text-slate-900">五大科学训练模块（自由练习）</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {MODULE_LIST.map((mod) => (
                    <div
                      key={mod.id}
                      className="flex flex-col justify-between rounded-3xl border border-stone-200 bg-white p-6 shadow-sm"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${mod.colorBg} ${mod.colorText}`}
                          >
                            {mod.domain}
                          </span>
                          <span className="text-sm font-bold text-slate-700">
                            Lv.{getLevel(mod.id)}
                          </span>
                        </div>
                        <h3 className="mt-3 text-xl font-bold text-slate-900">{mod.title}</h3>
                        <p className="mt-1 text-sm text-slate-600">{mod.subtitle}</p>
                        <p className="mt-3 text-xs text-slate-500">
                          最高分：{getBest(mod.id)} · {mod.durationHint}
                        </p>
                      </div>
                      <button
                        onClick={() => setActiveModule(mod.id)}
                        className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-700 py-3 text-base font-bold text-white hover:bg-teal-800"
                      >
                        <Play className="h-5 w-5 fill-current" />
                        进入训练
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === 'progress' && overview && <ProgressView overview={overview} />}

            {tab === 'science' && <ScienceView />}

            {tab === 'admin' && user.role === 'admin' && <AdminView />}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
