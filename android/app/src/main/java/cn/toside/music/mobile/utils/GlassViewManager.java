package cn.toside.music.mobile.utils;

import com.facebook.react.uimanager.PixelUtil;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.annotations.ReactProp;
import com.facebook.react.views.view.ReactViewGroup;
import com.facebook.react.views.view.ReactViewManager;

public class GlassViewManager extends ReactViewManager {
  @Override public String getName() { return "QGlassView"; }
  @Override public ReactViewGroup createViewInstance(ThemedReactContext context) { return new GlassView(context); }
  @ReactProp(name = "glassSelection")
  public void setGlassSelection(ReactViewGroup view, boolean value) { ((GlassView) view).setSelection(value); }
  @ReactProp(name = "glassEnabled", defaultBoolean = true)
  public void setGlassEnabled(ReactViewGroup view, boolean value) { ((GlassView) view).setGlassEnabled(value); }
  @ReactProp(name = "glassDark")
  public void setGlassDark(ReactViewGroup view, boolean value) { ((GlassView) view).setDark(value); }
  @ReactProp(name = "glassMotion", defaultBoolean = true)
  public void setGlassMotion(ReactViewGroup view, boolean value) { ((GlassView) view).setMotionEnabled(value); }
  @ReactProp(name = "glassRadius", defaultFloat = 24)
  public void setGlassRadius(ReactViewGroup view, float value) { ((GlassView) view).setCorner(PixelUtil.toPixelFromDIP(value)); }
  @ReactProp(name = "glassBlur", defaultFloat = 18)
  public void setGlassBlur(ReactViewGroup view, float value) { ((GlassView) view).setBlur(PixelUtil.toPixelFromDIP(value)); }
}
