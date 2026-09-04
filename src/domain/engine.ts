import type { ActionProposal, AppState, InventoryLot, PurchaseOrder, RiskLevel } from './types'

export const today = '2026-09-04'
export const currency = (value: number) => new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 0 }).format(value)
export const percent = (value: number) => new Intl.NumberFormat('zh-CN', { style: 'percent', maximumFractionDigits: 1 }).format(value)

export function daysUntil(date: string, from = today) {
  return Math.ceil((new Date(date + 'T00:00:00').getTime() - new Date(from + 'T00:00:00').getTime()) / 86400000)
}
export function freshnessFactor(sellBy: string, from = today) {
  const days = daysUntil(sellBy, from)
  if (days >= 5) return 1
  if (days >= 3) return 0.8
  if (days === 2) return 0.5
  if (days === 1) return 0.2
  return 0
}
export function sellableQty(lot: InventoryLot) {
  return Math.max(0, lot.qtyOnHand - lot.qtyReserved - lot.qtyQualityHold - lot.qtyExpired)
}
export function effectiveQty(lot: InventoryLot) {
  return sellableQty(lot) * freshnessFactor(lot.sellBy)
}
export function inventorySummary(state: AppState) {
  const onHand = state.lots.reduce((sum, lot) => sum + lot.qtyOnHand, 0)
  const reserved = state.lots.reduce((sum, lot) => sum + lot.qtyReserved, 0)
  const qualityHold = state.lots.reduce((sum, lot) => sum + lot.qtyQualityHold, 0)
  const expired = state.lots.reduce((sum, lot) => sum + lot.qtyExpired, 0)
  const sellable = state.lots.reduce((sum, lot) => sum + sellableQty(lot), 0)
  const effective = state.lots.reduce((sum, lot) => sum + effectiveQty(lot), 0)
  const value = state.lots.reduce((sum, lot) => sum + sellableQty(lot) * lot.unitCost, 0)
  return { onHand, reserved, qualityHold, expired, sellable, effective, value }
}
export function expandRecipe(state: AppState, productId: string, quantity: number) {
  const recipe = state.recipes.find(item => item.outputProductId === productId)
  return recipe ? recipe.items.map(item => ({ productId: item.productId, quantity: item.quantity * quantity })) : [{ productId, quantity }]
}
export function baseDemand(history: [number, number, number, number]) {
  return history[0] * 0.4 + history[1] * 0.3 + history[2] * 0.2 + history[3] * 0.1
}
export function recommendedPurchase(input: { forecastLeadTime: number; safetyStock: number; sellableStock: number; inboundConfirmed: number }) {
  return Math.max(0, Math.ceil(input.forecastLeadTime + input.safetyStock - input.sellableStock - input.inboundConfirmed))
}
export function wasteRisk(lot: InventoryLot, unsoldProbability: number) {
  return sellableQty(lot) * lot.unitCost * unsoldProbability
}
export function riskLabel(risk: RiskLevel) { return risk === 'HIGH' ? '高风险' : risk === 'MEDIUM' ? '中风险' : '低风险' }
export function proposalTypeLabel(type: ActionProposal['type']) {
  return ({ CREATE_PURCHASE_ORDER: '创建采购草稿', CREATE_COLLECTION_DRAFT: '创建催款草稿', CREATE_PRICE_CHANGE: '创建调价提案', CREATE_WASTE_PROPOSAL: '创建报损提案' })[type]
}

