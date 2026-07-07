<template lang="pug">
dt#about {{ $t('setting__about') }}
dd
  .p.small
    | Q-music 是基于 LX Music 桌面版二次修改的独立版本。当前项目地址：
    span.hover.underline(:aria-label="$t('setting__click_open')" @click="openUrl('https://github.com/Nshpiter/Q-music#readme')") https://github.com/Nshpiter/Q-music
  .p.small
    | Q-music 版本下载与更新说明：
    span.hover.underline(:aria-label="$t('setting__click_open')" @click="openUrl('https://github.com/Nshpiter/Q-music/releases')") https://github.com/Nshpiter/Q-music/releases
  .p.small
    | 上游项目地址：
    span.hover.underline(:aria-label="$t('setting__click_open')" @click="openUrl('https://github.com/lyswhut/lx-music-desktop#readme')") https://github.com/lyswhut/lx-music-desktop
  .p.small
    | 当前二改版本的源码与下载地址请以 Q-music 仓库为准。
  .p.small
    | 软件的常见问题可转至：
    span.hover.underline(:aria-label="$t('setting__click_open')" @click="openUrl('https://lyswhut.github.io/lx-music-doc/desktop/faq')") 桌面版常见问题
  .p.small
    strong 本软件没有客服
    | ，但我们整理了一些常见的使用问题。
    strong 仔细、仔细、仔细
    | 地阅读常见问题后，
  .p.small
    | 仍有问题请优先在&nbsp;
    span.hover.underline(:aria-label="$t('setting__click_open')" @click="openUrl('https://github.com/Nshpiter/Q-music/issues')") Q-music Issue
    | &nbsp;反馈，不要向上游提交 Q-music 定制问题。
  br
  .p.small 由于软件开发的初衷仅是为了对新技术的学习与研究，因此软件直至停止维护都将会一直保持纯净。
  .p.small
    | 上游 LX Music 官方发布地址可在其 GitHub 仓库查看；Q-music 的发布渠道请以 Q-music 仓库说明为准。
  .p.small
    strong 本项目没有微信公众号之类的所谓「官方账号」，谨防被骗！

  .p.small
    | 你已签署本软件的
    base-btn(min @click="handleShowPact") 许可协议
    | 。上游项目协议可在
    strong.hover.underline(:aria-label="$t('setting__click_open')" @click="openUrl('https://github.com/lyswhut/lx-music-desktop#%E9%A1%B9%E7%9B%AE%E5%8D%8F%E8%AE%AE')") LX Music README
    | 查看。
  br

  .p.small
    | Based on LX Music by&nbsp;
    strong 落雪无痕
</template>

<script>
// import { ref, onBeforeUnmount } from '@common/utils/vueTools'
import { isShowPact } from '@renderer/store'
import { openUrl, clipboardWriteText } from '@common/utils/electron'

export default {
  name: 'SettingAbout',
  setup() {
    const handleShowPact = () => {
      isShowPact.value = true
    }
    return {
      openUrl,
      clipboardWriteText,
      handleShowPact,
    }
  },
}
</script>
