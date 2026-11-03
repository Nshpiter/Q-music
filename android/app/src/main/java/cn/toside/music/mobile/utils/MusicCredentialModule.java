package cn.toside.music.mobile.utils;

import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.AtomicFile;
import android.util.Base64;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import org.json.JSONObject;

/** 官方账号在本机加密保存；仅用户明确选择的配置备份可以携带音乐账号凭证。 */
public class MusicCredentialModule extends ReactContextBaseJavaModule {
  private static final String ALIAS = "qmusic.qq.daily.v1";
  private final AtomicFile storage;
  private static final String KUGOU_ALIAS = "qmusic.kugou.account.v1";
  private final AtomicFile kugouStorage;
  private static final String QQ_ACCOUNT_ALIAS = "qmusic.qq.account.v1";
  private final AtomicFile qqAccountStorage;

  MusicCredentialModule(ReactApplicationContext context) {
    super(context);
    storage = new AtomicFile(new File(context.getNoBackupFilesDir(), "qq-daily.enc"));
    kugouStorage = new AtomicFile(new File(context.getNoBackupFilesDir(), "kugou-account.enc"));
    qqAccountStorage = new AtomicFile(new File(context.getNoBackupFilesDir(), "qq-account.enc"));
  }

  @Override public String getName() { return "MusicCredentialModule"; }

  @ReactMethod public void restoreNeteaseCookies(String raw, Promise promise) {
    try {
      if (raw.length() > 16384) throw new IllegalArgumentException();
      JSONObject cookies = new JSONObject(raw);
      if (cookies.optString("MUSIC_U").isEmpty()) throw new IllegalArgumentException();
      for (java.util.Iterator<String> keys = cookies.keys(); keys.hasNext();) {
        String name = keys.next();
        if ((!name.equals("MUSIC_U") && !name.equals("__csrf")) || !cookies.getString(name).matches("[!-:<-~]*")) throw new IllegalArgumentException();
      }
      getReactApplicationContext().runOnUiQueueThread(() -> {
        try {
          android.webkit.CookieManager manager = android.webkit.CookieManager.getInstance();
          String[] domains = {"", "; Domain=music.163.com", "; Domain=163.com"};
          java.util.concurrent.atomic.AtomicInteger pending = new java.util.concurrent.atomic.AtomicInteger(6);
          java.util.concurrent.atomic.AtomicBoolean failed = new java.util.concurrent.atomic.AtomicBoolean(false);
          // 覆盖官网可能写入的域 Cookie，避免旧账号同名凭证继续被读取。
          for (String domain : domains) for (String name : new String[]{"MUSIC_U", "__csrf"}) {
            String value = cookies.optString(name);
            manager.setCookie("https://music.163.com/", name + "=" + value + domain + "; Path=/; Secure; HttpOnly; Max-Age=" + (value.isEmpty() ? "0" : "2592000"), success -> {
              if (!success) failed.set(true);
              if (pending.decrementAndGet() == 0) {
                manager.flush();
                if (failed.get()) promise.reject("credential_storage", "网易云登录状态保存失败");
                else promise.resolve(null);
              }
            });
          }
        } catch (Exception error) { promise.reject("credential_storage", "网易云登录状态保存失败"); }
      });
    } catch (Exception error) { promise.reject("credential_storage", "网易云登录状态格式无效"); }
  }

  @ReactMethod public synchronized void getQQAccount(Promise promise) {
    try { JSONObject data = readProtected(qqAccountStorage, QQ_ACCOUNT_ALIAS); promise.resolve(data == null ? null : data.toString()); }
    catch (Exception error) { promise.reject("credential_storage", "Unable to read protected account credentials"); }
  }
  @ReactMethod public synchronized void setQQAccount(String value, Promise promise) {
    try {
      if (value.length() > 16384) throw new IllegalArgumentException();
      JSONObject data = new JSONObject(value);
      if (!data.getString("qqmusic_uin").matches("[1-9][0-9]*") || data.getString("qqmusic_key").isEmpty()) throw new IllegalArgumentException();
      writeProtected(qqAccountStorage, QQ_ACCOUNT_ALIAS, data);
      promise.resolve(null);
    } catch (Exception error) { promise.reject("credential_storage", "Unable to save protected account credentials"); }
  }
  @ReactMethod public synchronized void clearQQAccount(Promise promise) {
    qqAccountStorage.delete();
    if (qqAccountStorage.getBaseFile().exists()) promise.reject("credential_storage", "Unable to clear account credentials");
    else promise.resolve(null);
  }

