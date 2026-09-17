# 智能跟单工作台 (Tracking Workbench)

外贸跟单全流程管理系统，数据来源对接**金蝶云星空 ERP**。
在线演示：https://tracking-workbench.app.workbuddy.host/

## 功能

| 模块 | 说明 |
| --- | --- |
| 跟单中心 | 订单进度看板、备货预测（`月销量 × 生产周期 + 安全库存 − 日本库存`） |
| 出货物流 | 出货计划与工厂确认、报关物流跟踪 |
| 财务对账 | 发票货款、供应商罚款 |
| 产品沟通 | 产品主数据、首单 / 翻单 / 废番记录 |
| 流程自动化 | 流程编排看板、SLA 异常预警、金蝶双向同步、自定义规则引擎 |

## 快速开始

```bash
npm install
npm run dev      # 开发 http://localhost:5173
npm run build    # 类型检查 + 生产构建
npm run preview  # 预览构建产物
```

## 金蝶云星空对接

数据源为金蝶 WebAPI（`executeBillQuery`）的**模拟实现**，字段映射见 `src/api/kingdee.ts`：

- 物料 `BD_MATERIAL`、供应商 `BD_Supplier`、采购订单 `PUR_PurchaseOrder`
- 销售订单 `SAL_SaleOrder`、发货通知单 `SAL_DeliveryNotice`
- 应付单 `AP_PayableBill`、销售出库单 `SAL_OutStock`

生产周期取 `FFixLeadTime + FVarLeadTime`；日本库存、月销量、报关、付款等走 `F_` 前缀自定义字段。


## 技术栈

React 18 · Vite 5 · TypeScript · Ant Design 5 · zustand · TanStack Query · dayjs
