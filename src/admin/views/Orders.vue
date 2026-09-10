<template>
  <section class="admin-page">
    <div class="page-header">
      <h1>訂單管理</h1>
      <p>管理會員訂單</p>
      <button class="refresh-btn" @click="loadOrders" title="重新整理">🔄 重新整理</button>
    </div>

    <div class="filter-bar">
      <input type="text" class="filter-input" v-model.trim="filters.orderNumber" placeholder="訂單編號" @keyup.enter="applyFilters" />
      <input type="date" class="filter-input" v-model="filters.orderDate"  />
      <select class="filter-input" v-model="filters.status" >
        <option value="">全部狀態</option>
        <option value="pending">待處理</option>
        <option value="processing">處理中</option>
        <option value="completed">已完成</option>
        <option value="cancelled">已取消</option>
      </select>
      <input type="text" class="filter-input" v-model.trim="filters.phone" placeholder="手機號碼" @keyup.enter="applyFilters" />
      <button class="filter-btn" @click="applyFilters">查詢</button>
      <button class="filter-btn ghost" @click="resetFilters">清除</button>
    </div>

    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th>訂單編號</th>
            <th>收件人</th>
            <th>電話</th>
            <th>取貨方式</th>
            <th>商品摘要</th>
            <th>總金額</th>
            <th>訂單時間</th>
            <th>狀態</th>
            <th>明細</th>
            <th>操作</th>
            <th>刪除</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="order in orders" :key="order.id">
            <tr>
              <td>#{{ order.order_number || order.id }}</td>
              <td>{{ order.name }}</td>
              <td>{{ order.phone }}</td>
              <td class="cell-address">{{ deliveryLine(order) }}</td>
              <td class="cell-product-summary">
                <strong>{{ productSummary(order) }}</strong>
                <small v-if="order.items.length > 1">＋其他 {{ order.items.length - 1 }} 項</small>
              </td>
              <td class="cell-total">NT${{ Number(order.total).toLocaleString() }}</td>
              <td>{{ formatDate(order.createdAt) }}</td>
              <td>
                <span :class="['status-badge', order.status]">{{ statusText(order.status) }}</span>
              </td>
              <td>
                <button class="detail-btn" @click="openOrderDetail(order)"><i class="bi bi-receipt"></i> 明細</button>
              </td>
              <td>
                <div class="ops-col">
                  <div v-if="!locked(order)" class="ops-cell">
                    <select class="status-select" :value="pendingSelection(order)" @change="selectSub(order, $event)">
                      <option value="submitted" :disabled="!canSelect(order, 'submitted')">訂單送出</option>
                      <option value="received" :disabled="!canSelect(order, 'received')">接收訂單</option>
                      <option value="preparing" :disabled="!canSelect(order, 'preparing')">處理中</option>
                      <option value="ready" :disabled="!canSelect(order, 'ready')">商品已完成</option>
                      <option v-if="order.deliveryType === 'delivery'" value="delivering" :disabled="!canSelect(order, 'delivering')">配送中</option>
                      <option value="delivered" :disabled="!canSelect(order, 'delivered')">訂單完成</option>
                      <option value="cancelled">取消訂單</option>
                    </select>
                    <button class="confirm-btn" @click="confirmStatus(order)">確認</button>
                  </div>
                  <div v-else class="locked-status">
                    <span :class="['status-badge', order.status]">{{ subStatusText(pendingSelection(order)) }}</span>
                  </div>
                  <div v-if="!locked(order) && pendingSelection(order) === 'cancelled'" class="remark-box">
                    <textarea class="remark-input" :value="remarkInput(order)" @input="setRemark(order, $event)" rows="2" placeholder="請輸入取消備註"></textarea>
                  </div>
                  <div v-if="order.remark" class="cancel-remark">取消備註：{{ order.remark }}</div>
                </div>
              </td>
              <td>
                <button class="icon-btn danger" @click="deleteOrder(order.id)" title="刪除此訂單">🗑</button>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
      <div v-if="!orders.length" class="empty">目前沒有訂單</div>
    </div>

    <Teleport to="body">
      <div v-if="selectedOrder" class="order-drawer-mask" @click.self="closeOrderDetail">
        <aside class="order-drawer" role="dialog" aria-modal="true" aria-labelledby="order-detail-title">
          <header class="drawer-header">
            <div>
              <span class="drawer-kicker">訂單明細</span>
              <h2 id="order-detail-title">#{{ selectedOrder.order_number || selectedOrder.id }}</h2>
            </div>
            <button class="drawer-close" type="button" aria-label="關閉訂單明細" @click="closeOrderDetail">×</button>
          </header>

          <div class="drawer-body">
            <div class="drawer-status-row">
              <span :class="['status-badge', selectedOrder.status]">{{ statusText(selectedOrder.status) }}</span>
              <time>{{ formatDate(selectedOrder.createdAt) }}</time>
            </div>

            <section class="drawer-section customer-info">
              <h3>收件資訊</h3>
              <div class="info-grid">
                <div><span>收件人</span><strong>{{ selectedOrder.name }}</strong></div>
                <div><span>電話</span><strong>{{ selectedOrder.phone }}</strong></div>
                <div class="wide"><span>取貨方式</span><strong>{{ deliveryLine(selectedOrder) }}</strong></div>
                <div v-if="selectedOrder.deliveryType === 'delivery'" class="wide"><span>配送地址</span><strong>{{ selectedOrder.address || '—' }}</strong></div>
              </div>
            </section>

            <section class="drawer-section">
              <h3>餐點內容</h3>
              <div v-if="!selectedOrder.items.length" class="no-items">此筆訂單沒有商品資料</div>
              <div v-for="(item, index) in selectedOrder.items" :key="`${item.id || item.name}-${index}`" class="drawer-item">
                <div class="drawer-item-main">
                  <strong>{{ item.name || '未命名商品' }} <span>× {{ item.qty || 0 }}</span></strong>
                  <div v-if="item.options?.length" class="drawer-options">
                    <span v-for="(option, optionIndex) in item.options" :key="`${option.label}-${optionIndex}`">{{ option.label }}<template v-if="Number(option.price) > 0"> ＋NT${{ Number(option.price).toLocaleString() }}</template></span>
                  </div>
                </div>
                <strong class="drawer-line-total">NT${{ lineTotal(item).toLocaleString() }}</strong>
              </div>
              <div class="drawer-total"><span>訂單總額</span><strong>NT${{ Number(selectedOrder.total).toLocaleString() }}</strong></div>
            </section>

            <section v-if="selectedOrder.remark" class="drawer-section drawer-remark">
              <h3>取消備註</h3>
              <p>{{ selectedOrder.remark }}</p>
            </section>
          </div>

          <footer class="drawer-footer">
            <button type="button" class="drawer-close-btn" @click="closeOrderDetail">關閉</button>
          </footer>
        </aside>
      </div>
    </Teleport>
  </section>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '../../services/api'

