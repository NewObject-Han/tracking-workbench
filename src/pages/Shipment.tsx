import { useState } from 'react'
import {
  Table,
  Tag,
  Button,
  Modal,
  Input,
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
import type { ShipmentPlan } from '@/types'

const { Title, Paragraph, Text } = Typography

const statusMeta: Record<ShipmentPlan['factoryConfirmStatus'], { color: string }> = {
  待确认: { color: 'orange' },
  已确认: { color: 'green' },
  有差异: { color: 'red' },
}

export default function Shipment() {
  const shipments = useWorkbench((s) => s.shipments)
  const confirmShipment = useWorkbench((s) => s.confirmShipment)
  const [diffOpen, setDiffOpen] = useState(false)
  const [active, setActive] = useState<ShipmentPlan | null>(null)
  const [note, setNote] = useState('')

  const counts = {
    待确认: shipments.filter((s) => s.factoryConfirmStatus === '待确认').length,
    已确认: shipments.filter((s) => s.factoryConfirmStatus === '已确认').length,
    有差异: shipments.filter((s) => s.factoryConfirmStatus === '有差异').length,
  }

  const openDiff = (s: ShipmentPlan) => {
    setActive(s)
    setNote(s.note ?? '')
    setDiffOpen(true)
  }
  const submitDiff = () => {
    if (!active) return
    confirmShipment(active.id, '有差异', note)
    message.success('已标记差异并同步工厂')
    setDiffOpen(false)
  }

  const columns: TableProps<ShipmentPlan>['columns'] = [
    { title: 'SKU', dataIndex: 'sku', fixed: 'left', width: 110 },
    { title: '产品', dataIndex: 'skuName' },
    { title: '订单号', dataIndex: 'orderNo', responsive: ['md'] },
    { title: '客户计划船期', dataIndex: 'customerPlanDate', responsive: ['sm'] },
    {
      title: '数量',
      dataIndex: 'qty',
      responsive: ['sm'],
      render: (v: number) => v.toLocaleString(),
    },
    {
      title: '工厂确认',
      dataIndex: 'factoryConfirmStatus',
      render: (v: ShipmentPlan['factoryConfirmStatus']) => (
        <Tag color={statusMeta[v].color}>{v}</Tag>
      ),
    },
    { title: '备注', dataIndex: 'note', responsive: ['lg'], ellipsis: true },
    {
      title: '操作',
      fixed: 'right',
      width: 150,
      render: (_: unknown, r: ShipmentPlan) =>
        r.factoryConfirmStatus === '已确认' ? (
          <Text type="secondary">已确认</Text>
        ) : (
          <Space>
            <Button
              type="link"
              size="small"
              onClick={() => {
                confirmShipment(r.id, '已确认')
                message.success('已确认出货计划')
              }}
            >
              确认出货
            </Button>
            <Button type="link" size="small" danger onClick={() => openDiff(r)}>
              标记差异
            </Button>
          </Space>
        ),
    },
  ]

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div>
        <Title level={4} style={{ marginBottom: 4 }}>
          出货计划与工厂确认
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          客户给出出货计划后，与工厂确认出货交期与数量，完成一整套出货确认；如有产能/数量差异需标记并协商。
        </Paragraph>
      </div>
      <Row gutter={[16, 16]}>
        <Col xs={8}>
          <Card>
            <Statistic title="待确认" value={counts.待确认} valueStyle={{ color: '#d46b08' }} />
          </Card>
        </Col>
        <Col xs={8}>
          <Card>
            <Statistic title="已确认" value={counts.已确认} valueStyle={{ color: '#389e0d' }} />
          </Card>
        </Col>
        <Col xs={8}>
          <Card>
            <Statistic title="有差异" value={counts.有差异} valueStyle={{ color: '#cf1322' }} />
          </Card>
        </Col>
      </Row>
      <Card title="出货计划列表" styles={{ body: { padding: 0 } }}>
        <Table
          rowKey="id"
          size="middle"
          columns={columns}
          dataSource={shipments}
          scroll={{ x: 900, y: 'calc(100vh - 400px)' }}
          pagination={false}
        />
      </Card>
      <Modal
        title="标记出货差异"
        open={diffOpen}
        onOk={submitDiff}
        onCancel={() => setDiffOpen(false)}
        okText="提交"
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Text>
            订单：{active?.orderNo} · {active?.skuName}
          </Text>
          <div>
            <Text>差异说明（同步给工厂与客户）：</Text>
            <Input.TextArea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="如：工厂产能不足，最多交 6000，建议分批"
            />
          </div>
        </Space>
      </Modal>
    </Space>
  )
}
