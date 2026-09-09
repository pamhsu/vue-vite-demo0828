import 'dotenv/config'
import bcrypt from 'bcryptjs'
import cors from 'cors'
import crypto from 'node:crypto'
import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'
import multer from 'multer'

const required = ['DB_HOST', 'DB_NAME', 'DB_USER']
const missing = required.filter((key) => !process.env[key])
if (missing.length) throw new Error(`缺少資料庫設定：${missing.join(', ')}`)

const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
})

const app = express()
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const productUploadDir = path.join(projectRoot, 'public', 'uploads', 'products')
const newsUploadDir = path.join(projectRoot, 'public', 'uploads', 'news')
fs.mkdirSync(productUploadDir, { recursive: true })
fs.mkdirSync(newsUploadDir, { recursive: true })
const createImageUpload = (destination) => multer({
  storage: multer.diskStorage({
    destination,
    filename: (_req, file, done) => {
      const extension = path.extname(file.originalname).toLowerCase()
      done(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`)
    }
  }),
  fileFilter: (_req, file, done) => done(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)),
  limits: { fileSize: 5 * 1024 * 1024 }
})
const upload = multer({
  storage: multer.diskStorage({
    destination: productUploadDir,
    filename: (_req, file, done) => {
      const extension = path.extname(file.originalname).toLowerCase()
      done(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`)
    }
  }),
  fileFilter: (_req, file, done) => done(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)),
  limits: { fileSize: 5 * 1024 * 1024 }
})
const newsUpload = createImageUpload(newsUploadDir)
app.use(cors())
app.use(express.json())
app.use('/uploads', express.static(path.join(projectRoot, 'public', 'uploads')))

const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)
const pick = (body, fields) => Object.fromEntries(fields.map((field) => [field, body[field]]))
const serializeValue = (value) => (value !== null && typeof value === 'object') || Array.isArray(value) ? JSON.stringify(value) : value

const ADMIN_ROLES = ['superadmin', 'admin', 'sales']
const ADMIN_SESSION_DAYS = 8
const publicAdmin = (admin) => ({
  id: admin.id,
  username: admin.username,
  name: admin.name,
  email: admin.email,
  role: admin.role,
  status: admin.status,
  lastLoginAt: admin.last_login_at ?? admin.lastLoginAt ?? null
})
const createAdminToken = () => crypto.randomBytes(48).toString('hex')
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex')
const authenticateAdmin = asyncRoute(async (req, res, next) => {
  const token = req.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ message: '請先登入後台' })
  const [rows] = await db.query(`
    SELECT a.id, a.username, a.name, a.email, a.role, a.status, a.last_login_at
    FROM admin_sessions AS s
    JOIN admins AS a ON a.id = s.admin_id
    WHERE s.token_hash = ? AND s.expires_at > NOW()
  `, [hashToken(token)])
  const admin = rows[0]
  if (!admin || admin.status !== 'active') return res.status(401).json({ message: '登入已失效，請重新登入' })
  req.admin = admin
  next()
})
const requireRole = (...roles) => [authenticateAdmin, (req, res, next) => {
  if (!roles.includes(req.admin.role)) return res.status(403).json({ message: '你沒有使用此功能的權限' })
  next()
}]
const adminManagers = () => requireRole('superadmin', 'admin')
const canManageAdmin = (actor, target) => actor.role === 'superadmin' || target.role !== 'superadmin'
const createOrderNotification = async ({ orderId, type, title, message }) => {
  await db.query(
    'INSERT IGNORE INTO admin_notifications (order_id, type, title, message) VALUES (?, ?, ?, ?)',
    [orderId, type, title, message]
  )
}
const createPendingOverdueNotifications = async () => {
  await db.query(`
    INSERT IGNORE INTO admin_notifications (order_id, type, title, message)
    SELECT id, 'pending_overdue', CONCAT('訂單 #', order_number, ' 尚未處理'),
      CONCAT('已等待超過 10 分鐘，請盡快接收訂單。')
    FROM orders
    WHERE status = 'pending'
      AND created_at <= DATE_SUB(NOW(), INTERVAL 10 MINUTE)
  `)
}

