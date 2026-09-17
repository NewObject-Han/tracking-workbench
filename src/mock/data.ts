/**
 * 演示数据
 * ------------------------------------------------------------------
 * 数据来源：金蝶云星空 ERP（WebAPI 模拟）。
 *   - Products / Shipments / Invoices / Logistics 由金蝶原始单据
 *     （BD_MATERIAL / SAL_DeliveryNotice / AP_PayableBill / SAL_OutStock）
 *     经 src/api/kingdee.ts 的 toDomain 适配器转换生成。
 *   - Orders / Milestones / SyncTasks 为跟单工作台核心业务模型
 *     （含生产节点、异常判定、AI 提取等，金蝶无原生对应，故保留手写）。
 *   - Penalties / ProductComms 为外贸跟单自定义业务，金蝶无原生单据。
 */

import type {
  Milestone,
  MilestoneStatus,
  Order,
  OrderStatus,
  Penalty,
  ProductComm,
  ProgressSource,
  SyncTask,
} from '@/types'
import {
  toInvoices,
  toLogistics,
  toProducts,
  toShipments,
} from '@/api/kingdee'
import type {
  KingdeeDataset,
  RawDeliveryNotice,
  RawMaterial,
  RawOutStock,
  RawPayableBill,
  RawPurchaseOrder,
  RawSaleOrder,
  RawSupplier,
} from '@/api/kingdee'

export const NODE_SEQUENCE: OrderStatus[] = [
  '已下单',
  '备料',
  '生产中',
  '验货',
  '已完工',
  '已出货',
]

export const STALL_DAYS = 14

// ===== 金蝶云星空原始数据（executeBillQuery 返回结构） =====

/** 供应商 BD_Supplier */
const suppliers: RawSupplier[] = [
  { FNumber: 'SUP-HY', FName: '东莞宏远塑胶', FDocumentStatus: 'C' },
  { FNumber: 'SUP-HC', FName: '宁波华成五金', FDocumentStatus: 'C' },
  { FNumber: 'SUP-RZ', FName: '苏州瑞泽纺织', FDocumentStatus: 'C' },
  { FNumber: 'SUP-LD', FName: '中山立德电子', FDocumentStatus: 'C' },
]

/** 物料 BD_MATERIAL（生产周期 = FFixLeadTime + FVarLeadTime） */
const materials: RawMaterial[] = [
  { FNumber: 'SKU-1001', FName: '收纳盒 A 型', FSafeStock: 2000, FFixLeadTime: 30, FVarLeadTime: 15, FDefaultVendor_FNumber: 'SUP-HY', F_JPStock: 3000, F_JPSales: 8000, F_Lifecycle: '翻单', FDocumentStatus: 'C' },
  { FNumber: 'SKU-2043', FName: '厨房挂架 B 型', FSafeStock: 1500, FFixLeadTime: 35, FVarLeadTime: 15, FDefaultVendor_FNumber: 'SUP-HC', F_JPStock: 9000, F_JPSales: 3000, F_Lifecycle: '翻单', FDocumentStatus: 'C' },
  { FNumber: 'SKU-1088', FName: '收纳箱 C 型', FSafeStock: 1500, FFixLeadTime: 25, FVarLeadTime: 15, FDefaultVendor_FNumber: 'SUP-HY', F_JPStock: 4000, F_JPSales: 5000, F_Lifecycle: '翻单', FDocumentStatus: 'C' },
  { FNumber: 'SKU-3310', FName: '桌布 D 型', FSafeStock: 1000, FFixLeadTime: 20, FVarLeadTime: 15, FDefaultVendor_FNumber: 'SUP-RZ', F_JPStock: 6000, F_JPSales: 2000, F_Lifecycle: '翻单', FDocumentStatus: 'C' },
  { FNumber: 'SKU-2101', FName: '浴室置物架', FSafeStock: 1500, FFixLeadTime: 30, FVarLeadTime: 15, FDefaultVendor_FNumber: 'SUP-HC', F_JPStock: 2500, F_JPSales: 4000, F_Lifecycle: '翻单', FDocumentStatus: 'C' },
  { FNumber: 'SKU-3302', FName: '抱枕套 F 型', FSafeStock: 2000, FFixLeadTime: 15, FVarLeadTime: 15, FDefaultVendor_FNumber: 'SUP-RZ', F_JPStock: 7000, F_JPSales: 9000, F_Lifecycle: '翻单', FDocumentStatus: 'C' },
  { FNumber: 'SKU-1120', FName: '衣架 G 型', FSafeStock: 3000, FFixLeadTime: 15, FVarLeadTime: 15, FDefaultVendor_FNumber: 'SUP-HY', F_JPStock: 15000, F_JPSales: 12000, F_Lifecycle: '翻单', FDocumentStatus: 'C' },
  { FNumber: 'SKU-5501', FName: 'LED 小夜灯', FSafeStock: 1000, FFixLeadTime: 45, FVarLeadTime: 15, FDefaultVendor_FNumber: 'SUP-LD', F_JPStock: 500, F_JPSales: 1500, F_Lifecycle: '首单', FDocumentStatus: 'C' },
  { FNumber: 'SKU-2200', FName: '旧款杯垫', FSafeStock: 0, FFixLeadTime: 25, FVarLeadTime: 15, FDefaultVendor_FNumber: 'SUP-HC', F_JPStock: 2000, F_JPSales: 0, F_Lifecycle: '废番', FDocumentStatus: 'C' },
]

