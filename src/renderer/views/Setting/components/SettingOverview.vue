<template>
  <div :class="$style.overview">
    <header :class="$style.hero">
      <div :class="$style.heroTitle">
        <h2>{{ $t('setting__overview') }}</h2>
        <p>{{ $t('setting_quick_jump') }}</p>
      </div>
      <div :class="$style.statusGrid">
        <button type="button" :class="$style.statusCard" @click="jump('SettingBasic', 'basic_theme')">
          <span :class="$style.statusLabel">{{ $t('setting_status_layout') }}</span>
          <strong>{{ layoutLabel }}</strong>
        </button>
        <button type="button" :class="$style.statusCard" @click="jump('SettingBasic', 'basic_source')">
          <span :class="$style.statusLabel">{{ $t('setting_status_source') }}</span>
          <strong>{{ sourceLabel }}</strong>
        </button>
        <button type="button" :class="$style.statusCard" @click="jump('SettingPlay', 'basic_play_quality')">
          <span :class="$style.statusLabel">{{ $t('setting_status_quality') }}</span>
          <strong>{{ qualityLabel }}</strong>
        </button>
        <button type="button" :class="$style.statusCard" @click="jump('SettingOpenAPI')">
          <span :class="$style.statusLabel">{{ $t('setting_status_plugins') }}</span>
          <strong>{{ integrationSummary }}</strong>
        </button>
      </div>
    </header>

    <section v-for="group in groupedTabs" :key="group.key" :class="$style.group">
      <h3 :class="$style.groupTitle">{{ $t(group.key) }}</h3>
      <div :class="$style.card">
        <div v-for="(item, index) in group.items" :key="item.id" :class="[$style.rowWrap, { [$style.rowBorder]: index > 0 }]">
          <button type="button" :class="$style.row" @click="jump(item.id)">
            <span :class="$style.iconBadge">
              <svg-icon :name="item.icon" />
            </span>
            <span :class="$style.rowBody">
              <strong>{{ $t(item.titleKey) }}</strong>
              <small>{{ $t(item.summaryKey) }}</small>
            </span>
            <span :class="$style.chevron" aria-hidden="true">›</span>
          </button>
          <div v-if="item.quickAnchors?.length" :class="$style.anchors">
            <button
              v-for="anchor in item.quickAnchors" :key="anchor.section"
              type="button" :class="$style.anchorChip"
              @click="jump(item.id, anchor.section)"
            >
              {{ $t(anchor.labelKey) }}
            </button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from '@common/utils/vueTools'
import { useRouter } from '@common/utils/vueRouter'
import { appSetting } from '@renderer/store/setting'
import { useI18n } from '@renderer/plugins/i18n'
import { useApiSources } from './apiSources'
import { SETTING_GROUPS, SETTING_TABS } from '../settingCatalog'

const emit = defineEmits<{
  jump: [name: string, section?: string]
}>()

const t = useI18n()
const router = useRouter()

const groupedTabs = computed(() => {
  return SETTING_GROUPS.map(key => ({
    key,
    items: SETTING_TABS.filter(tab => tab.group === key),
  }))
})

const layoutLabel = computed(() => appSetting['theme.desktopLayout'] || 'Q-music')

const apiSources = useApiSources(t)

const sourceLabel = computed(() => {
  const id = appSetting['common.apiSource']
  const current = apiSources.value.find(item => item.id === id)
  const name = current?.name ?? ''
  return name || id || '—'
})

const qualityLabel = computed(() => String(appSetting['player.playQuality'] || '320k').toUpperCase())

const integrationSummary = computed(() => {
  const enabled = [
    appSetting['openAPI.enable'] && 'OpenAPI',
    appSetting['integrations.steam'] && 'Steam',
    appSetting['integrations.discord'] && 'Discord',
    appSetting['integrations.amll'] && 'AMLL',
    appSetting['integrations.liveRequests'] && 'Live',
  ].filter(Boolean)
  return enabled.length ? enabled.slice(0, 2).join(' · ') + (enabled.length > 2 ? ` +${enabled.length - 2}` : '') : t('setting__open_api')
})

const jump = (name: string, section?: string) => {
  emit('jump', name, section)
  void router.replace({ path: '/setting', query: section ? { name, section } : { name } })
}
</script>

