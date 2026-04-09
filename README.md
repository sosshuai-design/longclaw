# 龙爪 Longclaw

一个运行在 Android 上的自然语言任务执行助手：你说「帮我点海底捞」，它用无障碍服务（Accessibility Service）把美团 App 一路操作到「去结算」页，**然后停手等你亲自支付**。

> **MVP-1 核心约束：龙爪永远不跨过支付边界。** 所有涉及付款、转账、密码、人脸识别的动作全部交给用户本人完成；App 看到付款类包名或敏感关键词会立刻放手。

---

## 现在能做什么（v0.1.0）

| 能力 | 状态 |
|---|---|
| 中文自然语言 → 结构化意图（LLM 解析 + 规则兜底） | ✅ |
| 敏感词本地预检（付款/转账/密码/刷脸） | ✅ |
| 美团外卖 10 步自动化：拉起 → 搜店 → 选菜（按菜名/价格强匹配） → 加购 → 结算 | ✅ |
| 结算页停手 → 把控制权交还给用户 | ✅ |
| `PaymentGuard`：前台包名落入支付类 App 即停 | ✅ |
| 单元测试：RuleIntentParser / IntentParser | ✅ |
| 饿了么适配器 | 🔜 |
| Vision/OCR 兜底（当 viewId 失效时） | 🔜 |

---

## 架构

```
┌───────────────────────┐
│  Compose UI (首页指令) │
└──────────┬────────────┘
           │ rawText
           ▼
┌───────────────────────┐
│  IntentParser         │──1. 本地敏感词预检（永远先跑，绝不走网络）
│  (nlp/)               │──2. LlmClient (OpenAI 兼容协议：DeepSeek/豆包/Qwen)
│                       │──3. RuleIntentParser 兜底
└──────────┬────────────┘
           │ Intent (MeituanOrder / Rejected / Unknown)
           ▼
┌───────────────────────┐
│  MeituanAdapter       │─→ Stage: Launch → DismissPopups → SwitchToDelivery
│  (adapter/meituan/)   │         → Search → PickStore → PickDish
│                       │         → AddToCart → OpenCart → Checkout
│                       │         → HandoffToUser 🛑
└──────────┬────────────┘
           │ 调用
           ▼
┌───────────────────────┐
│  Accessibility Svc    │  waitForViewId / clickByText / inputText /
│  (service/)           │  findDescendantByViewId / dispatchGesture …
│                       │  每一步都过 PaymentGuard
└───────────────────────┘
```

**质量铁律**（全局遵守）：
1. 所有 `suspend` 的 I/O 调用都包 `withTimeout`，不允许无界等待。
2. 任何敏感动作前都要过 `PaymentGuard.isPaymentPackage()`。
3. 节点选择器统一放在 `MeituanSelectors`，不在 Adapter 里写裸 viewId。
4. 日志前缀统一用 `TAG = "龙爪"`，方便 `adb logcat -s 龙爪`。

---

## 本地开发环境

- **JDK 21**（Temurin/OpenJDK 都行）
- **Android Studio Koala 或更新**（带 compileSdk 34 + build-tools 34.0.0）
- **真机或模拟器**：`minSdk = 26`，`targetSdk = 34`

### 获取代码

```bash
git clone <your-fork-or-origin>.git
cd longclaw
```

### 配置 LLM（可选）

龙爪默认走规则兜底；接入 LLM 会让意图解析准确度提升一个台阶。在项目根目录新建 `local.properties`（已被 `.gitignore` 排除）：

```properties
# local.properties
sdk.dir=/Users/you/Library/Android/sdk

# ↓↓↓ 龙爪 LLM 配置（全部可选） ↓↓↓
longclaw.llm.apiKey=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
longclaw.llm.baseUrl=https://api.deepseek.com
longclaw.llm.model=deepseek-chat
```

