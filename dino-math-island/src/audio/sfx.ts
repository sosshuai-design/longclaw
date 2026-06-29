// Web Audio 音效（代码生成，无需音频文件）。开发文档 §10。

let ctx: AudioContext | null = null;
function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AC) ctx = new AC();
  }
  return ctx;
}

/** 浏览器要求用户手势后才能出声，首次交互时调用 */
export function resumeAudio(): void {
  const c = ac();
  if (c && c.state === "suspended") void c.resume();
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = "sine", gain = 0.18): void {
  const c = ac();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime + start);
  g.gain.setValueAtTime(0.0001, c.currentTime + start);
  g.gain.exponentialRampToValueAtTime(gain, c.currentTime + start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  osc.connect(g).connect(c.destination);
  osc.start(c.currentTime + start);
  osc.stop(c.currentTime + start + dur + 0.02);
}

export function playCorrect(): void {
  resumeAudio();
  tone(660, 0, 0.12, "triangle");
  tone(880, 0.1, 0.12, "triangle");
  tone(1175, 0.2, 0.2, "triangle");
}

export function playWrong(): void {
  resumeAudio();
  tone(380, 0, 0.14, "sine", 0.14);
  tone(300, 0.12, 0.18, "sine", 0.14);
}

export function playCoin(): void {
  resumeAudio();
  tone(988, 0, 0.08, "square", 0.12);
  tone(1319, 0.08, 0.12, "square", 0.12);
}

export function playWin(): void {
  resumeAudio();
  [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.14, 0.22, "triangle", 0.16));
}
