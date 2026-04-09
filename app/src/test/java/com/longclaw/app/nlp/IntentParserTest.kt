package com.longclaw.app.nlp

import com.longclaw.app.nlp.IntentParser.Intent
import com.longclaw.app.nlp.llm.LlmClient
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * 端到端单元测试 [IntentParser]。
 *
 * 测试策略：
 *  - 用 [FakeLlmClient] 固定 LLM 返回内容，覆盖合法/非法/空/带 Markdown 围栏
 *    等各种响应形态。
 *  - 用 `llmClient = null` / `isConfigured() = false` 两条路径验证"LLM 不可用
 *    时必须走规则兜底"。
 *  - 本地敏感词预检必须**先**于 LLM 调用触发，验证方法是看 FakeLlmClient 有没
 *    有被调用过。
 */
class IntentParserTest {

    // ─── dangerous keyword short-circuit ────────────────────────────

    @Test
    fun `dangerous keyword 支付 rejects before calling LLM`() = runBlocking {
        val fake = FakeLlmClient(response = """{"intent":"meituan_order","keyword":"海底捞"}""")
        val parser = IntentParser(fake)
        val result = parser.parse("帮我完成支付宝付款")
        assertTrue(result is Intent.Rejected)
        assertFalse("敏感词预检必须在 LLM 之前截断", fake.wasCalled)
    }

    @Test
    fun `dangerous keyword 转账 is rejected`() = runBlocking {
        val parser = IntentParser(FakeLlmClient(response = "whatever"))
        val result = parser.parse("帮我转账给张三 500 块")
        assertTrue(result is Intent.Rejected)
    }

    @Test
    fun `dangerous keyword 刷脸 is rejected`() = runBlocking {
        val parser = IntentParser(FakeLlmClient(response = "whatever"))
        val result = parser.parse("用刷脸完成登录")
        assertTrue(result is Intent.Rejected)
    }

    // ─── empty / whitespace guards ───────────────────────────────────

    @Test
    fun `empty text returns Unknown without touching LLM`() = runBlocking {
        val fake = FakeLlmClient(response = "ignored")
        val parser = IntentParser(fake)
        val result = parser.parse("   ")
        assertTrue(result is Intent.Unknown)
        assertFalse(fake.wasCalled)
    }

    // ─── LLM happy-path ─────────────────────────────────────────────

    @Test
    fun `LLM meituan_order JSON parsed into MeituanOrder`() = runBlocking {
        val json = """
            {
              "intent": "meituan_order",
              "keyword": "海底捞",
              "dish_name": "毛肚",
              "max_price": 88.0,
              "quantity": 2
            }
        """.trimIndent()
        val parser = IntentParser(FakeLlmClient(json))
        val result = parser.parse("帮我点海底捞毛肚两份，不超过 88 元")

        assertTrue(result is Intent.MeituanOrder)
        val req = (result as Intent.MeituanOrder).request
        assertEquals("海底捞", req.keyword)
        assertEquals("毛肚", req.dishName)
        assertEquals(88.0, req.maxPrice!!, 0.001)
        assertEquals(2, req.quantity)
    }

    @Test
    fun `LLM rejected JSON parsed into Rejected with reason`() = runBlocking {
        val json = """{"intent":"rejected","rejection_reason":"涉及充值不能做"}"""
        val parser = IntentParser(FakeLlmClient(json))
        val result = parser.parse("帮我充 100 元话费")
        assertTrue(result is Intent.Rejected)
        assertEquals("涉及充值不能做", (result as Intent.Rejected).reason)
    }

    @Test
    fun `LLM rejected JSON without reason uses default message`() = runBlocking {
        val json = """{"intent":"rejected"}"""
        val parser = IntentParser(FakeLlmClient(json))
        val result = parser.parse("一些奇怪请求")
        assertTrue(result is Intent.Rejected)
        assertTrue((result as Intent.Rejected).reason.isNotBlank())
    }