  private SecretKey key(String alias) throws Exception {
    KeyStore store = KeyStore.getInstance("AndroidKeyStore");
    store.load(null);
    if (store.containsAlias(alias)) return (SecretKey) store.getKey(alias, null);
    KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
    generator.init(new KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
      .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
    return generator.generateKey();
  }

  private JSONObject readProtected(AtomicFile file, String alias) throws Exception {
    if (!file.getBaseFile().exists()) return null;
    JSONObject envelope = new JSONObject(new String(file.readFully(), StandardCharsets.UTF_8));
    Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
    cipher.init(Cipher.DECRYPT_MODE, key(alias), new GCMParameterSpec(128, Base64.decode(envelope.getString("iv"), Base64.NO_WRAP)));
    cipher.updateAAD(alias.getBytes(StandardCharsets.UTF_8));
    return new JSONObject(new String(cipher.doFinal(Base64.decode(envelope.getString("data"), Base64.NO_WRAP)), StandardCharsets.UTF_8));
  }

  private void writeProtected(AtomicFile file, String alias, JSONObject data) throws Exception {
    Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
    cipher.init(Cipher.ENCRYPT_MODE, key(alias));
    cipher.updateAAD(alias.getBytes(StandardCharsets.UTF_8));
    byte[] encrypted = cipher.doFinal(data.toString().getBytes(StandardCharsets.UTF_8));
    JSONObject envelope = new JSONObject().put("iv", Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP))
      .put("data", Base64.encodeToString(encrypted, Base64.NO_WRAP));
    FileOutputStream stream = null;
    try {
      stream = file.startWrite();
      stream.write(envelope.toString().getBytes(StandardCharsets.UTF_8));
      file.finishWrite(stream);
    } catch (Exception error) {
      if (stream != null) file.failWrite(stream);
      throw error;
    }
  }

  @ReactMethod public synchronized void getQQDailyKey(String owner, Promise promise) {
    try {
      JSONObject data = readProtected(storage, ALIAS);
      promise.resolve(data != null && owner.equals(data.getString("owner")) ? data.getString("key") : null);
    } catch (Exception error) {
      // 不把加密内容或凭证带进异常日志。
      promise.reject("credential_storage", "Unable to read protected recommendation credentials");
    }
  }

  @ReactMethod public synchronized void setQQDailyKey(String owner, String value, Promise promise) {
    try {
      if (!owner.matches("[0-9]+") || !value.matches("qmk-[A-Za-z0-9_-]{12,1024}")) throw new IllegalArgumentException();
      JSONObject data = new JSONObject().put("owner", owner).put("key", value);
      writeProtected(storage, ALIAS, data);
      promise.resolve(null);
    } catch (Exception error) {
      promise.reject("credential_storage", "Unable to save protected recommendation credentials");
    }
  }

  @ReactMethod public synchronized void clearQQDailyKey(Promise promise) {
    storage.delete();
    if (storage.getBaseFile().exists()) promise.reject("credential_storage", "Unable to clear recommendation credentials");
    else promise.resolve(null);
  }

  @ReactMethod public synchronized void getKugouSession(Promise promise) {
    try {
      JSONObject data = readProtected(kugouStorage, KUGOU_ALIAS);
      promise.resolve(data == null ? null : data.toString());
    } catch (Exception error) {
      promise.reject("credential_storage", "Unable to read protected account credentials");
    }
  }

  @ReactMethod public synchronized void setKugouSession(String value, Promise promise) {
    try {
      if (value.length() > 16384) throw new IllegalArgumentException();
      JSONObject data = new JSONObject(value);
      if (!data.getString("userId").matches("[1-9][0-9]*") || data.getString("token").isEmpty()
        || data.getString("token").length() > 4096 || !data.getString("mid").matches("[a-fA-F0-9]{32}")) throw new IllegalArgumentException();
      writeProtected(kugouStorage, KUGOU_ALIAS, data);
      promise.resolve(null);
    } catch (Exception error) {
      promise.reject("credential_storage", "Unable to save protected account credentials");
    }
  }

  @ReactMethod public synchronized void clearKugouSession(Promise promise) {
    kugouStorage.delete();
    if (kugouStorage.getBaseFile().exists()) promise.reject("credential_storage", "Unable to clear account credentials");
    else promise.resolve(null);
  }
}
