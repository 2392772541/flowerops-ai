import { describe, it, expect } from 'vitest'
import { demoState } from '../data/demoData'
import { advancePurchase } from '../domain/purchasing'

describe('采购验收入库', () => {
  it('收货原子增加批次和流水，重复收货不重复入库', () => {
    const state = structuredClone(demoState)
    const po = state.purchaseOrders.find(p => p.status === 'SENT')!
    const result = advancePurchase(state, po.id, 'RECEIVED', '2099-01-01')
    expect(result.lots.length).toBe(state.lots.length + po.items.length)
    expect(result.movements[0].referenceId).toBe(po.id)
    expect(result.lots[0].qtyOnHand).toBe(po.items[0].quantity)
    expect(() => advancePurchase(result, po.id, 'RECEIVED', '2099-01-01')).toThrow()
  })
  it('不能跳过审批或录入过期花材', () => {
    const state = structuredClone(demoState)
    const po = state.purchaseOrders.find(p => p.status === 'SENT')!
    expect(() => advancePurchase(state, po.id, 'RECEIVED', '2020-01-01')).toThrow()
    po.status = 'DRAFT'
    expect(() => advancePurchase(state, po.id, 'RECEIVED', '2099-01-01')).toThrow()
  })
})
