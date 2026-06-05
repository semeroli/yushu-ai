import React, { useEffect, useState } from 'react';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { FeatureGrid } from './components/FeatureGrid';
import { AIPortal } from './components/AIPortal';
import { Footer } from './components/Footer';
import { PaymentModal, AuthModal } from './components/Modals';
import { ThemeProvider } from './contexts/ThemeContext';

function AppContent() {
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'A' && target.getAttribute('href')?.startsWith('#')) {
        e.preventDefault();
        const id = target.getAttribute('href')?.substring(1);
        const element = document.getElementById(id || '');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }
    };
    document.addEventListener('click', handleAnchorClick);
    return () => document.removeEventListener('click', handleAnchorClick);
  }, []);

  const partners = [
    { name: '智慧树教育', url: 'https://www.smartedu.cn/' },
    { name: '国家教育平台', url: 'https://jc.pep.com.cn/' },
    { name: '基础教育资源平台', url: 'https://basic.smartedu.cn/' },
    { name: '北京师范大学', url: 'http://www.bnu.edu.cn/' },
    { name: '教育资源网', url: 'https://www.cnki.net/' }
  ];

  return (
    <div className="min-h-screen bg-paper dark:bg-[#050505] text-link dark:text-white transition-colors duration-300 selection:bg-emerald-500/30">
      {/* 导航栏与认证弹窗 */}
      <Navbar onAuthClick={() => setIsAuthOpen(true)} />
      
      <main>
        {/* Hero区域与认证弹窗 */}
        <Hero onStartClick={() => setIsAuthOpen(true)} />
        
        <section className="py-12 border-y border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01]">
          <div className="max-w-7xl mx-auto px-6">
            <p className="text-center text-xs uppercase tracking-[0.2em] text-black/20 dark:text-white/20 font-bold mb-10">合作院校与平台 500+ 教育机构信赖之选</p>
            <div className="flex flex-wrap justify-center items-center gap-12 md:gap-20">
              {partners.map(partner => (
                <a 
                  key={partner.name} 
                  href={partner.url}
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xl font-bold tracking-tight opacity-30 grayscale contrast-125 hover:opacity-100 hover:grayscale-0 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all duration-300 cursor-pointer"
                  title={`访问 ${partner.name} 官网`}
                >
                  {partner.name}
                </a>
              ))}
            </div>
          </div>
        </section>

        <FeatureGrid />
        
        <AIPortal />

        <section id="pricing" className="py-24 px-6">
          <div className="max-w-5xl mx-auto text-center">
            <h2 className="text-3xl md:text-5xl font-bold mb-16 serif-zh">适合教学场景的灵活方案</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {/* 免费版 */}
              <div className="p-8 rounded-3xl border border-black/5 dark:border-white/5 bg-white/50 dark:bg-white/[0.02] flex flex-col group hover:border-black/10 dark:hover:border-white/10 transition-all shadow-sm">
                <h3 className="text-lg font-semibold mb-2">基础版免费</h3>
                <div className="text-3xl font-bold mb-6">免费</div>
                <ul className="space-y-3 mb-8 text-left text-sm text-black/40 dark:text-white/40 flex-1">
                  <li>✅ 基础古诗文鉴赏</li>
                  <li>✅ 通用教案模板</li>
                  <li>✅ 简单作文评改</li>
                </ul>
                <button onClick={() => setIsAuthOpen(true)} className="w-full py-3 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 transition-all text-sm font-bold mt-auto">
                  立即注册
                </button>
              </div>
              
              {/* 专业版 */}
              <div className="p-8 rounded-3xl border border-emerald-500/30 bg-emerald-500/[0.05] flex flex-col relative scale-105 shadow-xl shadow-emerald-900/10">
                <div className="absolute top-0 right-0 bg-emerald-600 dark:bg-emerald-500 text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase text-white">最受欢迎</div>
                <h3 className="text-lg font-semibold mb-2">专业版年费</h3>
                <div className="text-3xl font-bold mb-6">¥299<span className="text-sm font-normal text-black/40 dark:text-white/40">/年</span></div>
                <ul className="space-y-3 mb-8 text-left text-sm text-black/70 dark:text-white/70 font-medium flex-1">
                  <li>➤ 全部功能解锁所有模块</li>
                  <li>➤ 高级/专业模式深度定制</li>
                  <li>➤ 批量导出专属格式导出</li>
                </ul>
                <button onClick={() => setIsPaymentOpen(true)} className="w-full py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 transition-all font-bold shadow-lg shadow-emerald-600/20">
                  立即订阅
                </button>
              </div>
              
              {/* 机构版 */}
              <div className="p-8 rounded-3xl border border-black/5 dark:border-white/5 bg-white/50 dark:bg-white/[0.02] flex flex-col group hover:border-black/10 dark:hover:border-white/10 transition-all shadow-sm">
                <h3 className="text-lg font-semibold mb-2">机构版年费</h3>
                <div className="text-3xl font-bold mb-6">面议</div>
                <ul className="space-y-3 mb-8 text-left text-sm text-black/40 dark:text-white/40 flex-1">
                  <li>✦ 多账户管理团队协作</li>
                  <li>✦ 定制化功能专属需求开发</li>
                  <li>✦ 优先技术支持专人服务</li>
                </ul>
                {/* P1 修复: 用 <a> 替代 window.location.href */}
                <a
                  href="mailto:lablab@qq.com"
                  className="w-full py-3 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 transition-all text-sm font-bold mt-auto block text-center"
                >
                  联系我们
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="py-24 px-6">
          <div className="max-w-5xl mx-auto rounded-[3rem] p-12 md:p-20 bg-gradient-to-br from-emerald-900/40 to-teal-900/40 border border-white/10 text-center relative overflow-hidden group">
            <h2 className="text-4xl md:text-6xl font-extrabold mb-8 relative z-10 text-white">释放语文教育潜力</h2>
            <button onClick={() => setIsAuthOpen(true)} className="px-10 py-5 bg-white text-black font-black rounded-2xl hover:scale-105 transition-all text-lg shadow-2xl relative z-10">
              立即开始免费使用
            </button>
          </div>
        </section>
      </main>

      <Footer />
      
      {/* 弹窗 */}
      <PaymentModal isOpen={isPaymentOpen} onClose={() => setIsPaymentOpen(false)} />
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
