import dayjs from 'dayjs'
import type {
  Invoice,
  Lifecycle,
  Logistics,
  Order,
  Product,
  PurchaseContract,
  ShipmentPlan,
} from '@/types'
import { replenishOf } from '@/utils/derive'

export type FlowStageKey = 'replenish' | 'shipment' | 'logistics' | 'finance'
export type StageStatus = 'done' | 'active' | 'pending' | 'blocked' | 'n/a'

export interface FlowStage {
  key: FlowStageKey
  name: string
  status: StageStatus
  due?: string // SLA 截止
  note?: string
}

export interface TrackingFlow {
  sku: string
  skuName: string
  supplier: string
  lifecycle: Lifecycle
  leadTimeDays: number
  stages: FlowStage[]
  currentStageIdx: number // 当前所处阶段下标；-1 表示已闭环
  progress: number // 0..100
  anomalies: string[] // SLA / 异常信息
  risk: 'high' | 'mid' | 'low'
  nextAction: string
  contract?: { no: string; qty: number; status: string }
  shipment?: { status: string; planDate: string; note?: string }
  logistics?: { status: string; eta: string }
  invoice?: { no: string; amount: number; payStatus: string }
}

export interface FlowInput {
  products: Product[]
  contracts: PurchaseContract[]
  shipments: ShipmentPlan[]
  logistics: Logistics[]
  invoices: Invoice[]
  orders: Order[]
}

const TODAY = dayjs().startOf('day')

/** 把阶段状态映射为进度分母（n/a 不计） */
function effectiveStages(stages: FlowStage[]): FlowStage[] {
  return stages.filter((s) => s.status !== 'n/a')
}

export function buildFlows(input: FlowInput): TrackingFlow[] {
  const { products, contracts, shipments, logistics, invoices, orders } = input

  return products.map((p) => {
    const contract = contracts
      .filter((c) => c.sku === p.sku)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0]
    const shipment = shipments.find((s) => s.sku === p.sku)
    const logi = logistics.find((l) => l.sku === p.sku)
    const order = orders.find((o) => o.sku === p.sku)
    // 财务按供应商匹配（金蝶应付单以供应商维度出具，演示用最佳匹配）
    const invoice =
      invoices.find((i) => i.supplier === p.supplier && i.payStatus !== '已付') ??
      invoices.find((i) => i.supplier === p.supplier)

    const anomalies: string[] = []
    const stages: FlowStage[] = []

    // —— 阶段① 备货 ——
    const needReplenish = replenishOf(p).needReplenish
    if (p.lifecycle === '废番') {
      stages.push({ key: 'replenish', name: '备货', status: 'n/a', note: '已废番·不补货' })
    } else if (contract) {
      stages.push({ key: 'replenish', name: '备货', status: 'done', note: `合同 ${contract.contractNo}` })
    } else if (needReplenish) {
      const due = order
        ? dayjs(order.customerDue).subtract(p.leadTimeDays, 'day').format('YYYY-MM-DD')
        : undefined
      if (due && TODAY.isAfter(dayjs(due), 'day')) {
        anomalies.push(`备货超期未下单（应不晚于 ${due}）`)
      }
      stages.push({ key: 'replenish', name: '备货', status: 'active', due, note: '建议补货待下单' })
    } else {
      stages.push({ key: 'replenish', name: '备货', status: 'done', note: '库存充足' })
    }

    // —— 阶段② 出货确认 ——
    if (!shipment) {
      stages.push({ key: 'shipment', name: '出货确认', status: 'pending', note: '暂无出货计划' })
    } else if (shipment.factoryConfirmStatus === '已确认') {
      stages.push({ key: 'shipment', name: '出货确认', status: 'done', note: '工厂已确认' })
    } else if (shipment.factoryConfirmStatus === '有差异') {
      anomalies.push('出货确认有差异待处理')
      stages.push({
        key: 'shipment',
        name: '出货确认',
        status: 'blocked',
        due: shipment.customerPlanDate,
        note: shipment.note ?? '有差异',
      })
    } else {
      if (TODAY.isAfter(dayjs(shipment.customerPlanDate), 'day')) {
        anomalies.push(`出货未确认超期（计划 ${shipment.customerPlanDate}）`)
      }
      stages.push({
        key: 'shipment',
        name: '出货确认',
        status: 'active',
        due: shipment.customerPlanDate,
        note: '待工厂确认',
      })
    }

    // —— 阶段③ 报关物流 ——
    if (!logi) {
      stages.push({ key: 'logistics', name: '报关物流', status: 'pending', note: '未发货' })
    } else if (logi.status === '已到港') {
      stages.push({ key: 'logistics', name: '报关物流', status: 'done', note: '已到港' })
    } else {
      if (TODAY.isAfter(dayjs(logi.eta), 'day')) {
        anomalies.push(`物流延迟未到港（ETA ${logi.eta}）`)
      }
      stages.push({
        key: 'logistics',
        name: '报关物流',
        status: logi.status === '报关中' ? 'pending' : 'active',
        due: logi.eta,
        note: logi.status,
      })
    }

    // —— 阶段④ 财务对账 ——
    if (!invoice) {
      stages.push({ key: 'finance', name: '财务对账', status: 'pending', note: '暂无发票' })
    } else if (invoice.payStatus === '已付') {
      stages.push({ key: 'finance', name: '财务对账', status: 'done', note: '已付清' })
    } else {
      const base = logi?.eta ?? shipment?.customerPlanDate
      if (base && TODAY.isAfter(dayjs(base).add(30, 'day'), 'day')) {
        anomalies.push(`货款超期未付（${invoice.invoiceNo}）`)
      }
      stages.push({
        key: 'finance',
        name: '财务对账',
        status: 'active',
        note: invoice.payStatus,
      })
    }

    // —— 当前阶段 / 进度 / 风险 / 下一步 ——
    const eff = effectiveStages(stages)
    let currentStageIdx = eff.findIndex((s) => s.status !== 'done')
    if (currentStageIdx === -1) currentStageIdx = eff.length - 1 // 全部完成
    const absoluteIdx = stages.findIndex((s) => s === eff[currentStageIdx])
    const doneCount = eff.filter((s) => s.status === 'done').length
    const progress = eff.length === 0 ? 0 : Math.round((doneCount / eff.length) * 100)

    const risk: TrackingFlow['risk'] = anomalies.length > 0 ? 'high' : eff.some((s) => s.status === 'active' || s.status === 'blocked') ? 'mid' : 'low'

    const nextAction = computeNextAction(p, currentStageIdx >= 0 ? eff[currentStageIdx] : undefined, logi, invoice)

    return {
      sku: p.sku,
      skuName: p.skuName,
      supplier: p.supplier,
      lifecycle: p.lifecycle,
      leadTimeDays: p.leadTimeDays,
      stages,
      currentStageIdx: absoluteIdx,
      progress,
      anomalies,
      risk,
      nextAction,
      contract: contract ? { no: contract.contractNo, qty: contract.qty, status: contract.status } : undefined,
      shipment: shipment
        ? { status: shipment.factoryConfirmStatus, planDate: shipment.customerPlanDate, note: shipment.note }
        : undefined,
      logistics: logi ? { status: logi.status, eta: logi.eta } : undefined,
      invoice: invoice
        ? { no: invoice.invoiceNo, amount: invoice.amount, payStatus: invoice.payStatus }
        : undefined,
    }
  })
}

