import { useEffect, useMemo, useState } from 'react'
import {
  Activity, AlertTriangle, Archive, ArrowRight, Bot, Box, Check, ChevronRight,
  CircleDollarSign, Clock3, Download, FileCheck2, Flower2,
  Gauge, LayoutDashboard, Menu, PackageCheck, PanelLeftClose, RefreshCcw,
  Search, Send, ShieldCheck, ShoppingCart, Sparkles, Store, Truck, Users, X,
  BookOpen, FlaskConical, Play, Database, GitBranch, Target, ClipboardCheck, ShieldAlert
} from 'lucide-react'
import './App.css'
import { approveProposal, currency, daysUntil, executeProposal, freshnessFactor, inventorySummary, percent, proposalSimulation, rejectProposal, riskLabel, scenarioGrossProfit, scenarioOrderValue, sellableQty, wasteRisk } from './domain/engine'
import type { ActionProposal, AppState, InventoryLot, ProposalStatus } from './domain/types'
import { exportState, loadState, resetState, saveState } from './storage/repository'
import { ruleAIProvider } from './ai/ruleProvider'
import { runLabScenario, type LabResult, type LabScenario } from './ai/lab'
import { evaluationCases, evaluationReport, type EvalProvider } from './data/evaluationDataset'

type PageKey = 'case' | 'dashboard' | 'decisions' | 'lab' | 'evaluation' | 'orders' | 'inventory' | 'purchasing' | 'customers' | 'ask' | 'audit'
const navItems: Array<{ key: PageKey; label: string; icon: typeof LayoutDashboard }> = [
  { key: 'case', label: '面试导览', icon: BookOpen },
  { key: 'dashboard', label: '经营情景', icon: LayoutDashboard },
  { key: 'decisions', label: '受控决策', icon: Sparkles },
  { key: 'lab', label: '模型实验室', icon: FlaskConical },
  { key: 'evaluation', label: '离线评测', icon: ClipboardCheck },
  { key: 'orders', label: '订单中心', icon: ShoppingCart },
  { key: 'inventory', label: '批次库存', icon: Box },
  { key: 'purchasing', label: '采购中心', icon: Truck },
  { key: 'customers', label: '客户与应收', icon: Users },
  { key: 'ask', label: '经营问数', icon: Bot },
  { key: 'audit', label: '审计中心', icon: ShieldCheck }
]
const statusLabels: Record<ProposalStatus, string> = {
  GENERATED: '已生成', VALIDATING: '校验中', AWAITING_APPROVAL: '待审批', APPROVED: '已批准', EXECUTING: '执行中', SUCCEEDED: '执行成功', VALIDATION_FAILED: '校验失败', REJECTED: '已拒绝', EXECUTION_FAILED: '执行失败', COMPENSATED: '已补偿', EXPIRED: '已过期'
}
const statusClass = (status: string) => /SUCCEEDED|COMPLETED|RECEIVED|PAID|SUCCESS/.test(status) ? 'success' : /AWAITING|PENDING|SENT|RESERVED|PREPARING|OPEN|PARTIALLY/.test(status) ? 'warning' : /OVERDUE|FAILED|REJECTED|EXPIRED|CANCELLED/.test(status) ? 'danger' : 'neutral'
const productName = (state: AppState, id: string) => state.products.find(item => item.id === id)?.name ?? id
const supplierName = (state: AppState, id: string) => state.suppliers.find(item => item.id === id)?.name ?? id
const customerName = (state: AppState, id: string) => state.customers.find(item => item.id === id)?.name ?? id

function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: string }) { return <span className={'badge ' + tone}>{children}</span> }
function SectionTitle({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: React.ReactNode }) {
  return <div className="section-title"><div>{eyebrow && <p>{eyebrow}</p>}<h2>{title}</h2></div>{action}</div>
}
function StatCard({ label, value, note, tone, icon: Icon }: { label: string; value: string; note: string; tone: string; icon: typeof Gauge }) {
  return <article className="stat-card"><div className={'stat-icon ' + tone}><Icon size={20} /></div><div><p>{label}</p><strong>{value}</strong><small>{note}</small></div></article>
}
function Progress({ value, tone = 'green' }: { value: number; tone?: string }) { return <div className="progress"><i className={tone} style={{ width: Math.min(100, Math.max(0, value)) + '%' }} /></div> }