/** 采购订单 PUR_PurchaseOrder（金蝶原始返回，供对照参考） */
const purchaseOrders: RawPurchaseOrder[] = [
  { FID: '1', FBillNo: 'PO-2607-001', FSourceBillNo: 'HN-2026-0801-A', FDate: '2026-07-20', FSupplierId_FNumber: 'SUP-HY', FMaterialId_FNumber: 'SKU-1001', FQty: 12000, FDeliveryDate: '2026-09-08', F_JPCustDue: '2026-09-10', F_JPShipDate: '2026-09-12', FDocumentStatus: 'C' },
  { FID: '2', FBillNo: 'PO-2607-002', FSourceBillNo: 'HN-2026-0802-B', FDate: '2026-07-25', FSupplierId_FNumber: 'SUP-HC', FMaterialId_FNumber: 'SKU-2043', FQty: 6000, FDeliveryDate: '2026-09-25', F_JPCustDue: '2026-09-20', F_JPShipDate: '2026-09-28', FDocumentStatus: 'C' },
  { FID: '3', FBillNo: 'PO-2607-003', FSourceBillNo: 'HN-2026-0803-C', FDate: '2026-07-28', FSupplierId_FNumber: 'SUP-HY', FMaterialId_FNumber: 'SKU-1088', FQty: 9000, FDeliveryDate: '2026-10-10', F_JPCustDue: '2026-10-15', F_JPShipDate: '2026-10-18', FDocumentStatus: 'C' },
  { FID: '4', FBillNo: 'PO-2608-001', FSourceBillNo: 'HN-2026-0804-D', FDate: '2026-08-02', FSupplierId_FNumber: 'SUP-RZ', FMaterialId_FNumber: 'SKU-3310', FQty: 4000, FDeliveryDate: '2026-10-01', F_JPCustDue: '2026-10-05', F_JPShipDate: '2026-10-08', FDocumentStatus: 'C' },
  { FID: '5', FBillNo: 'PO-2608-002', FSourceBillNo: 'HN-2026-0805-E', FDate: '2026-08-05', FSupplierId_FNumber: 'SUP-HC', FMaterialId_FNumber: 'SKU-2101', FQty: 7500, FDeliveryDate: '2026-09-22', F_JPCustDue: '2026-09-25', F_JPShipDate: '2026-09-26', FDocumentStatus: 'C' },
  { FID: '6', FBillNo: 'PO-2606-004', FSourceBillNo: 'HN-2026-0702-F', FDate: '2026-06-18', FSupplierId_FNumber: 'SUP-RZ', FMaterialId_FNumber: 'SKU-3302', FQty: 15000, FDeliveryDate: '2026-08-28', F_JPCustDue: '2026-08-30', F_JPShipDate: '2026-08-31', FDocumentStatus: 'C' },
  { FID: '7', FBillNo: 'PO-2608-003', FSourceBillNo: 'HN-2026-0806-G', FDate: '2026-08-10', FSupplierId_FNumber: 'SUP-HY', FMaterialId_FNumber: 'SKU-1120', FQty: 20000, FDeliveryDate: '2026-09-05', F_JPCustDue: '2026-09-08', F_JPShipDate: '2026-09-05', FDocumentStatus: 'C' },
  { FID: '8', FBillNo: 'PO-2609-001', FSourceBillNo: 'HN-2026-0901-H', FDate: '2026-09-10', FSupplierId_FNumber: 'SUP-LD', FMaterialId_FNumber: 'SKU-5501', FQty: 3000, FDeliveryDate: '2026-11-15', F_JPCustDue: '2026-11-20', F_JPShipDate: '2026-11-22', FDocumentStatus: 'Z' },
]

