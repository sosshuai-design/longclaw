import { useState } from "react";
import { createPortal } from "react-dom";
import { useGameStore, AVATARS } from "../store/gameStore";

/** 多档案切换（开发文档 §7）。顶栏显示当前小朋友，点开可切换 / 新增 / 改名 / 删除。 */
export default function ProfilePicker() {
  const profiles = useGameStore((s) => s.profiles);
  const activeId = useGameStore((s) => s.activeId);
  const profile = useGameStore((s) => s.profile);
  const switchProfile = useGameStore((s) => s.switchProfile);
  const addProfile = useGameStore((s) => s.addProfile);
  const renameProfile = useGameStore((s) => s.renameProfile);
  const deleteProfile = useGameStore((s) => s.deleteProfile);

  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [avatar, setAvatar] = useState(AVATARS[1]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-2xl bg-white shadow-pop px-3 py-2 font-bold text-ink"
        title="切换小朋友"
      >
        <span className="text-2xl">{profile.avatar}</span>
        <span className="max-w-[6rem] truncate">{profile.name}</span>
      </button>

      {open && createPortal(
        <div className="fixed inset-0 bg-black/40 grid place-items-center z-[70]" onClick={() => setOpen(false)}>
          <div className="bg-surface rounded-3xl shadow-soft p-6 w-[min(440px,90vw)]" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-extrabold text-ink mb-3">选择小朋友</h2>

            <div className="flex flex-col gap-2 max-h-60 overflow-auto">
              {profiles.map((p) => (
                <div key={p.id} className="flex items-center gap-2 rounded-2xl p-2" style={{ background: p.id === activeId ? "#EEF3FF" : "#F6F4FB" }}>
                  <button onClick={() => { switchProfile(p.id); setOpen(false); }} className="flex items-center gap-2 flex-1 text-left">
                    <span className="text-2xl">{p.avatar}</span>
                    <span className="font-bold text-ink">{p.name}</span>
                    <span className="text-xs text-ink/50">🪙 {p.coins} · 掌握 {p.masteredCount}</span>
                  </button>
                  <button
                    onClick={() => { const n = prompt("新名字", p.name); if (n) renameProfile(p.id, n); }}
                    className="text-sm px-2 py-1 rounded-lg bg-white"
                  >
                    改名
                  </button>
                  {profiles.length > 1 && (
                    <button
                      onClick={() => { if (confirm(`删除「${p.name}」的档案？`)) deleteProfile(p.id); }}
                      className="text-sm px-2 py-1 rounded-lg bg-white text-wrong"
                    >
                      删除
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-bg">
              <div className="text-sm font-bold text-ink/70 mb-2">新增小朋友</div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {AVATARS.slice(0, 5).map((a, i) => (
                  <button key={i} onClick={() => setAvatar(a)} className="text-2xl rounded-xl px-2 py-1" style={{ background: avatar === a ? "#EEF3FF" : "transparent" }}>
                    {a}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="名字"
                  className="flex-1 rounded-xl border-2 border-bg px-3 py-2"
                />
                <button
                  onClick={() => { addProfile(newName, avatar); setNewName(""); setOpen(false); }}
                  className="rounded-xl px-4 py-2 font-bold text-white"
                  style={{ background: "#5B8DEF" }}
                >
                  添加
                </button>
              </div>
            </div>

            <button onClick={() => setOpen(false)} className="mt-4 w-full rounded-full py-2 font-bold bg-bg text-ink">
              关闭
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
