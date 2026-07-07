<template>
  <div :class="$style.main">
    <div class="scroll" :class="$style.toc">
      <ul :class="$style.tocList" role="toolbar">
        <li v-for="h2 in tocList" :key="h2.id" :class="$style.tocListItem" role="presentation">
          <h2
            :class="[$style.tocH2, {[$style.active]: avtiveComponentName == h2.id }]"
            role="tab" :aria-selected="avtiveComponentName == h2.id"
            :aria-label="h2.title" ignore-tip @click="toggleTab(h2.id)"
          >
            <span :class="$style.tocIcon">
              <svg-icon :name="h2.icon" />
            </span>
            <span :class="$style.tocTitle">{{ h2.title }}</span>
          </h2>
          <!-- <ul v-if="h2.children.length" :class="$style.tocList">
            <li v-for="h3 in h2.children" :key="h3.id" :class="$style.tocSubListItem">
              <h3 :class="[$style.tocH3, toc.activeId == h3.id ? $style.active : null]" :aria-label="h3.title">
                <a :href="'#' + h3.id" @click.stop="toc.activeId = h3.id">{{ h3.title }}</a>
              </h3>
            </li>
          </ul> -->
        </li>
      </ul>
    </div>
    <div ref="dom_content_ref" class="scroll" :class="$style.setting">
      <dl>
        <component :is="avtiveComponentName" />
        <!-- <SettingBasic />
        <SettingPlay />
        <SettingPlayDetail />
        <SettingDesktopLyric />
        <SettingSearch />
        <SettingList />
        <SettingDownload />
        <SettingSync />
        <SettingHotKey />
        <SettingNetwork />
        <SettingOdc />
        <SettingBackup />
        <SettingOther />
        <SettingUpdate />
        <SettingAbout /> -->
      </dl>
    </div>
  </div>
</template>

<script>
import { ref, computed, nextTick } from '@common/utils/vueTools'
// import { currentStting } from './setting'
import { useI18n } from '@renderer/plugins/i18n'
import { useRoute } from '@common/utils/vueRouter'

import SettingBasic from './components/SettingBasic.vue'
import SettingPlay from './components/SettingPlay.vue'
import SettingPlayDetail from './components/SettingPlayDetail.vue'
import SettingDesktopLyric from './components/SettingDesktopLyric.vue'
import SettingSearch from './components/SettingSearch.vue'
import SettingList from './components/SettingList.vue'
import SettingDownload from './components/SettingDownload.vue'
import SettingSync from './components/SettingSync/index.vue'
import SettingOpenAPI from './components/SettingOpenAPI.vue'
import SettingHotKey from './components/SettingHotKey.vue'
import SettingNetwork from './components/SettingNetwork.vue'
import SettingOdc from './components/SettingOdc.vue'
import SettingBackup from './components/SettingBackup.vue'
import SettingOther from './components/SettingOther.vue'
import SettingAbout from './components/SettingAbout.vue'
import { logRendererState } from '@renderer/utils/debugLog'

export default {
  name: 'Setting',
  components: {
    SettingBasic,
    SettingPlay,
    SettingPlayDetail,
    SettingDesktopLyric,
    SettingSearch,
    SettingList,
    SettingDownload,
    SettingSync,
    SettingOpenAPI,
    SettingHotKey,
    SettingNetwork,
    SettingOdc,
    SettingBackup,
    SettingOther,
    SettingAbout,
  },
  setup() {
    const t = useI18n()
    const route = useRoute()

    const dom_content_ref = ref(null)

    const tocList = computed(() => {
      return [
        { id: 'SettingBasic', title: t('setting__basic'), icon: 'setting' },
        { id: 'SettingPlay', title: t('setting__play'), icon: 'play-outline' },
        { id: 'SettingPlayDetail', title: t('setting__play_detail'), icon: 'music' },
        { id: 'SettingDesktopLyric', title: t('setting__desktop_lyric'), icon: 'text' },
        { id: 'SettingSearch', title: t('setting__search'), icon: 'search-2' },
        { id: 'SettingList', title: t('setting__list'), icon: 'love' },
        { id: 'SettingDownload', title: t('setting__download'), icon: 'download-2' },
        { id: 'SettingHotKey', title: t('setting__hot_key'), icon: 'tune-variant' },
        { id: 'SettingSync', title: t('setting__sync'), icon: 'share' },
        { id: 'SettingOpenAPI', title: t('setting__open_api'), icon: 'information-slab-circle-outline' },
        { id: 'SettingNetwork', title: t('setting__network'), icon: 'audio-wave' },
        { id: 'SettingOdc', title: t('setting__odc'), icon: 'headphones' },
        { id: 'SettingBackup', title: t('setting__backup'), icon: 'sdCard' },
        { id: 'SettingOther', title: t('setting__other'), icon: 'tune-variant' },
        { id: 'SettingAbout', title: t('setting__about'), icon: 'information-slab-circle-outline' },
      ]
    })

    const avtiveComponentName = ref(route.query.name && tocList.value.some(t => t.id == route.query.name)
      ? route.query.name
      : tocList.value[0].id)

    const toggleTab = id => {
      avtiveComponentName.value = id
      logRendererState('setting:toggleTab', { id })
      void nextTick(() => {
        dom_content_ref.value?.scrollTo({
          top: 0,
          behavior: 'smooth',
        })
      })
    }

    return {
      tocList,
      avtiveComponentName,
      dom_content_ref,
      toggleTab,
    }
  },
  // mounted() {
  //   this.initTOC()
  // },
  // methods: {
  //   initTOC() {
  //     const list = this.$refs.dom_setting_list.children
  //     const toc = []
  //     let prevTitle
  //     for (const item of list) {
  //       if (item.tagName == 'DT') {
  //         prevTitle = {
  //           title: item.innerText.replace(/[（(].+?[)）]/, ''),
  //           id: item.getAttribute('id'),
  //           dom: item,
  //           children: [],
  //         }
  //         toc.push(prevTitle)
  //         continue
  //       }
  //       const h3 = item.querySelector('h3')
  //       if (h3) {
  //         prevTitle.children.push({
  //           title: h3.innerText.replace(/[（(].+?[)）]/, ''),
  //           id: h3.getAttribute('id'),
  //           dom: h3,
  //         })
  //       }
  //     }
  //     console.log(toc)
  //     this.toc.list = toc
  //   },
  //   handleListScroll(event) {
  //     // console.log(event.target.scrollTop)
  //   },
  // },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.main {
  display: flex;
  flex-flow: row nowrap;
  height: 100%;
  gap: 16px;
  padding: 16px 18px 0;
  box-sizing: border-box;
  border-top: var(--color-list-header-border-bottom);
  background:
    linear-gradient(135deg, rgba(255, 255, 255, .34), rgba(255, 255, 248, .74)),
    radial-gradient(circle at 18% 18%, var(--color-primary-alpha-900), transparent 34%);
}

