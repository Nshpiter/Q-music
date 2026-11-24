<template lang="pug">
dt#basic {{ $t('setting__basic') }}
dd
  div
    .gap-top
      base-checkbox(id="setting_show_animate" :model-value="appSetting['common.isShowAnimation']" :label="$t('setting__basic_show_animation')" @update:model-value="updateSetting({'common.isShowAnimation': $event})")
    .gap-top
      base-checkbox(id="setting_animate" :disabled="!appSetting['common.isShowAnimation']" :model-value="appSetting['common.randomAnimate']" :label="$t('setting__basic_animation')" @update:model-value="updateSetting({'common.randomAnimate': $event})")
    .gap-top
      base-checkbox(id="setting_performance_mode" :model-value="appSetting['common.performanceMode']" :label="$t('setting__basic_performance_mode')" @update:model-value="updateSetting({'common.performanceMode': $event})")
      div(:class="$style.performanceTip") {{ $t('setting__basic_performance_mode_tip') }}
    .gap-top
      base-checkbox(id="setting_start_in_fullscreen" :model-value="appSetting['common.startInFullscreen']" :label="$t('setting__basic_start_in_fullscreen')" @update:model-value="updateSetting({'common.startInFullscreen': $event})")
    .gap-top(:class="$style.closeAction")
      div(:class="$style.closeActionTitle") {{ $t('setting__basic_close_action') }}
      div(:class="$style.closeActionOptions")
        base-checkbox(
          id="setting_close_action_exit" name="setting_close_action" need
          :model-value="closeAction" value="exit" :label="$t('setting__basic_close_action_exit')"
          @update:model-value="updateCloseAction")
        base-checkbox(
          id="setting_close_action_tray" name="setting_close_action" need
          :model-value="closeAction" value="tray" :label="$t('setting__basic_close_action_tray')"
          @update:model-value="updateCloseAction")
      div(:class="$style.closeActionTip") {{ $t('setting__basic_close_action_tip') }}
    .gap-top
      base-checkbox(id="setting_hide_scrollbars" :model-value="appSetting['common.hideScrollbars']" :label="$t('hide_scrollbars')" @update:model-value="updateSetting({'common.hideScrollbars': $event})")
    .p.gap-top
      base-btn.btn(min @click="isShowPlayTimeoutModal = true") {{ $t('setting__play_timeout')}} {{ timeLabel ? ` (${timeLabel})` : '' }}

dd
  h3#basic_theme {{ $t('theme_appearance') }}
  theme-appearance(:model-value="appearance" @change="setAppearance")
  label.p.gap-top(for="desktop_layout") {{ $t('desktop_layout') }}
    select#desktop_layout.gap-left(:value="appSetting['theme.desktopLayout']" @change="updateSetting({ 'theme.desktopLayout': $event.target.value })")
      option(value="") Q-music
      option(v-for="name in ['Ark', 'ReLive', 'Elaina', 'MoTheme', 'Microrange', 'Transmission', 'Unbounded']" :key="name" :value="name") {{ name }}
  layout-options(v-if="appSetting['theme.desktopLayout']" :key="appSetting['theme.desktopLayout']" :layout="appSetting['theme.desktopLayout']")
  .gap-top
    base-checkbox(id="cover_palette" :model-value="appSetting['theme.coverPalette']" :label="$t('cover_palette')" @update:model-value="updateSetting({ 'theme.coverPalette': $event })")
  div(:class="$style.paletteSection")
    div(:class="$style.paletteHeading")
      span {{ $t('setting__basic_theme') }}
      button(type="button" :class="$style.paletteToggle" :aria-expanded="showAllTheme" @click="showAllTheme = !showAllTheme") {{ $t(showAllTheme ? 'theme_palette_collapse' : 'theme_more_btn_show') }}
    ul(:class="$style.theme")
      li(v-for="theme in themeList" :key="theme.id" :aria-label="theme.name" :style="theme.styles" :class="[$style.themeItem, {[$style.active]: selectedThemeId == theme.id}]" role="button" tabindex="0" :aria-pressed="selectedThemeId == theme.id" @click="toggleTheme(theme)" @keydown.enter="toggleTheme(theme)" @keydown.space.prevent="toggleTheme(theme)" @contextmenu.prevent="handleEditTheme(theme)")
        div(:class="$style.bg")
        span(:class="$style.label") {{ theme.name }}
      li(v-if="showAllTheme" :aria-label="$t('theme_add')" :class="[$style.themeItem, $style.add]" role="button" tabindex="0" @click="handleEditTheme()" @keydown.enter="handleEditTheme()" @keydown.space.prevent="handleEditTheme()")
        div(:class="$style.bg")
          div(:class="$style.bgContent")
            svg-icon(:class="$style.icon" name="plus")
        span(:class="$style.label") {{ $t('theme_add') }}


