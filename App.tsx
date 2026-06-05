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
