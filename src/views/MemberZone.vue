<script>
import { useMemberStore } from "../store/member.js"

export default {
  data() {
    return {
      memberstore: useMemberStore(),
      editing: false,
      name: "",
      phone: "",
      address: "",
      showPwdModal: false,
      oldPassword: "",
      newPassword: "",
      confirmPassword: "",
      editMsg: "",
      editErr: "",
      pwdMsg: "",
      pwdErr: "",
      saving: false,
      pwdSaving: false
    }
  },
  computed: {
    member() {
      return this.memberstore.user
    }
  },
  methods: {
    startEdit() {
      this.name = this.member.name || ""
      this.phone = this.member.phone || ""
      this.address = this.member.address || ""
      this.editMsg = ""
      this.editErr = ""
      this.editing = true
    },
    cancelEdit() {
      this.editing = false
    },
    async saveEdit() {
      this.editMsg = ""
      this.editErr = ""
      if (!this.name) {
        this.editErr = "姓名不可為空白"
        return
      }
      this.saving = true
      const result = await this.memberstore.updateProfile({ name: this.name, phone: this.phone, address: this.address })
      this.saving = false
      if (result.success) {
        this.editMsg = result.message
        this.editing = false
      } else {
        this.editErr = result.message
      }
    },
    openPwdModal() {
      this.oldPassword = ""
      this.newPassword = ""
      this.confirmPassword = ""
      this.pwdMsg = ""
      this.pwdErr = ""
      this.showPwdModal = true
    },
    closePwdModal() {
      this.showPwdModal = false
    },
    async submitPwd() {
      this.pwdMsg = ""
      this.pwdErr = ""
      if (!this.oldPassword || !this.newPassword) {
        this.pwdErr = "請填寫原密碼與新密碼"
        return
      }
      if (this.newPassword.length < 6) {
        this.pwdErr = "新密碼至少需 6 碼"
        return
      }
      if (this.newPassword !== this.confirmPassword) {
        this.pwdErr = "確認密碼與新密碼不一致"
        return
      }
      this.pwdSaving = true
      const result = await this.memberstore.changePassword(this.oldPassword, this.newPassword)
      this.pwdSaving = false
      if (result.success) {
        this.pwdMsg = result.message
        setTimeout(() => {
          this.closePwdModal()
        }, 1200)
      } else {
        this.pwdErr = result.message
      }
    }
  }
}
</script>

<template>
  <main class="page">
    <section class="card member-card">
      <h2>會員專區</h2>
      <p class="text-muted">歡迎回來，{{ member ? member.name : '' }}</p>

      <div v-if="editMsg" class="success" style="padding:10px; border-radius:8px; margin-bottom:16px;">
        {{ editMsg }}
      </div>
      <div v-if="editErr" class="error" style="padding:10px; border-radius:8px; margin-bottom:16px;">
        {{ editErr }}
      </div>

      <div class="profile-list">
        <div class="profile-row">
          <span class="profile-label">姓名</span>
          <input v-if="editing" type="text" v-model.trim="name" class="profile-input" />
          <span v-else class="profile-value">{{ member.name }}</span>
        </div>
        <div class="profile-row">
          <span class="profile-label">Email</span>
          <span class="profile-value">{{ member.email }}</span>
        </div>
        <div class="profile-row">
          <span class="profile-label">電話</span>
          <input v-if="editing" type="tel" v-model.trim="phone" class="profile-input" />
          <span v-else class="profile-value">{{ member.phone || '-' }}</span>
        </div>
        <div class="profile-row">
          <span class="profile-label">地址</span>
          <input v-if="editing" type="text" v-model.trim="address" class="profile-input" />
          <span v-else class="profile-value">{{ member.address || '-' }}</span>
        </div>
      </div>

      <div class="member-actions">
        <template v-if="editing">
          <button class="btn" :disabled="saving" @click="saveEdit">{{ saving ? '儲存中...' : '儲存' }}</button>
          <button class="btn btn-secondary" @click="cancelEdit">取消</button>
        </template>
        <template v-else>
          <button class="btn" :disabled="saving" @click="startEdit">編輯資料</button>
          <button class="btn btn-secondary" @click="openPwdModal">更改密碼</button>
        </template>
      </div>
    </section>

    <Teleport to="body">
      <div v-if="showPwdModal" class="modal-overlay" @click.self="closePwdModal">
        <div class="modal">
          <h3>更改密碼</h3>
          <div v-if="pwdMsg" class="success" style="padding:10px; border-radius:8px; margin-bottom:16px;">
            {{ pwdMsg }}
          </div>
          <div v-if="pwdErr" class="error" style="padding:10px; border-radius:8px; margin-bottom:16px;">
            {{ pwdErr }}
          </div>
          <div class="form-group">
            <label>原密碼</label>
            <input type="password" v-model="oldPassword" placeholder="請輸入原密碼" />
          </div>
          <div class="form-group">
            <label>新密碼</label>
            <input type="password" v-model="newPassword" placeholder="請輸入新密碼（至少 6 碼）" />
          </div>
          <div class="form-group">
            <label>確認新密碼</label>
            <input type="password" v-model="confirmPassword" placeholder="請再次輸入新密碼" />
          </div>
          <div class="modal-actions">
            <button class="btn btn-secondary" @click="closePwdModal">取消</button>
            <button class="btn" :disabled="pwdSaving" @click="submitPwd">{{ pwdSaving ? '送出中...' : '確認更改' }}</button>
          </div>
        </div>
      </div>
    </Teleport>
  </main>
</template>

<style scoped>
.member-card {
  max-width: 600px;
  margin: 40px auto;
}

.profile-list {
  margin: 20px 0;
}

.profile-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 0;
  border-bottom: 1px solid #e8e3d9;
}

.profile-label {
  font-weight: 600;
  color: #555;
  min-width: 80px;
}

.profile-value {
  color: #333;
}

.profile-input {
  flex: 1;
  box-sizing: border-box;
  padding: 10px 14px;
  border: 1px solid #d8d0c2;
  border-radius: 8px;
  font: inherit;
}

.profile-input:focus {
  outline: none;
  border-color: #7B3F00;
  box-shadow: 0 0 0 3px rgba(123, 63, 0, 0.15);
}

.member-actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}

.btn-secondary {
  border: 1px solid #7B3F00;
  background: #fff;
  color: #7B3F00;
}

.btn-secondary:hover {
  background: #f0ebe1;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 16px;
}

.modal {
  width: 100%;
  max-width: 420px;
  background: #fff;
  border-radius: 12px;
  padding: 24px;
}

.modal h3 {
  margin: 0 0 20px;
  color: #7B3F00;
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

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
}
</style>
