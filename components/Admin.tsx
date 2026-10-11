import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ShieldCheck, Trash2, RefreshCw, Loader2 } from 'lucide-react';

interface UserRow {
  id: string;
  email: string;
  role: 'user' | 'admin';
  created_at: number;
}

export const Admin: React.FC = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = async () => {
    setBusy(true);
    setMsg('');
    try {
      const r = await fetch('/api/auth/users');
      if (!r.ok) setMsg('加载失败：' + r.status);
      else setRows(await r.json());
    } catch {
      setMsg('网络错误');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'admin') load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (!user || user.role !== 'admin') return null;

  const changeRole = async (id: string, role: 'user' | 'admin') => {
    setBusy(true);
    try {
      const r = await fetch('/api/auth/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, role }),
      });
      if (!r.ok) setMsg('操作失败');
      else load();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('确定删除该用户？此操作不可恢复。')) return;
    setBusy(true);
    try {
      const r = await fetch('/api/auth/users?id=' + encodeURIComponent(id), { method: 'DELETE' });
      if (!r.ok) setMsg('删除失败');
      else load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="admin" className="py-12 md:py-24 px-6 bg-black/[0.02] dark:bg-white/[0.02]">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <ShieldCheck className="w-6 h-6 text-emerald-500" />
          <h2 className="text-2xl md:text-4xl font-bold">管理后台</h2>
          <button
            onClick={load}
            disabled={busy}
            className="ml-auto p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            title="刷新"
          >
            <RefreshCw className={`w-4 h-4 text-link/60 dark:text-white/60 ${busy ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {msg && <p className="text-sm text-red-500 mb-4">{msg}</p>}

        <div className="overflow-x-auto rounded-2xl border border-black/10 dark:border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-black/5 dark:bg-white/5 text-link/60 dark:text-white/60">
              <tr>
                <th className="text-left p-3 font-medium">邮箱</th>
                <th className="text-left p-3 font-medium">角色</th>
                <th className="text-left p-3 font-medium">注册时间</th>
                <th className="text-right p-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-black/5 dark:border-white/5">
                  <td className="p-3 text-link dark:text-white">{r.email}</td>
                  <td className="p-3">
                    <select
                      value={r.role}
                      onChange={(e) => changeRole(r.id, e.target.value as 'user' | 'admin')}
                      className="bg-transparent border border-black/10 dark:border-white/10 rounded px-2 py-1 text-link dark:text-white"
                    >
                      <option value="user">普通用户</option>
                      <option value="admin">管理员</option>
                    </select>
                  </td>
                  <td className="p-3 text-link/50 dark:text-white/50">
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => remove(r.id)}
                      disabled={r.id === user.id}
                      className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                      title={r.id === user.id ? '不能删除自己' : '删除用户'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-link/40 dark:text-white/40">暂无用户</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
