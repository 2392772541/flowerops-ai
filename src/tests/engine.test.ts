import { describe, expect, it } from 'vitest'
import { approveProposal, baseDemand, effectiveQty, executeProposal, expandRecipe, freshnessFactor, inventorySummary, recommendedPurchase, sellableQty } from '../domain/engine'
import { demoState } from '../data/demoData'

describe('FlowerOps 领域规则', () => {
  it('可售库存扣除预留、质量冻结和过期量', () => {
    expect(sellableQty(demoState.lots[0])).toBe(162)
    expect(sellableQty(demoState.lots[4])).toBe(48)
  })
  it('临期批次按透明的新鲜度系数折算有效库存', () => {
    expect(freshnessFactor('2026-09-05')).toBe(0.2)
    expect(effectiveQty(demoState.lots[0])).toBeCloseTo(32.4)
  })
  it('库存汇总由批次事实重算而不是读取手工余额', () => {
    const summary = inventorySummary(demoState)
    expect(summary.onHand).toBe(1215)
    expect(summary.sellable).toBe(824)
  })
  it('花束订单可以展开为花材需求', () => {
    expect(expandRecipe(demoState, 'B-LOVE', 2)).toEqual([
      { productId: 'P-ROSE-R', quantity: 38 },
      { productId: 'P-EUS-W', quantity: 10 },
      { productId: 'P-EUC', quantity: 12 }
    ])
  })
  it('补货量不产生负数', () => {
    expect(recommendedPurchase({ forecastLeadTime: 300, safetyStock: 100, sellableStock: 150, inboundConfirmed: 50 })).toBe(200)
    expect(recommendedPurchase({ forecastLeadTime: 100, safetyStock: 20, sellableStock: 300, inboundConfirmed: 0 })).toBe(0)
  })
  it('需求预测使用可解释权重', () => { expect(baseDemand([100, 80, 60, 40])).toBe(80) })
  it('未批准的 AI 提案不能直接产生采购单', () => {
    const result = executeProposal(structuredClone(demoState), 'AP-001')
    expect(result.purchaseOrders).toHaveLength(demoState.purchaseOrders.length)
  })
  it('批准后执行只创建采购草稿并留下审计记录', () => {
    const approved = approveProposal(structuredClone(demoState), 'AP-001')
    const result = executeProposal(approved, 'AP-001')
    expect(result.purchaseOrders).toHaveLength(demoState.purchaseOrders.length + 1)
    expect(result.purchaseOrders[0].status).toBe('DRAFT')
    expect(result.proposals.find(x => x.id === 'AP-001')?.status).toBe('SUCCEEDED')
    expect(result.auditEvents[0].eventType).toBe('PROPOSAL_EXECUTED')
  })
  it('相同幂等键重复执行不会产生第二个采购单', () => {
    const approved = approveProposal(structuredClone(demoState), 'AP-001')
    const once = executeProposal(approved, 'AP-001')
    const twice = executeProposal({ ...once, proposals: once.proposals.map(x => x.id === 'AP-001' ? { ...x, status: 'APPROVED' as const } : x) }, 'AP-001')
    expect(twice.purchaseOrders).toHaveLength(once.purchaseOrders.length)
  })
})
