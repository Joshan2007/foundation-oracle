"use client";
import React, { useState, useEffect, useCallback } from "react";

const GLYPHS = "01X_#$@&%<>[]{}*+=~▓▒░";

interface DecryptedTextProps {
  text: string;
  speed?: number;
  className?: string;
  /** Set to true to re-trigger the scramble effect */
  trigger?: boolean;
}

export const DecryptedText: React.FC<DecryptedTextProps> = ({
  text,
  speed = 35,
  className = "",
  trigger,
}) => {
  const [displayText, setDisplayText] = useState(text);
  const [isDecoding, setIsDecoding] = useState(true);

  const runScramble = useCallback(() => {
    setIsDecoding(true);
    let iteration = 0;

    const interval = setInterval(() => {
      setDisplayText(
        text
          .split("")
          .map((char, index) => {
            if (char === " ") return " ";
            if (index < iteration) return text[index];
            return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
          })
          .join("")
      );

      if (iteration >= text.length) {
        clearInterval(interval);
        setIsDecoding(false);
      }
      iteration += 0.5;
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed]);

  useEffect(() => {
    const cleanup = runScramble();
    return cleanup;
  }, [text, trigger, runScramble]);

  return (
    <span
      className={`font-mono tracking-wider ${className} ${
        isDecoding ? "text-cyan-300/90" : ""
      }`}
      style={{
        transition: "color 0.3s ease-out",
      }}
    >
      {displayText}
    </span>
  );
};

export default DecryptedText;
