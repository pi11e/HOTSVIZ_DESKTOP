<template>
  <section class="panel party-size-chart">
    <button class="party-size-chart-header" :aria-expanded="!collapsed" @click="toggle">
      <h2>Winrate per party size</h2>
      <span class="chevron" :class="{ open: !collapsed }">&#9662;</span>
    </button>
    <p v-if="collapsed && data.length" class="party-size-hint">{{ data.length }} party sizes — click to expand</p>
    <p v-if="collapsed && !data.length" class="empty">No party size data available.</p>
    <div v-show="!collapsed" class="party-size-canvas-wrap">
      <canvas ref="canvasRef"></canvas>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import type { PartySizeStat } from '../../shared/types'
import { Chart, Tooltip, Legend, CategoryScale, LinearScale, BarController, BarElement } from 'chart.js'

Chart.register(Tooltip, Legend, CategoryScale, LinearScale, BarController, BarElement)

const props = defineProps<{ data: PartySizeStat[] }>()
const collapsed = ref(true)
const canvasRef = ref<HTMLCanvasElement | null>(null)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let chartInstance: Chart<any> | null = null

const sizeLabels: Record<number, string> = { 1: 'Solo', 2: 'Duo', 3: 'Trio', 4: '4-stack', 5: '5-stack' }

function buildChart(): void {
  const canvas = canvasRef.value
  if (!canvas || !props.data.length) return
  if (chartInstance) { chartInstance.destroy(); chartInstance = null }

  const labels = props.data.map((d) => sizeLabels[d.partySize] ?? `Size ${d.partySize}`)
  const wins = props.data.map((d) => d.wins)
  const losses = props.data.map((d) => d.losses)

  chartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Losses',
          data: losses,
          backgroundColor: 'rgb(255, 99, 132)',
        },
        {
          label: 'Wins',
          data: wins,
          backgroundColor: 'rgb(75, 192, 192)',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { display: true, labels: { color: '#9eafca' } },
        tooltip: {
          callbacks: {
            title(items) {
              const idx = items[0]?.dataIndex
              if (idx == null) return ''
              const stat = props.data[idx]
              return sizeLabels[stat.partySize] ?? `Party size ${stat.partySize}`
            },
            label(ctx) {
              const idx = ctx.dataIndex
              const stat = props.data[idx]
              if (ctx.dataset.label === 'Wins') return `Wins: ${stat.wins} (${Math.round(stat.winRate * 100)}%)`
              return `Losses: ${stat.losses}`
            },
          },
        },
        title: { display: false },
      },
      scales: {
        x: { stacked: true, ticks: { color: '#9eafca' }, grid: { display: false } },
        y: { stacked: true, ticks: { color: '#9eafca' }, grid: { color: '#23324e' } },
      },
    },
  })
}

async function toggle(): Promise<void> {
  collapsed.value = !collapsed.value
  if (!collapsed.value) {
    await nextTick()
    await new Promise<void>((r) => requestAnimationFrame(() => r()))
    buildChart()
  }
}

watch(() => props.data, async () => {
  if (!collapsed.value) {
    await nextTick()
    await new Promise<void>((r) => requestAnimationFrame(() => r()))
    buildChart()
  }
})
</script>
