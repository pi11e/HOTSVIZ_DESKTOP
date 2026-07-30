<template>
  <section class="panel">
    <div class="panel-heading">
      <h2>{{ title }}</h2>
      <span>{{ stats.length }} shown</span>
    </div>
    <p v-if="!stats.length" class="empty">No Storm League matches match these filters yet.</p>
    <ol v-else class="bars">
      <li v-for="stat in stats" :key="stat.label" class="bar-row">
        <div class="bar-label"><strong>{{ stat.label }}</strong><span>{{ stat.games }} games</span></div>
        <div class="bar-track" :aria-label="`${stat.label}: ${percent(stat.winRate)} win rate`">
          <div class="bar-fill" :class="fillClass(stat.winRate, stat.games)" :style="{ width: `${Math.round(stat.winRate * 100)}%`, opacity: fillOpacity(stat.games) }" />
        </div>
        <strong class="bar-value">
          {{ percent(stat.winRate) }}
          <span v-if="stat.delta != null" class="delta" :class="deltaClass(stat.delta)">{{ formatDelta(stat.delta) }}</span>
        </strong>
      </li>
    </ol>
  </section>
</template>

<script setup lang="ts">
import type { WinRateStat } from '../../shared/types'

const props = defineProps<{ title: string; stats: WinRateStat[]; colorMode?: 'gradient' | 'winrate' }>()
const percent = (value: number) => `${Math.round(value * 100)}%`

function fillClass(winRate: number, games: number): string {
  if (props.colorMode !== 'winrate') return ''
  if (winRate > 0.55) return 'bar-green'
  if (winRate < 0.45) return 'bar-red'
  return 'bar-blue'
}

function fillOpacity(games: number): number {
  if (props.colorMode !== 'winrate') return 1
  return Math.min(0.5 + (games / 20) * 0.5, 1)
}

function deltaClass(delta: number): string {
  if (delta > 0) return 'delta-up'
  if (delta < 0) return 'delta-down'
  return 'delta-flat'
}

function formatDelta(delta: number): string {
  const sign = delta > 0 ? '▲' : '▼'
  return `${sign}${Math.abs(Math.round(delta * 100))}%`
}
</script>

