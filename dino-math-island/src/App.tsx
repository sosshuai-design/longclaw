import { createContext, useContext, useEffect, useState } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import type { Curriculum } from "./engine/types";
import { loadCurriculum } from "./engine/curriculum";
import { useGameStore } from "./store/gameStore";
import BasePage from "./pages/BasePage";
import PlayPage from "./pages/PlayPage";
import ResultPage from "./pages/ResultPage";
import ChantPage from "./pages/ChantPage";
import GatePage from "./pages/GatePage";
import DashboardPage from "./pages/DashboardPage";
import StickerBook from "./pages/StickerBook";
import ProfilePicker from "./components/ProfilePicker";
import RestReminder from "./components/RestReminder";
import ErrorBoundary from "./components/ErrorBoundary";

// 课程内容通过 Context 提供，全应用只加载一次
const CurriculumContext = createContext<Curriculum | null>(null);
export function useCurriculum(): Curriculum {
  const c = useContext(CurriculumContext);
  if (!c) throw new Error("Curriculum 尚未加载");
  return c;
}

function TopBar() {
  const coins = useGameStore((s) => s.profile.coins);
  const navigate = useNavigate();
  return (
    <header className="flex items-center justify-between px-6 py-3 bg-surface/80 backdrop-blur shadow-soft">
      <button
        onClick={() => navigate("/")}
        className="flex items-center gap-2 text-2xl font-extrabold text-ink"
      >
        <span className="text-3xl animate-bob">🦕</span>
        恐龙数学岛
      </button>
      <div className="flex items-center gap-3">
        <ProfilePicker />
        <div className="flex items-center gap-1 bg-coin/15 text-ink font-extrabold rounded-2xl px-4 py-2 text-xl">
          <span className="text-2xl">🪙</span>
          {coins}
        </div>
        <button
          title="教师 / 家长中心"
          onClick={() => navigate("/gate")}
          className="rounded-2xl px-4 py-2 bg-white shadow-pop text-ink/70 font-bold"
        >
          👩‍🏫 教师
        </button>
      </div>
    </header>
  );
}

export default function App() {
  const [curriculum, setCurriculum] = useState<Curriculum | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCurriculum()
      .then(setCurriculum)
      .catch((e) => setError(String(e?.message ?? e)));
  }, []);

  if (error) {
    return (
      <div className="h-full grid place-items-center p-8 text-center">
        <div>
          <div className="text-5xl mb-3">😵</div>
          <div className="text-xl font-bold text-wrong">课程加载失败</div>
          <div className="text-ink/60 mt-2">{error}</div>
        </div>
      </div>
    );
  }

  if (!curriculum) {
    return (
      <div className="h-full grid place-items-center">
        <div className="text-2xl font-bold text-ink/70 animate-bob">🦕 正在登陆恐龙岛…</div>
      </div>
    );
  }

  return (
    <CurriculumContext.Provider value={curriculum}>
      <div className="h-full flex flex-col">
        <TopBar />
        <main className="flex-1 overflow-auto">
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<BasePage />} />
              <Route path="/play/:unit" element={<PlayPage />} />
              <Route path="/result" element={<ResultPage />} />
              <Route path="/chant" element={<ChantPage />} />
              <Route path="/gate" element={<GatePage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/stickers" element={<StickerBook />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ErrorBoundary>
        </main>
        <RestReminder />
      </div>
    </CurriculumContext.Provider>
  );
}