function Dashboard({ state, go }: { state: AppState; go: (p: PageKey) => void }) {
  const inventory = inventorySummary(state)
  const overdue = state.receivables.filter(x => x.status === 'OVERDUE').reduce((s, x) => s + x.amount - x.paidAmount, 0)
  const nearExpiry = state.lots.filter(x => daysUntil(x.sellBy) <= 2 && sellableQty(x) > 0)
  const pending = state.proposals.filter(x => x.status === 'AWAITING_APPROVAL')
  const orderValue = scenarioOrderValue(state)
  const grossProfit = scenarioGrossProfit(state)
  const margin = orderValue ? grossProfit / orderValue : 0
  return <>
    <div className="hero-panel">
      <div><Badge tone="mint">SYNTHETIC SCENARIO · 快照 2026-09-04</Badge><h1>经营情景回放</h1><p>这是可复算的合成案例，不是真实门店经营数据。系统发现 <b>{pending.length} 项</b>待人工判断的问题。</p></div>
      <button className="primary" onClick={() => go('decisions')}><Sparkles size={18} /> 查看 AI 建议 <ArrowRight size={16} /></button>
    </div>
    <div className="stats-grid">
      <StatCard label="当日样例订单额" value={currency(orderValue)} note="由交付日在快照日的订单求和" tone="purple" icon={CircleDollarSign} />
      <StatCard label="样例订单毛利" value={currency(grossProfit)} note={'按商品样例成本复算 · '+percent(margin)} tone="green" icon={Activity} />
      <StatCard label="可售库存" value={inventory.sellable.toLocaleString() + ' 枝'} note={'有效库存 ' + Math.round(inventory.effective) + ' 枝'} tone="blue" icon={Archive} />
      <StatCard label="逾期应收" value={currency(overdue)} note="1 家客户需跟进" tone="orange" icon={Clock3} />
    </div>
    <div className="dashboard-columns">
      <section className="panel decision-preview">
        <SectionTitle eyebrow="TODAY'S PRIORITIES" title="今日经营优先级" action={<button className="text-button" onClick={() => go('decisions')}>查看全部 <ChevronRight size={15}/></button>} />
        <div className="priority-list">{pending.map((item, index) => <button key={item.id} className="priority-item" onClick={() => go('decisions')}><span className={'priority-rank r' + index}>{index + 1}</span><div><div><b>{item.title}</b><Badge tone={item.risk.toLowerCase()}>{riskLabel(item.risk)}</Badge></div><p>{item.reason}</p></div><ChevronRight size={18}/></button>)}</div>
      </section>
      <section className="panel">
        <SectionTitle eyebrow="FRESHNESS RADAR" title="临期雷达" action={<button className="text-button" onClick={() => go('inventory')}>批次明细 <ChevronRight size={15}/></button>} />
        <div className="fresh-list">{nearExpiry.map(lot => <div className="fresh-row" key={lot.id}><div><span className="flower-dot"/><div><b>{productName(state, lot.productId)}</b><small>{lot.batchNo} · 剩 {daysUntil(lot.sellBy)} 天</small></div></div><div className="fresh-qty"><b>{sellableQty(lot)} 枝</b><Progress value={freshnessFactor(lot.sellBy) * 100} tone={daysUntil(lot.sellBy) <= 1 ? 'red' : 'orange'} /></div></div>)}</div>
      </section>
    </div>
    <section className="panel">
      <SectionTitle eyebrow="METRIC CONTRACT" title="可复算指标口径" action={<Badge tone="mint">无虚构增长率</Badge>} />
      <div className="formula-grid"><article><Database/><b>当日样例订单额</b><code>Σ delivery_date = 2026-09-04 的订单金额</code><span>{currency(orderValue)}</span></article><article><GitBranch/><b>样例订单毛利</b><code>Σ (售价 - 样例成本) × 数量</code><span>{currency(grossProfit)}</span></article><article><ShieldAlert/><b>结论边界</b><code>仅用于验证产品流程与计算口径</code><span>不代表真实业务收益</span></article></div>
    </section>
  </>
}

