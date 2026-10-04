<template>
  <div :class="$style.container">
    <div v-show="!props.listInfo.noItemLabel" ref="dom_list_ref" :class="$style.listContent" class="scroll">
      <ul :class="$style.grid">
        <li
          v-for="(item, index) in props.listInfo.list" :key="item.id" :class="$style.item" :style="{ '--q-stagger': Math.min(Number(index), 14) }"
          role="button" tabindex="0" :aria-label="item.name"
          @click="toDetail(item)" @keydown.enter="toDetail(item)" @keydown.space.prevent="toDetail(item)"
        >
          <div :class="$style.image">
            <img :class="$style.img" loading="lazy" decoding="async" :src="item.img" alt="" @load="handleImgLoad">
            <span :class="$style.playHint" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M9.1 6.7c0-.86.94-1.39 1.68-.95l8.08 4.82a1.65 1.65 0 0 1 0 2.86l-8.08 4.82c-.74.44-1.68-.09-1.68-.95z" /></svg>
            </span>
          </div>
          <div :class="$style.desc">
            <h4>{{ item.name }}</h4>
            <div>
              <p :class="$style.author">{{ item.author }}</p>
              <p v-if="item.time" :class="$style.time">{{ item.time }}</p>
              <div :class="$style.songlist_info">
                <span v-if="item.total != null"><svg-icon name="music" />{{ item.total }}</span>
                <span v-if="item.play_count != null"><svg-icon name="headphones" />{{ item.play_count }}</span>
                <span v-if="visibleSource">{{ item.source }}</span>
              </div>
            </div>
          </div>
        </li>
      </ul>
      <div :class="$style.pagination">
        <material-pagination :count="props.listInfo.total" :limit="props.listInfo.limit" :page="props.listInfo.page" @btn-click="togglePage" />
      </div>
    </div>
    <transition enter-active-class="animated fadeIn" leave-active-class="animated fadeOut">
      <div v-if="isLoading" :class="[$style.listContent, $style.skeleton]" :aria-label="props.listInfo.noItemLabel" aria-busy="true">
        <ul :class="$style.grid">
          <li v-for="index in 12" :key="index" :class="$style.skeletonItem">
            <i :class="$style.skeletonCover" />
            <div :class="$style.desc">
              <b /><b /><b />
            </div>
          </li>
        </ul>
      </div>
      <div v-else-if="props.listInfo.noItemLabel" :class="$style.noitem">
        <p v-text="props.listInfo.noItemLabel" />
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from '@common/utils/vueTools'
import type { ListInfo, ListInfoItem } from '@renderer/store/songList/state'
import { useRoute, useRouter } from '@common/utils/vueRouter'


const props = withDefaults(defineProps<{
  listInfo: ListInfo
  visibleSource?: boolean
}>(), {
  visibleSource: false,
})

const router = useRouter()
const route = useRoute()

const dom_list_ref = ref<HTMLElement | null>(null)

const emit = defineEmits(['toggle-page'])

const isLoading = computed(() => props.listInfo.noItemLabel == window.i18n.t('list__loading'))

const handleImgLoad = (event: Event) => {
  (event.target as HTMLElement).classList.add('q-cover-loaded')
}


const togglePage = (page: number) => {
  emit('toggle-page', page)
}

const toDetail = (info: ListInfoItem) => {
  void router.push({
    path: '/songList/detail',
    query: {
      source: info.source,
      id: info.id,
      picUrl: info.img,
      fromName: route.name as string,
    },
  })
}

defineExpose({
  scrollTo(top: number) {
    dom_list_ref.value?.scrollTo({
      top,
      // behavior: 'smooth',
    })
  },
  getScrollTop() {
    return dom_list_ref.value?.scrollTop ?? 0
  },
})


</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';
.container {
  overflow: hidden;
  height: 100%;
  display: flex;
  flex-flow: column nowrap;
  position: relative;
}

