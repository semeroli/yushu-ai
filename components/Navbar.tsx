import React, { useState, useEffect, useRef } from 'react';
import { Menu, X, Library, Sun, Moon, User as UserIcon, LogOut, ShieldCheck } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { useTheme } from '../contexts/ThemeContext';
import { MotionDiv } from '../lib/motion';
import { useAuth } from '../contexts/AuthContext';

interface NavbarProps {
  onAuthClick: () => void;
  onHome: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onAuthClick, onHome }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const navItems = [
    { label: '功能特性', href: '#features' },
    { label: '助手体验', href: '#experience' },
    { label: '方案定价', href: '#pricing' },
    { label: '博客', href: '#blog' },
  ];

  const handleLogout = async () => {
    await logout();
    setMenuOpen(false);
  };

  return (
    <nav className={cn(
      "fixed top-0 left-0 right-0 z-[100] transition-all duration-300 px-6 py-4",
      isScrolled
        ? "bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-black/5 dark:border-white/5 py-3"
        : "bg-transparent"
    )}>
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2 group cursor-pointer" onClick={onHome}>
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center group-hover:rotate-12 transition-transform">
            <Library className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-link dark:text-white">语枢<span className="text-emerald-500">AI</span></span>
        </div>

        <div className="hidden md:flex items-center gap-8">
          {navItems.map((item) => (
            <a key={item.label} href={item.href} className="text-sm font-medium text-link/70 dark:text-white/70 hover:text-link dark:hover:text-white transition-colors">{item.label}</a>
          ))}

          <button
            onClick={toggleTheme}
            className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-link/70 dark:text-white/70"
            title={theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          {user ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-600/10 text-emerald-700 dark:text-emerald-300 text-sm font-medium hover:bg-emerald-600/20 transition-colors max-w-[200px]"
              >
                <UserIcon className="w-4 h-4 shrink-0" />
                <span className="truncate">{user.email}</span>
              </button>
              <AnimatePresence>
                {menuOpen && (
                  <MotionDiv
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-zinc-900 border border-black/10 dark:border-white/10 rounded-xl shadow-lg overflow-hidden z-50"
                  >
                    {user.role === 'admin' && (
                      <a
                        href="#admin"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-link dark:text-white/80 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                      >
                        <ShieldCheck className="w-4 h-4 text-emerald-500" /> 管理后台
                      </a>
                    )}
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <LogOut className="w-4 h-4" /> 退出登录
                    </button>
                  </MotionDiv>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <button
              onClick={onAuthClick}
              className="px-5 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-full hover:bg-emerald-500 transition-all active:scale-95"
            >
              立即注册
            </button>
          )}
        </div>

        <div className="flex items-center gap-4 md:hidden">
          <button
            onClick={toggleTheme}
            className="p-2 text-link/70 dark:text-white/70"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <button className="p-2 text-link/70 dark:text-white/70" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <MotionDiv
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="absolute top-full left-0 right-0 bg-paper/95 dark:bg-black/95 backdrop-blur-xl border-b border-black/10 dark:border-white/10 flex flex-col p-6 gap-6 md:hidden overflow-hidden"
          >
            {navItems.map((item) => (
              <a key={item.label} href={item.href} className="text-lg font-medium text-link/70 dark:text-white/70" onClick={() => setIsMobileMenuOpen(false)}>{item.label}</a>
            ))}
            {user ? (
              <>
                {user.role === 'admin' && (
                  <a href="#admin" className="text-lg font-medium text-emerald-600 dark:text-emerald-400" onClick={() => setIsMobileMenuOpen(false)}>管理后台</a>
                )}
                <button onClick={() => { setIsMobileMenuOpen(false); handleLogout(); }} className="w-full py-3 bg-red-500/10 text-red-500 font-semibold rounded-xl">退出登录（{user.email}）</button>
              </>
            ) : (
              <button onClick={() => { setIsMobileMenuOpen(false); onAuthClick(); }} className="w-full py-3 bg-emerald-600 text-white font-semibold rounded-xl">立即注册</button>
            )}
          </MotionDiv>
        )}
      </AnimatePresence>
    </nav>
  );
};
