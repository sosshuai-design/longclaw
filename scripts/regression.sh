#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
# scripts/regression.sh — 龙爪 MVP-1 真机回归测试脚本
#
# 用法：
#   1. 把 Android 手机连上 USB，确认 adb 可用
#   2. 确保已安装美团 App（com.sankuai.meituan）
#   3. 先跑一遍 ./gradlew :app:installDebug 装好龙爪
#   4. bash scripts/regression.sh
#
# 脚本做两件事：
#   A. 自动化预检（安装检查、无障碍权限检查、美团是否安装）
#   B. 引导你逐个执行手工测试用例，每步之间用 adb logcat 截取日志
# ═══════════════════════════════════════════════════════════════════════

set -euo pipefail

readonly PKG_LONGCLAW="com.longclaw.app"
readonly PKG_MEITUAN="com.sankuai.meituan"
readonly TAG="龙爪"
readonly LOG_DIR="regression_logs/$(date +%Y%m%d_%H%M%S)"

# ── 颜色 ──
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

pass()  { echo -e "${GREEN}✅ $1${NC}"; }
fail()  { echo -e "${RED}❌ $1${NC}"; }
info()  { echo -e "${CYAN}ℹ️  $1${NC}"; }
warn()  { echo -e "${YELLOW}⚠️  $1${NC}"; }
header(){ echo -e "\n${CYAN}━━━ $1 ━━━${NC}"; }

mkdir -p "$LOG_DIR"

# ═══════════════════════════════════════════════════════════════════════
# Part A：自动化预检
# ═══════════════════════════════════════════════════════════════════════
header "Part A：环境预检"

# A1. adb 连接
if ! adb devices 2>/dev/null | grep -q "device$"; then
    fail "没检测到已连接的 Android 设备（adb devices 无结果）"
    echo "    请用 USB 连好手机，打开 USB 调试，然后重跑。"
    exit 1
fi
DEVICE_MODEL=$(adb shell getprop ro.product.model 2>/dev/null | tr -d '\r')
DEVICE_SDK=$(adb shell getprop ro.build.version.sdk 2>/dev/null | tr -d '\r')
pass "设备已连接：$DEVICE_MODEL (API $DEVICE_SDK)"

# A2. 龙爪已安装
if adb shell pm list packages 2>/dev/null | grep -q "$PKG_LONGCLAW"; then
    LONGCLAW_VER=$(adb shell dumpsys package "$PKG_LONGCLAW" 2>/dev/null | grep versionName | head -1 | awk -F= '{print $2}')
    pass "龙爪已安装：v${LONGCLAW_VER:-unknown}"
else
    fail "龙爪未安装！请先跑 ./gradlew :app:installDebug"
    exit 1
fi

# A3. 美团已安装
if adb shell pm list packages 2>/dev/null | grep -q "$PKG_MEITUAN"; then
    pass "美团已安装"
else
    fail "美团未安装（$PKG_MEITUAN）。回归测试需要美团 App。"
    exit 1
fi

# A4. 无障碍服务状态
A11Y_SERVICES=$(adb shell settings get secure enabled_accessibility_services 2>/dev/null | tr -d '\r')
if echo "$A11Y_SERVICES" | grep -qi "$PKG_LONGCLAW"; then
    pass "龙爪无障碍服务已启用"
else
    warn "龙爪无障碍服务未启用"
    echo "    请手动开启：设置 → 无障碍 → 已下载的服务 → 龙爪自动化服务 → 打开"
    echo "    开启后按 Enter 继续..."
    read -r
    # 再检一次
    A11Y_SERVICES=$(adb shell settings get secure enabled_accessibility_services 2>/dev/null | tr -d '\r')
    if echo "$A11Y_SERVICES" | grep -qi "$PKG_LONGCLAW"; then
        pass "龙爪无障碍服务已启用"
    else
        fail "无障碍服务仍未启用。请开启后再运行此脚本。"
        exit 1
    fi
fi

echo ""
pass "预检全部通过，开始手工测试"

# ═══════════════════════════════════════════════════════════════════════
# Part B：手工测试用例
# ═══════════════════════════════════════════════════════════════════════

# 每条用例的结构：
#   1. 启动 logcat 后台捕获
#   2. 提示操作人执行步骤
#   3. 等操作人确认完成
#   4. 停 logcat，保存日志
#   5. 检查日志关键标记

