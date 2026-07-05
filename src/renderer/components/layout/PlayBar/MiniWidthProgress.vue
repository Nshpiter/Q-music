<template>
  <player-footer :detail="isShowPlayerDetail" />
</template>

<script setup>
import PlayerFooter from '../PlayerFooter.vue'
import { isShowPlayerDetail } from '@renderer/store/player/state'
</script>
