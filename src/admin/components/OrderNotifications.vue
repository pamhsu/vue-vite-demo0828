<template>
  <div ref="root" class="order-notifications">
    <button ref="trigger" class="notification-trigger" type="button"
      :aria-expanded="isOpen" aria-controls="order-notification-panel"
      :aria-label="unreadCount ? `訂單通知，${unreadCount} 則未讀（最近 30 則）` : '訂單通知'"
      @click="toggle">
      <i class="bi bi-bell" aria-hidden="true"></i>
      <span v-if="unreadCount" class="trigger-count">{{ unreadCount > 9 ? '9+' : unreadCount }}</span>
    </button>

    <section v-if="isOpen" id="order-notification-panel" class="notification-panel" aria-labelledby="notification-heading">
      <header class="panel-header">
        <h2 id="notification-heading">訂單通知</h2>
        <button class="read-all" type="button" :disabled="!unreadCount || busy || loading" @click="markAllRead">
          {{ busy ? '處理中…' : '全部標為已讀' }}
        </button>
      </header>
      <div v-if="error" class="panel-error" role="alert">
        <span>{{ error }}</span>
        <button type="button" @click="load">重新整理</button>
      </div>
      <div class="notification-list" :aria-busy="loading">
        <div v-if="loading && !loaded" class="empty-state" role="status">正在載入訂單通知…</div>
        <div v-else-if="!notices.length && !error" class="empty-state">
          <i class="bi bi-check2-circle" aria-hidden="true"></i>
          <strong>目前沒有通知</strong>
          <span>有新訂單時，會顯示在這裡。</span>
        </div>
        <button v-for="notice in notices" :key="notice.id" type="button"
          class="notification-row" :class="{ urgent: isUrgent(notice) }"
          :disabled="busy" @click="openOrder(notice)">
          <span class="notice-icon" :class="tone(notice)" aria-hidden="true">
            <i :class="['bi', icon(notice)]"></i>
          </span>
          <span class="notice-content">
            <span class="notice-heading">
              <strong class="order-number">#{{ notice.orderNumber || notice.orderId }}</strong>
              <span class="status-label" :class="tone(notice)">{{ statusText(notice) }}</span>
            </span>
            <span class="notice-summary">{{ summary(notice) }}</span>
            <span class="notice-meta">
              <time :datetime="notice.createdAt" :title="fullTime(notice.createdAt)">{{ relativeTime(notice.createdAt) }}</time>
              <span v-if="!notice.isRead" class="unread-label"><span class="unread-dot"></span>未讀</span>
            </span>
          </span>
          <i class="bi bi-chevron-right row-arrow" aria-hidden="true"></i>
        </button>
      </div>
      <footer class="panel-footer">
        <span>最近 30 則 · 每分鐘更新</span>
        <button type="button" @click="viewOrders">查看訂單 <i class="bi bi-arrow-right" aria-hidden="true"></i></button>
      </footer>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../../services/api'

const router = useRouter()
const route = useRoute()
const root = ref(null)
const trigger = ref(null)
const isOpen = ref(false)
const notices = ref([])
const error = ref('')
const loading = ref(false)
const loaded = ref(false)
const busy = ref(false)
const now = ref(Date.now())
const unreadCount = computed(() => notices.value.filter(n => !n.isRead).length)
let timer
let disposed = false