function ProposalCard({ item, selected, onSelect }: { item: ActionProposal; selected: boolean; onSelect: () => void }) {
  return <button className={'proposal-row ' + (selected ? 'selected' : '')} onClick={onSelect}><div className={'proposal-icon ' + item.risk.toLowerCase()}>{item.type === 'CREATE_PURCHASE_ORDER' ? <Truck/> : item.type === 'CREATE_COLLECTION_DRAFT' ? <Send/> : <AlertTriangle/>}</div><div><div><b>{item.title}</b><Badge tone={statusClass(item.status)}>{statusLabels[item.status]}</Badge></div><p>{item.reason}</p><small>{new Date(item.generatedAt).toLocaleString('zh-CN')} · {riskLabel(item.risk)}</small></div><ChevronRight size={18}/></button>
}
function Decisions({ state, setState }: { state: AppState; setState: (s: AppState) => void }) {
  const [selectedId, setSelectedId] = useState(state.proposals[0]?.id)
  const selected = state.proposals.find(x => x.id === selectedId) ?? state.proposals[0]
  const simulation = selected ? proposalSimulation(state, selected) : null
  return <div className="decision-layout">
    <section className="panel proposal-list"><SectionTitle eyebrow="ACTION PROPOSALS" title="AI 业务动作提案" action={<Badge tone="warning">{state.proposals.filter(x=>x.status==='AWAITING_APPROVAL').length} 项待审批</Badge>} />{state.proposals.map(item => <ProposalCard key={item.id} item={item} selected={item.id===selected?.id} onSelect={()=>setSelectedId(item.id)} />)}</section>
    {selected && <section className="panel proposal-detail"><div className="detail-head"><div><Badge tone={selected.risk.toLowerCase()}>{riskLabel(selected.risk)}</Badge><h2>{selected.title}</h2><p>{selected.reason}</p></div><Badge tone={statusClass(selected.status)}>{statusLabels[selected.status]}</Badge></div>
      <div className="explain-block"><h3><Search size={17}/> 证据链</h3><div className="evidence-grid">{selected.evidence.map(e=><div key={e.label}><span>{e.label}</span><b>{e.value}</b><small>{e.detail}</small></div>)}</div></div>
      {simulation && <div className="explain-block"><h3><Activity size={17}/> 情景模拟（非真实业务收益）</h3><div className="simulation-box"><div><span>{simulation.label}</span><b>{simulation.value}</b></div><code>{simulation.formula}</code><p>{simulation.boundary}</p></div></div>}
      <div className="write-preview"><div><FileCheck2 size={19}/><div><b>将执行的写操作</b><p>{selected.type === 'CREATE_PURCHASE_ORDER' ? '仅创建采购草稿，不自动发送供应商' : selected.type === 'CREATE_COLLECTION_DRAFT' ? '仅生成催款消息草稿，不自动发送客户' : selected.type === 'CREATE_WASTE_PROPOSAL' ? '仅创建报损复核单，不直接扣减库存' : '仅创建调价待办，不直接修改售价'}</p></div></div><code>{JSON.stringify(selected.payload, null, 2)}</code></div>
      <div className="role-strip"><ShieldCheck size={18}/><div><b>权限与执行边界</b><p>规则基线（以 AI_AGENT 身份运行）只能读取数据和生成提案；当前审批身份为店长（MANAGER）；批准后的动作由系统执行器（SYSTEM_EXECUTOR）按幂等键安全执行。</p></div></div>
      {selected.executionResult && <div className={'result-banner ' + (selected.status === 'VALIDATION_FAILED' || selected.status === 'EXECUTION_FAILED' ? 'danger' : '')}>{selected.status === 'VALIDATION_FAILED' || selected.status === 'EXECUTION_FAILED' ? <AlertTriangle size={18}/> : <Check size={18}/>}<div><b>{selected.status === 'VALIDATION_FAILED' ? '校验失败' : '执行结果'}</b><p>{selected.executionResult}</p>{selected.validationIssues && <ul>{selected.validationIssues.map(issue=><li key={issue}>{issue}</li>)}</ul>}</div></div>}
      <div className="approval-bar"><div><ShieldCheck size={18}/><span>高影响动作必须通过 Schema、业务实体和角色权限三重校验，并写入审计日志。</span></div><div>{selected.status === 'AWAITING_APPROVAL' && <><button className="ghost danger-text" onClick={()=>setState(rejectProposal(state, selected.id, '店长 · 林夏', 'MANAGER'))}><X size={16}/>拒绝</button><button className="primary" onClick={()=>setState(approveProposal(state, selected.id, '店长 · 林夏', 'MANAGER'))}><Check size={16}/>店长批准</button></>}{selected.status === 'APPROVED' && <button className="primary" onClick={()=>setState(executeProposal(state, selected.id, '系统执行器', 'SYSTEM_EXECUTOR'))}><PackageCheck size={17}/>安全执行</button>}</div></div>
    </section>}
  </div>
}

function Orders({ state }: { state: AppState }) { return <section className="panel"><SectionTitle eyebrow="ORDER ORCHESTRATION" title="订单中心" action={<Badge tone="mint">花束配方自动展开</Badge>} /><div className="table-wrap"><table><thead><tr><th>订单 / 客户</th><th>来源</th><th>履约时间</th><th>商品</th><th>金额</th><th>状态</th></tr></thead><tbody>{state.orders.map(order=><tr key={order.id}><td><b>{order.id}</b><small>{customerName(state,order.customerId)}</small></td><td>{order.source}</td><td>{new Date(order.deliveryAt).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}</td><td>{order.items.map(x=><span key={x.productId}>{productName(state,x.productId)} × {x.quantity}</span>)}</td><td><b>{currency(order.totalAmount)}</b></td><td><Badge tone={statusClass(order.status)}>{({STOCK_RESERVED:'已预留',PREPARING:'制作中',COMPLETED:'已完成',DRAFT:'草稿',CONFIRMED:'已确认',READY:'待配送',DELIVERING:'配送中',CANCELLED:'已取消'} as Record<string,string>)[order.status]}</Badge></td></tr>)}</tbody></table></div><div className="callout"><Flower2/><div><b>为什么花束订单需要配方展开？</b><p>一个“心动红玫瑰花束”会消耗 19 枝玫瑰、5 枝洋桔梗和 6 枝尤加利。系统按配方预留原料，避免只看成品订单导致花材缺货。</p></div></div></section> }

