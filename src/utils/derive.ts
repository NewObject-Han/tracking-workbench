import dayjs from 'dayjs'
import type { Milestone, Order, Product, ReplenishSuggestion } from '@/types'
import { NODE_SEQUENCE, STALL_DAYS } from '@/mock/data'

export const TODAY = dayjs().startOf('day')

export function lastUpdatedAt(milestones: Milestone[]): string | undefined {
  if (milestones.length === 0) return undefined
  return milestones
    .map((m) => m.updatedAt)
    .sort((a, b) => (a < b ? 1 : -1))[0]
}

export function isOverdue(order: Order): boolean {
  if (order.status === '已出货') return false
  return dayjs(order.customerDue).isBefore(TODAY, 'day')
}

export function isStalled(order: Order, milestones: Milestone[]): boolean {
  if (order.status === '已出货') return false
  const at = lastUpdatedAt(milestones)
  if (!at) return false
  return TODAY.diff(dayjs(at), 'day') > STALL_DAYS
}

export function hasDueConflict(order: Order): boolean {
  return dayjs(order.factoryDue).isAfter(dayjs(order.customerDue), 'day')
}

export function remainingDays(order: Order): number {
  return dayjs(order.customerDue).diff(TODAY, 'day')
}

/** 逾期天数，未逾期返回 0 */
export function overdueDays(order: Order): number {
  const d = remainingDays(order)
  return d < 0 ? -d : 0
}

export function anomalyTypes(order: Order, milestones: Milestone[]): string[] {
  const types: string[] = []
  if (isOverdue(order)) types.push(`逾期 ${overdueDays(order)} 天`)
  if (hasDueConflict(order)) types.push('交期冲突')
  if (isStalled(order, milestones)) types.push('进度停滞')
  return types
}

export function nextNode(status: Order['status']): Order['status'] | undefined {
  const idx = NODE_SEQUENCE.indexOf(status)
  if (idx < 0 || idx >= NODE_SEQUENCE.length - 1) return undefined
  return NODE_SEQUENCE[idx + 1]
}

// ===== 备货预测（业务①）=====
// 建议下单量 = 生产周期内预计消耗 + 安全库存 - 当前库存
export function replenishOf(p: Product): ReplenishSuggestion {
  const leadTimeConsumption = Math.round((p.monthlySales * p.leadTimeDays) / 30)
  const suggestQty = Math.max(0, leadTimeConsumption + p.safetyStock - p.jpStock)
  return {
    productId: p.id,
    leadTimeConsumption,
    suggestQty,
    needReplenish: suggestQty > 0,
  }
}

export function replenishSummary(products: Product[]): {
  needCount: number
  totalSuggest: number
} {
  const sugg = products.map(replenishOf)
  return {
    needCount: sugg.filter((s) => s.needReplenish).length,
    totalSuggest: sugg.reduce((sum, s) => sum + s.suggestQty, 0),
  }
}
