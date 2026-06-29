import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/** 异常兜底（开发文档 §11 Phase 4）：渲染出错时给友好提示，不白屏。 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[恐龙数学岛] 渲染出错：", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="h-full grid place-items-center p-8 text-center">
          <div>
            <div className="text-6xl mb-3">🦕💤</div>
            <div className="text-xl font-extrabold text-ink">恐龙小助手累了</div>
            <p className="text-ink/60 mt-2">页面出了点小问题，刷新一下就好啦。</p>
            <button
              onClick={() => { this.setState({ error: null }); location.assign("/"); }}
              className="mt-5 rounded-full px-7 py-3 text-lg font-extrabold text-white shadow-pop"
              style={{ background: "#5B8DEF" }}
            >
              回基地 🏠
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
