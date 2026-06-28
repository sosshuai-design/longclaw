// 恐龙数学岛 · 应用入口
// 负责：屏幕路由（地图 / 答题 / 奖励）、答题流程与反馈、家长设置。

import { el, clear, pick } from "./utils.js";
import { loadCurriculum, buildSession, starsFor } from "./engine.js";
import * as audio from "./audio.js";
import * as store from "./storage.js";
import { burst } from "./confetti.js";

const appEl = document.getElementById("app");
const homeBtn = document.getElementById("homeBtn");
const soundBtn = document.getElementById("soundBtn");
const brandEl = document.querySelector(".brand");

let curriculum = null; // { meta, islands }

// ---------------- 启动 ----------------
init();

async function init() {
  wireTopbar();
  showLoading();
  try {
    curriculum = await loadCurriculum();
    document.title = `${curriculum.meta.title} · ${curriculum.meta.titleEn || ""}`.trim();
    showMap();
  } catch (err) {
    showError(err);
  }
}

function wireTopbar() {
  refreshSoundIcon();
  soundBtn.addEventListener("click", () => {
    audio.resume();
    audio.toggleMuted();
    refreshSoundIcon();
    if (!audio.isMuted()) audio.speak("声音打开啦");
  });
  homeBtn.addEventListener("click", () => {
    audio.resume();
    showMap();
  });
  // 家长设置：长按标题 0.8 秒打开（避免小朋友误触）
  let pressTimer = null;
  const startPress = () => {
    pressTimer = setTimeout(openParentSheet, 800);
  };
  const cancelPress = () => clearTimeout(pressTimer);
  brandEl.addEventListener("pointerdown", startPress);
  brandEl.addEventListener("pointerup", cancelPress);
  brandEl.addEventListener("pointerleave", cancelPress);
}

function refreshSoundIcon() {
  const muted = audio.isMuted();
  soundBtn.textContent = muted ? "🔇" : "🔊";
  soundBtn.classList.toggle("muted", muted);
}

// ---------------- 地图（首页）----------------
function showMap() {
  homeBtn.hidden = true;
  const wrap = clear(appEl);

  wrap.appendChild(el("h1", { class: "map-title", text: curriculum.meta.title }));
  wrap.appendChild(
    el("p", { class: "map-subtitle", text: `⭐ 已收集 ${store.totalStars()} 颗星星` })
  );

  const grid = el("div", { class: "island-grid" });
  for (const island of curriculum.islands) {
    grid.appendChild(islandCard(island));
  }
  wrap.appendChild(grid);
}

function islandCard(island) {
  const stars = store.getStars(island.id);
  const card = el("button", { class: "island-card", type: "button" });
  card.style.setProperty("--c", island.color || "#ff9f43");
  card.appendChild(el("div", { class: "island-emoji", text: island.emoji || "🦕" }));
  card.appendChild(el("div", { class: "island-name", text: island.title }));
  card.appendChild(el("div", { class: "island-sub", text: island.subtitle || "" }));
  card.appendChild(starRow(stars, 3, "island-stars"));
  card.addEventListener("click", () => {
    audio.resume();
    startIsland(island);
  });
  return card;
}

function starRow(filled, total, cls) {
  const row = el("div", { class: cls });
  for (let i = 0; i < total; i++) {
    row.appendChild(
      el("span", { class: i < filled ? "star-on" : "star-off", text: "★" })
    );
  }
  return row;
}

// ---------------- 答题 ----------------
function startIsland(island) {
  const session = buildSession(island, curriculum.meta);
  let idx = 0;
  let firstTryCorrect = 0;

  homeBtn.hidden = false;

  // 搭好答题屏骨架
  const root = clear(appEl);
  const play = el("div", { class: "play" });
  const dots = el("div", { class: "progress-dots" });
  const mascotRow = el("div", { class: "mascot-row" });
  const mascot = el("div", { class: "mascot", text: "🦕" });
  const bubble = el("div", { class: "bubble", text: island.intro || "我们开始吧！" });
  mascotRow.append(mascot, bubble);
  const stageEl = el("div", { class: "stage" });
  const choicesEl = el("div", { class: "choices cols-3" });
  play.append(dots, mascotRow, stageEl, choicesEl);
  root.appendChild(play);

  for (let i = 0; i < session.length; i++) dots.appendChild(el("span", { class: "dot" }));

  // 先念一遍小岛引导语，再出第一题
  audio.speak(island.intro || island.title);

  const setBubble = (text) => {
    bubble.textContent = text;
  };

  function paintDots() {
    [...dots.children].forEach((d, i) => {
      d.className = "dot" + (i < idx ? " done" : i === idx ? " current" : "");
    });
  }

  function renderQuestion() {
    paintDots();
    clear(stageEl);
    clear(choicesEl);
    let wrongThisQ = false;
    let locked = false;
    const { activity, question } = session[idx];

    const ui = {
      setPrompt(text) {
        setBubble(text);
        audio.speak(text);
      },
      answer(isCorrect, btn) {
        if (locked) return;
        audio.resume();
        if (isCorrect) {
          locked = true;
          btn.classList.add("correct");
          [...choicesEl.querySelectorAll("button")].forEach((b) => (b.disabled = true));
          audio.playCorrect();
          burst(90, { x: 0.5, y: 0.35 });
          if (!wrongThisQ) firstTryCorrect++;
          const praise = pick(["太棒了！", "你真聪明！", "完全正确！", "好厉害！"]);
          setBubble(praise);
          audio.speak(praise);
          mascot.textContent = "🥳";
          setTimeout(advance, 1300);
        } else {
          wrongThisQ = true;
          btn.classList.add("wrong");
          audio.playWrong();
          audio.speak(pick(["再试一试", "换一个试试", "加油"]));
          setTimeout(() => btn.classList.remove("wrong"), 500);
        }
      },
    };

    mascot.textContent = "🦕";
    activity.render(question, { stageEl, choicesEl, ui });
  }

  function advance() {
    idx++;
    if (idx < session.length) renderQuestion();
    else finish();
  }

  function finish() {
    const stars = starsFor(firstTryCorrect, curriculum.meta);
    store.recordStars(island.id, stars);
    showReward(island, stars, firstTryCorrect, session.length);
  }

  renderQuestion();
}

