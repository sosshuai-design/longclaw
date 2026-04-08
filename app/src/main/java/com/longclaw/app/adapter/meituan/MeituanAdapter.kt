package com.longclaw.app.adapter.meituan

import android.util.Log
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

        // 步骤 2：处理隐私弹窗（首次安装才有）
        Log.i(TAG, "[2/10] DismissPopups")
        service.clickByViewId(
            MeituanSelectors.ID_PRIVACY_AGREE,
            timeoutMs = SHORT_WAIT_MS,
        )

        // 步骤 3：切到「外卖」Tab
        Log.i(TAG, "[3/10] SwitchToDelivery")
        if (!service.clickByText(MeituanSelectors.TEXT_TAB_DELIVERY)) {
            return MeituanOrderResult.Failed(Stage.SwitchToDelivery, "找不到「外卖」入口")
        }

        // 步骤 4：搜索关键词
        Log.i(TAG, "[4/10] Search keyword=${request.keyword}")
        if (!service.clickByViewId(MeituanSelectors.ID_HOME_SEARCH_BOX)) {
            return MeituanOrderResult.Failed(Stage.Search, "找不到搜索框")
        }
        if (!service.inputText(MeituanSelectors.ID_SEARCH_INPUT, request.keyword)) {
            return MeituanOrderResult.Failed(Stage.Search, "搜索框输入失败")
        }
        service.clickByViewId(MeituanSelectors.ID_SEARCH_BUTTON)

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

        // 步骤 6：挑菜
        Log.i(TAG, "[6/10] PickDish dishName=${request.dishName} maxPrice=${request.maxPrice}")
        val dishKey = request.dishName ?: request.keyword
        val dishNode = service.waitForText(dishKey, timeoutMs = LONG_WAIT_MS)
            ?: return MeituanOrderResult.Failed(Stage.PickDish, "未在菜单里找到「$dishKey」")
        // MVP：价格上限只是日志提示，真正的过滤要等 Vision/OCR 模块。
        if (request.maxPrice != null) {
            Log.d(TAG, "PickDish: 价格上限=${request.maxPrice}（MVP 仅记录，未实际过滤）")
        }
        Log.d(TAG, "PickDish 命中节点 text=${dishNode.text}")

        // 步骤 7：加入购物车
        Log.i(TAG, "[7/10] AddToCart x${request.quantity}")
        repeat(request.quantity.coerceAtLeast(1)) { idx ->
            val ok = service.clickByViewId(MeituanSelectors.ID_DISH_ADD_BUTTON)
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

    companion object {
        private const val TAG = "龙爪"

        /** 整个流程最多允许多久。超过即放弃，避免长尾任务卡死。 */
        private const val OVERALL_TIMEOUT_MS = 90_000L
        private const val LONG_WAIT_MS = 10_000L
        private const val SHORT_WAIT_MS = 3_000L
        private const val LAUNCH_SETTLE_MS = 1_500L
        private const val NAV_SETTLE_MS = 800L
        private const val STEP_INTERVAL_MS = 250L
    }
}