const route = useRoute()
const orders = ref([])
const allOrders = ref([])
const subSelections = ref({})
const remarkInputs = ref({})
const filters = ref({ orderNumber: '', orderDate: '', status: '', phone: '' })
const selectedOrder = ref(null)

const loadOrders = async () => {
  const rows = await api('/orders')
  orders.value = rows.map(o => {
    let items = []
    try { items = typeof o.items === 'string' ? JSON.parse(o.items) : o.items } catch (e) { items = [] }
    let history = o.statusHistory
    if (typeof history === 'string') { try { history = JSON.parse(history) } catch (e) { history = [] } }
    if (!Array.isArray(history)) history = []
    return { ...o, items, statusHistory: history }
  })
  allOrders.value = orders.value
  subSelections.value = Object.fromEntries(orders.value.map(o => [o.id, o.subStatus || o.status || 'submitted']))
  remarkInputs.value = Object.fromEntries(orders.value.map(o => [o.id, o.remark || '']))
  applyFilters()
}

const applyFilters = () => {
  const { orderNumber, orderDate, status, phone } = filters.value
  orders.value = allOrders.value.filter(o => {
    if (orderNumber && !(o.order_number || '').toLowerCase().includes(orderNumber.toLowerCase())) return false
    if (status && o.status !== status) return false
    if (phone && !(o.phone || '').includes(phone)) return false
    if (orderDate) {
      const d = o.createdAt ? new Date(o.createdAt) : null
      if (d && formatDateKey(d) !== orderDate) return false
    }
    return true
  })
}

