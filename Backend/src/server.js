import './env.js'
import express from 'express'
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { pool } from './db.js'
import { orderStatuses, priceOrder, validItems } from './domain.js'

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '100kb' }))
const fail = (status, message) => Object.assign(new Error(message), { status })
const token = () => crypto.randomBytes(32).toString('hex')
const digest = value => crypto.createHash('sha256').update(value).digest('hex')
const cookie = req => req.headers.cookie?.split(';').map(x => x.trim()).find(x => x.startsWith('garfy_session='))?.split('=')[1]
const str = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : ''
const positive = value => Number.isInteger(Number(value)) && Number(value) > 0
const statusToDb = { received: 'recebido', preparing: 'em_preparo', ready: 'pronto', served: 'servido', cancelled: 'cancelado' }
const statusFromDb = Object.fromEntries(Object.entries(statusToDb).map(([apiStatus, dbStatus]) => [dbStatus, apiStatus]))
const sizeToDb = { traditional: 'tradicional', large: 'grande' }
const sizeFromDb = { tradicional: 'traditional', grande: 'large' }

async function query(sql, params = []) { const [rows] = await pool.execute(sql, params); return rows }
const productSelect = `SELECT p.id, p.categoria_id AS categoryId, c.nome AS category, p.nome AS name,
  p.descricao AS description, p.preco_centavos AS priceCents, p.url_imagem AS imageUrl,
  p.destaque AS badge, p.disponivel AS available
  FROM produtos p JOIN categorias c ON c.id = p.categoria_id`

async function adminOnly(req, _res, next) {
  try {
    const session = cookie(req)
    if (!session || !/^[a-f0-9]{64}$/.test(session)) throw fail(401, 'Acesso administrativo necessário.')
    const rows = await query('SELECT administrador_id FROM sessoes_administrativas WHERE hash_token = ? AND expira_em > NOW()', [digest(session)])
    if (!rows.length) throw fail(401, 'Sessão expirada.')
    req.adminId = rows[0].administrador_id
    next()
  } catch (err) { next(err) }
}

app.get('/api/health', async (_req, res, next) => { try { await query('SELECT 1'); res.json({ ok: true }) } catch (e) { next(e) } })
app.get('/api/categories', async (_req, res, next) => { try { res.json(await query('SELECT id, nome AS name FROM categorias WHERE ativa = TRUE ORDER BY id')) } catch (e) { next(e) } })
app.get('/api/products', async (_req, res, next) => { try { res.json(await query(`${productSelect} WHERE p.disponivel = TRUE AND c.ativa = TRUE ORDER BY p.id`)) } catch (e) { next(e) } })
app.get('/api/tables', async (_req, res, next) => { try { res.json(await query('SELECT numero AS number FROM mesas WHERE ativa = TRUE ORDER BY numero')) } catch (e) { next(e) } })

app.post('/api/orders', async (req, res, next) => {
  const { tableNumber, items } = req.body || {}
  const phone = str(req.body?.phone, 24)
  if (!positive(tableNumber) || !validItems(items) || (phone && !/^[+()\d\s-]{8,24}$/.test(phone))) return next(fail(400, 'Confira a mesa, o celular e os itens do pedido.'))
  let db
  try { db = await pool.getConnection() } catch (e) { return next(e) }
  try {
    await db.beginTransaction()
    const [tables] = await db.execute('SELECT id FROM mesas WHERE numero = ? AND ativa = TRUE', [Number(tableNumber)])
    if (!tables.length) throw fail(400, 'Mesa não cadastrada ou inativa.')
    const ids = [...new Set(items.map(x => x.productId))]
    const [products] = await db.query(`SELECT p.id, p.nome, p.preco_centavos, p.url_imagem, p.disponivel
      FROM produtos p JOIN categorias c ON c.id = p.categoria_id
      WHERE c.ativa = TRUE AND p.id IN (${ids.map(() => '?').join(',')}) FOR UPDATE`, ids)
    const priced = priceOrder(items, products)
    const trackingToken = token()
    const [result] = await db.execute('INSERT INTO pedidos (token_acompanhamento, mesa_id, celular, total_centavos) VALUES (?,?,?,?)', [trackingToken, tables[0].id, phone || null, priced.totalCents])
    for (const line of priced.lines) await db.execute('INSERT INTO itens_pedido (pedido_id, produto_id, nome_produto, url_imagem, tamanho, quantidade, preco_unitario_centavos) VALUES (?,?,?,?,?,?,?)', [result.insertId, line.productId, line.name, line.imageUrl, sizeToDb[line.size], line.quantity, line.unitPriceCents])
    await db.commit()
    res.status(201).json({ id: result.insertId, trackingToken, totalCents: priced.totalCents })
  } catch (e) { await db.rollback(); next(e) } finally { db.release() }
})

