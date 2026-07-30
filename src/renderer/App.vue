<template>
  <main>
    <header class="hero">
      <p class="eyebrow">LOCAL REPLAY ANALYSIS</p>
      <h1>HOTSVIZ</h1>
      <p>Turn your Heroes of the Storm replay history into personal improvement signals.</p>
      <p v-if="vm.dashboard.lastImportAt" class="freshness">Last import: {{ relativeTime(vm.dashboard.lastImportAt) }}</p>
    </header>

    <section class="panel setup">
      <div>
        <h2>Replay library</h2>
        <p v-if="vm.folder"><code>{{ vm.folder.folderPath }}</code><br>{{ vm.message }}</p>
        <p v-else>{{ vm.message }}</p>
      </div>
      <div class="actions">
        <button class="secondary" :disabled="vm.isImporting" @click="vm.selectFolder">Select folder</button>
        <span class="import-toggle" title="Fast: skip already imported replays. Clean: delete all and re-import everything.">
          <button class="toggle-option" :class="{ active: vm.importMode === 'fast' }" :disabled="vm.isImporting" @click="vm.importMode = 'fast'">Fast</button>
          <button class="toggle-option" :class="{ active: vm.importMode === 'clean' }" :disabled="vm.isImporting" @click="vm.importMode = 'clean'">Clean</button>
        </span>
        <button :class="{ danger: vm.importMode === 'clean' }" :disabled="!vm.folder || vm.isImporting || vm.folder.replayCount === 0" @click="vm.importReplays">
          {{ vm.isImporting ? 'Importing…' : vm.importMode === 'clean' ? 'Clean import' : 'Import replays' }}
        </button>
      </div>
      <div v-if="vm.progress" class="progress" :aria-label="`Imported ${vm.progress.current} of ${vm.progress.total}`">
        <div class="progress-track"><div :style="{ width: `${vm.progress.total ? vm.progress.current / vm.progress.total * 100 : 0}%` }" /></div>
        <div class="progress-info">
          <span>{{ formatNum(vm.progress.current) }}/{{ formatNum(vm.progress.total) }} · {{ formatNum(vm.progress.imported) }} imported · {{ formatNum(vm.progress.skipped) }} existing<template v-if="vm.progress.failed"> · <span class="error-count">{{ formatNum(vm.progress.failed) }} failed</span></template></span>
          <button v-if="vm.isImporting" class="cancel-btn" @click="vm.cancelActiveImport">Cancel</button>
        </div>
        <span v-if="vm.progress.current > 0 && vm.progress.current < vm.progress.total" class="progress-eta">Est. {{ formatEta(vm.progress.estimatedMs - vm.progress.elapsedMs) }} remaining</span>
      </div>
      <p v-if="vm.error" class="error">{{ vm.error }}</p>
    </section>

    <template v-if="vm.hasEverImported">
      <section class="filters panel">
        <div class="filters-primary">
          <label>Game mode<select v-model="gameMode"><option value="">All modes</option><option v-for="mode in vm.gameModes" :key="mode" :value="mode">{{ formatMode(mode) }}</option></select></label>
          <label>Last games<select v-model.number="lastGames"><option :value="undefined">All games</option><option :value="10">Last 10</option><option :value="25">Last 25</option><option :value="50">Last 50</option><option :value="100">Last 100</option></select></label>
          <button @click="apply">Apply filters</button>
          <button class="secondary" @click="clearFilters">Clear filters</button>
          <button class="toggle-option" :class="{ active: showAdvanced }" @click="showAdvanced = !showAdvanced">
            More filters<template v-if="activeFilterCount > 0"> ({{ activeFilterCount }})</template>
          </button>
        </div>
        <div v-show="showAdvanced" class="filters-secondary">
          <label>Since<input v-model="since" type="date"></label>
          <label>Map<select v-model="map"><option value="">All maps</option><option v-for="name in vm.dashboard.availableMaps" :key="name" :value="name">{{ name }}</option></select></label>
          <label>Hero<select v-model="hero"><option value="">All heroes</option><option v-for="name in vm.dashboard.availableHeroes" :key="name" :value="name">{{ name }}</option></select></label>
        </div>
      </section>

      <template v-if="vm.hasData">
        <section class="cards">
          <article><span>Matches</span><strong>{{ formatNum(vm.dashboard.totalGames) }}</strong></article>
          <article :class="winRateClass">
            <span>Win rate</span>
            <strong>{{ percent(vm.dashboard.winRate) }}</strong>
            <span v-if="vm.dashboard.winRateDelta !== null" class="delta" :class="deltaClass">{{ deltaIcon }} {{ percent(Math.abs(vm.dashboard.winRateDelta)) }}</span>
            <svg v-if="sparklinePath" class="sparkline" viewBox="0 0 100 24" preserveAspectRatio="none"><polyline :points="sparklinePath" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </article>
          <article><span>Most played</span><strong>{{ vm.dashboard.mostPlayedHero || '—' }}</strong></article>
          <article><span>Best hero</span>
            <strong v-if="vm.dashboard.bestHero">{{ vm.dashboard.bestHero.name }}</strong>
            <strong v-else>—</strong>
            <span v-if="vm.dashboard.bestHero" class="best-hero-detail">{{ percent(vm.dashboard.bestHero.winRate) }} over {{ vm.dashboard.bestHero.games }} games</span>
          </article>
        </section>
        <p v-if="vm.dashboard.insight" class="insight" :class="'insight-' + vm.dashboard.insight.trend">
          <span class="insight-icon">{{ vm.dashboard.insight.trend === 'up' ? '▲' : vm.dashboard.insight.trend === 'down' ? '▼' : '→' }}</span>
          {{ vm.dashboard.insight.text }}
        </p>
        <section class="chart-grid"><StatBars title="Hero performance" :stats="vm.dashboard.heroStats" color-mode="winrate" /><StatBars title="Map performance" :stats="vm.dashboard.mapStats" color-mode="winrate" /></section>
        <DraftHelper />
        <Heatmap :data="vm.heatmapData" />
        <TrendChart :data="vm.trendData" />
        <PartySizeChart :data="vm.partyData" />
        <MatchList :matches="vm.matchList" :total="vm.totalMatches" />
      </template>
      <section v-else class="empty-state" style="margin-top:1rem"><h2>No matches for current filters</h2><p>Try adjusting or clearing your filters.</p></section>
    </template>
    <section v-else class="empty-state"><h2>Your dashboard will appear here.</h2><p>Select your Multiplayer replay folder, then import its replays. Only your local data is used.</p></section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import Heatmap from './components/Heatmap.vue'
