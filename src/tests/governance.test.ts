import { describe, expect, it } from 'vitest'
import { approveProposal, executeProposal, rejectProposal } from '../domain/engine'
import { can, humanApprovalRequired, requirePermission } from '../domain/permissions'
import { validateActionProposal } from '../domain/proposals'
import {
  assertTransition,
  canTransitionLot,
  canTransitionPurchaseOrder,
  canTransitionReceivable,
  canTransitionSalesOrder
} from '../domain/workflow'
import { demoState } from '../data/demoData'
import type { ActionProposal, AppState } from '../domain/types'

function proposal(overrides: Partial<ActionProposal> = {}): ActionProposal {
  return {
    id: 'AP-TEST',
    type: 'CREATE_PURCHASE_ORDER',
    title: '测试采购提案',
    reason: '预测需求高于有效库存，需要补充安全库存。',
    evidence: [{ label: '预测缺口', value: '100 枝', detail: '订单与库存聚合结果' }],
    payload: { supplierId: 'S-YN01', productId: 'P-ROSE-R', quantity: 100, unitCost: 2.9 },
    expectedImpact: '降低未来三天缺货风险。',
    risk: 'MEDIUM',
    status: 'AWAITING_APPROVAL',
    idempotencyKey: 'test-proposal-v1',
    generatedAt: '2026-09-04T10:00:00+08:00',
    ...overrides
  }
}

function withProposal(value: ActionProposal): AppState {
  return { ...structuredClone(demoState), proposals: [value, ...structuredClone(demoState.proposals)] }
}

describe('角色权限矩阵', () => {
  it('AI 只能读取经营指标和生成提案', () => {
    expect(can('AI_AGENT', 'READ_METRICS')).toBe(true)
    expect(can('AI_AGENT', 'GENERATE_PROPOSAL')).toBe(true)
    expect(can('AI_AGENT', 'APPROVE_PURCHASE')).toBe(false)
    expect(can('AI_AGENT', 'EXECUTE_APPROVED_PROPOSAL')).toBe(false)
  })

  it('店长可以批准采购但不能管理角色', () => {
    expect(can('MANAGER', 'APPROVE_PURCHASE')).toBe(true)
    expect(can('MANAGER', 'MANAGE_ROLES')).toBe(false)
  })

  it('采购员可以发送已批准采购单但不能批准自己的采购提案', () => {
    expect(can('PURCHASER', 'SEND_PURCHASE')).toBe(true)
    expect(can('PURCHASER', 'APPROVE_PURCHASE')).toBe(false)
  })

  it('只有系统执行器拥有执行已批准提案的专用权限', () => {
    expect(can('SYSTEM_EXECUTOR', 'EXECUTE_APPROVED_PROPOSAL')).toBe(true)
    expect(can('OWNER', 'EXECUTE_APPROVED_PROPOSAL')).toBe(false)
  })

  it('越权调用会抛出明确错误', () => {
    expect(() => requirePermission('AI_AGENT', 'APPROVE_PURCHASE')).toThrow('权限不足')
  })

  it('只读、生成提案和批准后执行不需要再次发起人工审批', () => {
    expect(humanApprovalRequired('READ_METRICS')).toBe(false)
    expect(humanApprovalRequired('GENERATE_PROPOSAL')).toBe(false)
    expect(humanApprovalRequired('EXECUTE_APPROVED_PROPOSAL')).toBe(false)
    expect(humanApprovalRequired('CHANGE_PRICE')).toBe(true)
  })
})

describe('AI 动作提案 Schema 校验', () => {
  it('合法采购提案返回预计采购金额', () => {
    const result = validateActionProposal(proposal())
    expect(result.valid).toBe(true)
    expect(result.estimatedAmount).toBe(290)
  })

  it('超过五千元的采购必须标记为高风险', () => {
    const result = validateActionProposal(proposal({ payload: { supplierId: 'S-YN01', productId: 'P-ROSE-R', quantity: 2000, unitCost: 3 }, risk: 'MEDIUM' }))
    expect(result.valid).toBe(false)
    expect(result.issues.join(' ')).toContain('高风险')
  })

  it('采购数量必须为正整数', () => {
    const result = validateActionProposal(proposal({ payload: { supplierId: 'S-YN01', productId: 'P-ROSE-R', quantity: -1, unitCost: 3 } }))
    expect(result.valid).toBe(false)
  })

  it('提案必须提供原因、证据和预期影响', () => {
    const result = validateActionProposal(proposal({ reason: '', evidence: [], expectedImpact: '' }))
    expect(result.issues).toHaveLength(3)
  })

  it('催款语气只能使用受控选项', () => {
    const result = validateActionProposal(proposal({ type: 'CREATE_COLLECTION_DRAFT', payload: { customerId: 'C-001', tone: '威胁客户' } }))
    expect(result.valid).toBe(false)
  })

  it('报损促销折扣不能超过五折', () => {
    const result = validateActionProposal(proposal({ type: 'CREATE_WASTE_PROPOSAL', payload: { lotId: 'LOT-S01', suggestedDiscount: 0.8 } }))
    expect(result.valid).toBe(false)
  })

  it('调价提案必须包含合法商品和正数价格', () => {
    const valid = validateActionProposal(proposal({ type: 'CREATE_PRICE_CHANGE', payload: { productId: 'P-ROSE-R', newPrice: 8.8 } }))
    const invalid = validateActionProposal(proposal({ type: 'CREATE_PRICE_CHANGE', payload: { productId: 'P-ROSE-R', newPrice: 0 } }))
    expect(valid.valid).toBe(true)
    expect(invalid.valid).toBe(false)
  })
})

