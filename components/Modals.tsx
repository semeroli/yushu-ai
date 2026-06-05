import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldCheck, Mail, Lock, User, ArrowRight } from 'lucide-react';
import { MotionDiv } from '../lib/motion';

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
        <MotionDiv initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-md bg-paper dark:bg-[#0f0f0f] border border-black/10 dark:border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl">
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
        {/* P1: 标注二维码为示意，防止用户误扫 */}
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

// P1 修复: 登录弹窗改为"即将上线"提示，不再收集表单数据
export const AuthModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => (
  <BaseModal isOpen={isOpen} onClose={onClose} title="语枢AI助手">
    <div className="space-y-4">
      <div className="text-center py-8">
        <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <User className="w-8 h-8 text-emerald-500" />
        </div>
        <h4 className="text-lg font-bold mb-2 text-link dark:text-white">登录功能即将上线</h4>
        <p className="text-sm text-link/50 dark:text-white/50 leading-relaxed max-w-xs mx-auto">
          我们正在开发安全可靠的用户认证系统，届时将支持账号密码和第三方登录。<br />
          当前可免费使用基础功能。
        </p>
      </div>
      <button
        onClick={onClose}
        className="w-full py-3 bg-emerald-600 dark:bg-emerald-500 text-white dark:text-black font-bold rounded-xl flex items-center justify-center gap-2 group mt-4 hover:bg-emerald-500 dark:hover:bg-emerald-400 transition-all"
      >
        暂不登录，继续使用 <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
      </button>
      <p className="text-center text-[10px] text-link/20 dark:text-white/20 px-6">
        如需提前体验登录功能，请联系 lablab@qq.com
      </p>
    </div>
  </BaseModal>
);
