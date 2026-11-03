package cn.toside.music.mobile.utils;

/** 无 Android 依赖的信号测试；运行产物放到临时构建目录。 */
public class AudioFingerprintResamplerTest {
  private static AudioFingerprintResampler tone(int rate, double frequency) {
    AudioFingerprintResampler result = new AudioFingerprintResampler(rate, 6);
    for (int i = 0; i < rate * 6; i++) result.add(0.5 * Math.sin(2 * Math.PI * frequency * i / rate));
    if (result.count != 48000) throw new AssertionError("Unexpected duration: " + result.count);
    return result;
  }
  private static double rms(AudioFingerprintResampler sample) {
    double sum = 0;
    for (int i = 100; i < sample.count; i++) sum += (double) sample.samples[i] * sample.samples[i];
    return Math.sqrt(sum / (sample.count - 100)) / 32768;
  }
  public static void main(String[] args) {
    for (int rate : new int[] { 8000, 16000, 44100, 48000 }) {
      double audible = rms(tone(rate, 1000));
      if (audible < 0.32 || audible > 0.37) throw new AssertionError("Passband changed: " + rate + ": " + audible);
      if (rate >= 44100 && rms(tone(rate, 10000)) > 0.002) throw new AssertionError("Aliasing: " + rate);
    }
    AudioFingerprintResampler dc = new AudioFingerprintResampler(44100, 6);
    for (int i = 0; i < 44100 * 7; i++) dc.add(0.25);
    if (dc.count != 48000 || Math.abs(dc.samples[dc.count - 1] - 8192) > 1) throw new AssertionError("Capacity or DC gain");
    System.out.println("PASS: sample counts, passband, anti-aliasing and bounded output");
  }
}
