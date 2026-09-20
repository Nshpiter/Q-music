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

/** 官方日推凭证只保存在本机，不参与 Android 备份或歌单导出。 */
public class MusicCredentialModule extends ReactContextBaseJavaModule {
  private static final String ALIAS = "qmusic.qq.daily.v1";
  private final AtomicFile storage;

  MusicCredentialModule(ReactApplicationContext context) {
    super(context);
    storage = new AtomicFile(new File(context.getNoBackupFilesDir(), "qq-daily.enc"));
  }

  @Override public String getName() { return "MusicCredentialModule"; }

  private SecretKey key() throws Exception {
    KeyStore store = KeyStore.getInstance("AndroidKeyStore");
    store.load(null);
    if (store.containsAlias(ALIAS)) return (SecretKey) store.getKey(ALIAS, null);
    KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
    generator.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
      .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
    return generator.generateKey();
  }

  @ReactMethod public synchronized void getQQDailyKey(String owner, Promise promise) {
    try {
      if (!storage.getBaseFile().exists()) { promise.resolve(null); return; }
      JSONObject envelope = new JSONObject(new String(storage.readFully(), StandardCharsets.UTF_8));
      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
      cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, Base64.decode(envelope.getString("iv"), Base64.NO_WRAP)));
      cipher.updateAAD(ALIAS.getBytes(StandardCharsets.UTF_8));
      JSONObject data = new JSONObject(new String(cipher.doFinal(Base64.decode(envelope.getString("data"), Base64.NO_WRAP)), StandardCharsets.UTF_8));
      promise.resolve(owner.equals(data.getString("owner")) ? data.getString("key") : null);
    } catch (Exception error) {
      // 不把加密内容或凭证带进异常日志。
      promise.reject("credential_storage", "Unable to read protected recommendation credentials");
    }
  }

  @ReactMethod public synchronized void setQQDailyKey(String owner, String value, Promise promise) {
    FileOutputStream stream = null;
    try {
      if (!owner.matches("[0-9]+") || !value.matches("qmk-[A-Za-z0-9_-]{12,1024}")) throw new IllegalArgumentException();
      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
      cipher.init(Cipher.ENCRYPT_MODE, key());
      cipher.updateAAD(ALIAS.getBytes(StandardCharsets.UTF_8));
      JSONObject data = new JSONObject().put("owner", owner).put("key", value);
      byte[] encrypted = cipher.doFinal(data.toString().getBytes(StandardCharsets.UTF_8));
      JSONObject envelope = new JSONObject().put("iv", Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP))
        .put("data", Base64.encodeToString(encrypted, Base64.NO_WRAP));
      stream = storage.startWrite();
      stream.write(envelope.toString().getBytes(StandardCharsets.UTF_8));
      storage.finishWrite(stream);
      promise.resolve(null);
    } catch (Exception error) {
      if (stream != null) storage.failWrite(stream);
      promise.reject("credential_storage", "Unable to save protected recommendation credentials");
    }
  }

  @ReactMethod public synchronized void clearQQDailyKey(Promise promise) {
    storage.delete();
    if (storage.getBaseFile().exists()) promise.reject("credential_storage", "Unable to clear recommendation credentials");
    else promise.resolve(null);
  }
}