const isUrgent = n => n.type === 'pending_overdue' && n.orderStatus === 'pending'
const resolved = n => ['processing', 'completed', 'cancelled'].includes(n.orderStatus)
const tone = n => isUrgent(n) ? 'urgent-tone' : n.type === 'new_order' && n.orderStatus === 'pending' ? 'new-tone' : 'neutral-tone'
const icon = n => n.type === 'pending_overdue' ? 'bi-box' : n.type === 'new_order' ? 'bi-bag-plus' : 'bi-x-circle'
const statusText = n => {
  if (resolved(n)) return ({ processing: '處理中', completed: '已完成', cancelled: '已取消' })[n.orderStatus]
  if (isUrgent(n)) return '逾時待處理'
  return ({ new_order: '新訂單', pending_overdue: '逾時紀錄', customer_cancelled: '客戶取消' })[n.type] || '訂單通知'
}
const summary = n => {
  if (n.type === 'pending_overdue') {
    if (isUrgent(n)) return '已等待超過 10 分鐘，請盡快接收。'
    if (n.orderStatus === 'cancelled') return '訂單已取消，無需接收。'
    if (resolved(n)) return '訂單已接收，逾時提醒已解除。'
    return '此訂單曾超過 10 分鐘未處理。'
  }
  if (n.type === 'customer_cancelled') return '客戶已取消此筆訂單。'
  const amount = n.total == null ? null : `NT$${Number(n.total).toLocaleString('zh-TW')}`
  const delivery = ({ pickup: '到店自取', delivery: '外送' })[n.deliveryType]
  return [amount, delivery, n.customerName].filter(Boolean).join(' · ') || n.message
}
const fullTime = value => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('zh-TW', { hour12: false })
}
const relativeTime = value => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const minutes = Math.max(0, Math.floor((now.value - date.getTime()) / 60000))
  if (minutes < 1) return '剛剛'
  if (minutes < 60) return `${minutes} 分鐘前`
  const today = new Date(now.value)
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const time = date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })
  if (date.toDateString() === today.toDateString()) return `今天 ${time}`
  if (date.toDateString() === yesterday.toDateString()) return `昨天 ${time}`
  return `${date.toLocaleDateString('zh-TW')} ${time}`
}
const load = async () => {
  if (loading.value || disposed) return
  loading.value = true
  try {
    const data = await api('/admin/notifications')
    if (disposed) return
    notices.value = data
    now.value = Date.now()
    loaded.value = true
    error.value = ''
  } catch {
    if (!disposed) error.value = '通知暫時無法更新，請稍後重試。'
  } finally {
    loading.value = false
  }
}
const toggle = () => {
  isOpen.value = !isOpen.value
  if (isOpen.value) load()
}
const close = () => { isOpen.value = false }
const markAllRead = async () => {
  if (busy.value) return
  busy.value = true
  try {
    await api('/admin/notifications/read-all', { method: 'POST' })
    await load()
  } catch {
    error.value = '無法標記已讀，請再試一次。'
  } finally { busy.value = false }
}
const openOrder = async notice => {
  if (busy.value) return
  busy.value = true
  try {
    if (!notice.isRead) {
      await api(`/admin/notifications/${notice.id}/read`, { method: 'POST' })
      notice.isRead = true
    }
    await router.push({ path: '/admin/orders', query: { order: notice.orderNumber || String(notice.orderId) } })
    close()
  } catch {
    error.value = '無法開啟訂單，請再試一次。'
  } finally { busy.value = false }
}
const viewOrders = () => { close(); router.push('/admin/orders') }
const onOutside = event => { if (!root.value?.contains(event.target)) close() }
const onEscape = event => {
  if (event.key === 'Escape' && isOpen.value) { close(); trigger.value?.focus() }
}
const refreshVisible = () => { if (!document.hidden) load() }
watch(() => route.fullPath, () => { close(); load() })
onMounted(() => {
  load()
  timer = window.setInterval(refreshVisible, 60000)
  document.addEventListener('pointerdown', onOutside)
  document.addEventListener('keydown', onEscape)
  document.addEventListener('visibilitychange', refreshVisible)
  window.addEventListener('focus', refreshVisible)
})
onUnmounted(() => {
  disposed = true
  window.clearInterval(timer)
  document.removeEventListener('pointerdown', onOutside)
  document.removeEventListener('keydown', onEscape)
  document.removeEventListener('visibilitychange', refreshVisible)
  window.removeEventListener('focus', refreshVisible)
})
</script>