app.get('/api/health', asyncRoute(async (_req, res) => {
  await db.query('SELECT 1')
  res.json({ ok: true })
}))

app.get('/api/dashboard/summary', ...adminManagers(), asyncRoute(async (_req, res) => {
  const [rows] = await db.query(`
    SELECT
      (SELECT COUNT(*) FROM members) AS memberCount,
      (SELECT COUNT(*) FROM products) AS productCount,
      (SELECT COUNT(*) FROM orders WHERE status = 'pending') AS pendingOrderCount,
      COALESCE((
        SELECT SUM(total)
        FROM orders
        WHERE status = 'completed'
          AND created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
          AND created_at < DATE_ADD(LAST_DAY(CURDATE()), INTERVAL 1 DAY)
      ), 0) AS monthlyRevenue
  `)
  res.json(rows[0])
}))

app.get('/api/dashboard/order-trend', ...adminManagers(), asyncRoute(async (_req, res) => {
  const [rows] = await db.query(`
    WITH RECURSIVE calendar AS (
      SELECT CURDATE() - INTERVAL 6 DAY AS day
      UNION ALL
      SELECT day + INTERVAL 1 DAY FROM calendar WHERE day < CURDATE()
    )
    SELECT
      DATE_FORMAT(calendar.day, '%Y-%m-%d') AS date,
      DATE_FORMAT(calendar.day, '%m/%d') AS label,
      COUNT(orders.id) AS totalOrders,
      COALESCE(SUM(orders.status = 'completed'), 0) AS completedOrders,
      COALESCE(SUM(orders.status = 'cancelled'), 0) AS cancelledOrders
    FROM calendar
    LEFT JOIN orders
      ON orders.created_at >= calendar.day
      AND orders.created_at < calendar.day + INTERVAL 1 DAY
    GROUP BY calendar.day
    ORDER BY calendar.day
  `)
  res.json(rows)
}))

app.get('/api/dashboard/top-products', ...adminManagers(), asyncRoute(async (req, res) => {
  const days = Math.min(Math.max(Number.parseInt(req.query.days, 10) || 30, 1), 365)
  const [orders] = await db.query(`
    SELECT items
    FROM orders
    WHERE status = 'completed'
      AND created_at >= CURDATE() - INTERVAL ${days - 1} DAY
  `)

  const products = new Map()
  for (const order of orders) {
      let items
      try {
        items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items
      } catch {
        continue
      }
    if (!Array.isArray(items)) continue
    for (const item of items) {
      const quantity = Math.max(Number(item.qty) || 0, 0)
      if (!item.name || !quantity) continue
      const key = item.id != null ? `id:${item.id}` : `name:${item.name}`
      const optionPrice = Array.isArray(item.options)
        ? item.options.reduce((sum, option) => sum + (Number(option.price) || 0), 0)
        : 0
      const current = products.get(key) || { productId: item.id ?? null, name: item.name, quantity: 0, revenue: 0 }
      current.quantity += quantity
      current.revenue += ((Number(item.price) || 0) + optionPrice) * quantity
      products.set(key, current)
    }
  }

  res.json([...products.values()]
    .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue || a.name.localeCompare(b.name, 'zh-Hant'))
    .slice(0, 5))
}))

