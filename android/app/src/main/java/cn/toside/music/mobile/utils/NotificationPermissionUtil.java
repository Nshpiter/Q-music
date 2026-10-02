package cn.toside.music.mobile.utils;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;

import androidx.core.app.NotificationManagerCompat;


public class NotificationPermissionUtil {

  /** 检查通知权限是否开启 */
  public static boolean isNotificationsEnabled(Context context) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      // Android 8.0 及以上
      NotificationManager manager =
        (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
      if (manager == null) return false;

      if (!manager.areNotificationsEnabled()) {
        return false;
      }

      // 只检查播放器的通知通道，无关通道关闭不影响播放通知。
      NotificationChannel channel = manager.getNotificationChannel("com.guichaguri.trackplayer");
      if (channel != null && channel.getImportance() == NotificationManager.IMPORTANCE_NONE) return false;

      return true;
    } else {
      // Android 5.1 - 7.1
      return NotificationManagerCompat.from(context).areNotificationsEnabled();
    }
  }

  /** 安全地打开通知设置页 */
  public static boolean openNotificationPermissionActivity(Context context) {
    String packageName = context.getPackageName();
    Intent intent = new Intent();

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      // Android 8.0 及以上
      intent.setAction(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
      intent.putExtra("android.provider.extra.APP_PACKAGE", packageName);
    } else {
      // Android 5.1 - 7.1
      intent.setAction("android.settings.APP_NOTIFICATION_SETTINGS");
      intent.putExtra("app_package", packageName);
      intent.putExtra("app_uid", context.getApplicationInfo().uid);
    }

    // 加上 NEW_TASK 标志，确保从非 Activity Context 启动不会崩溃
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

    try {
      context.startActivity(intent);
      return true;
    } catch (Exception e) {
      Log.e("NotificationUtil", "Failed to start notification settings", e);
      return openAppSettings(context);
    }
  }

  static boolean openAppSettings(Context context) {
    try {
      context.startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
          Uri.parse("package:" + context.getPackageName())).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
      return true;
    } catch (Exception e) {
      Log.w("NotificationUtil", "Unable to open app settings", e);
      return false;
    }
  }
}
