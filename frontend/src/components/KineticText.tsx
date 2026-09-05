'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface KineticTextProps {
  text: string;
  className?: string;
  delay?: number;
  hoverEffect?: boolean;
}

export default function KineticText({ text, className = '', delay = 0, hoverEffect = true }: KineticTextProps) {
  const [isHovered, setIsHovered] = useState(false);
  const letters = text.split('');

  // Initial reveal animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.03, // staggered delay per letter
        delayChildren: delay,
      },
    },
  };

  const letterVariants = {
    hidden: { y: '100%', opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: 'spring' as const,
        damping: 12,
        stiffness: 100,
      },
    },
  };

  return (
    <motion.span
      className={`inline-flex overflow-hidden ${className}`}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      onMouseEnter={() => hoverEffect && setIsHovered(true)}
      onMouseLeave={() => hoverEffect && setIsHovered(false)}
    >
      {letters.map((char, index) => (
        <motion.span
          key={index}
          variants={letterVariants}
          animate={isHovered && hoverEffect ? {
            y: [0, -6, 0],
            transition: { 
              duration: 0.3, 
              delay: index * 0.02, 
              ease: "easeInOut" 
            }
          } : { y: 0 }}
          style={{ display: 'inline-block', whiteSpace: char === ' ' ? 'pre' : 'normal' }}
        >
          {char}
        </motion.span>
      ))}
    </motion.span>
  );
}
