package cn.toside.music.mobile.utils;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;

/** 参考 Walnut 的公开协议流程，匿名请求，不沿用参考代码里的账号、Cookie 或设备标识。 */
final class KugouRecognitionRequest {
  private volatile HttpURLConnection connection;
  private volatile boolean cancelled;

  void cancel() {
    cancelled = true;
    HttpURLConnection active = connection;
    if (active != null) active.disconnect();
  }

  String match(byte[] pcm) throws Exception {
    if (pcm.length < 48000 || pcm.length > 160000 || pcm.length % 2 != 0) throw new IllegalArgumentException("Invalid PCM duration");
    TreeMap<String, String> params = new TreeMap<>();
    params.put("appid", "1005");
    params.put("area_code", "1");
    params.put("clienttime", String.valueOf(System.currentTimeMillis() / 1000));
    params.put("clientver", "20489");
    params.put("dfid", "-");
    params.put("fpid", String.valueOf(System.currentTimeMillis()));
    params.put("include_unpublish", "1");
    params.put("mid", UUID.randomUUID().toString().replace("-", ""));
    params.put("multi_result", "1");
    params.put("useid", "0");
    StringBuilder ordered = new StringBuilder(), query = new StringBuilder();
    for (Map.Entry<String, String> entry : params.entrySet()) {
      ordered.append(entry.getKey()).append('=').append(entry.getValue());
      query.append(entry.getKey()).append('=').append(entry.getValue()).append('&');
    }
    byte[] salt = "OIlwieks28dk2k092lksi2UIkp".getBytes(StandardCharsets.UTF_8);
    MessageDigest digest = MessageDigest.getInstance("MD5");
    digest.update(salt); digest.update(ordered.toString().getBytes(StandardCharsets.UTF_8)); digest.update(pcm); digest.update(salt);
    query.append("signature=");
    for (byte value : digest.digest()) query.append(String.format("%02x", value & 255));
    HttpURLConnection current = (HttpURLConnection) new URL("https://gateway.kugou.com/fingerprint.service/v1/music_trackid_mulit?" + query).openConnection();
    connection = current;
    try {
      if (cancelled) throw new IllegalStateException("cancelled");
      current.setInstanceFollowRedirects(false);
      current.setConnectTimeout(10000); current.setReadTimeout(12000);
      current.setRequestMethod("POST"); current.setDoOutput(true);
      current.setRequestProperty("Content-Type", "application/octet-stream");
      current.setRequestProperty("User-Agent", "KuGou/11490 (Android)");
      current.setFixedLengthStreamingMode(pcm.length);
      try (OutputStream output = current.getOutputStream()) { output.write(pcm); }
      if (current.getResponseCode() != 200) throw new IllegalStateException("recognition_service_error");
      try (InputStream input = current.getInputStream(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
        byte[] buffer = new byte[4096];
        int count;
        while ((count = input.read(buffer)) != -1) {
          if (cancelled) throw new IllegalStateException("cancelled");
          if (output.size() + count > 1024 * 1024) throw new IllegalStateException("recognition_service_error");
          output.write(buffer, 0, count);
        }
        return output.toString("UTF-8");
      }
    } finally { current.disconnect(); connection = null; }
  }
}
