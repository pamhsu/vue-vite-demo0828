import 'dotenv/config'
import bcrypt from 'bcryptjs'
import mysql from 'mysql2/promise'

const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
})

await db.query(`
  CREATE TABLE IF NOT EXISTS admins (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('superadmin', 'admin', 'sales') NOT NULL DEFAULT 'admin',
    status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
    last_login_at DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB
`)

await db.query(`
  CREATE TABLE IF NOT EXISTS admin_sessions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    admin_id BIGINT UNSIGNED NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_admin_sessions_admin FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE,
    INDEX idx_admin_sessions_expires_at (expires_at)
  ) ENGINE=InnoDB
`)

const [cancelledByColumn] = await db.query(`
  SELECT 1
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'cancelled_by'
`)
if (!cancelledByColumn.length) {
  await db.query("ALTER TABLE orders ADD COLUMN cancelled_by ENUM('customer', 'admin') NULL AFTER remark")
}

await db.query(`
  CREATE TABLE IF NOT EXISTS admin_notifications (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_id BIGINT UNSIGNED NOT NULL,
    type ENUM('new_order', 'pending_overdue', 'customer_cancelled') NOT NULL,
    title VARCHAR(255) NOT NULL,
    message VARCHAR(500) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_admin_notification_order_type (order_id, type),
    CONSTRAINT fk_admin_notifications_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    INDEX idx_admin_notifications_created_at (created_at)
  ) ENGINE=InnoDB
`)

await db.query(`
  CREATE TABLE IF NOT EXISTS admin_notification_reads (
    notification_id BIGINT UNSIGNED NOT NULL,
    admin_id BIGINT UNSIGNED NOT NULL,
    read_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (notification_id, admin_id),
    CONSTRAINT fk_notification_reads_notification FOREIGN KEY (notification_id) REFERENCES admin_notifications(id) ON DELETE CASCADE,
    CONSTRAINT fk_notification_reads_admin FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
  ) ENGINE=InnoDB
`)

const [existing] = await db.query('SELECT id FROM admins WHERE username = ?', ['admin'])
if (!existing.length) {
  const passwordHash = await bcrypt.hash('123456', 12)
  await db.query(
    'INSERT INTO admins (username, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)',
    ['admin', '最高管理員', 'admin@fattaamano.local', passwordHash, 'superadmin']
  )
  console.log('已建立初始最高管理員：admin（初始密碼：123456）')
} else {
  console.log('admins 資料表已存在，保留原有管理員資料')
}

console.log('管理員、登入工作階段與訂單通知資料表已完成')
await db.end()
