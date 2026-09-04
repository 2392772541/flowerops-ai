import { useEffect, useMemo, useState } from 'react'
import {
  Activity, AlertTriangle, Archive, ArrowRight, Bot, Box, Check, ChevronRight,
  CircleDollarSign, Clock3, Download, FileCheck2, Flower2,
  Gauge, LayoutDashboard, Menu, PackageCheck, PanelLeftClose, RefreshCcw,
  Search, Send, ShieldCheck, ShoppingCart, Sparkles, Store, Truck, Users, X
} from 'lucide-react'
import './App.css'
import { approveProposal, currency, daysUntil, executeProposal, freshnessFactor, inventorySummary, percent, rejectProposal, riskLabel, sellableQty, wasteRisk } from './domain/engine'
import type { ActionProposal, AppState, InventoryLot, ProposalStatus } from './domain/types'
import { exportState, loadState, resetState, saveState } from './storage/repository'
import { ruleAIProvider } from './ai/ruleProvider'

type PageKey = 'dashboard' | 'decisions' | 'orders' | 'inventory' | 'purchasing' | 'customers' | 'ask' | 'audit'
const navItems: Array<{ key: PageKey; label: string; icon: typeof LayoutDashboard }> = [
  { key: 'dashboard', label: '经营总览', icon: LayoutDashboard },
  { key: 'decisions', label: 'AI 决策中心', icon: Sparkles },
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
  return <>
    <div className="hero-panel">
      <div><Badge tone="mint">合成演示数据 · 2026年9月4日</Badge><h1>早上好，林店长</h1><p>AI 已完成今日经营巡检，发现 <b>{pending.length} 项</b>需要你决策的问题。</p></div>
      <button className="primary" onClick={() => go('decisions')}><Sparkles size={18} /> 查看 AI 建议 <ArrowRight size={16} /></button>
    </div>
    <div className="stats-grid">
      <StatCard label="今日销售额" value="¥18,460" note="较上周同日 +12.8%" tone="purple" icon={CircleDollarSign} />
      <StatCard label="预计毛利" value="¥8,302" note="毛利率 45.0%" tone="green" icon={Activity} />
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
      <SectionTitle eyebrow="BUSINESS PULSE" title="近 7 日经营脉搏" action={<Badge tone="mint">规则引擎实时计算</Badge>} />
      <div className="chart-wrap"><div className="chart-labels"><span>24k</span><span>16k</span><span>8k</span><span>0</span></div><div className="bars">{[48,62,55,76,68,88,79].map((height,i)=><div key={i} className="bar-col"><i style={{height:height+'%'}}><em>{i===5?'¥21.2k':''}</em></i><span>{['8/29','8/30','8/31','9/1','9/2','9/3','今天'][i]}</span></div>)}</div></div>
    </section>
  </>
}

