package com.zigly.webview.preview

import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  /**
   * Hand the window back from the launch theme to the app's own.
   *
   * The activity is declared with AppLaunchTheme so that Zigly's splash is on
   * screen from the first frame, before any JavaScript exists -- see
   * AndroidManifest.xml and res/values/styles.xml for why that layer is the
   * only one that can cover the WebView during the JS boot.
   *
   * That theme has to be given back. Its window background is the splash
   * drawable, and a window still wearing it once the app is running would keep
   * the logo painted *behind* every screen -- visible through anything that is
   * not opaque, and wasting a full-screen overdraw on every frame. Switching
   * here restores the plain white ground the rest of the app expects.
   *
   * BEFORE super.onCreate, which is what makes this a swap rather than a
   * flicker: setTheme applies to the window as it is being created, so the
   * launch drawable is never composited with the app's own view hierarchy. The
   * React root that replaces it is the JS splash, which is the same white and
   * the same mark -- so what the customer sees is one continuous image, not a
   * hand-off.
   */
  override fun onCreate(savedInstanceState: Bundle?) {
    setTheme(R.style.AppTheme)
    super.onCreate(savedInstanceState)
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "ZiglyApp"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
