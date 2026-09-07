<script>
import { useMemberStore } from "../store/member.js"

export default {
  data() {
    return {
      memberstore: useMemberStore(),
      email: "",
      password: "",
      errorMsg: "",
      successMsg: "",
      disabledMsg: "",
      countdown: 0
    }
  },
  methods: {
    async handleLogin() {
      this.errorMsg = ""
      this.successMsg = ""
      this.disabledMsg = ""

      if (!this.email || !this.password) {
        this.errorMsg = "請填寫所有欄位"
        return
      }

      const result = await this.memberstore.login(this.email, this.password)
      if (result.success) {
        this.successMsg = result.message
        setTimeout(() => {
          this.$router.push(this.$route.query.redirect ? { name: this.$route.query.redirect } : "/")
        }, 800)
      } else if (result.disabled) {
        this.disabledMsg = result.message
        this.startCountdown()
      } else {
        this.errorMsg = result.message
      }
    },
    startCountdown() {
      this.countdown = 10
      const timer = setInterval(() => {
        this.countdown -= 1
        if (this.countdown <= 0) {
          clearInterval(timer)
          this.$router.push("/")
        }
      }, 1000)
    }
  }
}
</script>

<template>
  <main class="page">
    <section class="card" style="max-width: 450px; margin: 60px auto;">
      <h2>會員登入</h2>

      <p v-if="errorMsg" class="error" style="padding:10px; border-radius:8px; margin-bottom:16px;">
        {{ errorMsg }}
      </p>
      <p v-if="successMsg" class="success" style="padding:10px; border-radius:8px; margin-bottom:16px;">
        {{ successMsg }}
      </p>
      <p v-if="disabledMsg" class="error" style="padding:10px; border-radius:8px; margin-bottom:16px;">
        {{ disabledMsg }}（將於 {{ countdown }} 秒後跳轉回首頁）
      </p>

      <div class="form-group">
        <label>帳號（Email）</label>
        <input type="email" v-model="email" placeholder="請輸入 Email" />
      </div>
      <div class="form-group">
        <label>密碼</label>
        <input type="password" v-model="password" placeholder="請輸入密碼" />
      </div>
      <button class="btn w-100" :disabled="countdown > 0" @click="handleLogin">登入</button>
      <p class="text-center mt-2">
        還沒有帳號？
        <RouterLink to="/register" style="color: #73612C; font-weight: 700;">立即註冊</RouterLink>
      </p>
    </section>
  </main>
</template>