app.post('/api/auth/register', asyncRoute(async (req, res) => {
  const { name, email, password } = req.body
  if (!name || !email || !password || password.length < 6) return res.status(400).json({ message: '請填寫姓名、Email 與至少 6 碼的密碼' })
  const [exists] = await db.query('SELECT id FROM members WHERE email = ?', [email])
  if (exists.length) return res.status(409).json({ message: '此 Email 已被註冊' })
  const passwordHash = await bcrypt.hash(password, 12)
  await db.query('INSERT INTO members (name, email, password_hash) VALUES (?, ?, ?)', [name, email, passwordHash])
  res.status(201).json({ message: '註冊成功，請登入' })
}))

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const [rows] = await db.query('SELECT id, name, email, password_hash, status, phone, address FROM members WHERE email = ?', [req.body.email])
  const member = rows[0]
  if (!member) return res.status(401).json({ message: '帳號或密碼錯誤' })
  if (!(await bcrypt.compare(req.body.password || '', member.password_hash))) return res.status(401).json({ message: '帳號或密碼錯誤' })
  if (member.status !== 'active') return res.status(403).json({ message: '帳號已停用，請聯絡管理員', disabled: true })
  res.json({ member: { id: member.id, name: member.name, email: member.email, phone: member.phone, address: member.address } })
}))

app.post('/api/admin/auth/login', asyncRoute(async (req, res) => {
  const username = req.body.username?.trim()
  const password = req.body.password || ''
  if (!username || !password) return res.status(400).json({ message: '請輸入帳號與密碼' })
  const [rows] = await db.query('SELECT * FROM admins WHERE username = ?', [username])
  const admin = rows[0]
  if (!admin || !(await bcrypt.compare(password, admin.password_hash))) {
    return res.status(401).json({ message: '帳號或密碼錯誤' })
  }
  if (admin.status !== 'active') return res.status(403).json({ message: '此管理員帳號已停用' })

  const token = createAdminToken()
  await db.query('DELETE FROM admin_sessions WHERE expires_at <= NOW()')
  await db.query('INSERT INTO admin_sessions (admin_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))', [admin.id, hashToken(token), ADMIN_SESSION_DAYS])
  await db.query('UPDATE admins SET last_login_at = NOW() WHERE id = ?', [admin.id])
  admin.last_login_at = new Date()
  res.json({ token, admin: publicAdmin(admin) })
}))

app.post('/api/admin/auth/logout', authenticateAdmin, asyncRoute(async (req, res) => {
  const token = req.get('authorization').replace(/^Bearer\s+/i, '')
  await db.query('DELETE FROM admin_sessions WHERE token_hash = ?', [hashToken(token)])
  res.status(204).end()
}))

app.get('/api/admin/notifications', ...requireRole('superadmin', 'admin', 'sales'), asyncRoute(async (req, res) => {
  await createPendingOverdueNotifications()
  const [rows] = await db.query(`
    SELECT n.id, n.order_id AS orderId, o.order_number AS orderNumber, o.name AS customerName,
      o.total, o.delivery_type AS deliveryType, o.created_at AS orderCreatedAt, o.status AS orderStatus,
      n.type, n.title, n.message, n.created_at AS createdAt, (r.notification_id IS NOT NULL) AS isRead
    FROM admin_notifications AS n
    JOIN orders AS o ON o.id = n.order_id
    LEFT JOIN admin_notification_reads AS r
      ON r.notification_id = n.id AND r.admin_id = ?
    ORDER BY n.created_at DESC
    LIMIT 30
  `, [req.admin.id])
  res.json(rows)
}))

app.post('/api/admin/notifications/:id/read', ...requireRole('superadmin', 'admin', 'sales'), asyncRoute(async (req, res) => {
  const [exists] = await db.query('SELECT id FROM admin_notifications WHERE id = ?', [req.params.id])
  if (!exists.length) return res.status(404).json({ message: '找不到通知' })
  await db.query('INSERT IGNORE INTO admin_notification_reads (notification_id, admin_id) VALUES (?, ?)', [req.params.id, req.admin.id])
  res.status(204).end()
}))

app.post('/api/admin/notifications/read-all', ...requireRole('superadmin', 'admin', 'sales'), asyncRoute(async (req, res) => {
  await createPendingOverdueNotifications()
  await db.query(`
    INSERT IGNORE INTO admin_notification_reads (notification_id, admin_id)
    SELECT id, ? FROM admin_notifications
  `, [req.admin.id])
  res.status(204).end()
}))

