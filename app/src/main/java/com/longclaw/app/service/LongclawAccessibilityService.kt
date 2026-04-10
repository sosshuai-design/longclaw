package com.longclaw.app.service

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.content.Context
import android.graphics.Path
import android.graphics.Rect
import android.os.Bundle
import android.provider.Settings
import android.text.TextUtils
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import com.longclaw.app.security.PaymentGuard
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeout
import java.util.concurrent.atomic.AtomicReference
import kotlin.coroutines.resume

/**
 * 龙爪无障碍核心服务。
 *
 * 职责：
 *  1. 接收系统派发的 [AccessibilityEvent]，把当前前台 App 包名/根节点缓存下来供
 *     适配器（如 [com.longclaw.app.adapter.meituan.MeituanAdapter]）查询。
 *  2. 提供受超时保护的原子操作：waitForNode / clickById / clickByText / inputText /
 *     scrollUp / performGlobalBack / performGlobalHome / launchApp。
 *  3. 调用任何敏感动作前先经 [PaymentGuard] 检查；命中支付包名黑名单立即放手。
 *  4. 出现感兴趣窗口时，把节点树 dump 到 Logcat（TAG=龙爪），方便录脚本与排错。
 *
 * 所有 suspend 操作都包了 [withTimeout]，避免一次卡死把任务流程拖死。
 */
class LongclawAccessibilityService : AccessibilityService() {

