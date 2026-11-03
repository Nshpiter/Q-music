package cn.toside.music.mobile.utils;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaCodec;
import android.media.MediaExtractor;
import android.media.MediaFormat;
import android.media.MediaRecorder;
import android.net.Uri;
import android.os.SystemClock;
import android.util.Base64;
import com.facebook.react.bridge.*;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

/** 只在前台按需采集短音频；PCM 保留在内存，不写入录音文件。 */
public class MusicRecognitionModule extends ReactContextBaseJavaModule implements LifecycleEventListener {
  private static final int RATE = 8000, SECONDS = 10, PICK_AUDIO = 42618;
  private final ExecutorService worker = Executors.newSingleThreadExecutor();
  private final AtomicInteger revision = new AtomicInteger();
  private final AtomicBoolean busy = new AtomicBoolean();
  private volatile AudioRecord recorder;
  private volatile KugouRecognitionRequest matching;
  private Promise picker;
  private int pickerRevision;

  MusicRecognitionModule(ReactApplicationContext context) {
    super(context);
    context.addLifecycleEventListener(this);
    context.addActivityEventListener(new BaseActivityEventListener() {
      @Override public void onActivityResult(Activity activity, int request, int result, Intent data) {
        if (request != PICK_AUDIO || picker == null) return;
        Promise promise = picker; picker = null;
        int token = pickerRevision;
        if (result != Activity.RESULT_OK || data == null || data.getData() == null) { promise.resolve(null); return; }
        if (!busy.compareAndSet(false, true)) { promise.reject("recognition_busy", "Recognition is busy"); return; }
        Uri uri = data.getData();
        worker.execute(() -> {
          try { promise.resolve(decode(uri, token)); }
          catch (Exception error) { promise.reject(token != revision.get() ? "recognition_cancelled" : "recognition_file_error", "Unable to decode this audio"); }
          finally { busy.set(false); }
        });
      }
    });
  }

  @Override public String getName() { return "MusicRecognitionModule"; }

  private void check(int token) throws Exception {
    if (token != revision.get()) throw new Exception("cancelled");
  }

  private WritableMap sample(short[] samples, int count, int token) throws Exception {
    check(token);
    if (count < RATE * 3) throw new Exception("Audio is too short");
    ByteBuffer buffer = ByteBuffer.allocate(count * 2).order(ByteOrder.LITTLE_ENDIAN);
    double energy = 0;
    for (int i = 0; i < count; i++) { buffer.putShort(samples[i]); energy += (double) samples[i] * samples[i]; }
    WritableMap data = Arguments.createMap();
    data.putString("pcm", Base64.encodeToString(buffer.array(), Base64.NO_WRAP));
    data.putDouble("duration", (double) count / RATE);
    data.putDouble("rms", Math.sqrt(energy / count) / 32768);
    return data;
  }

