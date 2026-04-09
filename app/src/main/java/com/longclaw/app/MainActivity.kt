package com.longclaw.app

import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.List
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.viewmodel.compose.viewModel
import com.longclaw.app.ui.theme.LongclawTheme
import com.longclaw.app.viewmodel.TaskResult
import com.longclaw.app.viewmodel.TaskViewModel

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            LongclawTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background,
                ) {
                    LongclawApp()
                }
            }
        }
    }
}

private enum class BottomTab(val labelRes: Int) {
    Home(R.string.nav_home),
    Tasks(R.string.nav_tasks),
    Profile(R.string.nav_profile),
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun LongclawApp(viewModel: TaskViewModel = viewModel()) {
    var selectedTab by remember { mutableStateOf(BottomTab.Home) }
    val state by viewModel.uiState.collectAsState()

    // 每次 Activity 回到前台都重新检查无障碍权限。
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) viewModel.refreshAccessibilityStatus()
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    Scaffold(
        topBar = {
            TopAppBar(title = { Text(stringResource(R.string.app_name)) })
        },
        bottomBar = {
            NavigationBar {
                BottomTab.values().forEach { tab ->
                    NavigationBarItem(
                        selected = selectedTab == tab,
                        onClick = { selectedTab = tab },
                        icon = {
                            Icon(
                                imageVector = when (tab) {
                                    BottomTab.Home -> Icons.Filled.Home
                                    BottomTab.Tasks -> Icons.Filled.List
                                    BottomTab.Profile -> Icons.Filled.Person
                                },
                                contentDescription = null,
                            )
                        },
                        label = { Text(stringResource(tab.labelRes)) },
                    )
                }
            }
        },
    ) { innerPadding ->
        when (selectedTab) {
            BottomTab.Home -> HomeScreen(
                state = state,
                onSubmit = viewModel::submitCommand,
                modifier = Modifier.padding(innerPadding),
            )
            BottomTab.Tasks -> PlaceholderScreen(
                title = stringResource(R.string.nav_tasks),
                hint = "任务历史将在 MVP-2 上线",
                padding = innerPadding,
            )
            BottomTab.Profile -> PlaceholderScreen(
                title = stringResource(R.string.nav_profile),
                hint = "个人中心 / 设置将在 MVP-2 上线",
                padding = innerPadding,
            )
        }
    }
}

@Composable
private fun HomeScreen(
    state: com.longclaw.app.viewmodel.TaskUiState,
    onSubmit: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    var input by remember { mutableStateOf("") }

    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(16.dp),
    ) {
        AccessibilityStatusCard(
            connected = state.accessibilityEnabled,
            onOpenSettings = {
                context.startActivity(
                    Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                )
            },
        )

        Spacer(Modifier.height(24.dp))

        Text(
            text = "你想让龙爪做什么？",
            style = MaterialTheme.typography.titleMedium,
        )
        Spacer(Modifier.height(8.dp))

        OutlinedTextField(
            value = input,
            onValueChange = { input = it },
            modifier = Modifier.fillMaxWidth(),
            placeholder = { Text(stringResource(R.string.hint_command_input)) },
            minLines = 2,
            maxLines = 5,
            shape = RoundedCornerShape(12.dp),
        )

        Spacer(Modifier.height(12.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Button(
                modifier = Modifier.weight(1f),
                enabled = !state.running && input.isNotBlank(),
                onClick = { onSubmit(input) },
            ) {
                Icon(Icons.Filled.Send, contentDescription = null)
                Spacer(Modifier.size(8.dp))
                Text(stringResource(R.string.action_send))
            }

            FilledIconButton(
                onClick = {
                    Toast.makeText(
                        context,
                        context.getString(R.string.action_voice_unavailable),
                        Toast.LENGTH_SHORT,
                    ).show()
                },
            ) {
                Icon(
                    Icons.Filled.Mic,
                    contentDescription = stringResource(R.string.action_voice),
                )
            }
        }

        if (state.running) {
            Spacer(Modifier.height(16.dp))
            LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
            Spacer(Modifier.height(4.dp))
            Text(
                text = "执行中：${state.currentStage ?: ""}",
                style = MaterialTheme.typography.bodySmall,
            )
        }

        state.lastResult?.let { result ->
            Spacer(Modifier.height(16.dp))
            ResultCard(result)
        }
    }
}

@Composable
private fun AccessibilityStatusCard(connected: Boolean, onOpenSettings: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = if (connected)
                MaterialTheme.colorScheme.primaryContainer
            else
                MaterialTheme.colorScheme.errorContainer,
        ),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = if (connected)
                    stringResource(R.string.permission_status_connected)
                else
                    stringResource(R.string.permission_guide_title),
                style = MaterialTheme.typography.titleMedium,
            )
            if (!connected) {
                Spacer(Modifier.height(8.dp))
                Text(
                    text = stringResource(R.string.permission_guide_body),
                    style = MaterialTheme.typography.bodyMedium,
                )
                Spacer(Modifier.height(12.dp))
                Button(onClick = onOpenSettings) {
                    Text(stringResource(R.string.permission_guide_action))
                }
            }
        }
    }
}

@Composable
private fun ResultCard(result: TaskResult) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant,
        ),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            when (result) {
                is TaskResult.AwaitingUserPayment -> {
                    Text("已为你准备好订单，请亲自完成支付", style = MaterialTheme.typography.titleSmall)
                    Spacer(Modifier.height(4.dp))
                    Text("商家：${result.storeName ?: "—"}")
                    Text("金额：${result.totalPrice ?: "—"}")
                }
                is TaskResult.Rejected -> {
                    Text("已拒绝", style = MaterialTheme.typography.titleSmall)
                    Spacer(Modifier.height(4.dp))
                    Text(result.reason)
                }
                is TaskResult.Error -> {
                    Text("出错了", style = MaterialTheme.typography.titleSmall)
                    Spacer(Modifier.height(4.dp))
                    Text(result.message)
                }
            }
        }
    }
}

@Composable
private fun PlaceholderScreen(title: String, hint: String, padding: PaddingValues) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(padding),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(title, style = MaterialTheme.typography.headlineSmall)
            Spacer(Modifier.height(8.dp))
            Text(hint, style = MaterialTheme.typography.bodyMedium)
        }
    }
}