function Inventory({ state }: { state: AppState }) {
  const summary = inventorySummary(state)
  return <><div className="mini-stats"><div><span>在库总量</span><b>{summary.onHand} 枝</b></div><div><span>已预留</span><b>{summary.reserved} 枝</b></div><div><span>质量冻结</span><b>{summary.qualityHold} 枝</b></div><div><span>实际可售</span><b>{summary.sellable} 枝</b></div><div><span>库存成本</span><b>{currency(summary.value)}</b></div></div><section className="panel"><SectionTitle eyebrow="LOT-LEVEL INVENTORY" title="批次库存" action={<Badge tone="neutral">不可变库存流水</Badge>} /><div className="table-wrap"><table><thead><tr><th>花材 / 批次</th><th>到货 / 可售期限</th><th>在库</th><th>预留</th><th>冻结</th><th>可售</th><th>新鲜度</th><th>风险成本</th></tr></thead><tbody>{state.lots.map(lot=><InventoryRow key={lot.id} state={state} lot={lot}/>)}</tbody></table></div></section><section className="panel"><SectionTitle eyebrow="IMMUTABLE LEDGER" title="最近库存流水"/><div className="timeline">{state.movements.map(m=><div key={m.id}><i/><div><b>{m.type} · {productName(state,m.productId)}</b><p>{m.note}</p><small>{m.referenceId} · {new Date(m.occurredAt).toLocaleString('zh-CN')} · {m.operator}</small></div><strong className={m.quantity<0?'negative':'positive'}>{m.quantity>0?'+':''}{m.quantity}</strong></div>)}</div></section></>
}
function InventoryRow({state,lot}:{state:AppState;lot:InventoryLot}) { const fresh=freshnessFactor(lot.sellBy); const risk=wasteRisk(lot, daysUntil(lot.sellBy)<=1?.55:.25); return <tr><td><b>{productName(state,lot.productId)}</b><small>{lot.batchNo} · {lot.qualityGrade}级</small></td><td><span>{lot.receivedAt}</span><small className={daysUntil(lot.sellBy)<=1?'red-text':''}>可售至 {lot.sellBy}</small></td><td>{lot.qtyOnHand}</td><td>{lot.qtyReserved}</td><td>{lot.qtyQualityHold}</td><td><b>{sellableQty(lot)}</b></td><td><div className="fresh-cell"><span>{percent(fresh)}</span><Progress value={fresh*100} tone={fresh<=.2?'red':fresh<1?'orange':'green'}/></div></td><td>{currency(risk)}</td></tr> }

function Purchasing({ state }: { state: AppState }) { return <><section className="panel"><SectionTitle eyebrow="PROCUREMENT PIPELINE" title="采购中心" action={<button className="primary small"><Truck size={16}/>新建采购草稿</button>} /><div className="table-wrap"><table><thead><tr><th>采购单</th><th>供应商</th><th>商品</th><th>预计到货</th><th>金额</th><th>状态</th><th>来源</th></tr></thead><tbody>{state.purchaseOrders.map(po=><tr key={po.id}><td><b>{po.id}</b><small>{new Date(po.createdAt).toLocaleDateString('zh-CN')}</small></td><td>{supplierName(state,po.supplierId)}</td><td>{po.items.map(x=><span key={x.productId}>{productName(state,x.productId)} × {x.quantity}</span>)}</td><td>{po.expectedAt}</td><td><b>{currency(po.amount)}</b></td><td><Badge tone={statusClass(po.status)}>{({DRAFT:'草稿',PENDING_APPROVAL:'待审批',APPROVED:'已批准',SENT:'已发送',PARTIALLY_RECEIVED:'部分到货',RECEIVED:'已收货'} as Record<string,string>)[po.status]}</Badge></td><td>{po.sourceProposalId?<Badge tone="purple">AI 提案</Badge>:'人工创建'}</td></tr>)}</tbody></table></div></section><section className="panel"><SectionTitle eyebrow="SUPPLIER SCORECARD" title="供应商表现"/><div className="supplier-grid">{state.suppliers.map(s=><article key={s.id}><div><Store size={20}/><b>{s.name}</b></div><p>平均交期 <strong>{s.leadTimeDays} 天</strong></p><p>到货可靠度 <strong>{percent(s.reliability)}</strong></p><Progress value={s.reliability*100}/><small>{s.paymentTerms}</small></article>)}</div></section></> }

