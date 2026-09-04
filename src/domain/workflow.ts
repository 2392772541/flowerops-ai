export type SalesOrderStatus = 'DRAFT' | 'CONFIRMED' | 'STOCK_RESERVED' | 'PREPARING' | 'READY' | 'DELIVERING' | 'COMPLETED' | 'CANCELLED' | 'REFUND_PENDING' | 'REFUNDED'
export type PurchaseOrderStatus = 'PROPOSED' | 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'SENT' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'RECONCILED' | 'CLOSED'
export type ReceivableStatus = 'OPEN' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'DISPUTED' | 'WRITE_OFF_PENDING' | 'WRITTEN_OFF'
export type LotStatus = 'EXPECTED' | 'RECEIVED' | 'AVAILABLE' | 'NEAR_EXPIRY' | 'DEPLETED' | 'QUALITY_HOLD' | 'REJECTED' | 'EXPIRED' | 'SCRAPPED'

const salesTransitions: Record<SalesOrderStatus, SalesOrderStatus[]> = {
  DRAFT: ['CONFIRMED', 'CANCELLED'], CONFIRMED: ['STOCK_RESERVED', 'CANCELLED'],
  STOCK_RESERVED: ['PREPARING', 'CANCELLED'], PREPARING: ['READY', 'CANCELLED'],
  READY: ['DELIVERING', 'CANCELLED'], DELIVERING: ['COMPLETED'],
  COMPLETED: ['REFUND_PENDING'], CANCELLED: [], REFUND_PENDING: ['REFUNDED'], REFUNDED: []
}
const purchaseTransitions: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  PROPOSED: ['DRAFT'], DRAFT: ['PENDING_APPROVAL'], PENDING_APPROVAL: ['APPROVED'],
  APPROVED: ['SENT'], SENT: ['PARTIALLY_RECEIVED', 'RECEIVED'],
  PARTIALLY_RECEIVED: ['RECEIVED'], RECEIVED: ['RECONCILED'], RECONCILED: ['CLOSED'], CLOSED: []
}
const receivableTransitions: Record<ReceivableStatus, ReceivableStatus[]> = {
  OPEN: ['PARTIALLY_PAID', 'PAID', 'OVERDUE', 'DISPUTED'], PARTIALLY_PAID: ['PAID', 'OVERDUE', 'DISPUTED'],
  PAID: [], OVERDUE: ['PARTIALLY_PAID', 'PAID', 'DISPUTED', 'WRITE_OFF_PENDING'],
  DISPUTED: ['OPEN', 'PARTIALLY_PAID', 'WRITE_OFF_PENDING'], WRITE_OFF_PENDING: ['WRITTEN_OFF'], WRITTEN_OFF: []
}
const lotTransitions: Record<LotStatus, LotStatus[]> = {
  EXPECTED: ['RECEIVED', 'REJECTED'], RECEIVED: ['AVAILABLE', 'QUALITY_HOLD', 'REJECTED'],
  AVAILABLE: ['NEAR_EXPIRY', 'DEPLETED', 'QUALITY_HOLD', 'EXPIRED'],
  NEAR_EXPIRY: ['DEPLETED', 'QUALITY_HOLD', 'EXPIRED', 'SCRAPPED'],
  DEPLETED: [], QUALITY_HOLD: ['AVAILABLE', 'REJECTED', 'SCRAPPED'], REJECTED: [], EXPIRED: ['SCRAPPED'], SCRAPPED: []
}

export const canTransitionSalesOrder = (from: SalesOrderStatus, to: SalesOrderStatus) => salesTransitions[from].includes(to)
export const canTransitionPurchaseOrder = (from: PurchaseOrderStatus, to: PurchaseOrderStatus) => purchaseTransitions[from].includes(to)
export const canTransitionReceivable = (from: ReceivableStatus, to: ReceivableStatus) => receivableTransitions[from].includes(to)
export const canTransitionLot = (from: LotStatus, to: LotStatus) => lotTransitions[from].includes(to)

export function assertTransition<T extends string>(allowed: boolean, entity: string, from: T, to: T): T {
  if (!allowed) throw new Error(`非法状态流转：${entity} 不能从 ${from} 进入 ${to}`)
  return to
}