const saleOrders: RawSaleOrder[] = []

/** 发货通知单 SAL_DeliveryNotice */
const deliveryNotices: RawDeliveryNotice[] = [
  { FID: '1', FBillNo: 'SAL-DN-001', FDate: '2026-09-05', FCustomerID_FNumber: 'HN', FMaterialID_FNumber: 'SKU-1001', FQty: 12000, FDeliveryDate: '2026-09-12', F_JPConfirm: '已确认', FDocumentStatus: 'C' },
  { FID: '2', FBillNo: 'SAL-DN-002', FDate: '2026-09-18', FCustomerID_FNumber: 'HN', FMaterialID_FNumber: 'SKU-2101', FQty: 7500, FDeliveryDate: '2026-09-26', F_JPConfirm: '待确认', FDocumentStatus: 'C' },
  { FID: '3', FBillNo: 'SAL-DN-003', FDate: '2026-10-10', FCustomerID_FNumber: 'HN', FMaterialID_FNumber: 'SKU-1088', FQty: 9000, FDeliveryDate: '2026-10-18', F_JPConfirm: '有差异', F_JPNote: '工厂反馈产能不足，最多交 6000，需与客户协商分批', FDocumentStatus: 'C' },
  { FID: '4', FBillNo: 'SAL-DN-004', FDate: '2026-09-20', FCustomerID_FNumber: 'HN', FMaterialID_FNumber: 'SKU-2043', FQty: 6000, FDeliveryDate: '2026-09-28', F_JPConfirm: '待确认', FDocumentStatus: 'C' },
  { FID: '5', FBillNo: 'SAL-DN-005', FDate: '2026-10-02', FCustomerID_FNumber: 'HN', FMaterialID_FNumber: 'SKU-3310', FQty: 4000, FDeliveryDate: '2026-10-08', F_JPConfirm: '已确认', FDocumentStatus: 'C' },
]

/** 应付单 AP_PayableBill（供应商发票/货款） */
const payableBills: RawPayableBill[] = [
  { FID: '1', FBillNo: 'INV-2608-01', FDate: '2026-08-20', FSupplierId_FNumber: 'SUP-HY', FAmount: 120000, F_JPPayStatus: '已付', F_JPPaid: 120000, FDocumentStatus: 'C' },
  { FID: '2', FBillNo: 'INV-2608-02', FDate: '2026-08-25', FSupplierId_FNumber: 'SUP-HC', FAmount: 80000, F_JPPayStatus: '部分付', F_JPPaid: 50000, FDocumentStatus: 'C' },
  { FID: '3', FBillNo: 'INV-2608-03', FDate: '2026-09-05', FSupplierId_FNumber: 'SUP-RZ', FAmount: 40000, F_JPPayStatus: '未付', FDocumentStatus: 'C' },
  { FID: '4', FBillNo: 'INV-2609-01', FDate: '2026-09-12', FSupplierId_FNumber: 'SUP-LD', FAmount: 60000, F_JPPayStatus: '未付', FDocumentStatus: 'C' },
]