describe('提案审批与安全执行', () => {
  it('AI 不能批准采购提案并留下拒绝审计', () => {
    const state = withProposal(proposal())
    const result = approveProposal(state, 'AP-TEST', '规则AI', 'AI_AGENT')
    expect(result.proposals[0].status).toBe('AWAITING_APPROVAL')
    expect(result.auditEvents[0].eventType).toBe('PROPOSAL_APPROVAL_DENIED')
    expect(result.auditEvents[0].result).toBe('REJECTED')
  })

  it('采购员不能批准自己的采购提案', () => {
    const result = approveProposal(withProposal(proposal()), 'AP-TEST', '采购员 · 陈禾', 'PURCHASER')
    expect(result.proposals[0].status).toBe('AWAITING_APPROVAL')
  })

  it('店长可以批准通过校验的采购提案', () => {
    const result = approveProposal(withProposal(proposal()), 'AP-TEST', '店长 · 林夏', 'MANAGER')
    expect(result.proposals[0].status).toBe('APPROVED')
    expect(result.proposals[0].approvedBy).toBe('店长 · 林夏')
    expect(result.auditEvents[0].actorRole).toBe('MANAGER')
  })

  it('财务可以批准催款草稿提案', () => {
    const value = proposal({ type: 'CREATE_COLLECTION_DRAFT', payload: { customerId: 'C-001', tone: '友好提醒' } })
    const result = approveProposal(withProposal(value), 'AP-TEST', '财务 · 苏晴', 'FINANCE')
    expect(result.proposals[0].status).toBe('APPROVED')
  })

  it('销售角色不能批准催款草稿提案', () => {
    const value = proposal({ type: 'CREATE_COLLECTION_DRAFT', payload: { customerId: 'C-001', tone: '友好提醒' } })
    const result = approveProposal(withProposal(value), 'AP-TEST', '销售 · 江宁', 'SALES')
    expect(result.proposals[0].status).toBe('AWAITING_APPROVAL')
  })

  it('Schema 错误的提案进入校验失败而不是批准状态', () => {
    const value = proposal({ payload: { supplierId: '', productId: 'P-ROSE-R', quantity: 0, unitCost: 2.9 } })
    const result = approveProposal(withProposal(value), 'AP-TEST')
    expect(result.proposals[0].status).toBe('VALIDATION_FAILED')
    expect(result.proposals[0].validationIssues?.length).toBeGreaterThan(0)
    expect(result.auditEvents[0].eventType).toBe('PROPOSAL_VALIDATION_FAILED')
  })

  it('引用不存在供应商的提案无法获批', () => {
    const value = proposal({ payload: { supplierId: 'S-NOT-FOUND', productId: 'P-ROSE-R', quantity: 10, unitCost: 2.9 } })
    const result = approveProposal(withProposal(value), 'AP-TEST')
    expect(result.proposals[0].status).toBe('VALIDATION_FAILED')
    expect(result.proposals[0].validationIssues?.join(' ')).toContain('供应商不存在')
  })

  it('供应商不供应目标商品时无法获批', () => {
    const value = proposal({ payload: { supplierId: 'S-GX03', productId: 'P-ROSE-R', quantity: 10, unitCost: 2.9 } })
    const result = approveProposal(withProposal(value), 'AP-TEST')
    expect(result.proposals[0].validationIssues?.join(' ')).toContain('不供应')
  })

  it('报损数量超过可售库存时无法获批', () => {
    const value = proposal({ type: 'CREATE_WASTE_PROPOSAL', payload: { lotId: 'LOT-S01', quantity: 999 } })
    const result = approveProposal(withProposal(value), 'AP-TEST')
    expect(result.proposals[0].status).toBe('VALIDATION_FAILED')
    expect(result.proposals[0].validationIssues?.join(' ')).toContain('可售数量')
  })

  it('AI 不能拒绝需要人工判断的业务提案', () => {
    const result = rejectProposal(withProposal(proposal()), 'AP-TEST', '规则AI', 'AI_AGENT')
    expect(result.proposals[0].status).toBe('AWAITING_APPROVAL')
    expect(result.auditEvents[0].eventType).toBe('PROPOSAL_REJECTION_DENIED')
  })

  it('普通人工角色不能冒充系统执行器执行提案', () => {
    const approved = approveProposal(withProposal(proposal()), 'AP-TEST')
    const result = executeProposal(approved, 'AP-TEST', '店长 · 林夏', 'MANAGER')
    expect(result.purchaseOrders).toHaveLength(approved.purchaseOrders.length)
    expect(result.auditEvents[0].eventType).toBe('PROPOSAL_EXECUTION_DENIED')
  })

  it('批准后若载荷被篡改，执行前二次校验会阻止写入', () => {
    const approved = approveProposal(withProposal(proposal()), 'AP-TEST')
    const tampered = {
      ...approved,
      proposals: approved.proposals.map(item => item.id === 'AP-TEST' ? { ...item, payload: { supplierId: 'S-YN01', productId: 'P-ROSE-R', quantity: -100, unitCost: 2.9 } } : item)
    }
    const result = executeProposal(tampered, 'AP-TEST')
    expect(result.purchaseOrders).toHaveLength(approved.purchaseOrders.length)
    expect(result.proposals[0].status).toBe('VALIDATION_FAILED')
  })

  it('合法执行创建草稿并按供应商交期计算预计到货日', () => {
    const approved = approveProposal(withProposal(proposal()), 'AP-TEST')
    const result = executeProposal(approved, 'AP-TEST', '系统执行器', 'SYSTEM_EXECUTOR', '2026-09-04T09:30:00+08:00')
    expect(result.purchaseOrders[0].status).toBe('DRAFT')
    expect(result.purchaseOrders[0].createdAt).toBe('2026-09-04T09:30:00+08:00')
    expect(result.purchaseOrders[0].expectedAt).toBe('2026-09-06')
    expect(result.purchaseOrders[0].expectedAt >= result.purchaseOrders[0].createdAt.slice(0, 10)).toBe(true)
    expect(result.proposals[0].status).toBe('SUCCEEDED')
    expect(result.auditEvents[0].actorRole).toBe('SYSTEM_EXECUTOR')
  })

  it('重复幂等键会安全跳过并留下审计，不产生第二张采购单', () => {
    const approved = approveProposal(withProposal(proposal()), 'AP-TEST')
    const once = executeProposal(approved, 'AP-TEST')
    const retryState = { ...once, proposals: once.proposals.map(item => item.id === 'AP-TEST' ? { ...item, status: 'APPROVED' as const } : item) }
    const twice = executeProposal(retryState, 'AP-TEST')
    expect(twice.purchaseOrders).toHaveLength(once.purchaseOrders.length)
    expect(twice.auditEvents[0].eventType).toBe('PROPOSAL_EXECUTION_SKIPPED')
  })
})

