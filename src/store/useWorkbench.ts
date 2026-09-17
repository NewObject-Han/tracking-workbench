import { create } from 'zustand'
import dayjs from 'dayjs'
import type {
  Appeal,
  AppealType,
  AppNotification,
  Invoice,
  Lifecycle,
  Logistics,
  LogisticsStatus,
  Milestone,
  Order,
  Penalty,
  PendingAction,
  Product,
  ProductComm,
  ProgressSource,
  PurchaseContract,
  Rule,
  RuleExecution,
  ShipConfirmStatus,
  ShipmentPlan,
  SyncLogEntry,
  SyncTask,
} from '@/types'
import {
  mockInvoices,
  mockLogistics,
  mockMilestones,
  mockOrders,
  mockPenalties,
  mockProductComms,
  mockProducts,
  mockShipments,
  mockSyncTasks,
  NODE_SEQUENCE,
  kingdeeData,
} from '@/mock/data'
import {
  FORMS,
  toInvoices,
  toLogistics,
  toProducts,
  toShipments,
  type KingdeeDataset,
  type RawPurchaseOrder,
} from '@/api/kingdee'
import { replenishOf } from '@/utils/derive'
import { matchRule, type RuleContext, type RuleTarget } from '@/utils/rules'

/** 深拷贝金蝶数据集，避免直接改动模块级常量（保证可被重新拉取覆盖） */
function cloneKingdee(src: KingdeeDataset): KingdeeDataset {
  return JSON.parse(JSON.stringify(src))
}

/** 供应商名称 → 金蝶 FNumber */
function supplierFNumber(kd: KingdeeDataset, name: string): string {
  return kd.suppliers.find((s) => s.FName === name)?.FNumber ?? name
}

/** 由金蝶数据集重新派生各业务域（拉取后刷新） */
function deriveAll(kd: KingdeeDataset) {
  return {
    products: toProducts(kd),
    shipments: toShipments(kd),
    invoices: toInvoices(kd),
    logistics: toLogistics(kd),
  }
}

interface WorkbenchState {
  orders: Order[]
  milestones: Milestone[]
  appeals: Appeal[]
  syncTasks: SyncTask[]
  // 外贸模块
  products: Product[]
  shipments: ShipmentPlan[]
  invoices: Invoice[]
  penalties: Penalty[]
  productComms: ProductComm[]
  logistics: Logistics[]
  contracts: PurchaseContract[]
  // 金蝶数据集（双向同步的可写副本）+ 同步日志
  kingdee: KingdeeDataset
  syncLog: SyncLogEntry[]

  /** 人工录入节点实际日期 */
  setMilestoneActual: (
    milestoneId: string,
    actualDate: string,
    source: ProgressSource,
    operator: string,
  ) => void
  /** 确认 AI 提取的节点，转为正式进度 */
  confirmMilestone: (milestoneId: string, operator: string) => void
  /** 人工申诉，覆盖自动判定 */
  addAppeal: (input: {
    orderId: string
    type: AppealType
    autoValue: string
    humanValue: string
    reason: string
    operator: string
  }) => void
  /** 单条同步失败重试 */
  retryFailure: (taskId: string, failureId: string) => void
  /** 触发同步任务 */
  runSync: (taskId: string) => void
  /** 从金蝶云星空拉取最新单据，覆盖刷新各业务域 */
  pullFromKingdee: () => void

  /** ① 根据产品生成下单合同（备货），并回写金蝶采购订单 */
  generateContract: (productId: string, qty: number) => void
  /** ② 确认出货计划（工厂确认状态流转），并回写金蝶发货通知单 */
  confirmShipment: (id: string, status: ShipConfirmStatus, note?: string) => void
  /** ③ 标记发票已付款，并回写金蝶应付单 */
  markPaid: (invoiceId: string) => void
  /** ③ 处理供应商罚款 */
  resolvePenalty: (id: string) => void
  /** ④ 新增产品跟单沟通记录 */
  addComm: (input: {
    productId: string
    sku: string
    type: Lifecycle | '其他'
    content: string
    owner: string
  }) => void
  /** ⑤ 更新物流状态，并回写金蝶销售出库单 */
  updateLogistics: (id: string, status: LogisticsStatus) => void

