<script>
import { useCartStore, optionsPrice } from "../store/cart.js"
import { useMemberStore } from "../store/member.js"

export default {
  data() {
    return {
      cartstore: useCartStore(),
      memberstore: useMemberStore(),
      name: "",
      phone: "",
      address: "",
      isSubmitting: false,
      successMsg: "",
      errorMsg: "",
      placedOrderNumber: "",
      deliveryType: "delivery",
      pickupTime: ""
    }
  },
  computed: {
    member() {
      return this.memberstore.user
    },
    pickupTimes() {
      const morning = ["10:30","11:00","11:30","12:00","12:30","13:00","13:30","14:00"]
      const evening = ["17:30","18:00","18:30","19:00","19:30","20:00"]
      return [...morning, ...evening]
    },
    isDelivery() {
      return this.deliveryType === "delivery"
    },
    isBelowDeliveryMin() {
      return this.isDelivery && this.cartstore.totalprice < 500
    }
  },
  methods: {
    changeQty(key, delta) {
      this.cartstore.changqty(key, delta)
    },
    remove(key) {
      this.cartstore.removeFromCart(key)
    },
    clearAll() {
      this.cartstore.clearcart()
    },
    unitPrice(item){
      return (Number(item.price)||0) + optionsPrice(item.options)
    },
    goQuery() {
      this.$router.push({ name: "orderQuery", query: { n: this.placedOrderNumber, phone: this.phone } })
    },
    prefillMember() {
      if (this.member) {
        this.name = this.member.name || ""
        this.phone = this.member.phone || ""
        this.address = this.member.address || ""
      }
    },
    async submitOrder() {
      this.errorMsg = ""
      if (this.cartstore.isEmpty) return
      if (!this.name || !this.phone) {
        this.errorMsg = "請填寫收件人與電話"
        return
      }
      if (this.deliveryType === "delivery") {
        if (!this.address) {
          this.errorMsg = "請填寫配送地址"
          return
        }
        if (this.cartstore.totalprice < 500) {
          this.errorMsg = "金額不足500元，無法進行配送"
          return
        }
      } else {
        if (!this.pickupTime) {
          this.errorMsg = "請選擇取貨時間"
          return
        }
      }
      this.isSubmitting = true
      try {
        const response = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: this.name,
            phone: this.phone,
            address: this.deliveryType === "delivery" ? this.address : "",
            delivery_type: this.deliveryType,
            pickup_time: this.deliveryType === "pickup" ? this.pickupTime : null,
            member_id: this.member ? this.member.id : null,
            items: this.cartstore.cart.map(item => ({
              id: item.id,
              name: item.name,
              price: item.price,
              options: item.options || [],
              qty: item.qty
            }))
          })
        })
        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.message || "送出訂單失敗")
        }
        const result = await response.json()
        this.placedOrderNumber = result.order_number
        this.cartstore.clearcart()
        if (this.member) {
          this.successMsg = `訂單已送出！訂單編號：${result.order_number}，感謝您的購買！`
          setTimeout(() => {
            this.$router.push({ name: "orderQuery", query: { n: result.order_number } })
          }, 1200)
        } else {
          this.successMsg = `訂單已送出！您的訂單編號：${result.order_number}`
        }
      } catch (error) {
        this.errorMsg = error.message || "送出訂單失敗"
      } finally {
        this.isSubmitting = false
      }
    }
  },
  mounted() {
    this.prefillMember()
  }
}
</script>

