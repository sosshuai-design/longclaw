package com.longclaw.app.adapter.meituan

import android.util.Log
import android.view.accessibility.AccessibilityNodeInfo
import com.longclaw.app.security.PaymentGuard
import com.longclaw.app.service.LongclawAccessibilityService
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.withTimeout

/**
 * 美团 App 自动化适配器（MVP）。
 *
 * 完整的 10 步流程：
 *   1. Launch          —— 拉起美团 App
 *   2. DismissPopups   —— 关掉隐私弹窗 / 引导浮层
 *   3. SwitchToDelivery—— 切到「外卖」Tab
 *   4. Search          —— 在搜索框输入关键词
 *   5. PickStore       —— 在结果列表里挑商家
 *   6. PickDish        —— 在商家详情里挑菜（支持价格上限、菜名匹配）
 *   7. AddToCart       —— 把菜加到购物车
 *   8. OpenCart        —— 进入购物车页
 *   9. Checkout        —— 点「去结算」，进入订单确认页
 *  10. HandoffToUser   —— **不再前进**，把控制权交还给用户去支付
 *
 * 安全边界：
 *  - 任何 suspend 调用都包了 [withTimeout]，超时即回到 [MeituanOrderResult.Failed]。
 *  - 在第 9/10 步前后再次调用 [PaymentGuard.assertNotPayment]，越过支付边界立即停手。
 *  - 选择器全部从 [MeituanSelectors] 取，不允许在本文件里写裸 viewId / 文案。
 */
