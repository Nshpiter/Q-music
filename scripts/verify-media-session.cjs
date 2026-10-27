const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

test('原生媒体会话：暂停预加载显示播放键，暂停进度不外推，实际播放保留速率', () => {
  require('./patch-android-dependencies.cjs')
  const file = path.join(__dirname, '../node_modules/react-native-track-player/android/src/main/java/com/guichaguri/trackplayer/service/metadata/MetadataManager.java')
  const source = fs.readFileSync(file, 'utf8')
  const method = source.slice(source.indexOf('    private void updatePlaybackState('), source.indexOf('    public void setActive('))
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'qmusic-media-state-'))
  const probe = path.join(directory, 'MetadataStateProbe.java')
  fs.writeFileSync(probe, `class MetadataStateProbe {
    long actions = 3;
    Session session = new Session();
    static class PlaybackStateCompat {
      static final int STATE_NONE=0, STATE_STOPPED=1, STATE_PAUSED=2, STATE_PLAYING=3, STATE_BUFFERING=6, STATE_CONNECTING=8;
      static final long ACTION_PLAY=1, ACTION_PAUSE=2, ACTION_PLAY_PAUSE=4;
      static class Builder {
        int state; float speed; long actions;
        void setActions(long value) { actions=value; }
        void setState(int value, long position, float rate) { state=value; speed=rate; }
        void setBufferedPosition(long position) {}
        Builder build() { return this; }
      }
    }
    static class ExoPlayback {
      int state;
      ExoPlayback(int value) {state=value;}
      int getState(){return state;} long getPosition(){return 23000;} float getRate(){return 1.5f;} long getBufferedPosition(){return 24000;}
    }
    static class Session { PlaybackStateCompat.Builder result; void setPlaybackState(PlaybackStateCompat.Builder value){result=value;} }
    ${method}
    public static void main(String[] args) {
      MetadataStateProbe probe = new MetadataStateProbe();
      for(int state : new int[]{0,1,2,3,6,8}) {
        probe.updatePlaybackState(new ExoPlayback(state));
        PlaybackStateCompat.Builder result = probe.session.result;
        if(result.state != (state==8?2:state)) throw new AssertionError("Incorrect session state: "+state);
        if(result.speed != (state==3?1.5f:0f)) throw new AssertionError("Incorrect position extrapolation: "+state);
        if(result.actions != 7) throw new AssertionError("Missing transport capabilities");
      }
      System.out.println("PASS: six native playback states");
    }
  }`)
  const java = process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin', process.platform == 'win32' ? 'java.exe' : 'java') : 'java'
  const result = spawnSync(java, [probe], { encoding: 'utf8', timeout: 30000 })
  assert.equal(result.status, 0, result.stderr || result.error?.message)
  assert.match(result.stdout, /PASS/)
})