function computeNextAction(
  p: Product,
  current: FlowStage | undefined,
  logi: Logistics | undefined,
  invoice: Invoice | undefined,
): string {
  if (!current) return '流程已闭环，无需操作'
  switch (current.key) {
    case 'replenish':
      return p.lifecycle === '废番' ? '已废番，停止备货' : `建议：为 ${p.sku} 生成备货合同`
    case 'shipment':
      if (current.status === 'blocked')
        return `建议：处理 ${p.sku} 出货差异，与客户/工厂协商分批`
      return `建议：与工厂确认 ${p.sku} 出货计划`
    case 'logistics':
      return `建议：跟踪 ${p.sku} 物流，预计到港 ${logi?.eta ?? '—'}`
    case 'finance':
      return `建议：安排 ${p.supplier} 货款支付（${invoice?.invoiceNo ?? '—'}）`
    default:
      return '—'
  }
}

/** 预警汇总：返回有异常的流程，按风险等级排序 */
export function collectAlerts(flows: TrackingFlow[]): TrackingFlow[] {
  return flows
    .filter((f) => f.anomalies.length > 0)
    .sort((a, b) => {
      const rank = (r: TrackingFlow['risk']) => (r === 'high' ? 0 : r === 'mid' ? 1 : 2)
      if (rank(a.risk) !== rank(b.risk)) return rank(a.risk) - rank(b.risk)
      return b.anomalies.length - a.anomalies.length
    })
}

export function flowStats(flows: TrackingFlow[]) {
  const total = flows.length
  const done = flows.filter((f) => f.currentStageIdx >= 0 && effectiveStages(f.stages).every((s) => s.status === 'done')).length
  const inProgress = flows.filter((f) => f.risk !== 'high' && f.currentStageIdx >= 0 && !effectiveStages(f.stages).every((s) => s.status === 'done')).length
  const alerts = flows.filter((f) => f.anomalies.length > 0).length
  return { total, done, inProgress, alerts }
}
