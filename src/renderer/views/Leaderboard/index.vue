<template>
  <div :class="$style.leaderboard">
    <div :class="$style.lists">
      <div :class="$style.listsSelect">
        <base-selection :model-value="source" :class="$style.select" :list="sourceList" item-key="id" item-name="name" @update:model-value="handleToggleSource" />
      </div>
      <BoardList ref="boardListRef" :board-id="boardId" :source="source" @show-menu="$refs.musicListRef?.hideMenu()" />
    </div>
    <div :class="$style.list">
      <MusicList ref="musicListRef" :source="source" :board-id="boardId" @show-menu="$refs.boardListRef?.hideMenu()" />
    </div>
  </div>
</template>

<script>
import { computed, ref } from '@common/utils/vueTools'
import { getLeaderboardSetting, setLeaderboardSetting } from '@renderer/utils/data'
import BoardList from './BoardList/index.vue'
import MusicList from './MusicList/index.vue'
import { sources, boards } from '@renderer/store/leaderboard/state'
import { getBoardsList, setBoard } from '@renderer/store/leaderboard/action'
import { sourceNames } from '@renderer/store'
import { useRoute, useRouter } from '@common/utils/vueRouter'


const source = ref('')
const boardId = ref(null)

const verifyQueryParams = async function(to, from, next) {
  let _source = to.query.source
  let _boardId = to.query.boardId

  if (_source == null) {
    const setting = await getLeaderboardSetting()
    if (_source == null) {
      _source = setting.source
      _boardId = setting.boardId
    }
    next({
      path: to.path,
      query: { ...to.query, source: _source, boardId: _boardId },
    })
    return
  }
  next()
  source.value = _source
  boardId.value = _boardId
  void setLeaderboardSetting({ source: _source, boardId: _boardId })
}


export default {
  components: {
    BoardList,
    MusicList,
  },
  beforeRouteEnter: verifyQueryParams,
  beforeRouteUpdate: verifyQueryParams,
  setup() {
    const musicListRef = ref(null)
    const boardListRef = ref(null)
    const sourceList = computed(() => {
      return sources.map(s => ({ id: s, name: sourceNames.value[s] }))
    })
    const router = useRouter()
    const route = useRoute()
    const handleToggleSource = async(id) => {
      if (id == source.value) return
      let boardList = boards[id]
      try {
        if (boardList == null) setBoard(boardList = await getBoardsList(id), id)
      } catch (error) {
        console.warn(`Failed to prepare leaderboard source: ${id}`, error)
      }
      void router.replace({
        path: route.path,
        query: {
          source: id,
          boardId: boardList?.list[0]?.id,
        },
      })
    }

    return {
      source,
      boardId,
      sourceList,
      handleToggleSource,
      musicListRef,
      boardListRef,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.leaderboard {
  height: 100%;
  display: flex;
  position: relative;
  gap: 16px;
  padding: 16px 18px calc(@height-player + 18px);
  box-sizing: border-box;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, .18), rgba(255, 255, 248, .42)),
    radial-gradient(circle at 16% 14%, var(--color-primary-alpha-900), transparent 34%);
}
.header {
  flex: none;
  width: 100%;
  display: flex;
  flex-flow: row nowrap;

}
.tab {
  flex: auto;
}
.select {
  flex: none;
  width: 80px;
}
.content {
  flex: auto;
  display: flex;
  overflow: hidden;
  flex-flow: column nowrap;
}

.lists {
  flex: none;
  width: clamp(190px, 18%, 230px);
  display: flex;
  flex-flow: column nowrap;
  overflow: hidden;
  border-radius: 20px;
  background: rgb(from var(--color-main-background) r g b / .52);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .66), 0 16px 38px rgba(72, 91, 112, .08);
  backdrop-filter: blur(16px) saturate(1.1);
}
.listsHeader {
  position: relative;
}

.listsSelect {
  font-size: 12px;

  &:hover {
    :global(.icon) {
      opacity: 1;
    }
  }

  >:global(.content) {
    display: block;
    width: 100%;
  }
  :global(.label-content) {
    margin: 7px;
    width: calc(100% - 14px);
    background-color: rgb(from var(--color-main-background) r g b / .54) !important;
    line-height: 38px;
    height: 38px;
    border-radius: 12px;
    &:hover {
      background: none !important;
    }
  }
  :global(.label) {
    color: var(--color-font) !important;
  }
  :global(.icon) {
    opacity: .6;
    transition: opacity .3s ease;
  }

  :global(.selection-list) {
    max-height: 500px;
    box-shadow: 0 1px 8px 0 rgba(0,0,0,.2);
    li {
      // background-color: var(--color-main-background);
      line-height: 38px;
      font-size: 13px;
      &:hover {
        background-color: var(--color-button-background-hover);
      }
      &:active {
        background-color: var(--color-button-background-active);
      }
    }
  }
  // line-height: 38px;
  // padding: 0 10px;
  border-bottom: 1px solid rgba(122, 136, 150, .1);
  flex: none;
}

.list {
  position: relative;
  overflow: hidden;
  height: 100%;
  flex: auto;
  display: flex;
  flex-flow: column nowrap;
  min-width: 0;
  border-radius: 20px;
  background: rgb(from var(--color-main-background) r g b / .54);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .68), 0 16px 38px rgba(72, 91, 112, .08);
  backdrop-filter: blur(16px) saturate(1.1);
  // .noItem {

  // }
}

</style>
