<template>
  <section class="panel trend-chart">
    <button class="trend-chart-header" :aria-expanded="!collapsed" @click="toggle">
      <h2>Daily vs. aggregate winrate</h2>
      <span class="chevron" :class="{ open: !collapsed }">&#9662;</span>
    </button>
    <p v-if="collapsed && data.length" class="trend-hint">{{ data.length }} days of data — click to expand</p>
    <p v-if="collapsed && !data.length" class="empty">No trend data available.</p>
    <div v-show="!collapsed" class="trend-chart-canvas-wrap">
      <canvas ref="canvasRef"></canvas>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import type { TrendPoint } from '../../shared/types'
import { Chart, Tooltip, Legend, LineController, LinearScale, PointElement, LineElement } from 'chart.js'

Chart.register(Tooltip, Legend, LineController, LinearScale, PointElement, LineElement)

const props = defineProps<{ data: TrendPoint[] }>()
const collapsed = ref(true)
const canvasRef = ref<HTMLCanvasElement | null>(null)
let chartInstance: Chart | null = null

function buildChart(): void {
  const canvas = canvasRef.value
  if (!canvas || !props.data.length) return
  if (chartInstance) { chartInstance.destroy(); chartInstance = null }

  const labels = props.data.map((d) => d.date)
  const dailyRates = props.data.map((d) => d.dailyWinRate)
  const aggregateRates = props.data.map((d) => d.aggregateWinRate)

  chartInstance = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Daily',
          data: dailyRates,
          borderColor: 'rgba(0,128,128,0.6)',
          backgroundColor: 'rgba(0,128,128,0.1)',
          yAxisID: 'y',
          pointRadius: 2,
          tension: 0.3,
          fill: true,
        },
        {
          label: 'Aggregate',
          data: aggregateRates,
          borderColor: 'rgba(255,80,80,0.7)',
          backgroundColor: 'rgba(255,80,80,0.1)',
          yAxisID: 'y1',
          pointRadius: 0,
          tension: 0.3,
          fill: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { position: 'top', labels: { color: '#9eafca' } },
        tooltip: {
          callbacks: {
            title(items) {
              const idx = items[0]?.dataIndex ?? 0
              const point = props.data[idx]
              return `${point.date}  (${point.gamesPlayed} games)`
            },
            label(ctx) {
              return ` ${ctx.dataset.label}: ${Math.round((ctx.parsed.y ?? 0) * 1000) / 10}%`
            },
          },
        },
        title: { display: false },
      },
      layout: { padding: { top: 0 } },
      scales: {
        x: {
          ticks: {
            color: '#9eafca',
            maxRotation: 45,
            minRotation: 45,
            font: { size: 11 },
          },
          grid: { color: 'rgba(158,175,202,0.1)' },
        },
        y: {
          position: 'left',
          min: 0,
          max: 1,
          ticks: {
            color: 'rgba(0,128,128,0.8)',
            callback(v) { return `${Math.round(v as number * 100)}%` },
          },
          grid: { color: 'rgba(158,175,202,0.1)' },
        },
        y1: {
          position: 'right',
          ticks: {
            color: 'rgba(255,80,80,0.8)',
            callback(v) { return `${Math.round(v as number * 100)}%` },
          },
          grid: { drawOnChartArea: false },
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