// ---------------- 奖励屏 ----------------
function showReward(island, stars, correct, total) {
  homeBtn.hidden = false;
  const root = clear(appEl);
  const view = el("div", { class: "reward" });

  view.appendChild(el("div", { class: "reward-mascot", text: stars >= 2 ? "🦖" : "🦕" }));
  view.appendChild(el("div", { class: "reward-title", text: "闯关成功！" }));

  const starsEl = el("div", { class: "reward-stars" });
  for (let i = 0; i < 3; i++) {
    starsEl.appendChild(
      el("span", {
        class: (i < stars ? "star-on" : "star-off") + " star-pop",
        text: "★",
      })
    );
  }
  view.appendChild(starsEl);
  view.appendChild(
    el("p", { class: "map-subtitle", text: `一次答对 ${correct} / ${total} 题` })
  );

  const row = el("div", { class: "btn-row" });
  const again = el("button", { class: "big-btn", type: "button", text: "再玩一次 🔁" });
  again.addEventListener("click", () => {
    audio.resume();
    startIsland(island);
  });
  const back = el("button", { class: "big-btn secondary", type: "button", text: "回到地图 🗺️" });
  back.addEventListener("click", () => {
    audio.resume();
    showMap();
  });
  row.append(again, back);
  view.appendChild(row);
  root.appendChild(view);

  audio.playFanfare();
  burst(150, { x: 0.5, y: 0.25 });
  const msg = stars === 3 ? "满分！太厉害啦！" : stars >= 1 ? "做得真好！" : "继续加油哦！";
  setBubbleSpeak(msg);
}

function setBubbleSpeak(text) {
  audio.speak(text);
}

// ---------------- 家长设置 ----------------
function openParentSheet() {
  const backdrop = el("div", { class: "sheet-backdrop" });
  const sheet = el("div", { class: "sheet" });
  sheet.appendChild(el("h2", { text: "家长设置" }));
  sheet.appendChild(
    el("p", { text: `${curriculum?.meta?.title || "恐龙数学岛"} v${curriculum?.meta?.version || "1.0"} · 累计 ${store.totalStars()} ⭐` })
  );

  const row = el("div", { class: "btn-row" });
  const soundToggle = el("button", {
    class: "big-btn secondary",
    type: "button",
    text: audio.isMuted() ? "声音：关 🔇" : "声音：开 🔊",
  });
  soundToggle.addEventListener("click", () => {
    audio.toggleMuted();
    refreshSoundIcon();
    soundToggle.textContent = audio.isMuted() ? "声音：关 🔇" : "声音：开 🔊";
  });

  const reset = el("button", { class: "big-btn", type: "button", text: "清空进度 🗑️" });
  reset.style.background = "#ff7676";
  reset.style.boxShadow = "0 8px 0 #d65555";
  let armed = false;
  reset.addEventListener("click", () => {
    if (!armed) {
      armed = true;
      reset.textContent = "确定清空？再点一次";
      setTimeout(() => {
        armed = false;
        reset.textContent = "清空进度 🗑️";
      }, 3000);
      return;
    }
    store.resetProgress();
    close();
    showMap();
  });

  const close = () => backdrop.remove();
  const closeBtn = el("button", { class: "big-btn secondary", type: "button", text: "关闭" });
  closeBtn.addEventListener("click", close);

  row.append(soundToggle, reset);
  sheet.append(row, el("div", { class: "btn-row" }, [closeBtn]));
  backdrop.appendChild(sheet);
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });
  document.body.appendChild(backdrop);
}

// ---------------- 加载 / 错误占位 ----------------
function showLoading() {
  clear(appEl).appendChild(el("div", { class: "loading", text: "🦕 正在登陆恐龙岛…" }));
}

function showError(err) {
  homeBtn.hidden = true;
  const box = el("div", { class: "error-box" });
  box.appendChild(el("div", { text: "😵 出错了，没能加载课程。" }));
  box.appendChild(el("div", { text: String(err && err.message ? err.message : err) }));
  clear(appEl).appendChild(box);
  console.error(err);
}
