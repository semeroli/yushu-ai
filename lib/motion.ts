import { motion, MotionProps } from 'framer-motion';
import React from 'react';

/**
 * 共享 MotionDiv 组件
 * P2 优化: 统一 framer-motion 的 motion.div 使用方式
 */
export const MotionDiv: React.FC<MotionProps & React.HTMLAttributes<HTMLDivElement>> = (props) => {
  const { children, ...rest } = props;
  return <motion.div {...rest}>{children}</motion.div>;
};