dd
  h3#basic_glass {{ $t('setting__basic_glass') }}
  div
    .gap-top(:class="$style.glassRow")
      div(:class="$style.glassBg")
        img(v-if="customBgPreview" loading="lazy" :class="$style.glassBgImg" :src="customBgPreview" alt="")
        base-btn.btn(min @click="selectBgImage") {{ $t('setting__basic_glass_bg_select') }}
        base-btn.btn(v-if="appSetting['theme.customBgImage']" min @click="clearBgImage") {{ $t('setting__basic_glass_bg_clear') }}
      div(:class="$style.glassTip") {{ $t('setting__basic_glass_bg_tip') }}
    template(v-if="appSetting['theme.customBgImage']")
      .gap-top
        base-checkbox(id="setting_bg_motion" :model-value="appSetting['theme.backgroundMotion']" :label="$t('background_motion')" @update:model-value="updateSetting({'theme.backgroundMotion': $event})")
      .gap-top
        base-checkbox(id="setting_bg_dim" :model-value="appSetting['theme.dimActiveBackground']" :label="$t('background_dim_active')" @update:model-value="updateSetting({'theme.dimActiveBackground': $event})")
      template(v-if="appSetting['theme.dimActiveBackground']")
        label.gap-top {{ $t('background_active_opacity') }} · {{ appSetting['theme.backgroundActiveOpacity'] }}%
          input(type="range" min="0" max="100" step="5" :value="appSetting['theme.backgroundActiveOpacity']" @input="updateSetting({ 'theme.backgroundActiveOpacity': Number($event.target.value) })")
        label.gap-top {{ $t('background_idle_time') }} · {{ appSetting['theme.backgroundIdleSeconds'] }} s
          input(type="range" min="0.25" max="10" step="0.25" :value="appSetting['theme.backgroundIdleSeconds']" @input="updateSetting({ 'theme.backgroundIdleSeconds': Number($event.target.value) })")
    .gap-top(:class="$style.glassPresets")
      span(:class="$style.glassLabel") {{ $t('setting__basic_glass_preset') }}
      button(
        v-for="preset in glassPresets" :key="preset.id" type="button"
        :class="[$style.glassPreset, { [$style.active]: preset.active }]"
        @click="applyGlassPreset(preset)"
      ) {{ preset.label }}
    .gap-top(:class="$style.glassSlider")
      span(:class="$style.glassLabel") {{ $t('setting__basic_glass_opacity') }}
      slider-bar(:class="$style.slider" :value="appSetting['theme.glassOpacity'] ?? 22" :min="8" :max="70" :step="1" @change="updateSetting({'theme.glassOpacity': $event})")
      span(:class="$style.glassValue") {{ appSetting['theme.glassOpacity'] ?? 22 }}%
    .gap-top(:class="$style.glassSlider")
      span(:class="$style.glassLabel") {{ $t('setting__basic_glass_blur') }}
      slider-bar(:class="$style.slider" :value="appSetting['theme.glassBlur'] ?? 20" :min="0" :max="40" :step="1" @change="updateSetting({'theme.glassBlur': $event})")
      span(:class="$style.glassValue") {{ appSetting['theme.glassBlur'] ?? 20 }}px

dd
  style-snippets#style-snippets
dd
  better-plugins