app.get('/api/admins', ...adminManagers(), asyncRoute(async (_req, res) => {
  const [rows] = await db.query(`
    SELECT id, username, name, email, role, status, last_login_at
    FROM admins
    ORDER BY FIELD(role, 'superadmin', 'admin', 'sales'), id
  `)
  res.json(rows.map(publicAdmin))
}))

app.post('/api/admins', ...adminManagers(), asyncRoute(async (req, res) => {
  const { username, name, email, password } = req.body
  const role = req.body.role || 'admin'
  if (!username?.trim() || !name?.trim() || !email?.trim() || !password || password.length < 6) {
    return res.status(400).json({ message: '請填寫帳號、姓名、Email 與至少 6 碼的密碼' })
  }
  if (!ADMIN_ROLES.includes(role)) return res.status(400).json({ message: '管理員角色不正確' })
  if (req.admin.role !== 'superadmin' && role === 'superadmin') return res.status(403).json({ message: '只有最高管理員可以新增最高管理員帳號' })
  const [exists] = await db.query('SELECT id FROM admins WHERE username = ? OR email = ?', [username.trim(), email.trim()])
  if (exists.length) return res.status(409).json({ message: '帳號或 Email 已存在' })
  const passwordHash = await bcrypt.hash(password, 12)
  const [result] = await db.query(
    'INSERT INTO admins (username, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
    [username.trim(), name.trim(), email.trim(), passwordHash, role]
  )
  const [rows] = await db.query('SELECT id, username, name, email, role, status, last_login_at FROM admins WHERE id = ?', [result.insertId])
  res.status(201).json(publicAdmin(rows[0]))
}))

app.put('/api/admins/:id', ...adminManagers(), asyncRoute(async (req, res) => {
  const [rows] = await db.query('SELECT * FROM admins WHERE id = ?', [req.params.id])
  const target = rows[0]
  if (!target) return res.status(404).json({ message: '找不到管理員帳號' })
  if (!canManageAdmin(req.admin, target)) return res.status(403).json({ message: '不可修改最高管理員帳號' })
  if (Number(req.admin.id) === Number(target.id) && req.body.status === 'inactive') return res.status(400).json({ message: '不可停用目前登入的帳號' })
  const { name, email, password } = req.body
  const role = req.body.role ?? target.role
  const status = req.body.status ?? target.status
  if (!name?.trim() || !email?.trim()) return res.status(400).json({ message: '姓名與 Email 不可空白' })
  if (!ADMIN_ROLES.includes(role) || !['active', 'inactive'].includes(status)) return res.status(400).json({ message: '角色或狀態不正確' })
  if (req.admin.role !== 'superadmin' && role === 'superadmin') return res.status(403).json({ message: '只有最高管理員可以設定最高管理員角色' })
  const [exists] = await db.query('SELECT id FROM admins WHERE email = ? AND id != ?', [email.trim(), target.id])
  if (exists.length) return res.status(409).json({ message: '此 Email 已被使用' })
  const sets = ['name = ?', 'email = ?', 'role = ?', 'status = ?']
  const values = [name.trim(), email.trim(), role, status]
  if (password) {
    if (password.length < 6) return res.status(400).json({ message: '新密碼至少需要 6 碼' })
    sets.push('password_hash = ?')
    values.push(await bcrypt.hash(password, 12))
  }
  values.push(target.id)
  await db.query(`UPDATE admins SET ${sets.join(', ')} WHERE id = ?`, values)
  const [updatedRows] = await db.query('SELECT id, username, name, email, role, status, last_login_at FROM admins WHERE id = ?', [target.id])
  res.json(publicAdmin(updatedRows[0]))
}))

