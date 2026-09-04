import { z } from 'zod'
import type { ActionProposal } from './types'

const purchasePayload = z.object({ supplierId: z.string().min(1), productId: z.string().min(1), quantity: z.number().int().positive().max(5000), unitCost: z.number().positive().max(10000) })
const collectionPayload = z.object({ customerId: z.string().min(1), tone: z.enum(['友好提醒','正式提醒','最后通知']) })
const pricePayload = z.object({ productId: z.string().min(1), newPrice: z.number().positive(), reason: z.string().min(1).optional() })
const wastePayload = z.object({ lotId: z.string().min(1), suggestedDiscount: z.number().min(0).max(0.5).optional(), quantity: z.number().int().positive().optional() })

export interface ProposalValidation { valid: boolean; issues: string[]; estimatedAmount?: number }
export function validateActionProposal(proposal: ActionProposal): ProposalValidation {
  const schemas = { CREATE_PURCHASE_ORDER: purchasePayload, CREATE_COLLECTION_DRAFT: collectionPayload, CREATE_PRICE_CHANGE: pricePayload, CREATE_WASTE_PROPOSAL: wastePayload }
  const result = schemas[proposal.type].safeParse(proposal.payload)
  const issues = result.success ? [] : result.error.issues.map(issue => issue.path.join('.') + ': ' + issue.message)
  if (!proposal.reason.trim()) issues.push('reason: 必须说明业务原因')
  if (proposal.evidence.length === 0) issues.push('evidence: 至少需要一条数据证据')
  if (!proposal.expectedImpact.trim()) issues.push('expectedImpact: 必须说明预期影响')
  let estimatedAmount: number | undefined
  if (proposal.type === 'CREATE_PURCHASE_ORDER' && result.success) {
    const payload = result.data as z.infer<typeof purchasePayload>
    estimatedAmount = payload.quantity * payload.unitCost
    if (estimatedAmount > 5000 && proposal.risk !== 'HIGH') issues.push('risk: 采购金额超过 ¥5,000 必须标记为高风险')
  }
  return { valid: issues.length === 0, issues, estimatedAmount }
}
