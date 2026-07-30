<template>
  <section class="panel match-list">
    <button class="match-list-header" :aria-expanded="!collapsed" @click="collapsed = !collapsed">
      <h2>Imported matches ({{ total }} total)</h2>
      <span class="chevron" :class="{ open: !collapsed }">&#9662;</span>
    </button>
    <template v-if="!matches.length">
      <p class="empty">No matches match the current filters.</p>
    </template>
    <template v-else-if="collapsed">
      <ol class="match-mini">
        <li v-for="(m, i) in recent" :key="i" class="match-mini-row" :title="m.sourcePath">
          <span class="match-date">{{ formatDate(m.playedAt) }}</span>
          <span class="match-hero">{{ m.heroName }}</span>
          <span class="match-map">{{ m.mapName }}</span>
          <span class="match-pill" :class="m.won ? 'win' : 'loss'">{{ m.won ? '\u2713 Win' : '\u2717 Loss' }}</span>
          <span class="match-party">P{{ m.partySize }}</span>
        </li>
      </ol>
    </template>
    <template v-else>
      <div class="match-table-wrap">
        <table class="match-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Hero</th>
              <th>Map</th>
              <th>Result</th>
              <th>Party</th>
              <th>Imported</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(m, i) in matches" :key="i" :title="m.sourcePath">
              <td>{{ formatDate(m.playedAt) }}</td>
              <td>{{ m.heroName }}</td>
              <td>{{ m.mapName }}</td>
              <td><span class="match-pill" :class="m.won ? 'win' : 'loss'">{{ m.won ? '\u2713 Win' : '\u2717 Loss' }}</span></td>
              <td>{{ m.partySize }}</td>
              <td>{{ formatDate(m.importedAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { MatchRecord } from '../../shared/types'

const props = defineProps<{ matches: MatchRecord[]; total: number }>()
const collapsed = ref(true)
const recent = computed(() => props.matches.slice(0, 3))
function formatDate(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
</script>
