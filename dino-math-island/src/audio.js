// 声音：中文语音播报（speechSynthesis）+ 简单音效（WebAudio）。
// 全部都做了能力检测与降级——没有语音引擎也不影响玩。

const STORE_KEY = "dino-math-muted";
let muted = localStorage.getItem(STORE_KEY) === "1";

let audioCtx = null;
function ctx() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  return audioCtx;
}

export function isMuted() {
  return muted;
}

export function setMuted(value) {
  muted = !!value;
  localStorage.setItem(STORE_KEY, muted ? "1" : "0");
  if (muted) cancelSpeech();
}

export function toggleMuted() {
  setMuted(!muted);
  return muted;
}

// ---------- 语音播报 ----------
let zhVoice = null;
function loadVoice() {
  if (!("speechSynthesis" in window)) return;
  const voices = window.speechSynthesis.getVoices();
  zhVoice =
    voices.find((v) => /zh[-_]CN/i.test(v.lang)) ||
    voices.find((v) => /^zh/i.test(v.lang)) ||
    null;
}
if ("speechSynthesis" in window) {
  loadVoice();
  window.speechSynthesis.onvoiceschanged = loadVoice;
}

export function cancelSpeech() {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

/** 播报一段中文文字（静音时跳过） */
export function speak(text) {
  if (muted || !text || !("speechSynthesis" in window)) return;
  try {
    cancelSpeech();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "zh-CN";
    if (zhVoice) u.voice = zhVoice;
    u.rate = 0.95;
    u.pitch = 1.1;
    window.speechSynthesis.speak(u);
  } catch (_) {
    /* 忽略：语音不可用不影响游戏 */
  }
}

// ---------- 音效 ----------
function tone(freq, start, dur, type = "sine", gain = 0.18) {
  const c = ctx();
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

/** 答对：上行三连音 */
export function playCorrect() {
  if (muted) return;
  resume();
  tone(660, 0, 0.12, "triangle");
  tone(880, 0.1, 0.12, "triangle");
  tone(1175, 0.2, 0.2, "triangle");
}

/** 答错：温和的下行两音（不吓到小朋友） */
export function playWrong() {
  if (muted) return;
  resume();
  tone(380, 0, 0.14, "sine", 0.14);
  tone(300, 0.12, 0.18, "sine", 0.14);
}

/** 点击/计数：轻快一声 */
export function playPop() {
  if (muted) return;
  resume();
  tone(520, 0, 0.08, "square", 0.1);
}

/** 通关：欢快小旋律 */
export function playFanfare() {
  if (muted) return;
  resume();
  const notes = [523, 659, 784, 1047];
  notes.forEach((f, i) => tone(f, i * 0.14, 0.22, "triangle", 0.16));
}

// 浏览器要求用户手势后才能出声，首次交互时调用
export function resume() {
  const c = ctx();
  if (c && c.state === "suspended") c.resume();
}