app.delete('/api/admins/:id', ...adminManagers(), asyncRoute(async (req, res) => {
  const [rows] = await db.query('SELECT id, role FROM admins WHERE id = ?', [req.params.id])
  const target = rows[0]
  if (!target) return res.status(404).json({ message: '找不到管理員帳號' })
  if (!canManageAdmin(req.admin, target)) return res.status(403).json({ message: '不可刪除最高管理員帳號' })
  if (Number(req.admin.id) === Number(target.id)) return res.status(400).json({ message: '不可刪除目前登入的帳號' })
  await db.query('DELETE FROM admins WHERE id = ?', [target.id])
  res.status(204).end()
}))

app.post('/api/members', ...adminManagers(), asyncRoute(async (req, res) => {
  const { name, email, password, phone, status = 'active' } = req.body
  if (!name?.trim() || !email?.trim() || !password || password.length < 6) {
    return res.status(400).json({ message: '請填寫姓名、Email 與至少 6 碼的密碼' })
  }
  if (!['active', 'inactive'].includes(status)) return res.status(400).json({ message: '會員狀態不正確' })

  const [exists] = await db.query('SELECT id FROM members WHERE email = ?', [email.trim()])
  if (exists.length) return res.status(409).json({ message: '此 Email 已被註冊' })

  const passwordHash = await bcrypt.hash(password, 12)
  const [result] = await db.query(
    'INSERT INTO members (name, email, password_hash, phone, status) VALUES (?, ?, ?, ?, ?)',
    [name.trim(), email.trim(), passwordHash, phone?.trim() || null, status]
  )
  res.status(201).json({ id: result.insertId })
}))

app.post('/api/uploads/products', ...adminManagers(), upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: '請選擇 JPG、PNG 或 WebP 圖片（最多 5 MB）' })
  res.status(201).json({ image_url: `/uploads/products/${req.file.filename}` })
})

app.post('/api/uploads/news', ...adminManagers(), newsUpload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: '請選擇 JPG、PNG 或 WebP 圖片（最多 5 MB）' })
  res.status(201).json({ image_url: `/uploads/news/${req.file.filename}` })
})

app.get('/api/me/:id', asyncRoute(async (req, res) => {
  const [rows] = await db.query('SELECT id, name, email, phone, address FROM members WHERE id = ?', [req.params.id])
  if (!rows.length) return res.status(404).json({ message: '找不到會員' })
  res.json(rows[0])
}))

app.put('/api/me/:id', asyncRoute(async (req, res) => {
  const { name, phone, address } = req.body
  if (!name) return res.status(400).json({ message: '姓名不可為空白' })
  await db.query('UPDATE members SET name = ?, phone = ?, address = ? WHERE id = ?', [name, phone || null, address || null, req.params.id])
  res.status(204).end()
}))

app.post('/api/me/:id/password', asyncRoute(async (req, res) => {
  const { oldPassword, newPassword } = req.body
  if (!oldPassword || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ message: '請填寫原密碼與至少 6 碼的新密碼' })
  }
  const [rows] = await db.query('SELECT password_hash FROM members WHERE id = ?', [req.params.id])
  if (!rows.length) return res.status(404).json({ message: '找不到會員' })
  if (!(await bcrypt.compare(oldPassword, rows[0].password_hash))) return res.status(400).json({ message: '原密碼錯誤' })
  const passwordHash = await bcrypt.hash(newPassword, 12)
  await db.query('UPDATE members SET password_hash = ? WHERE id = ?', [passwordHash, req.params.id])
  res.status(204).end()
}))

const resources = {
  members: { table: 'members', columns: ['name', 'email', 'phone', 'address', 'status'], select: 'id, name, email, phone, address, status, created_at AS createdAt' },
  products: { table: 'products', columns: ['name', 'category', 'description', 'price', 'image_url', 'options', 'status', 'sort_order'], select: 'id, name, category, description AS `desc`, price, image_url AS image, options, status, sort_order AS sort, created_at AS createdAt' },
  news: { table: 'news', columns: ['title', 'content', 'image_url', 'published_at', 'status'], select: "id, title, content AS `desc`, image_url AS image, DATE_FORMAT(published_at, '%Y-%m-%d') AS date, status, created_at AS createdAt" }
}

