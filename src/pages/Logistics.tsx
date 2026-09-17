import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Select,
  message,
  Typography,
  Space,
} from 'antd'
import type { TableProps } from 'antd'
import { useWorkbench } from '@/store/useWorkbench'
import type { Logistics, LogisticsStatus } from '@/types'

const { Title, Paragraph } = Typography

const statusColor: Record<LogisticsStatus, string> = {
  报关中: 'orange',
  已离港: 'blue',
  在途: 'cyan',
  已到港: 'green',
}
const statusOptions = (Object.keys(statusColor) as LogisticsStatus[]).map((s) => ({
  value: s,
  label: s,
}))

export default function LogisticsPage() {
  const logistics = useWorkbench((s) => s.logistics)
  const updateLogistics = useWorkbench((s) => s.updateLogistics)

  const counts = {
    报关中: logistics.filter((l) => l.status === '报关中').length,
    已离港: logistics.filter((l) => l.status === '已离港').length,
    在途: logistics.filter((l) => l.status === '在途').length,
    已到港: logistics.filter((l) => l.status === '已到港').length,
  }

  const columns: TableProps<Logistics>['columns'] = [
    { title: '订单号', dataIndex: 'orderNo', fixed: 'left', width: 120 },
    { title: 'SKU', dataIndex: 'sku', responsive: ['sm'] },
    { title: '报关单号', dataIndex: 'declarationNo', responsive: ['md'] },
    { title: 'HS 编码', dataIndex: 'hsCode', responsive: ['lg'] },
    { title: '物流单号', dataIndex: 'logisticsNo', responsive: ['md'] },
    { title: '承运商', dataIndex: 'carrier', responsive: ['sm'] },
    {
      title: '状态',
      dataIndex: 'status',
      render: (v: LogisticsStatus) => <Tag color={statusColor[v]}>{v}</Tag>,
    },
    { title: 'ETD', dataIndex: 'etd', responsive: ['lg'], width: 100 },
    { title: 'ETA', dataIndex: 'eta', responsive: ['lg'], width: 100 },
    {
      title: '状态更新',
      fixed: 'right',
      width: 120,
      render: (_: unknown, r: Logistics) => (
        <Select
          size="small"
          value={r.status}
          style={{ width: '100%' }}
          options={statusOptions}
          onChange={(v) => {
            updateLogistics(r.id, v)
            message.success('物流状态已更新')
          }}
        />
      ),
    },
  ]

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div>
        <Title level={4} style={{ marginBottom: 4 }}>
          报关与物流
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          发货时的报关资料（报关单号 / HS 编码）与物流单号、承运商、在途状态等对接与追踪。
        </Paragraph>
      </div>
      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="报关中" value={counts.报关中} valueStyle={{ color: '#d46b08' }} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="已离港" value={counts.已离港} valueStyle={{ color: '#1677ff' }} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="在途" value={counts.在途} valueStyle={{ color: '#08979c' }} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="已到港" value={counts.已到港} valueStyle={{ color: '#389e0d' }} />
          </Card>
        </Col>
      </Row>
      <Card title="报关物流跟踪" styles={{ body: { padding: 0 } }}>
        <Table
          rowKey="id"
          size="middle"
          columns={columns}
          dataSource={logistics}
          scroll={{ x: 1000, y: 'calc(100vh - 400px)' }}
          pagination={false}
        />
      </Card>
    </Space>
  )
}
