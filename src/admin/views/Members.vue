<template>
  <section class="admin-page">
    <div class="page-header">
      <h1>會員管理</h1>
      <p>管理系統會員帳號</p>
    </div>

    <div class="toolbar">
      <input type="text" placeholder="搜尋會員..." class="search-input" />
      <button class="btn btn-primary" @click="openAddMember">新增會員</button>
    </div>

    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>姓名</th>
            <th>Email</th>
            <th>電話</th>
            <th>註冊時間</th>
            <th>狀態</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in members" :key="m.id">
            <td>{{ m.id }}</td>
            <td>{{ m.name }}</td>
            <td>{{ m.email }}</td>
            <td>{{ m.phone }}</td>
            <td>{{ m.createdAt }}</td>
            <td><span :class="['status-badge', m.status]">{{ m.statusText }}</span></td>
            <td>
              <button class="icon-btn" @click="toggleStatus(m)" title="切換啟用狀態">✎</button>
              <button class="icon-btn danger" @click="deleteMember(m.id)" title="刪除">🗑</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="showAddModal" class="modal-overlay">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="add-member-title">
        <h3 id="add-member-title">新增會員</h3>
        <form @submit.prevent="saveMember">
          <div class="form-row">
            <div class="form-group">
              <label for="member-name">姓名</label>
              <input id="member-name" v-model.trim="form.name" type="text" maxlength="100" required />
            </div>
            <div class="form-group">
              <label for="member-phone">電話</label>
              <input id="member-phone" v-model.trim="form.phone" type="tel" maxlength="30" />
            </div>
          </div>
          <div class="form-group">
            <label for="member-email">Email</label>
            <input id="member-email" v-model.trim="form.email" type="email" required />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="member-password">密碼</label>
              <input id="member-password" v-model="form.password" type="password" minlength="6" required />
              <small>至少 6 碼</small>
            </div>
            <div class="form-group">
              <label for="member-status">狀態</label>
              <select id="member-status" v-model="form.status">
                <option value="active">啟用</option>
                <option value="inactive">停用</option>
              </select>
            </div>
          </div>
          <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" @click="closeAddMember">取消</button>
            <button type="submit" class="btn btn-primary" :disabled="isSaving">{{ isSaving ? '儲存中…' : '新增' }}</button>
          </div>
        </form>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { api } from '../../services/api'

const members = ref([])
const showAddModal = ref(false)
const isSaving = ref(false)
const formError = ref('')
const emptyForm = () => ({ name: '', email: '', phone: '', password: '', status: 'active' })
const form = ref(emptyForm())
const isFormDirty = () => Object.entries(form.value).some(([key, value]) => value !== emptyForm()[key])

const loadMembers = async () => {
  members.value = await api('/members')
  members.value.forEach(m => { m.statusText = m.status === 'active' ? '啟用' : '停用'; m.createdAt = new Date(m.createdAt).toLocaleDateString('zh-TW') })
}
const handleKeydown = (event) => {
  if (event.key === 'Escape' && showAddModal.value) closeAddMember()
}
onMounted(() => {
  loadMembers()
  window.addEventListener('keydown', handleKeydown)
})
onUnmounted(() => window.removeEventListener('keydown', handleKeydown))

const openAddMember = () => {
  form.value = emptyForm()
  formError.value = ''
  showAddModal.value = true
}

const closeAddMember = () => {
  if (isSaving.value) return
  if (isFormDirty() && !confirm('尚未儲存新增會員資料，確定要離開嗎？')) return
  showAddModal.value = false
}

const saveMember = async () => {
  formError.value = ''
  isSaving.value = true
  try {
    await api('/members', { method: 'POST', body: JSON.stringify(form.value) })
    await loadMembers()
    showAddModal.value = false
  } catch (error) {
    formError.value = error.message || '新增會員失敗'
  } finally {
    isSaving.value = false
  }
}

const toggleStatus = async (member) => {
  await api(`/members/${member.id}`, { method: 'PUT', body: JSON.stringify({ ...member, status: member.status === 'active' ? 'inactive' : 'active' }) })
  await loadMembers()
}
const deleteMember = async (id) => {
  if (!confirm('確定要刪除這位會員嗎？')) return
  await api(`/members/${id}`, { method: 'DELETE' })
  await loadMembers()
}
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

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.search-input {
  flex: 1;
  max-width: 320px;
  height: 42px;
  padding: 0 16px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
}

.search-input:focus {
  outline: none;
  border-color: #35c1d0;
  box-shadow: 0 0 0 3px rgba(53, 193, 208, 0.15);
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

.status-badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

.status-badge.active {
  background: #dcfce7;
  color: #166534;
}

.status-badge.inactive {
  background: #fee2e2;
  color: #991b1b;
}

.icon-btn {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  font-size: 14px;
  margin-right: 6px;
}

.icon-btn:hover {
  background: #f1f5f9;
}

.icon-btn.danger:hover {
  background: #fee2e2;
  color: #ef4444;
}

.btn-primary {
  height: 42px;
  padding: 0 20px;
  background: #35c1d0;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-primary:hover {
  background: #2aaeb9;
}

.btn-primary:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.4);
}

.modal {
  width: 100%;
  max-width: 520px;
  padding: 28px;
  background: white;
  border-radius: 14px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2);
}

.modal h3 {
  margin: 0 0 20px;
  color: #273746;
  font-size: 20px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-group {
  margin-bottom: 18px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  color: #374151;
  font-size: 13px;
  font-weight: 600;
}

.form-group input,
.form-group select {
  box-sizing: border-box;
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font: inherit;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: #35c1d0;
  box-shadow: 0 0 0 3px rgba(53, 193, 208, 0.15);
}

.form-group small {
  display: block;
  margin-top: 6px;
  color: #64748b;
  font-size: 12px;
}

.form-error {
  margin: 0 0 16px;
  color: #dc2626;
  font-size: 14px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.btn-secondary {
  height: 42px;
  padding: 0 20px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: white;
  color: #475569;
  cursor: pointer;
  font-weight: 600;
}

.btn-secondary:hover {
  background: #f8fafc;
}

@media (max-width: 560px) {
  .form-row {
    grid-template-columns: 1fr;
    gap: 0;
  }
}
</style>