<template>
  <main class="page">
    <section class="card">
      <div class="cart-header">
        <h2>購物車</h2>
        <button v-if="!cartstore.isEmpty" class="btn btn-sm cart-clear-btn" @click="clearAll">
          清空購物車
        </button>
      </div>

      <div v-if="placedOrderNumber" class="placed-order">
        <p class="placed-title">訂單已送出！</p>
        <p class="placed-number">訂單編號：{{ placedOrderNumber }}</p>
        <p class="placed-hint">請保留訂單編號與手機號碼以利查詢訂單</p>
        <button class="btn" @click="goQuery">訂單查詢</button>
      </div>

      <template v-else-if="cartstore.isEmpty">
        <p class="text-muted" style="text-align:center; padding:40px 0;">
          購物車目前沒有披薩，快去菜單選購吧！
        </p>
      </template>

      <template v-else>
        <div class="cart-layout">
          <div class="cart-col-left">
            <div class="checkout-area">
              <h3 class="checkout-title">結帳資訊</h3>
              <p v-if="member" class="member-hint text-muted">
                已登入會員 <strong>{{ member.name }}</strong>，已自動帶入您的電話與地址
              </p>
              <p v-else class="member-hint text-muted">
                尚未登入，請填寫收件資訊
              </p>

              <p v-if="errorMsg" class="error" style="padding:10px; border-radius:8px; margin-bottom:12px;">
                {{ errorMsg }}
              </p>
              <p v-if="successMsg" class="success" style="padding:10px; border-radius:8px; margin-bottom:12px;">
                {{ successMsg }}
              </p>

              <div class="form-group">
                <label>取貨方式</label>
                <div class="delivery-toggle">
                  <label :class="['delivery-option', { active: !isDelivery }]">
                    <input type="radio" value="pickup" v-model="deliveryType" />
                    <span>到店自取</span>
                  </label>
                  <label :class="['delivery-option', { active: isDelivery }]">
                    <input type="radio" value="delivery" v-model="deliveryType" />
                    <span>配送到家</span>
                  </label>
                </div>
              </div>

              <div class="form-group">
                <label>收件人姓名</label>
                <input type="text" v-model.trim="name" placeholder="請輸入姓名" />
              </div>
              <div class="form-group">
                <label>聯絡電話</label>
                <input type="tel" v-model.trim="phone" placeholder="請輸入電話" />
              </div>

              <div v-if="isDelivery" class="form-group">
                <label>配送地址</label>
                <input type="text" v-model.trim="address" placeholder="請輸入地址" />
                <p v-if="isBelowDeliveryMin" class="delivery-min-hint">
                  金額不足500元，無法進行配送
                </p>
              </div>

              <div v-else class="form-group">
                <label>取貨時間</label>
                <select v-model="pickupTime" class="pickup-select">
                  <option value="" disabled>請選擇取貨時間</option>
                  <option v-for="t in pickupTimes" :key="t" :value="t">{{ t }}</option>
                </select>
                <p class="text-muted pickup-note">可取貨時段：10:30~14:00、17:30~20:00</p>
              </div>

              <button
                class="btn w-100"
                :disabled="isSubmitting || cartstore.isEmpty"
                @click="submitOrder"
              >
                {{ isSubmitting ? "送出中..." : "送出訂單" }}
              </button>
            </div>
          </div>

          <div class="cart-col-right">
            <ul class="cart-list">
              <li v-for="item in cartstore.cart" :key="item.__key" class="cart-item">
                <div class="cart-item-info">
                  <h3>{{ item.name }}</h3>
                  <p class="text-muted">單價: NT${{ item.price.toLocaleString() }}</p>
                  <p v-if="item.options && item.options.length" class="cart-options">
                    <span v-for="opt in item.options" :key="opt.label" class="opt-tag">+{{ opt.label }}<template v-if="opt.price > 0"> (NT${{ opt.price }})</template></span>
                  </p>
                  <p class="text-muted">含配料單價: NT${{ unitPrice(item).toLocaleString() }}</p>
                </div>

                <div class="cart-item-qty">
                  <button class="btn-icon" @click="changeQty(item.__key, -1)">−</button>
                  <span class="qty-value">{{ item.qty }}</span>
                  <button class="btn-icon" @click="changeQty(item.__key, 1)">+</button>
                </div>

                <div class="cart-item-subtotal">
                  NT${{ (unitPrice(item) * item.qty).toLocaleString() }}
                </div>

                <button class="btn-icon cart-remove-btn" @click="remove(item.__key)">✕</button>
              </li>
            </ul>

            <div class="cart-summary">
              <p>
                共 {{ cartstore.totalqty }} 份披薩
              </p>
              <p class="cart-total">
                總金額: NT${{ cartstore.totalprice.toLocaleString() }}
              </p>
            </div>
          </div>
        </div>
      </template>
    </section>
  </main>
