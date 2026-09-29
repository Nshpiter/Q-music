package cn.toside.music.mobile.utils;

import android.media.MediaScannerConnection;
import android.os.Environment;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.AtomicFile;
import android.util.Base64;
import android.util.Xml;
import com.amazonaws.auth.BasicAWSCredentials;
import com.amazonaws.ClientConfiguration;
import com.amazonaws.HttpMethod;
import com.amazonaws.services.s3.AmazonS3Client;
import com.amazonaws.services.s3.S3ClientOptions;
import com.amazonaws.services.s3.model.GeneratePresignedUrlRequest;
import com.amazonaws.services.s3.model.ListObjectsV2Request;
import com.amazonaws.services.s3.model.ListObjectsV2Result;
import com.amazonaws.services.s3.model.S3Object;
import com.amazonaws.services.s3.model.S3ObjectSummary;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URI;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import javax.crypto.Cipher;
import javax.crypto.CipherInputStream;
import javax.crypto.CipherOutputStream;
import javax.crypto.SecretKey;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import okhttp3.Credentials;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import org.json.JSONObject;
import org.xmlpull.v1.XmlPullParser;

public class CloudLibraryModule extends ReactContextBaseJavaModule {
  private static final byte[] MAGIC = new byte[]{'Q', 'M', 'C', 'E', 1};
  private static final String STORE_ALIAS = "qmusic.cloud.config.v1";
  private static final String ENCRYPTED_ROOT = "qmusic-cloud/v1";
  private static final String STANDARD_ROOT = "qmusic-cloud/standard/v1";
  private static final int KDF_ROUNDS = 250000;
  private final ReactApplicationContext context;
  private final AtomicFile configFile;
  private final ExecutorService executor = Executors.newSingleThreadExecutor();
  private final SecureRandom random = new SecureRandom();
  private final OkHttpClient uploadHttp = new OkHttpClient.Builder().connectTimeout(30, TimeUnit.SECONDS)
    .writeTimeout(5, TimeUnit.MINUTES).readTimeout(5, TimeUnit.MINUTES).build();

  CloudLibraryModule(ReactApplicationContext context) {
    super(context);
    this.context = context;
    configFile = new AtomicFile(new File(context.getNoBackupFilesDir(), "cloud-config.enc"));
  }

  @Override public String getName() { return "CloudLibraryModule"; }

