# Keep accessibility service entry point so the system can bind to it.
-keep class com.longclaw.app.service.LongclawAccessibilityService { *; }

# Keep the payment-package blacklist constant — security boundary, must not be obfuscated away.
-keep class com.longclaw.app.security.PaymentGuard { *; }

# Standard Compose / Kotlin metadata.
-keep class kotlin.Metadata { *; }
