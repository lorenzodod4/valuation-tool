"use client";

import React, { useEffect, useRef } from 'react';

export const InteractiveBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const mouse = { x: -1000, y: -1000 };

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const onMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMouseMove);
    resize();

    // Grid settings
    const gap = 35;
    const dotRadius = 1;
    const proximity = 120; // How close mouse needs to be to affect dots

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Determine colors from CSS variables
      const dotColor = getComputedStyle(document.documentElement)
        .getPropertyValue('--border-default') || '#cbd5e1';
      
      ctx.fillStyle = dotColor;
      ctx.globalAlpha = 0.4;

      const rows = Math.ceil(canvas.height / gap);
      const cols = Math.ceil(canvas.width / gap);

      for (let i = 0; i <= rows; i++) {
        for (let j = 0; j <= cols; j++) {
          const defaultX = j * gap;
          const defaultY = i * gap;

          const dx = mouse.x - defaultX;
          const dy = mouse.y - defaultY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          let drawX = defaultX;
          let drawY = defaultY;

          // Simple "push" logic: move dots slightly away from mouse
          if (dist < proximity) {
            const force = (proximity - dist) / proximity;
            const moveX = dx * force * 0.4;
            const moveY = dy * force * 0.4;
            drawX -= moveX;
            drawY -= moveY;
            ctx.globalAlpha = 0.8; // Brighten dots near mouse
          } else {
            ctx.globalAlpha = 0.3;
          }

          ctx.beginPath();
          ctx.arc(drawX, drawY, dotRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 -z-10 pointer-events-none"
    />
  );
};
