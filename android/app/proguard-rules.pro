# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# ---------------------------------------------------------------------------
# Zigly: keeps for the release build's minification.
#
# React Native resolves a great deal reflectively -- native modules by their
# @ReactModule name, view managers by their registered name, and every
# @ReactMethod the JS side calls -- so R8 cannot see those call sites and will
# happily remove the targets. React Native ships consumer rules covering its
# own core; these cover this app's native dependencies and the annotation
# entry points, which is where a minified RN build normally breaks.
#
# All of these are "keep", never "assumenosideeffects": the intent is a smaller
# APK, not a cleverer one, and the saving here comes overwhelmingly from the
# ABI split rather than from stripping these.
# ---------------------------------------------------------------------------

# Anything the bridge reaches by annotation.
-keepclassmembers class * {
    @com.facebook.react.uimanager.annotations.ReactProp <methods>;
    @com.facebook.react.uimanager.annotations.ReactPropGroup <methods>;
    @com.facebook.react.bridge.ReactMethod <methods>;
}
-keep,allowobfuscation @interface com.facebook.proguard.annotations.DoNotStrip
-keep @com.facebook.proguard.annotations.DoNotStrip class *
-keepclassmembers class * {
    @com.facebook.proguard.annotations.DoNotStrip *;
}

# Native modules and view managers, located by name at runtime.
-keep class * extends com.facebook.react.bridge.NativeModule { *; }
-keep class * extends com.facebook.react.uimanager.ViewManager { *; }
-keep class * extends com.facebook.react.bridge.BaseJavaModule { *; }
-keep class * implements com.facebook.react.bridge.ReactPackage { *; }

# JNI boundary: anything called from C++ must keep its exact signature.
-keepclasseswithmembernames class * {
    native <methods>;
}

# The app's own dependencies.
-keep class com.reactnativecommunity.webview.** { *; }
-keep class com.reactnativecommunity.netinfo.** { *; }
-keep class com.reactnativecommunity.asyncstorage.** { *; }
-keep class com.horcrux.svg.** { *; }

# The WebView's JavaScript bridge. Every method the injected scripts reach is
# an entry point R8 cannot see -- this whole app is injected JavaScript talking
# to that interface, so removing one is removing a feature.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Hermes.
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }

# Quieter build: these are optional integrations RN references but does not ship.
-dontwarn com.facebook.react.**
-dontwarn okhttp3.**
-dontwarn okio.**
