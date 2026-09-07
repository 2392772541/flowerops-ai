import { z } from 'zod'

export const decisionCandidateSchema = z.object({
  diagnosisTag: z.enum(['SHORTAGE', 'EXPIRY', 'RECEIVABLE', 'DATA_QUALITY', 'GENERIC']),
  summary: z.string().min(8),
  evidenceIds: z.array(z.string()).min(1),
  action: z.object({
    type: z.enum(['CREATE_PURCHASE_ORDER', 'CREATE_COLLECTION_DRAFT', 'CREATE_WASTE_PROPOSAL', 'CREATE_PRICE_CHANGE']),
    entityId: z.string().min(1),
    quantity: z.number().int().positive().optional(),
    discount: z.number().min(0).max(1).optional()
  }).nullable(),
  assumptions: z.array(z.string()),
  fallback: z.boolean().default(false)
})

export type DecisionCandidate = z.infer<typeof decisionCandidateSchema>

