package com.longclaw.app.nlp.llm

import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * OpenAI 兼容协议的 LLM 客户端。适配 DeepSeek、豆包、Qwen、OpenAI 等所有
 * 暴露 `POST {baseUrl}/v1/chat/completions` 的服务。
 *
 * 注意：
 *  - 整个调用包了 [withTimeout]（MVP-1 质量铁律）。
 *  - 任何异常都吞掉返回 null，IntentParser 会自动退化到规则模式。
 *  - 不会把用户原始文本写 Log——仅写长度，避免隐私泄漏。
 */
class OpenAiCompatibleLlmClient(
    private val apiKey: String,
    private val baseUrl: String,
    private val model: String,
    private val timeoutMs: Long = DEFAULT_TIMEOUT_MS,
) : LlmClient {

    private val http: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .writeTimeout(10, TimeUnit.SECONDS)
        .build()

    override fun isConfigured(): Boolean = apiKey.isNotBlank() && baseUrl.isNotBlank()

    override suspend fun complete(systemPrompt: String, userPrompt: String): String? {
        if (!isConfigured()) {
            Log.d(TAG, "LLM 未配置（apiKey 为空），跳过")
            return null
        }
        return try {
            withTimeout(timeoutMs) { doRequest(systemPrompt, userPrompt) }
        } catch (e: TimeoutCancellationException) {
            Log.w(TAG, "LLM 请求超时 (${timeoutMs}ms)")
            null
        } catch (t: Throwable) {
            Log.w(TAG, "LLM 请求异常 -> 回退规则: ${t.javaClass.simpleName}: ${t.message}")
            null
        }
    }

    private suspend fun doRequest(systemPrompt: String, userPrompt: String): String? =
        withContext(Dispatchers.IO) {
            val payload = JSONObject().apply {
                put("model", model)
                put("temperature", 0.1)
                put(
                    "messages",
                    JSONArray()
                        .put(JSONObject().put("role", "system").put("content", systemPrompt))
                        .put(JSONObject().put("role", "user").put("content", userPrompt)),
                )
                // 大多数兼容端点支持；DeepSeek / OpenAI 都 OK。
                // 服务端忽略这个字段不会影响请求本身，所以即便不支持也没事。
                put("response_format", JSONObject().put("type", "json_object"))
            }

            val url = buildUrl(baseUrl)
            val req = Request.Builder()
                .url(url)
                .header("Authorization", "Bearer $apiKey")
                .header("Content-Type", "application/json")
                .post(payload.toString().toRequestBody("application/json".toMediaType()))
                .build()

            Log.i(TAG, "LLM POST $url model=$model promptLen=${userPrompt.length}")

            http.newCall(req).execute().use { resp ->
                if (!resp.isSuccessful) {
                    Log.w(TAG, "LLM HTTP ${resp.code}: ${resp.message}")
                    return@use null
                }
                val body = resp.body?.string() ?: return@use null
                parseChatCompletion(body)
            }
        }

    private fun parseChatCompletion(raw: String): String? = try {
        val root = JSONObject(raw)
        val choices = root.optJSONArray("choices")
        if (choices == null || choices.length() == 0) {
            null
        } else {
            choices.getJSONObject(0)
                .optJSONObject("message")
                ?.optString("content")
                ?.takeIf { it.isNotBlank() }
        }
    } catch (t: Throwable) {
        Log.w(TAG, "LLM 响应 JSON 解析失败: ${t.message}")
        null
    }

    private fun buildUrl(base: String): String {
        val trimmed = base.trimEnd('/')
        return if (trimmed.endsWith("/chat/completions")) trimmed
        else "$trimmed/v1/chat/completions"
    }

    companion object {
        private const val TAG = "龙爪"
        const val DEFAULT_TIMEOUT_MS = 15_000L
    }
}
