<template>
  <section class="admin-page">
    <div class="page-header">
      <h1>商品管理</h1>
      <p>管理菜單商品與分類</p>
    </div>

    <div class="toolbar">
      <div class="filter-group">
        <select class="filter-select" v-model="selectedCategory">
          <option value="">全部分類</option>
          <option value="經典口味">經典口味</option>
          <option value="豪華系列">豪華系列</option>
          <option value="起司系列">起司系列</option>
          <option value="素食">素食</option>
        </select>
        <input type="text" v-model="keyword" placeholder="搜尋商品名稱..." class="search-input" />
      </div>
      <button class="btn btn-primary" @click="openAddProduct">新增商品</button>
    </div>

    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th>圖片</th>
            <th>商品名稱</th>
            <th>分類</th>
            <th>價格</th>
            <th>狀態</th>
            <th>排序</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in filteredProducts" :key="p.id">
            <td>
              <img :src="p.image" :alt="p.name" class="product-thumb" />
            </td>
            <td>
              <strong>{{ p.name }}</strong>
              <br>
              <small class="text-muted">{{ p.desc }}</small>
            </td>
            <td><span class="category-badge">{{ p.category }}</span></td>
            <td>NT$ {{ p.price.toLocaleString() }}</td>
            <td><span :class="['status-badge', p.status]">{{ p.statusText }}</span></td>
            <td>{{ p.sort }}</td>
            <td>
              <button class="icon-btn" @click="editProduct(p)" title="編輯">✎</button>
              <button class="icon-btn danger" @click="deleteProduct(p.id)" title="刪除">🗑</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Add/Edit Modal -->
    <div v-if="showAddModal" class="modal-overlay">
      <div class="modal">
        <h3>{{ editingProduct ? '編輯商品' : '新增商品' }}</h3>
        <form @submit.prevent="saveProduct">
          <div class="form-row">
            <div class="form-group">
              <label>商品名稱</label>
              <input type="text" v-model="form.name" required />
            </div>
            <div class="form-group">
              <label>分類</label>
              <select v-model="form.category" required>
                <option value="經典口味">經典口味</option>
                <option value="豪華系列">豪華系列</option>
                <option value="起司系列">起司系列</option>
                <option value="素食">素食</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>描述</label>
            <textarea v-model="form.desc" rows="3" required></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>價格</label>
              <input type="number" v-model.number="form.price" min="0" required />
            </div>
            <div class="form-group">
              <label>排序</label>
              <input type="number" v-model.number="form.sort" min="0" />
            </div>
          </div>
          <div class="form-group">
            <label>商品圖片</label>
            <input type="file" accept="image/jpeg,image/png,image/webp" @change="handleImageChange" />
            <small class="upload-hint">支援 JPG、PNG、WebP，檔案大小不可超過 5 MB。</small>
            <img v-if="imagePreview" :src="imagePreview" alt="商品圖片預覽" class="image-preview" />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>狀態</label>
              <select v-model="form.status">
                <option value="active">上架</option>
                <option value="inactive">下架</option>
              </select>
            </div>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" @click="requestCloseModal">取消</button>
            <button type="submit" class="btn btn-primary" :disabled="isSaving">{{ isSaving ? '儲存中…' : editingProduct ? '更新' : '新增' }}</button>
          </div>
        </form>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { api } from '../../services/api'

const selectedCategory = ref('')
const keyword = ref('')
const showAddModal = ref(false)
const editingProduct = ref(null)
const imageFile = ref(null)
const imagePreview = ref('')
const isSaving = ref(false)
const originalForm = ref('')

const form = ref({
  name: '',
  category: '經典口味',
  desc: '',
  price: 0,
  sort: 0,
  image: '',
  status: 'active'
})
const resetForm = () => ({ name: '', category: '經典口味', desc: '', price: 0, sort: 0, image: '', status: 'active' })
const markFormPristine = () => { originalForm.value = JSON.stringify(form.value) }
const isFormDirty = () => imageFile.value !== null || JSON.stringify(form.value) !== originalForm.value