  // ===== 自定义规则引擎 =====
  rules: Rule[]
  ruleLog: RuleExecution[]
  pendingActions: PendingAction[]
  notifications: AppNotification[]
  /** 运行规则引擎：匹配各启用规则，自动执行或进入待执行队列 */
  runRules: () => void
  /** 执行单条待执行动作 */
  executePending: (ruleId: string, target: string) => void
  /** 新增规则 */
  addRule: (input: Omit<Rule, 'id' | 'createdAt'>) => void
  /** 修改规则 */
  updateRule: (id: string, patch: Partial<Rule>) => void
  /** 删除规则 */
  deleteRule: (id: string) => void
  /** 启用 / 停用规则 */
  toggleRule: (id: string) => void
  /** 清空待执行队列 */
  clearPending: () => void
  /** 新增提醒 */
  addNotification: (n: Omit<AppNotification, 'id' | 'at' | 'read'>) => void
}

function advanceStatus(order: Order, milestones: Milestone[]): Order['status'] {
  const done = new Set(
    milestones.filter((m) => m.status === 'completed').map((m) => m.name),
  )
  let current = order.status
  for (const node of NODE_SEQUENCE) {
    if (done.has(node)) current = node
    else break
  }
  return current
}

/** 规则引擎默认规则（演示用，开箱即用） */
const DEFAULT_RULES: Rule[] = [
  { id: 'r1', name: '备货建议自动建合同', enabled: true, trigger: 'REPLENISH_SUGGESTED', action: 'CREATE_CONTRACT', autoExecute: true, createdAt: '2026-09-16 16:00:00' },
  { id: 'r2', name: '出货确认后提醒物流跟进', enabled: true, trigger: 'SHIPMENT_CONFIRMED', action: 'CREATE_ALERT', autoExecute: false, createdAt: '2026-09-16 16:00:00' },
  { id: 'r3', name: '到港自动触发财务对账', enabled: true, trigger: 'LOGISTICS_ARRIVED', action: 'OPEN_FINANCE', autoExecute: false, createdAt: '2026-09-16 16:00:00' },
  { id: 'r4', name: '超期未付自动预警', enabled: true, trigger: 'INVOICE_OVERDUE', action: 'CREATE_ALERT', autoExecute: true, createdAt: '2026-09-16 16:00:00' },
  { id: 'r5', name: '高风险流程预警', enabled: true, trigger: 'FLOW_HIGH_RISK', action: 'CREATE_ALERT', autoExecute: false, createdAt: '2026-09-16 16:00:00' },
]

let notifSeq = 0
function makeNotif(level: AppNotification['level'], title: string, desc: string): AppNotification {
  notifSeq += 1
  return {
    id: `n-${Date.now()}-${notifSeq}`,
    level,
    title,
    desc,
    at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    read: false,
  }
}

/** 执行单条规则动作，返回执行结果（可能附带提醒） */
function execRuleAction(
  rule: Rule,
  m: RuleTarget,
  api: WorkbenchState,
): { message: string; notification?: AppNotification } {
  switch (rule.action) {
    case 'CREATE_CONTRACT': {
      const sku = m.meta.sku ?? m.key
      const p = api.products.find((x) => x.sku === sku)
      if (p) api.generateContract(p.id, replenishOf(p).suggestQty)
      return { message: `已自动生成备货合同（${sku}）` }
    }
    case 'PUSH_KINGDEE':
      api.pullFromKingdee()
      return { message: '已触发金蝶同步' }
    case 'CREATE_ALERT':
      return { message: `已生成预警：${m.message}`, notification: makeNotif('warning', rule.name, m.message) }
    case 'OPEN_FINANCE':
      return { message: `已提醒财务对账：${m.name}`, notification: makeNotif('info', '财务对账提醒', m.message) }
  }
}

