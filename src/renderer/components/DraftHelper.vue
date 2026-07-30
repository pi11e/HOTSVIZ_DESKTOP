<template>
  <section class="panel draft-helper">
    <button class="draft-header" :aria-expanded="!collapsed" @click="toggle">
      <h2>Map Draft Helper</h2>
      <span class="chevron" :class="{ open: !collapsed }">&#9662;</span>
    </button>
    <p v-if="collapsed" class="draft-hint">Select a map to see hero recommendations — click to expand</p>
    <div v-show="!collapsed" class="draft-body">
      <div class="draft-controls">
        <label>Map<select v-model="selectedMap" @change="onMapChange">
          <option value="">Select a map…</option>
          <option v-for="name in vm.dashboard.availableMaps" :key="name" :value="name">{{ name }}</option>
        </select></label>
      </div>
      <p v-if="!selectedMap" class="empty">Choose a map above to see your best heroes for it.</p>
      <p v-else-if="!vm.draftData.length" class="empty">No data available.</p>
      <div v-else class="draft-list">
        <div v-for="(hero, i) in vm.draftData" :key="hero.heroName" class="draft-row" :class="{ dimmed: hero.confidence === 'low' && hero.mapGames === 0 }">
          <span class="draft-rank">{{ i + 1 }}</span>
          <div class="draft-hero-info">
            <strong>{{ hero.heroName }}</strong>
            <span class="draft-confidence" :class="hero.confidence" :title="confidenceTooltip(hero)">{{ hero.confidence }}</span>
          </div>
          <div class="draft-score" :class="scoreClass(hero.compositeScore)" :title="`Composite score: ${Math.round(hero.compositeScore * 100)} — weighted blend of map winrate, recent form, overall proficiency, and confidence`">{{ Math.round(hero.compositeScore * 100) }}</div>
          <div class="draft-bars">
            <div class="draft-stat">
              <span class="draft-stat-label">Map</span>
              <div class="draft-bar-track"><div class="draft-bar-fill" :style="{ width: `${hero.mapGames ? Math.round(hero.mapWinRate * 100) : 0}%` }" /></div>
              <span class="draft-stat-value">{{ hero.mapGames ? `${Math.round(hero.mapWinRate * 100)}%` : '—' }}</span>
              <span class="draft-stat-games" :title="`${hero.mapGames} game${hero.mapGames === 1 ? '' : 's'} played on this map`">({{ hero.mapGames }}g)</span>
            </div>
            <div class="draft-stat">
              <span class="draft-stat-label">Recent</span>
              <div class="draft-bar-track"><div class="draft-bar-fill recent" :style="{ width: `${hero.recentGames ? Math.round(hero.recentWinRate * 100) : 0}%` }" /></div>
              <span class="draft-stat-value">{{ hero.recentGames ? `${Math.round(hero.recentWinRate * 100)}%` : '—' }}</span>
              <span class="draft-stat-games" :title="`${hero.recentGames} of last 5 games${hero.recentGames > 0 ? ` — ${hero.recentWins} win${hero.recentWins === 1 ? '' : 's'}` : ''}`">({{ hero.recentGames }}g)</span>
            </div>
            <div class="draft-stat">
              <span class="draft-stat-label">Overall</span>
              <div class="draft-bar-track"><div class="draft-bar-fill overall" :style="{ width: `${hero.overallGames ? Math.round(hero.overallWinRate * 100) : 0}%` }" /></div>
              <span class="draft-stat-value">{{ hero.overallGames ? `${Math.round(hero.overallWinRate * 100)}%` : '—' }}</span>
              <span class="draft-stat-games" :title="`${hero.overallGames} total games with this hero — ${hero.overallWins} win${hero.overallWins === 1 ? '' : 's'}`">({{ hero.overallGames }}g)</span>
            </div>
          </div>
          <div class="draft-form" :title="`Last ${hero.recentForm.length} game${hero.recentForm.length === 1 ? '' : 's'}: ${hero.recentForm.map((w, i) => `#${i + 1}: ${w ? 'Win' : 'Loss'}`).join(', ')}`">
            <span v-for="(won, j) in hero.recentForm" :key="j" class="form-dot" :class="won ? 'win' : 'loss'" :title="`Game ${j + 1}: ${won ? 'Win' : 'Loss'}`" />
            <span v-for="j in Math.max(0, 5 - hero.recentForm.length)" :key="'e' + j" class="form-dot empty" title="No game recorded" />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useViewModel } from '../stores/viewModel'

const vm = useViewModel()
const collapsed = ref(false)
const selectedMap = ref('')

function scoreClass(score: number): string {
  if (score >= 0.7) return 'high'
  if (score >= 0.4) return 'mid'
  return 'low'
}

function confidenceTooltip(hero: { confidence: string; mapGames: number }): string {
  if (hero.confidence === 'high') return `High confidence — ${hero.mapGames} games on this map (11+ recommended)`
  if (hero.confidence === 'medium') return `Medium confidence — ${hero.mapGames} games on this map (3–10)`
  return `Low confidence — ${hero.mapGames} games on this map (less reliable)`
}

function onMapChange(): void {
  void vm.fetchDraftData(selectedMap.value)
}

async function toggle(): Promise<void> {
  collapsed.value = !collapsed.value
}
</script>