function ProposalCard({ item, selected, onSelect }: { item: ActionProposal; selected: boolean; onSelect: () => void }) {
  return <button className={'proposal-row ' + (selected ? 'selected' : '')} onClick={onSelect}><div className={'proposal-icon ' + item.risk.toLowerCase()}>{item.type === 'CREATE_PURCHASE_ORDER' ? <Truck/> : item.type === 'CREATE_COLLECTION_DRAFT' ? <Send/> : <AlertTriangle/>}</div><div><div><b>{item.title}</b><Badge tone={statusClass(item.status)}>{statusLabels[item.status]}</Badge></div><p>{item.reason}</p><small>{new Date(item.generatedAt).toLocaleString('zh-CN')} · {riskLabel(item.risk)}</small></div><ChevronRight size={18}/></button>
}
function Decisions({ state, setState }: { state: AppState; setState: (s: AppState) => void }) {
  const [selectedId, setSelectedId] = useState(state.proposals[0]?.id)
  const selected = state.proposals.find(x => x.id === selectedId) ?? state.proposals[0]
  return <div className="decision-layout">
    <section className="panel proposal-list"><SectionTitle eyebrow="ACTION PROPOSALS" title="AI 业务动作提案" action={<Badge tone="warning">{state.proposals.filter(x=>x.status==='AWAITING_APPROVAL').length} 项待审批</Badge>} />{state.proposals.map(item => <ProposalCard key={item.id} item={item} selected={item.id===selected?.id} onSelect={()=>setSelectedId(item.id)} />)}</section>
    {selected && <section className="panel proposal-detail"><div className="detail-head"><div><Badge tone={selected.risk.toLowerCase()}>{riskLabel(selected.risk)}</Badge><h2>{selected.title}</h2><p>{selected.reason}</p></div><Badge tone={statusClass(selected.status)}>{statusLabels[selected.status]}</Badge></div>
      <div className="explain-block"><h3><Search size={17}/> 证据链</h3><div className="evidence-grid">{selected.evidence.map(e=><div key={e.label}><span>{e.label}</span><b>{e.value}</b><small>{e.detail}</small></div>)}</div></div>
      <div className="explain-block"><h3><Activity size={17}/> 预期影响</h3><p>{selected.expectedImpact}</p></div>
      <div className="write-preview"><div><FileCheck2 size={19}/><div><b>将执行的写操作</b><p>{selected.type === 'CREATE_PURCHASE_ORDER' ? '仅创建采购草稿，不自动发送供应商' : selected.type === 'CREATE_COLLECTION_DRAFT' ? '仅生成催款消息草稿，不自动发送客户' : selected.type === 'CREATE_WASTE_PROPOSAL' ? '仅创建报损复核单，不直接扣减库存' : '仅创建调价待办，不直接修改售价'}</p></div></div><code>{JSON.stringify(selected.payload, null, 2)}</code></div>
      <div className="role-strip"><ShieldCheck size={18}/><div><b>权限与执行边界</b><p>规则 AI（AI_AGENT）只能读取数据和生成提案；当前审批身份为店长（MANAGER）；批准后的动作由系统执行器（SYSTEM_EXECUTOR）按幂等键安全执行。</p></div></div>
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
  return <div className="ask-layout"><section className="panel ask-panel"><div className="ask-hero"><div className="bot-orb"><Bot/></div><Badge tone="mint">安全经营问数</Badge><h2>用自然语言查询经营数据</h2><p>使用经过校验的只读查询模板，不允许 AI 自由执行数据库写操作。</p></div><div className="question-box"><textarea value={question} onChange={e=>setQuestion(e.target.value)} aria-label="经营问题"/><button className="primary" onClick={()=>ask()} disabled={loading}>{loading?<RefreshCcw className="spin" size={18}/>:<Sparkles size={18}/>}分析</button></div><div className="suggestions">{questions.map(q=><button key={q} onClick={()=>{setQuestion(q);ask(q)}}>{q}</button>)}</div></section><section className="panel answer-panel"><SectionTitle eyebrow="EXPLAINABLE ANSWER" title={result.title} action={<Badge tone="success">有数据依据</Badge>}/><div className="answer-copy"><Sparkles/><p>{result.answer}</p></div><div className="query-proof"><ShieldCheck/><div><b>查询安全说明</b><p>{result.query}</p><small>数据表：{result.evidence.join('、')}</small></div></div><div className="limits"><AlertTriangle/><p><b>结果边界：</b>当前为合成演示数据和可配置 MVP 规则，不代表真实行业经营结论。</p></div></section></div>
}

function Audit({ state }: { state: AppState }) { return <section className="panel"><SectionTitle eyebrow="AUDIT TRAIL" title="审计中心" action={<Badge tone="mint">不可删除 · 可追溯</Badge>} /><div className="audit-list">{state.auditEvents.map(event=><article key={event.id}><div className={'audit-icon '+statusClass(event.result)}>{event.result==='SUCCESS'?<Check/>:event.result==='REJECTED'?<X/>:<AlertTriangle/>}</div><div className="audit-body"><div><b>{event.eventType}</b><Badge tone={statusClass(event.result)}>{event.result}</Badge></div><p>{event.detail}</p><div className="audit-meta"><span>{event.entityType} · {event.entityId}</span><span>{event.actor}{event.actorRole?' · '+event.actorRole:''}</span><span>{new Date(event.occurredAt).toLocaleString('zh-CN')}</span></div>{event.before&&<div className="state-change"><code>{event.before}</code><ArrowRight size={14}/><code>{event.after}</code></div>}<small>Request ID: {event.requestId}{event.idempotencyKey?' · Idempotency Key: '+event.idempotencyKey:''}</small></div></article>)}</div></section> }

function App() {
  const [state,setState]=useState<AppState>(()=>loadState())
  const [page,setPage]=useState<PageKey>('dashboard')
  const [mobileOpen,setMobileOpen]=useState(false)
  useEffect(()=>saveState(state),[state])
  const pending=useMemo(()=>state.proposals.filter(x=>x.status==='AWAITING_APPROVAL').length,[state.proposals])
  const changePage=(next:PageKey)=>{setPage(next);setMobileOpen(false);window.scrollTo({top:0,behavior:'smooth'})}
  const pageTitle=navItems.find(x=>x.key===page)?.label
  return <div className="app-shell">
    <aside className={mobileOpen?'open':''}><div className="brand"><div><Flower2/></div><span><b>花掌柜</b><small>FlowerOps AI</small></span><button className="mobile-close" onClick={()=>setMobileOpen(false)}><X/></button></div><div className="store-switch"><span className="avatar mini">花</span><div><b>花屿鲜花 · 成都店</b><small><i/>营业中</small></div><ChevronRight size={16}/></div><nav>{navItems.map(item=><button key={item.key} className={page===item.key?'active':''} onClick={()=>changePage(item.key)}><item.icon size={19}/><span>{item.label}</span>{item.key==='decisions'&&pending>0&&<em>{pending}</em>}</button>)}</nav><div className="side-note"><ShieldCheck/><div><b>可信 AI 模式</b><p>查询与写入分离，业务动作必须人审。</p></div></div><div className="profile"><span className="avatar mini">林</span><div><b>林夏</b><small>店长 · 完整权限</small></div><PanelLeftClose size={18}/></div></aside>
    {mobileOpen&&<div className="backdrop" onClick={()=>setMobileOpen(false)}/>}<main><header><button className="menu-button" onClick={()=>setMobileOpen(true)}><Menu/></button><div><p>FLOWEROPS / {page.toUpperCase()}</p><h3>{pageTitle}</h3></div><div className="header-actions"><button className="icon-button" title="导出演示数据" onClick={()=>exportState(state)}><Download/></button><button className="ghost reset" onClick={()=>{if(confirm('确认重置全部合成演示数据？'))setState(resetState())}}><RefreshCcw size={16}/>重置 Demo</button><span className="avatar">林</span></div></header><div className="content">
      {page==='dashboard'&&<Dashboard state={state} go={changePage}/>} {page==='decisions'&&<Decisions state={state} setState={setState}/>} {page==='orders'&&<Orders state={state}/>} {page==='inventory'&&<Inventory state={state}/>} {page==='purchasing'&&<Purchasing state={state}/>} {page==='customers'&&<Customers state={state}/>} {page==='ask'&&<AskBusiness state={state}/>} {page==='audit'&&<Audit state={state}/>} 
    </div><footer><span>FlowerOps AI · 鲜切花经营决策工作台</span><span>所有经营数据均为合成演示数据</span></footer></main>
  </div>
}
export default App
