/**
 * 金蝶云星空（Kingdee Cloud）开放 API 适配层
 * ------------------------------------------------------------------
 * 数据来源统一为金蝶云星空 WebAPI（DynamicFormService.executeBillQuery）。
 * 真实环境调用方式（POST）：
 *   /k3cloud/Kingdee.BOS.WebApi.ServicesStub.DynamicFormService.ExecuteBillQuery.common.kdsvc
 *   body: { FormId, FieldKeys, FilterString, Limit, StartRow }
 * 单据状态 FDocumentStatus：Z=创建 B=提交 C=审核 D=重新审核
 *
 * 本文件职责：
 *   1. 声明金蝶表单 FormId 常量；
 *   2. 定义金蝶原始返回结构（RawXxx）与 WebAPI 请求/响应类型；
 *   3. 提供 toDomain() 适配器，把金蝶数据转换为前端使用的扁平模型。
 *
 * 说明：物料「生产周期」对应金蝶 FFixLeadTime(固定提前期)+FVarLeadTime(变动提前期)；
 * 「日本仓库库存 / 日本门店月销量 / 报关资料 / 工厂确认状态 / 付款状态 / 物流状态」
 * 属于外贸业务自定义字段（金蝶 F_ 前缀自定义项，此处以 F_JP* 命名）。
 */

/** 金蝶业务对象表单 Id（部分常用） */
export const FORMS = {
  SAL_SALE_ORDER: 'SAL_SaleOrder', // 销售订单（客户侧）
  PUR_PURCHASE_ORDER: 'PUR_PurchaseOrder', // 采购订单（向供应商下单/跟单主体）
  BD_MATERIAL: 'BD_MATERIAL', // 物料
  BD_SUPPLIER: 'BD_Supplier', // 供应商
  SAL_DELIVERY_NOTICE: 'SAL_DeliveryNotice', // 发货通知单
  AP_PAYABLE_BILL: 'AP_PayableBill', // 应付单（供应商发票/货款）
  SAL_OUT_STOCK: 'SAL_OutStock', // 销售出库单（物流报关）
} as const

export type FormId = (typeof FORMS)[keyof typeof FORMS]

/** 金蝶 WebAPI 查询请求体 */
export interface KingdeeQueryRequest {
  FormId: FormId
  FieldKeys: string
  FilterString?: string
  Limit?: number
  StartRow?: number
}

/** 金蝶查询返回为二维数组（每行一个字符串数组，与 FieldKeys 顺序对应） */
export type KingdeeQueryResult = string[][]

/** 站点登录后拿到的会话（真实环境需先调用 Login 接口） */
export interface KingdeeSession {
  serverUrl: string
  cookie: string
}

// ===== 金蝶原始单据结构（与 executeBillQuery 返回字段对齐） =====

/** 物料 BD_MATERIAL */
export interface RawMaterial {
  FNumber: string // 物料编码
  FName: string // 名称
  FSpecification?: string // 规格型号
  FSafeStock: number // 安全库存
  FFixLeadTime: number // 固定提前期（天）
  FVarLeadTime: number // 变动提前期（天）
  FDefaultVendor_FNumber?: string // 默认供应商编码
  FStockId_FNumber?: string // 默认仓库
  F_JPStock?: number // 自定义：日本仓库库存
  F_JPSales?: number // 自定义：日本门店月销量
  F_Lifecycle?: '首单' | '翻单' | '废番' // 自定义：产品生命周期
  FDocumentStatus: string // 数据状态
}

/** 供应商 BD_Supplier */
export interface RawSupplier {
  FNumber: string // 供应商编码
  FName: string // 名称
  FDocumentStatus: string
}

/** 采购订单 PUR_PurchaseOrder（跟单主体） */
export interface RawPurchaseOrder {
  FID: string
  FBillNo: string // 单据编号
  FSourceBillNo?: string // 源单编号（关联销售订单）
  FDate: string // 采购日期
  FSupplierId_FNumber: string // 供应商编码
  FMaterialId_FNumber: string // 物料编码
  FQty: number // 采购数量
  FPrice?: number // 单价
  FDeliveryDate: string // 交货日期（工厂交期）
  F_JPCustDue?: string // 自定义：客户交期
  F_JPShipDate?: string // 自定义：计划船期
  FDocumentStatus: string // 单据状态
}

