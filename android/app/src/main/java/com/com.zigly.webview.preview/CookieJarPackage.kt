package com.zigly.webview.preview

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * Registers CookieJarModule.
 *
 * This package is local to the app rather than a library, so autolinking never
 * sees it and MainApplication adds it by hand -- which is what the generated
 * comment in that file's `packageList` block is there for.
 *
 * BOTH of ReactPackage's methods are deprecated in RN 0.87, in favour of the
 * New Architecture's TurboModule and view-manager registries. Going there means
 * a codegen spec and a generated interface for three methods; the old path
 * still works and is what this app's other native dependencies use. Suppressed
 * once here rather than on each member, so that a real deprecation later is not
 * lost in the noise of these two -- and with OVERRIDE_DEPRECATION rather than
 * DEPRECATION, which is the diagnostic Kotlin actually raises for implementing
 * a deprecated member (plain DEPRECATION is for CALLING one, and leaves this
 * warning in place). Worth revisiting when this app adopts codegen
 * for its own modules.
 */
@Suppress("OVERRIDE_DEPRECATION")
class CookieJarPackage : ReactPackage {
  override fun createNativeModules(
      reactContext: ReactApplicationContext
  ): List<NativeModule> = listOf(CookieJarModule(reactContext))

  /**
   * Empty: this package contributes no views, only the one native module.
   * ReactPackage declares the method regardless, so it is implemented and
   * returns nothing.
   */
  override fun createViewManagers(
      reactContext: ReactApplicationContext
  ): List<ViewManager<*, *>> = emptyList()
}