for (const [route, config] of Object.entries(resources)) {
  const accessMembers = route === 'members' ? adminManagers() : []
  app.get(`/api/${route}`, ...accessMembers, asyncRoute(async (req, res) => {
    const params = []; let where = ''
    if (req.query.status) { where = ' WHERE status = ?'; params.push(req.query.status) }
    const [rows] = await db.query(`SELECT ${config.select} FROM ${config.table}${where} ORDER BY id DESC`, params)
    res.json(rows)
  }))
  app.post(`/api/${route}`, ...adminManagers(), asyncRoute(async (req, res) => {
    const data = pick(req.body, config.columns)
    const values = config.columns.map((column) => serializeValue(data[column] ?? null))
    const [result] = await db.query(`INSERT INTO ${config.table} (${config.columns.join(', ')}) VALUES (${config.columns.map(() => '?').join(', ')})`, values)
    res.status(201).json({ id: result.insertId })
  }))
  app.put(`/api/${route}/:id`, ...adminManagers(), asyncRoute(async (req, res) => {
    const data = pick(req.body, config.columns)
    const values = [...config.columns.map((column) => serializeValue(data[column] ?? null)), req.params.id]
    const [result] = await db.query(`UPDATE ${config.table} SET ${config.columns.map((column) => `${column} = ?`).join(', ')} WHERE id = ?`, values)
    if (!result.affectedRows) return res.status(404).json({ message: '找不到資料' })
    res.status(204).end()
  }))
  app.delete(`/api/${route}/:id`, ...adminManagers(), asyncRoute(async (req, res) => {
    const [result] = await db.query(`DELETE FROM ${config.table} WHERE id = ?`, [req.params.id])
    if (!result.affectedRows) return res.status(404).json({ message: '找不到資料' })
    res.status(204).end()
  }))
}

app.get('/api/orders', ...requireRole('superadmin', 'admin', 'sales'), asyncRoute(async (_req, res) => {
  const [rows] = await db.query('SELECT id, order_number, member_id, name, phone, address, delivery_type AS deliveryType, pickup_time AS pickupTime, total, items, status, sub_status AS subStatus, remark, status_history AS statusHistory, created_at AS createdAt FROM orders ORDER BY id DESC')
  res.json(rows)
}))

app.get('/api/orders/guest', asyncRoute(async (req, res) => {
  const { orderNumber, phone } = req.query
  if (!orderNumber || !phone) return res.status(400).json({ message: '請填寫訂單編號與手機號碼' })
  const [rows] = await db.query(
    'SELECT id, order_number, member_id, name, phone, address, delivery_type AS deliveryType, pickup_time AS pickupTime, total, items, status, sub_status AS subStatus, remark, status_history AS statusHistory, created_at AS createdAt FROM orders WHERE order_number = ? AND phone = ?',
    [orderNumber, phone]
  )
  res.json(rows)
}))

app.get('/api/orders/member/:memberId', asyncRoute(async (req, res) => {
  const [rows] = await db.query(
    'SELECT id, order_number, member_id, name, phone, address, delivery_type AS deliveryType, pickup_time AS pickupTime, total, items, status, sub_status AS subStatus, remark, status_history AS statusHistory, created_at AS createdAt FROM orders WHERE member_id = ? ORDER BY id DESC',
    [req.params.memberId]
  )
  res.json(rows)
}))

