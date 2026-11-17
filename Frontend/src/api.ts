export type Category = { id: number; name: string; active?: boolean }
export type Product = { id: number; categoryId: number; category: string; name: string; description: string; priceCents: number; imageUrl: string; badge: string; available: boolean }
export type Table = { id?: number; number: number; active?: boolean }
export type CartItem = { productId: number; quantity: number; size: 'traditional' | 'large' }
export type Order = { id: number; tableNumber: number; phone?: string; status: string; paid: boolean; totalCents: number; createdAt: string; trackingToken?: string; items?: { name: string; imageUrl: string; size: string; quantity: number; unitPriceCents: number }[] }

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch('/api' + path, {
    credentials: 'same-origin', ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (response.status === 204) return undefined as T
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'Não foi possível concluir a operação.')
  return data as T
}
export const money = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
