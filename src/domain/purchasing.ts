import type { AppState, PurchaseOrder } from './types'
import { canTransitionPurchaseOrder } from './workflow'

export function advancePurchase(state: AppState, id: string, target: PurchaseOrder['status'], sellBy?: string): AppState {
  const po = state.purchaseOrders.find(p => p.id === id)
  if (!po || !canTransitionPurchaseOrder(po.status, target)) throw new Error('采购单状态已改变，请刷新后重试')
  const now = new Date().toISOString()
  if (target === 'RECEIVED' && (!sellBy || sellBy <= now.slice(0, 10))) throw new Error('请选择晚于今天的可售截止日期')
  const lots = target === 'RECEIVED' ? po.items.map((item, i) => ({
    id: `${id}-lot-${i}`, batchNo: `${id}-${i + 1}`, productId: item.productId,
    supplierId: po.supplierId, qtyOnHand: item.quantity, qtyReserved: 0, qtyQualityHold: 0,
    qtyExpired: 0, unitCost: item.unitCost, receivedAt: now.slice(0, 10), sellBy: sellBy!,
    qualityGrade: 'A' as const, status: 'AVAILABLE' as const,
  })) : []
  return { ...state, purchaseOrders: state.purchaseOrders.map(p => p.id === id ? { ...p, status: target } : p),
    lots: [...lots, ...state.lots], movements: [...lots.map(lot => ({ id: `${lot.id}-receipt`, lotId: lot.id,
      productId: lot.productId, type: 'RECEIPT' as const, quantity: lot.qtyOnHand, referenceId: id,
      occurredAt: now, operator: '演示操作人', note: '采购整单验收合格入库' })), ...state.movements],
    auditEvents: [{ id: crypto.randomUUID(), entityId: id, entityType: 'PurchaseOrder', eventType: 'PURCHASE_TRANSITION',
      actor: '演示操作人', occurredAt: now, requestId: crypto.randomUUID(), before: po.status, after: target,
      result: 'SUCCESS', detail: target === 'SENT' ? '记录线下已下单；系统未发送外部消息' : `采购状态更新：${target}` }, ...state.auditEvents] }
}
