# 🦕 恐龙数学岛 · Dinosaur Math Island

面向 **婴幼儿（3–6 岁）** 的数学启蒙小游戏。孩子在一座座「小岛」上闯关，
学习数数、数字认知、数量对应、比多少、形状、规律和加减法，答对收集星星。

- **纯前端、零依赖、零构建**：只有 HTML / CSS / 原生 JS（ES Modules），用任意静态服务器即可运行。
- **数据驱动**：所有课程内容都来自 [`curriculum-content.json`](./curriculum-content.json)。换课程＝改这一个文件。
- **为低龄设计**：大按钮、大字、语音播报、即时反馈、没有失败惩罚（答错可一直重试），不依赖识字。

> ⚠️ **关于本目录的由来**：原始的《开发文档-恐龙数学岛.md》和 `curriculum-content.json`
> 是在本地 macOS 路径下附带的，并没有同步进云端开发环境，我无法读取。所以这里的代码与
> 课程是我**按照婴幼儿数学启蒙的通行做法从零搭的可运行 MVP**，并刻意做成数据驱动，方便把你
> 真实的课程内容直接替换进来（见下方《替换成你的课程》）。

---

## 快速开始

ES Modules + `fetch` 需要通过 HTTP 访问，不能直接双击 `index.html`（`file://` 会被浏览器拦）。

```bash
cd dino-math-island

# 任选一种静态服务器：
python3 -m http.server 8000
#   或： npx serve .
#   或： npx http-server -p 8000

# 浏览器打开
open http://localhost:8000
```

平板 / 手机横竖屏都可用，建议给孩子用平板全屏体验。

---

## 目录结构

```
dino-math-island/
├── index.html              # 入口页面 + 顶栏 + 彩带画布
├── styles.css              # 全部样式（儿童友好：大按钮、动效、配色）
├── curriculum-content.json # ★ 课程内容（小岛 + 题型 + 参数）
└── src/
    ├── main.js             # 应用入口：屏幕路由、答题流程、家长设置
    ├── engine.js           # 加载课程、把小岛展开成题目、算星星
    ├── activities.js       # ★ 题型注册表：每种玩法的 generate + render
    ├── utils.js            # DOM/随机/洗牌等小工具
    ├── audio.js            # 中文语音播报 + 音效（均做了降级）
    ├── storage.js          # 进度（每岛最高星数）localStorage
    └── confetti.js         # 庆祝彩带
```

---

## 课程内容 `curriculum-content.json`

### 顶层结构

```jsonc
{
  "meta": {
    "title": "恐龙数学岛",
    "language": "zh-CN",
    "ageRange": "3-6",
    "questionsPerIsland": 5,        // 每岛默认出题数（岛内可覆盖）
    "starsThresholds": [3, 4, 5]    // 「首次答对」达到几题，分别得 1/2/3 颗星
  },
  "islands": [ /* 见下 */ ]
}
```

> 星星按**首次答对**的题数计算（答错重试不计），所以孩子越熟练，星星越多。

### 每座小岛

```jsonc
{
  "id": "count-1-5",          // 唯一 id，用于存进度
  "title": "数数小岛",         // 地图上显示的名字
  "subtitle": "数一数 1~5",    // 副标题
  "emoji": "🥚",              // 地图图标
  "color": "#56c271",         // 卡片主题色
  "skill": "counting",        // 知识点标签（仅说明用）
  "activityType": "counting", // ★ 题型，必须是下表支持的值
  "intro": "小恐龙蛋出现啦！数一数，有几个？", // 进岛时的语音引导
  "config": { "min": 1, "max": 5, "choices": 3, "questions": 5 }
}
```

### 支持的题型 `activityType` 与 `config`

| activityType    | 玩法                         | config 关键字 |
|-----------------|------------------------------|---------------|
| `counting`      | 数一数有几只，选数字          | `min`, `max`, `choices`, `questions` |
| `number-match`  | 看数字，选出数量相同的那一堆  | `min`, `max`, `choices`, `questions` |
| `compare`       | 比较两堆，选更多 / 更少       | `min`, `max`, `mode`("more"\|"less"), `questions` |
| `shapes`        | 认识 / 匹配形状               | `pool`(形状名数组), `choices`, `questions` |
| `pattern`       | 找规律，选下一个              | `choices`, `questions` |
| `addition`      | 看图做加法                    | `maxSum`, `choices`, `questions` |
| `subtraction`   | 看图做减法                    | `max`, `choices`, `questions` |

`shapes` 的 `pool` 取值：`圆形`、`正方形`、`三角形`、`星形`、`心形`。

题目都是**运行时随机生成**的（按 config 范围出题），所以每次玩都不一样、可反复练习。

---

## 替换成你的课程

如果你那份真实的 `curriculum-content.json` 结构和上面**一致**，直接覆盖本目录同名文件即可，无需改代码。

如果结构**不同**，有两条路：

1. 把你的 JSON 字段映射到上面的 schema（最快）；或
2. 在 `src/engine.js` 的 `loadCurriculum()` 里加一层适配，把你的格式转成内部结构。

如果你的课程里有上表**没有的题型**，在 `src/activities.js` 里照着现有题型再注册一个
（实现 `generate(config)` 和 `render(question, ctx)`），然后在 JSON 里用它的名字当 `activityType`。
引擎会自动跳过暂不支持的题型并在控制台给出提示。

---

## 设计取舍（婴幼儿向）

- **不依赖识字**：所有题目都有语音播报，文字只是辅助。
- **没有失败**：答错只温和提示「再试一试」，可无限重试，保护学习兴趣。
- **正反馈拉满**：答对有音效 + 彩带 + 夸奖；通关有星星和庆祝。
- **大目标区**：按钮 ≥ 78px 高，符合小手点按。
- **家长设置**：长按顶部标题 0.8 秒打开（声音开关 / 清空进度），避免孩子误触。

## 后续可做

- 用真实图片 / 配音替换 emoji 与 TTS，画面更精致。
- 增加「点读数数」（逐个点恐龙报数）、排序、时钟、货币等题型。
- 自适应难度：根据正确率动态调范围。
- 打包成 PWA（离线可用）或用 Capacitor 套壳上架。
