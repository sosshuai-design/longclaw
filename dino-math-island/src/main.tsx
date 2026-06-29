import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import App from "./App";
import "./styles/index.css";

// 用 HashRouter：GitHub Pages 等静态托管下，刷新/深链不会 404（路由走 # 后面）。
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      {/* 尊重系统「减少动态效果」偏好（开发文档 §9） */}
      <MotionConfig reducedMotion="user">
        <App />
      </MotionConfig>
    </HashRouter>
  </React.StrictMode>
);
