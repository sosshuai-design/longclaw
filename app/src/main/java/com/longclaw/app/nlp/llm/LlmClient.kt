package com.longclaw.app.nlp.llm

/**
 * LLM 客户端抽象。MVP-1 只用到一次：把用户的自然语言指令转成严格 JSON 的结构化意图。
 *
 * 为什么是抽象接口？
 *  - DeepSeek / OpenAI / 豆包 / Qwen 的公开 API 都兼容 `/v1/chat/completions`
 *    这套 schema，换供应商只需换 baseUrl + model，不需要换业务代码。
 *  - 单测 / CI 可以塞一个假 Client 进来。
 */
interface LlmClient {

    /**
     * 向 LLM 发起一次单轮对话。成功返回模型的原始文本内容（通常是一个 JSON 字符串）。
     * 网络、鉴权或 JSON schema 异常时返回 null 交由上层走规则兜底——**不要** throws，
     * 让 IntentParser 的 fallback 路径始终可用。
     */
    suspend fun complete(systemPrompt: String, userPrompt: String): String?

    /** 配置是否齐全（至少要有 apiKey）。为空时上层会跳过 LLM 直接走规则。 */
    fun isConfigured(): Boolean
}