.listContent {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-flow: column nowrap;
  font-size: 14px;
  box-sizing: border-box;
  padding: 12px 12px 0;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 6px 10px;
}
.item {
  min-width: 0;
  display: flex;
  align-items: center;
  padding: 8px;
  box-sizing: border-box;
  border-radius: 16px;
  cursor: pointer;
  outline: none;
  transition: background-color @transition-fast, box-shadow @transition-fast, transform @transition-fast;
  // 换页时卡片依次浮现，延迟上限由模板中的 --q-stagger 控制
  animation: q-songlist-in .44s cubic-bezier(.22, 1, .36, 1) backwards;
  animation-delay: calc(var(--q-stagger, 0) * 22ms);

  &:hover, &:focus-visible {
    background-color: rgba(255, 255, 255, .46);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .6), 0 10px 26px rgba(35, 54, 46, .08);
    transform: translateY(-2px);

    .img { transform: scale(1.06); }
    .playHint { opacity: 1; transform: translateY(0) scale(1); }
    h4 { color: var(--color-primary-dark-100); }
  }
  &:focus-visible {
    box-shadow: inset 0 0 0 2px var(--color-primary-alpha-600), 0 10px 26px rgba(35, 54, 46, .08);
  }
  &:active {
    transform: scale(.985);
  }
}
@keyframes q-songlist-in {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
.image {
  position: relative;
  flex: none;
  width: clamp(84px, 38%, 124px);
  aspect-ratio: 1 / 1;
  overflow: hidden;
  border-radius: 12px;
  background: var(--color-primary-alpha-900);
  box-shadow: 0 8px 20px rgba(35, 54, 46, .14), inset 0 0 0 1px rgba(255, 255, 255, .4);
}
.img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transition: opacity .38s ease, transform .5s cubic-bezier(.22, 1, .36, 1);

  &:global(.q-cover-loaded) { opacity: 1; }
}
.playHint {
  position: absolute;
  right: 7px;
  bottom: 7px;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #fff;
  background: var(--color-primary);
  box-shadow: 0 6px 14px rgba(0, 0, 0, .22);
  opacity: 0;
  transform: translateY(6px) scale(.9);
  transition: opacity @transition-fast, transform @transition-fast;
  pointer-events: none;

  svg {
    width: 15px;
    height: 15px;
    margin-left: 2px;
    fill: currentColor;
  }
}

.desc {
  flex: auto;
  min-width: 0;
  padding: 2px 6px 2px 12px;
  overflow: hidden;
  h4 {
    font-size: 14px;
    font-weight: 620;
    line-height: 1.35;
    color: var(--color-font);
    transition: color @transition-fast;
    .mixin-ellipsis-2();
  }
}
.songlist_info {
  display: flex;
  flex-flow: row nowrap;
  gap: 12px;
  margin-top: 8px;
  font-size: 12px;
  .mixin-ellipsis-1();
  line-height: 1.2;
  color: var(--color-font-label);
  font-variant-numeric: tabular-nums;
  svg {
    margin-right: 3px;
    vertical-align: -.1em;
  }
}
.author {
  margin-top: 6px;
  font-size: 12px;
  .mixin-ellipsis-1();
  line-height: 1.3;
  color: var(--color-font-label);
}
.time {
  margin-top: 3px;
  font-size: 12px;
  .mixin-ellipsis-1();
  line-height: 1.3;
  color: var(--color-font-label);
}
.pagination {
  text-align: center;
  padding: 15px 0;
}

.skeletonBlock() {
  display: block;
  background: linear-gradient(100deg, rgba(255, 255, 255, .28) 20%, rgba(255, 255, 255, .68) 45%, rgba(255, 255, 255, .28) 70%);
  background-size: 220% 100%;
  animation: q-songlist-skeleton 1.4s ease-in-out infinite;
}
.skeleton {
  overflow: hidden;
  pointer-events: none;
}
.skeletonItem {
  display: flex;
  align-items: center;
  padding: 8px;

  b {
    .skeletonBlock();
    height: 11px;
    border-radius: 6px;
    width: 82%;
    & + b { width: 56%; height: 9px; margin-top: 10px; opacity: .8; }
    & + b + b { width: 38%; opacity: .6; }
  }
}
.skeletonCover {
  .skeletonBlock();
  flex: none;
  width: clamp(84px, 38%, 124px);
  aspect-ratio: 1 / 1;
  border-radius: 12px;
}
@keyframes q-songlist-skeleton {
  from { background-position: 100% 0; }
  to { background-position: -100% 0; }
}

.noitem {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: 100%;
  display: flex;
  flex-flow: column nowrap;
  justify-content: center;
  align-items: center;

  p {
    font-size: 16px;
    color: var(--color-font-label);
  }
}

</style>