function Customers({ state }: { state: AppState }) { return <><section className="panel"><SectionTitle eyebrow="CUSTOMER CREDIT" title="客户与应收" action={<Badge tone="warning">逾期余额 {currency(8600)}</Badge>} /><div className="customer-cards">{state.customers.filter(c=>c.type!=='零售散客').map(c=>{const ars=state.receivables.filter(a=>a.customerId===c.id);const outstanding=ars.reduce((s,a)=>s+a.amount-a.paidAmount,0);return <article key={c.id}><div className="avatar">{c.name.slice(0,1)}</div><div className="customer-main"><div><b>{c.name}</b><Badge tone="neutral">{c.type}</Badge></div><p>信用等级 {c.level} · {c.paymentTermsDays} 天账期</p><div className="credit"><span>信用占用 {currency(outstanding)} / {currency(c.creditLimit)}</span><Progress value={outstanding/c.creditLimit*100} tone={outstanding/c.creditLimit>.5?'orange':'green'}/></div></div><strong className={ars.some(a=>a.status==='OVERDUE')?'red-text':''}>{currency(outstanding)}<small>待收</small></strong></article>})}</div></section><section className="panel"><SectionTitle eyebrow="RECEIVABLES" title="应收明细"/><div className="table-wrap"><table><thead><tr><th>应收单</th><th>客户</th><th>订单</th><th>应收金额</th><th>已收</th><th>到期日</th><th>状态</th></tr></thead><tbody>{state.receivables.map(ar=><tr key={ar.id}><td><b>{ar.id}</b></td><td>{customerName(state,ar.customerId)}</td><td>{ar.orderId}</td><td>{currency(ar.amount)}</td><td>{currency(ar.paidAmount)}</td><td>{ar.dueDate}</td><td><Badge tone={statusClass(ar.status)}>{({OPEN:'待收',PARTIALLY_PAID:'部分收款',PAID:'已结清',OVERDUE:'已逾期',DISPUTED:'争议中'} as Record<string,string>)[ar.status]}</Badge></td></tr>)}</tbody></table></div></section></> }

function AskBusiness({ state }: { state: AppState }) {
  const questions=['哪些花材未来三天可能缺货？','哪些批次临期损耗风险最高？','目前有多少逾期应收？']
  const [question,setQuestion]=useState(questions[0]); const [result,setResult]=useState(()=>ruleAIProvider.preview(state,questions[0])); const [loading,setLoading]=useState(false)
  const ask=async(q=question)=>{setLoading(true);setResult(await ruleAIProvider.askBusiness(state,q));setLoading(false)}
  return <div className="ask-layout"><section className="panel ask-panel"><div className="ask-hero"><div className="bot-orb"><Bot/></div><Badge tone="mint">规则基线 · 只读</Badge><h2>用自然语言查询经营数据</h2><p>用三个可解释只读模板验证业务口径；它是模型对照基线，不冒充自由问答大模型。</p></div><div className="question-box"><textarea value={question} onChange={e=>setQuestion(e.target.value)} aria-label="经营问题"/><button className="primary" onClick={()=>ask()} disabled={loading}>{loading?<RefreshCcw className="spin" size={18}/>:<Sparkles size={18}/>}分析</button></div><div className="suggestions">{questions.map(q=><button key={q} onClick={()=>{setQuestion(q);ask(q)}}>{q}</button>)}</div></section><section className="panel answer-panel"><SectionTitle eyebrow="EXPLAINABLE ANSWER" title={result.title} action={<Badge tone="success">规则结果 · 有数据依据</Badge>}/><div className="answer-copy"><Sparkles/><p>{result.answer}</p></div><div className="query-proof"><ShieldCheck/><div><b>查询安全说明</b><p>{result.query}</p><small>数据表：{result.evidence.join('、')}</small></div></div><div className="limits"><AlertTriangle/><p><b>结果边界：</b>当前为合成演示数据和可配置 MVP 规则，不代表真实行业经营结论。</p></div></section></div>
}

function Audit({ state }: { state: AppState }) { return <section className="panel"><SectionTitle eyebrow="AUDIT TRAIL" title="审计中心" action={<Badge tone="mint">不可删除 · 可追溯</Badge>} /><div className="audit-list">{state.auditEvents.map(event=><article key={event.id}><div className={'audit-icon '+statusClass(event.result)}>{event.result==='SUCCESS'?<Check/>:event.result==='REJECTED'?<X/>:<AlertTriangle/>}</div><div className="audit-body"><div><b>{event.eventType}</b><Badge tone={statusClass(event.result)}>{event.result}</Badge></div><p>{event.detail}</p><div className="audit-meta"><span>{event.entityType} · {event.entityId}</span><span>{event.actor}{event.actorRole?' · '+event.actorRole:''}</span><span>{new Date(event.occurredAt).toLocaleString('zh-CN')}</span></div>{event.before&&<div className="state-change"><code>{event.before}</code><ArrowRight size={14}/><code>{event.after}</code></div>}<small>Request ID: {event.requestId}{event.idempotencyKey?' · Idempotency Key: '+event.idempotencyKey:''}</small></div></article>)}</div></section> }


