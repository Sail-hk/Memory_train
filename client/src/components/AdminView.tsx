import { useEffect, useState } from 'react';
import { ArrowLeft, Eye, KeyRound, Shield, Trash2, Users } from 'lucide-react';
import { api } from '../api';
import type { AdminUserSummary, FamilyReportData } from '../types';
import { ProgressView } from './ProgressView';

export function AdminView() {
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<FamilyReportData | null>(null);
  const [msg, setMsg] = useState('');

  const loadUsers = () => {
    setLoading(true);
    api
      .adminGetUsers()
      .then((res) => setUsers(res.users))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleViewReport = async (u: AdminUserSummary) => {
    const report = await api.adminGetUserReport(u.id);
    setSelectedReport(report);
  };

  const handleResetPwd = async (u: AdminUserSummary) => {
    const pwd = window.prompt(`请输入「${u.displayName} (${u.username})」的新密码（至少4位）：`);
    if (!pwd) return;
    try {
      await api.adminResetPassword(u.id, pwd);
      setMsg(`已重置 ${u.displayName} 的密码`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : '重置失败');
    }
  };

  const handleDelete = async (u: AdminUserSummary) => {
    if (!window.confirm(`确定要删除账号「${u.displayName} (${u.username})」及其训练记录吗？`)) {
      return;
    }
    try {
      await api.adminDeleteUser(u.id);
      setMsg(`已删除账号 ${u.username}`);
      loadUsers();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : '删除失败');
    }
  };

  if (selectedReport) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSelectedReport(null)}
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-base font-medium text-slate-700 hover:bg-stone-200/60"
          >
            <ArrowLeft className="h-5 w-5" />
            返回用户列表
          </button>
          <span className="rounded-full bg-indigo-100 px-3 py-1 text-sm font-semibold text-indigo-800">
            正在查看：{selectedReport.displayName}
          </span>
        </div>
        <ProgressView
          overview={selectedReport.overview}
          readOnly
          initialEffectiveness={selectedReport.effectiveness}
          initialSessions={selectedReport.sessions}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-indigo-200 bg-indigo-50/70 p-6">
        <div className="flex items-center gap-2 text-indigo-900">
          <Shield className="h-6 w-6" />
          <h2 className="text-xl font-bold">管理员控制台</h2>
        </div>
        <p className="mt-1.5 text-sm text-slate-700">
          您可以查看所有账号（包括爸爸的账号）的训练效果报告，或在家人忘记密码时一键重置密码。
        </p>
      </div>

      {msg && (
        <div className="rounded-2xl bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-900">
          {msg}
        </div>
      )}

      <div className="rounded-3xl border border-stone-200 bg-white p-6">
        <div className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900">
          <Users className="h-5 w-5 text-teal-700" />
          全部用户 ({users.length})
        </div>

        {loading ? (
          <p className="py-6 text-center text-slate-500">正在加载用户列表…</p>
        ) : (
          <div className="divide-y divide-stone-100">
            {users.map((u) => (
              <div
                key={u.id}
                className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-slate-900">{u.displayName}</span>
                    <span className="text-sm text-slate-500">@{u.username}</span>
                    {u.role === 'admin' && (
                      <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-800">
                        管理员
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    累计训练 {u.totalSessions} 次 · 最近训练：{u.lastActiveAt || '暂无'}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleViewReport(u)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-teal-800"
                  >
                    <Eye className="h-4 w-4" />
                    查看训练效果
                  </button>
                  <button
                    onClick={() => handleResetPwd(u)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-stone-100"
                  >
                    <KeyRound className="h-4 w-4" />
                    重置密码
                  </button>
                  {u.role !== 'admin' && (
                    <button
                      onClick={() => handleDelete(u)}
                      className="inline-flex items-center gap-1 rounded-xl border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