/** 销售订单 SAL_SaleOrder（客户侧） */
export interface RawSaleOrder {
  FID: string
  FBillNo: string
  FDate: string
  FCustId_FNumber: string // 客户编码
  FMaterialId_Fnumber: string
  FQty: number
  FTaxPrice?: number
  FDeliveryDate: string // 客户要求交期
  FDocumentStatus: string
}

/** 发货通知单 SAL_DeliveryNotice（出货计划/工厂确认） */
export interface RawDeliveryNotice {
  FID: string
  FBillNo?: string
  FDate: string
  FCustomerID_FNumber: string
  FMaterialID_FNumber: string
  FQty: number
  FDeliveryDate: string // 计划发货/船期
  FCarrierID_FNumber?: string // 承运商
  FCarriageNO?: string // 运输单号
  FReceiveAddress?: string
  F_JPConfirm?: '待确认' | '已确认' | '有差异' // 自定义：工厂确认状态
  F_JPNote?: string // 自定义：差异备注
  FDocumentStatus: string
}

/** 应付单 AP_PayableBill（供应商发票/货款） */
export interface RawPayableBill {
  FID: string
  FBillNo: string // 发票/单据编号
  FDate: string
  FSupplierId_FNumber: string
  FAmount: number // 价税合计
  F_JPPayStatus?: '未付' | '部分付' | '已付' // 自定义：付款状态
  F_JPPaid?: number // 自定义：已付金额
  FDocumentStatus: string
}

/** 销售出库单 SAL_OutStock（物流报关） */
export interface RawOutStock {
  FID: string
  FBillNo: string
  FMaterialID_FNumber: string
  FQty: number
  FCarrierID_FNumber?: string // 承运商
  FCarriageNO?: string // 物流单号
  FDate: string // 出库日期
  F_JPCustomsNo?: string // 自定义：报关单号
  F_HSCODE?: string // 自定义：HS 编码
  F_ETD?: string // 自定义：预计离港
  F_ETA?: string // 自定义：预计到港
  F_JPLogiStatus?: '报关中' | '已离港' | '在途' | '已到港' // 自定义：物流状态
  FDocumentStatus: string
}

/** 演示用：本地金蝶原始数据集（真实环境由 executeBillQuery 拉取） */
export interface KingdeeDataset {
  materials: RawMaterial[]
  suppliers: RawSupplier[]
  purchaseOrders: RawPurchaseOrder[]
  saleOrders: RawSaleOrder[]
  deliveryNotices: RawDeliveryNotice[]
  payableBills: RawPayableBill[]
  outStocks: RawOutStock[]
}

// ===== 适配器：金蝶原始数据 → 前端模型 =====

import type {
  Invoice,
  Logistics,
  LogisticsStatus,
  Order,
  OrderStatus,
  PayStatus,
  Penalty,
  Product,
  ProductComm,
  PurchaseContract,
  ShipConfirmStatus,
  ShipmentPlan,
} from '@/types'

/** 采购订单状态 → 跟单节点状态映射（简化） */
function toOrderStatus(docStatus: string, deliveryDate: string): OrderStatus {
  if (docStatus === 'C' || docStatus === 'B') {
    const due = new Date(deliveryDate).getTime()
    const now = Date.now()
    if (due < now) return '已出货'
    return '生产中'
  }
  return '已下单'
}

export function toOrders(ds: KingdeeDataset): Order[] {
  const supMap = new Map(ds.suppliers.map((s) => [s.FNumber, s.FName]))
  const matMap = new Map(ds.materials.map((m) => [m.FNumber, m.FName]))
  return ds.purchaseOrders.map((p, i) => ({
    id: `o${i + 1}`,
    orderNo: p.FBillNo,
    customerOrderNo: p.FSourceBillNo ?? '',
    supplier: supMap.get(p.FSupplierId_FNumber) ?? p.FSupplierId_FNumber,
    sku: p.FMaterialId_FNumber,
    skuName: matMap.get(p.FMaterialId_FNumber) ?? p.FMaterialId_FNumber,
    qty: p.FQty,
    orderDate: p.FDate,
    customerDue: p.F_JPCustDue ?? p.FDeliveryDate,
    factoryDue: p.FDeliveryDate,
    planShipDate: p.F_JPShipDate ?? p.FDeliveryDate,
    status: toOrderStatus(p.FDocumentStatus, p.FDeliveryDate),
    riskLevel: 'low' as const,
    erpOrderNo: p.FBillNo,
  }))
}

