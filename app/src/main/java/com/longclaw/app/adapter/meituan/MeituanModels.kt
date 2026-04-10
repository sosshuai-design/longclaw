package com.longclaw.app.adapter.meituan

/**
 * 美团适配相关的数据模型 + 节点选择器常量。
 *
 * 设计原则（来自交接文档第 3 条质量要求）：
 *  - 所有 viewId / 文案常量都集中在 [MeituanSelectors]，不允许内联到 Adapter 里；
 *    一旦美团客户端改版，只改这里就够了。
 */

/** 用户输入解析后产出的“点外卖”任务参数。 */
data class MeituanOrderRequest(
    /** 关键词，例如 "海底捞"、"麦当劳麦辣鸡腿堡"。 */
    val keyword: String,
    /** 期望的菜品名称（可选，命中后会优先点选）。 */
    val dishName: String? = null,
    /** 限定价格上限，单位元；null 表示不限。 */
    val maxPrice: Double? = null,
    /** 是否只看“近距离”：MVP 暂时不区分距离，留作扩展位。 */
    val nearestOnly: Boolean = true,
    /** 期望几份。MVP 默认 1。 */
    val quantity: Int = 1,
)

/** 一次任务执行后回传给上层的结果。 */
sealed interface MeituanOrderResult {
    /** 已经把订单凑到“去结算”页，等待用户支付。 */
    data class ReadyForPayment(val storeName: String?, val totalPrice: String?) : MeituanOrderResult

    /** 任意一步失败：包括没找到节点、超时、被支付守卫拦截等。 */
    data class Failed(val stage: Stage, val message: String) : MeituanOrderResult

    /** 中途被用户/系统取消。 */
    data object Cancelled : MeituanOrderResult
}

/** 适配器执行进度阶段，便于上层渲染步骤指示器。 */
enum class Stage {
    Launch,
    DismissPopups,
    SwitchToDelivery,
    Search,
    PickStore,
    PickDish,
    AddToCart,
    OpenCart,
    Checkout,
    HandoffToUser,
}

/**
 * 美团 App 节点选择器。
 *
 * 提示：以下 viewId 来自 6.x 版本采样，**会随版本变化**。
 * 修改这里的常量是适配新版本的唯一入口。
 */
object MeituanSelectors {

    /** 美团主 App 包名。 */
    const val PACKAGE_MEITUAN = "com.sankuai.meituan"

    // ─── 启动后的隐私弹窗 / 首页 ─────────────────────────────
    const val ID_PRIVACY_AGREE = "$PACKAGE_MEITUAN:id/agree"
    const val TEXT_TAB_DELIVERY = "外卖"
    const val TEXT_TAB_HOME = "首页"

    // ─── 搜索流程 ──────────────────────────────────────────
    // viewId 候选：美团不同版本 id 不一样，按优先级依次尝试
    val ID_HOME_SEARCH_BOX_CANDIDATES = listOf(
        "$PACKAGE_MEITUAN:id/search_edit",
        "$PACKAGE_MEITUAN:id/search_text",
        "$PACKAGE_MEITUAN:id/search_bar",
        "$PACKAGE_MEITUAN:id/hotel_search_edit",
        "$PACKAGE_MEITUAN:id/search_container",
    )
    // 搜索框上的占位文案关键词，用于 viewId 全部 miss 时的文案兜底
    val TEXT_SEARCH_HINTS = listOf("搜索", "搜一搜", "搜索商家", "找商家")

    val ID_SEARCH_INPUT_CANDIDATES = listOf(
        "$PACKAGE_MEITUAN:id/search_edit_frame",
        "$PACKAGE_MEITUAN:id/search_input",
        "$PACKAGE_MEITUAN:id/search_edit",
        "$PACKAGE_MEITUAN:id/search_edit_text",
        "$PACKAGE_MEITUAN:id/search_src_text",
    )
    val ID_SEARCH_BUTTON_CANDIDATES = listOf(
        "$PACKAGE_MEITUAN:id/search_btn",
        "$PACKAGE_MEITUAN:id/search_button",
        "$PACKAGE_MEITUAN:id/right_btn",
    )
    val TEXT_SEARCH_BUTTON_HINTS = listOf("搜索", "搜一搜")
    const val ID_SEARCH_RESULT_LIST = "$PACKAGE_MEITUAN:id/recycler_view"
    const val ID_SEARCH_RESULT_ITEM_TITLE = "$PACKAGE_MEITUAN:id/title"

    // ─── 商家详情 ──────────────────────────────────────────
    const val ID_STORE_NAME = "$PACKAGE_MEITUAN:id/store_name"
    const val ID_STORE_DISH_LIST = "$PACKAGE_MEITUAN:id/dish_list"
    const val ID_DISH_TITLE = "$PACKAGE_MEITUAN:id/dish_name"
    const val ID_DISH_PRICE = "$PACKAGE_MEITUAN:id/dish_price"
    const val ID_DISH_ADD_BUTTON = "$PACKAGE_MEITUAN:id/dish_add"

    // ─── 购物车 / 结算 ──────────────────────────────────────
    const val ID_CART_ENTRY = "$PACKAGE_MEITUAN:id/cart_entry"
    const val TEXT_CHECKOUT_BUTTON = "去结算"
    const val ID_CHECKOUT_TOTAL_PRICE = "$PACKAGE_MEITUAN:id/total_price"
    const val TEXT_SUBMIT_ORDER = "提交订单"

    // ─── 广告弹窗 / 浮层关闭 ──────────────────────────────────
    // 美团各版本弹窗上常见的关闭按钮文案 / viewId
    val TEXT_POPUP_DISMISS = listOf(
        "关闭", "×", "X", "x", "跳过", "我知道了", "不再提示",
        "以后再说", "暂不", "取消", "稍后", "知道了",
    )
    val ID_POPUP_CLOSE_CANDIDATES = listOf(
        "$PACKAGE_MEITUAN:id/close",
        "$PACKAGE_MEITUAN:id/iv_close",
        "$PACKAGE_MEITUAN:id/btn_close",
        "$PACKAGE_MEITUAN:id/dialog_close",
        "$PACKAGE_MEITUAN:id/close_btn",
        "$PACKAGE_MEITUAN:id/close_button",
        "$PACKAGE_MEITUAN:id/img_close",
    )

    // ─── 风险信号：一旦看到这些就停手（多重保险，PaymentGuard 是底线） ───
    val PAYMENT_TEXT_SIGNALS: List<String> = listOf(
        "请输入支付密码",
        "指纹支付",
        "刷脸支付",
        "确认付款",
    )
}
