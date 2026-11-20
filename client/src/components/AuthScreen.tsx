import { useState } from 'react';
import { Brain, Eye, EyeOff, Sparkles } from 'lucide-react';
import { api } from '../api';
import type { User } from '../types';

interface Props {
  onSuccess: (user: User) => void;
}

export function AuthScreen({ onSuccess }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res =
        mode === 'login'
          ? await api.login(username, password)
          : await api.register(username, password, displayName);
      onSuccess(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await api.demoLogin();
      onSuccess(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : '演示登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAF8F5] px-4 py-8">
      <div className="w-full max-w-md rounded-3xl border border-stone-200 bg-white p-7 shadow-lg sm:p-9">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-700 text-white shadow-md">
            <Brain className="h-9 w-9" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">智忆 · 科学记忆力训练</h1>
          <p className="mt-1.5 text-base text-slate-600">
            依据临床医学论文设计，每天 10 分钟，保持大脑年轻态
          </p>
        </div>

        <div className="mb-6 grid grid-cols-2 rounded-2xl bg-stone-100 p-1">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError('');
            }}
            className={`rounded-xl py-2.5 text-base font-semibold transition ${
              mode === 'login' ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-600'
            }`}
          >
            账号登录
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError('');
            }}
            className={`rounded-xl py-2.5 text-base font-semibold transition ${
              mode === 'register' ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-600'
            }`}
          >
            注册新账号
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-base font-medium text-slate-700">
              登录账号（字母、数字或手机号）
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="例如：baba888 或手机号"
              className="w-full rounded-xl border border-stone-300 px-4 py-3 text-lg outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            />
          </div>

          {mode === 'register' && (
            <div>
              <label className="mb-1.5 block text-base font-medium text-slate-700">
                怎么称呼您？（可选）
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="例如：老李、张先生"
                className="w-full rounded-xl border border-stone-300 px-4 py-3 text-lg outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              />
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-base font-medium text-slate-700">
              密码（至少 4 位）
            </label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                className="w-full rounded-xl border border-stone-300 px-4 py-3 pr-12 text-lg outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                className="absolute top-1/2 right-3 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-800"
                aria-label="切换密码显示"
              >
                {showPwd ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-rose-50 px-4 py-3 text-base font-medium text-rose-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-teal-700 py-3.5 text-xl font-bold text-white shadow-sm transition hover:bg-teal-800 disabled:opacity-60"
          >
            {loading ? '请稍候…' : mode === 'login' ? '立即登录' : '注册并开始训练'}
          </button>
        </form>

        <div className="mt-5 border-t border-stone-200 pt-5">
          <button
            type="button"
            onClick={handleDemo}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-teal-200 bg-teal-50/70 py-3 text-base font-semibold text-teal-900 transition hover:bg-teal-100"
          >
            <Sparkles className="h-5 w-5" />
            免注册 · 一键体验演示账号
          </button>
          <p className="mt-3 text-center text-sm text-slate-500">
            提示：家人可先帮爸爸注册好账号，登录后 14 天内免重复输入密码。
          </p>
        </div>
      </div>
    </div>
  );
}
