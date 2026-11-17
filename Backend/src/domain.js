export const orderStatuses = ['received', 'preparing', 'ready', 'served', 'cancelled']

export function validItems(items) {
  return Array.isArray(items) && items.length > 0 && items.length <= 50 &&
    items.every(item => Number.isInteger(item.productId) && item.productId > 0 &&
      Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 20 &&
      ['traditional', 'large'].includes(item.size))
}

export function priceOrder(items, products) {
  let totalCents = 0
  const lines = items.map(item => {
    const product = products.find(p => p.id === item.productId && p.disponivel)
    if (!product) throw Object.assign(new Error('Produto indisponível.'), { status: 409 })
    const unitPriceCents = product.preco_centavos + (item.size === 'large' ? 400 : 0)
    totalCents += unitPriceCents * item.quantity
    return { productId: product.id, name: product.nome, imageUrl: product.url_imagem,
      size: item.size, quantity: item.quantity, unitPriceCents }
  })
  return { lines, totalCents }
}
