import type { AppState } from '../domain/types'
import { decisionCandidateSchema, type DecisionCandidate } from './schemas'

export type LabScenario = 'VALID' | 'TIMEOUT' | 'MALFORMED' | 'HALLUCINATED_ENTITY' | 'POLICY_VIOLATION'
export type LabStatus = 'ACCEPTED' | 'BLOCKED' | 'FALLBACK'

export interface TraceStage { label: string; status: 'PASS' | 'FAIL' | 'FALLBACK'; detail: string }
export interface LabResult {
  scenario: LabScenario
  status: LabStatus
  provider: string
  promptVersion: string
  modelVersion: string
  rawOutput: string
  candidate?: DecisionCandidate
  stages: TraceStage[]
  finalMessage: string
}

const validCandidate = {
  diagnosisTag: 'SHORTAGE',
  summary: '未来三天已确认订单消耗与安全库存之和高于有效库存和在途量，建议生成采购草稿供店长复核。',
  evidenceIds: ['LOT-R01', 'LOT-R02', 'SO-26090401', 'S-YN01'],
  action: { type: 'CREATE_PURCHASE_ORDER', entityId: 'S-YN01', quantity: 260 },
  assumptions: ['安全库存沿用当前样例配置', '采购单仅生成草稿，不自动发送'],
  fallback: false
} as const

function ruleFallback(): DecisionCandidate {
  return {
    diagnosisTag: 'SHORTAGE',
    summary: '模型不可用，已切换确定性规则：仅展示库存缺口和采购草稿建议，不自动写入业务系统。',
    evidenceIds: ['LOT-R01', 'LOT-R02', 'SO-26090401'],
    action: { type: 'CREATE_PURCHASE_ORDER', entityId: 'S-YN01', quantity: 260 },
    assumptions: ['降级结果来自固定规则基线'],
    fallback: true
  }
}

function rawForScenario(scenario: LabScenario) {
  if (scenario === 'VALID') return JSON.stringify(validCandidate)
  if (scenario === 'TIMEOUT') return '__TIMEOUT__'
  if (scenario === 'MALFORMED') return '{"diagnosisTag":"SHORTAGE","summary":'
  if (scenario === 'HALLUCINATED_ENTITY') return JSON.stringify({ ...validCandidate, evidenceIds: ['LOT-R01', 'SUPPLIER-NOT-EXIST'], action: { ...validCandidate.action, entityId: 'S-GHOST' } })
  return JSON.stringify({ ...validCandidate, diagnosisTag: 'EXPIRY', action: { type: 'CREATE_WASTE_PROPOSAL', entityId: 'LOT-S01', discount: 0.75 } })
}

export async function runLabScenario(state: AppState, scenario: LabScenario): Promise<LabResult> {
  const rawOutput = rawForScenario(scenario)
  const stages: TraceStage[] = [{ label: '事实冻结', status: 'PASS', detail: '库存、订单、供应商由业务系统提供；模型不可改写事实。' }]
  await new Promise(resolve => setTimeout(resolve, scenario === 'TIMEOUT' ? 700 : 280))

  if (scenario === 'TIMEOUT') {
    const candidate = ruleFallback()
    stages.push({ label: '模型调用', status: 'FAIL', detail: '超过 3 秒超时预算（本页为故障回放）。' })
    stages.push({ label: '规则降级', status: 'FALLBACK', detail: '切换 RuleProvider，保留只读诊断与草稿提案能力。' })
    stages.push({ label: '执行边界', status: 'PASS', detail: '仍需人工审批，未产生外部写入。' })
    return { scenario, status: 'FALLBACK', provider: 'HybridProvider', promptVersion: 'decision-v1.3', modelVersion: 'replay-model-2026-09', rawOutput, candidate, stages, finalMessage: '模型超时，已安全降级为可解释规则结果。' }
  }

  let candidate: DecisionCandidate
  try {
    candidate = decisionCandidateSchema.parse(JSON.parse(rawOutput))
    stages.push({ label: '结构化输出', status: 'PASS', detail: 'JSON 可解析并通过 Zod Schema。' })
  } catch {
    stages.push({ label: '结构化输出', status: 'FAIL', detail: 'JSON 解析或 Schema 校验失败。' })
    stages.push({ label: '阻断策略', status: 'PASS', detail: '错误输出不会进入审批队列，也不会触发业务写入。' })
    return { scenario, status: 'BLOCKED', provider: 'ModelReplayProvider', promptVersion: 'decision-v1.3', modelVersion: 'replay-model-2026-09', rawOutput, stages, finalMessage: '模型输出格式错误，已阻断。' }
  }

  const knownIds = new Set([
    ...state.lots.map(x => x.id), ...state.orders.map(x => x.id), ...state.suppliers.map(x => x.id),
    ...state.customers.map(x => x.id), ...state.receivables.map(x => x.id), ...state.products.map(x => x.id)
  ])
  const unknownEvidence = candidate.evidenceIds.filter(id => !knownIds.has(id))
  const actionEntityKnown = !candidate.action || knownIds.has(candidate.action.entityId)
  if (unknownEvidence.length || !actionEntityKnown) {
    stages.push({ label: '实体与证据校验', status: 'FAIL', detail: `发现不存在实体：${[...unknownEvidence, ...(!actionEntityKnown && candidate.action ? [candidate.action.entityId] : [])].join('、')}` })
    stages.push({ label: '幻觉拦截', status: 'PASS', detail: '未知供应商、商品、订单或批次不能进入审批。' })
    return { scenario, status: 'BLOCKED', provider: 'ModelReplayProvider', promptVersion: 'decision-v1.3', modelVersion: 'replay-model-2026-09', rawOutput, candidate, stages, finalMessage: '模型引用了不存在的业务实体，已阻断。' }
  }
  stages.push({ label: '实体与证据校验', status: 'PASS', detail: '引用均可追溯到当前合成情景数据。' })

  if (candidate.action?.type === 'CREATE_WASTE_PROPOSAL' && (candidate.action.discount ?? 0) > 0.5) {
    stages.push({ label: '经营策略校验', status: 'FAIL', detail: '建议折扣超过 50% 的演示经营红线。' })
    stages.push({ label: '高影响动作阻断', status: 'PASS', detail: '不创建报损/促销提案，要求人工重拟方案。' })
    return { scenario, status: 'BLOCKED', provider: 'ModelReplayProvider', promptVersion: 'decision-v1.3', modelVersion: 'replay-model-2026-09', rawOutput, candidate, stages, finalMessage: '建议突破策略红线，已阻断。' }
  }

  stages.push({ label: '经营策略校验', status: 'PASS', detail: '数量、折扣、实体和动作类型均在白名单内。' })
  stages.push({ label: '人工审批', status: 'PASS', detail: '仅进入待审批队列；模型没有执行权限。' })
  return { scenario, status: 'ACCEPTED', provider: 'ModelReplayProvider', promptVersion: 'decision-v1.3', modelVersion: 'replay-model-2026-09', rawOutput, candidate, stages, finalMessage: '候选提案通过机器校验，等待店长人工判断。' }
}