class MeituanAdapter(
    private val service: LongclawAccessibilityService,
) {

    /**
     * 执行一次外卖下单流程。整个调用 suspend，建议在 ViewModel 的 viewModelScope
     * 里启动；上层若要取消直接 cancel 协程即可。
     */
    suspend fun execute(request: MeituanOrderRequest): MeituanOrderResult {
        Log.i(TAG, "execute() begin request=$request")
        return try {
            withTimeout(OVERALL_TIMEOUT_MS) { runFlow(request) }
        } catch (e: TimeoutCancellationException) {
            Log.w(TAG, "整体超时 ${OVERALL_TIMEOUT_MS}ms")
            MeituanOrderResult.Failed(Stage.HandoffToUser, "整体超时")
        } catch (t: Throwable) {
            Log.e(TAG, "execute() 抛异常: ${t.message}", t)
            MeituanOrderResult.Failed(Stage.HandoffToUser, t.message ?: "未知错误")
        }
    }

    private suspend fun runFlow(request: MeituanOrderRequest): MeituanOrderResult {
        // 步骤 1：拉起美团
        Log.i(TAG, "[1/10] Launch 美团 App")
        if (!service.launchExternalApp(MeituanSelectors.PACKAGE_MEITUAN)) {
            return MeituanOrderResult.Failed(Stage.Launch, "未能启动美团 App，请确认已安装")
        }
        delay(LAUNCH_SETTLE_MS)
        PaymentGuard.assertNotPayment(service.currentForegroundPackage())

        // 步骤 2：关闭所有弹窗（隐私弹窗 + 广告弹窗 + 活动浮层，可能有多个）
        Log.i(TAG, "[2/10] DismissPopups")
        dismissAllPopups()

        // 步骤 3：切到「外卖」Tab
        Log.i(TAG, "[3/10] SwitchToDelivery")
        if (!service.clickByText(MeituanSelectors.TEXT_TAB_DELIVERY)) {
            // 可能又弹了一层，再关一轮然后重试
            dismissAllPopups()
            if (!service.clickByText(MeituanSelectors.TEXT_TAB_DELIVERY)) {
                return MeituanOrderResult.Failed(Stage.SwitchToDelivery, "找不到「外卖」入口")
            }
        }
        // 切完 Tab 后可能又弹广告，再清一次
        delay(NAV_SETTLE_MS)
        dismissAllPopups()

        // 步骤 4：搜索关键词（多候选 viewId + 文案兜底）
        Log.i(TAG, "[4/10] Search keyword=${request.keyword}")
        if (!clickFirstCandidate(MeituanSelectors.ID_HOME_SEARCH_BOX_CANDIDATES, "首页搜索框")
            && !clickFirstTextHint(MeituanSelectors.TEXT_SEARCH_HINTS, "首页搜索框")) {
            return MeituanOrderResult.Failed(Stage.Search, "找不到搜索框")
        }
        delay(NAV_SETTLE_MS)
        if (!inputFirstCandidate(MeituanSelectors.ID_SEARCH_INPUT_CANDIDATES, request.keyword, "搜索输入框")
            && !inputFirstCandidate(MeituanSelectors.ID_HOME_SEARCH_BOX_CANDIDATES, request.keyword, "搜索输入框(重试)")) {
            return MeituanOrderResult.Failed(Stage.Search, "搜索框输入失败")
        }
        // 点搜索按钮：先试 viewId，再试文案
        if (!clickFirstCandidate(MeituanSelectors.ID_SEARCH_BUTTON_CANDIDATES, "搜索按钮")) {
            clickFirstTextHint(MeituanSelectors.TEXT_SEARCH_BUTTON_HINTS, "搜索按钮")
        }

        // 步骤 5：挑商家（先取列表里第一个匹配关键词的）
        Log.i(TAG, "[5/10] PickStore")
        val storeNode = service.waitForText(request.keyword, timeoutMs = LONG_WAIT_MS)
            ?: return MeituanOrderResult.Failed(Stage.PickStore, "搜索结果里没有找到「${request.keyword}」")
        if (!storeNode.isClickable) {
            // 商家卡片本身常常不可点，让上层节点接管
            service.clickByText(request.keyword)
        } else {
            storeNode.performAction(android.view.accessibility.AccessibilityNodeInfo.ACTION_CLICK)
        }
        delay(NAV_SETTLE_MS)

        // 步骤 6：挑菜（关键改动：当 dishName 与 maxPrice 都明确时做强价格比较）
        Log.i(TAG, "[6/10] PickDish dishName=${request.dishName} maxPrice=${request.maxPrice}")
        val pickedAddBtn: AccessibilityNodeInfo = pickDishAddButton(request)
            ?: return MeituanOrderResult.Failed(
                Stage.PickDish,
                buildPickDishError(request),
            )

        // 步骤 7：加入购物车（点 step 6 已经锁定的那个 add 按钮）
        Log.i(TAG, "[7/10] AddToCart x${request.quantity}")
        repeat(request.quantity.coerceAtLeast(1)) { idx ->
            val ok = service.clickNode(pickedAddBtn)
            Log.d(TAG, "AddToCart click#$idx ok=$ok")
            delay(STEP_INTERVAL_MS)
        }

        // 步骤 8：打开购物车
        Log.i(TAG, "[8/10] OpenCart")
        if (!service.clickByViewId(MeituanSelectors.ID_CART_ENTRY)) {
            return MeituanOrderResult.Failed(Stage.OpenCart, "找不到购物车入口")
        }

        // 步骤 9：点击「去结算」
        Log.i(TAG, "[9/10] Checkout")
        if (!service.clickByText(MeituanSelectors.TEXT_CHECKOUT_BUTTON)) {
            return MeituanOrderResult.Failed(Stage.Checkout, "找不到「去结算」按钮")
        }

        // 步骤 10：交还给用户。这里**不会**点提交订单，必须用户亲自完成支付。
        Log.i(TAG, "[10/10] HandoffToUser —— 等待用户亲自支付，龙爪退出操作")
        // 抓一下确认页的总价用于回显
        val totalNode = service.waitForViewId(
            MeituanSelectors.ID_CHECKOUT_TOTAL_PRICE,
            timeoutMs = SHORT_WAIT_MS,
        )
        val storeName = service.waitForViewId(
            MeituanSelectors.ID_STORE_NAME,
            timeoutMs = SHORT_WAIT_MS,
        )
        // 把控制权交还前再守一次：万一一脚踩进了支付页，立刻收手。
        PaymentGuard.assertNotPayment(service.currentForegroundPackage())

        return MeituanOrderResult.ReadyForPayment(
            storeName = storeName?.text?.toString(),
            totalPrice = totalNode?.text?.toString(),
        )
    }

    /**
     * 选菜核心逻辑：
     *  1. 等待菜品列表的某一行（dish_title）出现，确保商家详情页已加载完毕。
     *  2. 枚举所有 dish_title 节点，向上回溯到「行容器」，再向下找 price + add 按钮。
     *  3. 同时满足「菜名匹配（若 dishName 非空）」与「价格 ≤ maxPrice（若非空）」
     *     的最便宜一项胜出。dishName / maxPrice 都为空时取第一行可加购的菜。
     *
     * 失败返回 null；上层会用 [buildPickDishError] 拼一条对人友好的错误。
     */
    private suspend fun pickDishAddButton(
        request: MeituanOrderRequest,
    ): AccessibilityNodeInfo? {
        // 等列表里至少出现一个 dish_title，证明详情页内容已经渲染。
        service.waitForViewId(MeituanSelectors.ID_DISH_TITLE, timeoutMs = LONG_WAIT_MS)
            ?: run {
                Log.w(TAG, "PickDish: 没等到任何 dish_title 节点")
                return null
            }

        val titleNodes = service.findAllByViewId(MeituanSelectors.ID_DISH_TITLE)
        Log.d(TAG, "PickDish: 候选行数=${titleNodes.size}")
        if (titleNodes.isEmpty()) return null

        data class Candidate(
            val name: String,
            val price: Double?,
            val addBtn: AccessibilityNodeInfo,
        )

        val candidates = mutableListOf<Candidate>()
        for (titleNode in titleNodes) {
            val name = titleNode.text?.toString()?.trim().orEmpty()
            if (name.isEmpty()) continue

            // 行容器一般是 dish_title 的 parent；不同版本可能要再往上一层。
            val row = titleNode.parent ?: continue
            val priceNode = service.findDescendantByViewId(row, MeituanSelectors.ID_DISH_PRICE)
            val addBtn = service.findDescendantByViewId(row, MeituanSelectors.ID_DISH_ADD_BUTTON)
                ?: row.parent?.let {
                    service.findDescendantByViewId(it, MeituanSelectors.ID_DISH_ADD_BUTTON)
                }
                ?: continue
            candidates += Candidate(
                name = name,
                price = priceNode?.text?.toString()?.let(::parsePrice),
                addBtn = addBtn,
            )
        }
        Log.d(TAG, "PickDish: 解析后候选数=${candidates.size}")
        if (candidates.isEmpty()) return null

        val byName: List<Candidate> = if (!request.dishName.isNullOrBlank()) {
            candidates.filter { it.name.contains(request.dishName) }
        } else {
            candidates
        }
        val byPrice: List<Candidate> = if (request.maxPrice != null) {
            byName.filter { it.price != null && it.price <= request.maxPrice + EPSILON }
        } else {
            byName
        }
        val ranked = byPrice.sortedBy { it.price ?: Double.MAX_VALUE }
        val winner = ranked.firstOrNull()
        Log.i(
            TAG,
            "PickDish 选中: name=${winner?.name} price=${winner?.price} (候选 ${candidates.size}/匹配 ${byPrice.size})",
        )
        return winner?.addBtn
    }

    /** 解析「¥18.5」「￥18」「18 元」「18.50」之类的文本为 Double；失败返回 null。 */
    private fun parsePrice(raw: String): Double? {
        val m = Regex("(\\d+(?:\\.\\d+)?)").find(raw) ?: return null
        return m.groupValues[1].toDoubleOrNull()
    }

    private fun buildPickDishError(request: MeituanOrderRequest): String = buildString {
        append("没能在商家详情里挑到合适的菜")
        if (!request.dishName.isNullOrBlank()) append("（菜名：${request.dishName}）")
        if (request.maxPrice != null) append("（价格上限：${request.maxPrice} 元）")
    }

    // ─── 多候选兜底工具方法 ────────────────────────────────────

    /** 依次尝试多个 viewId，第一个命中的就点击并返回 true。全部 miss 返回 false。 */
    private suspend fun clickFirstCandidate(
        candidates: List<String>,
        desc: String,
    ): Boolean {
        for (id in candidates) {
            if (service.clickByViewId(id, timeoutMs = SHORT_WAIT_MS)) {
                Log.i(TAG, "$desc 命中 viewId=$id")
                return true
            }
        }
        Log.w(TAG, "$desc 所有候选 viewId 均未命中: $candidates")
        return false
    }

    /** 依次尝试多个文案关键词，第一个命中的就点击并返回 true。 */
    private suspend fun clickFirstTextHint(
        hints: List<String>,
        desc: String,
    ): Boolean {
        for (text in hints) {
            if (service.clickByText(text, timeoutMs = SHORT_WAIT_MS)) {
                Log.i(TAG, "$desc 命中文案=$text")
                return true
            }
        }
        Log.w(TAG, "$desc 所有候选文案均未命中: $hints")
        return false
    }

    /** 依次尝试多个 viewId 做文本输入，第一个命中的就输入并返回 true。 */
    private suspend fun inputFirstCandidate(
        candidates: List<String>,
        text: String,
        desc: String,
    ): Boolean {
        for (id in candidates) {
            if (service.inputText(id, text, timeoutMs = SHORT_WAIT_MS)) {
                Log.i(TAG, "$desc 命中 viewId=$id, 输入=$text")
                return true
            }
        }
        Log.w(TAG, "$desc 所有候选 viewId 均未命中: $candidates")
        return false
    }

    // ─── 弹窗关闭 ─────────────────────────────────────────────

    /**
     * 尝试关掉当前屏幕上的所有弹窗（隐私弹窗、广告浮层、活动弹窗等）。
     *
     * 策略（最多循环 [MAX_POPUP_ROUNDS] 轮）：
     *  1. 先尝试点击已知的关闭按钮 viewId（[MeituanSelectors.ID_POPUP_CLOSE_CANDIDATES]）。
     *  2. 再尝试点击包含关闭文案的节点（[MeituanSelectors.TEXT_POPUP_DISMISS]）。
     *  3. 都没命中就按一次系统返回键兜底。
     *  4. 每轮之间短暂等待，让 UI 刷新。
     *
     * 全部轮次结束后无论是否成功都静默返回；失败不阻塞主流程。
     */
    private suspend fun dismissAllPopups() {
        repeat(MAX_POPUP_ROUNDS) { round ->
            var dismissed = false

            // 1. 尝试 viewId 关闭按钮
            for (id in MeituanSelectors.ID_POPUP_CLOSE_CANDIDATES) {
                if (service.clickByViewId(id, timeoutMs = POPUP_PROBE_MS)) {
                    Log.i(TAG, "dismissPopup round=$round 命中 viewId=$id")
                    dismissed = true
                    break
                }
            }

            // 2. viewId 没命中，尝试文案关闭按钮
            if (!dismissed) {
                for (text in MeituanSelectors.TEXT_POPUP_DISMISS) {
                    if (service.clickByText(text, timeoutMs = POPUP_PROBE_MS)) {
                        Log.i(TAG, "dismissPopup round=$round 命中文案=$text")
                        dismissed = true
                        break
                    }
                }
            }

            // 3. 都没命中，pressBack 兜底
            if (!dismissed) {
                Log.d(TAG, "dismissPopup round=$round 无命中，pressBack 兜底")
                service.pressBack()
            }

            delay(NAV_SETTLE_MS)
        }
    }

    companion object {
        private const val TAG = "龙爪"

        /** 整个流程最多允许多久。超过即放弃，避免长尾任务卡死。 */
        private const val OVERALL_TIMEOUT_MS = 90_000L
        private const val LONG_WAIT_MS = 10_000L
        private const val SHORT_WAIT_MS = 3_000L
        private const val LAUNCH_SETTLE_MS = 1_500L
        private const val NAV_SETTLE_MS = 800L
        private const val STEP_INTERVAL_MS = 250L
        private const val EPSILON = 0.001

        /** 弹窗关闭最多尝试几轮。美团偶尔会叠 2-3 层弹窗。 */
        private const val MAX_POPUP_ROUNDS = 3
        /** 探测弹窗按钮的超短超时，避免每个候选都等太久。 */
        private const val POPUP_PROBE_MS = 1_000L
    }
}