dd
  h3#basic_source {{ $t('setting__basic_source') }}
  div
    .gap-top(v-for="item in apiSources" :key="item.id")
      base-checkbox(
        :id="`setting_api_source_${item.id}`" name="setting_api_source"
        need :model-value="appSetting['common.apiSource']" :disabled="item.disabled" :value="item.id" :aria-label="item.label" @update:model-value="updateSetting({'common.apiSource': $event})")
        span(:class="$style.sourceLabel")
          | {{ item.name }}
          span(v-if="item.desc" :class="$style.desc") {{ item.desc }}
          span(v-if="item.statusLabel" :class="$style.status") {{ item.statusLabel }}
    div(:class="$style.sourcePreferenceTip") {{ $t('setting__basic_source_preference_tip') }}
    .p.gap-top
      base-btn.btn(min @click="isShowUserApiModal = true") {{ $t('setting__basic_source_user_api_btn') }}

dd
  h3#basic_window_size {{ $t('setting__basic_window_size') }}
  div
    base-checkbox.gap-left(
      v-for="item in windowSizeList" :id="`setting_window_size_${item.id}`" :key="item.id"
      name="setting_window_size" need :model-value="appSetting['common.windowSizeId']" :disabled="isFullscreen" :value="item.id" :label="$t('setting__basic_window_size_' + item.name)"
      @update:model-value="updateSetting({'common.windowSizeId': $event})")

dd
  h3#basic_interface_zoom {{ $t('interface_zoom') }}
  div
    base-checkbox.gap-left(
      v-for="zoom in [85, 100, 110, 125]" :id="`setting_zoom_${zoom}`" :key="zoom" name="setting_zoom" need
      :model-value="appSetting['common.interfaceZoom']" :value="zoom" :label="zoom + '%'"
      @update:model-value="updateSetting({'common.interfaceZoom': $event})")

dd
  h3#basic_font_size {{ $t('setting__basic_font_size') }}
  div
    //- base-selection.gap-teft(:list="fontSizeList" :model-value="appSetting['common.fontSize']" @update:model-value="updateSetting({'common.fontSize': $event})")
    base-checkbox.gap-left(
      v-for="item in fontSizeList" :id="`setting_basic_font_size_${item.id}`" :key="item.id"
      name="setting_basic_font_size" need :model-value="appSetting['common.fontSize']" :value="item.id"
      :label="item.label" :disabled="isFullscreen" @update:model-value="updateSetting({'common.fontSize': $event})")

dd
  h3#basic_font {{ $t('setting__basic_font') }}
  div(style="--selection-width: 12rem;")
    base-selection.gap-left(:list="fontList" :model-value="fonts[0]" item-key="id" item-name="label" @update:model-value="updateFonts($event, fonts[1])")
    base-selection.gap-left(v-if="fonts[0]" :list="fontList" :model-value="fonts[1]" item-key="id" item-name="label" @update:model-value="updateFonts(fonts[0], $event)")
    //- base-selection.gap-teft(:list="fontList" :model-value="appSetting['common.font']" item-key="id" item-name="label" @update:model-value="updateSetting({'common.font': $event})")

dd
  h3#basic_lang {{ $t('setting__basic_lang') }}
  div
    base-checkbox.gap-left(
      v-for="item in langList" :id="`setting_lang_${item.locale}`" :key="item.locale" name="setting_lang"
      need :model-value="appSetting['common.langId']" :value="item.locale" :label="item.name" @update:model-value="updateSetting({'common.langId': $event})")

dd
  h3#basic_control_btn_position {{ $t('setting__basic_control_btn_position') }}
  div
    base-checkbox.gap-left(
      v-for="item in controlBtnPositionList" :id="`setting_basic_control_btn_position_${item.id}`" :key="item.id"
      name="setting_basic_control_btn_position" need :model-value="appSetting['common.controlBtnPosition']" :value="item.id" :label="item.name" @update:model-value="updateSetting({'common.controlBtnPosition': $event})")
dd
  h3#basic_playbar_progress_style {{ $t('setting__basic_playbar_progress_style') }}
  div
    base-checkbox.gap-left(
      id="setting_basic_playbar_progress_style_mini" name="setting_basic_playbar_progress_style"
      need :model-value="appSetting['common.playBarProgressStyle']" value="mini" :label="$t('setting__basic_playbar_progress_style_mini')" @update:model-value="updateSetting({'common.playBarProgressStyle': $event})")
    base-checkbox.gap-left(
      id="setting_basic_playbar_progress_style_middle" name="setting_basic_playbar_progress_style"
      need :model-value="appSetting['common.playBarProgressStyle']" value="middle" :label="$t('setting__basic_playbar_progress_style_middle')" @update:model-value="updateSetting({'common.playBarProgressStyle': $event})")
    base-checkbox.gap-left(
      id="setting_basic_playbar_progress_style_full" name="setting_basic_playbar_progress_style"
      need :model-value="appSetting['common.playBarProgressStyle']" value="full" :label="$t('setting__basic_playbar_progress_style_full')" @update:model-value="updateSetting({'common.playBarProgressStyle': $event})")

