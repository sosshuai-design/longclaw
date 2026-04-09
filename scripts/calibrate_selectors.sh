#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
# scripts/calibrate_selectors.sh — 采集美团 App 真实 viewId，校准 Selectors
#
# 用法：
#   1. 手机连 USB，打开美团 App，手动导航到目标页面
#   2. bash scripts/calibrate_selectors.sh [页面名]
#
# 示例：
#   bash scripts/calibrate_selectors.sh 首页
#   bash scripts/calibrate_selectors.sh 搜索结果
#   bash scripts/calibrate_selectors.sh 商家详情
#   bash scripts/calibrate_selectors.sh 购物车
#   bash scripts/calibrate_selectors.sh 结算页
#
# 脚本会：
#   1. 用 uiautomator dump 采集当前屏幕的完整节点树
#   2. 提取所有 resource-id，按出现频率排序
#   3. 与 MeituanSelectors.kt 里的常量做对比，标出命中/缺失
#   4. 把完整 XML 保存到本地供手动分析
# ═══════════════════════════════════════════════════════════════════════

set -euo pipefail

readonly PAGE_NAME="${1:-unknown}"
readonly PKG_MEITUAN="com.sankuai.meituan"
readonly DUMP_DIR="selector_dumps/$(date +%Y%m%d_%H%M%S)_${PAGE_NAME}"
readonly DEVICE_XML="/sdcard/window_dump.xml"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

pass()  { echo -e "${GREEN}✅ $1${NC}"; }
miss()  { echo -e "${RED}❌ $1${NC}"; }
info()  { echo -e "${CYAN}ℹ️  $1${NC}"; }
warn()  { echo -e "${YELLOW}⚠️  $1${NC}"; }
header(){ echo -e "\n${CYAN}━━━ $1 ━━━${NC}"; }

mkdir -p "$DUMP_DIR"

# ── 检查设备 ──
if ! adb devices 2>/dev/null | grep -q "device$"; then
    echo "❌ 没检测到已连接的 Android 设备"
    exit 1
fi

# ── 检查前台 App ──
CURRENT_PKG=$(adb shell dumpsys window 2>/dev/null | grep -i "mCurrentFocus\|mFocusedApp" | grep -o "$PKG_MEITUAN" | head -1 || true)
if [ -z "$CURRENT_PKG" ]; then
    warn "当前前台不是美团 App。请先手动打开美团并导航到目标页面。"
    echo "    按 Enter 继续采集（可能采到的不是美团的节点树）..."
    read -r
fi

# ═══════════════════════════════════════════════════════════════════════
# Step 1：uiautomator dump
# ═══════════════════════════════════════════════════════════════════════
header "Step 1: 采集节点树"
adb shell uiautomator dump "$DEVICE_XML" 2>/dev/null
adb pull "$DEVICE_XML" "$DUMP_DIR/ui_dump.xml" 2>/dev/null
adb shell rm "$DEVICE_XML" 2>/dev/null || true

LOCAL_XML="$DUMP_DIR/ui_dump.xml"
if [ ! -f "$LOCAL_XML" ]; then
    echo "❌ dump 失败，请确认设备上 uiautomator 可用"
    exit 1
fi

NODE_COUNT=$(grep -c "node " "$LOCAL_XML" 2>/dev/null || echo 0)
info "采集到 $NODE_COUNT 个节点 → $LOCAL_XML"

# ═══════════════════════════════════════════════════════════════════════
# Step 2：提取所有 resource-id
# ═══════════════════════════════════════════════════════════════════════
header "Step 2: 提取 resource-id"
RESID_FILE="$DUMP_DIR/resource_ids.txt"

# 提取 resource-id="xxx" 并去重排序
grep -oP 'resource-id="[^"]*"' "$LOCAL_XML" \
    | sed 's/resource-id="//;s/"$//' \
    | grep -v '^$' \
    | sort | uniq -c | sort -rn \
    > "$RESID_FILE"

TOTAL_IDS=$(wc -l < "$RESID_FILE")
info "找到 $TOTAL_IDS 个不同的 resource-id"