<style scoped>
.order-notifications { position: relative; margin-right: 18px; }
.order-notifications *, .order-notifications *::before { box-sizing: border-box; }
button { width: auto; height: auto; padding: 0; white-space: normal; letter-spacing: normal; font: inherit; cursor: pointer; box-shadow: none; transition: background .15s ease; }
button:hover, button:active { transform: none; box-shadow: none; }
button:disabled { cursor: default; opacity: .55; }
button:focus-visible { outline: 2px solid #168b98; outline-offset: -3px; }
.notification-trigger { display: grid; place-items: center; position: relative; width: 40px; height: 40px; border: 0; border-radius: 10px; background: #f6f8fa; color: #475569; font-size: 20px; }
.notification-trigger:hover, .notification-trigger[aria-expanded="true"] { background: #eaf5f6; color: #147d89; }
.trigger-count { position: absolute; top: -3px; right: -4px; min-width: 18px; padding: 2px 4px; border: 2px solid white; border-radius: 20px; background: #d94848; color: white; font-size: 10px; font-weight: 700; line-height: 14px; }
.notification-panel { position: absolute; top: 52px; right: 0; z-index: 1100; width: 460px; max-width: calc(100vw - 32px); display: flex; flex-direction: column; max-height: min(620px, calc(100dvh - 100px)); border: 1px solid #e2e8ed; border-radius: 16px; background: white; box-shadow: 0 12px 40px #162d451f, 0 2px 6px #162d450a; color: #26364a; }
.notification-panel::before { content: ''; position: absolute; top: -6px; right: 14px; width: 12px; height: 12px; transform: rotate(45deg); border-top: 1px solid #e2e8ed; border-left: 1px solid #e2e8ed; background: white; }
.panel-header { display: flex; flex: none; align-items: center; justify-content: space-between; gap: 12px; padding: 20px; border-bottom: 1px solid #edf0f3; }
.panel-header h2 { margin: 0; font-size: 18px; font-weight: 700; }
.read-all { padding: 4px 0; border: 0; background: transparent; color: #147d89; font-size: 12px; }
.read-all:hover:enabled { text-decoration: underline; }
.notification-list { min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
.notification-row { display: grid; grid-template-columns: 36px minmax(0, 1fr) 12px; align-items: start; gap: 12px; width: 100%; padding: 18px 20px; margin: 0; border: 0; border-bottom: 1px solid #f0f2f5; border-radius: 0; text-align: left; color: inherit; background: white; line-height: 1.5; }
.notification-row:last-child { border-bottom: 0; }
.notification-row.urgent { background: #fffafa; }
.notification-row:hover:enabled { background: #f5f8fa; }
.notice-icon { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 10px; font-size: 19px; }
.notice-content { display: flex; flex-direction: column; gap: 7px; min-width: 0; }
.notice-heading { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; }
.order-number { flex: 1 1 155px; min-width: 0; font-size: 14px; font-weight: 650; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.status-label { flex: 0 0 auto; padding: 2px 7px; border-radius: 5px; font-size: 11px; white-space: nowrap; }
.urgent-tone { color: #b83b3b; background: #fcecec; }
.new-tone { color: #167b83; background: #eaf6f5; }
.neutral-tone { color: #667284; background: #f1f3f5; }
.notice-summary { color: #596779; font-size: 13px; overflow-wrap: anywhere; }
.urgent .notice-summary { color: #b83b3b; }
.notice-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; color: #7b8797; font-size: 11px; }
.unread-label { display: inline-flex; align-items: center; gap: 5px; color: #497381; }
.unread-dot { width: 5px; height: 5px; border-radius: 50%; background: #258b98; }
.row-arrow { align-self: center; color: #a7b1bc; font-size: 11px; }
.panel-footer { display: flex; flex: none; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; padding: 13px 20px; border-top: 1px solid #edf0f3; color: #8793a2; font-size: 11px; }
.panel-footer button { padding: 0; border: 0; background: transparent; color: #147d89; font-size: 12px; }
.panel-error { display: flex; flex: none; flex-wrap: wrap; gap: 8px; padding: 12px 20px; background: #fff7ed; color: #945622; font-size: 12px; }
.panel-error button { padding: 0; border: 0; background: transparent; color: inherit; text-decoration: underline; }
.empty-state { display: grid; justify-items: center; gap: 8px; padding: 40px 20px; color: #84909f; font-size: 13px; }
.empty-state i { color: #348e92; font-size: 30px; }
.empty-state strong { color: #465468; font-size: 14px; }
@media (max-width: 600px) {
  .notification-panel { position: fixed; top: 76px; left: 12px; right: 12px; width: auto; max-width: none; max-height: calc(100dvh - 92px); }
  .notification-panel::before { display: none; }
  .panel-header { padding: 16px; }
  .notification-row { grid-template-columns: 30px minmax(0, 1fr) 10px; gap: 10px; padding: 16px; }
  .notice-icon { width: 30px; height: 30px; font-size: 17px; border-radius: 8px; }
  .order-number { flex-basis: 145px; font-size: 13px; }
  .panel-footer { padding: 12px 16px; }
}
</style>