ThemeEditModal(v-model="isShowThemeEditModal" :theme-id="editThemeId" @submit="handleRefreshTheme")
play-timeout-modal(v-model="isShowPlayTimeoutModal")
user-api-modal(v-model="isShowUserApiModal")
</template>

<script>
import { computed, ref, shallowReactive } from '@common/utils/vueTools'
import { windowSizeList, userApi, isFullscreen, themeId } from '@renderer/store'
import { langList, useI18n } from '@root/lang'
import { getSystemFonts, showSelectDialog } from '@renderer/utils/ipc'
import apiSourceInfo from '@renderer/utils/musicSdk/api-source-info'
import { useTimeout } from '@renderer/core/player/timeoutStop'
import { dialog } from '@renderer/plugins/Dialog'

import ThemeAppearance from './ThemeAppearance.vue'
import LayoutOptions from './LayoutOptions.vue'
import StyleSnippets from './StyleSnippets.vue'
import BetterPlugins from './BetterPlugins.vue'
import { getBaseThemeId, getThemeAppearance } from '@common/theme/appearance'
import ThemeEditModal from './ThemeEditModal/index.vue'
import PlayTimeoutModal from './PlayTimeoutModal.vue'
import UserApiModal from './UserApiModal.vue'
import SliderBar from '@renderer/components/base/SliderBar.vue'
import { appSetting, updateSetting } from '@renderer/store/setting'
import { getThemes, applyTheme, buildBgUrl } from '@renderer/store/utils'
import { isUrl, encodePath } from '@common/utils/common'

