import 'dotenv/config'
import bcrypt from 'bcryptjs'
import cors from 'cors'
import express from 'express'
import mysql from 'mysql2/promise'

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
app.use(cors())
app.use(express.json())

const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)
const pick = (body, fields) => Object.fromEntries(fields.map((field) => [field, body[field]]))

app.get('/api/health', asyncRoute(async (_req, res) => {
  await db.query('SELECT 1')
  res.json({ ok: true })
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
  const [rows] = await db.query('SELECT id, name, email, password_hash, status FROM members WHERE email = ?', [req.body.email])
  const member = rows[0]
  if (!member || member.status !== 'active' || !(await bcrypt.compare(req.body.password || '', member.password_hash))) return res.status(401).json({ message: '帳號或密碼錯誤' })
  res.json({ member: { id: member.id, name: member.name, email: member.email } })
}))

const resources = {
  members: { table: 'members', columns: ['name', 'email', 'phone', 'status'], select: 'id, name, email, phone, status, created_at AS createdAt' },
  products: { table: 'products', columns: ['name', 'category', 'description', 'price', 'image_url', 'status', 'sort_order'], select: 'id, name, category, description AS `desc`, price, image_url AS image, status, sort_order AS sort, created_at AS createdAt' },
  news: { table: 'news', columns: ['title', 'content', 'image_url', 'published_at', 'status'], select: 'id, title, content AS `desc`, image_url AS image, published_at AS date, status, created_at AS createdAt' }
}

for (const [route, config] of Object.entries(resources)) {
  app.get(`/api/${route}`, asyncRoute(async (req, res) => {
    const params = []; let where = ''
    if (req.query.status) { where = ' WHERE status = ?'; params.push(req.query.status) }
    const [rows] = await db.query(`SELECT ${config.select} FROM ${config.table}${where} ORDER BY id DESC`, params)
    res.json(rows)
  }))
  app.post(`/api/${route}`, asyncRoute(async (req, res) => {
    const data = pick(req.body, config.columns)
    const values = config.columns.map((column) => data[column] ?? null)
    const [result] = await db.query(`INSERT INTO ${config.table} (${config.columns.join(', ')}) VALUES (${config.columns.map(() => '?').join(', ')})`, values)
    res.status(201).json({ id: result.insertId })
  }))
  app.put(`/api/${route}/:id`, asyncRoute(async (req, res) => {
    const data = pick(req.body, config.columns)
    const values = [...config.columns.map((column) => data[column] ?? null), req.params.id]
    const [result] = await db.query(`UPDATE ${config.table} SET ${config.columns.map((column) => `${column} = ?`).join(', ')} WHERE id = ?`, values)
    if (!result.affectedRows) return res.status(404).json({ message: '找不到資料' })
    res.status(204).end()
  }))
  app.delete(`/api/${route}/:id`, asyncRoute(async (req, res) => {
    const [result] = await db.query(`DELETE FROM ${config.table} WHERE id = ?`, [req.params.id])
    if (!result.affectedRows) return res.status(404).json({ message: '找不到資料' })
    res.status(204).end()
  }))
}

app.use((error, _req, res, _next) => {
  console.error(error)
  res.status(500).json({ message: '伺服器或資料庫發生錯誤' })
})

app.listen(Number(process.env.PORT || 3000), () => console.log('API server: http://localhost:3000'))