    /** 服务自身的协程域；onDestroy 时整体取消。 */
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    /** 记录当前前台 App 包名，由窗口状态变更事件刷新。 */
    private val foregroundPackage = AtomicReference<String?>(null)

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        Log.i(TAG, "onServiceConnected: 龙爪无障碍服务已连接")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return
        val pkg = event.packageName?.toString()
        when (event.eventType) {
            AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> {
                if (!pkg.isNullOrEmpty()) {
                    foregroundPackage.set(pkg)
                    Log.d(TAG, "前台 App 切换 -> $pkg, class=${event.className}")
                    // 窗口刚切换时的节点树非常适合录制脚本与排错。
                    if (pkg in INTERESTING_PACKAGES) {
                        dumpNodeTree(rootInActiveWindow, reason = "WINDOW_STATE_CHANGED")
                    }
                }
            }
            AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED -> {
                // Content 事件极频繁，只在感兴趣 App 上做轻量日志。
                if (pkg != null && pkg in INTERESTING_PACKAGES) {
                    Log.v(TAG, "内容变更 pkg=$pkg src=${event.source?.viewIdResourceName}")
                }
            }
            else -> Unit
        }
    }

    override fun onInterrupt() {
        Log.w(TAG, "onInterrupt: 系统打断了无障碍服务")
    }

    override fun onDestroy() {
        Log.i(TAG, "onDestroy: 服务销毁，取消所有协程")
        scope.cancel()
        instance = null
        super.onDestroy()
    }

    // ─────────────────────────────────────────────────────────────────────
    // 公开 API：供 Adapter 调用
    // ─────────────────────────────────────────────────────────────────────

    fun currentForegroundPackage(): String? = foregroundPackage.get()

    /**
     * 等待指定 viewId 出现并可点击。命中后返回该节点；超时返回 null。
     */
    suspend fun waitForViewId(
        viewId: String,
        timeoutMs: Long = DEFAULT_WAIT_MS,
    ): AccessibilityNodeInfo? = runWithTimeoutOrNull(timeoutMs) {
        pollUntil(timeoutMs) {
            findFirstByViewId(rootInActiveWindow, viewId)
        }
    }

    /**
     * 等待包含给定文案的节点出现。
     */
    suspend fun waitForText(
        text: String,
        timeoutMs: Long = DEFAULT_WAIT_MS,
    ): AccessibilityNodeInfo? = runWithTimeoutOrNull(timeoutMs) {
        pollUntil(timeoutMs) {
            findFirstByText(rootInActiveWindow, text)
        }
    }

    suspend fun clickByViewId(
        viewId: String,
        timeoutMs: Long = DEFAULT_WAIT_MS,
    ): Boolean {
        guardAgainstPayment("clickByViewId($viewId)") ?: return false
        val node = waitForViewId(viewId, timeoutMs) ?: return false
        return performClickWithFallback(node)
    }

    suspend fun clickByText(
        text: String,
        timeoutMs: Long = DEFAULT_WAIT_MS,
    ): Boolean {
        guardAgainstPayment("clickByText($text)") ?: return false
        val node = waitForText(text, timeoutMs) ?: return false
        return performClickWithFallback(node)
    }

    suspend fun inputText(
        viewId: String,
        text: String,
        timeoutMs: Long = DEFAULT_WAIT_MS,
    ): Boolean {
        guardAgainstPayment("inputText($viewId)") ?: return false
        val node = waitForViewId(viewId, timeoutMs) ?: return false
        val args = Bundle().apply {
            putCharSequence(
                AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,
                text,
            )
        }
        val ok = node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)
        Log.d(TAG, "inputText -> ok=$ok viewId=$viewId text=$text")
        return ok
    }

    suspend fun scrollUp(timeoutMs: Long = DEFAULT_WAIT_MS): Boolean = runWithTimeoutOrFalse(timeoutMs) {
        val root = rootInActiveWindow ?: return@runWithTimeoutOrFalse false
        val scrollable = findFirstScrollable(root) ?: return@runWithTimeoutOrFalse false
        scrollable.performAction(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD)
    }

    /** 模拟按系统返回键。用于关闭广告弹窗 / 浮层。 */
    fun pressBack(): Boolean {
        val ok = performGlobalAction(GLOBAL_ACTION_BACK)
        Log.d(TAG, "pressBack -> ok=$ok")
        return ok
    }

    /**
     * 直接点一个已经拿到的节点（带支付守卫与坐标兜底）。适配器如果先做了
     * 复杂的节点筛选（如挑出价格 ≤ X 的菜），会拿到一个具体节点再丢进来。
     */
    suspend fun clickNode(node: AccessibilityNodeInfo): Boolean {
        guardAgainstPayment("clickNode(${node.viewIdResourceName})") ?: return false
        return performClickWithFallback(node)
    }

    /**
     * 在当前根节点下查找所有匹配 viewId 的节点。MeituanAdapter 的强价格比较
     * 需要枚举一整列的菜品节点，然后逐个对比文案。
     */
    fun findAllByViewId(viewId: String): List<AccessibilityNodeInfo> {
        val root = rootInActiveWindow ?: return emptyList()
        return root.findAccessibilityNodeInfosByViewId(viewId).orEmpty()
    }

    /** 同上，但只查名字包含 [text] 的节点。 */
    fun findAllByText(text: String): List<AccessibilityNodeInfo> {
        val root = rootInActiveWindow ?: return emptyList()
        return root.findAccessibilityNodeInfosByText(text).orEmpty()
    }

    /**
     * 在某个父节点的整棵子树里找第一个 id 等于 [viewId] 的子节点。用来从
     * 「菜品行」的容器里同时拿到 dish_name / dish_price / dish_add 等兄弟节点。
     */
    fun findDescendantByViewId(
        parent: AccessibilityNodeInfo,
        viewId: String,
    ): AccessibilityNodeInfo? {
        if (parent.viewIdResourceName == viewId) return parent
        for (i in 0 until parent.childCount) {
            val c = parent.getChild(i) ?: continue
            findDescendantByViewId(c, viewId)?.let { return it }
        }
        return null
    }

    /**
     * 通用兜底点击：若节点本身不可点击，找到坐标手势点一下。
     */
    private suspend fun performClickWithFallback(node: AccessibilityNodeInfo): Boolean {
        if (node.isClickable) {
            val ok = node.performAction(AccessibilityNodeInfo.ACTION_CLICK)
            Log.d(TAG, "performClick (direct) ok=$ok id=${node.viewIdResourceName}")
            if (ok) return true
        }
        val rect = Rect().also(node::getBoundsInScreen)
        if (rect.isEmpty) return false
        return performTap(rect.exactCenterX(), rect.exactCenterY())
    }

    private suspend fun performTap(x: Float, y: Float): Boolean = runWithTimeoutOrFalse(2_000L) {
        suspendCancellableCoroutine { cont ->
            val path = Path().apply { moveTo(x, y) }
            val gesture = GestureDescription.Builder()
                .addStroke(GestureDescription.StrokeDescription(path, 0L, 60L))
                .build()
            val dispatched = dispatchGesture(
                gesture,
                object : GestureResultCallback() {
                    override fun onCompleted(gd: GestureDescription?) {
                        if (cont.isActive) cont.resume(true)
                    }

                    override fun onCancelled(gd: GestureDescription?) {
                        if (cont.isActive) cont.resume(false)
                    }
                },
                null,
            )
            if (!dispatched && cont.isActive) cont.resume(false)
        }
    }

    /**
     * 启动一个外部 App。返回是否成功发出 Intent。
     * 不在意启动后是否完整加载——后续 waitForViewId 自然会等待。
     */
    fun launchExternalApp(packageName: String): Boolean {
        // 先过支付黑名单：不允许由我们来主动启动支付类 App。
        if (PaymentGuard.isPaymentPackage(packageName)) {
            Log.w(TAG, "launchExternalApp 被支付守卫拦截 pkg=$packageName")
            return false
        }
        val intent = packageManager.getLaunchIntentForPackage(packageName)
        if (intent == null) {
            Log.w(TAG, "launchExternalApp 失败：未安装 $packageName")
            return false
        }
        intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
        startActivity(intent)
        Log.i(TAG, "launchExternalApp -> $packageName")
        return true
    }

    // ─────────────────────────────────────────────────────────────────────
    // 内部工具
    // ─────────────────────────────────────────────────────────────────────

    /**
     * 检测当前前台是否已落入支付类 App。命中即返回 null，调用方应立即停手。
     * 返回 Unit 表示放行。
     */
    private fun guardAgainstPayment(actionDesc: String): Unit? {
        val current = foregroundPackage.get() ?: return Unit
        if (PaymentGuard.isPaymentPackage(current)) {
            Log.w(TAG, "支付守卫拦截 action=$actionDesc currentPkg=$current")
            return null
        }
        return Unit
    }

    private suspend inline fun <T> pollUntil(
        totalMs: Long,
        crossinline block: () -> T?,
    ): T? {
        val start = System.currentTimeMillis()
        while (System.currentTimeMillis() - start < totalMs) {
            val result = block()
            if (result != null) return result
            delay(POLL_INTERVAL_MS)
        }
        return null
    }

    private suspend inline fun <T> runWithTimeoutOrNull(
        timeoutMs: Long,
        crossinline block: suspend () -> T?,
    ): T? = try {
        withTimeout(timeoutMs) { block() }
    } catch (e: TimeoutCancellationException) {
        Log.w(TAG, "操作超时 (${timeoutMs}ms)")
        null
    }

    private suspend inline fun runWithTimeoutOrFalse(
        timeoutMs: Long,
        crossinline block: suspend () -> Boolean,
    ): Boolean = try {
        withTimeout(timeoutMs) { block() }
    } catch (e: TimeoutCancellationException) {
        Log.w(TAG, "操作超时 (${timeoutMs}ms)")
        false
    }

    private fun findFirstByViewId(
        root: AccessibilityNodeInfo?,
        viewId: String,
    ): AccessibilityNodeInfo? {
        val r = root ?: return null
        val list = r.findAccessibilityNodeInfosByViewId(viewId)
        return list.firstOrNull()
    }

    private fun findFirstByText(
        root: AccessibilityNodeInfo?,
        text: String,
    ): AccessibilityNodeInfo? {
        val r = root ?: return null
        val list = r.findAccessibilityNodeInfosByText(text)
        return list.firstOrNull { node ->
            !TextUtils.isEmpty(node.text) && node.text.toString().contains(text)
        } ?: list.firstOrNull()
    }

    private fun findFirstScrollable(root: AccessibilityNodeInfo): AccessibilityNodeInfo? {
        if (root.isScrollable) return root
        for (i in 0 until root.childCount) {
            val c = root.getChild(i) ?: continue
            findFirstScrollable(c)?.let { return it }
        }
        return null
    }

    /**
     * 把当前根节点的节点树打印到 Logcat。MVP-1 的关键调试输出。
     */
    private fun dumpNodeTree(root: AccessibilityNodeInfo?, reason: String) {
        if (root == null) {
            Log.d(TAG, "dumpNodeTree[$reason]: root 为空")
            return
        }
        Log.i(TAG, "── 节点树 dump 开始 [$reason] pkg=${root.packageName} ──")
        dumpNodeRecursive(root, depth = 0, maxDepth = MAX_DUMP_DEPTH)
        Log.i(TAG, "── 节点树 dump 结束 ──")
    }

    private fun dumpNodeRecursive(
        node: AccessibilityNodeInfo?,
        depth: Int,
        maxDepth: Int,
    ) {
        if (node == null || depth > maxDepth) return
        val indent = "  ".repeat(depth)
        val rect = Rect().also(node::getBoundsInScreen)
        val text = node.text?.toString()?.take(40)
        val desc = node.contentDescription?.toString()?.take(40)
        Log.d(
            TAG,
            "$indent<${node.className}> id=${node.viewIdResourceName} text=\"$text\" desc=\"$desc\" bounds=$rect clickable=${node.isClickable}",
        )
        for (i in 0 until node.childCount) {
            dumpNodeRecursive(node.getChild(i), depth + 1, maxDepth)
        }
    }

    companion object {
        const val TAG = "龙爪"
        const val DEFAULT_WAIT_MS = 8_000L
        const val POLL_INTERVAL_MS = 200L
        private const val MAX_DUMP_DEPTH = 25

        /** dump 节点树的目标 App 包名集合。 */
        private val INTERESTING_PACKAGES = setOf(
            "com.sankuai.meituan",
            "com.dianping.v1",
        )

        @Volatile
        private var instance: LongclawAccessibilityService? = null

        /** 适配器、ViewModel 通过该方法获取唯一实例；未连接时返回 null。 */
        fun get(): LongclawAccessibilityService? = instance

        /**
         * 通过读取系统 Settings 检查“龙爪无障碍服务”是否已经被启用。
         * 不依赖单例 [instance]，因为 ViewModel 可能在服务刚拉起时就查询。
         */
        fun isEnabled(context: Context): Boolean {
            val expected = "${context.packageName}/${LongclawAccessibilityService::class.java.name}"
            val enabledServices = Settings.Secure.getString(
                context.contentResolver,
                Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES,
            ) ?: return false
            return enabledServices.split(':').any { it.equals(expected, ignoreCase = true) }
        }
    }
}
