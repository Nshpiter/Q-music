package cn.toside.music.mobile.utils;

import android.app.Activity;
import androidx.annotation.Nullable;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.UIManagerHelper;
import com.facebook.react.uimanager.annotations.ReactProp;
import com.facebook.react.uimanager.events.Event;
import com.facebook.react.uimanager.events.EventDispatcher;
import com.facebook.react.views.view.ReactViewGroup;
import com.facebook.react.views.view.ReactViewManager;
import cn.toside.music.mobile.MainActivity;
import java.util.HashMap;
import java.util.Map;

/** 系统返回进度直接送给 NativeAnimated，不经过 JS 事件队列逐帧往返。 */
public class SettingsBackViewManager extends ReactViewManager {
    @Override public String getName() { return "QSettingsBackView"; }
    @Override public ReactViewGroup createViewInstance(ThemedReactContext context) { return new BackView(context); }
    @ReactProp(name = "backEnabled", defaultBoolean = false)
    public void setBackEnabled(ReactViewGroup view, boolean enabled) { ((BackView) view).setBackEnabled(enabled); }
    @Override public Map<String, Object> getExportedCustomDirectEventTypeConstants() {
        Map<String, Object> events = new HashMap<>();
        Map<String, Object> parent = super.getExportedCustomDirectEventTypeConstants();
        if (parent != null) events.putAll(parent);
        Map<String, String> registration = new HashMap<>();
        registration.put("registrationName", "onBackProgress");
        events.put("topBackProgress", registration);
        return events;
    }

    public static class BackView extends ReactViewGroup {
        private final ThemedReactContext reactContext;
        private boolean enabled;
        BackView(ThemedReactContext context) { super(context); reactContext = context; }
        private MainActivity activity() {
            Activity activity = reactContext.getCurrentActivity();
            return activity instanceof MainActivity ? (MainActivity) activity : null;
        }
        void setBackEnabled(boolean value) {
            enabled = value;
            MainActivity activity = activity();
            MotionTrace.log("back view=" + getId() + " enabled=" + value + " attached=" + isAttachedToWindow() + " activity=" + (activity != null));
            if (activity != null) {
                if (value && isAttachedToWindow()) activity.setSettingsBackView(this);
                else activity.clearSettingsBackView(this);
            }
        }
        @Override protected void onAttachedToWindow() { super.onAttachedToWindow(); setBackEnabled(enabled); }
        @Override protected void onDetachedFromWindow() {
            MainActivity activity = activity();
            if (activity != null) activity.clearSettingsBackView(this);
            super.onDetachedFromWindow();
        }
        public void dispatchProgress(float progress) {
            EventDispatcher dispatcher = UIManagerHelper.getEventDispatcherForReactTag(reactContext, getId());
            if (dispatcher != null) dispatcher.dispatchEvent(new BackProgressEvent(UIManagerHelper.getSurfaceId(reactContext), getId(), progress));
        }
    }

    private static class BackProgressEvent extends Event<BackProgressEvent> {
        private final float progress;
        BackProgressEvent(int surfaceId, int viewId, float progress) { super(surfaceId, viewId); this.progress = progress; }
        @Override public String getEventName() { return "topBackProgress"; }
        @Nullable @Override protected WritableMap getEventData() {
            WritableMap event = Arguments.createMap();
            // 1 为详情全屏、0 为右移离场；与 JS 取消/提交弹簧使用同一坐标。
            event.putDouble("progress", 1 - Math.max(0, Math.min(1, progress)));
            return event;
        }
    }
}
