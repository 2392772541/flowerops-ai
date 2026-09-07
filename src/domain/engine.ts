import type { ActionProposal, AppState, InventoryLot, ProposalType, PurchaseOrder, RiskLevel } from './types'
import { can, type BusinessAction, type Role } from './permissions'
import { validateActionProposal, type ProposalValidation } from './proposals'

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

export function scenarioOrderValue(state: AppState, date = today) {
  return state.orders.filter(order => order.deliveryAt.slice(0, 10) === date).reduce((sum, order) => sum + order.totalAmount, 0)
}
export function scenarioGrossProfit(state: AppState, date = today) {
  return state.orders.filter(order => order.deliveryAt.slice(0, 10) === date).reduce((sum, order) => {
    return sum + order.items.reduce((itemSum, item) => {
      const product = state.products.find(productItem => productItem.id === item.productId)
      return itemSum + (item.unitPrice - (product?.defaultCost ?? item.unitPrice)) * item.quantity
    }, 0)
  }, 0)
}
export function proposalSimulation(state: AppState, proposal: ActionProposal) {
  if (proposal.type === 'CREATE_PURCHASE_ORDER') {
    const payload = proposal.payload as { quantity?: number; unitCost?: number }
    const purchaseCost = (payload.quantity ?? 0) * (payload.unitCost ?? 0)
    return {
      label: '采购资金占用情景',
      value: currency(purchaseCost),
      formula: `${payload.quantity ?? 0} 枝 × ${currency(payload.unitCost ?? 0)}/枝`,
      boundary: '仅计算采购草稿金额；未估算真实缺货率或销售提升。'
    }
  }
  if (proposal.type === 'CREATE_WASTE_PROPOSAL') {
    const payload = proposal.payload as { lotId?: string; suggestedDiscount?: number }
    const lot = state.lots.find(item => item.id === payload.lotId)
    const product = lot && state.products.find(item => item.id === lot.productId)
    const qty = lot ? sellableQty(lot) : 0
    const discount = payload.suggestedDiscount ?? 0
    const simulatedRevenue = qty * (product?.salePrice ?? 0) * (1 - discount)
    return {
      label: '全部售出情景收入',
      value: currency(simulatedRevenue),
      formula: `${qty} 枝 × ${currency(product?.salePrice ?? 0)}/枝 × (1 - ${percent(discount)})`,
      boundary: '上限情景，不代表售罄概率、实际销售额或损耗改善。'
    }
  }
  if (proposal.type === 'CREATE_COLLECTION_DRAFT') {
    const payload = proposal.payload as { customerId?: string }
    const overdue = state.receivables.filter(item => item.customerId === payload.customerId && item.status === 'OVERDUE').reduce((sum, item) => sum + item.amount - item.paidAmount, 0)
    return { label: '当前可追溯逾期余额', value: currency(overdue), formula: '应收金额 - 已支付金额', boundary: '生成沟通草稿，不预测回款日期或成功率。' }
  }
  return { label: '情景模拟', value: '需人工复核', formula: '由提案载荷与经营约束共同决定', boundary: '不宣称真实业务收益。' }
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

const approvalActionByProposal: Record<ProposalType, BusinessAction> = {
  CREATE_PURCHASE_ORDER: 'APPROVE_PURCHASE',
  CREATE_COLLECTION_DRAFT: 'SEND_COLLECTION',
  CREATE_PRICE_CHANGE: 'CHANGE_PRICE',
  CREATE_WASTE_PROPOSAL: 'SCRAP_STOCK'
}

function contextualValidation(state: AppState, proposal: ActionProposal): ProposalValidation {
  const base = validateActionProposal(proposal)
  const issues = [...base.issues]
  if (proposal.type === 'CREATE_PURCHASE_ORDER') {
    const payload = proposal.payload as { supplierId?: string; productId?: string }
    const supplier = state.suppliers.find(item => item.id === payload.supplierId)
    if (!supplier) issues.push('supplierId: 供应商不存在')
    if (!state.products.some(item => item.id === payload.productId)) issues.push('productId: 商品不存在')
    if (supplier && payload.productId && !supplier.products.includes(payload.productId)) issues.push('supplierId: 该供应商不供应所选商品')
  } else if (proposal.type === 'CREATE_COLLECTION_DRAFT') {
    const payload = proposal.payload as { customerId?: string }
    if (!state.customers.some(item => item.id === payload.customerId)) issues.push('customerId: 客户不存在')
  } else if (proposal.type === 'CREATE_PRICE_CHANGE') {
    const payload = proposal.payload as { productId?: string }
    if (!state.products.some(item => item.id === payload.productId)) issues.push('productId: 商品不存在')
  } else if (proposal.type === 'CREATE_WASTE_PROPOSAL') {
    const payload = proposal.payload as { lotId?: string; quantity?: number }
    const lot = state.lots.find(item => item.id === payload.lotId)
    if (!lot) issues.push('lotId: 花材批次不存在')
    if (lot && payload.quantity && payload.quantity > sellableQty(lot)) issues.push('quantity: 报损数量不能超过批次可售数量')
  }
  return { ...base, valid: issues.length === 0, issues }
}

function validationFailed(state: AppState, proposal: ActionProposal, validation: ProposalValidation, actor: string, actorRole: Role): AppState {
  const now = new Date().toISOString()
  const detail = `提案校验失败：${validation.issues.join('；')}`
  return {
    ...state,
    proposals: state.proposals.map(item => item.id === proposal.id ? {
      ...item,
      status: 'VALIDATION_FAILED',
      validationIssues: validation.issues,
      executionResult: detail
    } : item),
    auditEvents: [{
      id: uid('AUD'), eventType: 'PROPOSAL_VALIDATION_FAILED', entityType: 'ActionProposal', entityId: proposal.id,
      actor, actorRole, occurredAt: now, requestId: uid('REQ'), idempotencyKey: proposal.idempotencyKey,
      before: proposal.status, after: 'VALIDATION_FAILED', result: 'FAILED', detail
    }, ...state.auditEvents]
  }
}

function permissionDenied(state: AppState, proposal: ActionProposal, actor: string, role: Role, action: BusinessAction, stage: 'APPROVAL' | 'REJECTION' | 'EXECUTION'): AppState {
  const now = new Date().toISOString()
  const detail = `权限拒绝：角色 ${role} 无权执行 ${action}，未产生业务写入`
  return {
    ...state,
    auditEvents: [{
      id: uid('AUD'), eventType: `PROPOSAL_${stage}_DENIED`, entityType: 'ActionProposal', entityId: proposal.id,
      actor, actorRole: role, occurredAt: now, requestId: uid('REQ'), idempotencyKey: proposal.idempotencyKey,
      before: proposal.status, after: proposal.status, result: 'REJECTED', detail
    }, ...state.auditEvents]
  }
}

export function approveProposal(state: AppState, proposalId: string, actor = '店长 · 林夏', role: Role = 'MANAGER'): AppState {
  const proposal = state.proposals.find(item => item.id === proposalId)
  if (!proposal || proposal.status !== 'AWAITING_APPROVAL') return state
  const validation = contextualValidation(state, proposal)
  if (!validation.valid) return validationFailed(state, proposal, validation, actor, role)
  const action = approvalActionByProposal[proposal.type]
  if (!can(role, action)) return permissionDenied(state, proposal, actor, role, action, 'APPROVAL')
  const now = new Date().toISOString()
  return {
    ...state,
    proposals: state.proposals.map(item => item.id === proposalId ? {
      ...item, status: 'APPROVED', approvedBy: actor, approvedAt: now, validationIssues: undefined
    } : item),
    auditEvents: [{
      id: uid('AUD'), eventType: 'PROPOSAL_APPROVED', entityType: 'ActionProposal', entityId: proposalId,
      actor, actorRole: role, occurredAt: now, requestId: uid('REQ'), idempotencyKey: proposal.idempotencyKey,
      before: 'AWAITING_APPROVAL', after: 'APPROVED', result: 'SUCCESS',
      detail: `角色 ${role} 人工核对证据、预算与执行内容后批准`
    }, ...state.auditEvents]
  }
}

export function rejectProposal(state: AppState, proposalId: string, actor = '店长 · 林夏', role: Role = 'MANAGER'): AppState {
  const proposal = state.proposals.find(item => item.id === proposalId)
  if (!proposal || proposal.status !== 'AWAITING_APPROVAL') return state
  const action = approvalActionByProposal[proposal.type]
  if (!can(role, action)) return permissionDenied(state, proposal, actor, role, action, 'REJECTION')
  const now = new Date().toISOString()
  return {
    ...state,
    proposals: state.proposals.map(item => item.id === proposalId ? { ...item, status: 'REJECTED', executionResult: '人工拒绝：暂不执行' } : item),
    auditEvents: [{
      id: uid('AUD'), eventType: 'PROPOSAL_REJECTED', entityType: 'ActionProposal', entityId: proposalId,
      actor, actorRole: role, occurredAt: now, requestId: uid('REQ'), idempotencyKey: proposal.idempotencyKey,
      before: 'AWAITING_APPROVAL', after: 'REJECTED', result: 'REJECTED', detail: `角色 ${role} 人工拒绝，未产生任何正式业务写入`
    }, ...state.auditEvents]
  }
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

export function executeProposal(state: AppState, proposalId: string, actor = '系统执行器', role: Role = 'SYSTEM_EXECUTOR', executedAt = new Date().toISOString()): AppState {
  const proposal = state.proposals.find(item => item.id === proposalId)
  if (!proposal || proposal.status !== 'APPROVED') return state
  if (!can(role, 'EXECUTE_APPROVED_PROPOSAL')) return permissionDenied(state, proposal, actor, role, 'EXECUTE_APPROVED_PROPOSAL', 'EXECUTION')
  const validation = contextualValidation(state, proposal)
  if (!validation.valid) return validationFailed(state, proposal, validation, actor, role)
  const now = executedAt
  if (state.executedKeys.includes(proposal.idempotencyKey)) {
    return {
      ...state,
      auditEvents: [{
        id: uid('AUD'), eventType: 'PROPOSAL_EXECUTION_SKIPPED', entityType: 'ActionProposal', entityId: proposal.id,
        actor, actorRole: role, occurredAt: now, requestId: uid('REQ'), idempotencyKey: proposal.idempotencyKey,
        before: 'APPROVED', after: 'APPROVED', result: 'SUCCESS', detail: '幂等键已执行，安全跳过重复业务写入'
      }, ...state.auditEvents]
    }
  }
  let purchaseOrders = state.purchaseOrders
  let result = '动作已安全执行'
  if (proposal.type === 'CREATE_PURCHASE_ORDER') {
    const payload = proposal.payload as { supplierId: string; productId: string; quantity: number; unitCost: number }
    const supplier = state.suppliers.find(item => item.id === payload.supplierId)!
    const po: PurchaseOrder = {
      id: uid('PO'), supplierId: payload.supplierId, status: 'DRAFT',
      amount: payload.quantity * payload.unitCost, expectedAt: addDays(now.slice(0, 10), supplier.leadTimeDays), createdAt: now,
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
    auditEvents: [{
      id: uid('AUD'), eventType: 'PROPOSAL_EXECUTED', entityType: 'ActionProposal', entityId: proposalId,
      actor, actorRole: role, occurredAt: now, requestId: uid('REQ'), idempotencyKey: proposal.idempotencyKey,
      before: 'APPROVED', after: 'SUCCEEDED', result: 'SUCCESS', detail: result
    }, ...state.auditEvents]
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
