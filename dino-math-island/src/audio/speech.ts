// 中文 TTS 封装（Web Speech API / speechSynthesis）。开发文档 §10。
// 无中文语音时静默降级；正式版可在此接真人配音。

let zhVoice: SpeechSynthesisVoice | null = null;

function refreshVoice(): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const voices = window.speechSynthesis.getVoices();
  zhVoice =
    voices.find((v) => /zh[-_]CN/i.test(v.lang)) ||
    voices.find((v) => /^zh/i.test(v.lang)) ||
    null;
}

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  refreshVoice();
  window.speechSynthesis.onvoiceschanged = refreshVoice;
}

export function cancelSpeech(): void {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

/**
 * 朗读中文文本。
 * @param text 文本
 * @param enabled Settings.sound，false 时静音
 */
export function speak(text: string, enabled = true): void {
  if (!enabled || !text) return;
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    cancelSpeech();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "zh-CN";
    if (zhVoice) u.voice = zhVoice;
    u.rate = 0.95;
    u.pitch = 1.05;
    window.speechSynthesis.speak(u);
  } catch {
    /* 语音不可用不影响游戏 */
  }
}