  private AudioRecord openMicrophone(int token) throws Exception {
    for (int source : new int[] { MediaRecorder.AudioSource.VOICE_RECOGNITION, MediaRecorder.AudioSource.MIC }) {
      for (int rate : new int[] { 44100, 48000, 16000 }) {
        check(token);
        AudioRecord candidate = null;
        try {
          int minimum = AudioRecord.getMinBufferSize(rate, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
          if (minimum <= 0) continue;
          candidate = new AudioRecord(source, rate, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, Math.max(minimum, rate / 2));
          if (candidate.getState() != AudioRecord.STATE_INITIALIZED) throw new IllegalStateException("Microphone unavailable");
          recorder = candidate;
          check(token);
          candidate.startRecording();
          if (candidate.getRecordingState() != AudioRecord.RECORDSTATE_RECORDING) throw new IllegalStateException("Microphone did not start");
          return candidate;
        } catch (Exception error) {
          recorder = null;
          if (candidate != null) { try { candidate.stop(); } catch (Exception ignored) {} candidate.release(); }
          check(token);
          if (error instanceof SecurityException) throw error;
        }
      }
    }
    throw new Exception("No supported microphone configuration");
  }

  @ReactMethod public void record(Promise promise) {
    if (getReactApplicationContext().checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
      promise.reject("recognition_permission", "Microphone permission is required"); return;
    }
    if (!busy.compareAndSet(false, true)) { promise.reject("recognition_busy", "Recognition is busy"); return; }
    int token = revision.incrementAndGet();
    worker.execute(() -> {
      AudioRecord audio = null;
      WritableMap result = null;
      String failure = null;
      try {
        check(token);
        // 使用常规采样率采集，再由本地低通滤波降到 8 kHz，避免设备的低采样率语音处理损伤音乐频谱。
        audio = openMicrophone(token);
        int captureRate = audio.getSampleRate();
        AudioFingerprintResampler resampler = new AudioFingerprintResampler(captureRate, SECONDS);
        short[] chunk = new short[2048];
        long deadline = SystemClock.elapsedRealtime() + 16000;
        while (resampler.count < resampler.samples.length) {
          check(token);
          if (SystemClock.elapsedRealtime() > deadline) throw new Exception("Recording timed out");
          int read = audio.read(chunk, 0, chunk.length, AudioRecord.READ_NON_BLOCKING);
          if (read < 0) throw new Exception("Microphone read failed");
          if (read == 0) Thread.sleep(15);
          else for (int i = 0; i < read; i++) resampler.add(chunk[i] / 32768.0);
        }
        result = sample(resampler.samples, resampler.count, token);
      } catch (Exception error) {
        failure = token != revision.get() ? "recognition_cancelled" : "recognition_record_error";
      } finally {
        recorder = null;
        if (audio != null) { try { audio.stop(); } catch (Exception ignored) {} audio.release(); }
        busy.set(false);
      }
      if (token != revision.get()) failure = "recognition_cancelled";
      if (failure != null) promise.reject(failure, "Unable to record audio");
      else promise.resolve(result);
    });
  }

  @ReactMethod public void match(String pcm, Promise promise) {
    if (pcm.length() > 213336 || !busy.compareAndSet(false, true)) { promise.reject("recognition_busy", "Recognition is busy"); return; }
    int token = revision.get();
    worker.execute(() -> {
      KugouRecognitionRequest request = new KugouRecognitionRequest();
      matching = request;
      try {
        check(token);
        String result = request.match(Base64.decode(pcm, Base64.NO_WRAP));
        check(token);
        promise.resolve(result);
      } catch (Exception error) {
        promise.reject(token != revision.get() ? "recognition_cancelled" : error instanceof java.net.SocketTimeoutException ? "recognition_timeout" : "recognition_service_error", "Unable to match audio");
      } finally { matching = null; busy.set(false); }
    });
  }

  @ReactMethod public void pickFile(Promise promise) {
    Activity activity = getCurrentActivity();
    if (activity == null || picker != null || busy.get()) { promise.reject("recognition_busy", "Recognition is busy"); return; }
    picker = promise; pickerRevision = revision.incrementAndGet();
    Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("audio/*").addCategory(Intent.CATEGORY_OPENABLE);
    try { activity.startActivityForResult(intent, PICK_AUDIO); }
    catch (Exception error) { picker = null; promise.reject("recognition_file_error", "Unable to open audio picker"); }
  }

  private WritableMap decode(Uri uri, int token) throws Exception {
    MediaExtractor extractor = new MediaExtractor();
    MediaCodec codec = null;
    try {
      check(token);
      extractor.setDataSource(getReactApplicationContext(), uri, null);
      MediaFormat format = null;
      for (int i = 0; i < extractor.getTrackCount(); i++) {
        MediaFormat candidate = extractor.getTrackFormat(i);
        if (candidate.getString(MediaFormat.KEY_MIME).startsWith("audio/")) { extractor.selectTrack(i); format = candidate; break; }
      }
      if (format == null) throw new Exception("No audio track");
      codec = MediaCodec.createDecoderByType(format.getString(MediaFormat.KEY_MIME));
      codec.configure(format, null, null, 0); codec.start();
      int rate = format.getInteger(MediaFormat.KEY_SAMPLE_RATE), channels = format.getInteger(MediaFormat.KEY_CHANNEL_COUNT);
      int encoding = AudioFormat.ENCODING_PCM_16BIT;
      AudioFingerprintResampler resampler = new AudioFingerprintResampler(rate, SECONDS);
      boolean inputDone = false, outputDone = false;
      long deadline = SystemClock.elapsedRealtime() + 15000;
      MediaCodec.BufferInfo info = new MediaCodec.BufferInfo();
      while (!outputDone && resampler.count < resampler.samples.length) {
        check(token);
        if (SystemClock.elapsedRealtime() > deadline) throw new Exception("Decoding timed out");
        if (!inputDone) {
          int index = codec.dequeueInputBuffer(10000);
          if (index >= 0) {
            ByteBuffer input = codec.getInputBuffer(index);
            int size = extractor.readSampleData(input, 0);
            if (size < 0) { codec.queueInputBuffer(index, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM); inputDone = true; }
            else { codec.queueInputBuffer(index, 0, size, extractor.getSampleTime(), 0); extractor.advance(); }
          }
        }
        int index = codec.dequeueOutputBuffer(info, 10000);
        if (index == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
          MediaFormat out = codec.getOutputFormat();
          rate = out.getInteger(MediaFormat.KEY_SAMPLE_RATE); channels = out.getInteger(MediaFormat.KEY_CHANNEL_COUNT);
          if (out.containsKey(MediaFormat.KEY_PCM_ENCODING)) encoding = out.getInteger(MediaFormat.KEY_PCM_ENCODING);
          if (rate < RATE || channels < 1 || channels > 8 || (encoding != AudioFormat.ENCODING_PCM_16BIT && encoding != AudioFormat.ENCODING_PCM_FLOAT)) throw new Exception("Unsupported PCM format");
          if (rate != resampler.rate) {
            if (resampler.count > 0) throw new Exception("Audio sample rate changed");
            resampler = new AudioFingerprintResampler(rate, SECONDS);
          }
        } else if (index >= 0) {
          ByteBuffer output = codec.getOutputBuffer(index).order(ByteOrder.LITTLE_ENDIAN);
          output.position(info.offset); output.limit(info.offset + info.size);
          int bytes = encoding == AudioFormat.ENCODING_PCM_FLOAT ? 4 : 2;
          while (output.remaining() >= channels * bytes && resampler.count < resampler.samples.length) {
            double mono = 0;
            for (int c = 0; c < channels; c++) mono += bytes == 4 ? output.getFloat() : output.getShort() / 32768.0;
            resampler.add(mono / channels);
          }
          outputDone = (info.flags & MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0;
          codec.releaseOutputBuffer(index, false);
        }
      }
      return sample(resampler.samples, resampler.count, token);
    } finally {
      if (codec != null) { try { codec.stop(); } catch (Exception ignored) {} codec.release(); }
      extractor.release();
    }
  }

  @ReactMethod public void cancel() {
    revision.incrementAndGet();
    KugouRecognitionRequest request = matching;
    if (request != null) request.cancel();
    AudioRecord audio = recorder;
    if (audio != null) { try { audio.stop(); } catch (Exception ignored) {} }
  }
  @Override public void onHostResume() {}
  @Override public void onHostPause() { if (picker == null) cancel(); }
  @Override public void onHostDestroy() { cancel(); if (picker != null) { picker.resolve(null); picker = null; } }
  @Override public void invalidate() { onHostDestroy(); worker.shutdownNow(); getReactApplicationContext().removeLifecycleEventListener(this); super.invalidate(); }
}
