<script>
import { useMemberStore } from "../store/member.js"

export default {
  data() {
    return {
      memberstore: useMemberStore(),
      orderNumber: "",
      phone: "",
      orders: [],
      selectedOrder: null,
      isLoading: false,
      errMsg: "",
      loaded: false,
      prefilled: false
    }
  },
  computed: {
    member() {
      return this.memberstore.user
    }
  },
  methods: {
    statusText(status) {
      return ({ pending: '待處理', processing: '處理中', completed: '已完成', cancelled: '已取消' })[status] || status
    },
    subStatusText(stage) {
      return ({
        pending: '訂單送出',
        submitted: '訂單送出',
        received: '接收訂單',
        preparing: '處理中',
        ready: '商品已完成',
        delivering: '配送中',
        delivered: '訂單完成',
        cancelled: '取消訂單'
      })[stage] || stage
    },
    formatDate(d) {
      return d ? new Date(d).toLocaleString('zh-TW') : ''
    },
    optPrice(item) {
      return (Array.isArray(item.options) ? item.options : []).reduce((s, o) => s + (Number(o.price) || 0), 0)
    },
    itemTotal(item) {
      return ((Number(item.price) || 0) + this.optPrice(item)) * item.qty
    },
    deliveryLine(order) {
      if (order.deliveryType === 'pickup') {
        return `到店自取（取貨時間：${order.pickupTime || '—'}）`
      }
      return `配送到家${order.address ? `：${order.address}` : ''}`
    },
    parseOrder(order) {
      let items = []
      try { items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items } catch (e) { items = [] }
      let history = order.statusHistory
      if (typeof history === 'string') { try { history = JSON.parse(history) } catch (e) { history = [] } }
      if (!Array.isArray(history)) history = []
      return { ...order, items, statusHistory: history }
    },
    openDetail(order) {
      this.selectedOrder = order
    },
    closeDetail() {
      this.selectedOrder = null
    },
    historyEntries(order) {
      const progress = ['submitted', 'received', 'preparing', 'ready', 'delivering', 'delivered']
      const base = order.statusHistory && order.statusHistory.length
        ? order.statusHistory
        : null
      if (!base && order.subStatus !== 'cancelled') {
        return [{ stage: order.subStatus || order.status || 'submitted', time: order.createdAt || '' }]
      }
      if (!base) {
        return [{ stage: 'submitted', time: order.createdAt || '' }, { stage: 'cancelled', time: order.createdAt || '' }]
      }
      const known = new Map()
      base.forEach(item => { if (item && item.stage) known.set(item.stage, item.time) })
      const lastReal = base[base.length - 1]
      const result = []
      let lastTime = order.createdAt ? new Date(order.createdAt).toISOString() : (lastReal ? (lastReal.time || '') : '')
      const finalStage = lastReal ? lastReal.stage : (order.subStatus || order.status || 'submitted')
      const pushStage = (s) => {
        const t = known.get(s) || lastTime
        result.push({ stage: s, time: t })
        if (known.has(s)) lastTime = known.get(s)
      }
      if (finalStage === 'cancelled') {
        const lastProgress = order.subStatus && progress.includes(order.subStatus)
          ? order.subStatus
          : (known.has('submitted') ? 'submitted' : progress[0])
        progress.slice(0, progress.indexOf(lastProgress) + 1).forEach(pushStage)
        pushStage('cancelled')
      } else {
        const idx = progress.indexOf(finalStage)
        if (idx < 0) return base
        progress.slice(0, idx + 1).forEach(pushStage)
      }
      return result
    },
    async loadMemberOrders() {
      if (!this.member) return
      this.isLoading = true
      this.errMsg = ""
      this.loaded = true
      try {
        const response = await fetch(`/api/orders/member/${this.member.id}`)
        const data = await response.json()
        if (!response.ok) throw new Error(data.message || '查詢失敗')
        this.orders = data.map(this.parseOrder)
      } catch (error) {
        this.errMsg = error.message
      } finally {
        this.isLoading = false
      }
    },
    async queryAsGuest() {
      this.errMsg = ""
      this.orders = []
      if (!this.orderNumber || !this.phone) {
        this.errMsg = "請填寫訂單編號與手機號碼"
        return
      }
      this.isLoading = true
      this.loaded = true
      try {
        const response = await fetch(`/api/orders/guest?orderNumber=${encodeURIComponent(this.orderNumber)}&phone=${encodeURIComponent(this.phone)}`)
        const data = await response.json()
        if (!response.ok) throw new Error(data.message || '查詢失敗')
        if (data.length > 0 && data[0].member_id) {
          this.$router.push({ name: "login", query: { redirect: "orderQuery" } })
          return
        }
        this.orders = data.map(this.parseOrder)
      } catch (error) {
        this.errMsg = error.message
      } finally {
        this.isLoading = false
      }
    }
  },
  mounted() {
    if (this.member) {
      this.loadMemberOrders()
    } else if (this.$route.query.n) {
      this.orderNumber = this.$route.query.n
      this.phone = this.$route.query.phone || ""
      this.prefilled = true
      this.queryAsGuest()
    }
  }
}
</script>

