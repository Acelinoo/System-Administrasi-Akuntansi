"use client";

import React, { useEffect, useRef } from "react";
import gsap from "gsap";

interface MotionProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Lightweight Page Entry Motion
 * Fades in content with subtle 6px vertical glide (0.3s)
 * Respects prefers-reduced-motion
 */
export function PageMotion({ children, className = "", style }: MotionProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    gsap.fromTo(
      containerRef.current,
      { opacity: 0, y: 6 },
      {
        opacity: 1,
        y: 0,
        duration: 0.3,
        ease: "power2.out",
        clearProps: "all",
      }
    );
  }, []);

  return (
    <div ref={containerRef} className={className} style={style}>
      {children}
    </div>
  );
}

/**
 * Metric Cards Stagger Motion
 * Staggers children cards by 0.05s for a clean financial dashboard reveal
 */
export function StaggerCards({ children, className = "", style }: MotionProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    gsap.fromTo(
      containerRef.current.children,
      { opacity: 0, y: 8 },
      {
        opacity: 1,
        y: 0,
        duration: 0.3,
        stagger: 0.05,
        ease: "power2.out",
        clearProps: "all",
      }
    );
  }, []);

  return (
    <div ref={containerRef} className={className} style={style}>
      {children}
    </div>
  );
}