app.post('/api/orders', asyncRoute(async (req, res) => {
  const { name, phone, address, items, member_id, delivery_type, pickup_time } = req.body
  const deliveryType = delivery_type === 'pickup' ? 'pickup' : 'delivery'
  if (!name || !phone || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: '請填寫收件人、電話與至少一件商品' })
  }
  if (deliveryType === 'delivery' && !address) {
    return res.status(400).json({ message: '請填寫配送地址' })
  }
  if (deliveryType === 'pickup' && !pickup_time) {
    return res.status(400).json({ message: '請選擇取貨時間' })
  }
  const total = items.reduce((sum, item) => {
    const unitPrice = Number(item.price) + (Array.isArray(item.options) ? item.options.reduce((o, opt) => o + Number(opt.price || 0), 0) : 0)
    return sum + unitPrice * item.qty
  }, 0)
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const prefix = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}`
  const [countRows] = await db.query(
    "SELECT COUNT(*) AS cnt FROM orders WHERE order_number LIKE ?",
    [`${prefix}%`]
  )
  const seq = String(countRows[0].cnt + 1).padStart(3, '0')
  const orderNumber = `${prefix}${seq}`
  const [result] = await db.query(
    'INSERT INTO orders (order_number, member_id, name, phone, address, delivery_type, pickup_time, total, items, status, sub_status, status_history) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [orderNumber, member_id ?? null, name, phone, deliveryType === 'delivery' ? address : null, deliveryType, deliveryType === 'pickup' ? pickup_time : null, total, JSON.stringify(items), 'pending', 'submitted', JSON.stringify([{ stage: 'submitted', time: now.toISOString() }])]
  )
  await createOrderNotification({
    orderId: result.insertId,
    type: 'new_order',
    title: `新訂單 #${orderNumber}`,
    message: `NT$${Number(total).toLocaleString('zh-TW')}，等待處理。`
  })
  res.status(201).json({ id: result.insertId, order_number: orderNumber })
}))

const ORDER_STAGES = ['submitted', 'received', 'preparing', 'ready', 'delivering', 'delivered', 'cancelled']
const PROGRESS_ORDER = ['submitted', 'received', 'preparing', 'ready', 'delivering', 'delivered']
const stageToStatus = (stage) => {
  if (stage === 'delivered') return 'completed'
  if (stage === 'cancelled') return 'cancelled'
  if (stage === 'submitted') return 'pending'
  return 'processing'
}

const buildContinuousHistory = (history, finalStage, cancelAtStage, backfillTime) => {
  const known = new Map()
  if (history) {
    for (const item of history) {
      if (item && item.stage) known.set(item.stage, item.time)
    }
  }
  let targets = []
  if (finalStage === 'cancelled') {
    const lastProgress = cancelAtStage && PROGRESS_ORDER.includes(cancelAtStage)
      ? cancelAtStage
      : (known.has('submitted') ? 'submitted' : PROGRESS_ORDER[0])
    targets = PROGRESS_ORDER.slice(0, PROGRESS_ORDER.indexOf(lastProgress) + 1)
    targets.push('cancelled')
  } else {
    const idx = PROGRESS_ORDER.indexOf(finalStage)
    targets = PROGRESS_ORDER.slice(0, idx + 1)
  }
  return targets.map(stage => ({ stage, time: known.get(stage) || backfillTime }))
}

app.post('/api/orders/:id/cancel', asyncRoute(async (req, res) => {
  const { memberId, phone } = req.body
  const [rows] = await db.query('SELECT id, order_number, member_id, phone, status, sub_status AS subStatus, status_history AS statusHistory FROM orders WHERE id = ?', [req.params.id])
  const order = rows[0]
  if (!order) return res.status(404).json({ message: '找不到訂單' })
  const isOwner = order.member_id ? Number(order.member_id) === Number(memberId) : order.phone === phone
  if (!isOwner) return res.status(403).json({ message: '無法取消此筆訂單' })
  if (order.status !== 'pending') return res.status(400).json({ message: '訂單已進入處理流程，無法由客戶取消' })
  let history = order.statusHistory
  if (typeof history === 'string') { try { history = JSON.parse(history) } catch { history = [] } }
  const cancelledAt = new Date().toISOString()
  const finalHistory = buildContinuousHistory(Array.isArray(history) ? history : [], 'cancelled', order.subStatus, cancelledAt)
  await db.query(
    "UPDATE orders SET status = 'cancelled', sub_status = 'cancelled', cancelled_by = 'customer', status_history = ? WHERE id = ?",
    [JSON.stringify(finalHistory), order.id]
  )
  await createOrderNotification({
    orderId: order.id,
    type: 'customer_cancelled',
    title: `客戶已取消訂單 #${order.order_number}`,
    message: '此訂單已由客戶取消。'
  })
  res.status(204).end()
}))

