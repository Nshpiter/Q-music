package cn.toside.music.mobile.utils;

import android.animation.ValueAnimator;
import android.animation.Animator;
import android.animation.AnimatorListenerAdapter;
import android.os.SystemClock;
import android.view.MotionEvent;
import android.view.VelocityTracker;
import android.view.View;
import android.view.ViewConfiguration;
import android.view.ViewGroup;
import android.widget.EditText;
import android.widget.ScrollView;
import android.widget.SeekBar;
import android.view.animation.LinearInterpolator;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.annotations.ReactProp;
import com.facebook.react.uimanager.events.NativeGestureUtil;
import com.facebook.react.views.view.ReactViewGroup;
import com.facebook.react.views.view.ReactViewManager;

/** 设置列表的边缘弹性由 UI 线程处理，列表中段仍由系统 ScrollView 滚动。 */
public class ElasticScrollBoundaryManager extends ReactViewManager {
    @Override public String getName() { return "QElasticScrollBoundary"; }
    @Override public ReactViewGroup createViewInstance(ThemedReactContext context) { return new Boundary(context); }
    @ReactProp(name = "enabled", defaultBoolean = true)
    public void setEnabled(ReactViewGroup view, boolean enabled) { ((Boundary) view).setElasticEnabled(enabled); }

    private static class Boundary extends ReactViewGroup {
        private final float density;
        private final int slop;
        private boolean enabled = true, pulling, ignore, consuming, moved;
        private float startX, startY, lastY, distance;
        private int edgeDirection;
        private ScrollView scroll;
        private ValueAnimator spring;
        private VelocityTracker velocity;
        private long flingDeadline, lastScrollTime;
        private int lastScrollY;
        private float flingVelocity;
        private final Runnable watchFling = new Runnable() {
            @Override public void run() {
                if (!enabled || scroll == null || !isShown() || SystemClock.uptimeMillis() > flingDeadline) return;
                long now = SystemClock.uptimeMillis();
                int y = scroll.getScrollY();
                int delta = y - lastScrollY;
                // 只追踪真实松手产生的惯性，程序恢复滚动位置不会触发回弹。
                if (delta != 0 && Math.signum(delta) == Math.signum(flingVelocity)) return;
                if (!scroll.canScrollVertically(flingVelocity > 0 ? -1 : 1)) {
                    // 最后一步被边界截短，不能拿这一小段距离把撞边速度错误地降为零。
                    animateBack(ElasticScrollPhysics.impactVelocity(flingVelocity, density));
                    return;
                }
                if (delta != 0) {
                    flingVelocity = flingVelocity * 0.35f - delta * 650f / Math.max(1, now - lastScrollTime);
                    lastScrollY = y;
                    lastScrollTime = now;
                }
                if (now - lastScrollTime < 160) {
                    postOnAnimation(this);
                }
            }
        };