function CaseStudy({ go }: { go: (page: PageKey) => void }) {
  const capabilities = [
    ['场景抽象', '把易腐批次、花束配方、订单需求和安全库存连接为一个可解释决策问题。'],
    ['AI 工作流', '确定性事实 → 模型候选 → Schema/实体/策略校验 → 人审 → 幂等执行。'],
    ['模型评测', '同一组样例对比规则基线、模型回放和受控混合方案，结果由代码现场计算。'],
    ['安全治理', 'AI_AGENT 无审批/执行权限；未知实体、非法折扣、重复执行和超时都有可演示处理。']
  ]
  return <div className="case-page">
    <section className="case-hero panel">
      <div><Badge tone="purple">AI PRODUCT MANAGER CASE STUDY</Badge><h1>FlowerOps AI：受控经营决策实验</h1><p>面向<strong>小型鲜切花批零一体商家</strong>的个人研究型原型。验证生成式模型如何从经营异常走到“有证据、受约束、经审批、可执行、可追责”的动作，而不是再做一个聊天机器人。</p><div className="case-actions"><button className="primary" onClick={()=>go('dashboard')}><Play size={17}/>开始 3 分钟演示</button><button className="ghost" onClick={()=>go('evaluation')}><ClipboardCheck size={17}/>查看评测证据</button></div></div>
      <div className="truth-card"><ShieldCheck/><b>项目真实性声明</b><ul><li>个人独立完成的行业研究、产品原型与安全执行实验</li><li>商家、客户、订单、金额均为合成情景数据</li><li>没有真实客户、上线收入、DAU 或降本增效声明</li><li>当前在线版使用模型故障回放，不宣称真实模型成绩</li></ul></div>
    </section>
    <div className="case-kpis"><article><span>目标用户</span><b>小型鲜切花批零商家</b><small>其他花店类型仅作未来扩展</small></article><article><span>核心任务</span><b>临期与缺货决策</b><small>从异常到受控动作</small></article><article><span>我的角色</span><b>AI 产品经理 / 原型实现</b><small>研究、PRD、流程、评测、交互、测试</small></article><article><span>验证范围</span><b>10 条评测样例 + 自动测试</b><small>不等同于真实商用验证</small></article></div>
    <section className="panel"><SectionTitle eyebrow="PROBLEM FRAMING" title="问题定义与产品取舍"/><div className="problem-grid"><article><Target/><h3>为什么做</h3><p>鲜切花库存会随时间折损，账面数量不等于可售能力；花束订单还需展开为多种原料需求。传统记录型系统能保存事实，但经营者仍需在库存、订单、交期和毛利约束间做判断。</p></article><article><Database/><h3>哪些不用模型</h3><p>库存余额、配方展开、应收金额、日期和采购金额全部由确定性规则计算。模型不能创造或改写经营事实。</p></article><article><Sparkles/><h3>哪些使用模型</h3><p>模型只负责解释异常、比较处置方案和生成结构化候选提案；规则 Provider 同时作为基线与故障降级。</p></article><article><ShieldAlert/><h3>为什么不自动执行</h3><p>采购、促销、催款和报损涉及资金、履约与客户关系。高影响动作必须通过策略校验和人工审批。</p></article></div></section>
    <section className="panel"><SectionTitle eyebrow="MY CONTRIBUTION" title="我能向面试官证明什么"/><div className="capability-grid">{capabilities.map(([title,copy])=><article key={title}><Check/><div><b>{title}</b><p>{copy}</p></div></article>)}</div></section>
    <section className="panel"><SectionTitle eyebrow="3-MINUTE WALKTHROUGH" title="面试演示路径"/><div className="demo-steps">{[
      ['00:00–00:25','真实性与问题','先声明合成数据，再解释为什么易腐库存需要受控决策。','dashboard'],
      ['00:25–01:10','证据与模拟','查看可复算经营事实和情景公式，不讲虚构增长率。','decisions'],
      ['01:10–01:55','故障与拦截','现场回放格式错误、幻觉实体、策略越界和超时降级。','lab'],
      ['01:55–02:30','审批与幂等','批准合法提案，执行后证明只创建草稿且不会重复写入。','audit'],
      ['02:30–03:00','评测与反思','对比三种方案，说明为什么最终选择混合架构。','evaluation']
    ].map(([time,title,copy,page],index)=><button key={time} onClick={()=>go(page as PageKey)}><span>{index+1}</span><time>{time}</time><div><b>{title}</b><p>{copy}</p></div><ChevronRight/></button>)}</div></section>
    <section className="panel source-panel"><SectionTitle eyebrow="RESEARCH BASIS" title="公开资料如何影响方案"/><div className="source-grid"><article><b>岗位能力</b><p>当前 AI 产品岗位反复要求用户研究、模型效果与数据质量、典型任务集、评测样本、基线和验收标准。因此本轮优先补评测与研究证据，而非继续堆业务页面。</p><small>来源：百度招聘公开岗位（检索于 2026-09-07）</small></article><article><b>成熟产品基线</b><p>Odoo 与 ERPNext 的补货/库存规则说明，最小库存、最大库存、交期和补货触发应由确定性系统负责。因此本项目不把库存计算包装成大模型能力。</p><small>来源：Odoo / ERPNext 官方文档</small></article><article><b>LLM 评测方法</b><p>Langfuse 与 Promptfoo 强调固定数据集、版本化 Prompt、断言和回归评测。本项目据此设计可复现的离线回放中心。</p><small>来源：Langfuse / Promptfoo 官方文档</small></article></div></section>
  </div>
}

const labScenarios: Array<{ id: LabScenario; label: string; note: string }> = [
  { id: 'VALID', label: '合法结构化提案', note: '应进入人工审批' },
  { id: 'TIMEOUT', label: '模型调用超时', note: '应切换规则基线' },
  { id: 'MALFORMED', label: 'JSON / Schema 错误', note: '应阻断输出' },
  { id: 'HALLUCINATED_ENTITY', label: '虚构供应商', note: '应被实体校验拦截' },
  { id: 'POLICY_VIOLATION', label: '折扣突破红线', note: '应被经营策略拦截' }
]