- 只要走 **OpenAI 兼容协议** 的服务都能直接配：DeepSeek、豆包、Qwen、OpenAI、智谱 GLM、Moonshot……换供应商只改 `baseUrl` + `model`。
- `apiKey` 留空或整个文件不存在时，App 自动退化到 `RuleIntentParser`。
- CI 构建、别人 fork 仓库编不出来的担忧不存在：键不配编译也能过，`BuildConfig.LLM_API_KEY` 会是空串。

### 构建与运行

```bash
# 真实编译 + 单元测试（CI 也是这条链路）
./gradlew :app:testDebugUnitTest
./gradlew :app:assembleDebug

# 安装到连着的设备
./gradlew :app:installDebug
```

### 在手机上启用

1. 安装 debug APK
2. **设置 → 无障碍 → 已下载的服务 → 龙爪自动化服务 → 打开**
3. 回到龙爪主界面，输入「帮我点外卖麦当劳」之类的指令
4. App 会一路点到美团「去结算」页，**然后停下来等你自己按确认付款**

---

## 运行测试

```bash
# 纯 JVM 单元测试（秒级）
./gradlew :app:testDebugUnitTest

# HTML 报告
open app/build/reports/tests/testDebugUnitTest/index.html
```

当前测试覆盖（`app/src/test/java/com/longclaw/app/nlp/`）：

- **`RuleIntentParserTest`**：空输入、外卖关键词、裸商家名兜底、`不超过 X 元` / `X 元以内` / `X 块以内` 三种价格上限、两份/三杯/2 份 三种份数。
- **`IntentParserTest`**：敏感词短路（必须在调用 LLM 之前截断）、各种 LLM 返回（合法 JSON / 空 keyword / 拒绝 / markdown 围栏 / 畸形 JSON）、`llmClient = null` 与 `isConfigured() = false` 两条 fallback 路径。

---

## 项目布局

```
longclaw/
├── app/
│   ├── build.gradle.kts                       # buildConfigField 读 local.properties
│   └── src/
│       ├── main/java/com/longclaw/app/
│       │   ├── adapter/meituan/               # MeituanAdapter + Selectors + 模型
│       │   ├── nlp/                           # IntentParser + RuleIntentParser
│       │   │   └── llm/                       # LlmClient + OpenAiCompatibleLlmClient
│       │   ├── security/                      # PaymentGuard
│       │   ├── service/                       # LongclawAccessibilityService
│       │   └── viewmodel/                     # TaskViewModel
│       └── test/java/com/longclaw/app/nlp/    # JUnit4 单元测试
├── gradle/libs.versions.toml                  # 统一依赖版本
├── .github/workflows/android.yml              # CI：unit test → assembleDebug
└── README.md
```

---

## 已知限制 / 下一步

- **美团 selector 会过期**：`MeituanSelectors.kt` 的 viewId 采样自 6.x 版本。新版本挂了，只改那一个文件即可（这是架构承诺）。
- **PickDish 依赖节点树**：纯靠 `dish_title` / `dish_price` 的 viewId 匹配；一旦美团把菜品列表改成自定义 RecyclerView 不暴露 id，需要上 OCR。Vision 兜底是下一个迭代。
- **只有美团一家**：饿了么（`me.ele`）结构相似，下一个适配器就是它。
- **没做 instrumented 测试**：需要 emulator + Accessibility 权限的 UI 自动化测试还没搭；MVP-1 先靠单元测试 + 人工回归。

---

## 安全 & 隐私承诺

- **支付边界不可越过**：所有涉及付款、转账、密码、人脸识别的动作都不会自动执行。这是产品层面的硬约束。
- **用户原文不写 Log**：日志里只打长度，不打内容，避免隐私泄漏。
- **LLM 调用可关**：不配 `longclaw.llm.apiKey` 就完全走本地规则，0 次外网请求。
- **local.properties 永远不进仓库**：已在 `.gitignore`。

---

## License

WIP —— 未确定。目前仅用于内部开发 / 研究。
