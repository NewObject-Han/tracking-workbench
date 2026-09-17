import dayjs from 'dayjs'
import type {
  Invoice,
  Lifecycle,
  Logistics,
  Order,
  Product,
  PurchaseContract,
  Rule,
  RuleAction,
  RuleCondition,
  RuleTrigger,
  ShipmentPlan,
} from '@/types'
import { replenishOf } from '@/utils/derive'
import { buildFlows } from '@/utils/flow'

const TODAY = dayjs().startOf('day')

export const TRIGGER_LABEL: Record<RuleTrigger, string> = {
  REPLENISH_SUGGESTED: '存在备货建议（需补货且无合同）',
  SHIPMENT_CONFIRMED: '出货计划已确认',
  LOGISTICS_ARRIVED: '物流已到港',
  INVOICE_OVERDUE: '货款超期未付',
  FLOW_HIGH_RISK: '流程高风险 / 异常',
}

export const ACTION_LABEL: Record<RuleAction, string> = {
  CREATE_CONTRACT: '自动生成备货合同',
  CREATE_ALERT: '生成预警提醒',
  PUSH_KINGDEE: '触发金蝶同步',
  OPEN_FINANCE: '提醒财务对账',
}

export interface RuleTargetMeta {
  supplier?: string
  lifecycle?: Lifecycle
  sku?: string
}

export interface RuleTarget {
  key: string
  name: string
  message: string
  meta: RuleTargetMeta
}

/** 规则求值所需的业务上下文 */
export interface RuleContext {
  products: Product[]
  contracts: PurchaseContract[]
  shipments: ShipmentPlan[]
  logistics: Logistics[]
  invoices: Invoice[]
  orders: Order[]
}

function condMatch(cond: RuleCondition | undefined, meta: RuleTargetMeta): boolean {
  if (!cond || !cond.field) return true
  const v = meta[cond.field]
  if (v === undefined) return false
  if (cond.op === 'eq') return v === cond.value
  if (cond.op === 'neq') return v !== cond.value
  if (cond.op === 'in') return Array.isArray(cond.value) && cond.value.includes(v)
  return true
}

/** 根据规则触发条件，从上下文中匹配全部目标对象 */
export function matchRule(rule: Rule, ctx: RuleContext): RuleTarget[] {
  let base: RuleTarget[] = []
  switch (rule.trigger) {
    case 'REPLENISH_SUGGESTED':
      base = ctx.products
        .filter(
          (p) =>
            p.lifecycle !== '废番' &&
            replenishOf(p).needReplenish &&
            !ctx.contracts.some((c) => c.sku === p.sku),
        )
        .map((p) => ({
          key: p.sku,
          name: p.skuName,
          message: `建议补货 ${replenishOf(p).suggestQty.toLocaleString()}`,
          meta: { supplier: p.supplier, lifecycle: p.lifecycle, sku: p.sku },
        }))
      break
    case 'SHIPMENT_CONFIRMED':
      base = ctx.shipments
        .filter((s) => s.factoryConfirmStatus === '已确认')
        .map((s) => {
          const p = ctx.products.find((x) => x.sku === s.sku)
          return {
            key: s.id,
            name: s.skuName,
            message: `出货计划 ${s.orderNo} 已确认`,
            meta: { sku: s.sku, supplier: p?.supplier, lifecycle: p?.lifecycle },
          }
        })
      break
    case 'LOGISTICS_ARRIVED':
      base = ctx.logistics
        .filter((l) => l.status === '已到港')
        .map((l) => {
          const p = ctx.products.find((x) => x.sku === l.sku)
          return {
            key: l.id,
            name: l.sku,
            message: `${l.sku} 已到港`,
            meta: { sku: l.sku, supplier: p?.supplier, lifecycle: p?.lifecycle },
          }
        })
      break
    case 'INVOICE_OVERDUE':
      base = ctx.invoices
        .filter((i) => i.payStatus !== '已付' && TODAY.diff(dayjs(i.issueDate), 'day') > 30)
        .map((i) => ({
          key: i.id,
          name: i.invoiceNo,
          message: `${i.invoiceNo} 货款超期未付`,
          meta: { supplier: i.supplier },
        }))
      break
    case 'FLOW_HIGH_RISK':
      base = buildFlows(ctx)
        .filter((f) => f.anomalies.length > 0)
        .map((f) => {
          const p = ctx.products.find((x) => x.sku === f.sku)
          return {
            key: f.sku,
            name: f.skuName,
            message: f.anomalies.join('；'),
            meta: { sku: f.sku, supplier: p?.supplier, lifecycle: p?.lifecycle },
          }
        })
      break
  }
  return base.filter((t) => condMatch(rule.condition, t.meta))
}

/** 条件的人类可读描述 */
export function conditionText(cond: RuleCondition | undefined): string {
  if (!cond || !cond.field) return '全部'
  const opText = cond.op === 'eq' ? '=' : cond.op === 'neq' ? '≠' : '∈'
  const val = Array.isArray(cond.value) ? cond.value.join(' / ') : (cond.value ?? '')
  return `${cond.field} ${opText} ${val}`
}
