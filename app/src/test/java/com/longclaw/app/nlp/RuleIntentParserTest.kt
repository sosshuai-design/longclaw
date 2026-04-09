package com.longclaw.app.nlp

import com.longclaw.app.nlp.IntentParser.Intent
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * 规则解析器的单元测试。目标是把 MVP-1 所有真正投产的话术固定下来，
 * 以后动 STOP_WORDS / regex 时这些测试就是 safety net。
 *
 * 注：测试里只断言我们**承诺给用户的外部行为**（哪段意图、价格上限、份数），
 * 不去较真 `extractKeyword` 把生僻语序切成什么样——那属于实现细节。
 */
class RuleIntentParserTest {

    @Test
    fun `empty input falls through to Unknown`() {
        val result = RuleIntentParser.parse("")
        assertTrue("空输入应为 Unknown", result is Intent.Unknown)
    }

    @Test
    fun `blank input falls through to Unknown`() {
        val result = RuleIntentParser.parse("   \n  ")
        assertTrue(result is Intent.Unknown)
    }

    @Test
    fun `simple delivery request extracts store keyword`() {
        val result = RuleIntentParser.parse("帮我点外卖麦当劳")
        assertTrue(result is Intent.MeituanOrder)
        val order = (result as Intent.MeituanOrder).request
        assertEquals("麦当劳", order.keyword)
        assertEquals(1, order.quantity)
        assertNull(order.maxPrice)
        assertNull(order.dishName)
    }

    @Test
    fun `bare store name falls back to MeituanOrder intent`() {
        // 用户没有说 "点外卖"，只丢了一个商家名——规则兜底也应该当外卖处理
        val result = RuleIntentParser.parse("海底捞")
        assertTrue(result is Intent.MeituanOrder)
        assertEquals("海底捞", (result as Intent.MeituanOrder).request.keyword)
    }

    @Test
    fun `maxPrice parsed from X元以内 phrase`() {
        val result = RuleIntentParser.parse("点外卖肯德基30元以内")
        assertTrue(result is Intent.MeituanOrder)
        val req = (result as Intent.MeituanOrder).request
        assertEquals(30.0, req.maxPrice!!, 0.001)
        // 关键词至少包含商家名，不做完全相等断言以免实现微调就挂
        assertTrue("keyword 应包含 '肯德基'", req.keyword.contains("肯德基"))
    }

    @Test
    fun `maxPrice parsed from 不超过X元 phrase with decimal`() {
        val result = RuleIntentParser.parse("帮我点外卖星巴克不超过25.5元")
        assertTrue(result is Intent.MeituanOrder)
        val req = (result as Intent.MeituanOrder).request
        assertNotNull(req.maxPrice)
        assertEquals(25.5, req.maxPrice!!, 0.001)
    }

    @Test
    fun `maxPrice parsed from X块以内 phrase`() {
        val result = RuleIntentParser.parse("点外卖瑞幸20块以内")
        assertTrue(result is Intent.MeituanOrder)
        assertEquals(20.0, (result as Intent.MeituanOrder).request.maxPrice!!, 0.001)
    }

    @Test
    fun `no price phrase keeps maxPrice null`() {
        val result = RuleIntentParser.parse("帮我点外卖麦当劳")
        val req = (result as Intent.MeituanOrder).request
        assertNull("没提价格时 maxPrice 应为 null", req.maxPrice)
    }

    @Test
    fun `chinese quantity 两份 maps to 2`() {
        val result = RuleIntentParser.parse("点外卖肯德基 两份")
        assertEquals(2, (result as Intent.MeituanOrder).request.quantity)
    }

    @Test
    fun `chinese quantity 三杯 maps to 3`() {
        val result = RuleIntentParser.parse("点外卖喜茶 三杯")
        assertEquals(3, (result as Intent.MeituanOrder).request.quantity)
    }

    @Test
    fun `arabic quantity 2份 maps to 2`() {
        val result = RuleIntentParser.parse("点外卖星巴克 2份")
        assertEquals(2, (result as Intent.MeituanOrder).request.quantity)
    }

    @Test
    fun `default quantity is 1 when unspecified`() {
        val result = RuleIntentParser.parse("点外卖肯德基")
        assertEquals(1, (result as Intent.MeituanOrder).request.quantity)
    }
}
