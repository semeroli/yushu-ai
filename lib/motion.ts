// P2 修复: 统一导出 MotionDiv，避免每个组件重复声明
// 解决 framer-motion + TypeScript 的 'initial' property 类型错误
import { motion } from 'framer-motion';

export const MotionDiv = motion.div as any;
