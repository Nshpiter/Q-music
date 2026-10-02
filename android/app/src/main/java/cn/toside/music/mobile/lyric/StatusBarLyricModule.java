package cn.toside.music.mobile.lyric;

import android.media.session.PlaybackState;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Log;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.LifecycleEventListener;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;

import java.util.ArrayList;
import java.io.ByteArrayOutputStream;

import io.github.proify.lyricon.lyric.model.RichLyricLine;
import io.github.proify.lyricon.lyric.model.Song;
import io.github.proify.lyricon.provider.LyriconFactory;
import io.github.proify.lyricon.provider.LyriconProvider;
import io.github.proify.lyricon.provider.ProviderLogo;
import io.github.proify.lyricon.provider.ConnectionListener;

/** 使用词幕官方 Provider SDK。整首时间轴交给词幕，不依赖后台 JS 逐行定时器。 */
public class StatusBarLyricModule extends ReactContextBaseJavaModule implements LifecycleEventListener {
  private static final String TAG = "StatusBarLyric";
  private final Handler handler = new Handler(Looper.getMainLooper());
  private volatile LyriconProvider provider;
  private volatile boolean requested;
  private volatile boolean timedOut;
  private int retries;
  private long position;
  private long updatedAt;
  private float speed = 1;
  private boolean playing;

  StatusBarLyricModule(ReactApplicationContext context) {
    super(context);
    context.addLifecycleEventListener(this);
  }

  private final ConnectionListener connectionListener = new ConnectionListener() {
    @Override public void onConnected(LyriconProvider value) { connected(value); }
    @Override public void onReconnected(LyriconProvider value) { connected(value); }
    @Override public void onDisconnected(LyriconProvider value) { retry(value, false); }
    @Override public void onConnectTimeout(LyriconProvider value) { retry(value, true); }
  };

  private void connected(LyriconProvider value) {
    handler.post(() -> {
      if (provider != value) return;
      handler.removeCallbacksAndMessages(null);
      timedOut = false;
      retries = 0;
      Log.i(TAG, "Connected to Lyricon; cached song and playback state synchronized");
    });
  }

  private void retry(LyriconProvider value, boolean timeout) {
    handler.post(() -> {
      if (!requested || provider != value) return;
      timedOut = timeout;
      Log.w(TAG, timeout ? "Lyricon registration timed out" : "Lyricon disconnected");
      // SDK 0.1.70 超时后不会自动重试；限制次数，未启用词幕时不永久后台轮询。
      if (retries >= 3) return;
      long delay = 2000L << retries++;
      handler.postDelayed(() -> {
        if (requested && provider == value && !value.getService().isActive()) registerProvider();
      }, delay);
    });
  }

  private boolean isInstalled() {
    try {
      getReactApplicationContext().getPackageManager().getApplicationInfo("io.github.proify.lyricon", 0);
      return true;
    } catch (PackageManager.NameNotFoundException e) { return false; }
  }

  private ProviderLogo appLogo() {
    Drawable icon = getReactApplicationContext().getApplicationInfo()
        .loadIcon(getReactApplicationContext().getPackageManager());
    Bitmap bitmap = Bitmap.createBitmap(64, 64, Bitmap.Config.ARGB_8888);
    try {
      icon.setBounds(0, 0, 64, 64);
      icon.draw(new Canvas(bitmap));
      ByteArrayOutputStream output = new ByteArrayOutputStream();
      bitmap.compress(Bitmap.CompressFormat.PNG, 100, output);
      // 彩色原始应用图标交给词幕，避免被当成模板染色。
      return new ProviderLogo(output.toByteArray(), ProviderLogo.TYPE_BITMAP, true);
    } finally { bitmap.recycle(); }
  }

  private void registerProvider() {
    try {
      if (provider == null || provider.getService().isActive()) return;
      boolean sent = provider.register();
      Log.i(TAG, "Register Lyricon provider: sent=" + sent);
    } catch (Exception | LinkageError e) {
      timedOut = true;
      Log.w(TAG, "Unable to register Lyricon provider", e);
    }
  }

  private synchronized void connect() {
    if (!requested || Build.VERSION.SDK_INT < Build.VERSION_CODES.O_MR1) return;
    if (provider == null) {
      String packageName = getReactApplicationContext().getPackageName();
      provider = LyriconFactory.INSTANCE.createProvider(getReactApplicationContext(),
          packageName, packageName, appLogo(), null, packageName, null, "com.android.systemui");
      provider.setAutoSync(true);
      provider.getService().addConnectionListener(connectionListener);
    }
    if (isInstalled()) registerProvider();
  }

  @Override public String getName() { return "StatusBarLyricModule"; }