export function toProducts(ds: KingdeeDataset): Product[] {
  const supMap = new Map(ds.suppliers.map((s) => [s.FNumber, s.FName]))
  return ds.materials.map((m, i) => ({
    id: `p${i + 1}`,
    sku: m.FNumber,
    skuName: m.FName,
    supplier: supMap.get(m.FDefaultVendor_FNumber ?? '') ?? '—',
    leadTimeDays: m.FFixLeadTime + m.FVarLeadTime,
    safetyStock: m.FSafeStock,
    jpStock: m.F_JPStock ?? 0,
    monthlySales: m.F_JPSales ?? 0,
    lifecycle: m.F_Lifecycle ?? '翻单',
  }))
}

export function toShipments(ds: KingdeeDataset): ShipmentPlan[] {
  const matMap = new Map(ds.materials.map((m) => [m.FNumber, m.FName]))
  return ds.deliveryNotices.map((d, i) => ({
    id: `sp${i + 1}`,
    sku: d.FMaterialID_FNumber,
    skuName: matMap.get(d.FMaterialID_FNumber) ?? d.FMaterialID_FNumber,
    orderNo: d.FBillNo ?? `SAL-DN-${i + 1}`,
    customerPlanDate: d.FDeliveryDate,
    qty: d.FQty,
    factoryConfirmStatus: (d.F_JPConfirm ?? '待确认') as ShipConfirmStatus,
    note: d.F_JPNote,
  }))
}

export function toInvoices(ds: KingdeeDataset): Invoice[] {
  const supMap = new Map(ds.suppliers.map((s) => [s.FNumber, s.FName]))
  return ds.payableBills.map((b, i) => {
    const payStatus = (b.F_JPPayStatus ?? '未付') as PayStatus
    return {
      id: `iv${i + 1}`,
      invoiceNo: b.FBillNo,
      supplier: supMap.get(b.FSupplierId_FNumber) ?? b.FSupplierId_FNumber,
      orderNo: b.FBillNo,
      amount: b.FAmount,
      issueDate: b.FDate,
      payStatus,
      paidAmount: b.F_JPPaid ?? (payStatus === '已付' ? b.FAmount : 0),
    }
  })
}

const LOGISTICS_STATUS: LogisticsStatus[] = ['报关中', '已离港', '在途', '已到港']
export function toLogistics(ds: KingdeeDataset): Logistics[] {
  return ds.outStocks.map((o, i) => ({
    id: `lg${i + 1}`,
    orderNo: o.FBillNo,
    sku: o.FMaterialID_FNumber,
    declarationNo: o.F_JPCustomsNo ?? `DECL-${i + 1}`,
    hsCode: o.F_HSCODE ?? '',
    logisticsNo: o.FCarriageNO ?? '—',
    carrier: o.FCarrierID_FNumber ?? '待定',
    status: (o.F_JPLogiStatus ?? LOGISTICS_STATUS[i % LOGISTICS_STATUS.length]) as LogisticsStatus,
    etd: o.F_ETD ?? o.FDate,
    eta: o.F_ETA ?? o.FDate,
  }))
}

/** 供应商罚款（金蝶无原生，演示用本地扩展） */
export function toPenalties(_ds: KingdeeDataset): Penalty[] {
  return []
}

/** 产品沟通记录（金蝶无原生，演示用本地扩展） */
export function toProductComms(_ds: KingdeeDataset): ProductComm[] {
  return []
}

/** 下单合同（由备货建议在前端生成，金蝶侧为 PUR_PurchaseOrder 新增） */
export function toContracts(): PurchaseContract[] {
  return []
}

/**
 * 演示版 executeBillQuery：从本地数据集按 FormId 取出对应单据。
 * 真实环境替换为对金蝶 WebAPI 的 POST 请求（见文件头注释）。
 */
export function executeBillQuery(
  ds: KingdeeDataset,
  formId: FormId,
  fieldKeys?: string,
): unknown[] {
  void fieldKeys
  switch (formId) {
    case FORMS.BD_MATERIAL:
      return ds.materials
    case FORMS.BD_SUPPLIER:
      return ds.suppliers
    case FORMS.PUR_PURCHASE_ORDER:
      return ds.purchaseOrders
    case FORMS.SAL_SALE_ORDER:
      return ds.saleOrders
    case FORMS.SAL_DELIVERY_NOTICE:
      return ds.deliveryNotices
    case FORMS.AP_PAYABLE_BILL:
      return ds.payableBills
    case FORMS.SAL_OUT_STOCK:
      return ds.outStocks
    default:
      return []
  }
}
