import type { Config } from "tailwindcss";

// 视觉 design tokens —— 全部集中在这里，避免散落魔法值（开发文档 §9）。
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#F3F0FA",
        surface: "#FFFFFF",
        ink: "#3A2F5B",
        // 单元主题色
        add: "#FF8A5B",
        sub: "#4FB286",
        mul: "#5B8DEF",
        div: "#C173E0",
        chant: "#F2B441",
        // 反馈
        correct: "#2FB36B",
        wrong: "#F2685E",
        coin: "#FFB531",
      },
      borderRadius: {
        xl: "16px",
        "2xl": "22px",
        "3xl": "28px",
      },
      boxShadow: {
        soft: "0 10px 30px rgba(90, 70, 140, 0.12)",
        pop: "0 8px 0 rgba(0,0,0,0.10)",
      },
      fontFamily: {
        rounded: [
          '"PingFang SC"',
          '"Hiragino Sans GB"',
          '"Microsoft YaHei"',
          '"Noto Sans CJK SC"',
          "system-ui",
          "sans-serif",
        ],
      },
      fontSize: {
        // 课堂大屏：算式/答案要大
        equation: ["64px", { lineHeight: "1.1", fontWeight: "800" }],
        answer: ["44px", { lineHeight: "1", fontWeight: "800" }],
      },
      keyframes: {
        bob: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
      animation: { bob: "bob 2.6s ease-in-out infinite" },
    },
  },
  plugins: [],
} satisfies Config;