  private SecretKey localKey() throws Exception {
    KeyStore store = KeyStore.getInstance("AndroidKeyStore");
    store.load(null);
    if (store.containsAlias(STORE_ALIAS)) return (SecretKey) store.getKey(STORE_ALIAS, null);
    javax.crypto.KeyGenerator generator = javax.crypto.KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
    generator.init(new KeyGenParameterSpec.Builder(STORE_ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
      .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
    return generator.generateKey();
  }

  private JSONObject readStore() throws Exception {
    if (!configFile.getBaseFile().exists()) throw new IllegalStateException("请先配置云服务");
    JSONObject envelope = new JSONObject(new String(configFile.readFully(), StandardCharsets.UTF_8));
    Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
    cipher.init(Cipher.DECRYPT_MODE, localKey(), new GCMParameterSpec(128, Base64.decode(envelope.getString("iv"), Base64.NO_WRAP)));
    cipher.updateAAD(STORE_ALIAS.getBytes(StandardCharsets.UTF_8));
    JSONObject saved = new JSONObject(new String(cipher.doFinal(Base64.decode(envelope.getString("data"), Base64.NO_WRAP)), StandardCharsets.UTF_8));
    if (saved.has("profiles")) {
      if ("onedrive".equals(saved.optString("activeProvider"))) {
        JSONObject profiles = saved.getJSONObject("profiles");
        saved.put("activeProvider", profiles.has("s3") ? "s3" : profiles.has("webdav") ? "webdav" : "s3");
      }
      return saved;
    }
    String provider = saved.getString("provider");
    if ("onedrive".equals(provider)) return new JSONObject().put("activeProvider", "s3").put("profiles", new JSONObject());
    return new JSONObject().put("activeProvider", provider).put("profiles", new JSONObject().put(provider, saved));
  }

  private JSONObject storeOrEmpty() throws Exception {
    return configFile.getBaseFile().exists() ? readStore() : new JSONObject().put("activeProvider", "s3").put("profiles", new JSONObject());
  }

  private JSONObject readConfig() throws Exception {
    JSONObject store = readStore();
    JSONObject config = store.getJSONObject("profiles").optJSONObject(store.getString("activeProvider"));
    if (config == null) throw new IllegalStateException("请先配置云服务");
    return config;
  }

  private JSONObject visibleConfig(JSONObject store) throws Exception {
    String provider = store.getString("activeProvider");
    JSONObject saved = store.getJSONObject("profiles").optJSONObject(provider);
    if (saved == null) return new JSONObject().put("provider", provider).put("configured", false);
    JSONObject visible = new JSONObject(saved.toString());
    visible.remove("secretKey");
    visible.put("configured", true);
    return visible;
  }

  @ReactMethod public void getConfig(Promise promise) {
    try {
      promise.resolve(visibleConfig(storeOrEmpty()).toString());
    } catch (Exception error) { promise.reject("cloud_config", error.getMessage()); }
  }

  @ReactMethod public void selectProvider(String provider, Promise promise) {
    try {
      if (!provider.matches("s3|webdav")) throw new IllegalArgumentException("不支持的远程服务");
      JSONObject store = storeOrEmpty();
      store.put("activeProvider", provider);
      writeStore(store);
      promise.resolve(visibleConfig(store).toString());
    } catch (Exception error) { promise.reject("cloud_config", error.getMessage()); }
  }

  @ReactMethod public void saveConfig(String raw, Promise promise) {
    try {
      JSONObject config = new JSONObject(raw);
      JSONObject store = storeOrEmpty();
      JSONObject profiles = store.getJSONObject("profiles");
      JSONObject old = profiles.optJSONObject(config.getString("provider"));
      if (old != null && config.optString("secretKey").isEmpty()) config.put("secretKey", old.optString("secretKey"));
      String provider = config.getString("provider");
      URI endpoint = new URI(config.getString("endpoint"));
      if (!"https".equals(endpoint.getScheme()) && !("http".equals(endpoint.getScheme()) && ("localhost".equals(endpoint.getHost()) || "127.0.0.1".equals(endpoint.getHost())))) throw new IllegalArgumentException("云服务地址必须使用 HTTPS");
      if (config.optString("accessKey").isEmpty() || config.optString("secretKey").isEmpty()) throw new IllegalArgumentException("请填写完整的云服务账号");
      if ("s3".equals(provider) && (config.optString("bucket").isEmpty() || config.optString("region").isEmpty())) throw new IllegalArgumentException("请填写存储桶和区域");
      if (!"s3".equals(provider) && !"webdav".equals(provider)) throw new IllegalArgumentException("不支持的远程服务");
      if (!config.getString("prefix").matches("[A-Za-z0-9/_-]*") || config.getString("prefix").contains("..")) throw new IllegalArgumentException("云端目录格式错误");
      profiles.put(provider, config);
      store.put("activeProvider", provider);
      writeStore(store);
      promise.resolve(null);
    } catch (Exception error) { promise.reject("cloud_config", error.getMessage()); }
  }

  private void writeStore(JSONObject store) throws Exception {
    Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
    cipher.init(Cipher.ENCRYPT_MODE, localKey());
    cipher.updateAAD(STORE_ALIAS.getBytes(StandardCharsets.UTF_8));
    JSONObject envelope = new JSONObject().put("iv", Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP))
      .put("data", Base64.encodeToString(cipher.doFinal(store.toString().getBytes(StandardCharsets.UTF_8)), Base64.NO_WRAP));
    FileOutputStream output = configFile.startWrite();
    try {
      output.write(envelope.toString().getBytes(StandardCharsets.UTF_8));
      configFile.finishWrite(output);
    } catch (Exception error) { configFile.failWrite(output); throw error; }
  }

  private SecretKey cloudKey(String password, byte[] salt) throws Exception {
    if (password.length() < 8) throw new IllegalArgumentException("加密口令至少需要 8 个字符");
    PBEKeySpec spec = new PBEKeySpec(password.toCharArray(), salt, KDF_ROUNDS, 256);
    try { return new javax.crypto.spec.SecretKeySpec(SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded(), "AES"); }
    finally { spec.clearPassword(); }
  }

  private byte[] header(byte[] salt, byte[] iv) {
    return ByteBuffer.allocate(33).put(MAGIC).put(salt).put(iv).array();
  }

  private byte[] encryptBytes(byte[] input, String password) throws Exception {
    byte[] salt = new byte[16], iv = new byte[12];
    random.nextBytes(salt); random.nextBytes(iv);
    Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
    cipher.init(Cipher.ENCRYPT_MODE, cloudKey(password, salt), new GCMParameterSpec(128, iv));
    ByteArrayOutputStream output = new ByteArrayOutputStream();
    output.write(header(salt, iv));
    output.write(cipher.doFinal(input));
    return output.toByteArray();
  }

  private byte[] decryptBytes(byte[] input, String password) throws Exception {
    if (input.length < 49) throw new IllegalArgumentException("云端文件不完整");
    ByteBuffer data = ByteBuffer.wrap(input);
    byte[] magic = new byte[5], salt = new byte[16], iv = new byte[12];
    data.get(magic); data.get(salt); data.get(iv);
    if (!java.util.Arrays.equals(magic, MAGIC)) throw new IllegalArgumentException("云端文件格式不兼容");
    Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
    cipher.init(Cipher.DECRYPT_MODE, cloudKey(password, salt), new GCMParameterSpec(128, iv));
    byte[] ciphertext = new byte[data.remaining()]; data.get(ciphertext);
    return cipher.doFinal(ciphertext);
  }

  private void encryptFile(File source, File target, String password) throws Exception {
    byte[] salt = new byte[16], iv = new byte[12];
    random.nextBytes(salt); random.nextBytes(iv);
    Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
    cipher.init(Cipher.ENCRYPT_MODE, cloudKey(password, salt), new GCMParameterSpec(128, iv));
    try (InputStream input = new FileInputStream(source); OutputStream raw = new FileOutputStream(target)) {
      raw.write(header(salt, iv));
      try (CipherOutputStream encrypted = new CipherOutputStream(raw, cipher)) { copy(input, encrypted); }
    }
  }

  private void decryptFile(File source, File target, String password) throws Exception {
    try (InputStream raw = new FileInputStream(source)) {
      byte[] prefix = new byte[33];
      int read = 0;
      while (read < prefix.length) {
        int count = raw.read(prefix, read, prefix.length - read);
        if (count < 0) throw new IllegalArgumentException("云端文件不完整");
        read += count;
      }
      ByteBuffer data = ByteBuffer.wrap(prefix);
      byte[] magic = new byte[5], salt = new byte[16], iv = new byte[12];
      data.get(magic); data.get(salt); data.get(iv);
      if (!java.util.Arrays.equals(magic, MAGIC)) throw new IllegalArgumentException("云端文件格式不兼容");
      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
      cipher.init(Cipher.DECRYPT_MODE, cloudKey(password, salt), new GCMParameterSpec(128, iv));
      try (CipherInputStream plain = new CipherInputStream(raw, cipher); OutputStream output = new FileOutputStream(target)) { copy(plain, output); }
    }
  }

  private static void copy(InputStream input, OutputStream output) throws Exception {
    byte[] buffer = new byte[65536];
    int count;
    while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
  }

  private static byte[] readBytes(File file) throws Exception {
    ByteArrayOutputStream output = new ByteArrayOutputStream();
    try (InputStream input = new FileInputStream(file)) { copy(input, output); }
    return output.toByteArray();
  }

  private static String hash(File file) throws Exception {
    MessageDigest digest = MessageDigest.getInstance("SHA-256");
    try (InputStream input = new FileInputStream(file)) {
      byte[] buffer = new byte[65536]; int count;
      while ((count = input.read(buffer)) != -1) digest.update(buffer, 0, count);
    }
    StringBuilder hex = new StringBuilder();
    for (byte value : digest.digest()) hex.append(String.format("%02x", value & 0xff));
    return hex.toString();
  }

  private String key(JSONObject config, String type, String id, boolean encrypted) {
    String prefix = config.optString("prefix").replaceAll("^/+|/+$", "");
    return (prefix.isEmpty() ? "" : prefix + "/") + (encrypted ? ENCRYPTED_ROOT : STANDARD_ROOT) + "/" + type + "/" + id + ".qmc";
  }

  private interface Storage {
    List<String> list(String prefix) throws Exception;
    void put(String key, File file) throws Exception;
    void get(String key, File file) throws Exception;
  }

  private Storage storage(JSONObject config) throws Exception {
    if ("s3".equals(config.getString("provider"))) {
      AmazonS3Client client = new AmazonS3Client(new BasicAWSCredentials(config.getString("accessKey"), config.getString("secretKey")), new ClientConfiguration());
      client.setEndpoint(config.getString("endpoint"));
      client.setS3ClientOptions(S3ClientOptions.builder().setPathStyleAccess(true).build());
      client.setSignerRegionOverride(config.getString("region"));
      String bucket = config.getString("bucket");
      return new Storage() {
        public List<String> list(String prefix) {
          List<String> keys = new ArrayList<>();
          ListObjectsV2Request request = new ListObjectsV2Request().withBucketName(bucket).withPrefix(prefix);
          ListObjectsV2Result result;
          do {
            result = client.listObjectsV2(request);
            for (S3ObjectSummary item : result.getObjectSummaries()) keys.add(item.getKey());
            request.setContinuationToken(result.getNextContinuationToken());
          } while (result.isTruncated());
          return keys;
        }
        public void put(String key, File file) throws Exception {
          GeneratePresignedUrlRequest signed = new GeneratePresignedUrlRequest(bucket, key, HttpMethod.PUT)
            .withContentType("application/octet-stream");
          Request request = new Request.Builder().url(client.generatePresignedUrl(signed))
            .put(RequestBody.create(MediaType.parse("application/octet-stream"), file)).build();
          try (Response response = uploadHttp.newCall(request).execute()) {
            if (!response.isSuccessful()) throw new IllegalStateException("S3 上传失败 (HTTP " + response.code() + ")");
          }
        }
        public void get(String key, File file) throws Exception {
          try (S3Object object = client.getObject(bucket, key); InputStream input = object.getObjectContent(); OutputStream output = new FileOutputStream(file)) { copy(input, output); }
        }
      };
    }
    if (!"webdav".equals(config.getString("provider"))) throw new IllegalArgumentException("不支持的远程服务");
    OkHttpClient client = new OkHttpClient();
    String base = config.getString("endpoint").replaceAll("/+$", "");
    String auth = Credentials.basic(config.getString("accessKey"), config.getString("secretKey"));
    class Dav {
      String url(String key) throws Exception {
        StringBuilder encoded = new StringBuilder(base);
        for (String part : key.split("/")) encoded.append('/').append(java.net.URLEncoder.encode(part, "UTF-8").replace("+", "%20"));
        return encoded.toString();
      }
      Response call(String method, String key, RequestBody body) throws Exception {
        Request request = new Request.Builder().url(url(key)).header("Authorization", auth)
          .method(method, body).build();
        Response response = client.newCall(request).execute();
        if (!response.isSuccessful() && !(method.equals("MKCOL") && response.code() == 405)) {
          int code = response.code(); response.close(); throw new IllegalStateException("WebDAV " + method + " 失败 (" + code + ")");
        }
        return response;
      }
      void dirs(String key) throws Exception {
        String[] parts = key.split("/");
        String path = "";
        for (int i = 0; i < parts.length - 1; i++) {
          path += (path.isEmpty() ? "" : "/") + parts[i];
          try (Response ignored = call("MKCOL", path, RequestBody.create(null, new byte[0]))) {}
        }
      }
    }
    Dav dav = new Dav();
    return new Storage() {
      public List<String> list(String prefix) throws Exception {
        String folder = prefix.replaceAll("/$", "");
        Request request = new Request.Builder().url(dav.url(folder)).header("Authorization", auth).header("Depth", "1")
          .method("PROPFIND", RequestBody.create(null, new byte[0])).build();
        List<String> keys = new ArrayList<>();
        try (Response response = client.newCall(request).execute()) {
          if (response.code() == 404) return keys;
          if (!response.isSuccessful() || response.body() == null) throw new IllegalStateException("WebDAV 文件列表读取失败 (" + response.code() + ")");
          XmlPullParser parser = Xml.newPullParser();
          parser.setFeature(XmlPullParser.FEATURE_PROCESS_NAMESPACES, true);
          parser.setInput(response.body().byteStream(), "UTF-8");
          String root = new URI(base + "/").getPath();
          int event;
          while ((event = parser.next()) != XmlPullParser.END_DOCUMENT) {
            if (event == XmlPullParser.DOCDECL) throw new IllegalStateException("WebDAV 返回了不受支持的 XML 文档");
            if (event != XmlPullParser.START_TAG || !"DAV:".equals(parser.getNamespace()) || !"href".equals(parser.getName())) continue;
            String path = new URI(base + "/").resolve(parser.nextText()).getPath();
            if (!path.startsWith(root)) continue;
            String key = path.substring(root.length());
            if (key.startsWith(prefix) && key.endsWith(".qmc")) keys.add(key);
          }
        }
        return keys;
      }
      public void put(String key, File file) throws Exception {
        dav.dirs(key);
        try (Response ignored = dav.call("PUT", key, RequestBody.create(MediaType.parse("application/octet-stream"), file))) {}
      }
      public void get(String key, File file) throws Exception {
        try (Response response = dav.call("GET", key, null); InputStream input = response.body().byteStream(); OutputStream output = new FileOutputStream(file)) { copy(input, output); }
      }
    };
  }

  private JSONObject track(String path, String playlist, String name, String singer) throws Exception {
    File file = new File(path);
    if (!file.isFile() || file.length() == 0) throw new IllegalArgumentException("请选择有效歌曲文件");
    String fileName = file.getName();
    if (!fileName.toLowerCase().matches(".*\\.(mp3|flac|wav|m4a|aac|ogg|ape)")) throw new IllegalArgumentException("不支持的歌曲格式");
    String title = name.trim().isEmpty() ? fileName.substring(0, fileName.lastIndexOf('.')) : name.trim();
    return new JSONObject().put("id", hash(file)).put("name", title.substring(0, Math.min(160, title.length())))
      .put("singer", singer.trim().substring(0, Math.min(160, singer.trim().length()))).put("fileName", fileName).put("size", file.length())
      .put("playlist", playlist.trim().isEmpty() ? "云端曲库" : playlist.trim().substring(0, Math.min(100, playlist.trim().length())));
  }

  @ReactMethod public void upload(String path, String password, String playlist, String name, String singer, Promise promise) {
    executor.execute(() -> {
      File audio = null, meta = null;
      try {
        JSONObject config = readConfig();
        JSONObject track = track(path, playlist, name, singer);
        Storage storage = storage(config);
        boolean encrypted = !password.isEmpty();
        if (encrypted && password.length() < 8) throw new IllegalArgumentException("端到端加密口令至少需要 8 个字符");
        meta = File.createTempFile("cloud-meta-", ".qmc", context.getCacheDir());
        if (encrypted) {
          audio = File.createTempFile("cloud-audio-", ".qmc", context.getCacheDir());
          encryptFile(new File(path), audio, password);
        }
        storage.put(key(config, "audio", track.getString("id"), encrypted), encrypted ? audio : new File(path));
        byte[] metadata = track.toString().getBytes(StandardCharsets.UTF_8);
        try (OutputStream output = new FileOutputStream(meta)) { output.write(encrypted ? encryptBytes(metadata, password) : metadata); }
        storage.put(key(config, "meta", track.getString("id"), encrypted), meta);
        promise.resolve(track.toString());
      } catch (Exception error) { promise.reject("cloud_upload", error.getMessage()); }
      finally { if (audio != null) audio.delete(); if (meta != null) meta.delete(); }
    });
  }

  private List<JSONObject> tracks(JSONObject config, String password) throws Exception {
    boolean encrypted = !password.isEmpty();
    if (encrypted && password.length() < 8) throw new IllegalArgumentException("端到端加密口令至少需要 8 个字符");
    Storage storage = storage(config);
    String prefix = key(config, "meta", "", encrypted).replaceAll("\\.qmc$", "");
    List<JSONObject> result = new ArrayList<>();
    for (String key : storage.list(prefix)) {
      File temp = File.createTempFile("cloud-meta-", ".qmc", context.getCacheDir());
      try {
        storage.get(key, temp);
        byte[] metadata = readBytes(temp);
        JSONObject track = new JSONObject(new String(encrypted ? decryptBytes(metadata, password) : metadata, StandardCharsets.UTF_8));
        if (track.getString("id").matches("[a-f0-9]{64}")) result.add(track);
      } finally { temp.delete(); }
    }
    return result;
  }

  @ReactMethod public void list(String password, Promise promise) {
    executor.execute(() -> {
      try {
        WritableArray result = Arguments.createArray();
        for (JSONObject track : tracks(readConfig(), password)) result.pushString(track.toString());
        promise.resolve(result);
      } catch (Exception error) { promise.reject("cloud_list", error.getMessage()); }
    });
  }

  @ReactMethod public void download(ReadableArray ids, String password, Promise promise) {
    executor.execute(() -> {
      try {
        JSONObject config = readConfig();
        Storage storage = storage(config);
        boolean encryptedMode = !password.isEmpty();
        List<JSONObject> available = tracks(config, password);
        File directory = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_MUSIC), "QMusic Cloud");
        if (!directory.exists() && !directory.mkdirs()) throw new IllegalStateException("无法创建本地音乐目录");
        WritableArray result = Arguments.createArray();
        for (JSONObject track : available) {
          String id = track.getString("id");
          boolean selected = false;
          for (int i = 0; i < ids.size(); i++) if (id.equals(ids.getString(i))) selected = true;
          if (!selected) continue;
          String original = track.getString("fileName");
          String extension = original.substring(original.lastIndexOf('.')).toLowerCase();
          if (!extension.matches("\\.(mp3|flac|wav|m4a|aac|ogg|ape)")) throw new IllegalArgumentException("云端歌曲格式不支持");
          String name = track.getString("name").replaceAll("[^\\p{L}\\p{N} ._()-]", "_");
          if (name.length() > 120) name = name.substring(0, 120);
          File target = new File(directory, name + "-" + id.substring(0, 8) + extension);
          if (!target.exists() || !id.equals(hash(target))) {
            File remote = File.createTempFile("cloud-audio-", ".qmc", context.getCacheDir());
            File plain = File.createTempFile("cloud-audio-", ".part", directory);
            try {
              storage.get(key(config, "audio", id, encryptedMode), remote);
              if (encryptedMode) decryptFile(remote, plain, password);
              else try (InputStream input = new FileInputStream(remote); OutputStream output = new FileOutputStream(plain)) { copy(input, output); }
              if (!id.equals(hash(plain))) throw new IllegalStateException("云端歌曲校验失败");
              if (target.exists() && !target.delete()) throw new IllegalStateException("无法替换本地歌曲");
              if (!plain.renameTo(target)) throw new IllegalStateException("无法保存本地歌曲");
            } finally { remote.delete(); plain.delete(); }
          }
          MediaScannerConnection.scanFile(context, new String[]{target.getAbsolutePath()}, null, null);
          WritableMap item = Arguments.createMap();
          item.putString("id", id);
          item.putString("name", track.getString("name"));
          item.putString("singer", track.optString("singer"));
          item.putString("fileName", original);
          item.putDouble("size", track.optLong("size"));
          item.putString("playlist", track.optString("playlist", "云端曲库"));
          item.putString("filePath", target.getAbsolutePath());
          result.pushMap(item);
        }
        promise.resolve(result);
      } catch (Exception error) { promise.reject("cloud_download", error.getMessage()); }
    });
  }
}
