export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'
export type ProposalStatus =
  | 'GENERATED' | 'VALIDATING' | 'AWAITING_APPROVAL' | 'APPROVED'
  | 'EXECUTING' | 'SUCCEEDED' | 'VALIDATION_FAILED' | 'REJECTED'
  | 'EXECUTION_FAILED' | 'COMPENSATED' | 'EXPIRED'
export type ProposalType =
  | 'CREATE_PURCHASE_ORDER' | 'CREATE_COLLECTION_DRAFT'
  | 'CREATE_PRICE_CHANGE' | 'CREATE_WASTE_PROPOSAL'

export interface Product {
  id: string; name: string; category: string; unit: string
  salePrice: number; defaultCost: number; safetyStock: number
}
export interface RecipeItem { productId: string; quantity: number }
export interface Recipe { id: string; name: string; outputProductId: string; items: RecipeItem[] }
export interface InventoryLot {
  id: string; productId: string; batchNo: string; qtyOnHand: number
  qtyReserved: number; qtyQualityHold: number; qtyExpired: number
  receivedAt: string; sellBy: string; unitCost: number; supplierId: string
  qualityGrade: 'A' | 'B' | 'C'; status: 'AVAILABLE' | 'NEAR_EXPIRY' | 'QUALITY_HOLD' | 'EXPIRED' | 'DEPLETED'
}
export interface InventoryMovement {
  id: string; lotId: string; productId: string
  type: 'RECEIPT' | 'RESERVE' | 'RELEASE' | 'SALE' | 'SCRAP' | 'ADJUSTMENT'
  quantity: number; referenceId: string; occurredAt: string; operator: string; note: string
}
export interface Supplier {
  id: string; name: string; leadTimeDays: number; reliability: number
  paymentTerms: string; products: string[]
}
export interface PurchaseOrder {
  id: string; supplierId: string; status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'SENT' | 'PARTIALLY_RECEIVED' | 'RECEIVED'
  amount: number; expectedAt: string; createdAt: string; sourceProposalId?: string
  items: Array<{ productId: string; quantity: number; unitCost: number }>
}
export interface Customer {
  id: string; name: string; type: '零售散客' | '企业客户' | '花艺工作室'
  creditLimit: number; paymentTermsDays: number; level: 'A' | 'B' | 'C'
}
export interface SalesOrder {
  id: string; customerId: string; source: '微信' | '门店' | '企业合同' | '小程序'
  status: 'DRAFT' | 'CONFIRMED' | 'STOCK_RESERVED' | 'PREPARING' | 'READY' | 'DELIVERING' | 'COMPLETED' | 'CANCELLED'
  deliveryAt: string; totalAmount: number
  items: Array<{ productId: string; quantity: number; unitPrice: number }>
}
export interface Receivable {
  id: string; customerId: string; orderId: string; amount: number; paidAmount: number
  dueDate: string; status: 'OPEN' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'DISPUTED'
}
export interface ActionProposal {
  id: string; type: ProposalType; title: string; reason: string
  evidence: Array<{ label: string; value: string; detail: string }>
  payload: Record<string, unknown>; expectedImpact: string; risk: RiskLevel
  status: ProposalStatus; idempotencyKey: string; generatedAt: string
  approvedBy?: string; approvedAt?: string; executionResult?: string
}
export interface AuditEvent {
  id: string; eventType: string; entityType: string; entityId: string
  actor: string; occurredAt: string; requestId: string; idempotencyKey?: string
  before?: string; after?: string; result: 'SUCCESS' | 'REJECTED' | 'FAILED'; detail: string
}
export interface AppState {
  schemaVersion: number; products: Product[]; recipes: Recipe[]; lots: InventoryLot[]
  movements: InventoryMovement[]; suppliers: Supplier[]; purchaseOrders: PurchaseOrder[]
  customers: Customer[]; orders: SalesOrder[]; receivables: Receivable[]
  proposals: ActionProposal[]; auditEvents: AuditEvent[]; executedKeys: string[]
}