    @Test
    fun `LLM response wrapped in markdown fence still parses`() = runBlocking {
        // DeepSeek / OpenAI 偶尔不听话会套一层 ```json ... ```；extractJsonObject 应该剥掉
        val raw = """
            好的，这是结果：
            ```json
            {"intent":"meituan_order","keyword":"麦当劳"}
            ```
        """.trimIndent()
        val parser = IntentParser(FakeLlmClient(raw))
        val result = parser.parse("点麦当劳")
        assertTrue(result is Intent.MeituanOrder)
        assertEquals("麦当劳", (result as Intent.MeituanOrder).request.keyword)
    }

    @Test
    fun `meituan_order with empty keyword degrades to Unknown`() = runBlocking {
        // LLM 交差敷衍——keyword 空串，IntentParser 不能当真
        val json = """{"intent":"meituan_order","keyword":"","quantity":1}"""
        val parser = IntentParser(FakeLlmClient(json))
        val result = parser.parse("点个东西")
        assertTrue(result is Intent.Unknown)
    }

    @Test
    fun `meituan_order defaults quantity to 1 when missing`() = runBlocking {
        val json = """{"intent":"meituan_order","keyword":"肯德基"}"""
        val parser = IntentParser(FakeLlmClient(json))
        val result = parser.parse("点肯德基")
        assertTrue(result is Intent.MeituanOrder)
        val req = (result as Intent.MeituanOrder).request
        assertEquals(1, req.quantity)
        assertNull(req.maxPrice)
        assertNull(req.dishName)
    }

    @Test
    fun `unknown intent from LLM maps to Unknown`() = runBlocking {
        val json = """{"intent":"weather","city":"北京"}"""
        val parser = IntentParser(FakeLlmClient(json))
        val result = parser.parse("北京今天天气怎么样")
        assertTrue(result is Intent.Unknown)
    }

    // ─── fallback when LLM path unusable ────────────────────────────

    @Test
    fun `malformed JSON from LLM falls back to rule parser`() = runBlocking {
        val parser = IntentParser(FakeLlmClient(response = "not json at all"))
        val result = parser.parse("帮我点外卖麦当劳")
        // 规则兜底应该识别成 MeituanOrder(keyword="麦当劳")
        assertTrue(result is Intent.MeituanOrder)
        assertEquals("麦当劳", (result as Intent.MeituanOrder).request.keyword)
    }

    @Test
    fun `null llmClient goes straight to rule parser`() = runBlocking {
        val parser = IntentParser(llmClient = null)
        val result = parser.parse("帮我点外卖肯德基")
        assertTrue(result is Intent.MeituanOrder)
        assertEquals("肯德基", (result as Intent.MeituanOrder).request.keyword)
    }

    @Test
    fun `unconfigured llmClient skips LLM and uses rules`() = runBlocking {
        val fake = FakeLlmClient(response = "never returned", configured = false)
        val parser = IntentParser(fake)
        val result = parser.parse("帮我点外卖星巴克")
        assertTrue(result is Intent.MeituanOrder)
        assertFalse("isConfigured=false 时不应调用 complete()", fake.wasCalled)
    }

    @Test
    fun `LLM returning null falls back to rule parser`() = runBlocking {
        // 模拟网络异常/超时：OpenAiCompatibleLlmClient.complete() 会返回 null
        val parser = IntentParser(FakeLlmClient(response = null))
        val result = parser.parse("帮我点外卖海底捞")
        assertTrue(result is Intent.MeituanOrder)
        assertEquals("海底捞", (result as Intent.MeituanOrder).request.keyword)
    }
}

/**
 * 测试专用的 LlmClient 替身。
 *  - 通过构造参数固定一次请求的返回；`null` 代表 LLM 侧异常被吞掉。
 *  - 记录是否被调用过，用于验证敏感词预检必须在 LLM 之前截断。
 */
private class FakeLlmClient(
    private val response: String?,
    private val configured: Boolean = true,
) : LlmClient {
    var wasCalled: Boolean = false
        private set

    override fun isConfigured(): Boolean = configured

    override suspend fun complete(systemPrompt: String, userPrompt: String): String? {
        wasCalled = true
        return response
    }
}
