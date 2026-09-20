package cn.toside.music.mobile.utils;

import android.content.Context;
import android.animation.ValueAnimator;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Outline;
import android.graphics.Path;
import android.graphics.RadialGradient;
import android.graphics.RectF;
import android.graphics.Shader;
import android.os.SystemClock;
import android.util.Log;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewOutlineProvider;
import android.view.ViewTreeObserver;
import com.facebook.react.views.view.ReactViewGroup;
import com.facebook.react.uimanager.util.ReactFindViewUtil;

/** 小面积实时玻璃：仅在窗口重绘时采样本应用背景，排除所有玻璃及其文字，避免重影。 */
public class GlassView extends ReactViewGroup implements ViewTreeObserver.OnPreDrawListener {
  private static boolean sampling;
  private static final float SCALE = 6f;
  private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);
  private final Path clip = new Path();
  private final Path selectionClip = new Path();
  private final RectF selectionBounds = new RectF();
  private final float[] lensMesh = new float[(40 + 1) * (16 + 1) * 2];
  private boolean selectionEnabled;
  private View selectionView;
  private float lastSelectionX = Float.NaN;
  private float lastSelectionScale;

  private final RectF bounds = new RectF();
  private final int[] location = new int[2];
  private final int[] rootLocation = new int[2];
  private Bitmap backdrop;
  private int[] pixels;
  private int[] scratch;
  private boolean glassEnabled = true;
  private boolean dark;
  private boolean motionEnabled = true;
  private float radius;
  private float blur;
  private float touchX;
  private float touchY;
  private float touchLight;
  private long lastCapture;
  private boolean skipCapture;
  private ViewTreeObserver observer;
  private ValueAnimator touchAnimator;


  public GlassView(Context context) {
    super(context);
    float density = getResources().getDisplayMetrics().density;
    radius = 24 * density;
    blur = 18 * density;
    setElevation(2f * density);
    setOutlineProvider(new ViewOutlineProvider() {
      @Override public void getOutline(View view, Outline outline) {
        outline.setRoundRect(0, 0, view.getWidth(), view.getHeight(), radius);
      }
    });
  }

  public void setSelection(boolean value) { selectionEnabled = value; selectionView = null; invalidate(); }
  public void setGlassEnabled(boolean value) { glassEnabled = value; releaseBackdrop(); invalidate(); }
  public void setDark(boolean value) { dark = value; invalidate(); }
  public void setMotionEnabled(boolean value) { motionEnabled = value; if (touchAnimator != null) touchAnimator.cancel(); touchLight = 0; invalidate(); }
  public void setCorner(float value) { radius = value; updateClip(); invalidateOutline(); invalidate(); }
  public void setBlur(float value) { blur = value; releaseBackdrop(); invalidate(); }

  private void updateClip() {
    bounds.set(0, 0, getWidth(), getHeight());
    clip.reset();
    clip.addRoundRect(bounds, radius, radius, Path.Direction.CW);

  }

  @Override protected void onSizeChanged(int w, int h, int oldw, int oldh) {
    super.onSizeChanged(w, h, oldw, oldh);
    updateClip();
    releaseBackdrop();
  }

  @Override protected void onAttachedToWindow() {
    super.onAttachedToWindow();
    observer = getRootView().getViewTreeObserver();
    observer.addOnPreDrawListener(this);
  }

  @Override protected void onDetachedFromWindow() {
    if (touchAnimator != null) touchAnimator.cancel();
    if (observer != null && observer.isAlive()) observer.removeOnPreDrawListener(this);
    observer = null;
    selectionView = null;
    releaseBackdrop();
    super.onDetachedFromWindow();
  }

  private void releaseBackdrop() {
    // 交给 GC 释放，避免 RenderThread 仍引用上一帧位图时被提前 recycle。
    backdrop = null;
    pixels = null;
    scratch = null;
    lastCapture = 0;
    skipCapture = false;
  }

  @Override public boolean onPreDraw() {
    if (selectionEnabled) {
      if (selectionView == null) selectionView = ReactFindViewUtil.findView(this, "qmusic-glass-selection");
      if (selectionView != null && (lastSelectionX != selectionView.getX() || lastSelectionScale != selectionView.getScaleX())) {
        lastSelectionX = selectionView.getX();
        lastSelectionScale = selectionView.getScaleX();
        invalidate();
      }
    }
    // 跳过自身失效请求产生的下一帧，避免慢设备形成持续采样循环。
    if (skipCapture) { skipCapture = false; return true; }
    if (!glassEnabled || sampling || !isShown() || getWindowVisibility() != VISIBLE || getWidth() == 0 || getHeight() == 0) return true;
    long now = SystemClock.uptimeMillis();
    if (now - lastCapture < 42) return true;
    lastCapture = now;
    int pad = (int) Math.ceil(blur * 2);
    int w = Math.max(1, (int) Math.ceil((getWidth() + pad * 2) / SCALE));
    int h = Math.max(1, (int) Math.ceil((getHeight() + pad * 2) / SCALE));
    try {
      if (backdrop == null || backdrop.getWidth() != w || backdrop.getHeight() != h) {
        releaseBackdrop();
        backdrop = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        pixels = new int[w * h];
        scratch = new int[w * h];
      }
      backdrop.eraseColor(dark ? Color.rgb(24, 28, 30) : Color.rgb(246, 249, 248));
      View root = getRootView();
      root.getLocationOnScreen(rootLocation);
      getLocationOnScreen(location);
      Canvas sample = new Canvas(backdrop);
      sample.scale(1 / SCALE, 1 / SCALE);
      sample.translate(rootLocation[0] - location[0] + pad, rootLocation[1] - location[1] + pad);
      sampling = true;
      root.draw(sample);
      sampling = false;
      backdrop.getPixels(pixels, 0, w, 0, 0, w, h);
      int boxRadius = Math.max(1, Math.round(blur / SCALE * 0.58f));
      for (int pass = 0; pass < 3; pass++) {
        blurPass(pixels, scratch, w, h, boxRadius, true);
        blurPass(scratch, pixels, w, h, boxRadius, false);
      }
      backdrop.setPixels(pixels, 0, w, 0, 0, w, h);
      lastCapture = now;
      skipCapture = true;
      invalidate();
    } catch (RuntimeException | OutOfMemoryError error) {
      // 不支持软件采样的设备保留可读的实色材质，不影响触控或播放。
      releaseBackdrop();
      glassEnabled = false;
      Log.w("QGlassView", "Backdrop sampling unavailable; using solid material", error);
    } finally {
      sampling = false;
    }
    return true;
  }

  private static void blurPass(int[] input, int[] output, int w, int h, int r, boolean horizontal) {
    int length = horizontal ? w : h;
    int lines = horizontal ? h : w;
    int stride = horizontal ? 1 : w;
    int count = r * 2 + 1;
    for (int line = 0; line < lines; line++) {
      int start = horizontal ? line * w : line;
      int a = 0, red = 0, green = 0, blue = 0;
      for (int k = -r; k <= r; k++) {
        int c = input[start + Math.max(0, Math.min(length - 1, k)) * stride];
        a += c >>> 24; red += (c >> 16) & 255; green += (c >> 8) & 255; blue += c & 255;
      }
      for (int x = 0; x < length; x++) {
        output[start + x * stride] = Color.argb(a / count, red / count, green / count, blue / count);
        int remove = input[start + Math.max(0, x - r) * stride];
        int add = input[start + Math.min(length - 1, x + r + 1) * stride];
        a += (add >>> 24) - (remove >>> 24);
        red += ((add >> 16) & 255) - ((remove >> 16) & 255);
        green += ((add >> 8) & 255) - ((remove >> 8) & 255);
        blue += (add & 255) - (remove & 255);
      }
    }
  }

  @Override public void draw(Canvas canvas) {
    if (sampling) return;
    int save = canvas.save();
    canvas.clipPath(clip);
    paint.setShader(null);
    paint.setStyle(Paint.Style.FILL);
    paint.setColor(Color.WHITE);
    if (glassEnabled && backdrop != null) {
      float pad = (float) Math.ceil(blur * 2);
      canvas.drawBitmap(backdrop, null, new RectF(-pad, -pad, getWidth() + pad, getHeight() + pad), paint);
      drawLens(canvas, bounds, radius, 7 * getResources().getDisplayMetrics().density);
    }
    paint.setColor(dark ? Color.argb(glassEnabled && backdrop != null ? 126 : 255, 26, 31, 34) : Color.argb(glassEnabled && backdrop != null ? 66 : 255, 250, 252, 251));
    canvas.drawRect(bounds, paint);
    if (glassEnabled) {
      paint.setShader(new LinearGradient(0, 0, getWidth() * 0.75f, getHeight(), new int[] {
        Color.argb(dark ? 18 : 58, 255, 255, 255), Color.TRANSPARENT, Color.argb(dark ? 12 : 32, 142, 193, 189),
      }, new float[] {0, 0.52f, 1}, Shader.TileMode.CLAMP));
      canvas.drawRect(bounds, paint);
      if (touchLight > 0.01f) {
        paint.setShader(new RadialGradient(touchX, touchY, Math.max(getHeight() * 1.6f, 1), new int[] {Color.argb((int) (touchLight * (dark ? 22 : 85)), 255, 255, 255), Color.TRANSPARENT}, null, Shader.TileMode.CLAMP));
        canvas.drawRect(bounds, paint);
      }
      paint.setShader(new LinearGradient(0, 0, getWidth() * 0.6f, getHeight(), new int[] {
        Color.argb(dark ? 140 : 245, 255, 255, 255), Color.argb(dark ? 42 : 95, 142, 167, 163), Color.argb(dark ? 85 : 205, 255, 255, 255),
      }, null, Shader.TileMode.CLAMP));
      paint.setStyle(Paint.Style.STROKE);
      paint.setStrokeWidth(getResources().getDisplayMetrics().density * 0.85f);
      RectF rim = new RectF(bounds);
      rim.inset(paint.getStrokeWidth() / 2, paint.getStrokeWidth() / 2);
      canvas.drawRoundRect(rim, radius, radius, paint);
    }
    paint.setShader(null);
    paint.setStyle(Paint.Style.FILL);
    drawSelection(canvas);
    super.draw(canvas);
    canvas.restoreToCount(save);
  }

  // 复用同一张背景位图，以圆角矩形的法线弯曲网格；不另建位图或额外采样。
  private void drawLens(Canvas canvas, RectF rect, float corner, float depth) {
    if (backdrop == null || !glassEnabled) return;
    float pad = (float) Math.ceil(blur * 2);
    float halfW = rect.width() / 2, halfH = rect.height() / 2;
    float edge = Math.min(corner, 12 * getResources().getDisplayMetrics().density);
    int offset = 0;
    for (int row = 0; row <= 16; row++) {
      float y = -pad + (getHeight() + pad * 2) * row / 16;
      for (int col = 0; col <= 40; col++) {
        float x = -pad + (getWidth() + pad * 2) * col / 40;
        float px = x - rect.centerX(), py = y - rect.centerY();
        float qx = Math.abs(px) - halfW + corner, qy = Math.abs(py) - halfH + corner;
        float ox = Math.max(qx, 0), oy = Math.max(qy, 0);
        float length = (float) Math.hypot(ox, oy);
        float distance = length + Math.min(Math.max(qx, qy), 0) - corner;
        float nx = length > 0.001f ? ox / length : (qx > qy ? 1 : 0);
        float ny = length > 0.001f ? oy / length : (qx > qy ? 0 : 1);
        float t = Math.max(0, Math.min(1, -distance / Math.max(edge, 1)));
        float bend = distance <= 0 ? depth * (float) Math.sin(t * Math.PI) : 0;
        lensMesh[offset++] = x - Math.signum(px) * nx * bend;
        lensMesh[offset++] = y - Math.signum(py) * ny * bend;
      }
    }
    paint.setShader(null);
    paint.setColor(Color.WHITE);
    canvas.drawBitmapMesh(backdrop, 40, 16, lensMesh, 0, null, 0, paint);
  }

  private void drawSelection(Canvas canvas) {
    if (!selectionEnabled || selectionView == null || selectionView.getWidth() == 0) return;
    float density = getResources().getDisplayMetrics().density;
    float w = selectionView.getWidth(), h = selectionView.getHeight();
    float sx = selectionView.getScaleX(), sy = selectionView.getScaleY();
    float x = selectionView.getX() + w * (1 - sx) / 2;
    float y = selectionView.getY() + h * (1 - sy) / 2;
    selectionBounds.set(x, y, x + w * sx, y + h * sy);
    float corner = selectionBounds.height() / 2;
    selectionClip.reset();
    selectionClip.addRoundRect(selectionBounds, corner, corner, Path.Direction.CW);
    int save = canvas.save();
    canvas.clipPath(selectionClip);
    drawLens(canvas, selectionBounds, corner, 9 * density);
    paint.setShader(null);
    paint.setColor(dark ? Color.argb(92, 116, 140, 135) : Color.argb(105, 239, 255, 247));
    canvas.drawRect(selectionBounds, paint);
    paint.setShader(new LinearGradient(x, y, x + w, y + h,
      new int[] { Color.argb(dark ? 42 : 138, 255, 255, 255), Color.TRANSPARENT, Color.argb(dark ? 12 : 42, 255, 255, 255) },
      new float[] {0, 0.55f, 1}, Shader.TileMode.CLAMP));
    canvas.drawRect(selectionBounds, paint);
    paint.setShader(new LinearGradient(x, y, x + w * 0.65f, y + h,
      new int[] { Color.argb(dark ? 150 : 245, 255, 255, 255), Color.argb(35, 109, 146, 137), Color.argb(dark ? 78 : 185, 255, 255, 255) },
      null, Shader.TileMode.CLAMP));
    paint.setStyle(Paint.Style.STROKE);
    paint.setStrokeWidth(density);
    selectionBounds.inset(density / 2, density / 2);
    canvas.drawRoundRect(selectionBounds, corner, corner, paint);
    paint.setShader(null);
    paint.setStyle(Paint.Style.FILL);
    canvas.restoreToCount(save);
  }

  @Override public boolean dispatchTouchEvent(MotionEvent event) {
    if (glassEnabled && motionEnabled) {
      touchX = event.getX();
      touchY = event.getY();
      if (touchAnimator != null) touchAnimator.cancel();
      if (event.getActionMasked() == MotionEvent.ACTION_UP || event.getActionMasked() == MotionEvent.ACTION_CANCEL) {
        touchAnimator = ValueAnimator.ofFloat(touchLight, 0);
        touchAnimator.setDuration(260);
        touchAnimator.addUpdateListener(value -> { touchLight = (float) value.getAnimatedValue(); invalidate(); });
        touchAnimator.start();
      } else {
        touchLight = 1;
      }
      invalidate();
    }
    return super.dispatchTouchEvent(event);
  }
}
