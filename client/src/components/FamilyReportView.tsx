import { useEffect, useState } from 'react';
import { Brain, RefreshCw } from 'lucide-react';
import { api } from '../api';
import type { FamilyReportData } from '../types';
import { ProgressView } from './ProgressView';

interface Props {
  token: string;
}

export function FamilyReportView({ token }: Props) {
  const [data, setData] = useState<FamilyReportData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    setError('');
    api
      .getSharedReport(token)
      .then((res) => setData(res))
      .catch((err) => setError(err instanceof Error ? err.message : '加载失败'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="min-h-screen bg-[#FAF8F5] pb-12">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700 text-white">
              <Brain className="h-6 w-6" />
            </div>
            <div>
              <div className="text-lg font-bold text-slate-900">
                {data ? `${data.displayName} 的记忆训练效果报告` : '家属远程查看'}
              </div>
              <div className="text-xs text-slate-500">只读视图 · 数据实时同步</div>
            </div>
          </div>
          <button
            onClick={load}
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-stone-100"
          >
            <RefreshCw className="h-4 w-4" />
            刷新数据
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pt-6">
        {loading && (
          <div className="py-16 text-center text-lg text-slate-600">正在获取最新训练报告…</div>
        )}
        {!loading && error && (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center">
            <p className="text-lg font-semibold text-rose-800">{error}</p>
            <a
              href="/"
              className="mt-4 inline-block rounded-xl bg-teal-700 px-5 py-2.5 text-base font-bold text-white"
            >
              返回首页
            </a>
          </div>
        )}
        {!loading && data && (
          <ProgressView
            overview={data.overview}
            readOnly
            initialEffectiveness={data.effectiveness}
            initialSessions={data.sessions}
          />
        )}
      </main>
    </div>
  );
}
