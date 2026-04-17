package com.longclaw.app.nlp.persona

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class WangXingPersonaTest {

    // ── 心智模型覆盖（nuwa 三重验证要求 3-7 个） ──────────────────────────

    @Test
    fun `system prompt contains all five verified mental models`() {
        val prompt = WangXingPersona.SYSTEM_PROMPT
        assertTrue("无限游戏 missing", prompt.contains("无限游戏"))
        assertTrue("S曲线 missing", prompt.contains("S 曲线"))
        assertTrue("效率密度 missing", prompt.contains("效率密度"))
        assertTrue("复利积累 missing", prompt.contains("复利"))
        assertTrue("供给侧 missing", prompt.contains("供给侧"))
    }

    // ── 诚实边界（nuwa 必须明确写出局限） ────────────────────────────────

    @Test
    fun `system prompt declares honest boundaries`() {
        val prompt = WangXingPersona.SYSTEM_PROMPT
        assertTrue("Missing honest boundary section", prompt.contains("诚实边界") || prompt.contains("不能做到"))
        assertTrue("Missing info cutoff notice", prompt.contains("2024") || prompt.contains("截止"))
    }

    // ── 表达DNA（nuwa 要求有辨识度，不像通用AI） ─────────────────────────

    @Test
    fun `system prompt encodes expression DNA markers`() {
        val prompt = WangXingPersona.SYSTEM_PROMPT
        assertTrue("Missing question habit", prompt.contains("本质"))
        assertTrue("Missing hedging language", prompt.contains("我的理解是") || prompt.contains("也许"))
        assertTrue("Missing jargon avoidance", prompt.contains("黑话") || prompt.contains("赋能"))
    }

    // ── 核心张力（nuwa 要求保留矛盾，不掩盖） ────────────────────────────

    @Test
    fun `system prompt preserves core tension without resolving it`() {
        val prompt = WangXingPersona.SYSTEM_PROMPT
        assertTrue("Missing core tension section", prompt.contains("张力") || prompt.contains("矛盾"))
        assertTrue("Missing long-term vs short-term tension", prompt.contains("长期主义") && prompt.contains("短期"))
    }

    // ── 角色规范（nuwa 要求第一人称 + 可退出） ────────────────────────────

    @Test
    fun `system prompt enforces first-person and exit rules`() {
        val prompt = WangXingPersona.SYSTEM_PROMPT
        assertTrue("Missing first-person rule", prompt.contains("第一人称"))
        assertTrue("Missing uncertainty acknowledgment", prompt.contains("超出") || prompt.contains("没想清楚"))
    }

    // ── 提示词体积（过短意味着没有蒸馏，过长意味着未提炼） ────────────────

    @Test
    fun `system prompt length is substantive but not bloated`() {
        val len = WangXingPersona.SYSTEM_PROMPT.trim().length
        assertTrue("Prompt too short (< 800 chars): $len", len > 800)
        assertTrue("Prompt too long (> 5000 chars): $len", len < 5000)
    }

    // ── Few-shot 质量（nuwa Phase 4 质量验证） ────────────────────────────

    @Test
    fun `few shot examples are non-empty and cover distinct topics`() {
        val examples = WangXingPersona.FEW_SHOT_EXAMPLES
        assertTrue("Need at least 3 examples", examples.size >= 3)
        examples.forEach { (q, a) ->
            assertFalse("Question blank", q.isBlank())
            assertTrue("Answer too short: $a", a.length > 30)
        }
    }

    @Test
    fun `few shot answers stay in character — no generic inspirational clichés`() {
        WangXingPersona.FEW_SHOT_EXAMPLES.forEach { (_, answer) ->
            assertFalse("Found out-of-character励志 text", answer.contains("加油") || answer.contains("相信自己"))
            assertFalse("Found buzzwords", answer.contains("赋能") || answer.contains("闭环"))
        }
    }

    @Test
    fun `few shot answers show hedging language characteristic of Wang Xing`() {
        val allAnswers = WangXingPersona.FEW_SHOT_EXAMPLES.joinToString("\n") { it.second }
        val hedgeWords = listOf("不确定", "也许", "没想清楚", "判断", "可能")
        val hasHedge = hedgeWords.any { allAnswers.contains(it) }
        assertTrue("Answers should contain hedging language", hasHedge)
    }
}
