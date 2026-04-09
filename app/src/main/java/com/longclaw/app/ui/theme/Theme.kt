package com.longclaw.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val LongclawOrange = Color(0xFFE4572E)
private val LongclawOrangeDark = Color(0xFFB13B17)
private val LongclawSurface = Color(0xFFF7F7F8)

private val LightColors = lightColorScheme(
    primary = LongclawOrange,
    onPrimary = Color.White,
    secondary = LongclawOrangeDark,
    background = LongclawSurface,
)

private val DarkColors = darkColorScheme(
    primary = LongclawOrange,
    onPrimary = Color.White,
    secondary = LongclawOrangeDark,
)

@Composable
fun LongclawTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        content = content,
    )
}
