import React, { useEffect, useState } from 'react';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { FeatureGrid } from './components/FeatureGrid';
import { AIPortal } from './components/AIPortal';
import { Admin } from './components/Admin';
import { Blog } from './components/Blog';
import { BlogPost } from './components/BlogPost';
import { BlogAdmin } from './components/BlogAdmin';
import { Footer } from './components/Footer';
import { PaymentModal, AuthModal } from './components/Modals';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';

type View = 'home' | 'blog' | 'post' | 'admin';

function AppContent() {
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [view, setView] = useState<View>('home');
  const [blogSlug, setBlogSlug] = useState<string | null>(null);

  // 基于地址栏哈希的页面切换：#blog 列表 / #post/<slug> 文章 / #admin 后台
  useEffect(() => {
    const onHash = () => {
      const hash = window.location.hash || '';
      if (hash.startsWith('#blog')) {
        setView('blog');
        setBlogSlug(null);
        window.scrollTo(0, 0);
      } else if (hash.startsWith('#post/')) {
        const slug = decodeURIComponent(hash.slice('#post/'.length));
        setBlogSlug(slug);
        setView('post');
        window.scrollTo(0, 0);
      } else if (hash.startsWith('#admin')) {
        setView('admin');
        window.scrollTo(0, 0);
      } else if (hash === '' || hash === '#') {
        // 无锚点：保持当前 view（品牌 logo 已单独处理回首页）
      } else {
        // 首页区块锚点（#features 等）：先回首页再平滑滚动
        setView('home');
        const id = hash.slice(1);
        setTimeout(() => {
          const el = document.getElementById(id);
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }, 60);
      }
    };
    window.addEventListener('hashchange', onHash);
    onHash();
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // 拦截所有站内 # 链接：视图类哈希交给 hashchange，区块锚点做平滑滚动
  useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const a = target.closest('a');
      if (!a) return;
      const href = a.getAttribute('href');
      if (!href || !href.startsWith('#')) return;
      if (href.startsWith('#blog') || href.startsWith('#post/') || href.startsWith('#admin')) {
        e.preventDefault();
        window.location.hash = href;
        return;
      }
      e.preventDefault();
      const id = href.slice(1);
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    };
    document.addEventListener('click', handleAnchorClick);
    return () => document.removeEventListener('click', handleAnchorClick);
  }, []);

  const goHome = () => {
    window.location.hash = '';
    setView('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const partners = [
    { name: '智慧树教育', url: 'https://www.smartedu.cn/' },
    { name: '国家教育平台', url: 'https://jc.pep.com.cn/' },
    { name: '基础教育资源平台', url: 'https://basic.smartedu.cn/' },
    { name: '北京师范大学', url: 'http://www.bnu.edu.cn/' },
    { name: '教育资源网', url: 'https://www.cnki.net/' },
  ];

  return (
    <div className="min-h-screen bg-paper dark:bg-[#050505] text-link dark:text-white transition-colors duration-300 selection:bg-emerald-500/30">
      <Navbar onAuthClick={() => setIsAuthOpen(true)} onHome={goHome} />

      <main>
        {view === 'home' && (
          <>
            <Hero onStartClick={() => setIsAuthOpen(true)} onLearnMore={() => (window.location.hash = '#blog')} />

            <section className="py-12 border-y border-black/5 dark:border-white/5 bg-black/[0.01] dark:bg-white/[0.01]">
              <div className="max-w-7xl mx-auto px-6">
                <p className="text-center text-xs uppercase tracking-[0.2em] text-black/20 dark:text-white/20 font-bold mb-10">合作院校与平台 500+ 教育机构信赖之选</p>
                <div className="flex flex-wrap justify-center items-center gap-12 md:gap-20">
                  {partners.map((partner) => (
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

            <AIPortal onRequireAuth={() => setIsAuthOpen(true)} />
          </>
        )}

        {view === 'blog' && <Blog />}
        {view === 'post' && <BlogPost slug={blogSlug} />}
        {view === 'admin' && (
          <>
            <Admin />
            <BlogAdmin />
          </>
        )}
      </main>

      <Footer />

      <PaymentModal isOpen={isPaymentOpen} onClose={() => setIsPaymentOpen(false)} />
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