</template>

<style scoped>
.cart-layout {
  display: grid;
  grid-template-columns: 2fr 3fr;
  gap: 24px;
  align-items: start;
}

.cart-col-left {
  min-width: 0;
}

.cart-col-right {
  min-width: 0;
}

.cart-clear-btn {
  background: #7B3F00;
  color: white;
  border: 1px solid #7B3F00;
  box-shadow: none;
}

.cart-clear-btn:hover {
  background: #5a2e00;
  border-color: #5a2e00;
}

.cart-remove-btn {
  background: #7B3F00;
  color: white;
  border: 1px solid #7B3F00;
  box-shadow: none;
}

.cart-remove-btn:hover {
  background: #5a2e00;
  border-color: #5a2e00;
}

.cart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.cart-header h2 {
  margin: 0;
}

.cart-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 16px;
  border-bottom: 1px solid #e8e3d9;
  background-color: #faf7f2;
  border-radius: 10px;
  margin-bottom: 8px;
  transition: background 0.2s;
}

.cart-item:hover {
  background-color: #f0ebe1;
}

.cart-item:last-child {
  border-bottom: none;
}

.cart-item-info {
  flex: 1;
}

.cart-item-info h3 {
  margin: 0 0 4px;
  font-size: 18px;
  color: #7B3F00;
}

.cart-item-info p {
  margin: 0;
}

.cart-item-qty {
  display: flex;
  align-items: center;
  gap: 10px;
}

.qty-value {
  min-width: 32px;
  text-align: center;
  font-size: 18px;
  font-weight: 700;
  font-family: 'Playfair Display', serif;
}

.cart-item-subtotal {
  min-width: 120px;
  text-align: right;
  font-size: 18px;
  font-weight: 800;
  color: #7B3F00;
}

.cart-summary {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 2px solid #836539;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.cart-total {
  font-size: 24px;
  font-weight: 800;
  color: #7B3F00;
  font-family: 'Playfair Display', serif;
}

.checkout-area {
  margin-top: 24px;
  padding: 24px;
  border: 1px solid #e8e3d9;
  border-radius: 12px;
  background: #faf7f2;
}

.checkout-title {
  margin: 0 0 8px;
  color: #7B3F00;
  font-size: 20px;
}

.member-hint {
  margin: 0 0 16px;
  font-size: 14px;
}

.form-group {
  margin-bottom: 16px;
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

.placed-order {
  text-align: center;
  padding: 40px 20px;
}

.placed-title {
  font-size: 24px;
  font-weight: 800;
  color: #7B3F00;
  margin: 0 0 12px;
}

.placed-number {
  font-size: 20px;
  font-weight: 700;
  color: #333;
  margin: 0 0 12px;
}

.placed-hint {
  color: #555;
  margin: 0 0 24px;
}

.cart-options {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 6px 0 4px;
}

.opt-tag {
  background: #f5e8d8;
  color: #7B3F00;
  border-radius: 12px;
  padding: 2px 10px;
  font-size: 12px;
}

.delivery-toggle {
  display: flex;
  gap: 10px;
}

.delivery-option {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  color: #555;
  transition: all 0.2s;
}

.delivery-option input {
  display: none;
}

.delivery-option.active {
  border-color: #7B3F00;
  background: #7B3F00;
  color: #fff;
}

.delivery-min-hint {
  color: #ef4444;
  font-size: 13px;
  margin-top: 6px;
}

.pickup-select {
  width: 100%;
  padding: 11px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  background: #fff;
}

.pickup-note {
  margin-top: 6px;
  font-size: 12px;
}

@media (max-width: 900px) {
  .cart-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 576px) {
  .cart-item {
    flex-wrap: wrap;
    gap: 12px;
  }

  .cart-item-subtotal {
    min-width: auto;
    text-align: left;
  }

  .cart-summary {
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
  }
}
</style>
