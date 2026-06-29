import { useEffect, useRef } from "react";

const COLORS = ["#FF8A5B", "#4FB286", "#5B8DEF", "#C173E0", "#FFB531", "#2FB36B"];

interface P {
  x: number; y: number; vx: number; vy: number; g: number;
  size: number; color: string; rot: number; vr: number; life: number;
}

/** 一次性撒花。挂载即爆发，约 2 秒后自动停。 */
export default function Confetti({ amount = 140 }: { amount?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = (canvas.width = window.innerWidth);
    const H = (canvas.height = window.innerHeight);
    const ox = W / 2;
    const oy = H * 0.28;
    let particles: P[] = Array.from({ length: amount }, () => ({
      x: ox, y: oy,
      vx: (Math.random() - 0.5) * 10,
      vy: Math.random() * -10 - 3,
      g: 0.22 + Math.random() * 0.12,
      size: 7 + Math.random() * 9,
      color: COLORS[(Math.random() * COLORS.length) | 0],
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      life: 90 + Math.random() * 40,
    }));

    let raf = 0;
    const loop = () => {
      ctx.clearRect(0, 0, W, H);
      particles = particles.filter((p) => p.life > 0 && p.y < H + 40);
      for (const p of particles) {
        p.vy += p.g; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life--;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }
      if (particles.length) raf = requestAnimationFrame(loop);
      else ctx.clearRect(0, 0, W, H);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [amount]);

  return <canvas ref={ref} className="fixed inset-0 pointer-events-none z-50" aria-hidden />;
}