export default {
  name: 'SettingBasic',
  components: {
    ThemeAppearance,
    LayoutOptions,
    StyleSnippets,
    BetterPlugins,
    ThemeEditModal,
    PlayTimeoutModal,
    UserApiModal,
    SliderBar,
  },
  setup() {
    const t = useI18n()

    const showAllTheme = ref(false)
    const defaultThemesRaw = shallowReactive([])
    const defaultThemes = computed(() => {
      return defaultThemesRaw.map(theme => ({ ...theme, isDefault: true, name: t('theme_' + theme.id) }))
    })
    const userThemes = shallowReactive([])
    const allThemes = computed(() => {
      return [...defaultThemes.value, ...userThemes]
    })
    const selectedThemeId = computed(() => getBaseThemeId(appSetting))
    const appearance = computed(() => getThemeAppearance(appSetting, allThemes.value.find(theme => theme.id == selectedThemeId.value)?.isDark))
    const themeList = computed(() => showAllTheme.value ? allThemes.value : allThemes.value.filter(theme => theme.id == selectedThemeId.value))
    const setAppearance = mode => {
      updateSetting({ 'theme.id': selectedThemeId.value, 'theme.appearance': mode, 'theme.autoByTime': false })
      applyTheme(selectedThemeId.value, appSetting['theme.lightId'], appSetting['theme.darkId'], dataPath)
    }

    let dataPath = ''
    const init = () => {
      getThemes((info) => {
        // console.log(info)
        dataPath = info.dataPath
        defaultThemesRaw.splice(0, defaultThemesRaw.length, ...info.themes.map(t => {
          return {
            id: t.id,
            isDark: t.isDark,
            styles: {
              '--color-primary-theme': t.config.themeColors['--color-theme'],
              '--background-image-theme': t.config.extInfo['--background-image'],
            },
          }
        }))
        userThemes.splice(0, userThemes.length, ...info.userThemes.map(t => {
          return {
            id: t.id,
            isDark: t.isDark,
            name: t.name,
            styles: {
              '--color-primary-theme': t.config.themeColors['--color-theme'],
              '--background-image-theme': t.config.extInfo['--background-image'] == 'none'
                ? 'none'
                : buildBgUrl(t.config.extInfo['--background-image'], info.dataPath),
            },
          }
        }))
      })
    }
    const editThemeId = ref('')
    const handleEditTheme = (theme) => {
      // console.log(theme)
      if (theme?.isDefault) return
      if (!theme && userThemes.length >= 10) {
        void dialog({
          message: t('theme_max_tip'),
          confirmButtonText: t('alert_button_text'),
        })
        return
      }
      editThemeId.value = theme ? theme.id : ''
      isShowThemeEditModal.value = true
    }
    const handleRefreshTheme = () => {
      init()
    }
    init()
    const closeAction = computed(() => appSetting['tray.enable'] ? 'tray' : 'exit')
    const updateCloseAction = action => {
      updateSetting({ 'tray.enable': action == 'tray' })
    }
    const toggleTheme = (theme) => {
      if (selectedThemeId.value == theme.id) return
      const mode = appearance.value
      themeId.value = theme.id
      updateSetting({ 'theme.id': theme.id, 'theme.appearance': mode, 'theme.autoByTime': false })
      applyTheme(theme.id, appSetting['theme.lightId'], appSetting['theme.darkId'], dataPath)
    }

    const isShowThemeEditModal = ref(false)

    const isShowPlayTimeoutModal = ref(false)
    const { timeLabel } = useTimeout()

    // 自定义背景图预览
    const customBgPreview = computed(() => {
      const bg = appSetting['theme.customBgImage']
      if (!bg) return ''
      return isUrl(bg) ? bg : encodePath(String(bg).replaceAll('\\', '/'))
    })
    const selectBgImage = async() => {
      const result = await showSelectDialog({
        title: t('setting__basic_glass_bg_select'),
        properties: ['openFile'],
        filters: [{ name: 'Image', extensions: ['jpg', 'jpeg', 'jfif', 'png', 'apng', 'avif', 'gif', 'webp', 'bmp'] }],
      })
      if (result.canceled) return
      const path = result.filePaths[0]
      if (path) updateSetting({ 'theme.customBgImage': path })
    }
    const clearBgImage = () => {
      updateSetting({ 'theme.customBgImage': '' })
    }
    const glassPresets = computed(() => {
      const opacity = appSetting['theme.glassOpacity'] ?? 22
      const blur = appSetting['theme.glassBlur'] ?? 20
      return [
        { id: 'clear', label: t('setting__basic_glass_preset_clear'), opacity: 52, blur: 8 },
        { id: 'balanced', label: t('setting__basic_glass_preset_balanced'), opacity: 30, blur: 18 },
        { id: 'immersive', label: t('setting__basic_glass_preset_immersive'), opacity: 16, blur: 30 },
      ].map(preset => ({ ...preset, active: preset.opacity == opacity && preset.blur == blur }))
    })
    const applyGlassPreset = (preset) => {
      updateSetting({
        'theme.glassOpacity': preset.opacity,
        'theme.glassBlur': preset.blur,
      })
    }

    const isShowUserApiModal = ref(false)
    const getApiStatus = () => {
      let status
      if (userApi.status) status = t('setting__basic_source_status_success')
      else if (userApi.message == 'initing') status = t('setting__basic_source_status_initing')
      else status = `${t('setting__basic_source_status_failed')}`

      return status
    }
    const apiSources = computed(() => {
      return [
        ...apiSourceInfo.map(api => ({
          id: api.id,
          name: api.name,
          label: api.name,
          disabled: api.disabled,
        })),
        ...userApi.list.map(api => ({
          id: api.id,
          name: api.name,
          label: `${api.name}${api.id == appSetting['common.apiSource'] ? `[${getApiStatus()}]` : ''}`,
          desc: [/^\d/.test(api.version) ? `v${api.version}` : api.version].filter(Boolean).join(', '),
          statusLabel: api.id == appSetting['common.apiSource'] ? `[${getApiStatus()}]` : '',
          status: api.status,
          message: api.message,
          disabled: false,
        })),
      ]
    })

    const controlBtnPositionList = computed(() => {
      return [
        { id: 'left', name: t('setting__basic_control_btn_position_left') },
        { id: 'right', name: t('setting__basic_control_btn_position_right') },
      ]
    })

    const systemFontList = ref([])
    const fontList = computed(() => {
      return [{ id: '', label: t('setting__desktop_lyric_font_default') }, ...systemFontList.value]
    })
    void getSystemFonts().then(fonts => {
      systemFontList.value = fonts.map(f => ({ id: f, label: f.replace(/(^"|"$)/g, '') }))
    })

    const parseFontSetting = font => {
      if (!font) return []
      return font.split(',')
        .map(f => f.trim())
        .filter(Boolean)
    }
    const fonts = computed(() => {
      const [f1 = '', f2 = ''] = parseFontSetting(appSetting['common.font'])
      return [f1, f2]
    })
    const updateFonts = (font1, font2) => {
      const fonts = []
      if (font1) fonts.push(font1)
      if (font1 && font2 && font2 != font1) fonts.push(font2)
      updateSetting({ 'common.font': fonts.join(', ') })
    }
    const fontSizeList = computed(() => {
      return [
        { id: 14, label: t('setting__basic_font_size_14px') },
        { id: 15, label: t('setting__basic_font_size_15px') },
        { id: 16, label: t('setting__basic_font_size_16px') },
        { id: 17, label: t('setting__basic_font_size_17px') },
        { id: 18, label: t('setting__basic_font_size_18px') },
        { id: 19, label: t('setting__basic_font_size_19px') },
      ]
    })


    return {
      appSetting,
      updateSetting,
      userThemes,
      appearance,
      setAppearance,
      selectedThemeId,
      showAllTheme,
      themeList,
      closeAction,
      updateCloseAction,
      fonts,
      updateFonts,
      // currentStting,
      // themes,
      // themeClassName,
      isShowThemeEditModal,
      isShowPlayTimeoutModal,
      timeLabel,
      apiSources,
      isShowUserApiModal,
      windowSizeList,
      langList,
      controlBtnPositionList,
      fontList,
      isFullscreen,
      toggleTheme,
      themeId,
      handleRefreshTheme,
      editThemeId,
      handleEditTheme,
      fontSizeList,
      customBgPreview,
      selectBgImage,
      clearBgImage,
      glassPresets,
      applyGlassPreset,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';
.paletteSection { margin-top: 22px; padding-top: 18px; border-top: 1px solid var(--color-primary-alpha-900); }
.paletteHeading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; font-size: 13px; color: var(--color-font-label); }
.paletteToggle { padding: 4px 0; border: 0; background: none; color: var(--color-primary-font); font: inherit; cursor: pointer; }
.paletteToggle:focus-visible, .themeItem:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 4px; }


.performanceTip {
  max-width: 560px;
  margin: 6px 0 0 30px;
  color: var(--color-font-label);
  font-size: 12px;
  line-height: 1.55;
}

.sourcePreferenceTip {
  max-width: 560px;
  margin: 8px 0 0 30px;
  color: var(--color-font-label);
  font-size: 12px;
  line-height: 1.55;
}

.glassRow {
  display: flex;
  flex-flow: column nowrap;
  gap: 8px;
}
.glassBg {
  display: flex;
  flex-flow: row wrap;
  align-items: center;
  gap: 10px;
}
.glassBgImg {
  width: 88px;
  height: 52px;
  border-radius: 8px;
  object-fit: cover;
  box-shadow: 0 2px 8px var(--color-primary-light-100-alpha-300), inset 0 0 0 1px var(--q-border);
}
.glassTip {
  font-size: 12px;
  color: var(--color-font-label);
  line-height: 1.4;
}
.glassSlider {
  display: flex;
  flex-flow: row nowrap;
  align-items: center;
  gap: 12px;
}
.glassPresets {
  display: flex;
  flex-flow: row wrap;
  align-items: center;
  gap: 8px;
}
.glassPreset {
  min-width: 66px;
  height: 30px;
  padding: 0 12px;
  border: 1px solid rgba(54, 83, 70, .12);
  border-radius: 10px;
  color: var(--color-font-label);
  background: var(--q-surface-soft);
  box-shadow: inset 0 1px 0 var(--q-border);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: color @transition-fast, background-color @transition-fast, border-color @transition-fast, transform @transition-fast;

  &:hover {
    color: var(--color-primary-font);
    border-color: var(--color-primary-alpha-700);
    background: var(--color-primary-alpha-900);
    transform: translateY(-1px);
  }

  &.active {
    color: #fff;
    border-color: transparent;
    background: linear-gradient(145deg, var(--color-primary-light-100), var(--color-primary));
    box-shadow: 0 5px 14px var(--color-primary-alpha-700), inset 0 1px 0 var(--q-border);
  }
}
.glassLabel {
  flex: none;
  width: 5.5em;
  font-size: 13px;
  color: var(--color-font);
}
.slider {
  width: 180px;
  flex: none;
}
.glassValue {
  flex: none;
  font-size: 13px;
  color: var(--color-primary-font);
  font-variant-numeric: tabular-nums;
  min-width: 3.4em;
}

.theme {
  display: flex;
  flex-flow: row wrap;
  // padding: 0 15px;
  gap: 16px;
  margin: 0;
  padding: 4px;

  .themeItem {
    display: flex;
    flex-flow: column nowrap;
    align-items: center;
    cursor: pointer;
    margin-right: 0;
    transition: transform .28s ease, opacity .28s ease;
    margin-bottom: 0;
    width: 96px;

    &:hover {
      transform: translateY(-3px);
      .bg {
        box-shadow: 0 10px 22px rgba(24, 34, 45, .18), inset 0 0 0 1px var(--q-border);
      }
    }

    &:last-child {
      margin-right: 0;
    }

    &.active {
      color: var(--color-primary-font-active);
      .label {
        font-weight: 700;
      }
      .bg {
        border-color: var(--color-primary);
        box-shadow: 0 2px 8px rgba(24, 34, 45, .1), 0 0 0 2px var(--color-primary-alpha-800);
      }
    }

    // 迷你预览卡：主色/背景填充 + 一小片毛玻璃面板，预览「玻璃浮在主色上」
    .bg {
      position: relative;
      display: block;
      width: 100%;
      height: 58px;
      margin-bottom: 7px;
      border: 2Px solid transparent;
      padding: 2Px;
      transition: border-color .28s ease, box-shadow .28s ease;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(24, 34, 45, .1), inset 0 0 0 1px var(--q-border);
      &:after {
        display: block;
        content: ' ';
        width: 100%;
        height: 100%;
        border-radius: 9px;
        background-position: center;
        background-size: cover;
        background-repeat: no-repeat;
        background-color: var(--color-primary-theme);
        background-image: var(--background-image-theme);
      }
      &:before {
        content: '';
        position: absolute;
        z-index: 1;
        left: 9px;
        right: 9px;
        bottom: 8px;
        height: 17px;
        border-radius: 7px;
        background: var(--q-surface);
        box-shadow: inset 0 0 0 1px var(--q-border), 0 2px 6px rgba(24, 34, 45, .12);
        backdrop-filter: blur(3px);
      }
    }

    .label {
      width: 100%;
      text-align: center;
      height: 1.2em;
      font-size: 12.5px;
      .mixin-ellipsis-1();
    }

    &.add {
      >.bg {
        box-shadow: none;
        &:after {
          content: none;
        }
        &:before {
          content: none;
        }
        .bgContent {
          transition: .3s ease;
          transition-property: border, color;
          box-sizing: border-box;
          border: 1Px dashed var(--color-primary-light-100-alpha-300);
          color: var(--color-primary-light-100-alpha-300);
          position: relative;
          height: 100%;
          overflow: hidden;
          border-radius: 9px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .icon {
          // position: absolute;
          // font-size: 16px;
          width: 66%;
          height: auto;
        }
      }
      .label {
        color: var(--color-primary-dark-100-alpha-300);
      }
    }

    &.moreThme {
      flex-direction: row;
      width: auto;
      gap: 5px;
      color: var(--color-primary-font-active);
      .label {
        height: auto;
      }
    }
  }
}

.closeAction {
  line-height: 1.5;
}
.closeActionTitle {
  margin-bottom: 6px;
}
.closeActionOptions {
  display: flex;
  flex-flow: row wrap;
  align-items: center;
  gap: 10px 24px;
  padding: 4px 0;
}
.closeActionTip {
  margin-top: 5px;
  color: var(--color-500);
  font-size: 12px;
}

.sourceLabel {
  flex: auto;
  margin-left: 5px;
  line-height: 1.5;
  cursor: pointer;

  .desc {
    color: var(--color-500);
    font-size: 12px;
    margin-left: 5px;
  }

  .status {
    margin-left: 5px;
  }
}

</style>
