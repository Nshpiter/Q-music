const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), { spawnSync } = require('node:child_process')
test('真实边缘容器：多轮、反向、取消、多指和中途禁用均完整分发给 ScrollView', () => {
 const native = path.join(__dirname, '../android/app/src/main/java/cn/toside/music/mobile/utils')
 const source = name => fs.readFileSync(path.join(native, name), 'utf8').replace(/^package .*;\s*/m, '').replace(/^import .*;\s*/gm, '').replace('public class ElasticScrollBoundaryManager', 'class ElasticScrollBoundaryManager')
 const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'qmusic-elastic-'))
 const file = path.join(directory, 'ElasticDispatchProbe.java')
 fs.writeFileSync(file, `import java.util.*;
class ElasticDispatchProbe {
 static void check(boolean value,String message){if(!value)throw new AssertionError(message);}
 static void send(ReactViewGroup view,int action,float y){view.dispatchTouchEvent(new MotionEvent(action,200,y));}
 public static void main(String[] args){
  ElasticScrollBoundaryManager manager=new ElasticScrollBoundaryManager();
  ReactViewGroup view=manager.createViewInstance(new ThemedReactContext());
  ScrollView scroll=new ScrollView(); view.children.add(scroll);
  for(int round=0;round<30;round++){
   scroll.y=0; scroll.events.clear();
   send(view,0,100);send(view,2,170);send(view,2,200);
   check(scroll.getTranslationY()>0,"top drag must have visual feedback");
   send(view,2,20);send(view,1,20);
   check(scroll.events.equals(Arrays.asList(0,2,2,2,1)),"ScrollView must receive full original sequence without injected CANCEL");
   check(scroll.y>0,"reverse gesture must resume native scrolling");
   check(NativeGestureUtil.starts==NativeGestureUtil.ends,"native gesture bridge must balance on release");
  }
  send(view,0,100);send(view,2,150);send(view,3,150);
  check(NativeGestureUtil.starts==NativeGestureUtil.ends,"cancel balances bridge");
  scroll.y=0;send(view,0,100);send(view,2,180);send(view,5,180);send(view,2,160);send(view,1,160);
  check(NativeGestureUtil.starts==NativeGestureUtil.ends,"multi-touch balances bridge");
  scroll.y=0;send(view,0,100);send(view,2,180);manager.setEnabled(view,false);send(view,2,120);send(view,1,120);
  check(NativeGestureUtil.starts==NativeGestureUtil.ends,"disabling mid-gesture ends bridge");
  manager.setEnabled(view,true);scroll.y=0;send(view,0,100);send(view,2,180);view.onWindowVisibilityChanged(4);
  check(NativeGestureUtil.starts==NativeGestureUtil.ends && scroll.getTranslationY()==0,"hidden view resets both native bridge and translation");
  scroll.y=500;send(view,0,300);send(view,2,200);send(view,1,200);
  check(scroll.y==600,"next scroll works after interruption");
  System.out.println("PASS: original dispatch and lifecycle recovery");
 }
}
@interface ReactProp {String name();boolean defaultBoolean();}
class ThemedReactContext{}
class Resources{DisplayMetrics getDisplayMetrics(){return new DisplayMetrics();}}
class DisplayMetrics{float density=1;}
class View{
 static final int VISIBLE=0;float translation;List<Integer> events=new ArrayList<>();
 Resources getResources(){return new Resources();}int getWidth(){return 400;}int getHeight(){return 800;}int getId(){return 1;}
 void getLocationOnScreen(int[] p){p[0]=p[1]=0;}float getTranslationY(){return translation;}void setTranslationY(float v){translation=v;}
 boolean isShown(){return true;}void removeCallbacks(Runnable r){}void postOnAnimation(Runnable r){}Object getContext(){return null;}
 protected void onWindowVisibilityChanged(int visibility){}protected void onDetachedFromWindow(){}
 boolean dispatchTouchEvent(MotionEvent e){events.add(e.action);return true;}
}
class ViewGroup extends View{List<View> children=new ArrayList<>();int getChildCount(){return children.size();}View getChildAt(int i){return children.get(i);}}
class ReactViewGroup extends ViewGroup{ReactViewGroup(ThemedReactContext c){}@Override boolean dispatchTouchEvent(MotionEvent e){for(View v:children)v.dispatchTouchEvent(e);return true;}}
class ReactViewManager{String getName(){return "";}ReactViewGroup createViewInstance(ThemedReactContext c){return null;}}
class ScrollView extends ViewGroup{
 int y;float last;boolean touching;
 boolean canScrollVertically(int d){return d<0?y>0:y<1000;}int getScrollY(){return y;}
 @Override boolean dispatchTouchEvent(MotionEvent e){
  super.dispatchTouchEvent(e);
  if(e.action==0){touching=true;last=e.y;}
  if(e.action==2 && touching){y=Math.max(0,Math.min(1000,y+Math.round(last-e.y)));last=e.y;}
  if(e.action==1||e.action==3)touching=false;
  return true;
 }
}
class EditText extends View{}class SeekBar extends View{}
class ViewConfiguration{static ViewConfiguration get(Object c){return new ViewConfiguration();}int getScaledTouchSlop(){return 8;}int getScaledMinimumFlingVelocity(){return 50;}}
class MotionEvent{
 static final int ACTION_DOWN=0,ACTION_UP=1,ACTION_MOVE=2,ACTION_CANCEL=3,ACTION_POINTER_DOWN=5;
 int action;float x,y;MotionEvent(int a,float x,float y){action=a;this.x=x;this.y=y;}
 int getActionMasked(){return action;}float getX(){return x;}float getY(){return y;}float getRawX(){return x;}float getRawY(){return y;}
 static MotionEvent obtain(long a,long b,int c,float x,float y,int d){return new MotionEvent(c,x,y);}void recycle(){}
}
class VelocityTracker{static VelocityTracker obtain(){return new VelocityTracker();}void addMovement(MotionEvent e){}void computeCurrentVelocity(int n){}float getYVelocity(){return 0;}void recycle(){}}
class NativeGestureUtil{static int starts,ends;static void notifyNativeGestureStarted(View v,MotionEvent e){starts++;}static void notifyNativeGestureEnded(View v,MotionEvent e){ends++;}}
class SystemClock{static long uptimeMillis(){return System.currentTimeMillis();}}
class MotionTrace{static void log(String s){}}
class Animator{}
class AnimatorListenerAdapter{public void onAnimationCancel(Animator a){}public void onAnimationEnd(Animator a){}}
class LinearInterpolator{}
class ValueAnimator extends Animator{
 interface Update{void run(ValueAnimator a);}
 static ValueAnimator ofFloat(float a,float b){return new ValueAnimator();}
 void setDuration(int n){}void setInterpolator(LinearInterpolator v){}void addUpdateListener(Update u){}void addListener(AnimatorListenerAdapter l){}
 void start(){}void cancel(){}Object getAnimatedValue(){return .6f;}
}
${source('ElasticScrollBoundaryManager.java')}
${source('ElasticScrollPhysics.java')}
`)
 const java = process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin/java.exe') : 'java'
 const result = spawnSync(java, [file], { encoding: 'utf8', timeout: 30000 })
 assert.equal(result.status, 0, result.stderr || result.error?.message)
 assert.match(result.stdout, /PASS/)
})