async function orderDetails(id, admin = false) {
  const rows = await query(`SELECT o.id, o.token_acompanhamento AS trackingToken, t.numero AS tableNumber,
    o.celular AS phone, o.situacao AS status, o.pago AS paid, o.total_centavos AS totalCents,
    o.criado_em AS createdAt, o.atualizado_em AS updatedAt
    FROM pedidos o JOIN mesas t ON t.id = o.mesa_id WHERE ${admin ? 'o.id' : 'o.token_acompanhamento'} = ?`, [id])
  if (!rows.length) throw fail(404, 'Pedido não encontrado.')
  const order = rows[0]
  order.status = statusFromDb[order.status]
  order.items = (await query('SELECT nome_produto AS name, url_imagem AS imageUrl, tamanho AS size, quantidade AS quantity, preco_unitario_centavos AS unitPriceCents FROM itens_pedido WHERE pedido_id = ? ORDER BY id', [order.id]))
    .map(item => ({ ...item, size: sizeFromDb[item.size] }))
  if (!admin) { delete order.phone; delete order.trackingToken }
  return order
}
app.get('/api/orders/track/:token', async (req, res, next) => { try { if (!/^[a-f0-9]{64}$/.test(req.params.token)) throw fail(404, 'Pedido não encontrado.'); res.json(await orderDetails(req.params.token)) } catch (e) { next(e) } })

app.post('/api/admin/login', async (req, res, next) => {
  try {
    const email = str(req.body?.email, 255).toLowerCase()
    const password = req.body?.password
    if (!email || typeof password !== 'string') throw fail(400, 'Informe e-mail e senha.')
    const rows = await query('SELECT id, hash_senha FROM administradores WHERE email = ?', [email])
    if (!rows.length || !await bcrypt.compare(password, rows[0].hash_senha)) throw fail(401, 'Credenciais inválidas.')
    const session = token()
    await query('INSERT INTO sessoes_administrativas (hash_token, administrador_id, expira_em) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))', [digest(session), rows[0].id])
    res.cookie('garfy_session', session, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 7 * 86400000, path: '/' })
    res.json({ email })
  } catch (e) { next(e) }
})
app.get('/api/admin/me', adminOnly, async (req, res, next) => { try { const rows = await query('SELECT email FROM administradores WHERE id = ?', [req.adminId]); res.json(rows[0]) } catch (e) { next(e) } })
app.post('/api/admin/logout', adminOnly, async (req, res, next) => { try { await query('DELETE FROM sessoes_administrativas WHERE hash_token = ?', [digest(cookie(req))]); res.clearCookie('garfy_session', { path: '/' }); res.status(204).end() } catch (e) { next(e) } })

app.get('/api/admin/orders', adminOnly, async (_req, res, next) => { try {
  const rows = await query(`SELECT o.id, t.numero AS tableNumber, o.celular AS phone,
    o.situacao AS status, o.pago AS paid, o.total_centavos AS totalCents,
    o.criado_em AS createdAt FROM pedidos o JOIN mesas t ON t.id = o.mesa_id ORDER BY o.id DESC LIMIT 200`)
  res.json(rows.map(order => ({ ...order, status: statusFromDb[order.status] })))
} catch (e) { next(e) } })
app.get('/api/admin/orders/:id', adminOnly, async (req, res, next) => { try { if (!positive(req.params.id)) throw fail(400, 'Pedido inválido.'); res.json(await orderDetails(req.params.id, true)) } catch (e) { next(e) } })
app.patch('/api/admin/orders/:id', adminOnly, async (req, res, next) => { try {
  if (!positive(req.params.id) || (!orderStatuses.includes(req.body?.status) && typeof req.body?.paid !== 'boolean')) throw fail(400, 'Atualização inválida.')
  if (req.body.status !== undefined && !orderStatuses.includes(req.body.status)) throw fail(400, 'Status inválido.')
  const fields = [], values = []
  if (req.body.status !== undefined) { fields.push('situacao = ?'); values.push(statusToDb[req.body.status]) }
  if (req.body.paid !== undefined) { if (typeof req.body.paid !== 'boolean') throw fail(400, 'Pagamento inválido.'); fields.push('pago = ?'); values.push(req.body.paid) }
  values.push(Number(req.params.id))
  const result = await query(`UPDATE pedidos SET ${fields.join(', ')} WHERE id = ?`, values)
  if (!result.affectedRows) throw fail(404, 'Pedido não encontrado.')
  res.json(await orderDetails(req.params.id, true))
} catch (e) { next(e) } })