describe('关键业务状态机', () => {
  it('销售订单按确认、预留和备货顺序流转', () => {
    expect(canTransitionSalesOrder('DRAFT', 'CONFIRMED')).toBe(true)
    expect(canTransitionSalesOrder('CONFIRMED', 'STOCK_RESERVED')).toBe(true)
    expect(canTransitionSalesOrder('STOCK_RESERVED', 'PREPARING')).toBe(true)
  })

  it('已完成订单不能直接取消，只能进入退款申请', () => {
    expect(canTransitionSalesOrder('COMPLETED', 'CANCELLED')).toBe(false)
    expect(canTransitionSalesOrder('COMPLETED', 'REFUND_PENDING')).toBe(true)
  })

  it('采购单不能从草稿跳级到批准', () => {
    expect(canTransitionPurchaseOrder('DRAFT', 'APPROVED')).toBe(false)
    expect(canTransitionPurchaseOrder('DRAFT', 'PENDING_APPROVAL')).toBe(true)
  })

  it('采购收货后必须经过对账才能关闭', () => {
    expect(canTransitionPurchaseOrder('RECEIVED', 'CLOSED')).toBe(false)
    expect(canTransitionPurchaseOrder('RECEIVED', 'RECONCILED')).toBe(true)
  })

  it('逾期应收核销必须先进入待核销状态', () => {
    expect(canTransitionReceivable('OVERDUE', 'WRITTEN_OFF')).toBe(false)
    expect(canTransitionReceivable('OVERDUE', 'WRITE_OFF_PENDING')).toBe(true)
    expect(canTransitionReceivable('WRITE_OFF_PENDING', 'WRITTEN_OFF')).toBe(true)
  })

  it('临期批次可以报损，但可售批次不能跳过临期流程直接报损', () => {
    expect(canTransitionLot('NEAR_EXPIRY', 'SCRAPPED')).toBe(true)
    expect(canTransitionLot('AVAILABLE', 'SCRAPPED')).toBe(false)
  })

  it('非法状态流转断言会给出明确错误', () => {
    expect(() => assertTransition(false, '销售订单', 'COMPLETED', 'CANCELLED')).toThrow('非法状态流转')
    expect(assertTransition(true, '销售订单', 'DRAFT', 'CONFIRMED')).toBe('CONFIRMED')
  })
})
