package com.longclaw.app.nlp

import android.util.Log
import com.longclaw.app.adapter.meituan.MeituanOrderRequest

/**
 * 极简版意图解析器（MVP-1 用）。
 *
 * MVP-1 不接 LLM，靠规则就够了：用户在首页输入“帮我点海底捞外卖”→ 我们识别出
 * 「外卖」+ 「海底捞」即可。后续阶段会替换为云端 LLM/Function-Call。
 *
 * 解析结果分三类：
 *  - [Intent.MeituanOrder]   —— 走 [com.longclaw.app.adapter.meituan.MeituanAdapter]
 *  - [Intent.Unknown]        —— 没听懂，让用户重说
 *  - [Intent.Rejected]       —— 命中危险词（“支付”“转账”等）→ 我们直接拒绝
 */
object IntentParser {

    private const val TAG = "龙爪"

    sealed interface Intent {
        data class MeituanOrder(val request: MeituanOrderRequest) : Intent
        data class Unknown(val rawText: String) : Intent
        data class Rejected(val reason: String) : Intent
    }

    private val DELIVERY_KEYWORDS = listOf("点外卖", "点餐", "外卖", "送餐", "点一份", "下单")
    private val DANGEROUS_KEYWORDS = listOf("付款", "支付", "转账", "汇款", "输入密码", "扫脸")
    private val STOP_WORDS = setOf(
        "帮我", "我要", "请", "麻烦", "一下", "一份", "一杯", "一瓶",
        "外卖", "点", "下单", "送", "到", "给我", "的",
    )

    fun parse(rawText: String): Intent {
        val text = rawText.trim()
        if (text.isEmpty()) {
            return Intent.Unknown(rawText)
        }
        Log.d(TAG, "IntentParser.parse text=\"$text\"")

        // 1. 拒绝危险意图
        DANGEROUS_KEYWORDS.firstOrNull { text.contains(it) }?.let { word ->
            Log.w(TAG, "IntentParser 拒绝指令：命中危险词 $word")
            return Intent.Rejected("龙爪不会代您完成与支付/转账有关的操作。")
        }

        // 2. 是否是外卖意图？
        val isDelivery = DELIVERY_KEYWORDS.any { text.contains(it) }
        if (isDelivery) {
            val keyword = extractKeyword(text)
            if (keyword.isBlank()) {
                return Intent.Unknown(rawText)
            }
            val maxPrice = extractMaxPrice(text)
            return Intent.MeituanOrder(
                MeituanOrderRequest(
                    keyword = keyword,
                    dishName = null,
                    maxPrice = maxPrice,
                    quantity = extractQuantity(text),
                ),
            )
        }

        // 3. 兜底：可能用户只说了商家名，比如“海底捞” → 视为外卖意图
        val keyword = extractKeyword(text)
        return if (keyword.isNotBlank()) {
            Intent.MeituanOrder(
                MeituanOrderRequest(keyword = keyword, quantity = 1),
            )
        } else {
            Intent.Unknown(rawText)
        }
    }

    /** 把停用词剥掉，返回剩下的“主题词”。比如 “帮我点一份海底捞外卖” → “海底捞”。 */
    private fun extractKeyword(text: String): String {
        var t = text
        STOP_WORDS.forEach { w -> t = t.replace(w, " ") }
        // 把数字 + 单价信息也去掉
        t = t.replace(Regex("\\d+(?:\\.\\d+)?元?"), " ")
        t = t.replace(Regex("[，,。.！!？?]"), " ")
        return t.trim().split(Regex("\\s+")).firstOrNull().orEmpty()
    }

    /** 抽取“xx 元以内/不超过 xx”这类价格上限。失败返回 null。 */
    private fun extractMaxPrice(text: String): Double? {
        val patterns = listOf(
            Regex("不超过\\s*(\\d+(?:\\.\\d+)?)\\s*元"),
            Regex("(\\d+(?:\\.\\d+)?)\\s*元以内"),
            Regex("(\\d+(?:\\.\\d+)?)\\s*块以内"),
        )
        for (p in patterns) {
            val m = p.find(text) ?: continue
            return m.groupValues[1].toDoubleOrNull()
        }
        return null
    }

    /** 抽取数量，例如 “两份”/“3 杯”。失败返回 1。 */
    private fun extractQuantity(text: String): Int {
        val cn = mapOf("两" to 2, "二" to 2, "三" to 3, "四" to 4, "五" to 5)
        cn.forEach { (k, v) -> if (text.contains("${k}份") || text.contains("${k}杯")) return v }
        val m = Regex("(\\d+)\\s*[份杯瓶个]").find(text) ?: return 1
        return m.groupValues[1].toIntOrNull() ?: 1
    }
}
