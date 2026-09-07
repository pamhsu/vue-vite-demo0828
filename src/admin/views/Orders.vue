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
            <!-- <th>商品</th> -->
            <th>總金額</th>
            <th>訂單時間</th>
            <th>狀態</th>
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
              <!-- <td>
                <div v-for="(item, idx) in order.items" :key="idx" class="order-item">
                  <div>{{ item.name }} × {{ item.qty }}</div>
                  <div v-if="item.options && item.options.length" class="order-opts">
                    <span v-for="opt in item.options" :key="opt.label">＋{{ opt.label }}<template v-if="opt.price > 0"> NT${{ opt.price }}</template></span>
                  </div>
                </div>
              </td> -->
              <td class="cell-total">NT${{ Number(order.total).toLocaleString() }}</td>
              <td>{{ formatDate(order.createdAt) }}</td>
              <td>
                <span :class="['status-badge', order.status]">{{ statusText(order.status) }}</span>
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
  </section>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../../services/api'

const orders = ref([])
const allOrders = ref([])
const subSelections = ref({})
const remarkInputs = ref({})
const filters = ref({ orderNumber: '', orderDate: '', status: '', phone: '' })

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

onMounted(loadOrders)
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
  overflow: hidden;
}

.data-table {
  width: 100%;
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
</style>
