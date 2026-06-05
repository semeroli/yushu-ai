import React from 'react';
import { BookOpen, Scroll, PenTool, ClipboardCheck, Sparkles, Map } from 'lucide-react';
import { MotionDiv } from '../lib/motion';

const features = [
  {
    title: "古诗文鉴赏助手",
    description: "深度解读诗词意境、逐句赏析古文、辅助理解修辞手法，涵盖中小学必背古诗文全解析。",
    icon: <Scroll className="w-6 h-6 text-orange-400" />,
    className: "md:col-span-2"
  },
  {
    title: "作文批改评改",
    description: "智能分析文章结构和语言表达，提供具体的修改建议和优秀范文对比参考。",
    icon: <PenTool className="w-6 h-6 text-pink-400" />,
    className: "md:col-span-1"
  },
  {
    title: "智能教案生成器",
    description: "AI 驱动的个性化教学方案建议，根据课标自动生成结构化的教案，一键导出多种格式。",
    icon: <Map className="w-6 h-6 text-blue-400" />,
    className: "md:col-span-1"
  },
  {
    title: "教学成果评估",
    description: "多维度智能评估学生学习成果和知识掌握情况，生成个性化学习路径建议。",
    icon: <ClipboardCheck className="w-6 h-6 text-emerald-400" />,
    className: "md:col-span-2"
  }
];

export const FeatureGrid: React.FC = () => {
  return (
    <section id="features" className="py-24 px-6 bg-paper dark:bg-[#080808]">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold mb-4 serif-zh">强大的 <span className="text-emerald-600 dark:text-emerald-500">AI助手功能</span></h2>
          <p className="text-link/60 dark:text-white/60 max-w-2xl mx-auto">语枢专为语文教育场景打造，覆盖课前备课、课中辅助、课后评估全流程的AI智能工具。</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((feature, idx) => (
            <MotionDiv
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className={`p-8 rounded-3xl border border-black/5 dark:border-white/5 bg-white/50 dark:bg-white/[0.02] hover:bg-white/80 dark:hover:bg-white/[0.04] transition-all group shadow-sm dark:shadow-none ${feature.className}`}
            >
              <div className="w-12 h-12 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold mb-3 serif-zh">{feature.title}</h3>
              <p className="text-link/50 dark:text-white/50 leading-relaxed">{feature.description}</p>
            </MotionDiv>
          ))}
        </div>
      </div>
    </section>
  );
};