# 只显示属于美团的
echo ""
echo "美团相关的 resource-id（按出现次数降序）："
echo "────────────────────────────────────────────"
grep "$PKG_MEITUAN" "$RESID_FILE" | head -40 || echo "(无美团相关 resource-id)"
echo "────────────────────────────────────────────"

# ═══════════════════════════════════════════════════════════════════════
# Step 3：提取所有 text 属性
# ═══════════════════════════════════════════════════════════════════════
header "Step 3: 提取 text 属性"
TEXT_FILE="$DUMP_DIR/text_values.txt"

grep -oP 'text="[^"]*"' "$LOCAL_XML" \
    | sed 's/text="//;s/"$//' \
    | grep -v '^$' \
    | sort | uniq -c | sort -rn \
    > "$TEXT_FILE"

echo "页面上的文案（按出现次数降序，前 30 条）："
echo "────────────────────────────────────────────"
head -30 "$TEXT_FILE"
echo "────────────────────────────────────────────"

# ═══════════════════════════════════════════════════════════════════════
# Step 4：与 MeituanSelectors.kt 对比
# ═══════════════════════════════════════════════════════════════════════
header "Step 4: 与 MeituanSelectors.kt 对比"

# 从代码里提取所有 ID_ 常量的值
SELECTORS_FILE="app/src/main/java/com/longclaw/app/adapter/meituan/MeituanModels.kt"
if [ ! -f "$SELECTORS_FILE" ]; then
    warn "找不到 $SELECTORS_FILE，跳过对比"
else
    echo ""
    echo "对比结果（✅ = 当前页面有此 ID，❌ = 当前页面没有）："
    echo "────────────────────────────────────────────"

    # 提取形如 "com.sankuai.meituan:id/xxx" 的常量值
    grep -oP '"[^"]*meituan:id/[^"]*"' "$SELECTORS_FILE" \
        | tr -d '"' \
        | while IFS= read -r selector_id; do
            # 检查这个 id 是否出现在 dump 里
            if grep -q "resource-id=\"$selector_id\"" "$LOCAL_XML" 2>/dev/null; then
                echo -e "  ${GREEN}✅${NC} $selector_id"
            else
                echo -e "  ${RED}❌${NC} $selector_id  ← 当前页面未找到"
            fi
        done

    # 文案型选择器
    echo ""
    echo "文案型选择器对比："
    for text_selector in "外卖" "去结算" "提交订单"; do
        if grep -q "text=\"$text_selector\"" "$LOCAL_XML" 2>/dev/null || \
           grep -q "text=\".*${text_selector}.*\"" "$LOCAL_XML" 2>/dev/null; then
            echo -e "  ${GREEN}✅${NC} TEXT=\"$text_selector\""
        else
            echo -e "  ${RED}❌${NC} TEXT=\"$text_selector\"  ← 当前页面未找到"
        fi
    done

    echo "────────────────────────────────────────────"
fi

# ═══════════════════════════════════════════════════════════════════════
# Step 5：生成建议
# ═══════════════════════════════════════════════════════════════════════
header "Step 5: 建议"

echo ""
echo "所有采集数据保存在：$DUMP_DIR/"
echo ""
echo "文件列表："
ls -la "$DUMP_DIR/"
echo ""
echo "下一步："
echo "  1. 打开 $LOCAL_XML 用文本编辑器/浏览器查看完整节点树"
echo "  2. 搜索关键词（如 search_edit / dish_name / cart / 外卖）定位真实 viewId"
echo "  3. 把找到的真实 viewId 更新到 MeituanSelectors.kt"
echo "  4. 重新 ./gradlew :app:installDebug 后再跑回归测试"
echo ""
echo "提示：在不同页面各跑一次本脚本，积累完整的选择器映射："
echo "  bash scripts/calibrate_selectors.sh 首页"
echo "  bash scripts/calibrate_selectors.sh 搜索结果"
echo "  bash scripts/calibrate_selectors.sh 商家详情"
echo "  bash scripts/calibrate_selectors.sh 购物车"
echo "  bash scripts/calibrate_selectors.sh 结算页"
echo ""