.toc {
  flex: 0 0 214px;
  overflow-y: scroll;
  padding: 6px 4px calc(@height-player + 18px);
  box-sizing: border-box;
}
.tocList {
  display: flex;
  flex-flow: column nowrap;
  gap: 7px;
}
.tocH2 {
  min-width: 0;
  height: 42px;
  line-height: 1;
  .mixin-ellipsis-1();
  font-size: 13px;
  font-weight: 650;
  letter-spacing: 0;
  color: var(--color-font);
  padding: 0 12px 0 8px;
  border-radius: 16px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 10px;
  transition: @transition-fast;
  transition-property: background-color, color, box-shadow, transform;

  &:not(.active) {
    cursor: pointer;
    &:hover {
      background-color: rgba(255, 255, 255, .44);
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .58);
    }
  }
  &.active {
    color: var(--color-primary-dark-300);
    background-color: rgba(255, 255, 255, .68);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .82), 0 14px 30px rgba(72, 91, 112, .08);

    .tocIcon {
      color: #fff;
      background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark-300));
      box-shadow: 0 10px 22px var(--color-primary-alpha-800);
    }
  }
}
.tocIcon {
  width: 30px;
  height: 30px;
  flex: none;
  border-radius: 12px;
  color: var(--color-primary);
  background-color: rgba(255, 255, 255, .46);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: @transition-fast;
  transition-property: color, background-color, box-shadow;

  :global(.svg-icon) {
    width: 16px;
    height: 16px;
    vertical-align: 0;
  }
}
.tocTitle {
  min-width: 0;
  .mixin-ellipsis-1();
}
// .tocH3 {
//   font-size: 13px;
//   opacity: .8;
// }

// .tocList {
//   .tocList {
//     // padding-left: 15px;
//   }
// }
// .tocSubListItem {
//   padding-top: 10px;
// }

.setting {
  padding: 0 6px calc(@height-player + 24px) 0;
  font-size: 14px;
  box-sizing: border-box;
  overflow-y: auto;
  height: 100%;
  position: relative;
  width: 100%;

  :global {
    dl {
      max-width: 980px;
      margin: 0 auto;
      padding-bottom: 18px;
    }

    dt {
      border-left: none;
      padding: 13px 16px;
      margin: 0 0 12px;
      border-radius: 20px;
      color: var(--color-font);
      font-size: 17px;
      font-weight: 750;
      letter-spacing: 0;
      background: rgba(255, 255, 255, .64);
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .78), 0 18px 42px rgba(75, 92, 109, .08);

      + dd h3 {
        margin-top: 0;
      }
    }

    dd {
      margin: 0 0 10px;
      padding: 13px 16px;
      border-radius: 18px;
      color: var(--color-font);
      background: rgba(255, 255, 255, .48);
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .62), 0 12px 32px rgba(78, 94, 112, .06);
      backdrop-filter: blur(12px);

      > div {
        padding: 0;
      }

    }
    h3 {
      font-size: 12px;
      line-height: 1.4;
      margin: 0 0 12px;
      color: var(--color-font-label);
      font-weight: 700;
      letter-spacing: 0;
    }
    .p {
      padding: 4px 0;
      line-height: 1.55;
      .btn {
        + .btn {
          margin-left: 10px;
        }
      }
    }

    .help-btn {
      width: 28px;
      height: 28px;
      padding: 0;
      margin: 0 0.4em;
      border: none;
      border-radius: 10px;
      background: rgba(255, 255, 255, .46);
      color: var(--color-button-font);
      cursor: pointer;
      transition: @transition-fast;
      transition-property: background-color, color, transform;
      &:hover {
        color: var(--color-primary-dark-300);
        background: rgba(255, 255, 255, .68);
        transform: translateY(-1px);
      }
    }
    .help-icon {
      margin: 0 0.4em;
    }
  }
}

// .btn-content {
//   display: inline-block;
//   transition: @transition-theme;
//   transition-property: opacity, transform;
//   opacity: 1;
//   transform: scale(1);

//   &.hide {
//     opacity: 0;
//     transform: scale(0);
//   }
// }


// :global(dt):target, :global(h3):target {
//   animation: highlight 1s ease;
// }

// @keyframes highlight {
//   from { background: yellow; }
//   to { background: transparent; }
// }

</style>