<style lang="less" module>
.overview {
  max-width: 980px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding-bottom: 24px;
}

.hero {
  border-radius: 22px;
  padding: 18px 20px;
  background: var(--q-surface);
  box-shadow: inset 0 0 0 1px var(--q-border), 0 18px 42px rgba(75, 92, 109, .08);
  backdrop-filter: blur(16px);
}

.heroTitle {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;

  h2 {
    margin: 0;
    font-size: 19px;
    font-weight: 750;
    color: var(--color-font);
  }

  p {
    margin: 0;
    font-size: 12px;
    color: var(--color-font-label);
  }
}

.statusGrid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.statusCard {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 5px;
  padding: 12px 14px;
  border: none;
  border-radius: 15px;
  background: var(--q-surface-soft);
  box-shadow: inset 0 0 0 1px var(--q-outline);
  color: var(--color-font);
  text-align: left;
  cursor: pointer;
  transition: transform .18s cubic-bezier(.22, 1, .36, 1), background-color .18s ease, box-shadow .18s ease;

  strong {
    width: 100%;
    font-size: 13.5px;
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &:hover {
    transform: translateY(-1px);
    background: var(--q-surface-strong);
    box-shadow: inset 0 0 0 1px var(--color-primary-alpha-600), 0 8px 20px rgba(72, 91, 112, .08);
  }

  &:active {
    transform: scale(.985);
  }
}

.statusLabel {
  font-size: 11px;
  color: var(--color-font-label);
}

.group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.groupTitle {
  margin: 0;
  padding: 0 6px;
  font-size: 12px;
  font-weight: 700;
  color: var(--color-font-label);
  letter-spacing: .02em;
}

.card {
  border-radius: 20px;
  background: var(--q-surface);
  box-shadow: inset 0 0 0 1px var(--q-border), 0 12px 32px rgba(78, 94, 112, .06);
  backdrop-filter: blur(12px);
  overflow: hidden;
}

.rowWrap {
  padding: 6px;
}

.rowBorder {
  border-top: 1px solid rgb(from var(--color-font) r g b / .06);
}

.row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: none;
  border-radius: 14px;
  background: transparent;
  color: var(--color-font);
  text-align: left;
  cursor: pointer;
  transition: background-color .16s ease, transform .16s cubic-bezier(.22, 1, .36, 1);

  &:hover {
    background: var(--q-surface-soft);
    .iconBadge {
      color: var(--color-primary);
      background: var(--color-primary-alpha-900);
    }
    .chevron {
      opacity: .9;
      transform: translateX(2px);
      color: var(--color-primary);
    }
  }

  &:active {
    transform: scale(.992);
  }
}

.iconBadge {
  flex: none;
  width: 34px;
  height: 34px;
  border-radius: 11px;
  display: grid;
  place-items: center;
  color: var(--color-font-label);
  background: var(--q-surface-soft);
  box-shadow: inset 0 0 0 1px var(--q-outline);
  transition: color .16s ease, background-color .16s ease;

  :global(.svg-icon) {
    width: 17px;
    height: 17px;
  }
}

.rowBody {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;

  strong {
    font-size: 13.5px;
    font-weight: 650;
    color: var(--color-font);
  }

  small {
    font-size: 11.5px;
    line-height: 1.45;
    color: var(--color-font-label);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.chevron {
  font-size: 19px;
  line-height: 1;
  color: var(--color-font-label);
  opacity: .55;
  transition: transform .18s ease, opacity .18s ease, color .18s ease;
}

.anchors {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 2px 12px 8px 58px;
}

.anchorChip {
  border: 1px solid var(--q-outline);
  border-radius: 999px;
  padding: 4px 10px;
  background: var(--q-surface-soft);
  color: var(--color-font);
  font-size: 11.5px;
  cursor: pointer;
  transition: background-color .16s ease, border-color .16s ease, color .16s ease;

  &:hover {
    color: var(--color-primary);
    border-color: var(--color-primary-alpha-600);
    background: var(--color-primary-alpha-900);
  }
}

@media (max-width: 920px) {
  .statusGrid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (prefers-reduced-motion: reduce) {
  .statusCard, .row, .iconBadge, .chevron, .anchorChip { transition: none; }
}
</style>