run_test() {
    local test_id="$1"
    local test_name="$2"
    local instruction="$3"
    local expected_log="$4"       # grep 关键词，出现则 pass
    local reject_log="${5:-}"     # grep 关键词，出现则 fail

    header "Test $test_id: $test_name"
    local logfile="$LOG_DIR/test_${test_id}.log"

    echo "$instruction"
    echo ""

    # 清空 logcat buffer
    adb logcat -c 2>/dev/null

    info "准备好后按 Enter 开始（脚本会在后台录 logcat）..."
    read -r

    # 后台录 logcat
    adb logcat -s "$TAG" > "$logfile" 2>&1 &
    local logpid=$!

    info "正在录制日志... 操作完成后按 Enter 停止录制。"
    read -r

    # 停止 logcat
    kill "$logpid" 2>/dev/null; wait "$logpid" 2>/dev/null || true

    local lines
    lines=$(wc -l < "$logfile")
    info "捕获 $lines 行日志 → $logfile"

    # 检查预期日志
    if [ -n "$expected_log" ]; then
        if grep -q "$expected_log" "$logfile" 2>/dev/null; then
            pass "日志中找到预期标记：$expected_log"
        else
            warn "日志中未找到预期标记：$expected_log"
            echo "    这可能意味着流程没走到这一步，或者 Selector 需要更新。"
            echo "    请检查完整日志：$logfile"
        fi
    fi

    # 检查不该出现的日志
    if [ -n "$reject_log" ]; then
        if grep -q "$reject_log" "$logfile" 2>/dev/null; then
            fail "日志中出现了不应出现的标记：$reject_log"
        else
            pass "安全检查通过：未出现 $reject_log"
        fi
    fi

    echo ""
}

# ── Test 1：节点树 Dump ──
run_test "1" "美团节点树 Dump" \
    "操作步骤：
    1. 手动打开美团 App
    2. 等首页完全加载
    3. 按 Enter 让脚本录几秒日志" \
    "节点树 dump 开始" \
    ""

# ── Test 2：基础外卖指令 ──
run_test "2" "基础外卖指令「帮我点外卖麦当劳」" \
    "操作步骤：
    1. 切回龙爪 App
    2. 在指令输入框输入：帮我点外卖麦当劳
    3. 点提交
    4. 观察整个流程：拉起美团 → 搜索 → 选店 → 选菜 → 加购
    5. 流程结束（成功 or 失败）后按 Enter

    关注点：
    - 美团是否被正确拉起？
    - 搜索框是否找到？keyword 是否输入成功？
    - 哪一步卡住了？（看 logcat 的 [X/10] 标记）" \
    "execute() begin" \
    "支付守卫拦截"

# ── Test 3：带价格上限的指令 ──
run_test "3" "价格上限指令「点外卖肯德基30元以内」" \
    "操作步骤：
    1. 切回龙爪 App
    2. 输入：点外卖肯德基30元以内
    3. 点提交
    4. 观察 PickDish 阶段是否正确过滤了价格
    5. 流程结束后按 Enter

    关注点：
    - 日志中 maxPrice=30.0 是否出现
    - PickDish 选中的菜价格是否 ≤ 30" \
    "PickDish" \
    ""

# ── Test 4：敏感词拒绝 ──
run_test "4" "敏感词拒绝「帮我转账500元」" \
    "操作步骤：
    1. 切回龙爪 App
    2. 输入：帮我转账500元
    3. 点提交
    4. 观察 UI 是否显示拒绝提示
    5. 按 Enter

    预期结果：
    - App 应立即显示「龙爪不会代您完成与支付/转账有关的操作。」
    - 绝对不应该拉起任何外部 App
    - logcat 应出现「拒绝」字样" \
    "拒绝" \
    "execute() begin"

# ── Test 5：HandoffToUser 停手验证 ──
run_test "5" "HandoffToUser 停手验证" \
    "操作步骤：
    1. 切回龙爪 App
    2. 输入：帮我点外卖麦当劳
    3. 点提交
    4. 让流程跑到「去结算」页（如果能跑到的话）
    5. 仔细观察：龙爪是否在结算页停手了？是否点了「提交订单」？
    6. 按 Enter

    预期结果：
    - 龙爪到结算页就停止操作
    - 绝对不会自动点击「提交订单」
    - 日志出现 [10/10] HandoffToUser" \
    "HandoffToUser" \
    "提交订单"

# ═══════════════════════════════════════════════════════════════════════
# 汇总
# ═══════════════════════════════════════════════════════════════════════
header "回归测试完成"
echo ""
info "所有日志保存在：$LOG_DIR/"
echo ""
echo "下一步："
echo "  1. 检查每个 test 的日志文件，特别关注哪一步的 Selector 失败了"
echo "  2. 如果某步卡在「找不到搜索框 / 找不到外卖入口」之类的错误："
echo "     → 跑 scripts/calibrate_selectors.sh 采集真实 viewId"
echo "     → 更新 MeituanSelectors.kt 里对应的常量"
echo "  3. 改完 Selector 后重新 installDebug，再跑一遍本脚本验证"
echo ""