<template>
  <main class="page">
    <section class="card">
      <h2>訂單查詢</h2>

      <template v-if="member">
        <p class="text-muted">會員 <strong>{{ member.name }}</strong> 的歷史訂單</p>
        <p v-if="errMsg" class="error" style="padding:10px; border-radius:8px; margin-top:12px;">{{ errMsg }}</p>
        <div v-if="isLoading" class="text-muted" style="text-align:center; padding:30px 0;">載入中...</div>
        <div v-else-if="!orders.length && loaded" class="text-muted" style="text-align:center; padding:30px 0;">目前沒有訂單紀錄</div>
        <ul v-else class="order-list">
          <li v-for="order in orders" :key="order.id" class="order-item clickable" @click="openDetail(order)">
            <div class="order-head">
              <span class="order-number">{{ order.order_number }}</span>
              <span :class="['status-badge', order.status]">{{ statusText(order.status) }}</span>
            </div>
            <p class="order-time">下單時間：{{ formatDate(order.createdAt) }}</p>
            <p class="order-total">合計：NT${{ Number(order.total).toLocaleString() }}</p>
            <p class="order-address">{{ deliveryLine(order) }}</p>
          </li>
        </ul>
      </template>

      <template v-else>
        <p class="text-muted">請輸入訂單編號與手機號碼查詢訂單</p>
        <p v-if="errMsg" class="error" style="padding:10px; border-radius:8px;">{{ errMsg }}</p>
        <div class="form-group">
          <label>訂單編號</label>
          <input type="text" v-model.trim="orderNumber" placeholder="例如 202609031521001" :disabled="prefilled" />
        </div>
        <div class="form-group">
          <label>手機號碼</label>
          <input type="tel" v-model.trim="phone" placeholder="請輸入下單時的手機號碼" />
        </div>
        <button class="btn w-100" :disabled="isLoading" @click="queryAsGuest">{{ isLoading ? "查詢中..." : "查詢訂單" }}</button>

        <div v-if="loaded && !isLoading" style="margin-top:20px;">
          <p v-if="!orders.length" class="text-muted" style="text-align:center; padding:20px 0;">查無訂單資料</p>
          <ul v-else class="order-list">
            <li v-for="order in orders" :key="order.id" class="order-item clickable" @click="openDetail(order)">
              <div class="order-head">
                <span class="order-number">{{ order.order_number }}</span>
                <span :class="['status-badge', order.status]">{{ statusText(order.status) }}</span>
              </div>
              <p class="order-time">下單時間：{{ formatDate(order.createdAt) }}</p>
              <p class="order-total">合計：NT${{ Number(order.total).toLocaleString() }}</p>
              <p class="order-address">{{ deliveryLine(order) }}</p>
            </li>
          </ul>
        </div>
      </template>
    </section>

    <div v-if="selectedOrder" class="modal-mask" @click.self="closeDetail">
      <div class="modal">
        <div class="modal-head">
          <h3>訂單詳情</h3>
          <button class="modal-close" @click="closeDetail">✕</button>
        </div>
        <div class="modal-body">
          <div class="detail-row">
            <span class="detail-label">訂單編號</span>
            <span class="detail-value">#{{ selectedOrder.order_number || selectedOrder.id }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">訂單狀態</span>
            <span><span :class="['status-badge', selectedOrder.status]">{{ statusText(selectedOrder.status) }}</span></span>
          </div>
          <div class="detail-row">
            <span class="detail-label">下單時間</span>
            <span class="detail-value">{{ formatDate(selectedOrder.createdAt) }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">收件人</span>
            <span class="detail-value">{{ selectedOrder.name }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">電話</span>
            <span class="detail-value">{{ selectedOrder.phone }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">取貨方式</span>
            <span class="detail-value">{{ deliveryLine(selectedOrder) }}</span>
          </div>

          <div class="detail-section">
            <div class="detail-section-title">商品內容</div>
            <div v-for="(item, idx) in selectedOrder.items" :key="idx" class="order-line">
              <div>
                {{ item.name }} × {{ item.qty }} - NT${{ itemTotal(item).toLocaleString() }}
                <div v-if="item.options && item.options.length" class="order-opts">
                  <span v-for="opt in item.options" :key="opt.label">＋{{ opt.label }}<template v-if="opt.price > 0"> NT${{ opt.price }}</template></span>
                </div>
              </div>
            </div>
            <p class="order-total">合計：NT${{ Number(selectedOrder.total).toLocaleString() }}</p>
          </div>

          <div class="detail-section">
            <div class="detail-section-title">狀態紀錄</div>
            <ul class="history-list">
              <li v-for="(entry, idx) in historyEntries(selectedOrder)" :key="idx" class="history-item">
                <span class="history-stage">{{ subStatusText(entry.stage) }}</span>
                <span class="history-time">{{ entry.time ? formatDate(entry.time) : '—' }}</span>
              </li>
            </ul>
            <!-- <p v-if="selectedOrder.remark" class="cancel-remark">取消備註：{{ selectedOrder.remark }}</p> -->
          </div>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.card {
  max-width: 600px;
  margin: 40px auto;
}

.order-list {
  list-style: none;
  margin: 20px 0 0;
  padding: 0;
}

.order-item {
  border: 1px solid #e8e3d9;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
  background: #faf7f2;
}

.clickable {
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.clickable:hover {
  border-color: #7B3F00;
  box-shadow: 0 2px 10px rgba(123, 63, 0, 0.12);
}

.order-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.order-number {
  font-weight: 700;
  color: #7B3F00;
}

.order-time {
  color: #888;
  font-size: 13px;
  margin: 0 0 8px;
}

.order-line {
  font-size: 14px;
  color: #444;
  padding: 3px 0;
}

.order-opts {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}

.order-opts span {
  background: #f5e8d8;
  color: #7B3F00;
  border-radius: 12px;
  padding: 1px 10px;
  font-size: 12px;
}

.order-total {
  font-weight: 700;
  color: #7B3F00;
  margin: 8px 0 4px;
}

.order-address {
  color: #555;
  font-size: 13px;
  margin: 0;
}

.status-badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
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

.form-group {
  margin: 16px 0;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.form-group input {
  width: 100%;
  box-sizing: border-box;
  padding: 12px 14px;
  border: 1px solid #d8d0c2;
  border-radius: 8px;
  font: inherit;
}

.form-group input:focus {
  outline: none;
  border-color: #7B3F00;
  box-shadow: 0 0 0 3px rgba(123, 63, 0, 0.15);
}

.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 1000;
}

.modal {
  background: white;
  border-radius: 14px;
  width: 100%;
  max-width: 520px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #e8e3d9;
}

.modal-head h3 {
  margin: 0;
  color: #273746;
}

.modal-close {
  border: none;
  background: transparent;
  font-size: 16px;
  cursor: pointer;
  color: #64748b;
}

.modal-close:hover {
  color: #ef4444;
}

.modal-body {
  padding: 20px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  font-size: 14px;
}

.detail-label {
  color: #888;
}

.detail-value {
  color: #333;
  text-align: right;
}

.detail-section {
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid #e8e3d9;
}

.detail-section-title {
  font-size: 13px;
  font-weight: 600;
  color: #7B3F00;
  margin-bottom: 8px;
}

.history-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.history-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px dashed #e8e3d9;
  font-size: 14px;
}

.history-item:last-child {
  border-bottom: none;
}

.history-stage {
  font-weight: 600;
  color: #333;
}

.history-time {
  color: #888;
  font-size: 13px;
}

.cancel-remark {
  margin-top: 10px;
  font-size: 13px;
  color: #8b1a1a;
  white-space: pre-wrap;
}
</style>
