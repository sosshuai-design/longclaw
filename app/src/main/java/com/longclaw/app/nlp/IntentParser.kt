package com.longclaw.app.nlp

import android.util.Log
import com.longclaw.app.adapter.meituan.MeituanOrderRequest
import com.longclaw.app.nlp.llm.LlmClient
import org.json.JSONObject

/**
 * 意图解析器（MVP-1 LLM 接入版）。
 *
 * 调用链：
 *  1. **本地敏感词预检**。命中支付/转账/密码类关键词 → 直接 [Intent.Rejected]，
 *     绝不把这些原文发给任何远端模型（防止日志留痕与误操作）。
 *  2. **LLM 解析**（若 [llmClient] 存在且已配置）。输出严格 JSON，
 *     包含 intent / keyword / dishName / maxPrice / quantity 等字段。
 *  3. **规则兜底**。LLM 不可用、超时、JSON 解析失败时退化到 [RuleIntentParser]，
 *     保持 App 在离线 / 未配置密钥时仍能工作。
 */
class IntentParser(
    private val llmClient: LlmClient?,
) {

    sealed interface Intent {
        data class MeituanOrder(val request: MeituanOrderRequest) : Intent
        data class Unknown(val rawText: String) : Intent
        data class Rejected(val reason: String) : Intent
    }

    suspend fun parse(rawText: String): Intent {
        val text = rawText.trim()
        if (text.isEmpty()) return Intent.Unknown(rawText)
        Log.d(TAG, "IntentParser.parse len=${text.length}")

        // ── 1. 本地敏感词预检（永远先跑，绝不走网络） ───────────────────
        DANGEROUS_KEYWORDS.firstOrNull { text.contains(it) }?.let { word ->
            Log.w(TAG, "IntentParser 拒绝：本地命中危险词 $word")
            return Intent.Rejected("龙爪不会代您完成与支付/转账有关的操作。")
        }

        // ── 2. LLM 解析 ────────────────────────────────────────────
        if (llmClient != null && llmClient.isConfigured()) {
            val parsed = tryParseWithLlm(text)
            if (parsed != null) return parsed
            Log.i(TAG, "LLM 未给出可用结果，回退到规则解析")
        }

        // ── 3. 规则兜底 ────────────────────────────────────────────
        return RuleIntentParser.parse(text)
    }

    private suspend fun tryParseWithLlm(userText: String): Intent? {
        val raw = llmClient?.complete(SYSTEM_PROMPT, userText) ?: return null
        return parseLlmJson(raw)
    }

    /** 把模型返回的内容解析成 [Intent]。失败返回 null 让上层走规则。 */
    private fun parseLlmJson(raw: String): Intent? {
        val jsonText = extractJsonObject(raw) ?: return null
        return try {
            val obj = JSONObject(jsonText)
            when (obj.optString("intent")) {
                "meituan_order" -> {
                    val keyword = obj.optString("keyword").trim()
                    if (keyword.isBlank()) return Intent.Unknown(raw)
                    val dish = obj.optString("dish_name").trim().ifBlank { null }
                    val maxPrice = obj.optDouble("max_price", Double.NaN)
                        .takeIf { !it.isNaN() && it > 0 }
                    val quantity = obj.optInt("quantity", 1).coerceAtLeast(1)
                    Intent.MeituanOrder(
                        MeituanOrderRequest(
                            keyword = keyword,
                            dishName = dish,
                            maxPrice = maxPrice,
                            quantity = quantity,
                        ),
                    )
                }
                "rejected" -> {
                    val reason = obj.optString("rejection_reason")
                        .ifBlank { "龙爪拒绝了这条指令。" }
                    Intent.Rejected(reason)
                }
                else -> Intent.Unknown(raw)
            }
        } catch (t: Throwable) {
            Log.w(TAG, "LLM JSON 解析失败: ${t.message}")
            null
        }
    }

    /** 把模型响应里的 ```json ... ``` 包裹剥掉，只留 `{...}` 部分。 */
    private fun extractJsonObject(raw: String): String? {
        val start = raw.indexOf('{')
        val end = raw.lastIndexOf('}')
        if (start < 0 || end <= start) return null
        return raw.substring(start, end + 1)
    }

    companion object {
        private const val TAG = "龙爪"

        private val DANGEROUS_KEYWORDS = listOf(
            "付款", "支付", "转账", "汇款", "输入密码", "扫脸", "刷脸", "输密码",
        )

        /**
         * System prompt。刻意写得极短：让模型知道它只输出 JSON，别多嘴。
         * 返回字段：
         *   intent        : "meituan_order" | "unknown" | "rejected"
         *   keyword       : 商家/品类关键词，例如 "海底捞" "麻辣烫"
         *   dish_name     : 具体菜品名；用户没点名就给 null
         *   max_price     : 价格上限（元）；没明说就给 null
         *   quantity      : 份数，整数，默认 1
         *   rejection_reason: 拒绝原因（仅 intent=rejected 时有值）
         */
        private const val SYSTEM_PROMPT = """
你是「龙爪」App 的意图解析器。用户会用自然语言告诉你要做什么，你的唯一任务是输出 **严格 JSON**，不要解释。

Schema：
{
  "intent": "meituan_order" | "unknown" | "rejected",
  "keyword": string | null,
  "dish_name": string | null,
  "max_price": number | null,
  "quantity": integer,
  "rejection_reason": string | null
}

规则：
- 只要涉及"点外卖 / 点餐 / 下单 / 点一份 / 送餐"，归类为 meituan_order。
- keyword 取商家名或品类，例如 "海底捞"、"麻辣烫"、"麦当劳"。
- 用户明确说到某个菜（如"麦辣鸡腿堡"）时，把菜名写到 dish_name。
- 用户说了价格上限（"不超过 30 元"、"30 元以内"）时，max_price 填数字，单位始终是元。
- 默认 quantity=1；"两份/三杯/2 份" 等转成对应整数。
- 任何涉及支付、转账、密码、人脸识别的请求：intent="rejected"，rejection_reason 写清理由。
- 听不懂的请求：intent="unknown"。
- 只能返回 JSON，不要输出 Markdown 代码围栏，不要加解释文字。
"""
    }
}
