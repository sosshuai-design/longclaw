package com.longclaw.app.nlp

import android.util.Log
import com.longclaw.app.adapter.meituan.MeituanOrderRequest

/**
 * 规则版意图解析器。MVP-1 的兜底路径：当 LLM 不可用/超时/返回非法 JSON 时，
 * 我们还能保证"帮我点海底捞"这种最常见的指令不掉链子。
 *
 * **注意**：调用方必须先做过敏感词预检。本文件不再重复做 reject 逻辑，避免
 * 行为分叉。
 */
object RuleIntentParser {

    private const val TAG = "龙爪"

    private val DELIVERY_KEYWORDS = listOf("点外卖", "点餐", "外卖", "送餐", "点一份", "下单")
    private val STOP_WORDS = setOf(
        "帮我", "我要", "请", "麻烦", "一下", "一份", "一杯", "一瓶",
        "外卖", "点", "下单", "送", "到", "给我", "的",
    )

    fun parse(rawText: String): IntentParser.Intent {
        val text = rawText.trim()
        if (text.isEmpty()) return IntentParser.Intent.Unknown(rawText)
        Log.d(TAG, "RuleIntentParser.parse len=${text.length}")

        val isDelivery = DELIVERY_KEYWORDS.any { text.contains(it) }
        if (isDelivery) {
            val keyword = extractKeyword(text)
            if (keyword.isBlank()) return IntentParser.Intent.Unknown(rawText)
            return IntentParser.Intent.MeituanOrder(
                MeituanOrderRequest(
                    keyword = keyword,
                    dishName = null,
                    maxPrice = extractMaxPrice(text),
                    quantity = extractQuantity(text),
                ),
            )
        }
        // 兜底：用户只说了商家名 → 视为外卖意图
        val keyword = extractKeyword(text)
        return if (keyword.isNotBlank()) {
            IntentParser.Intent.MeituanOrder(
                MeituanOrderRequest(keyword = keyword, quantity = 1),
            )
        } else {
            IntentParser.Intent.Unknown(rawText)
        }
    }

    private fun extractKeyword(text: String): String {
        var t = text
        STOP_WORDS.forEach { w -> t = t.replace(w, " ") }
        t = t.replace(Regex("\\d+(?:\\.\\d+)?元?"), " ")
        t = t.replace(Regex("[，,。.！!？?]"), " ")
        return t.trim().split(Regex("\\s+")).firstOrNull().orEmpty()
    }

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

    private fun extractQuantity(text: String): Int {
        val cn = mapOf("两" to 2, "二" to 2, "三" to 3, "四" to 4, "五" to 5)
        cn.forEach { (k, v) -> if (text.contains("${k}份") || text.contains("${k}杯")) return v }
        val m = Regex("(\\d+)\\s*[份杯瓶个]").find(text) ?: return 1
        return m.groupValues[1].toIntOrNull() ?: 1
    }
}
