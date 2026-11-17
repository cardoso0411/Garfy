import test from 'node:test'
import assert from 'node:assert/strict'
import { priceOrder, validItems } from '../src/domain.js'

test('calcula o total com tamanho e quantidade usando preço do servidor', () => {
  const products = [{ id: 1, nome: 'Pastel', preco_centavos: 1690, url_imagem: '', disponivel: 1 }]
  assert.deepEqual(priceOrder([{ productId: 1, size: 'large', quantity: 2 }], products), {
    lines: [{ productId: 1, name: 'Pastel', imageUrl: '', size: 'large', quantity: 2, unitPriceCents: 2090 }],
    totalCents: 4180,
  })
})

test('recusa produto indisponível e quantidades inválidas', () => {
  assert.throws(() => priceOrder([{ productId: 1, size: 'traditional', quantity: 1 }], [{ id: 1, disponivel: 0 }]), /indisponível/)
  assert.equal(validItems([]), false)
  assert.equal(validItems([{ productId: 1, quantity: 0, size: 'traditional' }]), false)
  assert.equal(validItems([{ productId: 1, quantity: 2, size: 'large' }]), true)
})
