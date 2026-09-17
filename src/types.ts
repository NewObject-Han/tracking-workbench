export type OrderStatus = '已下单' | '备料' | '生产中' | '验货' | '已完工' | '已出货'

export type RiskLevel = 'high' | 'mid' | 'low'

export type ProgressSource = 'ERP同步' | '工厂反馈' | '人工录入' | 'AI提取'

export type MilestoneStatus = 'pending' | 'completed' | 'delayed'

export type AppealType = '逾期' | '停滞' | '交期冲突'

export interface Milestone {
  id: string
  orderId: string
  name: OrderStatus
  plannedDate: string
  actualDate?: string
  status: MilestoneStatus
  source: ProgressSource
  updatedBy: string
  updatedAt: string
}

export interface Order {
  id: string
  orderNo: string
  customerOrderNo: string
  supplier: string
  sku: string
  skuName: string
  qty: number
  orderDate: string
  customerDue: string
  factoryDue: string
  planShipDate: string
  status: OrderStatus
  riskLevel: RiskLevel
  erpOrderNo: string
}

export interface Appeal {
  id: string
  orderId: string
  type: AppealType
  autoValue: string
  humanValue: string
  reason: string
  handledBy: string
  handledAt: string
}

export interface SyncFailure {
  id: string
  bizKey: string
  reason: string
}

export interface SyncTask {
  id: string
  object: '物料' | '供应商' | '采购订单'
  formId: string
  status: 'idle' | 'running' | 'success' | 'partial' | 'failed'
  lastRunAt: string
  successCount: number
  failedCount: number
  failures: SyncFailure[]
}

// ===== 外贸跟单扩展 =====

/** 产品生命周期：首单 / 翻单 / 废番 */
export type Lifecycle = '首单' | '翻单' | '废番'

/** 产品主数据：日本门店销量 + 日本仓库库存 + 供应商生产周期 */
export interface Product {
  id: string
  sku: string
  skuName: string
  supplier: string
  leadTimeDays: number // 生产周期（天）
  safetyStock: number // 安全库存
  jpStock: number // 日本仓库库存
  monthlySales: number // 月销量（日本门店合计）
  lifecycle: Lifecycle
}

/** 备货建议（由 derive 计算，非持久化） */
export interface ReplenishSuggestion {
  productId: string
  leadTimeConsumption: number // 生产周期内预计消耗
  suggestQty: number // 建议下单量
  needReplenish: boolean
}

/** 下单合同（由备货建议生成） */
export interface PurchaseContract {
  id: string
  contractNo: string
  productId: string
  sku: string
  skuName: string
  supplier: string
  qty: number
  createdAt: string
  status: '待发送' | '已发送'
}

/** 出货计划与工厂确认（业务②） */
export type ShipConfirmStatus = '待确认' | '已确认' | '有差异'
export interface ShipmentPlan {
  id: string
  sku: string
  skuName: string
  orderNo: string
  customerPlanDate: string // 客户计划船期
  qty: number
  factoryConfirmStatus: ShipConfirmStatus
  factoryConfirmDate?: string
  note?: string
}

/** 发票与货款（业务③） */
export type PayStatus = '未付' | '部分付' | '已付'
export interface Invoice {
  id: string
  invoiceNo: string
  supplier: string
  orderNo: string
  amount: number
  issueDate: string
  payStatus: PayStatus
  paidAmount: number
}

/** 供应商罚款（业务③） */
export type PenaltyStatus = '未处理' | '已处理'
export interface Penalty {
  id: string
  supplier: string
  orderNo: string
  reason: string
  amount: number
  status: PenaltyStatus
}

/** 产品跟单沟通记录：首单下单 / 翻单 / 废番等问题（业务④） */
export interface ProductComm {
  id: string
  productId: string
  sku: string
  type: Lifecycle | '其他'
  content: string
  date: string
  owner: string
}

/** 报关物流（业务⑤） */
export type LogisticsStatus = '报关中' | '已离港' | '在途' | '已到港'
export interface Logistics {
  id: string
  orderNo: string
  sku: string
  declarationNo: string // 报关单号
  hsCode: string // HS 编码
  logisticsNo: string // 物流单号
  carrier: string // 承运商
  status: LogisticsStatus
  etd: string // 预计离港
  eta: string // 预计到港
}

// ===== 金蝶双向同步日志 =====

/** 跟单动作回写 / 单据拉取 的同步记录 */
export interface SyncLogEntry {
  id: string
  dir: 'pull' | 'push' // pull=从金蝶拉取；push=回写金蝶
  formId: string // 关联金蝶 FormId（'*' 表示全量）
  desc: string // 描述
  at: string // 时间
  ok: boolean // 是否成功
}

// ===== 自定义规则引擎 =====

/** 规则触发事件 */
export type RuleTrigger =
  | 'REPLENISH_SUGGESTED' // 存在备货建议（需补货且无合同）
  | 'SHIPMENT_CONFIRMED' // 出货计划已确认
  | 'LOGISTICS_ARRIVED' // 物流已到港
  | 'INVOICE_OVERDUE' // 货款超期未付
  | 'FLOW_HIGH_RISK' // 流程高风险 / 异常

/** 规则执行动作 */
export type RuleAction =
  | 'CREATE_CONTRACT' // 自动生成备货合同
  | 'CREATE_ALERT' // 生成预警提醒
  | 'PUSH_KINGDEE' // 触发金蝶同步
  | 'OPEN_FINANCE' // 提醒财务对账

/** 规则前置条件（可选过滤） */
export interface RuleCondition {
  field?: 'supplier' | 'lifecycle' | 'sku'
  op?: 'eq' | 'neq' | 'in'
  value?: string | string[]
}

/** 自定义规则 */
export interface Rule {
  id: string
  name: string
  enabled: boolean
  trigger: RuleTrigger
  condition?: RuleCondition
  action: RuleAction
  autoExecute: boolean // true=匹配即自动执行；false=进入待执行队列
  createdAt: string
}

/** 规则执行日志 */
export interface RuleExecution {
  id: string
  ruleId: string
  ruleName: string
  target: string // 触发对象 key（sku / id）
  targetName: string
  action: RuleAction
  status: 'executed' | 'pending' | 'skipped'
  message: string
  at: string
}

/** 待执行动作（规则匹配但未自动执行） */
export interface PendingAction {
  ruleId: string
  ruleName: string
  target: string
  targetName: string
  action: RuleAction
  message: string
}

/** 站内提醒 */
export interface AppNotification {
  id: string
  level: 'info' | 'warning' | 'error'
  title: string
  desc: string
  at: string
  read: boolean
}
