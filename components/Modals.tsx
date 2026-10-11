import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldCheck, Mail, Lock, User, ArrowRight, Loader2 } from 'lucide-react';
import { MotionDiv } from '../lib/motion';
import { useAuth } from '../contexts/AuthContext';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const BaseModal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => (
  <AnimatePresence>
    {isOpen && (
      <div className="fixed inset-0 z-[110] flex items-center justify-center px-4">
        <MotionDiv initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm" />
        <MotionDiv initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-md bg-paper dark:bg-[#0f0f0f] border border-black/10 dark:border-white/10 rounded-2xl overflow-hidden shadow-2xl">
          <div className="p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold tracking-tight text-link dark:text-white serif-zh">{title}</h3>
              <button onClick={onClose} className="p-2 text-link/40 dark:text-white/40 hover:text-link dark:hover:text-white transition-colors"><X className="w-5 h-5" /></button>
            </div>
            {children}
          </div>
        </MotionDiv>
      </div>
    )}
  </AnimatePresence>
);

// P1 修复: 支付弹窗保留，但标注二维码为示意
export const PaymentModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => (
  <BaseModal isOpen={isOpen} onClose={onClose} title="升级专业版">
    <div className="space-y-6 text-center">
      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex gap-4 text-left">
        <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center shrink-0"><ShieldCheck className="w-6 h-6 text-white" /></div>
        <div>
          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">专业版 / ¥299/年</p>
          <p className="text-xs text-link/40 dark:text-white/40">解锁 Gemini 3 Pro 更多高级教学资源生成</p>
        </div>
      </div>
      <div className="flex flex-col items-center gap-4 py-4">
        <div className="relative p-3 bg-white rounded-2xl w-48 h-48 shadow-inner border border-black/5">
          <img
            src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=WeChatPay_Placeholder"
            alt="支付二维码（示意）"
            className="w-full h-full"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/5 rounded-2xl pointer-events-none">
            <span className="text-[10px] font-bold text-black/20 uppercase tracking-widest">示意二维码</span>
          </div>
        </div>
        <p className="text-xs text-link/30 dark:text-white/30 leading-relaxed">
          请使用微信扫描二维码，完成支付后<br />
          发送截图至 <span className="text-emerald-600 dark:text-emerald-400">lablab@qq.com</span><br />
          我们将在 2 个工作日内开通专业版
        </p>
      </div>
      <button onClick={onClose} className="w-full py-3 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-500 transition-all">
        我已完成支付，返回
      </button>
    </div>
  </BaseModal>
);

// 登录 / 注册 真实表单（接 /api/auth/*）
export const AuthModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { login, register } = useAuth();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setEmail('');
    setPassword('');
    setError('');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('请输入有效的邮箱地址');
      return;
    }
    if (password.length < 8) {
      setError('密码至少 8 位');
      return;
    }
    setBusy(true);
    try {
      if (tab === 'login') await login(email, password);
      else await register(email, password);
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败，请重试');
    } finally {
      setBusy(false);
    }
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="语枢AI 账号">
      <div className="space-y-4">
        <div className="flex rounded-xl bg-black/5 dark:bg-white/5 p-1">
          <button
            type="button"
            onClick={() => { setTab('login'); setError(''); }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${tab === 'login' ? 'bg-emerald-600 text-white' : 'text-link/60 dark:text-white/60'}`}
          >
            登录
          </button>
          <button
            type="button"
            onClick={() => { setTab('register'); setError(''); }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${tab === 'register' ? 'bg-emerald-600 text-white' : 'text-link/60 dark:text-white/60'}`}
          >
            注册
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div className="relative">
            <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-link/40 dark:text-white/40" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="邮箱"
              autoComplete="email"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] text-sm text-link dark:text-white outline-none focus:border-emerald-500/50"
            />
          </div>
          <div className="relative">
            <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-link/40 dark:text-white/40" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="密码（至少 8 位）"
              autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] text-sm text-link dark:text-white outline-none focus:border-emerald-500/50"
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-500 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : (tab === 'login' ? '登录' : '注册并登录')}
          </button>
        </form>

        <p className="text-center text-[10px] text-link/30 dark:text-white/30 px-6">
          登录后即可使用语枢AI助手全部功能
        </p>
      </div>
    </BaseModal>
  );
};