function ModelLab({ state }: { state: AppState }) {
  const [scenario, setScenario] = useState<LabScenario>('VALID')
  const [result, setResult] = useState<LabResult | null>(null)
  const [loading, setLoading] = useState(false)
  const run = async () => { setLoading(true); setResult(await runLabScenario(state, scenario)); setLoading(false) }
  return <div className="lab-page">
    <section className="panel lab-intro"><div><Badge tone="purple">MODEL FAILURE REPLAY</Badge><h2>模型实验室</h2><p>GitHub Pages 不保存 API Key。这里使用固定模型输出回放，真实展示解析、实体校验、经营红线、权限边界和降级链路。它验证的是<strong>系统如何处理模型不确定性</strong>，不是模型效果成绩。</p></div><div className="provider-contract"><span>事实层</span><ArrowRight/><span>模型候选</span><ArrowRight/><span>机器校验</span><ArrowRight/><span>人工审批</span></div></section>
    <div className="lab-layout"><section className="panel"><SectionTitle eyebrow="TEST SCENARIO" title="选择故障情景"/><div className="scenario-list">{labScenarios.map(item=><button key={item.id} className={scenario===item.id?'selected':''} onClick={()=>{setScenario(item.id);setResult(null)}}><FlaskConical/><div><b>{item.label}</b><small>{item.note}</small></div>{scenario===item.id&&<Check/>}</button>)}</div><button className="primary run-lab" onClick={run} disabled={loading}>{loading?<RefreshCcw className="spin"/>:<Play/>}{loading?'正在回放':'运行处理链路'}</button></section>
      <section className="panel trace-panel"><SectionTitle eyebrow="OBSERVABILITY TRACE" title="处理结果" action={result&&<Badge tone={result.status==='ACCEPTED'?'success':result.status==='FALLBACK'?'warning':'danger'}>{result.status}</Badge>}/>{!result?<div className="empty-trace"><GitBranch/><b>等待运行</b><p>选择一个情景，查看每个处理阶段为什么通过、阻断或降级。</p></div>:<><div className="trace-meta"><span>Provider <b>{result.provider}</b></span><span>Prompt <b>{result.promptVersion}</b></span><span>Model <b>{result.modelVersion}</b></span></div><div className="trace-list">{result.stages.map((stage,index)=><div key={stage.label} className={stage.status.toLowerCase()}><i>{index+1}</i><div><b>{stage.label}</b><p>{stage.detail}</p></div><Badge tone={stage.status==='PASS'?'success':stage.status==='FAIL'?'danger':'warning'}>{stage.status}</Badge></div>)}</div><div className="final-result"><b>{result.finalMessage}</b>{result.candidate&&<pre>{JSON.stringify(result.candidate,null,2)}</pre>}<details><summary>查看模型原始输出</summary><code>{result.rawOutput}</code></details></div></>}</section></div>
  </div>
}

const providerLabels: Record<EvalProvider, string> = { RULE_BASELINE: '规则基线', MODEL_REPLAY: '纯模型回放', HYBRID_GUARDED: '受控混合方案' }
function EvaluationCenter() {
  const [selected, setSelected] = useState<EvalProvider>('HYBRID_GUARDED')
  const [runAt, setRunAt] = useState('')
  const report = evaluationReport.find(item=>item.provider===selected)!
  return <div className="evaluation-page">
    <section className="panel eval-intro"><div><Badge tone="mint">REPRODUCIBLE OFFLINE HARNESS</Badge><h2>离线评测中心</h2><p>10 条代表性合成样例覆盖经营诊断、数据异常和安全治理。结果由仓库内候选输出、Schema 和断言现场计算，可用于回归测试；<strong>不代表真实在线模型成绩</strong>。</p></div><button className="primary" onClick={()=>setRunAt(new Date().toLocaleString('zh-CN'))}><RefreshCcw size={17}/>重新运行评测</button></section>
    {runAt&&<div className="run-banner"><Check/>已在浏览器内重新计算 · {runAt} · 未调用外部模型</div>}
    <div className="provider-tabs">{evaluationReport.map(item=><button key={item.provider} className={selected===item.provider?'active':''} onClick={()=>setSelected(item.provider)}><b>{providerLabels[item.provider]}</b><span>{item.scenarioPassRate}% 场景通过</span></button>)}</div>
    <div className="metric-grid"><article><span>场景通过率</span><b>{report.scenarioPassRate}%</b><small>诊断、证据、动作同时通过</small></article><article><span>结构化输出成功率</span><b>{report.structuredOutputRate}%</b><small>JSON + Zod Schema</small></article><article><span>证据落地率</span><b>{report.evidenceGroundedRate}%</b><small>必需证据完整且实体存在</small></article><article className={report.unsafeActionRate>0?'danger-metric':''}><span>不安全动作率</span><b>{report.unsafeActionRate}%</b><small>目标应为 0</small></article><article><span>故障降级成功率</span><b>{report.fallbackSuccessRate}%</b><small>3 个指定故障样例</small></article></div>
    <section className="panel"><SectionTitle eyebrow="CASE LEVEL EVIDENCE" title={`${providerLabels[selected]} · ${report.total} 条样例结果`} action={<Badge tone="neutral">评测集 v0.2</Badge>}/><div className="eval-table table-wrap"><table><thead><tr><th>编号</th><th>类别</th><th>输入场景</th><th>结构</th><th>证据</th><th>安全</th><th>诊断</th><th>结论</th></tr></thead><tbody>{report.results.map(item=>{const test=evaluationCases.find(x=>x.id===item.id)!;return <tr key={item.id}><td><b>{item.id}</b></td><td>{item.category}</td><td>{test.input}</td><td>{item.structured?'✓':'×'}</td><td>{item.grounded?'✓':'×'}</td><td>{item.safe?'✓':'×'}</td><td>{item.diagnosisCorrect?'✓':'×'}</td><td><Badge tone={item.passed?'success':'danger'}>{item.reason}</Badge></td></tr>})}</tbody></table></div></section>
    <section className="panel"><SectionTitle eyebrow="PRODUCT DECISION" title="为什么选择受控混合架构"/><div className="decision-rationale"><article><b>规则基线</b><p>稳定、便宜、可解释，适合事实计算和硬约束；但对开放表达和多方案解释能力有限。</p></article><article><b>纯模型</b><p>表达灵活，但回放中出现格式错误、证据遗漏、虚构实体和越界动作，不能直接写业务系统。</p></article><article><b>混合方案</b><p>模型做解释与候选生成，规则做事实、校验和降级，人做高影响判断，执行器负责幂等落地。</p></article></div></section>
  </div>
}

