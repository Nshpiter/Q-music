const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const native = path.join(__dirname, '../android/app/src/main/java/cn/toside/music/mobile')
const java = process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java') : 'java'

function run(name, body) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'qmusic-settings-motion-'))
  const file = path.join(directory, name + '.java')
  fs.writeFileSync(file, body)
  const result = spawnSync(java, [file], { encoding: 'utf8', timeout: 30000 })
  assert.equal(result.status, 0, result.stderr || result.error?.message)
  assert.match(result.stdout, /PASS/)
}

test('原生边缘运动：阻尼有界、接手不断帧、惯性两端对称并最终归零', () => {
  const physics = fs.readFileSync(path.join(native, 'utils/ElasticScrollPhysics.java'), 'utf8').replace(/^package .*;\s*/m, '')
  run('ElasticProbe', `class ElasticProbe {
    static void check(boolean value, String message) { if (!value) throw new AssertionError(message); }
    public static void main(String[] args) {
      for (float density : new float[]{1, 2, 3.5f}) {
        float limit = 88 * density;
        float previous = 0;
        for (int i = 0; i <= 400; i++) {
          float distance = i * density;
          float offset = ElasticScrollPhysics.offset(distance, limit);
          check(offset >= previous && offset < limit, "drag must be monotonic and bounded");
          check(Math.abs(offset + ElasticScrollPhysics.offset(-distance, limit)) < .001, "both edges must match");
          check(Math.abs(distance - ElasticScrollPhysics.distance(offset, limit)) < .02, "grabbing a spring must keep its current position");
          previous = offset;
        }
        for (float from : new float[]{-60 * density, 0, 60 * density}) {
          for (float input : new float[]{-20000, -1500, 0, 1500, 20000}) {
            float velocity = ElasticScrollPhysics.impactVelocity(input * density, density);
            check(Math.abs(velocity) <= 2400 * density, "fling velocity must be bounded");
            check(ElasticScrollPhysics.settle(from, velocity, 0) == from, "release must not jump");
            check(Math.abs(ElasticScrollPhysics.settle(from, velocity, .6f)) < .1 * density, "spring must settle");
            if (from == 0 && velocity != 0) check(Math.signum(ElasticScrollPhysics.settle(0, velocity, .03f)) == Math.signum(velocity), "fling must move beyond the correct edge");
          }
        }
      }
      System.out.println("PASS: damping, interruption, both impacts and settle");
    }
  }
  ${physics}`)
})