import DraftHelper from './components/DraftHelper.vue'
import MatchList from './components/MatchList.vue'
import PartySizeChart from './components/PartySizeChart.vue'
import StatBars from './components/StatBars.vue'
import TrendChart from './components/TrendChart.vue'
import { useViewModel } from './stores/viewModel'

const vm = useViewModel()
const gameMode = ref('stormLeague')
const lastGames = ref<number | undefined>(undefined)
const since = ref('')
const map = ref('')
const hero = ref('')
const showAdvanced = ref(false)
const activeFilterCount = computed(() => {
  let count = 0
  if (since.value) count++
  if (map.value) count++
  if (hero.value) count++
  return count
})
const percent = (value: number) => `${Math.round(value * 100)}%`
const formatNum = (n: number) => n.toLocaleString()
const formatMode = (mode: string): string => mode.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim()
const formatEta = (ms: number): string => {
  if (ms <= 0) return 'done'
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`
}
const relativeTime = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}
const deltaClass = computed(() => {
  const d = vm.dashboard.winRateDelta
  if (d === null || Math.abs(d) < 0.02) return 'delta-flat'
  return d > 0 ? 'delta-up' : 'delta-down'
})
const deltaIcon = computed(() => {
  const d = vm.dashboard.winRateDelta
  if (d === null || Math.abs(d) < 0.02) return ''
  return d > 0 ? '▲' : '▼'
})
const winRateClass = computed(() => {
  const wr = vm.dashboard.winRate
  if (wr > 0.55) return 'card-positive'
  if (wr < 0.45) return 'card-negative'
  return ''
})
const sparklinePath = computed(() => {
  const trend = vm.trendData
  if (trend.length < 2) return ''
  const last20 = trend.slice(-20)
  const w = 100
  const h = 24
  const pad = 1
  return last20.map((p, i) => {
    const x = pad + (i / (last20.length - 1)) * (w - pad * 2)
    const y = h - pad - p.dailyWinRate * (h - pad * 2)
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
})
const apply = () => vm.applyFilters({ gameMode: gameMode.value || undefined, lastGames: lastGames.value, since: since.value || undefined, map: map.value || undefined, hero: hero.value || undefined })
const clearFilters = () => { gameMode.value = 'stormLeague'; lastGames.value = undefined; since.value = ''; map.value = ''; hero.value = ''; showAdvanced.value = false; void vm.clearFilters() }
onMounted(() => { void vm.load() })
</script>