function App() {
  const [state,setState]=useState<AppState>(()=>loadState())
  const [page,setPage]=useState<PageKey>('case')
  const [mobileOpen,setMobileOpen]=useState(false)
  useEffect(()=>saveState(state),[state])
  const pending=useMemo(()=>state.proposals.filter(x=>x.status==='AWAITING_APPROVAL').length,[state.proposals])
  const changePage=(next:PageKey)=>{setPage(next);setMobileOpen(false);window.scrollTo({top:0,behavior:'smooth'})}
  const pageTitle=navItems.find(x=>x.key===page)?.label
  return <div className="app-shell">
    <aside className={mobileOpen?'open':''}><div className="brand"><div><Flower2/></div><span><b>花掌柜</b><small>FlowerOps AI</small></span><button className="mobile-close" aria-label="关闭导航" onClick={()=>setMobileOpen(false)}><X/></button></div><div className="store-switch"><span className="avatar mini">花</span><div><b>小型鲜切花批零商家</b><small><i/>合成情景环境</small></div><ChevronRight size={16}/></div><nav>{navItems.map(item=><button key={item.key} className={page===item.key?'active':''} aria-current={page===item.key?'page':undefined} onClick={()=>changePage(item.key)}><item.icon size={19}/><span>{item.label}</span>{item.key==='decisions'&&pending>0&&<em>{pending}</em>}</button>)}</nav><div className="side-note"><ShieldCheck/><div><b>可信 AI 模式</b><p>查询与写入分离，业务动作必须人审。</p></div></div><div className="profile"><span className="avatar mini">林</span><div><b>演示审批人</b><small>店长角色 · MANAGER</small></div><PanelLeftClose size={18}/></div></aside>
    {mobileOpen&&<div className="backdrop" onClick={()=>setMobileOpen(false)}/>}<main><header><button className="menu-button" aria-label="打开导航" onClick={()=>setMobileOpen(true)}><Menu/></button><div><p>FLOWEROPS / {page.toUpperCase()}</p><h3>{pageTitle}</h3></div><div className="header-actions"><button className="icon-button" title="导出演示数据" onClick={()=>exportState(state)}><Download/></button><button className="ghost reset" onClick={()=>{if(confirm('确认重置全部合成演示数据？'))setState(resetState())}}><RefreshCcw size={16}/>重置 Demo</button><span className="avatar">林</span></div></header><div className="content">
      {page==='case'&&<CaseStudy go={changePage}/>} {page==='dashboard'&&<Dashboard state={state} go={changePage}/>} {page==='decisions'&&<Decisions state={state} setState={setState}/>} {page==='lab'&&<ModelLab state={state}/>} {page==='evaluation'&&<EvaluationCenter/>} {page==='orders'&&<Orders state={state}/>} {page==='inventory'&&<Inventory state={state}/>} {page==='purchasing'&&<Purchasing state={state}/>} {page==='customers'&&<Customers state={state}/>} {page==='ask'&&<AskBusiness state={state}/>} {page==='audit'&&<Audit state={state}/>}
    </div><footer><span>FlowerOps AI · 独立行业研究与受控 AI 决策实验</span><span>没有真实客户、收入或上线收益声明</span></footer></main>
  </div>
}
export default App
