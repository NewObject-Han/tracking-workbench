import { useState } from 'react'
import {
  Table,
  Tag,
  Button,
  Modal,
  InputNumber,
  message,
  Card,
  Row,
  Col,
  Typography,
  Space,
  Statistic,
} from 'antd'
import type { TableProps } from 'antd'
import { useWorkbench } from '@/store/useWorkbench'
import { replenishOf, replenishSummary } from '@/utils/derive'
import type { Product } from '@/types'

const { Title, Paragraph, Text } = Typography

export default function Replenish() {
  const products = useWorkbench((s) => s.products)
  const contracts = useWorkbench((s) => s.contracts)
  const generateContract = useWorkbench((s) => s.generateContract)

  const [open, setOpen] = useState(false)
  const [active, setActive] = useState<Product | null>(null)
  const [qty, setQty] = useState(0)

  const summary = replenishSummary(products)

  const openModal = (p: Product) => {
    setActive(p)
    setQty(replenishOf(p).suggestQty)
    setOpen(true)
  }
  const submit = () => {
    if (!active) return
    if (qty <= 0) {
      message.warning('下单量需大于 0')
      return
    }
    generateContract(active.id, qty)
    message.success(`已生成 ${active.sku} 的下单合同`)
    setOpen(false)
  }

  const columns: TableProps<Product>['columns'] = [
    { title: 'SKU', dataIndex: 'sku', fixed: 'left', width: 110 },
    { title: '产品', dataIndex: 'skuName' },
    { title: '供应商', dataIndex: 'supplier', responsive: ['md'] },
    {
      title: '日本库存',
      dataIndex: 'jpStock',
      responsive: ['sm'],
      render: (v: number) => v.toLocaleString(),
    },
    {
      title: '月销量',
      dataIndex: 'monthlySales',
      responsive: ['sm'],
      render: (v: number) => v.toLocaleString(),
    },
    {
      title: '生产周期',
      dataIndex: 'leadTimeDays',
      responsive: ['lg'],
      render: (v: number) => `${v} 天`,
    },
    {
      title: '安全库存',
      dataIndex: 'safetyStock',
      responsive: ['lg'],
      render: (v: number) => v.toLocaleString(),
    },
    {
      title: '周期消耗',
      responsive: ['lg'],
      render: (_: unknown, r: Product) => replenishOf(r).leadTimeConsumption.toLocaleString(),
    },
    {
      title: '建议下单量',
      render: (_: unknown, r: Product) => {
        const s = replenishOf(r)
        return r.lifecycle === '废番' ? '—' : s.suggestQty.toLocaleString()
      },
    },
    {
      title: '状态',
      render: (_: unknown, r: Product) => {
        if (r.lifecycle === '废番') return <Tag>已废番·不补</Tag>
        return replenishOf(r).needReplenish ? (
          <Tag color="red">建议补货</Tag>
        ) : (
          <Tag color="green">库存充足</Tag>
        )
      },
    },
    {
      title: '操作',
      fixed: 'right',
      width: 120,
      render: (_: unknown, r: Product) =>
        r.lifecycle !== '废番' && replenishOf(r).needReplenish ? (
          <Button type="link" size="small" onClick={() => openModal(r)}>
            生成合同
          </Button>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
  ]

  const contractColumns: TableProps<(typeof contracts)[number]>['columns'] = [
    { title: '合同号', dataIndex: 'contractNo' },
    { title: 'SKU', dataIndex: 'sku' },
    { title: '产品', dataIndex: 'skuName', responsive: ['sm'] },
    { title: '供应商', dataIndex: 'supplier', responsive: ['md'] },
    { title: '数量', dataIndex: 'qty', render: (v: number) => v.toLocaleString() },
    {
      title: '状态',
      dataIndex: 'status',
      render: (v: string) => <Tag color={v === '已发送' ? 'green' : 'orange'}>{v}</Tag>,
    },
    { title: '生成时间', dataIndex: 'createdAt', responsive: ['md'] },
  ]

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div>
        <Title level={4} style={{ marginBottom: 4 }}>
          备货预测与下单
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          根据「日本门店月销量 × 生产周期 + 安全库存 − 日本仓库库存」自动计算建议下单量，提前向供应商下单、组织备货。
        </Paragraph>
      </div>
      <Row gutter={[16, 16]}>
        <Col xs={12} md={8}>
          <Card>
            <Statistic title="需补货产品" value={summary.needCount} suffix="款" valueStyle={{ color: '#cf1322' }} />
          </Card>
        </Col>
        <Col xs={12} md={8}>
          <Card>
            <Statistic title="建议总下单量" value={summary.totalSuggest} valueStyle={{ color: '#1677ff' }} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="已生成合同" value={contracts.length} suffix="份" />
          </Card>
        </Col>
      </Row>
      <Card title="产品主数据 · 备货建议" styles={{ body: { padding: 0 } }}>
        <Table
          rowKey="id"
          size="middle"
          columns={columns}
          dataSource={products}
          scroll={{ x: 900, y: 'calc(100vh - 400px)' }}
          pagination={false}
        />
      </Card>
      <Card title="已生成的下单合同">
        {contracts.length === 0 ? (
          <Text type="secondary">暂无合同，在上方对需补货产品点击「生成合同」。</Text>
        ) : (
          <Table
            rowKey="id"
            size="middle"
            columns={contractColumns}
            dataSource={contracts}
            pagination={false}
            scroll={{ x: 600, y: 200 }}
          />
        )}
      </Card>
      <Modal
        title={active ? `生成下单合同 · ${active.sku} ${active.skuName}` : ''}
        open={open}
        onOk={submit}
        onCancel={() => setOpen(false)}
        okText="生成合同"
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Text>供应商：{active?.supplier}</Text>
          <Text>
            系统建议下单量：
            <Text strong>{active ? replenishOf(active).suggestQty.toLocaleString() : 0}</Text>
          </Text>
          <div>
            <Text>下单数量：</Text>
            <InputNumber min={0} style={{ width: '100%' }} value={qty} onChange={(v) => setQty(v ?? 0)} />
          </div>
        </Space>
      </Modal>
    </Space>
  )
}