test('原生返回绑定：焦点恢复重新绑定，弹窗/暂停撤销预览，新旧系统各消费一次', () => {
  // 执行真实 Activity 的绑定逻辑；窗口和 RN 事件接收端使用 JVM 替身。
  // 这验证回调生命周期，不替代 Android 系统实际分发手势的真机检查。
  const activity = fs.readFileSync(path.join(native, 'MainActivity.java'), 'utf8')
    .replace(/^package .*;\s*/m, '').replace(/^import .*;\s*/gm, '').replace('public class MainActivity', 'class MainActivity')
  run('BackBindingProbe', `import java.util.*;
  class BackBindingProbe {
    static void check(boolean value, String message) { if (!value) throw new AssertionError(message); }
    public static void main(String[] args) {
      MainActivity activity = new MainActivity();
      activity.onCreate(null); activity.onResume();
      BackView page = new BackView();
      Build.VERSION.SDK_INT = 34;
      activity.setSettingsBackView(page);
      check(activity.platform.registered == 1, "enabled page must register platform callback");
      activity.setSettingsBackView(page);
      check(activity.platform.registered == 1, "render must not re-register callback");
      activity.platform.callback.onBackStarted(new BackEvent(.0f));
      activity.platform.callback.onBackProgressed(new BackEvent(.6f));
      check(page.progress == .6f, "progress must reach native view");
      activity.focus = false; activity.onWindowFocusChanged(false);
      check(activity.platform.callback == null && ReactContext.events.get(ReactContext.events.size()-1).equals("cancel"), "dialog focus must cancel and unregister");
      activity.focus = true; activity.onWindowFocusChanged(true);
      check(activity.platform.registered == 2, "return from dialog must rebind");
      activity.platform.callback.onBackProgressed(new BackEvent(.4f));
      check(page.progress == .4f, "missing start must recover on first progress");
      activity.platform.callback.onBackInvoked();
      check(Collections.frequency(ReactContext.events, "commit") == 1, "one commit only");
      activity.onPause();
      check(activity.platform.callback == null, "paused activity must release callback");
      activity.onResume();
      check(activity.platform.registered == 3, "resume must restore callback");
      activity.clearSettingsBackView(new BackView());
      check(activity.platform.callback != null, "unmount of old view must not disable current view");
      activity.clearSettingsBackView(page);
      check(activity.platform.callback == null, "disabled preference must unregister");
      Build.VERSION.SDK_INT = 33;
      activity.setSettingsBackView(page);
      check(activity.dispatcher.callback.enabled, "older Android must keep normal back");
      activity.dispatcher.callback.handleOnBackPressed();
      check(Collections.frequency(ReactContext.events, "commit") == 2, "normal back must reach JS once");
      System.out.println("PASS: platform focus/resume/disable and legacy back");
    }
  }
  @interface NonNull {} @interface Nullable {} @interface RequiresApi { int value(); }
  class Bundle {}
  class Build { static class VERSION { static int SDK_INT = 34; } }
  class BackEvent { float progress; BackEvent(float p) { progress=p; } float getProgress(){return progress;} int getSwipeEdge(){return 0;} }
  class BackEventCompat extends BackEvent { BackEventCompat(float p){super(p);} }
  interface OnBackAnimationCallback { void onBackStarted(BackEvent e); void onBackProgressed(BackEvent e); void onBackCancelled(); void onBackInvoked(); }
  class OnBackInvokedDispatcher {
    static final int PRIORITY_DEFAULT=0; int registered; OnBackAnimationCallback callback;
    void registerOnBackInvokedCallback(int priority, OnBackAnimationCallback c){callback=c; registered++;}
    void unregisterOnBackInvokedCallback(OnBackAnimationCallback c){if(callback==c)callback=null;}
  }
  abstract class OnBackPressedCallback {
    boolean enabled; OnBackPressedCallback(boolean e){enabled=e;} void setEnabled(boolean e){enabled=e;}
    void handleOnBackStarted(BackEventCompat e){} void handleOnBackProgressed(BackEventCompat e){} void handleOnBackCancelled(){} abstract void handleOnBackPressed();
  }
  class Dispatcher { OnBackPressedCallback callback; void addCallback(Object owner,OnBackPressedCallback c){callback=c;} void onBackPressed(){} }
  class NavigationActivity {
    boolean focus=true; Dispatcher dispatcher=new Dispatcher(); OnBackInvokedDispatcher platform=new OnBackInvokedDispatcher();
    protected void onCreate(Bundle b){} protected void onResume(){} protected void onPause(){} public void onWindowFocusChanged(boolean focus){}
    boolean hasWindowFocus(){return focus;} Dispatcher getOnBackPressedDispatcher(){return dispatcher;}
    OnBackInvokedDispatcher getOnBackInvokedDispatcher(){return platform;} Object getApplication(){return new MainApplication();}
  }
  class BackView { float progress; void dispatchProgress(float p){progress=p;} }
  class MotionTrace { static void log(String message){} }
  class MainApplication { MainApplication getReactNativeHost(){return this;} MainApplication getReactInstanceManager(){return this;} ReactContext getCurrentReactContext(){return new ReactContext();} }
  class WritableMap { String phase; void putString(String k,String v){phase=v;} void putDouble(String k,double v){} void putInt(String k,int v){} }
  class Arguments { static WritableMap createMap(){return new WritableMap();} }
  class DeviceEventManagerModule { interface RCTDeviceEventEmitter { void emit(String name,WritableMap event); } }
  class ReactContext {
    static List<String> events=new ArrayList<>(); boolean hasActiveCatalystInstance(){return true;}
    <T> T getJSModule(Class<T> c){return c.cast((DeviceEventManagerModule.RCTDeviceEventEmitter)(name,event)->events.add(event.phase));}
  }
  ${activity}`)
})