const resetFilters = () => {
  filters.value = { orderNumber: '', orderDate: '', status: '', phone: '' }
  orders.value = allOrders.value
}

const formatDateKey = (d) => {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const formatDate = (d) => d ? new Date(d).toLocaleString('zh-TW') : ''

const statusText = (status) => ({ pending: '待處理', processing: '處理中', completed: '已完成', cancelled: '已取消' })[status] || status

const subStatusText = (stage) => ({
  submitted: '訂單送出',
  received: '接收訂單',
  preparing: '處理中',
  ready: '商品已完成',
  delivering: '配送中',
  delivered: '訂單完成',
  cancelled: '取消訂單'
})[stage] || stage

const deliveryLine = (order) => {
  if (order.deliveryType === 'pickup') {
    return `到店自取，取貨：${order.pickupTime || '—'}`
  }
  return `配送到家`
}

const productSummary = (order) => {
  const first = order.items?.[0]
  return first ? `${first.name || '未命名商品'} × ${first.qty || 0}` : '沒有商品資料'
}

const optionTotal = (item) => Array.isArray(item.options)
  ? item.options.reduce((total, option) => total + (Number(option.price) || 0), 0)
  : 0

const lineTotal = (item) => ((Number(item.price) || 0) + optionTotal(item)) * (Number(item.qty) || 0)

const openOrderDetail = (order) => { selectedOrder.value = order }
const closeOrderDetail = () => { selectedOrder.value = null }

const stageOrder = ['submitted', 'received', 'preparing', 'ready', 'delivering', 'delivered']

const canSelect = (order, stage) => {
  if (stage === 'cancelled') return true
  const saved = order.subStatus || order.status || 'submitted'
  const curIdx = stageOrder.indexOf(saved)
  const stageIdx = stageOrder.indexOf(stage)
  if (stage === 'delivering' && order.deliveryType !== 'delivery') return false
  return stageIdx >= curIdx
}

const locked = (order) => order.status === 'cancelled' || order.status === 'completed'

const pendingSelection = (order) => subSelections.value[order.id]
const selectSub = (order, event) => { subSelections.value[order.id] = event.target.value }
const remarkInput = (order) => remarkInputs.value[order.id] || ''
const setRemark = (order, event) => { remarkInputs.value[order.id] = event.target.value }

const confirmStatus = async (order) => {
  const sub = subSelections.value[order.id]
  const history = Array.isArray(order.statusHistory) ? [...order.statusHistory] : []
  history.push({ stage: sub, time: new Date().toISOString() })
  await api(`/orders/${order.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      sub_status: sub,
      status_history: history,
      remark: sub === 'cancelled' ? (remarkInputs.value[order.id] || '') : undefined
    })
  })
  await loadOrders()
}

const deleteOrder = async (id) => {
  if (!confirm('確定要刪除這筆訂單嗎？')) return
  await api(`/orders/${id}`, { method: 'DELETE' })
  await loadOrders()
}

const applyNotificationOrder = (orderNumber) => {
  if (!orderNumber) return
  filters.value.orderNumber = String(orderNumber)
  applyFilters()
}

onMounted(async () => {
  if (route.query.order) filters.value.orderNumber = String(route.query.order)
  await loadOrders()
})
watch(() => route.query.order, applyNotificationOrder)
</script>

<style scoped>
.admin-page {
  padding: 24px;
}

.page-header {
  margin-bottom: 28px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
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

.refresh-btn {
  padding: 8px 16px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: white;
  color: #273746;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
}

.refresh-btn:hover {
  background: #f1f5f9;
}

.filter-bar {
  display: flex;
  flex-wrap: nowrap;
  gap: 10px;
  align-items: center;
  margin-bottom: 18px;
  padding: 14px 16px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  overflow-x: auto;
}

.filter-input {
  padding: 8px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font: inherit;
  font-size: 13px;
  background: white;
}

.filter-input[type="text"],
.filter-input[type="date"] {
  width: 150px;
}

.filter-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  background: #273746;
  color: white;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
}

.filter-btn:hover {
  background: #3b4b5c;
}

.filter-btn.ghost {
  background: transparent;
  color: #64748b;
  border: 1px solid #e5e7eb;
}

.filter-btn.ghost:hover {
  background: #f1f5f9;
}

.table-wrapper {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  overflow-x: auto;
}

.data-table {
  width: 100%;
  min-width: 1320px;
  border-collapse: collapse;
}

.data-table th,
.data-table td {
  padding: 14px 18px;
  text-align: left;
  border-bottom: 1px solid #f1f5f9;
  vertical-align: top;
}

.data-table th {
  background: #f8fafc;
  font-weight: 600;
  color: #475569;
  font-size: 13px;
  white-space: nowrap;
}

.data-table td {
  font-size: 14px;
  color: #334155;
}

.data-table tbody tr:hover {
  background: #f8fafc;
}

.data-table tbody tr:last-child td {
  border-bottom: none;
}

.cell-address {
  max-width: 200px;
}

.cell-total {
  font-weight: 700;
  color: #273746;
  white-space: nowrap;
}

.cell-product-summary {
  min-width: 145px;
  line-height: 1.45;
}

.cell-product-summary strong {
  display: block;
  font-size: 13px;
  font-weight: 600;
}

.cell-product-summary small {
  display: block;
  margin-top: 3px;
  color: #64748b;
  font-size: 12px;
}

.detail-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 32px;
  padding: 0 10px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: white;
  color: #475569;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  white-space: nowrap;
}

.detail-btn:hover {
  border-color: #35c1d0;
  background: #eefbfc;
  color: #0e7a8a;
}

.order-item {
  font-size: 13px;
  line-height: 1.5;
}

.order-opts {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 3px;
}

.order-opts span {
  background: #f5e8d8;
  color: #7B3F00;
  border-radius: 10px;
  padding: 0 8px;
  font-size: 11px;
}

.status-badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.status-badge.pending {
  background: #fef9c3;
  color: #854d0e;
}

.status-badge.processing {
  background: #dbeafe;
  color: #1e40af;
}

.status-badge.completed {
  background: #dcfce7;
  color: #166534;
}

.status-badge.cancelled {
  background: #fee2e2;
  color: #991b1b;
}

.status-select {
  padding: 6px 8px;
  width: 100px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font: inherit;
  font-size: 13px;
  margin-right: 6px;
}

.ops-cell {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 6px;
}

.ops-col {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.icon-btn {
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  font-size: 15px;
}

.icon-btn:hover {
  background: #f1f5f9;
}

.icon-btn.danger {
  color: #dc2626;
}

.icon-btn.danger:hover {
  background: #fee2e2;
  color: #b91c1c;
}

.locked-status {
  display: inline-flex;
  align-items: center;
  margin-right: 6px;
}

.confirm-btn {
  padding: 6px 12px;
  height: 34px;
  border: none;
  border-radius: 6px;
  background: #273746;
  color: white;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
}

.confirm-btn:hover {
  background: #3b4b5c;
}

.remark-box {
  margin-top: 8px;
}

.remark-input {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font: inherit;
  font-size: 13px;
  resize: vertical;
}

.cancel-remark {
  margin-top: 8px;
  font-size: 13px;
  color: #8b1a1a;
  white-space: pre-wrap;
}

.empty {
  padding: 40px;
  text-align: center;
  color: #91a1ad;
}

.order-drawer-mask {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  justify-content: flex-end;
  background: rgba(15, 23, 42, 0.42);
}

.order-drawer {
  display: flex;
  width: min(560px, 100vw);
  height: 100%;
  flex-direction: column;
  background: white;
  box-shadow: -18px 0 42px rgba(15, 23, 42, 0.2);
}

.drawer-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 24px 26px 20px;
  border-bottom: 1px solid #e5e7eb;
}

.drawer-kicker {
  display: block;
  margin-bottom: 5px;
  color: #0e7a8a;
  font-size: 13px;
  font-weight: 700;
}

.drawer-header h2 {
  margin: 0;
  color: #273746;
  font-size: 22px;
}

.drawer-close {
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  font-size: 26px;
  line-height: 1;
}

.drawer-close:hover {
  background: #f1f5f9;
  color: #273746;
}

.drawer-body {
  flex: 1;
  overflow-y: auto;
}

.drawer-status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 26px;
  color: #64748b;
  font-size: 13px;
}

.drawer-section {
  margin: 0 26px;
  padding: 20px 0;
  border-top: 1px solid #e5e7eb;
}

.drawer-section h3 {
  margin: 0 0 14px;
  color: #334155;
  font-size: 15px;
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.info-grid div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 5px;
}

.info-grid .wide {
  grid-column: 1 / -1;
}

.info-grid span {
  color: #94a3b8;
  font-size: 12px;
}

.info-grid strong {
  color: #334155;
  font-size: 14px;
  overflow-wrap: anywhere;
}

.drawer-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding: 14px 0;
  border-bottom: 1px dashed #e5e7eb;
}

.drawer-item-main {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 8px;
}

.drawer-item-main > strong {
  color: #334155;
  font-size: 14px;
}

.drawer-item-main > strong span {
  color: #64748b;
  font-weight: 500;
}

.drawer-options {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.drawer-options span {
  padding: 3px 8px;
  border-radius: 99px;
  background: #f1f5f9;
  color: #475569;
  font-size: 11px;
}

.drawer-line-total {
  flex: 0 0 auto;
  color: #334155;
  font-size: 13px;
}

.drawer-total {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding-top: 18px;
  color: #475569;
  font-size: 14px;
}

.drawer-total strong {
  color: #0e7a8a;
  font-size: 22px;
}

.drawer-remark {
  padding: 14px;
  border: none;
  border-radius: 8px;
  background: #fff7ed;
  color: #9a3412;
}

.drawer-remark h3 {
  margin-bottom: 7px;
  color: #9a3412;
}

.drawer-remark p {
  margin: 0;
  font-size: 13px;
  white-space: pre-wrap;
}

.no-items {
  padding: 18px;
  border-radius: 8px;
  background: #f8fafc;
  color: #94a3b8;
  text-align: center;
  font-size: 13px;
}

.drawer-footer {
  padding: 16px 26px;
  border-top: 1px solid #e5e7eb;
  text-align: right;
}

.drawer-close-btn {
  height: 38px;
  padding: 0 18px;
  border: 1px solid #cbd5e1;
  border-radius: 7px;
  background: white;
  color: #475569;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
}

.drawer-close-btn:hover {
  background: #f8fafc;
}

@media (max-width: 600px) {
  .drawer-header,
  .drawer-status-row,
  .drawer-footer {
    padding-right: 18px;
    padding-left: 18px;
  }

  .drawer-section {
    margin-right: 18px;
    margin-left: 18px;
  }

  .info-grid {
    grid-template-columns: 1fr;
  }

  .info-grid .wide {
    grid-column: auto;
  }
}
</style>
