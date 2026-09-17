import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Button,
  message,
  Typography,
  Space,
} from 'antd'
import type { TableProps } from 'antd'
import { useWorkbench } from '@/store/useWorkbench'
import type { Invoice, Penalty } from '@/types'

const { Title, Paragraph, Text } = Typography

const payColor: Record<Invoice['payStatus'], string> = {
  未付: 'red',
  部分付: 'orange',
  已付: 'green',
}
const penColor: Record<Penalty['status'], string> = {
  未处理: 'red',
  已处理: 'green',
}

export default function Finance() {
  const invoices = useWorkbench((s) => s.invoices)
  const penalties = useWorkbench((s) => s.penalties)
  const markPaid = useWorkbench((s) => s.markPaid)
  const resolvePenalty = useWorkbench((s) => s.resolvePenalty)

  const totalPayable = invoices.reduce((s, i) => s + i.amount, 0)
  const totalPaid = invoices.reduce((s, i) => s + i.paidAmount, 0)
  const unpaid = totalPayable - totalPaid
  const openPenalty = penalties
    .filter((p) => p.status === '未处理')
    .reduce((s, p) => s + p.amount, 0)

  const invColumns: TableProps<Invoice>['columns'] = [
    { title: '发票号', dataIndex: 'invoiceNo', fixed: 'left', width: 120 },
    { title: '供应商', dataIndex: 'supplier', responsive: ['md'] },
    { title: '订单号', dataIndex: 'orderNo', responsive: ['sm'] },
    { title: '金额', dataIndex: 'amount', render: (v: number) => `¥${v.toLocaleString()}` },
    {
      title: '已付',
      dataIndex: 'paidAmount',
      responsive: ['lg'],
      render: (v: number) => `¥${v.toLocaleString()}`,
    },
    { title: '开票日', dataIndex: 'issueDate', responsive: ['md'] },
    {
      title: '付款状态',
      dataIndex: 'payStatus',
      render: (v: Invoice['payStatus']) => <Tag color={payColor[v]}>{v}</Tag>,
    },
    {
      title: '操作',
      fixed: 'right',
      width: 100,
      render: (_: unknown, r: Invoice) =>
        r.payStatus === '已付' ? (
          <Text type="secondary">已结清</Text>
        ) : (
          <Button
            type="link"
            size="small"
            onClick={() => {
              markPaid(r.id)
              message.success('已标记付款')
            }}
          >
            标记已付
          </Button>
        ),
    },
  ]

  const penColumns: TableProps<Penalty>['columns'] = [
    { title: '供应商', dataIndex: 'supplier', fixed: 'left', width: 120 },
    { title: '订单号', dataIndex: 'orderNo', responsive: ['sm'] },
    { title: '原因', dataIndex: 'reason', responsive: ['md'], ellipsis: true },
    { title: '金额', dataIndex: 'amount', render: (v: number) => `¥${v.toLocaleString()}` },
    {
      title: '状态',
      dataIndex: 'status',
      render: (v: Penalty['status']) => <Tag color={penColor[v]}>{v}</Tag>,
    },
    {
      title: '操作',
      fixed: 'right',
      width: 90,
      render: (_: unknown, r: Penalty) =>
        r.status === '已处理' ? (
          <Text type="secondary">已处理</Text>
        ) : (
          <Button
            type="link"
            size="small"
            onClick={() => {
              resolvePenalty(r.id)
              message.success('罚款已处理')
            }}
          >
            处理
          </Button>
        ),
    },
  ]

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div>
        <Title level={4} style={{ marginBottom: 4 }}>
          发票货款与罚款
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          与供应商的发票、货款支付对接，以及交货延迟/质量等罚款的处理与对账。
        </Paragraph>
      </div>
      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="应付总额" value={totalPayable} prefix="¥" />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="已付" value={totalPaid} prefix="¥" valueStyle={{ color: '#389e0d' }} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="未付" value={unpaid} prefix="¥" valueStyle={{ color: '#cf1322' }} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="未处理罚款"
              value={openPenalty}
              prefix="¥"
              valueStyle={{ color: '#d46b08' }}
            />
          </Card>
        </Col>
      </Row>
      <Card title="发票与货款" styles={{ body: { padding: 0 } }}>
        <Table
          rowKey="id"
          size="middle"
          columns={invColumns}
          dataSource={invoices}
          scroll={{ x: 820, y: 'calc(100vh - 430px)' }}
          pagination={false}
        />
      </Card>
      <Card title="供应商罚款" styles={{ body: { padding: 0 } }}>
        <Table
          rowKey="id"
          size="middle"
          columns={penColumns}
          dataSource={penalties}
          scroll={{ x: 680, y: 240 }}
          pagination={false}
        />
      </Card>
    </Space>
  )
}