const products = ref([])
const loadProducts = async () => {
  products.value = await api('/products')
  products.value.forEach(p => { p.statusText = p.status === 'active' ? '上架' : '下架' })
}
const handleKeydown = (event) => {
  if (event.key === 'Escape' && showAddModal.value) requestCloseModal()
}
onMounted(() => {
  loadProducts()
  window.addEventListener('keydown', handleKeydown)
})
onUnmounted(() => window.removeEventListener('keydown', handleKeydown))

const filteredProducts = computed(() => {
  return products.value.filter(p => (!selectedCategory.value || p.category === selectedCategory.value) && (!keyword.value || p.name.includes(keyword.value)))
})

const saveProduct = async () => {
  isSaving.value = true
  try {
    let imageUrl = form.value.image
    if (imageFile.value) {
      const data = new FormData()
      data.append('image', imageFile.value)
      const response = await fetch('/api/uploads/products', { method: 'POST', body: data })
      const uploaded = await response.json()
      if (!response.ok) throw new Error(uploaded.message || '圖片上傳失敗')
      imageUrl = uploaded.image_url
    }

    const body = { name: form.value.name, category: form.value.category, description: form.value.desc, price: form.value.price, image_url: imageUrl, status: form.value.status, sort_order: form.value.sort }
    if (editingProduct.value) await api(`/products/${editingProduct.value.id}`, { method: 'PUT', body: JSON.stringify(body) })
    else await api('/products', { method: 'POST', body: JSON.stringify(body) })
    await loadProducts()
    closeModal()
  } catch (error) {
    alert(error.message)
  } finally {
    isSaving.value = false
  }
}

const closeModal = () => {
  showAddModal.value = false
  editingProduct.value = null
  imageFile.value = null
  imagePreview.value = ''
  form.value = resetForm()
  markFormPristine()
}

const requestCloseModal = () => {
  if (isSaving.value) return
  if (isFormDirty() && !confirm('尚未儲存商品資料，確定要離開嗎？')) return
  closeModal()
}

const openAddProduct = () => {
  editingProduct.value = null
  imageFile.value = null
  imagePreview.value = ''
  form.value = resetForm()
  markFormPristine()
  showAddModal.value = true
}

const editProduct = (p) => {
  editingProduct.value = p
  form.value = { name: p.name, category: p.category, desc: p.desc, price: p.price, sort: p.sort, image: p.image, status: p.status }
  imageFile.value = null
  imagePreview.value = p.image || ''
  markFormPristine()
  showAddModal.value = true
}
const handleImageChange = (event) => {
  const file = event.target.files?.[0]
  if (!file) return
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
    alert('請選擇 JPG、PNG 或 WebP 圖片，且大小不可超過 5 MB。')
    event.target.value = ''
    return
  }
  imageFile.value = file
  imagePreview.value = URL.createObjectURL(file)
}
const deleteProduct = async (id) => {
  if (!confirm('確定要刪除這項商品嗎？')) return
  await api(`/products/${id}`, { method: 'DELETE' })
  await loadProducts()
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

.filter-group {
  display: flex;
  gap: 12px;
}

.filter-select {
  height: 42px;
  padding: 0 14px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  min-width: 160px;
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

.btn-primary {
  height: 42px;
  padding: 0 20px;
  background: #35c1d0;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
}

.btn-primary:hover {
  background: #2aaeb9;
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
  vertical-align: middle;
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

.product-thumb {
  width: 50px;
  height: 50px;
  object-fit: cover;
  border-radius: 6px;
}

.category-badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  background: #e8f5fa;
  color: #0e7a8a;
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

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 20px;
}

.modal {
  background: white;
  border-radius: 14px;
  padding: 28px;
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2);
}

.modal h3 {
  margin: 0 0 20px;
  font-size: 20px;
  font-weight: 700;
  color: #273746;
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
  font-weight: 600;
  font-size: 13px;
  color: #374151;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #35c1d0;
  box-shadow: 0 0 0 3px rgba(53, 193, 208, 0.15);
}

.upload-hint {
  display: block;
  margin-top: 6px;
  color: #64748b;
}

.image-preview {
  display: block;
  width: 140px;
  height: 100px;
  margin-top: 12px;
  object-fit: cover;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 8px;
}

.btn-secondary {
  height: 42px;
  padding: 0 20px;
  background: white;
  color: #475569;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
}

.btn-secondary:hover {
  background: #f8fafc;
}
</style>