export const useWorkbench = create<WorkbenchState>((set, get) => ({
  orders: mockOrders,
  milestones: mockMilestones,
  appeals: [],
  syncTasks: mockSyncTasks,
  // 外贸模块初始数据
  products: mockProducts,
  shipments: mockShipments,
  invoices: mockInvoices,
  penalties: mockPenalties,
  productComms: mockProductComms,
  logistics: mockLogistics,
  contracts: [],
  // 金蝶可写副本 + 同步日志
  kingdee: cloneKingdee(kingdeeData),
  syncLog: [],
  // 规则引擎
  rules: DEFAULT_RULES,
  ruleLog: [],
  pendingActions: [],
  notifications: [],

  setMilestoneActual: (milestoneId, actualDate, source, operator) =>
    set((state) => {
      const milestones = state.milestones.map((m) =>
        m.id === milestoneId
          ? {
              ...m,
              actualDate,
              status: 'completed' as const,
              source,
              updatedBy: operator,
              updatedAt: dayjs().format('YYYY-MM-DD'),
            }
          : m,
      )
      const target = milestones.find((m) => m.id === milestoneId)
      const orders = state.orders.map((o) => {
        if (!target || o.id !== target.orderId) return o
        const own = milestones.filter((m) => m.orderId === o.id)
        return { ...o, status: advanceStatus(o, own) }
      })
      return { milestones, orders }
    }),

  confirmMilestone: (milestoneId, operator) =>
    set((state) => ({
      milestones: state.milestones.map((m) =>
        m.id === milestoneId
          ? {
              ...m,
              source: '人工录入' as ProgressSource,
              updatedBy: operator,
              updatedAt: dayjs().format('YYYY-MM-DD'),
            }
          : m,
      ),
    })),

  addAppeal: ({ orderId, type, autoValue, humanValue, reason, operator }) =>
    set((state) => ({
      appeals: [
        ...state.appeals,
        {
          id: `ap-${state.appeals.length + 1}`,
          orderId,
          type,
          autoValue,
          humanValue,
          reason,
          handledBy: operator,
          handledAt: dayjs().format('YYYY-MM-DD HH:mm'),
        },
      ],
    })),

  retryFailure: (taskId, failureId) =>
    set((state) => ({
      syncTasks: state.syncTasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              failures: t.failures.filter((f) => f.id !== failureId),
              failedCount: Math.max(0, t.failedCount - 1),
              successCount: t.successCount + 1,
              status: t.failures.length - 1 === 0 ? 'success' : 'partial',
            }
          : t,
      ),
    })),

  runSync: (taskId) =>
    set((state) => ({
      syncTasks: state.syncTasks.map((t) =>
        t.id === taskId
          ? { ...t, status: 'running', lastRunAt: dayjs().format('YYYY-MM-DD HH:mm:ss') }
          : t,
      ),
    })),

  pullFromKingdee: () =>
    set((state) => {
      const derived = deriveAll(state.kingdee)
      const at = dayjs().format('YYYY-MM-DD HH:mm:ss')
      const syncTasks = state.syncTasks.map((t) => ({
        ...t,
        status: 'success' as const,
        lastRunAt: at,
      }))
      const log: SyncLogEntry = {
        id: `log-${state.syncLog.length + 1}`,
        dir: 'pull',
        formId: '*',
        desc: '从金蝶云星空拉取最新单据（物料/供应商/采购/发货/应付/出库）',
        at,
        ok: true,
      }
      return { ...derived, syncTasks, syncLog: [log, ...state.syncLog].slice(0, 60) }
    }),

  generateContract: (productId, qty) =>
    set((state) => {
      const p = state.products.find((x) => x.id === productId)
      if (!p) return {}
      const seq = state.contracts.length + 1
      const contractNo = `CT-${dayjs().format('YYYYMMDD')}-${String(seq).padStart(3, '0')}`
      const contract: PurchaseContract = {
        id: `ct-${seq}`,
        contractNo,
        productId: p.id,
        sku: p.sku,
        skuName: p.skuName,
        supplier: p.supplier,
        qty,
        createdAt: dayjs().format('YYYY-MM-DD HH:mm'),
        status: '已发送',
      }
      // 回写金蝶：新增采购订单 PUR_PurchaseOrder
      const po: RawPurchaseOrder = {
        FID: String(state.kingdee.purchaseOrders.length + 1),
        FBillNo: contractNo,
        FSourceBillNo: p.sku,
        FDate: dayjs().format('YYYY-MM-DD'),
        FSupplierId_FNumber: supplierFNumber(state.kingdee, p.supplier),
        FMaterialId_FNumber: p.sku,
        FQty: qty,
        FDeliveryDate: dayjs().add(p.leadTimeDays, 'day').format('YYYY-MM-DD'),
        F_JPCustDue: dayjs().add(p.leadTimeDays, 'day').format('YYYY-MM-DD'),
        F_JPShipDate: dayjs().add(p.leadTimeDays, 'day').format('YYYY-MM-DD'),
        FDocumentStatus: 'Z',
      }
      const kingdee: KingdeeDataset = {
        ...state.kingdee,
        purchaseOrders: [...state.kingdee.purchaseOrders, po],
      }
      const at = dayjs().format('YYYY-MM-DD HH:mm:ss')
      const log: SyncLogEntry = {
        id: `log-${state.syncLog.length + 1}`,
        dir: 'push',
        formId: FORMS.PUR_PURCHASE_ORDER,
        desc: `回写采购订单 ${contractNo} → 金蝶（${p.sku} × ${qty.toLocaleString()}）`,
        at,
        ok: true,
      }
      return {
        contracts: [...state.contracts, contract],
        kingdee,
        syncLog: [log, ...state.syncLog].slice(0, 60),
      }
    }),

  confirmShipment: (id, status, note) =>
    set((state) => {
      const shipments = state.shipments.map((s) =>
        s.id === id
          ? {
              ...s,
              factoryConfirmStatus: status,
              factoryConfirmDate:
                status === '已确认' ? dayjs().format('YYYY-MM-DD') : s.factoryConfirmDate,
              note: note ?? s.note,
            }
          : s,
      )
      const target = state.shipments.find((s) => s.id === id)
      let kingdee = state.kingdee
      let syncLog = state.syncLog
      if (target) {
        const notice = state.kingdee.deliveryNotices.find(
          (d) => d.FMaterialID_FNumber === target.sku,
        )
        if (notice) {
          kingdee = {
            ...state.kingdee,
            deliveryNotices: state.kingdee.deliveryNotices.map((d) =>
              d === notice
                ? { ...d, F_JPConfirm: status, F_JPNote: note ?? d.F_JPNote }
                : d,
            ),
          }
          const at = dayjs().format('YYYY-MM-DD HH:mm:ss')
          const log: SyncLogEntry = {
            id: `log-${syncLog.length + 1}`,
            dir: 'push',
            formId: FORMS.SAL_DELIVERY_NOTICE,
            desc: `回写出货确认 ${target.sku} → 金蝶（${status}）`,
            at,
            ok: true,
          }
          syncLog = [log, ...syncLog].slice(0, 60)
        }
      }
      return { shipments, kingdee, syncLog }
    }),

  markPaid: (invoiceId) =>
    set((state) => {
      const invoices = state.invoices.map((iv) =>
        iv.id === invoiceId
          ? { ...iv, payStatus: '已付' as const, paidAmount: iv.amount }
          : iv,
      )
      const target = state.invoices.find((iv) => iv.id === invoiceId)
      let kingdee = state.kingdee
      let syncLog = state.syncLog
      if (target) {
        kingdee = {
          ...state.kingdee,
          payableBills: state.kingdee.payableBills.map((b) =>
            b.FBillNo === target.invoiceNo
              ? { ...b, F_JPPayStatus: '已付', F_JPPaid: b.FAmount }
              : b,
          ),
        }
        const at = dayjs().format('YYYY-MM-DD HH:mm:ss')
        const log: SyncLogEntry = {
          id: `log-${syncLog.length + 1}`,
          dir: 'push',
          formId: FORMS.AP_PAYABLE_BILL,
          desc: `回写付款状态 ${target.invoiceNo} → 金蝶（已付）`,
          at,
          ok: true,
        }
        syncLog = [log, ...syncLog].slice(0, 60)
      }
      return { invoices, kingdee, syncLog }
    }),

  resolvePenalty: (id) =>
    set((state) => ({
      penalties: state.penalties.map((p) =>
        p.id === id ? { ...p, status: '已处理' as const } : p,
      ),
    })),

  addComm: ({ productId, sku, type, content, owner }) =>
    set((state) => ({
      productComms: [
        ...state.productComms,
        {
          id: `pc-${state.productComms.length + 1}`,
          productId,
          sku,
          type,
          content,
          date: dayjs().format('YYYY-MM-DD'),
          owner,
        },
      ],
    })),

  updateLogistics: (id, status) =>
    set((state) => {
      const logistics = state.logistics.map((l) =>
        l.id === id ? { ...l, status } : l,
      )
      const target = state.logistics.find((l) => l.id === id)
      let kingdee = state.kingdee
      let syncLog = state.syncLog
      if (target) {
        kingdee = {
          ...state.kingdee,
          outStocks: state.kingdee.outStocks.map((o) =>
            o.FMaterialID_FNumber === target.sku
              ? { ...o, F_JPLogiStatus: status }
              : o,
          ),
        }
        const at = dayjs().format('YYYY-MM-DD HH:mm:ss')
        const log: SyncLogEntry = {
          id: `log-${syncLog.length + 1}`,
          dir: 'push',
          formId: FORMS.SAL_OUT_STOCK,
          desc: `回写物流状态 ${target.sku} → 金蝶（${status}）`,
          at,
          ok: true,
        }
        syncLog = [log, ...syncLog].slice(0, 60)
      }
      return { logistics, kingdee, syncLog }
    }),

  // ===== 自定义规则引擎 =====

  runRules: () => {
    const api = get()
    const ctx: RuleContext = {
      products: api.products,
      contracts: api.contracts,
      shipments: api.shipments,
      logistics: api.logistics,
      invoices: api.invoices,
      orders: api.orders,
    }
    const fired = new Set(
      api.ruleLog.filter((e) => e.status !== 'skipped').map((e) => `${e.ruleId}|${e.target}`),
    )
    const pending: PendingAction[] = []
    const log: RuleExecution[] = []
    const notifs: AppNotification[] = []
    const at = dayjs().format('YYYY-MM-DD HH:mm:ss')
    let seq = 0
    for (const rule of api.rules) {
      if (!rule.enabled) continue
      const matches = matchRule(rule, ctx)
      for (const m of matches) {
        const key = `${rule.id}|${m.key}`
        if (fired.has(key)) continue
        fired.add(key)
        seq += 1
        if (rule.autoExecute) {
          const res = execRuleAction(rule, m, api)
          log.push({
            id: `re-${at}-${seq}`,
            ruleId: rule.id,
            ruleName: rule.name,
            target: m.key,
            targetName: m.name,
            action: rule.action,
            status: 'executed' as const,
            message: res.message,
            at,
          })
          if (res.notification) notifs.push(res.notification)
        } else {
          pending.push({
            ruleId: rule.id,
            ruleName: rule.name,
            target: m.key,
            targetName: m.name,
            action: rule.action,
            message: m.message,
          })
          log.push({
            id: `re-${at}-${seq}`,
            ruleId: rule.id,
            ruleName: rule.name,
            target: m.key,
            targetName: m.name,
            action: rule.action,
            status: 'pending' as const,
            message: m.message,
            at,
          })
        }
      }
    }
    set((s) => ({
      ruleLog: [...log, ...s.ruleLog].slice(0, 120),
      pendingActions: [...pending, ...s.pendingActions],
      notifications: [...notifs, ...s.notifications].slice(0, 100),
    }))
  },

  executePending: (ruleId, target) => {
    const api = get()
    const pa = api.pendingActions.find((p) => p.ruleId === ruleId && p.target === target)
    if (!pa) return
    const rule = api.rules.find((r) => r.id === ruleId)
    const m: RuleTarget = { key: pa.target, name: pa.targetName, message: pa.message, meta: { sku: pa.target } }
    const res = rule ? execRuleAction(rule, m, api) : { message: pa.message }
    const at = dayjs().format('YYYY-MM-DD HH:mm:ss')
    set((s) => ({
      pendingActions: s.pendingActions.filter((p) => !(p.ruleId === ruleId && p.target === target)),
      ruleLog: [
        {
          id: `re-${at}-${s.ruleLog.length + 1}`,
          ruleId,
          ruleName: pa.ruleName,
          target,
          targetName: pa.targetName,
          action: pa.action,
          status: 'executed' as const,
          message: res.message,
          at,
        },
        ...s.ruleLog,
      ].slice(0, 120),
      notifications: res.notification ? [res.notification, ...s.notifications].slice(0, 100) : s.notifications,
    }))
  },

  addRule: (input) =>
    set((s) => ({
      rules: [
        ...s.rules,
        { ...input, id: `r-${s.rules.length + 1}-${Date.now()}`, createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss') },
      ],
    })),

  updateRule: (id, patch) =>
    set((s) => ({ rules: s.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) })),

  deleteRule: (id) => set((s) => ({ rules: s.rules.filter((r) => r.id !== id) })),

  toggleRule: (id) =>
    set((s) => ({ rules: s.rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)) })),

  clearPending: () => set(() => ({ pendingActions: [] })),

  addNotification: (n) =>
    set((s) => ({
      notifications: [
        { ...n, id: `n-${Date.now()}`, at: dayjs().format('YYYY-MM-DD HH:mm:ss'), read: false },
        ...s.notifications,
      ].slice(0, 100),
    })),
}))