/** 销售出库单 SAL_OutStock（物流报关） */
const outStocks: RawOutStock[] = [
  { FID: '1', FBillNo: 'PO-2606-004', FMaterialID_FNumber: 'SKU-3302', FQty: 15000, FDate: '2026-08-31', F_JPCustomsNo: 'DECL-2608-001', F_HSCODE: '630493', FCarrierID_FNumber: '中海海运', FCarriageNO: 'BL-2608-77', F_ETD: '2026-08-25', F_ETA: '2026-09-05', F_JPLogiStatus: '已到港', FDocumentStatus: 'C' },
  { FID: '2', FBillNo: 'PO-2608-003', FMaterialID_FNumber: 'SKU-1120', FQty: 20000, FDate: '2026-09-05', F_JPCustomsNo: 'DECL-2609-002', F_HSCODE: '392490', FCarrierID_FNumber: '中远海运', FCarriageNO: 'BL-2609-12', F_ETD: '2026-09-01', F_ETA: '2026-09-20', F_JPLogiStatus: '在途', FDocumentStatus: 'C' },
  { FID: '3', FBillNo: 'PO-2608-002', FMaterialID_FNumber: 'SKU-2101', FQty: 7500, FDate: '2026-09-15', F_JPCustomsNo: 'DECL-2609-003', F_HSCODE: '732399', FCarrierID_FNumber: '顺丰国际', FCarriageNO: 'BL-2609-30', F_ETD: '2026-09-15', F_ETA: '2026-09-28', F_JPLogiStatus: '已离港', FDocumentStatus: 'C' },
  { FID: '4', FBillNo: 'PO-2607-001', FMaterialID_FNumber: 'SKU-1001', FQty: 12000, FDate: '2026-09-18', F_JPCustomsNo: 'DECL-2609-004', F_HSCODE: '392410', FCarrierID_FNumber: '待定', F_ETD: '2026-09-18', F_ETA: '2026-10-05', F_JPLogiStatus: '报关中', FDocumentStatus: 'C' },
]

export const kingdeeData: KingdeeDataset = {
  materials,
  suppliers,
  purchaseOrders,
  saleOrders,
  deliveryNotices,
  payableBills,
  outStocks,
}

// ===== 经适配器转换为前端模型（金蝶 → Demo） =====
export const mockProducts = toProducts(kingdeeData)
export const mockShipments = toShipments(kingdeeData)
export const mockInvoices = toInvoices(kingdeeData)
export const mockLogistics = toLogistics(kingdeeData)

// ===== 以下为 Demo 核心 / 自定义业务数据（金蝶无原生对应） =====

interface RawMilestone {
  name: OrderStatus
  planned: string
  actual?: string
  source: ProgressSource
  status?: MilestoneStatus
  updatedAt?: string
  updatedBy?: string
}

function build(orderId: string, raw: RawMilestone[]): Milestone[] {
  return raw.map((r, i) => ({
    id: `${orderId}-M${i + 1}`,
    orderId,
    name: r.name,
    plannedDate: r.planned,
    actualDate: r.actual,
    status: r.status ?? (r.actual ? 'completed' : 'pending'),
    source: r.source,
    updatedBy: r.updatedBy ?? '张跟单',
    updatedAt: r.updatedAt ?? r.actual ?? r.planned,
  }))
}

