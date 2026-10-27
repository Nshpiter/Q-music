package cn.toside.music.mobile;

import com.reactnativenavigation.NavigationActivity;
import android.os.Bundle;
import android.os.Build;
import android.window.BackEvent;
import android.window.OnBackAnimationCallback;
import android.window.OnBackInvokedDispatcher;
import androidx.annotation.RequiresApi;
import androidx.activity.BackEventCompat;
import androidx.activity.OnBackPressedCallback;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import cn.toside.music.mobile.utils.SettingsBackViewManager.BackView;
import cn.toside.music.mobile.utils.MotionTrace;

public class MainActivity extends NavigationActivity {
  private OnBackPressedCallback settingsBack;
  private boolean settingsGesture = false;
  private BackView settingsBackView;
  private boolean settingsResumed;
  private Runnable removePlatformSettingsBack;

  @Override
  protected void onCreate(@Nullable Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    // 复用现有 AndroidX 分发器；仅设置详情启用，其他页面仍交给 RNN。
    settingsBack = new OnBackPressedCallback(false) {
      @Override
      public void handleOnBackStarted(@NonNull BackEventCompat event) {
        startSettingsBack(event.getProgress(), event.getSwipeEdge());
      }

      @Override
      public void handleOnBackProgressed(@NonNull BackEventCompat event) {
        progressSettingsBack(event.getProgress(), event.getSwipeEdge());
      }

      @Override
      public void handleOnBackCancelled() {
        cancelSettingsBack();
      }

      @Override
      public void handleOnBackPressed() {
        commitSettingsBack();
      }
    };
    getOnBackPressedDispatcher().addCallback(this, settingsBack);
  }

  private void updateSettingsBackEnabled() {
    if (settingsBack == null) return;
    boolean enabled = settingsBackView != null && settingsResumed && hasWindowFocus();
    MotionTrace.log("back binding enabled=" + enabled + " view=" + (settingsBackView != null) + " resumed=" + settingsResumed + " focus=" + hasWindowFocus());
    if (!enabled) cancelSettingsBack();
    // Android 14+ 直接绑定当前窗口的动画回调，避免 RNN/AndroidX 的普通返回回调
    // 只收到最终 commit、没有 start/progress。旧系统和三键导航仍保留普通返回。
    if (Build.VERSION.SDK_INT >= 34) {
      settingsBack.setEnabled(false);
      if (enabled && removePlatformSettingsBack == null) removePlatformSettingsBack = PlatformBack.register(this);
      else if (!enabled && removePlatformSettingsBack != null) {
        removePlatformSettingsBack.run();
        removePlatformSettingsBack = null;
      }
    } else {
      settingsBack.setEnabled(enabled);
    }
  }

  public void setSettingsBackView(BackView view) {
    settingsBackView = view;
    updateSettingsBackEnabled();
  }

  public void clearSettingsBackView(BackView view) {
    if (settingsBackView != view) return;
    settingsBackView = null;
    updateSettingsBackEnabled();
  }

  @Override protected void onResume() {
    super.onResume();
    settingsResumed = true;
    updateSettingsBackEnabled();
  }

  @Override public void onWindowFocusChanged(boolean hasFocus) {
    super.onWindowFocusChanged(hasFocus);
    updateSettingsBackEnabled();
  }

  @Override
  protected void onPause() {
    settingsResumed = false;
    updateSettingsBackEnabled();
    super.onPause();
  }

  private void startSettingsBack(float progress, int edge) {
    MotionTrace.log("back start edge=" + edge + " progress=" + progress);
    if (settingsBackView == null) return;
    settingsGesture = true;
    emitSettingsBack("start", progress, edge);
    settingsBackView.dispatchProgress(progress);
  }

  private void progressSettingsBack(float progress, int edge) {
    if (!settingsGesture) startSettingsBack(0, edge);
    if (settingsBackView != null) settingsBackView.dispatchProgress(progress);
  }

  private void cancelSettingsBack() {
    if (!settingsGesture) return;
    settingsGesture = false;
    MotionTrace.log("back cancel");
    emitSettingsBack("cancel", 0, 0);
  }

  private void commitSettingsBack() {
    MotionTrace.log("back commit");
    settingsGesture = false;
    if (!emitSettingsBack("commit", 1, 0)) {
      if (removePlatformSettingsBack != null) { removePlatformSettingsBack.run(); removePlatformSettingsBack = null; }
      settingsBack.setEnabled(false);
      getOnBackPressedDispatcher().onBackPressed();
    }
  }

  @RequiresApi(34)
  private static class PlatformBack {
    static Runnable register(MainActivity activity) {
      OnBackInvokedDispatcher dispatcher = activity.getOnBackInvokedDispatcher();
      OnBackAnimationCallback callback = new OnBackAnimationCallback() {
        @Override public void onBackStarted(@NonNull BackEvent event) { activity.startSettingsBack(event.getProgress(), event.getSwipeEdge()); }
        @Override public void onBackProgressed(@NonNull BackEvent event) { activity.progressSettingsBack(event.getProgress(), event.getSwipeEdge()); }
        @Override public void onBackCancelled() { activity.cancelSettingsBack(); }
        @Override public void onBackInvoked() { activity.commitSettingsBack(); }
      };
      dispatcher.registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, callback);
      return () -> dispatcher.unregisterOnBackInvokedCallback(callback);
    }
  }

  private boolean emitSettingsBack(String phase, float progress, int edge) {
    ReactContext context = ((MainApplication) getApplication()).getReactNativeHost()
        .getReactInstanceManager().getCurrentReactContext();
    if (context == null || !context.hasActiveCatalystInstance()) return false;
    WritableMap event = Arguments.createMap();
    event.putString("phase", phase);
    event.putDouble("progress", progress);
    event.putInt("edge", edge);
    context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class).emit("settings-back", event);
    return true;
  }




}
