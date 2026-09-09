<template>
  <section class="admin-page">
    <div class="page-header">
      <h1>儀表板</h1>
      <p>歡迎回來，管理員</p>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <span class="stat-icon">👥</span>
        <div class="stat-info">
          <p class="stat-value">{{ isLoading ? '—' : formatNumber(summary.memberCount) }}</p>
          <p class="stat-label">總會員數</p>
        </div>
      </div>

      <div class="stat-card">
        <span class="stat-icon">🍕</span>
        <div class="stat-info">
          <p class="stat-value">{{ isLoading ? '—' : formatNumber(summary.productCount) }}</p>
          <p class="stat-label">商品總數</p>
        </div>
      </div>

      <div class="stat-card">
        <span class="stat-icon">📦</span>
        <div class="stat-info">
          <p class="stat-value">{{ isLoading ? '—' : formatNumber(summary.pendingOrderCount) }}</p>
          <p class="stat-label">待處理訂單</p>
        </div>
      </div>

      <div class="stat-card">
        <span class="stat-icon">💰</span>
        <div class="stat-info">
          <p class="stat-value">{{ isLoading ? '—' : `NT$ ${formatNumber(summary.monthlyRevenue)}` }}</p>
          <p class="stat-label">本月營收</p>
        </div>
      </div>
    </div>

    <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>

    <div class="charts-row">
      <div class="chart-card">
        <h3>近 7 天訂單趨勢</h3>
        <div v-if="trendLoading" class="chart-placeholder">載入趨勢中…</div>
        <div v-else class="chart-canvas">
          <canvas ref="trendCanvas"></canvas>
        </div>
      </div>

      <div class="chart-card">
        <h3>熱門商品 Top 5</h3>
        <div v-if="topProductsLoading" class="chart-placeholder">載入熱門商品中…</div>
        <div v-else-if="!topProducts.length" class="chart-placeholder">近 30 天尚無完成訂單</div>
        <div v-else class="chart-canvas">
          <canvas ref="topProductsCanvas"></canvas>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  CategoryScale,
  Chart,
  BarController,
  BarElement,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip
} from 'chart.js'
import { api } from '../../services/api'

Chart.register(BarController, BarElement, CategoryScale, LineController, LineElement, LinearScale, PointElement, Tooltip, Legend)

const summary = ref({
  memberCount: 0,
  productCount: 0,
  pendingOrderCount: 0,
  monthlyRevenue: 0
})
const isLoading = ref(true)
const errorMessage = ref('')
const trendCanvas = ref(null)
const trendChart = ref(null)
const trendLoading = ref(true)
const topProductsCanvas = ref(null)
const topProductsChart = ref(null)
const topProducts = ref([])
const topProductsLoading = ref(true)

const formatNumber = (value) => Number(value || 0).toLocaleString('zh-TW')

const renderTrend = (trend) => {
  trendChart.value?.destroy()
  trendChart.value = new Chart(trendCanvas.value, {
    type: 'line',
    data: {
      labels: trend.map((item) => item.label),
      datasets: [
        {
          label: '總訂單',
          data: trend.map((item) => Number(item.totalOrders)),
          borderColor: '#2185d0',
          backgroundColor: 'rgba(33, 133, 208, 0.12)',
          tension: 0.35
        },
        {
          label: '完成訂單',
          data: trend.map((item) => Number(item.completedOrders)),
          borderColor: '#16a34a',
          backgroundColor: 'rgba(22, 163, 74, 0.12)',
          tension: 0.35
        },
        {
          label: '取消訂單',
          data: trend.map((item) => Number(item.cancelledOrders)),
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.12)',
          tension: 0.35
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 }, title: { display: true, text: '訂單數量' } }
      }
    }
  })
}

const renderTopProducts = (products) => {
  topProductsChart.value?.destroy()
  topProductsChart.value = new Chart(topProductsCanvas.value, {
    type: 'bar',
    data: {
      labels: products.map((product) => product.name),
      datasets: [{
        label: '售出數量',
        data: products.map((product) => Number(product.quantity)),
        backgroundColor: ['#35c1d0', '#4f9cf9', '#8b7cf6', '#f59e0b', '#ec6a5c'],
        borderRadius: 6,
        borderSkipped: false
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => `售出 ${context.parsed.x} 份`,
            afterLabel: (context) => `銷售額 NT$ ${formatNumber(products[context.dataIndex].revenue)}`
          }
        }
      },
      scales: {
        x: { beginAtZero: true, ticks: { precision: 0 }, title: { display: true, text: '售出數量' } },
        y: { grid: { display: false } }
      }
    }
  })
}

const loadDashboard = async () => {
  isLoading.value = true
  trendLoading.value = true
  topProductsLoading.value = true
  errorMessage.value = ''
  try {
    const [summaryData, trendData, topProductData] = await Promise.all([
      api('/dashboard/summary'),
      api('/dashboard/order-trend'),
      api('/dashboard/top-products?days=30')
    ])
    summary.value = summaryData
    topProducts.value = topProductData
    trendLoading.value = false
    topProductsLoading.value = false
    await nextTick()
    renderTrend(trendData)
    if (topProductData.length) renderTopProducts(topProductData)
  } catch (error) {
    errorMessage.value = error.message || '統計資料載入失敗'
  } finally {
    isLoading.value = false
    trendLoading.value = false
    topProductsLoading.value = false
  }
}

onMounted(loadDashboard)
onBeforeUnmount(() => {
  trendChart.value?.destroy()
  topProductsChart.value?.destroy()
})
</script>

<style scoped>
.admin-page {
  padding: 24px;
}

.page-header {
  margin-bottom: 28px;
}

.page-header h1 {
  margin: 0 0 6px;
  font-size: 28px;
  font-weight: 700;
  color: #273746;
}

.page-header p {
  margin: 0;
  color: #91a1ad;
  font-size: 15px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 28px;
}

.stat-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px 24px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.stat-icon {
  font-size: 28px;
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f0f9fa;
  border-radius: 10px;
}

.stat-value {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: #273746;
}

.stat-label {
  margin: 4px 0 0;
  font-size: 13px;
  color: #91a1ad;
}

.error-message {
  margin: -12px 0 20px;
  color: #b91c1c;
  font-size: 14px;
}

.charts-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}

.chart-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 24px;
}

.chart-card h3 {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
  color: #273746;
}

.chart-placeholder {
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7f9;
  border-radius: 8px;
  color: #94a3b8;
  font-size: 14px;
}

.chart-canvas {
  height: 260px;
}

@media (max-width: 992px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .charts-row {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 576px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
