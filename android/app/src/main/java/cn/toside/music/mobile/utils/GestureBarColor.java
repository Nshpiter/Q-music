package cn.toside.music.mobile.utils;

import android.app.Activity;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.Rect;
import android.os.Build;
import android.view.PixelCopy;
import android.view.View;
import android.view.Window;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

final class GestureBarColor {
  private GestureBarColor() {}

  static void refresh(Activity activity) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q || activity.isDestroyed()) return;
    Window window = activity.getWindow();
    View decor = window.getDecorView();
    WindowInsetsCompat insets = ViewCompat.getRootWindowInsets(decor);
    if (insets == null || !decor.hasWindowFocus() || insets.isVisible(WindowInsetsCompat.Type.ime())) return;
    int bottom = insets.getInsets(WindowInsetsCompat.Type.navigationBars()).bottom;
    if (bottom == 0 || insets.getInsets(WindowInsetsCompat.Type.tappableElement()).bottom != 0) return;
    int y = decor.getHeight() - bottom;
    int width = decor.getWidth();
    if (width < 16 || y < 3) return;

    // 只在页面或背景变化后取底边的一小行，保留系统手势区和键盘原有布局。
    Rect edge = new Rect(width / 4, y - 3, width - width / 4, y - 1);
    Bitmap pixels = Bitmap.createBitmap(16, 1, Bitmap.Config.ARGB_8888);
    try {
      PixelCopy.request(window, edge, pixels, result -> {
        try {
          if (result != PixelCopy.SUCCESS || activity.isDestroyed() || !decor.hasWindowFocus()) return;
          int red = 0, green = 0, blue = 0;
          for (int x = 0; x < pixels.getWidth(); x++) {
            int pixel = pixels.getPixel(x, 0);
            red += Color.red(pixel);
            green += Color.green(pixel);
            blue += Color.blue(pixel);
          }
          int color = Color.rgb(red / 16, green / 16, blue / 16);
          window.setNavigationBarColor(color);
          new WindowInsetsControllerCompat(window, decor).setAppearanceLightNavigationBars(Color.luminance(color) > 0.18f);
        } finally {
          pixels.recycle();
        }
      }, decor.getHandler());
    } catch (IllegalArgumentException ignored) {
      // 窗口刚被销毁或尚未提交第一帧，下一次页面出现时重新取色。
      pixels.recycle();
    }
  }
}