export const mockOrders: Order[] = [
  { id: 'o1', orderNo: 'PO-2607-001', customerOrderNo: 'HN-2026-0801-A', supplier: '东莞宏远塑胶', sku: 'SKU-1001', skuName: '收纳盒 A 型', qty: 12000, orderDate: '2026-07-20', customerDue: '2026-09-10', factoryDue: '2026-09-08', planShipDate: '2026-09-12', status: '生产中', riskLevel: 'high', erpOrderNo: 'PUR20260720001' },
  { id: 'o2', orderNo: 'PO-2607-002', customerOrderNo: 'HN-2026-0802-B', supplier: '宁波华成五金', sku: 'SKU-2043', skuName: '厨房挂架 B 型', qty: 6000, orderDate: '2026-07-25', customerDue: '2026-09-20', factoryDue: '2026-09-25', planShipDate: '2026-09-28', status: '生产中', riskLevel: 'mid', erpOrderNo: 'PUR20260725003' },
  { id: 'o3', orderNo: 'PO-2607-003', customerOrderNo: 'HN-2026-0803-C', supplier: '东莞宏远塑胶', sku: 'SKU-1088', skuName: '收纳箱 C 型', qty: 9000, orderDate: '2026-07-28', customerDue: '2026-10-15', factoryDue: '2026-10-10', planShipDate: '2026-10-18', status: '生产中', riskLevel: 'mid', erpOrderNo: 'PUR20260728007' },
  { id: 'o4', orderNo: 'PO-2608-001', customerOrderNo: 'HN-2026-0804-D', supplier: '苏州瑞泽纺织', sku: 'SKU-3310', skuName: '桌布 D 型', qty: 4000, orderDate: '2026-08-02', customerDue: '2026-10-05', factoryDue: '2026-10-01', planShipDate: '2026-10-08', status: '验货', riskLevel: 'low', erpOrderNo: 'PUR20260802002' },
  { id: 'o5', orderNo: 'PO-2608-002', customerOrderNo: 'HN-2026-0805-E', supplier: '宁波华成五金', sku: 'SKU-2101', skuName: '浴室置物架', qty: 7500, orderDate: '2026-08-05', customerDue: '2026-09-25', factoryDue: '2026-09-22', planShipDate: '2026-09-26', status: '已完工', riskLevel: 'low', erpOrderNo: 'PUR20260805009' },
  { id: 'o6', orderNo: 'PO-2606-004', customerOrderNo: 'HN-2026-0702-F', supplier: '苏州瑞泽纺织', sku: 'SKU-3302', skuName: '抱枕套 F 型', qty: 15000, orderDate: '2026-06-18', customerDue: '2026-08-30', factoryDue: '2026-08-28', planShipDate: '2026-08-31', status: '已出货', riskLevel: 'low', erpOrderNo: 'PUR20260618012' },
  { id: 'o7', orderNo: 'PO-2608-003', customerOrderNo: 'HN-2026-0806-G', supplier: '东莞宏远塑胶', sku: 'SKU-1120', skuName: '衣架 G 型', qty: 20000, orderDate: '2026-08-10', customerDue: '2026-09-08', factoryDue: '2026-09-05', planShipDate: '2026-09-05', status: '已出货', riskLevel: 'low', erpOrderNo: 'PUR20260810004' },
  { id: 'o8', orderNo: 'PO-2609-001', customerOrderNo: 'HN-2026-0901-H', supplier: '中山立德电子', sku: 'SKU-5501', skuName: 'LED 小夜灯', qty: 3000, orderDate: '2026-09-10', customerDue: '2026-11-20', factoryDue: '2026-11-15', planShipDate: '2026-11-22', status: '已下单', riskLevel: 'low', erpOrderNo: 'PUR20260910001' },
]

export const mockMilestones: Milestone[] = [
  ...build('o1', [
    { name: '已下单', planned: '2026-07-20', actual: '2026-07-20', source: 'ERP同步' },
    { name: '备料', planned: '2026-08-01', actual: '2026-08-05', source: '工厂反馈', status: 'delayed' },
    { name: '生产中', planned: '2026-08-10', source: '工厂反馈', updatedAt: '2026-09-08' },
  ]),
  ...build('o2', [
    { name: '已下单', planned: '2026-07-25', actual: '2026-07-25', source: 'ERP同步' },
    { name: '备料', planned: '2026-08-05', actual: '2026-08-06', source: 'ERP同步' },
    { name: '生产中', planned: '2026-08-15', source: '工厂反馈', updatedAt: '2026-09-10' },
  ]),
  ...build('o3', [
    { name: '已下单', planned: '2026-07-28', actual: '2026-07-28', source: 'ERP同步' },
    { name: '备料', planned: '2026-08-08', actual: '2026-08-12', source: '工厂反馈', status: 'delayed' },
    { name: '生产中', planned: '2026-08-20', source: '人工录入', updatedAt: '2026-08-20' },
  ]),
  ...build('o4', [
    { name: '已下单', planned: '2026-08-02', actual: '2026-08-02', source: 'ERP同步' },
    { name: '备料', planned: '2026-08-12', actual: '2026-08-11', source: 'ERP同步' },
    { name: '生产中', planned: '2026-08-20', actual: '2026-08-30', source: '工厂反馈' },
    { name: '验货', planned: '2026-09-10', source: '人工录入', updatedAt: '2026-09-12' },
  ]),
  ...build('o5', [
    { name: '已下单', planned: '2026-08-05', actual: '2026-08-05', source: 'ERP同步' },
    { name: '备料', planned: '2026-08-15', actual: '2026-08-15', source: 'ERP同步' },
    { name: '生产中', planned: '2026-08-22', actual: '2026-08-28', source: '工厂反馈' },
    { name: '验货', planned: '2026-09-08', actual: '2026-09-09', source: '人工录入' },
    { name: '已完工', planned: '2026-09-13', actual: '2026-09-13', source: '工厂反馈' },
  ]),
  ...build('o6', [
    { name: '已下单', planned: '2026-06-18', actual: '2026-06-18', source: 'ERP同步' },
    { name: '备料', planned: '2026-06-28', actual: '2026-06-27', source: 'ERP同步' },
    { name: '生产中', planned: '2026-07-10', actual: '2026-07-18', source: '工厂反馈' },
    { name: '验货', planned: '2026-08-10', actual: '2026-08-12', source: '人工录入' },
    { name: '已完工', planned: '2026-08-20', actual: '2026-08-22', source: 'ERP同步' },
    { name: '已出货', planned: '2026-08-31', actual: '2026-08-31', source: 'ERP同步' },
  ]),
  ...build('o7', [
    { name: '已下单', planned: '2026-08-10', actual: '2026-08-10', source: 'ERP同步' },
    { name: '备料', planned: '2026-08-16', actual: '2026-08-16', source: 'ERP同步' },
    { name: '生产中', planned: '2026-08-22', actual: '2026-08-24', source: '工厂反馈' },
    { name: '验货', planned: '2026-08-30', actual: '2026-08-30', source: '人工录入' },
    { name: '已完工', planned: '2026-09-02', actual: '2026-09-02', source: 'ERP同步' },
    { name: '已出货', planned: '2026-09-05', actual: '2026-09-05', source: 'ERP同步' },
  ]),
  ...build('o8', [
    { name: '已下单', planned: '2026-09-10', actual: '2026-09-10', source: 'ERP同步' },
    // 由 AI 从工厂邮件中提取，尚未人工确认 —— 默认不生效
    { name: '备料', planned: '2026-09-20', source: 'AI提取', updatedBy: 'AI 助手', updatedAt: '2026-09-14' },
  ]),
]

