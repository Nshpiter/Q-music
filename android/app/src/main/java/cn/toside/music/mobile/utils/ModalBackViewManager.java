package cn.toside.music.mobile.utils;

import android.os.Build;
import android.window.OnBackInvokedCallback;
import android.window.OnBackInvokedDispatcher;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.UIManagerHelper;
import com.facebook.react.uimanager.events.Event;
import com.facebook.react.uimanager.events.EventDispatcher;
import com.facebook.react.views.view.ReactViewGroup;
import com.facebook.react.views.view.ReactViewManager;
import java.util.HashMap;
import java.util.Map;

/** RN 0.73 仅拦截旧返回键；新系统必须由弹窗自身的 dispatcher 把返回交还给 JS。 */
public class ModalBackViewManager extends ReactViewManager {
  @Override public String getName() { return "QModalBackView"; }
  @Override public ReactViewGroup createViewInstance(ThemedReactContext context) { return new BackView(context); }
  @Override public Map<String, Object> getExportedCustomDirectEventTypeConstants() {
    Map<String, Object> events = new HashMap<>();
    Map<String, Object> parent = super.getExportedCustomDirectEventTypeConstants();
    if (parent != null) events.putAll(parent);
    Map<String, String> registration = new HashMap<>();
    registration.put("registrationName", "onModalBack");
    events.put("topModalBack", registration);
    return events;
  }

  static class BackView extends ReactViewGroup {
    private final ThemedReactContext context;
    private Runnable unregister;
    BackView(ThemedReactContext context) { super(context); this.context = context; }
    private void bind() {
      if (Build.VERSION.SDK_INT < 33 || unregister != null || !isAttachedToWindow() || !hasWindowFocus()) return;
      unregister = Api33.bind(this, () -> {
        EventDispatcher dispatcher = UIManagerHelper.getEventDispatcherForReactTag(context, getId());
        if (dispatcher != null) dispatcher.dispatchEvent(new BackEvent(UIManagerHelper.getSurfaceId(context), getId()));
      });
    }
    private void unbind() { if (unregister != null) { unregister.run(); unregister = null; } }
    @Override protected void onAttachedToWindow() { super.onAttachedToWindow(); post(this::bind); }
    @Override public void onWindowFocusChanged(boolean focus) { super.onWindowFocusChanged(focus); if (focus) bind(); else unbind(); }
    @Override protected void onDetachedFromWindow() { unbind(); super.onDetachedFromWindow(); }
  }

  @android.annotation.TargetApi(33)
  private static class Api33 {
    static Runnable bind(BackView view, Runnable back) {
      OnBackInvokedDispatcher dispatcher = view.findOnBackInvokedDispatcher();
      if (dispatcher == null) return null;
      OnBackInvokedCallback callback = back::run;
      dispatcher.registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, callback);
      return () -> dispatcher.unregisterOnBackInvokedCallback(callback);
    }
  }

  private static class BackEvent extends Event<BackEvent> {
    BackEvent(int surfaceId, int viewId) { super(surfaceId, viewId); }
    @Override public String getEventName() { return "topModalBack"; }
    @Override public boolean canCoalesce() { return false; }
    @Override protected WritableMap getEventData() { return Arguments.createMap(); }
  }
}