const uid = (prefix: string) => prefix + '-' + Math.random().toString(36).slice(2, 8)
export function approveProposal(state: AppState, proposalId: string, actor = '店长 · 林夏'): AppState {
  const proposal = state.proposals.find(item => item.id === proposalId)
  if (!proposal || proposal.status !== 'AWAITING_APPROVAL') return state
  const now = new Date().toISOString()
  return {
    ...state,
    proposals: state.proposals.map(item => item.id === proposalId ? { ...item, status: 'APPROVED', approvedBy: actor, approvedAt: now } : item),
    auditEvents: [{ id: uid('AUD'), eventType: 'PROPOSAL_APPROVED', entityType: 'ActionProposal', entityId: proposalId, actor, occurredAt: now, requestId: uid('REQ'), idempotencyKey: proposal.idempotencyKey, before: 'AWAITING_APPROVAL', after: 'APPROVED', result: 'SUCCESS', detail: '人工核对证据、预算与执行内容后批准' }, ...state.auditEvents]
  }
}
export function rejectProposal(state: AppState, proposalId: string, actor = '店长 · 林夏'): AppState {
  const proposal = state.proposals.find(item => item.id === proposalId)
  if (!proposal || proposal.status !== 'AWAITING_APPROVAL') return state
  const now = new Date().toISOString()
  return {
    ...state,
    proposals: state.proposals.map(item => item.id === proposalId ? { ...item, status: 'REJECTED', executionResult: '人工拒绝：暂不执行' } : item),
    auditEvents: [{ id: uid('AUD'), eventType: 'PROPOSAL_REJECTED', entityType: 'ActionProposal', entityId: proposalId, actor, occurredAt: now, requestId: uid('REQ'), idempotencyKey: proposal.idempotencyKey, before: 'AWAITING_APPROVAL', after: 'REJECTED', result: 'REJECTED', detail: '人工拒绝，未产生任何正式业务写入' }, ...state.auditEvents]
  }
}
export function executeProposal(state: AppState, proposalId: string, actor = '系统执行器'): AppState {
  const proposal = state.proposals.find(item => item.id === proposalId)
  if (!proposal || proposal.status !== 'APPROVED') return state
  if (state.executedKeys.includes(proposal.idempotencyKey)) return state
  const now = new Date().toISOString()
  let purchaseOrders = state.purchaseOrders
  let result = '动作已安全执行'
  if (proposal.type === 'CREATE_PURCHASE_ORDER') {
    const payload = proposal.payload as { supplierId: string; productId: string; quantity: number; unitCost: number }
    const po: PurchaseOrder = {
      id: uid('PO'), supplierId: payload.supplierId, status: 'DRAFT',
      amount: payload.quantity * payload.unitCost, expectedAt: '2026-09-07', createdAt: now,
      sourceProposalId: proposal.id, items: [{ productId: payload.productId, quantity: payload.quantity, unitCost: payload.unitCost }]
    }
    purchaseOrders = [po, ...purchaseOrders]
    result = '已创建采购草稿，尚未发送供应商'
  } else if (proposal.type === 'CREATE_COLLECTION_DRAFT') {
    result = '已生成催款消息草稿，尚未对外发送'
  } else if (proposal.type === 'CREATE_PRICE_CHANGE') {
    result = '已创建调价待办，商品售价尚未变更'
  } else if (proposal.type === 'CREATE_WASTE_PROPOSAL') {
    result = '已创建报损复核单，库存余额尚未变更'
  }
  return {
    ...state, purchaseOrders, executedKeys: [...state.executedKeys, proposal.idempotencyKey],
    proposals: state.proposals.map(item => item.id === proposalId ? { ...item, status: 'SUCCEEDED', executionResult: result } : item),
    auditEvents: [{ id: uid('AUD'), eventType: 'PROPOSAL_EXECUTED', entityType: 'ActionProposal', entityId: proposalId, actor, occurredAt: now, requestId: uid('REQ'), idempotencyKey: proposal.idempotencyKey, before: 'APPROVED', after: 'SUCCEEDED', result: 'SUCCESS', detail: result }, ...state.auditEvents]
  }
}
export function runSafeQuestion(state: AppState, question: string) {
  const summary = inventorySummary(state)
  const overdue = state.receivables.filter(item => item.status === 'OVERDUE').reduce((sum, item) => sum + item.amount - item.paidAmount, 0)
  const nearExpiry = state.lots.filter(item => daysUntil(item.sellBy) <= 2 && sellableQty(item) > 0)
  if (/库存|临期|损耗/.test(question)) return { title: '临期库存诊断', answer: '当前共有 ' + nearExpiry.length + ' 个高关注批次，可售库存 ' + summary.sellable + ' 枝，有效库存折算为 ' + Math.round(summary.effective) + ' 枝。优先处理红玫瑰和洋桔梗临期批次。', evidence: ['inventory_lots', 'inventory_movements'], query: '只读模板：按 sell_by、预留、冻结和过期量聚合批次库存' }
  if (/应收|欠款|催款/.test(question)) return { title: '应收风险诊断', answer: '逾期未收余额为 ' + currency(overdue) + '。建议先联系高信用但已逾期的企业客户，AI 只能生成催款草稿，发送前必须人工确认。', evidence: ['receivables', 'customers', 'sales_orders'], query: '只读模板：关联客户、订单与应收状态，计算到期未收余额' }
  return { title: '经营概览', answer: '系统识别到临期库存和企业应收两个主要风险。建议先处理时间敏感的鲜花库存，再跟进逾期款项。', evidence: ['inventory_lots', 'receivables'], query: '只读模板：经营异常摘要，不执行任意 SQL' }
}
