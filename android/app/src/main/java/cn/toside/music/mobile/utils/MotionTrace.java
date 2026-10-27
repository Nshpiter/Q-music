package cn.toside.music.mobile.utils;

import android.util.Log;
import cn.toside.music.mobile.BuildConfig;

/** 只在独立预览包记录手势链路，不记录账号、歌曲或输入内容。 */
public final class MotionTrace {
    private MotionTrace() {}
    public static void log(String message) {
        if (BuildConfig.APPLICATION_ID.endsWith(".preview")) Log.i("QMusicMotion", message);
    }
}
