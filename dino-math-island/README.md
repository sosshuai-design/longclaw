# 🦕 恐龙数学岛 · Dino Math Island

面向 **5–8 岁（幼小衔接 + 小学低年级）** 的 **课堂大屏** 数学练习游戏（PC Web）。
孩子在加 / 减 / 乘 / 除四座岛上闯关，核心机制三件套：**自适应难度（心流）＋ 养成激励 ＋ 掌握度可视**。

> 本仓库按《开发文档-恐龙数学岛.md》构建。当前进度：**MVP 全部 5 个阶段（Phase 0 ~ Phase 4）已完成并可运行**。

## 技术栈

Vite · React 18 · TypeScript（strict）· Tailwind CSS · Zustand · Framer Motion ·
Web Audio（音效）· Web Speech / speechSynthesis（中文 TTS）· localStorage（持久化）· react-router。
纯前端、无后端、离线可用。

## 运行

```bash
cd dino-math-island
npm install
npm run dev        # 打开 http://localhost:5173
# 其他：
npm run build      # tsc --noEmit + vite build（生产构建）
npm run typecheck  # 仅类型检查
npm run gen:curriculum   # 重新生成占位课程内容
```

目标环境：现代 Chrome / Edge（课堂一体机），PC 优先，无需登录。
支持三种输入：鼠标点击、触摸、键盘数字键 **1 / 2 / 3** 选答案。

## 目录结构

```
dino-math-island/
├── public/curriculum-content.json   # 课程内容数据（核心资产，见下）
├── scripts/gen-curriculum.mjs       # 占位课程生成器
└── src/
    ├── main.tsx / App.tsx           # 入口 + 路由 + 课程加载 + 顶栏
    ├── engine/                      # 纯逻辑，无 UI，可单测
    │   ├── types.ts                 # 全部类型定义（开发文档 §4）
    │   ├── curriculum.ts            # 加载/解析 JSON + 解锁/掌握度查询
    │   ├── questionGenerator.ts     # 按知识点+难度档出题（加减乘除）
    │   ├── adaptiveDifficulty.ts    # 自适应难度（目标成功率 75–85%）
    │   ├── masteryModel.ts          # 掌握度更新/状态/间隔重复
    │   └── rewards.ts               # 金币/宝箱/宠物进化
    ├── store/gameStore.ts           # Zustand：档案/金币/掌握度/设置 + 持久化
    ├── audio/{sfx,speech}.ts        # Web Audio 音效 + 中文 TTS
    ├── pages/{BasePage,PlayPage,ResultPage}.tsx
    └── components/{PetPanel,IslandMap,VisualAids,AnswerButton,DifficultyMeter,Confetti}.tsx
```

## ⚠️ 关于 `public/curriculum-content.json`

这份课程数据是**按开发文档 §4（类型）/§8（课程设计）重建出来的占位内容**，因为原始的
`curriculum-content.json` 没有同步进云端开发环境。它包含 18 个知识点（10/20/100 以内加减、
2–9 乘法口诀含正确的九九口诀文本、用口诀求商），结构完全符合文档 schema。

**替换为你的真实课程**：直接把你的 `curriculum-content.json` 覆盖到 `public/` 即可，
引擎从该文件读取，**无需改任何代码**（题目不硬编码进组件——开发文档 §0 约定 3）。

## 各阶段状态（开发文档 §11）

| 阶段 | 内容 | 状态 |
|---|---|---|
| Phase 0 | 脚手架：Vite+React+TS+Tailwind+Zustand+router，加载课程，空路由可跑 | ✅ |
| Phase 1 | 核心循环：基地/地图 → 加减闯关 → 自适应难度 → 结算宝箱 → 金币/宠物，含图示/音效/TTS/键盘，刷新不丢 | ✅ |
| Phase 2 | 乘法/除法/口诀馆、题型阶梯、知识点解锁 | ✅ |
| Phase 3 | 掌握度模型完善、教师/家长门 + 看板（9×9 热力图等） | ✅ |
| Phase 4 | 动效/护眼/多档案/贴纸册/异常处理/大屏适配打磨 | ✅ |

### Phase 4 验收对照（§11）

- ✅ 动效：Framer Motion 进出场/按压/撒花/宠物 bob；`<MotionConfig reducedMotion="user">` 尊重系统「减少动态」偏好
- ✅ 护眼休息提醒 + 每日时长上限：达上限弹温和提醒（`RestReminder`）
- ✅ 多档案：顶栏切换 / 新增 / 改名 / 删除小朋友（`profiles` 数组 + 镜像 active；persist v3 迁移旧单档案）
- ✅ 贴纸册：24 格收集册，开宝箱掉落点亮（`/stickers`）
- ✅ 异常处理：`ErrorBoundary` 渲染兜底不白屏；课程加载失败友好提示；未知路由回基地
- ✅ 大屏适配：1920×1080 自测布局可读、留白合理；今日目标环接入真实当日数据

### Phase 3 验收对照（§11）

- ✅ 教师 / 家长门（§6.5）：进看板前需答对一道两位数加法，防学生误入
- ✅ 看板（§6.6）：今日时长 / 今日正确率 / 本周新掌握 / 连续天数 四张统计卡；
  **9×9 乘法口诀掌握度热力图**（未学灰 / <40 红 / 40–74 黄 / ≥75 绿 + 图例）；
  加减知识点掌握度横条；本周练习时长柱状图；错题列表 +「一键生成复习挑战」
- ✅ 闯关数据反映到掌握度与热力图（`recordAnswer` 写 mastery，看板实时读取）
- ✅ 设置生效：声音、护眼提醒、难度上限（限制出题档）、内容范围开关（隐藏单元，已实测+持久化）、
  以及「教学演示·全部岛解锁」开关；清空进度
- 数据：新增每日练习统计 `profile.daily` 与连续天数，持久化版本升到 v2（含旧档迁移）

### Phase 2 验收对照（§11）

- ✅ 四座岛可玩：加 / 减 / 乘 / 除闯关均跑通（乘除题含阵列图示）
- ✅ 知识点解锁（前置）：按 `prerequisites` 解锁——加法常开；减法需「10以内加法」掌握、
  乘法需「20以内进位加法」、除法需「5的乘法口诀」；锁定岛显示需要先掌握的前置名
- ✅ 乘法口诀馆：三角形小九九，点格高亮并朗读口诀（口诀文本取自 curriculum，缺失格本地兜底）
- ✅ 题型阶梯（§8.3）：随难度档 看图(pictureChoice) → 算式(equationChoice) → 填空(fillBlank)，
  看图题才突出实物图示，算式/填空题更抽象

> 锁定逻辑严格按文档 §4/§8.1 的 `prerequisites`。新档案初始仅「加法岛」开放，需逐级掌握解锁后续岛
> （教师可在 Phase 3 的设置里用 `enabledUnits` / `maxDifficulty` 调整）。

## Phase 1 验收对照（§11）

- ✅ 能完整玩一轮加法（8 题：前 3 题摸底定档 + 5 题正式）
- ✅ 难度随连续对错升降（连对 3 升档、连错 2 降档，调档后冷却防抖）
- ✅ 答错不卡关：给出正确答案后继续
- ✅ 宝箱给金币；满分额外加成；约 50% 掉贴纸
- ✅ 宠物随 masteredCount 进化（🥚→🐣→🦎→🦕→🐲）
- ✅ 刷新后金币 / 掌握度 / 难度档仍在（localStorage）
- ✅ 实物图示（emoji 分组/阵列）、Web Audio 音效、中文 TTS、键盘 1/2/3
