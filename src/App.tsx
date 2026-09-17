import { useState } from 'react'
import { Layout, Menu, Typography, Button, Drawer, Grid, Tooltip, Tag } from 'antd'
import {
  AppstoreOutlined,
  SyncOutlined,
  MenuFoldOutlined,
  ShoppingOutlined,
  SendOutlined,
  FileTextOutlined,
  TagsOutlined,
  CarOutlined,
} from '@ant-design/icons'
import { useLocation, useNavigate, Route, Routes } from 'react-router-dom'
import type { MenuProps } from 'antd'
import OrderBoard from '@/pages/OrderBoard'
import OrderDetail from '@/pages/OrderDetail'
import SyncManage from '@/pages/SyncManage'
import Replenish from '@/pages/Replenish'
import Shipment from '@/pages/Shipment'
import Finance from '@/pages/Finance'
import Products from '@/pages/Products'
import Logistics from '@/pages/Logistics'
import Flow from '@/pages/Flow'
import Rules from '@/pages/Rules'
import { FORMS } from '@/api/kingdee'
import { Watermark, useContentGuard, useGuardParams } from '@/components/Protection'

const { Header, Sider, Content } = Layout

const menuItems: MenuProps['items'] = [
  {
    type: 'submenu',
    key: 'g-center',
    label: '跟单中心',
    children: [
      { key: '/', icon: <AppstoreOutlined />, label: '订单进度看板' },
      { key: '/replenish', icon: <ShoppingOutlined />, label: '备货预测' },
    ],
  },
  {
    type: 'submenu',
    key: 'g-ship',
    label: '出货物流',
    children: [
      { key: '/shipment', icon: <SendOutlined />, label: '出货确认' },
      { key: '/logistics', icon: <CarOutlined />, label: '报关物流' },
    ],
  },
  {
    type: 'submenu',
    key: 'g-fin',
    label: '财务对账',
    children: [{ key: '/finance', icon: <FileTextOutlined />, label: '发票货款' }],
  },
  {
    type: 'submenu',
    key: 'g-prod',
    label: '产品沟通',
    children: [{ key: '/products', icon: <TagsOutlined />, label: '产品与翻单' }],
  },
  {
    type: 'submenu',
    key: 'g-auto',
    label: '流程自动化',
    children: [
      { key: '/flow', icon: <AppstoreOutlined />, label: '流程编排' },
      { key: '/rules', icon: <FileTextOutlined />, label: '规则引擎' },
      { key: '/sync', icon: <SyncOutlined />, label: '金蝶同步' },
    ],
  },
]

export default function App() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.lg
  const [drawerOpen, setDrawerOpen] = useState(false)
  // 外部分享防护：?ref=受邀人 署名到水印，?guard=0 关闭防护
  const { guest, enabled: guardOn } = useGuardParams()
  useContentGuard(guardOn)

  const selectedKey = pathname.startsWith('/orders') ? '/' : pathname

  const menuNode = (
    <Menu
      mode="inline"
      selectedKeys={[selectedKey]}
      items={menuItems}
      style={{ height: '100%', borderRight: 0 }}
      onClick={({ key }) => {
        navigate(key)
        setDrawerOpen(false)
      }}
    />
  )

  return (
    <Layout className="app-shell" style={{ height: '100vh', overflow: 'hidden' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: isMobile ? '0 12px' : '0 24px',
          flex: '0 0 auto',
        }}
      >
        {isMobile && (
          <Button
            type="text"
            aria-label="打开菜单"
            icon={<MenuFoldOutlined style={{ color: '#fff', fontSize: 18 }} />}
            onClick={() => setDrawerOpen(true)}
          />
        )}
        <Typography.Title level={isMobile ? 5 : 4} style={{ color: '#fff', margin: 0 }}>
          智能跟单工作台
        </Typography.Title>
        {!isMobile && (
          <Typography.Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>
            V0.3 · 金蝶数据接入
          </Typography.Text>
        )}
        {!isMobile && (
          <Tooltip
            title={
              <div style={{ fontSize: 12, lineHeight: 1.6 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>金蝶云星空 WebAPI（executeBillQuery）</div>
                <div>物料：{FORMS.BD_MATERIAL}</div>
                <div>供应商：{FORMS.BD_SUPPLIER}</div>
                <div>采购订单：{FORMS.PUR_PURCHASE_ORDER}</div>
                <div>销售订单：{FORMS.SAL_SALE_ORDER}</div>
                <div>发货通知单：{FORMS.SAL_DELIVERY_NOTICE}</div>
                <div>应付单：{FORMS.AP_PAYABLE_BILL}</div>
                <div>销售出库单：{FORMS.SAL_OUT_STOCK}</div>
              </div>
            }
          >
            <Tag color="geekblue" style={{ marginLeft: 8, cursor: 'help' }}>
              数据来源：金蝶云星空 ERP（WebAPI 模拟）
            </Tag>
          </Tooltip>
        )}
      </Header>
      <Layout style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {!isMobile && (
          <Sider
            width={200}
            theme="light"
            style={{ height: '100%', overflow: 'auto' }}
          >
            {menuNode}
          </Sider>
        )}
        <Content style={{ padding: isMobile ? 12 : 24, background: '#f5f5f5', flex: 1, minHeight: 0, overflow: 'auto' }}>
          <Routes>
            <Route path="/" element={<OrderBoard />} />
            <Route path="/orders/:id" element={<OrderDetail />} />
            <Route path="/replenish" element={<Replenish />} />
            <Route path="/shipment" element={<Shipment />} />
            <Route path="/finance" element={<Finance />} />
            <Route path="/products" element={<Products />} />
            <Route path="/logistics" element={<Logistics />} />
            <Route path="/flow" element={<Flow />} />
            <Route path="/rules" element={<Rules />} />
            <Route path="/sync" element={<SyncManage />} />
          </Routes>
        </Content>
      </Layout>
      <Drawer
        title="导航"
        placement="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        styles={{ body: { padding: 0 } }}
      >
        {menuNode}
      </Drawer>
      <Watermark guest={guest} enabled={guardOn} />
    </Layout>
  )
}
