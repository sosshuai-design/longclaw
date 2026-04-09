package com.longclaw.app.viewmodel

import android.app.Application
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.longclaw.app.BuildConfig
import com.longclaw.app.adapter.meituan.MeituanAdapter
import com.longclaw.app.adapter.meituan.MeituanOrderResult
import com.longclaw.app.adapter.meituan.Stage
import com.longclaw.app.nlp.IntentParser
import com.longclaw.app.nlp.llm.LlmClient
import com.longclaw.app.nlp.llm.OpenAiCompatibleLlmClient
import com.longclaw.app.security.PaymentGuard
import com.longclaw.app.service.LongclawAccessibilityService
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * 首页指令输入框背后的 ViewModel。
 *
 * 流程：用户提交自然语言 → IntentParser（LLM 优先，规则兜底）→ MeituanAdapter
 *      → 等待用户支付。任何步骤失败都会反馈到 [uiState]，由 Compose 层渲染。
 */
class TaskViewModel(application: Application) : AndroidViewModel(application) {

    private val _uiState = MutableStateFlow(TaskUiState())
    val uiState: StateFlow<TaskUiState> = _uiState.asStateFlow()

    private val llmClient: LlmClient = OpenAiCompatibleLlmClient(
        apiKey = BuildConfig.LLM_API_KEY,
        baseUrl = BuildConfig.LLM_BASE_URL,
        model = BuildConfig.LLM_MODEL,
    )
    private val intentParser: IntentParser = IntentParser(llmClient)

    fun refreshAccessibilityStatus() {
        val enabled = LongclawAccessibilityService.isEnabled(getApplication())
        _uiState.value = _uiState.value.copy(accessibilityEnabled = enabled)
    }

    fun submitCommand(rawText: String) {
        Log.i(TAG, "submitCommand len=${rawText.length}")
        val service = LongclawAccessibilityService.get()
        if (service == null || !LongclawAccessibilityService.isEnabled(getApplication())) {
            _uiState.value = _uiState.value.copy(
                accessibilityEnabled = false,
                lastResult = TaskResult.Error("请先开启「龙爪自动化服务」无障碍权限"),
            )
            return
        }
        // 解析可能走网络，必须在协程里；期间把 running 置位，UI 先给反馈。
        _uiState.value = _uiState.value.copy(
            running = true,
            currentStage = null,
            lastResult = null,
        )
        viewModelScope.launch {
            when (val intent = intentParser.parse(rawText)) {
                is IntentParser.Intent.Rejected -> {
                    _uiState.value = _uiState.value.copy(
                        running = false,
                        lastResult = TaskResult.Rejected(intent.reason),
                    )
                }
                is IntentParser.Intent.Unknown -> {
                    _uiState.value = _uiState.value.copy(
                        running = false,
                        lastResult = TaskResult.Error("没听懂这条指令，请换个说法"),
                    )
                }
                is IntentParser.Intent.MeituanOrder -> {
                    runMeituanOrder(service, intent)
                }
            }
        }
    }

    /** 执行美团下单。调用方必须已经把 running=true 置位。 */
    private suspend fun runMeituanOrder(
        service: LongclawAccessibilityService,
        intent: IntentParser.Intent.MeituanOrder,
    ) {
        _uiState.value = _uiState.value.copy(currentStage = Stage.Launch)
        val adapter = MeituanAdapter(service)
        val result = try {
            adapter.execute(intent.request)
        } catch (e: PaymentGuard.PaymentBoundaryReached) {
            Log.w(TAG, "PaymentGuard 触发：${e.message}")
            MeituanOrderResult.Failed(Stage.HandoffToUser, e.message ?: "支付边界")
        }
        _uiState.value = _uiState.value.copy(
            running = false,
            currentStage = null,
            lastResult = when (result) {
                is MeituanOrderResult.ReadyForPayment ->
                    TaskResult.AwaitingUserPayment(result.storeName, result.totalPrice)
                is MeituanOrderResult.Failed ->
                    TaskResult.Error("[${result.stage}] ${result.message}")
                MeituanOrderResult.Cancelled ->
                    TaskResult.Error("任务已取消")
            },
        )
    }

    companion object {
        private const val TAG = "龙爪"
    }
}

data class TaskUiState(
    val accessibilityEnabled: Boolean = false,
    val running: Boolean = false,
    val currentStage: Stage? = null,
    val lastResult: TaskResult? = null,
)

sealed interface TaskResult {
    data class AwaitingUserPayment(val storeName: String?, val totalPrice: String?) : TaskResult
    data class Rejected(val reason: String) : TaskResult
    data class Error(val message: String) : TaskResult
}
