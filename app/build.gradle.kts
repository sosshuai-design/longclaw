import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
}

/**
 * 读取 local.properties 里的 LLM 配置。文件本身被 .gitignore 排除，
 * 不会污染仓库。期望键：
 *   longclaw.llm.apiKey   = sk-...
 *   longclaw.llm.baseUrl  = https://api.deepseek.com
 *   longclaw.llm.model    = deepseek-chat
 * 缺省时编译可继续，运行时 IntentParser 会自动退化到规则模式。
 */
val localProps = Properties().apply {
    val f = rootProject.file("local.properties")
    if (f.exists()) f.inputStream().use(::load)
}
fun llmProp(key: String, default: String): String =
    (System.getenv(key.uppercase().replace('.', '_')) ?: localProps.getProperty(key) ?: default)
        .trim()

android {
    namespace = "com.longclaw.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.longclaw.app"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "0.1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables { useSupportLibrary = true }

        buildConfigField(
            "String",
            "LLM_API_KEY",
            "\"${llmProp("longclaw.llm.apiKey", "")}\"",
        )
        buildConfigField(
            "String",
            "LLM_BASE_URL",
            "\"${llmProp("longclaw.llm.baseUrl", "https://api.deepseek.com")}\"",
        )
        buildConfigField(
            "String",
            "LLM_MODEL",
            "\"${llmProp("longclaw.llm.model", "deepseek-chat")}\"",
        )
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
        debug {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.ui)
    implementation(libs.androidx.ui.graphics)
    implementation(libs.androidx.ui.tooling.preview)
    implementation(libs.androidx.material3)
    implementation(libs.androidx.material.icons.extended)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.okhttp)

    debugImplementation(libs.androidx.ui.tooling)
}
