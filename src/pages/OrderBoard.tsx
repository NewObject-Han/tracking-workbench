import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Button,
  Card,
  Col,
  DatePicker,
  Input,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import type { Milestone, Order } from '@/types'
import { useWorkbench } from '@/store/useWorkbench'
import { NODE_SEQUENCE } from '@/mock/data'
import {
  TODAY,
  anomalyTypes,
  isOverdue,
  isStalled,
  overdueDays,
  remainingDays,
} from '@/utils/derive'

const { RangePicker } = DatePicker

interface Row extends Order {
  ms: Milestone[]
  anomalies: string[]
  remain: number
}

const riskColor: Record<Order['riskLevel'], string> = {
  high: 'red',
  mid: 'orange',
  low: 'default',
}

const riskText: Record<Order['riskLevel'], string> = {
  high: '高',
  mid: '中',
  low: '低',
}

export default function OrderBoard() {
  const { orders, milestones } = useWorkbench()
  const [supplier, setSupplier] = useState<string>()
  const [status, setStatus] = useState<string>()
  const [keyword, setKeyword] = useState('')
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null)

  const rows = useMemo<Row[]>(
    () =>
      orders.map((o) => {
        const ms = milestones.filter((m) => m.orderId === o.id)
        return {
          ...o,
          ms,
          anomalies: anomalyTypes(o, ms),
          remain: remainingDays(o),
        }
      }),
    [orders, milestones],
  )

  const stats = useMemo(
    () => ({
      inFlight: rows.filter((r) => r.status !== '已出货').length,
      shippedThisMonth: rows.filter(
        (r) =>
          r.status === '已出货' && dayjs(r.planShipDate).isSame(TODAY, 'month'),
      ).length,
      overdue: rows.filter((r) => isOverdue(r)).length,
      stalled: rows.filter((r) => isStalled(r, r.ms)).length,
    }),
    [rows],
  )

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return rows
      .filter((r) => (supplier ? r.supplier === supplier : true))
      .filter((r) => (status ? r.status === status : true))
      .filter((r) => {
        if (!range) return true
        const due = dayjs(r.customerDue)
        return !due.isBefore(range[0], 'day') && !due.isAfter(range[1], 'day')
      })
      .filter((r) =>
        kw
          ? [r.orderNo, r.customerOrderNo, r.sku, r.skuName, r.supplier]
              .join(' ')
              .toLowerCase()
              .includes(kw)
          : true,
      )
      .sort((a, b) => {
        if (a.anomalies.length !== b.anomalies.length) {
          return b.anomalies.length - a.anomalies.length
        }
        return a.remain - b.remain
      })
  }, [rows, supplier, status, keyword, range])

  const anomalies = filtered.filter((r) => r.anomalies.length > 0)

  const columns: ColumnsType<Row> = [
    {
      title: '订单号',
      dataIndex: 'orderNo',
      fixed: 'left',
      width: 140,
      render: (v: string, r) => <Link to={`/orders/${r.id}`}>{v}</Link>,
    },
    {
      title: '客户订单号',
      dataIndex: 'customerOrderNo',
      width: 150,
      responsive: ['md'],
    },
    { title: '供应商', dataIndex: 'supplier', width: 140, responsive: ['sm'] },
    {
      title: 'SKU',
      width: 180,
      render: (_, r) => (
        <span>
          {r.sku}
          <Typography.Text type="secondary" style={{ marginLeft: 6, fontSize: 12 }}>
            {r.skuName}
          </Typography.Text>
        </span>
      ),
    },
    {
      title: '数量',
      dataIndex: 'qty',
      width: 100,
      align: 'right',
      responsive: ['sm'],
      render: (v: number) => v.toLocaleString(),
    },
    { title: '下单日', dataIndex: 'orderDate', width: 110, responsive: ['lg'] },
    { title: '客户希望交期', dataIndex: 'customerDue', width: 130, responsive: ['md'] },
    {
      title: '工厂承诺交期',
      dataIndex: 'factoryDue',
      width: 130,
      responsive: ['lg'],
      render: (v: string, r) =>
        dayjs(v).isAfter(dayjs(r.customerDue), 'day') ? (
          <Typography.Text type="danger">{v}</Typography.Text>
        ) : (
          v
        ),
    },
    { title: '计划船期', dataIndex: 'planShipDate', width: 110, responsive: ['xl'] },
    {
      title: '当前节点',
      dataIndex: 'status',
      width: 100,
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: '剩余 / 逾期',
      width: 120,
      render: (_, r) =>
        r.remain < 0 ? (
          <Tag color="red">逾期 {overdueDays(r)} 天</Tag>
        ) : r.status === '已出货' ? (
          <Typography.Text type="secondary">—</Typography.Text>
        ) : (
          `${r.remain} 天`
        ),
    },
    {
      title: '风险',
      dataIndex: 'riskLevel',
      width: 80,
      responsive: ['md'],
      render: (v: Order['riskLevel']) => (
        <Tag color={riskColor[v]}>{riskText[v]}</Tag>
      ),
    },
    {
      title: '异常',
      width: 200,
      render: (_, r) =>
        r.anomalies.length ? (
          <Space size={4} wrap>
            {r.anomalies.map((a) => (
              <Tag key={a} color="volcano">
                {a}
              </Tag>
            ))}
          </Space>
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        ),
    },
  ]

  const anomalyColumns: ColumnsType<Row> = [
    {
      title: '订单号',
      dataIndex: 'orderNo',
      width: 140,
      render: (v: string, r) => <Link to={`/orders/${r.id}`}>{v}</Link>,
    },
    { title: '供应商', dataIndex: 'supplier', width: 140, responsive: ['sm'] },
    {
      title: '当前节点',
      dataIndex: 'status',
      width: 100,
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    { title: '客户希望交期', dataIndex: 'customerDue', width: 130, responsive: ['md'] },
    {
      title: '异常',
      responsive: ['sm'],
      render: (_, r) => (
        <Space size={4} wrap>
          {r.anomalies.map((a) => (
            <Tag key={a} color="volcano">
              {a}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '操作',
      width: 90,
      responsive: ['sm'],
      render: (_, r) => <Link to={`/orders/${r.id}`}>去处理</Link>,
    },
  ]

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={12} md={6}>
          <Card>
            <Statistic title="在途订单" value={stats.inFlight} />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card>
            <Statistic title="本月已出货" value={stats.shippedThisMonth} />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card>
            <Statistic
              title="逾期订单"
              value={stats.overdue}
              valueStyle={{ color: stats.overdue > 0 ? '#cf1322' : undefined }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card>
            <Statistic
              title="进度停滞"
              value={stats.stalled}
              valueStyle={{ color: stats.stalled > 0 ? '#d46b08' : undefined }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title="需要处理的异常订单"
        extra={
          <Typography.Text type="secondary">
            共 {anomalies.length} 条 · 自动判定，可人工申诉
          </Typography.Text>
        }
      >
        <Table
          rowKey="id"
          size="small"
          scroll={{ x: 'max-content', y: 180 }}
          pagination={false}
          dataSource={anomalies}
          columns={anomalyColumns}
          locale={{ emptyText: '当前没有异常订单' }}
        />
      </Card>

      <Card title="全部订单">
        <Space wrap style={{ marginBottom: 16 }}>
          <Select
            allowClear
            placeholder="供应商"
            style={{ width: 180, maxWidth: '100%' }}
            value={supplier}
            onChange={setSupplier}
            options={[...new Set(orders.map((o) => o.supplier))].map((s) => ({
              label: s,
              value: s,
            }))}
          />
          <Select
            allowClear
            placeholder="当前节点"
            style={{ width: 140, maxWidth: '100%' }}
            value={status}
            onChange={setStatus}
            options={NODE_SEQUENCE.map((s) => ({ label: s, value: s }))}
          />
          <RangePicker
            value={range}
            onChange={(v) => setRange(v as [dayjs.Dayjs, dayjs.Dayjs] | null)}
            placeholder={['交期起', '交期止']}
          />
          <Input.Search
            allowClear
            placeholder="订单号 / 客户订单号 / SKU"
            style={{ width: 240, maxWidth: '100%' }}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <Button
            onClick={() => {
              setSupplier(undefined)
              setStatus(undefined)
              setRange(null)
              setKeyword('')
            }}
          >
            重置
          </Button>
        </Space>
        <Table
          rowKey="id"
          size="small"
          scroll={{ x: 'max-content', y: 'calc(100vh - 600px)' }}
          dataSource={filtered}
          columns={columns}
          pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条`, size: 'small' }}
        />
      </Card>
    </Space>
  )
}