  private String status() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O_MR1) return "unsupported";
    if (!requested) return "disabled";
    if (!isInstalled()) return "not_installed";
    if (provider == null) return "unavailable";
    return provider.getService().isActive() ? "connected" : timedOut ? "timeout" : "waiting";
  }

  @ReactMethod
  public void setEnabled(boolean enabled, Promise promise) {
    try {
      requested = enabled;
      if (!enabled) {
        release();
      } else {
        retries = 0;
        timedOut = false;
        connect();
      }
      promise.resolve(status());
    } catch (Exception | LinkageError e) {
      Log.w("StatusBarLyric", "Unable to connect to Lyricon", e);
      release();
      promise.resolve("unavailable");
    }
  }

  @ReactMethod
  public void getStatus(Promise promise) { promise.resolve(status()); }

  @ReactMethod
  public void setSong(ReadableMap data, Promise promise) {
    try {
      if (provider != null) {
        if (data == null) {
          playing = false;
          position = 0;
          updatedAt = SystemClock.elapsedRealtime();
          provider.getPlayer().setPlaybackState(false);
          provider.getPlayer().setSong(null);
        } else {
          Song song = new Song();
          song.setId(data.getString("id"));
          song.setName(data.getString("name"));
          song.setArtist(data.getString("artist"));
          song.setDuration((long) data.getDouble("duration"));
          ReadableArray lines = data.getArray("lines");
          ArrayList<RichLyricLine> lyrics = new ArrayList<>();
          for (int i = 0; lines != null && i < lines.size(); i++) {
            ReadableMap line = lines.getMap(i);
            RichLyricLine lyric = new RichLyricLine();
            lyric.setBegin((long) line.getDouble("begin"));
            lyric.setEnd((long) line.getDouble("end"));
            lyric.setDuration(lyric.getEnd() - lyric.getBegin());
            lyric.setText(line.getString("text"));
            lyric.setTranslation(line.getString("translation"));
            lyric.setRoma(line.getString("roma"));
            lyrics.add(lyric);
          }
          song.setLyrics(lyrics);
          if (song.getDuration() <= 0 && !lyrics.isEmpty()) song.setDuration(lyrics.get(lyrics.size() - 1).getEnd());
          provider.getPlayer().setSong(song);
          Log.i(TAG, "Lyric timeline cached: lines=" + lyrics.size() + ", connected=" + provider.getService().isActive());
        }
      }
      promise.resolve(null);
    } catch (Exception | LinkageError e) { promise.reject("LYRICON_SONG", e); }
  }

  private void advancePosition() {
    long now = SystemClock.elapsedRealtime();
    if (playing) position += (long) ((now - updatedAt) * speed);
    updatedAt = now;
  }

  private void sendPlayback() {
    if (provider == null) return;
    provider.getPlayer().setPlaybackState(new PlaybackState.Builder().setState(
        playing ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED,
        position, speed, updatedAt).build());
  }

  @ReactMethod
  public void setPlayback(boolean play, double time, Promise promise) {
    try {
      advancePosition();
      if (time >= 0) position = (long) time;
      playing = play;
      sendPlayback();
      promise.resolve(null);
    } catch (Exception | LinkageError e) { promise.reject("LYRICON_PLAYBACK", e); }
  }

  @ReactMethod
  public void setOptions(double rate, boolean translation, boolean roma, Promise promise) {
    try {
      advancePosition();
      speed = (float) rate;
      if (provider != null) {
        provider.getPlayer().setDisplayTranslation(translation);
        provider.getPlayer().setDisplayRoma(roma);
        sendPlayback();
      }
      promise.resolve(null);
    } catch (Exception | LinkageError e) { promise.reject("LYRICON_OPTIONS", e); }
  }

  private void release() {
    requested = false;
    handler.removeCallbacksAndMessages(null);
    LyriconProvider previous = provider;
    provider = null;
    playing = false;
    position = 0;
    if (previous == null) return;
    try {
      previous.getPlayer().setPlaybackState(false);
      previous.getPlayer().setSong(null);
    } catch (Exception | LinkageError e) { Log.w("StatusBarLyric", "Unable to clear lyric", e); }
    try {
      previous.getService().removeConnectionListener(connectionListener);
      previous.destroy();
    }
    catch (Exception | LinkageError e) { Log.w("StatusBarLyric", "Unable to release provider", e); }
  }

  @Override public void invalidate() {
    release();
    getReactApplicationContext().removeLifecycleEventListener(this);
    super.invalidate();
  }

  @Override public void onHostResume() {
    if (!requested) return;
    try { connect(); }
    catch (Exception | LinkageError e) { Log.w(TAG, "Unable to reconnect on resume", e); }
  }
  @Override public void onHostPause() { }
  @Override public void onHostDestroy() { }
}