app.put('/api/orders/:id', ...requireRole('superadmin', 'admin', 'sales'), asyncRoute(async (req, res) => {
  const { status, sub_status: subStatus, remark, status_history: statusHistory } = req.body
  const [rows] = await db.query('SELECT sub_status AS subStatus, status, delivery_type AS deliveryType FROM orders WHERE id = ?', [req.params.id])
  const current = rows[0]
  if (!current) return res.status(404).json({ message: '找不到資料' })
  if (current.status === 'cancelled' || current.status === 'completed') {
    if (subStatus !== undefined && subStatus !== current.subStatus) {
      return res.status(400).json({ message: '已取消或已完成的訂單無法修改狀態' })
    }
  }
  let finalStatus = status
  let finalSubStatus = subStatus
  if (subStatus !== undefined) {
    if (!ORDER_STAGES.includes(subStatus)) return res.status(400).json({ message: '訂單狀態不正確' })
    if (subStatus === 'delivering' && current.deliveryType !== 'delivery') {
      return res.status(400).json({ message: '取貨訂單無法設定配送中狀態' })
    }
    const curIdx = PROGRESS_ORDER.indexOf(current.subStatus)
    const newIdx = PROGRESS_ORDER.indexOf(subStatus)
    if (subStatus !== 'cancelled' && curIdx >= 0 && newIdx < curIdx) {
      return res.status(400).json({ message: '訂單狀態不可回溯' })
    }
    finalStatus = stageToStatus(subStatus)
  }
  if (finalStatus !== undefined && !['pending', 'processing', 'completed', 'cancelled'].includes(finalStatus)) {
    return res.status(400).json({ message: '訂單狀態不正確' })
  }
  let finalHistory = statusHistory
  if (finalSubStatus !== undefined) {
    const confirmTime = (Array.isArray(statusHistory) && statusHistory.length)
      ? (statusHistory[statusHistory.length - 1].time || new Date().toISOString())
      : new Date().toISOString()
    const historyBase = Array.isArray(statusHistory) ? statusHistory : []
    finalHistory = buildContinuousHistory(
      historyBase,
      finalSubStatus,
      finalSubStatus === 'cancelled' ? current.subStatus : null,
      confirmTime
    )
  }
  const sets = []
  const values = []
  if (finalStatus !== undefined) { sets.push('status = ?'); values.push(finalStatus) }
  if (finalSubStatus !== undefined) { sets.push('sub_status = ?'); values.push(finalSubStatus) }
  if (finalHistory !== undefined) { sets.push('status_history = ?'); values.push(JSON.stringify(finalHistory)) }
  if (finalSubStatus === 'cancelled') { sets.push("cancelled_by = 'admin'") }
  if (remark !== undefined) { sets.push('remark = ?'); values.push(remark) }
  if (!sets.length) return res.status(400).json({ message: '請提供要更新的欄位' })
  values.push(req.params.id)
  await db.query(`UPDATE orders SET ${sets.join(', ')} WHERE id = ?`, values)
  res.status(204).end()
}))

app.delete('/api/orders/:id', ...adminManagers(), asyncRoute(async (req, res) => {
  const [result] = await db.query('DELETE FROM orders WHERE id = ?', [req.params.id])
  if (!result.affectedRows) return res.status(404).json({ message: '找不到資料' })
  res.status(204).end()
}))

app.use((error, _req, res, _next) => {
  console.error(error)
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ message: '圖片不可超過 5 MB' })
  res.status(500).json({ message: '伺服器或資料庫發生錯誤' })
})

app.listen(Number(process.env.PORT || 3000), () => console.log('API server: http://localhost:3000'))
