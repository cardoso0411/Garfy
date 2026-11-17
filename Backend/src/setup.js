import './env.js'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'
import bcrypt from 'bcryptjs'

const database = process.env.MYSQL_DATABASE || 'garfy'
if (!/^[a-zA-Z0-9_]+$/.test(database)) throw new Error('Nome de banco inválido.')
if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD === 'troque-esta-senha') {
  throw new Error('Configure ADMIN_EMAIL e uma ADMIN_PASSWORD segura no .env.backend antes de criar o administrador.')
}
const options = {
  host: process.env.MYSQL_HOST || '127.0.0.1', port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root', password: process.env.MYSQL_PASSWORD || '',
  multipleStatements: true,
}
const db = await mysql.createConnection(options)
try {
  await db.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
  await db.query(`USE \`${database}\``)
  const [oldTables] = await db.execute(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = ? AND table_name IN ('tables','categories','products','admins','admin_sessions','orders','order_items')",
    [database],
  )
  if (oldTables.length) throw new Error('O banco contém tabelas antigas em inglês. Faça uma migração dos dados antes de executar o setup em português.')
  const schema = await fs.readFile(fileURLToPath(new URL('./schema.sql', import.meta.url)), 'utf8')
  await db.query(schema)
  for (const name of ['Clássicos', 'Especiais', 'Vegetarianos', 'Doces']) {
    await db.execute('INSERT IGNORE INTO categorias (nome) VALUES (?)', [name])
  }
  for (let n = 1; n <= 20; n++) await db.execute('INSERT IGNORE INTO mesas (numero) VALUES (?)', [n])
  const [rows] = await db.query('SELECT COUNT(*) AS quantidade FROM produtos')
  if (rows[0].quantidade === 0) {
    const seed = [
      ['Pastel da Casa', 'Carne temperada, queijo meia cura e azeitonas.', 1690, 'Especiais', 'https://images.unsplash.com/photo-1571292226185-6a16b4d879ee?auto=format&fit=crop&w=900&q=84', 'Mais pedido'],
      ['Carne com Queijo', 'Carne moída artesanal e muçarela derretida.', 1490, 'Clássicos', 'https://images.unsplash.com/photo-1681389158414-adf7f9583f24?auto=format&fit=crop&w=900&q=84', ''],
      ['Palmito Cremoso', 'Palmito, requeijão cremoso e ervas frescas.', 1590, 'Vegetarianos', 'https://images.unsplash.com/photo-1704763673093-45b6267a7b8e?auto=format&fit=crop&w=900&q=84', 'Vegetariano'],
      ['Romeu & Julieta', 'Goiabada cascão com queijo, crocante por fora.', 1290, 'Doces', 'https://images.unsplash.com/photo-1677370261616-48751f23f8a2?auto=format&fit=crop&w=900&q=84', 'Novo'],
    ]
    for (const [name, description, cents, category, image, badge] of seed) {
      await db.execute('INSERT INTO produtos (categoria_id, nome, descricao, preco_centavos, url_imagem, destaque) VALUES ((SELECT id FROM categorias WHERE nome = ?),?,?,?,?,?)', [category, name, description, cents, image, badge])
    }
  }
  const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12)
  await db.execute('INSERT INTO administradores (email, hash_senha) VALUES (?, ?) ON DUPLICATE KEY UPDATE email = email', [process.env.ADMIN_EMAIL.toLowerCase(), hash])
  console.log('Banco Garfy preparado.')
} finally { await db.end() }
