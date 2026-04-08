package com.longclaw.app.security

import android.util.Log

/**
 * 支付安全守卫。
 *
 * **质量铁律（来自交接文档第 3 条质量要求）：**
 *  > PaymentGuard 的支付包名黑名单不可删除或注释。
 *
 * 任何走自动化路径的代码都必须在执行可能影响资金的动作前调用
 * [isPaymentPackage] 或 [assertNotPayment]。一旦目标 App 是支付通道，
 * 龙爪立刻放手，让用户亲自完成。这是龙爪与用户之间最重要的信任边界。
 */
object PaymentGuard {

    private const val TAG = "龙爪"

    /**
     * 支付通道包名黑名单。**禁止删除、注释、合并到其他列表。**
     *
     * 名单覆盖：
     *  - 微信 / 支付宝 / 银联云闪付 / 京东支付
     *  - 银行 App 的常见支付包名
     *  - 美团、京东、淘宝里嵌套调起支付时的独立 Activity 容器
     *
     * 增列只能向上扩展，不能向下缩减。
     */
    val PAYMENT_PACKAGE_BLACKLIST: Set<String> = setOf(
        // 第三方支付
        "com.tencent.mm",                       // 微信
        "com.eg.android.AlipayGphone",          // 支付宝
        "com.unionpay",                         // 云闪付
        "com.jingdong.app.mall.pay",            // 京东支付（独立进程）
        "com.tencent.mobileqq",                 // QQ 钱包
        // 银行类（覆盖前 6 大行 + 招行）
        "com.icbc",                             // 工行
        "com.chinamworld.bocmbci",              // 中行
        "com.android.bankabc",                  // 农行
        "com.chinamworld.main",                 // 建行
        "cmb.pb",                               // 招行专业版
        "com.cmbchina.ccd.pluto.cmbActivity",   // 招行掌上生活
        "com.bocom.bbcmobilebank",              // 交行
        // 系统级支付/扫一扫
        "com.android.systemui",                 // SystemUI 的支付浮窗
        "com.huawei.wallet",                    // 华为钱包
        "com.xiaomi.payment",                   // 小米钱包
        "com.coloros.wallet",                   // OPPO 钱包
        "com.vivo.wallet",                      // vivo 钱包
    )

    /**
     * 用于在 App 内部 UI 文案上做兜底匹配。命中也表示已经踩到支付边界。
     */
    val PAYMENT_TEXT_BLACKLIST: List<String> = listOf(
        "请输入支付密码",
        "确认付款",
        "指纹支付",
        "刷脸支付",
        "立即支付",
    )

    /** 包名是否在黑名单中。null 视为非支付。 */
    @JvmStatic
    fun isPaymentPackage(packageName: String?): Boolean {
        if (packageName.isNullOrEmpty()) return false
        val hit = packageName in PAYMENT_PACKAGE_BLACKLIST
        if (hit) Log.w(TAG, "PaymentGuard 命中支付包名黑名单: $packageName")
        return hit
    }

    /** 文案是否包含支付关键词。 */
    @JvmStatic
    fun isPaymentText(text: CharSequence?): Boolean {
        if (text.isNullOrEmpty()) return false
        return PAYMENT_TEXT_BLACKLIST.any { text.contains(it) }
    }

    /**
     * 断言当前不在支付页。命中即抛 [PaymentBoundaryReached]，
     * 调用方负责把它捕获并把任务标记为「等待用户支付」。
     */
    @JvmStatic
    fun assertNotPayment(packageName: String?) {
        if (isPaymentPackage(packageName)) {
            throw PaymentBoundaryReached("已进入支付页面 pkg=$packageName，龙爪退出操作")
        }
    }

    /** 显式信号：脚本主动撞到支付边界。**不要把它当一般异常吃掉。** */
    class PaymentBoundaryReached(message: String) : RuntimeException(message)
}