        Boundary(ThemedReactContext context) {
            super(context);
            density = getResources().getDisplayMetrics().density;
            slop = ViewConfiguration.get(context).getScaledTouchSlop();
        }
        void setElasticEnabled(boolean value) {
            enabled = value;
            MotionTrace.log("elastic view=" + getId() + " enabled=" + value);
            if (!value) reset();
        }
        private ScrollView findScroll(View view) {
            if (view instanceof ScrollView) return (ScrollView) view;
            if (view instanceof ViewGroup) {
                ViewGroup group = (ViewGroup) view;
                for (int i = 0; i < group.getChildCount(); i++) {
                    ScrollView found = findScroll(group.getChildAt(i));
                    if (found != null) return found;
                }
            }
            return null;
        }
        private boolean isEditingControl(View view, float rawX, float rawY) {
            int[] location = new int[2];
            view.getLocationOnScreen(location);
            if (rawX < location[0] || rawX > location[0] + view.getWidth() || rawY < location[1] || rawY > location[1] + view.getHeight()) return false;
            if (view instanceof SeekBar || view instanceof EditText) return true;
            if (view instanceof ViewGroup) {
                ViewGroup group = (ViewGroup) view;
                for (int i = 0; i < group.getChildCount(); i++) if (isEditingControl(group.getChildAt(i), rawX, rawY)) return true;
            }
            return false;
        }
        @Override public boolean dispatchTouchEvent(MotionEvent event) {
            if (event.getActionMasked() == MotionEvent.ACTION_DOWN) MotionTrace.log("elastic down view=" + getId() + " enabled=" + enabled + " scroll=" + (findScroll(this) != null));
            if (!enabled) return super.dispatchTouchEvent(event);
            int action = event.getActionMasked();
            if (action == MotionEvent.ACTION_DOWN) {
                removeCallbacks(watchFling);
                stopSpring();
                scroll = findScroll(this);
                recycleVelocity();
                velocity = VelocityTracker.obtain();
                velocity.addMovement(event);
                pulling = consuming = moved = false;
                // 再次按住时从当前位移接手，不能 reset 到零造成跳动。
                distance = scroll == null ? 0 : ElasticScrollPhysics.distance(scroll.getTranslationY(), limit());
                startX = event.getX(); startY = lastY = event.getY();
                // 系统侧滑区域、滑块和输入框不参与垂直边缘手势。
                ignore = scroll == null || startX < 24 * density || startX > getWidth() - 24 * density || isEditingControl(this, event.getRawX(), event.getRawY());
                if (ignore && scroll != null && Math.abs(scroll.getTranslationY()) > 0.5f) animateBack(0);
            } else if (action == MotionEvent.ACTION_POINTER_DOWN) {
                ignore = true;
                if (pulling) { endGesture(event); animateBack(0); }
            } else if (action == MotionEvent.ACTION_MOVE && !ignore && scroll != null) {
                if (velocity != null) velocity.addMovement(event);
                float dy = event.getY() - lastY;
                lastY = event.getY();
                float dx = event.getX() - startX;
                if (!pulling && Math.abs(dx) > slop && Math.abs(dx) > Math.abs(event.getY() - startY)) ignore = true;
                boolean vertical = Math.abs(event.getY() - startY) > slop && Math.abs(event.getY() - startY) > Math.abs(dx) * 1.3f;
                if (!ignore && vertical) moved = true;
                if (!ignore && !pulling && vertical && (Math.abs(distance) > 0.5f || !scroll.canScrollVertically(dy > 0 ? -1 : 1))) {
                    pulling = true;
                    MotionTrace.log("elastic pull started");
                    consuming = true;
                    edgeDirection = distance != 0 ? (distance > 0 ? 1 : -1) : (dy > 0 ? 1 : -1);
                    NativeGestureUtil.notifyNativeGestureStarted(this, event);
                    // 取消原条目的长按/点击；松手只归位，不误触开关。
                    MotionEvent cancel = MotionEvent.obtain(event);
                    cancel.setAction(MotionEvent.ACTION_CANCEL);
                    super.dispatchTouchEvent(cancel);
                    cancel.recycle();
                }
                if (pulling) {
                    if (distance == 0) {
                        if (scroll.canScrollVertically(dy > 0 ? -1 : 1)) {
                            scroll.scrollBy(0, Math.round(-dy));
                            return true;
                        }
                        edgeDirection = dy > 0 ? 1 : -1;
                    }
                    float next = distance + dy;
                    if (next * edgeDirection < 0) {
                        // 拉回边界后继续往里滑，同一根手指可以接着滚动，不把整次手势吃掉。
                        distance = 0;
                        scroll.setTranslationY(0);
                        scroll.scrollBy(0, Math.round(-next));
                    } else {
                        distance = edgeDirection * Math.min(getHeight(), Math.abs(next));
                        scroll.setTranslationY(ElasticScrollPhysics.offset(distance, limit()));
                    }
                    return true;
                }
            } else if (action == MotionEvent.ACTION_UP || action == MotionEvent.ACTION_CANCEL) {
                float speed = 0;
                if (velocity != null) {
                    velocity.addMovement(event);
                    velocity.computeCurrentVelocity(1000);
                    speed = velocity.getYVelocity();
                }
                recycleVelocity();
                if (consuming) {
                    endGesture(event);
                    if (scroll != null && action == MotionEvent.ACTION_UP && Math.abs(scroll.getTranslationY()) < 0.5f && !ignore) {
                        scroll.fling(Math.round(-speed));
                        trackFling(speed);
                    } else animateBack(action == MotionEvent.ACTION_UP && !ignore ? ElasticScrollPhysics.impactVelocity(speed, density) : 0);
                    consuming = false;
                    return true;
                }
                if (scroll != null && Math.abs(scroll.getTranslationY()) > 0.5f) animateBack(0);
                if (action == MotionEvent.ACTION_UP && moved && !ignore) trackFling(speed);
            }
            if (consuming) return true;
            return super.dispatchTouchEvent(event);
        }
        private float limit() { return Math.min(88 * density, Math.max(1, getHeight()) * 0.18f); }
        private void trackFling(float speed) {
            if (scroll == null || Math.abs(speed) < ViewConfiguration.get(getContext()).getScaledMinimumFlingVelocity()) return;
            flingVelocity = speed;
            lastScrollY = scroll.getScrollY();
            lastScrollTime = SystemClock.uptimeMillis();
            flingDeadline = lastScrollTime + 3000;
            removeCallbacks(watchFling);
            postOnAnimation(watchFling);
        }
        private void endGesture(MotionEvent event) {
            if (pulling) NativeGestureUtil.notifyNativeGestureEnded(this, event);
            pulling = false;
        }
        private void animateBack(float initialVelocity) {
            if (scroll == null) return;
            stopSpring();
            final ScrollView target = scroll;
            float from = target.getTranslationY();
            if (Math.abs(from) < 0.5f && Math.abs(initialVelocity) < 1) { target.setTranslationY(0); return; }
            spring = ValueAnimator.ofFloat(0, 0.6f);
            spring.setDuration(600);
            spring.setInterpolator(new LinearInterpolator());
            spring.addUpdateListener(animation -> target.setTranslationY(ElasticScrollPhysics.settle(from, initialVelocity, (float) animation.getAnimatedValue())));
            spring.addListener(new AnimatorListenerAdapter() {
                private boolean cancelled;
                @Override public void onAnimationCancel(Animator animation) { cancelled = true; }
                @Override public void onAnimationEnd(Animator animation) { if (!cancelled) target.setTranslationY(0); }
            });
            spring.start();
        }
        private void stopSpring() { if (spring != null) { spring.cancel(); spring = null; } }
        private void recycleVelocity() { if (velocity != null) { velocity.recycle(); velocity = null; } }
        private void reset() {
            removeCallbacks(watchFling);
            stopSpring();
            recycleVelocity();
            if (scroll != null) scroll.setTranslationY(0);
            pulling = consuming = false; distance = 0;
        }
        @Override protected void onWindowVisibilityChanged(int visibility) {
            super.onWindowVisibilityChanged(visibility);
            if (visibility != View.VISIBLE) reset();
        }
        @Override protected void onDetachedFromWindow() { reset(); super.onDetachedFromWindow(); }
    }
}
