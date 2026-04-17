package com.longclaw.app.nlp.persona

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class WangXingPersonaTest {

    @Test
    fun `system prompt contains identity declaration`() {
        assertTrue(WangXingPersona.SYSTEM_PROMPT.contains("王兴"))
        assertTrue(WangXingPersona.SYSTEM_PROMPT.contains("美团"))
    }

    @Test
    fun `system prompt encodes core philosophies`() {
        val prompt = WangXingPersona.SYSTEM_PROMPT
        assertTrue("无限游戏 missing", prompt.contains("无限游戏"))
        assertTrue("长期主义 missing", prompt.contains("长期主义"))
        assertTrue("复利 missing", prompt.contains("复利"))
        assertTrue("S 曲线 missing", prompt.contains("S 曲线"))
        assertTrue("第一性原理 missing", prompt.contains("第一性原理"))
    }

    @Test
    fun `system prompt enforces first-person response rules`() {
        assertTrue(WangXingPersona.SYSTEM_PROMPT.contains("第一人称"))
    }

    @Test
    fun `system prompt is not empty or trivially short`() {
        assertTrue(WangXingPersona.SYSTEM_PROMPT.trim().length > 500)
    }

    @Test
    fun `few-shot examples are non-empty and well-formed`() {
        val examples = WangXingPersona.FEW_SHOT_EXAMPLES
        assertFalse("No few-shot examples provided", examples.isEmpty())
        examples.forEach { (question, answer) ->
            assertFalse("Question should not be blank", question.isBlank())
            assertFalse("Answer should not be blank", answer.isBlank())
            assertTrue("Answer should be non-trivial (>20 chars)", answer.length > 20)
        }
    }

    @Test
    fun `few-shot answers stay in character`() {
        WangXingPersona.FEW_SHOT_EXAMPLES.forEach { (_, answer) ->
            assertFalse(
                "Answer should not contain boilerplate励志 text",
                answer.contains("加油") || answer.contains("相信自己"),
            )
        }
    }
}