app.get('/api/admin/products', adminOnly, async (_req, res, next) => { try { res.json(await query(`${productSelect} ORDER BY p.id`)) } catch (e) { next(e) } })
app.post('/api/admin/products', adminOnly, async (req, res, next) => { try {
  const p = productInput(req.body)
  const result = await query('INSERT INTO produtos (categoria_id, nome, descricao, preco_centavos, url_imagem, destaque, disponivel) VALUES (?,?,?,?,?,?,?)', Object.values(p))
  res.status(201).json({ id: result.insertId })
} catch (e) { next(e) } })
app.put('/api/admin/products/:id', adminOnly, async (req, res, next) => { try {
  if (!positive(req.params.id)) throw fail(400, 'Produto inválido.')
  const p = productInput(req.body)
  const result = await query('UPDATE produtos SET categoria_id = ?, nome = ?, descricao = ?, preco_centavos = ?, url_imagem = ?, destaque = ?, disponivel = ? WHERE id = ?', [...Object.values(p), Number(req.params.id)])
  if (!result.affectedRows) throw fail(404, 'Produto não encontrado.')
  res.json({ id: Number(req.params.id) })
} catch (e) { next(e) } })
function productInput(body) {
  const categoryId = Number(body?.categoryId), priceCents = Number(body?.priceCents)
  const name = str(body?.name, 120), description = str(body?.description, 2000), imageUrl = str(body?.imageUrl, 1000), badge = str(body?.badge, 80)
  if (!positive(categoryId) || !name || !Number.isInteger(priceCents) || priceCents < 0 || (imageUrl && !/^https?:\/\//.test(imageUrl))) throw fail(400, 'Dados do produto inválidos.')
  return { categoryId, name, description, priceCents, imageUrl, badge, available: body.available === false || body.available === 0 ? 0 : 1 }
}

app.get('/api/admin/categories', adminOnly, async (_req, res, next) => { try { res.json(await query('SELECT id, nome AS name, ativa AS active FROM categorias ORDER BY id')) } catch (e) { next(e) } })
app.post('/api/admin/categories', adminOnly, async (req, res, next) => { try {
  const name = str(req.body?.name, 80); if (!name) throw fail(400, 'Informe a categoria.')
  const result = await query('INSERT INTO categorias (nome) VALUES (?)', [name]); res.status(201).json({ id: result.insertId })
} catch (e) { next(e) } })
app.put('/api/admin/categories/:id', adminOnly, async (req, res, next) => { try {
  const name = str(req.body?.name, 80); if (!positive(req.params.id) || !name) throw fail(400, 'Categoria inválida.')
  const result = await query('UPDATE categorias SET nome = ?, ativa = ? WHERE id = ?', [name, req.body.active === false ? 0 : 1, Number(req.params.id)])
  if (!result.affectedRows) throw fail(404, 'Categoria não encontrada.'); res.json({ id: Number(req.params.id) })
} catch (e) { next(e) } })

app.get('/api/admin/tables', adminOnly, async (_req, res, next) => { try { res.json(await query('SELECT id, numero AS number, ativa AS active FROM mesas ORDER BY numero')) } catch (e) { next(e) } })
app.post('/api/admin/tables', adminOnly, async (req, res, next) => { try {
  if (!positive(req.body?.number)) throw fail(400, 'Número de mesa inválido.')
  const result = await query('INSERT INTO mesas (numero) VALUES (?)', [Number(req.body.number)]); res.status(201).json({ id: result.insertId })
} catch (e) { next(e) } })
app.put('/api/admin/tables/:id', adminOnly, async (req, res, next) => { try {
  if (!positive(req.params.id) || !positive(req.body?.number)) throw fail(400, 'Mesa inválida.')
  const result = await query('UPDATE mesas SET numero = ?, ativa = ? WHERE id = ?', [Number(req.body.number), req.body.active === false ? 0 : 1, Number(req.params.id)])
  if (!result.affectedRows) throw fail(404, 'Mesa não encontrada.'); res.json({ id: Number(req.params.id) })
} catch (e) { next(e) } })

app.use((err, _req, res, _next) => {
  if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Este registro já existe.' })
  if (err.code === 'ER_NO_REFERENCED_ROW_2') return res.status(400).json({ error: 'Categoria inválida.' })
  if (!err.status) console.error(err)
  res.status(err.status || 500).json({ error: err.status ? err.message : 'Erro interno. Tente novamente.' })
})

if (process.env.NODE_ENV !== 'test') app.listen(Number(process.env.PORT || 3001), () => console.log(`Garfy API na porta ${process.env.PORT || 3001}`))
export default app