export const mockSyncTasks: SyncTask[] = [
  { id: 's1', object: '物料', formId: 'BD_MATERIAL', status: 'success', lastRunAt: '2026-09-15 06:00:00', successCount: 1240, failedCount: 0, failures: [] },
  { id: 's2', object: '供应商', formId: 'BD_Supplier', status: 'success', lastRunAt: '2026-09-15 06:05:00', successCount: 86, failedCount: 0, failures: [] },
  { id: 's3', object: '采购订单', formId: 'PUR_PurchaseOrder', status: 'partial', lastRunAt: '2026-09-15 06:10:00', successCount: 142, failedCount: 3, failures: [
    { id: 'f1', bizKey: 'PUR20260910007', reason: '物料编码 SKU-5522 在 ERP 中不存在' },
    { id: 'f2', bizKey: 'PUR20260910011', reason: '供应商编码 SUP-0031 未审核' },
    { id: 'f3', bizKey: 'PUR20260910018', reason: '单据已关闭，不允许同步' },
  ] },
]

export const mockPenalties: Penalty[] = [
  { id: 'pe1', supplier: '东莞宏远塑胶', orderNo: 'PO-2607-001', reason: '交期延迟 5 天，影响客户门店补货', amount: 5000, status: '未处理' },
  { id: 'pe2', supplier: '苏州瑞泽纺织', orderNo: 'PO-2608-001', reason: '首批验货色差，返工产生额外运费', amount: 3000, status: '已处理' },
]

export const mockProductComms: ProductComm[] = [
  { id: 'pc1', productId: 'p8', sku: 'SKU-5501', type: '首单', content: '客户确认 LED 小夜灯规格书，首批 3000 只首单下单', date: '2026-09-10', owner: '张跟单' },
  { id: 'pc2', productId: 'p1', sku: 'SKU-1001', type: '翻单', content: '收纳盒 A 型追加翻单 12000，沿用上次模具', date: '2026-07-20', owner: '张跟单' },
  { id: 'pc3', productId: 'p6', sku: 'SKU-3302', type: '翻单', content: '客户追加抱枕套 F 型翻单 5000，交期要求 10 月底', date: '2026-08-15', owner: '李跟单' },
  { id: 'pc4', productId: 'p9', sku: 'SKU-2200', type: '废番', content: '客户通知旧款杯垫废番，停止下单并清库存', date: '2026-08-01', owner: '李跟单' },
  { id: 'pc5', productId: 'p3', sku: 'SKU-1088', type: '其他', content: '客户要求收纳箱 C 型外箱印刷改日语标签', date: '2026-08-22', owner: '张跟单' },
]
