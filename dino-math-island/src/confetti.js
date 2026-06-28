// 极简彩带：一次性 canvas 粒子爆发，用于答对/通关庆祝。

const COLORS = ["#ff9f43", "#56c271", "#5aa9e6", "#ff6f91", "#ffc83d", "#c780e8"];

let canvas, ctx, raf, particles = [];

function ensure() {
  if (canvas) return;
  canvas = document.getElementById("confetti");
  if (!canvas) return;
  ctx = canvas.getContext("2d");
  resize();
  window.addEventListener("resize", resize);
}

function resize() {
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

/**
 * 触发一次彩带。
 * @param {number} amount 粒子数量
 * @param {{x:number,y:number}} origin 0~1 比例坐标，默认顶部中间
 */
export function burst(amount = 80, origin = { x: 0.5, y: 0.3 }) {
  ensure();
  if (!ctx) return;
  const ox = origin.x * canvas.width;
  const oy = origin.y * canvas.height;
  for (let i = 0; i < amount; i++) {
    particles.push({
      x: ox,
      y: oy,
      vx: (Math.random() - 0.5) * 9,
      vy: Math.random() * -9 - 3,
      g: 0.22 + Math.random() * 0.12,
      size: 6 + Math.random() * 8,
      color: COLORS[(Math.random() * COLORS.length) | 0],
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      life: 90 + Math.random() * 40,
    });
  }
  if (!raf) loop();
}

function loop() {
  raf = requestAnimationFrame(loop);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  particles = particles.filter((p) => p.life > 0 && p.y < canvas.height + 30);
  for (const p of particles) {
    p.vy += p.g;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    p.life--;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
    ctx.restore();
  }
  if (particles.length === 0) {
    cancelAnimationFrame(raf);
    raf = null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}
