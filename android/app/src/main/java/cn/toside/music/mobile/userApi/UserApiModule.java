package cn.toside.music.mobile.userApi;

import android.os.Bundle;
import android.os.Handler;
import android.os.Message;
import android.util.Log;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import java.lang.Thread;
import java.util.HashMap;
import java.util.Map;

public class UserApiModule extends ReactContextBaseJavaModule {
  private final Map<String, JavaScriptThread> runtimes = new HashMap<>();
  private final ReactApplicationContext reactContext;
  private UtilsEvent utilsEvent;

  private int listenerCount = 0;

  UserApiModule(ReactApplicationContext reactContext) {
    super(reactContext);
    this.utilsEvent = null;
    this.reactContext = reactContext;
  }

  @Override
  public String getName() {
    return "UserApiModule";
  }

  @ReactMethod
  public void addListener(String eventName) {
    if (listenerCount == 0) {
      // Set up any upstream listeners or background tasks as necessary
    }

    listenerCount += 1;
  }

  @ReactMethod
  public void removeListeners(Integer count) {
    listenerCount -= count;
    if (listenerCount == 0) {
      // Remove upstream listeners, stop unnecessary background tasks
    }
  }

  @ReactMethod
  public synchronized void loadScript(ReadableMap data) {
    if (this.utilsEvent == null) this.utilsEvent = new UtilsEvent(this.reactContext);
    Bundle info = Arguments.toBundle(data);
    String runtimeId = info.getString("runtimeId", "");
    if (runtimeId.isEmpty()) return;
    destroyScript(runtimeId);
    JavaScriptThread javaScriptThread = new JavaScriptThread(this.reactContext, info);
    JsHandler events = new JsHandler(this.reactContext.getMainLooper(), this.utilsEvent, runtimeId);
    javaScriptThread.setUncaughtExceptionHandler((thread, ex) -> {
      events.sendMessage(events.obtainMessage(HandlerWhat.INIT_FAILED, "JavaScript runtime stopped"));
      Log.e("JavaScriptThread", "Uncaught exception in JavaScriptThread: " + ex.getMessage());
    });
    javaScriptThread.prepareHandler(events);
    runtimes.put(runtimeId, javaScriptThread);
    javaScriptThread.getHandler().sendEmptyMessage(HandlerWhat.INIT);
    Log.d("UserApi", "Module Thread id: " + Thread.currentThread().getId());
  }

  @ReactMethod
  public synchronized boolean sendAction(String runtimeId, String action, String info) {
    JavaScriptThread javaScriptThread = runtimes.get(runtimeId);
    if (javaScriptThread == null) return false;
    Handler jsHandler = javaScriptThread.getHandler();
    Message message = jsHandler.obtainMessage();
    message.what = HandlerWhat.ACTION;
    message.obj = new Object[]{action, info};
    jsHandler.sendMessage(message);
    return true;
  }

  @ReactMethod
  public synchronized void destroyScript(String runtimeId) {
    JavaScriptThread javaScriptThread = runtimes.remove(runtimeId);
    if (javaScriptThread == null) return;
    javaScriptThread.getHandler().sendEmptyMessage(HandlerWhat.DESTROY);
    // DESTROY 必须在脚本线程上执行，再退出 Looper，避免 QuickJS 没有释放。
  }

  @ReactMethod
  public synchronized void destroy() {
    for (String runtimeId : runtimes.keySet().toArray(new String[0])) destroyScript(runtimeId);
  }

  @Override
  public void invalidate() {
    destroy();
    super.invalidate();
  }
}
