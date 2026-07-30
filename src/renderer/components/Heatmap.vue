<template>
  <section class="panel heatmap">
    <button class="heatmap-header" :aria-expanded="!collapsed" @click="toggle">
      <h2>Hero × Map winrate heatmap</h2>
      <span class="chevron" :class="{ open: !collapsed }">&#9662;</span>
    </button>
    <p v-if="collapsed && data.cells.length" class="heatmap-hint">{{ data.heroes.length }} heroes × {{ data.maps.length }} maps — click to expand</p>
    <p v-if="collapsed && !data.heroes.length" class="empty">No heatmap data available.</p>
    <div v-show="!collapsed" class="heatmap-canvas-wrap">
      <canvas ref="canvasRef"></canvas>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import type { HeatmapData } from '../../shared/types'
import { Chart, Tooltip, CategoryScale } from 'chart.js'
import { MatrixController, MatrixElement } from 'chartjs-chart-matrix'

Chart.register(Tooltip, CategoryScale, MatrixController, MatrixElement)

const props = defineProps<{ data: HeatmapData }>()
const collapsed = ref(false)
const canvasRef = ref<HTMLCanvasElement | null>(null)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let chartInstance: Chart<any> | null = null

function calculateRGBA(winrate: number, gamesPlayed: number): string {
  const red = Math.round(255 * (1 - winrate))
  const green = Math.round(255 * winrate)
  const alpha = Math.min(Math.max(gamesPlayed * 0.2, 0.1), 1).toFixed(2)
  return `rgba(${red}, ${green}, 0, ${alpha})`
}

function buildChart(): void {
  const canvas = canvasRef.value
  if (!canvas || !props.data.heroes.length) return
  if (chartInstance) { chartInstance.destroy(); chartInstance = null }

  const { cells, heroes, maps } = props.data
  const cellMap = new Map(cells.map((c) => [`${c.map}::${c.hero}`, c]))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const matrixData: any[] = cells.map((c) => ({
    x: c.hero,
    y: c.map,
    v: c.winRate ?? undefined,
  }))

  chartInstance = new Chart(canvas, {
    type: 'matrix',
    data: {
      datasets: [{
        label: 'Hero winrate heatmap',
        data: matrixData,
        backgroundColor(ctx: any) {
          const d = ctx.dataset.data[ctx.dataIndex]
          if (d.v == null) return 'rgba(40,50,70,0.8)'
          const key = `${d.y}::${d.x}`
          const cell = cellMap.get(key)
          return calculateRGBA(d.v, cell?.gamesPlayed ?? 1)
        },
        borderColor: 'rgba(0,0,0,0.5)',
        borderWidth: 1,
        width: ({ chart }: any) => {
          const area = chart.chartArea
          if (!area) return 0
          return (area.right - area.left) / heroes.length * 0.85
        },
        height: ({ chart }: any) => {
          const area = chart.chartArea
          if (!area) return 0
          return (area.bottom - area.top) / maps.length * 0.85
        },
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title() { return '' },
            label(ctx: any) {
              const v = ctx.dataset.data[ctx.dataIndex]
              const wr = v.v == null ? 'N/A' : `${Math.round(v.v * 100)}%`
              const key = `${v.y}::${v.x}`
              const cell = cellMap.get(key)
              const gp = cell?.gamesPlayed ?? 'none'
              return [`${v.x} on ${v.y}`, `winrate: ${wr}`, `games played: ${gp}`]
            },
          },
        },
        title: { display: false },
      },
      layout: { padding: { top: 0 } },
      scales: {
        x: {
          type: 'category' as const,
          labels: heroes,
          position: 'top',
          ticks: {
            color: '#9eafca',
            font: { size: 10 },
            maxRotation: 90,
            minRotation: 90,
            padding: 12,
            labelOffset: 11,
          },
          grid: { display: false },
        },
        y: {
          type: 'category' as const,
          labels: maps,
          ticks: { color: '#9eafca', font: { size: 11 }, padding: 8 },
          grid: { display: false },
        },
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
