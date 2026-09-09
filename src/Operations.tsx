import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { AppState, PurchaseOrder } from './domain/types'
import { currency } from './domain/engine'
import { advancePurchase } from './domain/purchasing'

type Props = { state: AppState; setState: (s: AppState) => void }
const labels: Record<string, string> = { DRAFT: '草稿', PENDING_APPROVAL: '待审批', APPROVED: '已批准', SENT: '已下单', RECEIVED: '已收货', RECONCILED: '已对账', CLOSED: '已关闭' }
export function PurchaseWorkspace({ state, setState }: Props) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('')
  const [error, setError] = useState('')
  const [sellBy, setSellBy] = useState('')
  const [supplier, setSupplier] = useState(state.suppliers[0].id)
  const selectedSupplier = state.suppliers.find(s => s.id === supplier)!
  const name = (id: string) => state.products.find(p => p.id === id)?.name ?? id
  const po = state.purchaseOrders.find(p => p.id === id)
  const next: Partial<Record<PurchaseOrder['status'], [PurchaseOrder['status'], string]>> = {
    DRAFT: ['PENDING_APPROVAL', '提交审批'], PENDING_APPROVAL: ['APPROVED', '确认批准'],
    APPROVED: ['SENT', '记录已向供应商下单'], SENT: ['RECEIVED', '确认整单验收入库'],
    RECEIVED: ['RECONCILED', '确认对账'], RECONCILED: ['CLOSED', '关闭采购单'],
  }
  return <section className="panel operations"><p><Link to="/dashboard">工作台</Link> / <Link to="/purchasing">采购管理</Link>{id && ` / ${id === 'new' ? '新建采购单' : id}`}</p>
    {id === 'new' ? <><h1>新建采购单</h1><p>填写采购明细，保存草稿后提交审批。</p><form onSubmit={e => {
      e.preventDefault(); const data = new FormData(e.currentTarget)
      const productId = String(data.get('product')); const quantity = Number(data.get('quantity')); const unitCost = Number(data.get('cost'))
      if (!selectedSupplier.products.includes(productId) || !Number.isInteger(quantity) || quantity <= 0 || !Number.isFinite(unitCost) || unitCost <= 0) { setError('请检查商品、数量和价格'); return }
      const now = new Date().toISOString(); const expectedAt = String(data.get('expected'))
      if (expectedAt < now.slice(0, 10)) { setError('预计到货不能早于今天'); return }
      const created: PurchaseOrder = { id: 'PO-' + crypto.randomUUID().slice(0, 8), supplierId: supplier, status: 'DRAFT', createdAt: now, expectedAt, amount: quantity * unitCost, items: [{ productId, quantity, unitCost }] }
      setState({ ...state, purchaseOrders: [created, ...state.purchaseOrders] }); navigate('/purchasing/' + created.id)
    }}><label>供应商<select value={supplier} onChange={e => setSupplier(e.target.value)}>{state.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>商品<select name="product" key={supplier}>{selectedSupplier.products.map(p => <option key={p} value={p}>{name(p)}</option>)}</select></label><label>数量（枝）<input name="quantity" type="number" min="1" step="1" required /></label><label>采购单价（元）<input name="cost" type="number" min="0.01" step="0.01" required /></label><label>预计到货日期<input name="expected" type="date" min={new Date().toISOString().slice(0,10)} required /></label><button className="primary">保存草稿</button><Link to="/purchasing">取消</Link></form></> : id ? po ? <><h1>{po.id}</h1><p className="badge">{labels[po.status] ?? po.status}</p><h2>{state.suppliers.find(s => s.id === po.supplierId)?.name}</h2><p>预计到货 {po.expectedAt} · 总额 {currency(po.amount)}</p><table><thead><tr><th>商品</th><th>数量</th><th>采购单价</th><th>小计</th></tr></thead><tbody>{po.items.map(item => <tr key={item.productId}><td>{name(item.productId)}</td><td>{item.quantity}</td><td>¥{item.unitCost.toFixed(2)}</td><td>{currency(item.quantity * item.unitCost)}</td></tr>)}</tbody></table><div className="operation-action">{po.status === 'SENT' && <label>验收合格 · 可售截止日期<input type="date" value={sellBy} onInput={e => setSellBy(e.currentTarget.value)} /></label>}{next[po.status] && <button className="primary" onClick={() => { try { setState(advancePurchase(state, po.id, next[po.status]![0], sellBy)); setError('') } catch (e) { setError((e as Error).message) } }}>{next[po.status]![1]}</button>}</div><p>演示工作区：下单记录不会向供应商发送消息。收货会更新本地库存与流水。</p><Link to="/inventory">查看批次库存 →</Link><h2>处理记录</h2>{state.auditEvents.filter(e => e.entityId === po.id).map(e => <p key={e.id}>{new Date(e.occurredAt).toLocaleString()} · {e.detail}</p>)}</> : <><h1>采购单不存在</h1><Link to="/purchasing">返回采购列表</Link></> : <><div className="section-title"><div><h1>采购管理</h1><p>从采购申请到验收入库，跟进每一笔花材采购。</p></div><Link className="primary" to="/purchasing/new">＋ 新建采购单</Link></div><div className="operation-action"><input aria-label="搜索采购单" placeholder="搜索采购单号或供应商" value={search} onChange={e => setSearch(e.target.value)} /><select aria-label="采购状态" value={filter} onChange={e => setFilter(e.target.value)}><option value="">全部状态</option>{Object.entries(labels).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></div><div className="table-wrap"><table><thead><tr><th>采购单号</th><th>供应商</th><th>预计到货</th><th>金额</th><th>状态</th></tr></thead><tbody>{state.purchaseOrders.filter(p => (!filter || p.status === filter) && (p.id + state.suppliers.find(s => s.id === p.supplierId)?.name).toLowerCase().includes(search.toLowerCase())).map(p => <tr key={p.id}><td><Link to={'/purchasing/' + p.id}>{p.id} →</Link></td><td>{state.suppliers.find(s => s.id === p.supplierId)?.name}</td><td>{p.expectedAt}</td><td>{currency(p.amount)}</td><td>{labels[p.status] ?? p.status}</td></tr>)}</tbody></table></div></>}
    {error && <p role="alert">{error}</p>}
  </section>
}

export function OrderWorkspace({ state }: { state: AppState }) {
  const { id } = useParams()
  const [query,setQuery] = useState('')
  const order = state.orders.find(o => o.id === id)
  return <section className="panel operations"><p><Link to="/dashboard">工作台</Link> / <Link to="/orders">订单管理</Link>{id && ' / ' + id}</p><h1>{id ?? '订单管理'}</h1>{id ? order ? <><h2>{state.customers.find(c => c.id === order.customerId)?.name}</h2><p>交付时间：{order.deliveryAt} · 来源：{order.source} · {order.status}</p><table><thead><tr><th>商品</th><th>数量</th><th>单价</th></tr></thead><tbody>{order.items.map(i => <tr key={i.productId}><td>{state.products.find(p => p.id === i.productId)?.name}</td><td>{i.quantity}</td><td>{currency(i.unitPrice)}</td></tr>)}</tbody></table><h2>合计 {currency(order.totalAmount)}</h2><Link to="/inventory">核对花材库存 →</Link><p><Link to="/purchasing/new">发起补货采购 →</Link></p></> : <p>订单不存在</p> : <><input aria-label="搜索订单" placeholder="搜索订单号" value={query} onChange={e => setQuery(e.target.value)} /><table><thead><tr><th>订单</th><th>客户</th><th>交付时间</th><th>金额</th></tr></thead><tbody>{state.orders.filter(o => o.id.includes(query)).map(o => <tr key={o.id}><td><Link to={'/orders/' + o.id}>{o.id} →</Link></td><td>{state.customers.find(c => c.id === o.customerId)?.name}</td><td>{o.deliveryAt}</td><td>{currency(o.totalAmount)}</td></tr>)}</tbody></table></>}</section>
}
