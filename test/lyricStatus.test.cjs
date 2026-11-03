const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript')
const root=path.join(__dirname,'..')
const file=fs.existsSync(path.join(root,'src/utils/lyricStatus.ts'))?'src/utils/lyricStatus.ts':'src/common/utils/lyricStatus.ts'
const context={exports:{}}
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,context)
const {isInstrumental}=context.exports

test('明确纯音乐歌词标记兼容简繁体、平台长文案、制作信息和逐字时间戳',()=>{
 for(const lyric of [
 '[00:00.00]此歌曲为没有填词的纯音乐，请您欣赏',
 '[00:00.00]此歌曲為沒有填詞的純音樂，請您欣賞',
 '[ar:歌手]\n[00:00.00]作曲：作者\n[00:01.00]纯音乐，请欣赏',
 '[00:00.00]<0,100>纯音乐，请欣赏',
 '[00:00.00]Instrumental',
 '[00:00.00] 制作人 : July\n[00:01.00] 作曲 : July\n[00:02.00] 编曲 : July\n[00:05.00]纯音乐，请欣赏',
 ]) assert.equal(isInstrumental({lyric}),true,lyric)
})

test('明确版本标签覆盖空歌词占位；实际歌词和未知空响应不会伪装成纯音乐',()=>{
 for(const title of ['Piano (Instrumental)','【纯音乐】夜曲','Night - Instrumental','【Playlist】纯音乐｜治愈时刻']) assert.equal(isInstrumental({title,lyric:'暂无歌词'}),true,title)
 for(const lyric of ['', '暂无歌词', '加载失败', '[00:00]纯音乐，请欣赏\n[00:02]I miss you']) assert.equal(isInstrumental({title:'普通歌曲',lyric}),false)
 assert.equal(isInstrumental({title:'Night (Instrumental)',lyric:'[00:01]A real verse'}),false)
})
