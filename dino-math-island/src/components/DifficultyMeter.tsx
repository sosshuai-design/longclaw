interface Props {
  level: number;
  maxLevel: number;
  hex: string;
}

/** 难度档圆点（开发文档 §6.2） */
export default function DifficultyMeter({ level, maxLevel, hex }: Props) {
  return (
    <div className="flex items-center gap-2" aria-label={`难度 ${level} / ${maxLevel}`}>
      <span className="text-sm font-bold text-ink/60">难度</span>
      {Array.from({ length: maxLevel }, (_, i) => (
        <span
          key={i}
          className="rounded-full transition-all"
          style={{
            width: i < level ? 16 : 12,
            height: i < level ? 16 : 12,
            background: i < level ? hex : "#E3DEF0",
          }}
        />
      ))}
    </div>
  );
}
