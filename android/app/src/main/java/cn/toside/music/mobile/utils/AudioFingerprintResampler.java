package cn.toside.music.mobile.utils;

/** 指纹采样需要先低通再降采样，否则高频混叠会改变频谱峰值，导致误识别。 */
final class AudioFingerprintResampler {
  private static final int TARGET_RATE = 8000, TAPS = 127;
  final int rate;
  final short[] samples;
  int count;
  private long frames;
  private int position;
  private final double[] coefficients = new double[TAPS];
  private final double[] history = new double[TAPS];

  AudioFingerprintResampler(int sourceRate, int seconds) {
    if (sourceRate < TARGET_RATE || sourceRate > 384000) throw new IllegalArgumentException("Unsupported sample rate");
    rate = sourceRate;
    samples = new short[TARGET_RATE * seconds];
    double cutoff = 3800.0 / sourceRate, sum = 0;
    for (int i = 0; i < TAPS; i++) {
      double x = i - (TAPS - 1) / 2.0;
      double sinc = x == 0 ? 2 * cutoff : Math.sin(2 * Math.PI * cutoff * x) / (Math.PI * x);
      double window = 0.42 - 0.5 * Math.cos(2 * Math.PI * i / (TAPS - 1)) + 0.08 * Math.cos(4 * Math.PI * i / (TAPS - 1));
      coefficients[i] = sinc * window; sum += coefficients[i];
    }
    for (int i = 0; i < TAPS; i++) coefficients[i] /= sum;
  }

  void add(double value) {
    if (count == samples.length) return;
    history[position] = Double.isFinite(value) ? value : 0;
    frames++;
    if (frames * TARGET_RATE / rate > count) {
      double filtered = value;
      if (rate != TARGET_RATE) {
        filtered = 0;
        for (int i = 0; i < TAPS; i++) filtered += history[(position - i + TAPS) % TAPS] * coefficients[i];
      }
      samples[count++] = (short) Math.round(Math.max(-1, Math.min(1, filtered)) * 32767);
    }
    position = (position + 1) % TAPS;
  }
}
