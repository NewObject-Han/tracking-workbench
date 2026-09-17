import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Empty,
  Grid,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Timeline,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import type { Appeal, AppealType, ProgressSource } from '@/types'
import { useWorkbench } from '@/store/useWorkbench'
import { NODE_SEQUENCE, STALL_DAYS } from '@/mock/data'
import {
  anomalyTypes,
  hasDueConflict,
  isOverdue,
  isStalled,
  lastUpdatedAt,
  nextNode,
  overdueDays,
  remainingDays,
} from '@/utils/derive'

const { useBreakpoint } = Grid
const OPERATOR = '张跟单'

const sourceColor: Record<ProgressSource, string> = {
  ERP同步: 'geekblue',
  工厂反馈: 'cyan',
  人工录入: 'green',
  AI提取: 'purple',
}

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const screens = useBreakpoint()
  const isMobile = !screens.lg
  const {
    orders,
    milestones,
    appeals,
    setMilestoneActual,
    confirmMilestone,
    addAppeal,
  } = useWorkbench()

  const [nodeId, setNodeId] = useState<string>()
  const [actualDate, setActualDate] = useState<dayjs.Dayjs>()
  const [source, setSource] = useState<ProgressSource>('工厂反馈')
  const [aiDate, setAiDate] = useState<dayjs.Dayjs>()
  const [appealTarget, setAppealTarget] = useState<AppealType>()
  const [appealValue, setAppealValue] = useState('撤销判定')
  const [appealReason, setAppealReason] = useState('')

  const order = orders.find((o) => o.id === id)

  const ms = useMemo(() => {
    if (!id) return []
    return milestones
      .filter((m) => m.orderId === id)
      .slice()
      .sort(
        (a, b) =>
          NODE_SEQUENCE.indexOf(a.name) - NODE_SEQUENCE.indexOf(b.name),
      )
  }, [milestones, id])

  const myAppeals = useMemo(
    () => appeals.filter((a) => a.orderId === id),
    [appeals, id],
  )

  if (!order) {
    return (
      <Card>
        <Empty description="订单不存在">
          <Link to="/">返回看板</Link>
        </Empty>
      </Card>
    )
  }

  const pendingMs = ms.filter((m) => m.status !== 'completed')
  const aiDrafts = ms.filter((m) => m.source === 'AI提取' && !m.actualDate)
  const lastAt = lastUpdatedAt(ms)

  const judgments: { type: AppealType; abnormal: boolean; text: string }[] = [
    {
      type: '逾期',
      abnormal: isOverdue(order),
      text: isOverdue(order) ? `已逾期 ${overdueDays(order)} 天` : '未逾期',
    },
    {
      type: '交期冲突',
      abnormal: hasDueConflict(order),
      text: hasDueConflict(order)
        ? `工厂承诺 ${order.factoryDue} 晚于客户希望 ${order.customerDue}`
        : '交期一致',
    },
    {
      type: '停滞',
      abnormal: isStalled(order, ms),
      text: isStalled(order, ms)
        ? `距上次更新已超过 ${STALL_DAYS} 天（${lastAt}）`
        : '更新正常',
    },
  ]

  const appealColumns: ColumnsType<Appeal> = [
    { title: '类型', dataIndex: 'type', width: 100, responsive: ['sm'] },
    { title: '自动判定', dataIndex: 'autoValue', width: 220, responsive: ['md'] },
    { title: '人工结论', dataIndex: 'humanValue', width: 120, responsive: ['sm'] },
    { title: '说明', dataIndex: 'reason', responsive: ['lg'] },
    { title: '处理人', dataIndex: 'handledBy', width: 100, responsive: ['md'] },
    { title: '处理时间', dataIndex: 'handledAt', width: 150, responsive: ['lg'] },
  ]

  const timelineItems = NODE_SEQUENCE.map((node) => {
    const m = ms.find((x) => x.name === node)
    if (!m) {
      return {
        color: 'gray',
        children: (
          <Space>
            <Typography.Text type="secondary">{node}</Typography.Text>
            <Tag>未开始</Tag>
          </Space>
        ),
      }
    }
    const color =
      m.status === 'completed' ? 'green' : m.status === 'delayed' ? 'red' : 'blue'
    return {
      color,
      children: (
        <Space direction="vertical" size={2}>
          <Space size={8}>
            <Typography.Text strong>{m.name}</Typography.Text>
            <Tag color={sourceColor[m.source]}>{m.source}</Tag>
            {m.status === 'delayed' && <Tag color="red">延期</Tag>}
          </Space>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            计划 {m.plannedDate} · 实际 {m.actualDate ?? '—'}
            {m.actualDate && m.actualDate > m.plannedDate
              ? `（延期 ${dayjs(m.actualDate).diff(dayjs(m.plannedDate), 'day')} 天）`
              : ''}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {m.updatedBy} 于 {m.updatedAt} 更新
          </Typography.Text>
        </Space>
      ),
    }
  })

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Space wrap>
        <Button onClick={() => navigate('/')}>返回看板</Button>
        <Typography.Title level={isMobile ? 5 : 4} style={{ margin: 0 }}>
          {order.orderNo}
        </Typography.Title>
        {anomalyTypes(order, ms).map((a) => (
          <Tag key={a} color="volcano">
            {a}
          </Tag>
        ))}
      </Space>

      {aiDrafts.map((m) => (
        <Alert
          key={m.id}
          type="warning"
          showIcon
          message={`节点「${m.name}」由 AI 从工厂邮件中提取，尚未生效`}
          description={
            <Space wrap style={{ marginTop: 8 }}>
              <Typography.Text type="secondary">
                计划日期 {m.plannedDate} · 置信度 0.82
              </Typography.Text>
              <DatePicker
                size="small"
                value={aiDate}
                onChange={(v) => setAiDate(v ?? undefined)}
                placeholder="确认实际日期"
              />
              <Button
                size="small"
                type="primary"
                disabled={!aiDate}
                onClick={() => {
                  if (!aiDate) return
                  setMilestoneActual(
                    m.id,
                    aiDate.format('YYYY-MM-DD'),
                    'AI提取',
                    OPERATOR,
                  )
                  setAiDate(undefined)
                }}
              >
                确认生效
              </Button>
              <Button
                size="small"
                onClick={() => confirmMilestone(m.id, OPERATOR)}
              >
                驳回，转人工录入
              </Button>
            </Space>
          }
        />
      ))}

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card title="基本信息">
            <Descriptions
              bordered
              size="small"
              column={{ xs: 1, sm: 2, md: 2 }}
            >
              <Descriptions.Item label="订单号">{order.orderNo}</Descriptions.Item>
              <Descriptions.Item label="客户订单号">
                {order.customerOrderNo}
              </Descriptions.Item>
              <Descriptions.Item label="供应商">{order.supplier}</Descriptions.Item>
              <Descriptions.Item label="SKU">
                {order.sku} · {order.skuName}
              </Descriptions.Item>
              <Descriptions.Item label="数量">
                {order.qty.toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="下单日">{order.orderDate}</Descriptions.Item>
              <Descriptions.Item label="客户希望交期">
                {order.customerDue}
                {remainingDays(order) >= 0 && `（剩余 ${remainingDays(order)} 天）`}
              </Descriptions.Item>
              <Descriptions.Item label="工厂承诺交期">
                {order.factoryDue}
              </Descriptions.Item>
              <Descriptions.Item label="计划船期">
                {order.planShipDate}
              </Descriptions.Item>
              <Descriptions.Item label="ERP 订单号">
                {order.erpOrderNo}
              </Descriptions.Item>
              <Descriptions.Item label="当前节点">
                <Tag color="blue">{order.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="风险等级">{order.riskLevel}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="自动判定" extra={<Typography.Text type="secondary">可申诉</Typography.Text>}>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              {judgments.map((j) => (
                <Card key={j.type} size="small">
                  <Space direction="vertical" size={4} style={{ width: '100%' }}>
                    <Space>
                      <Typography.Text strong>{j.type}</Typography.Text>
                      <Tag color={j.abnormal ? 'volcano' : 'default'}>
                        {j.abnormal ? '异常' : '正常'}
                      </Tag>
                    </Space>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {j.text}
                    </Typography.Text>
                    <Button
                      size="small"
                      type="link"
                      style={{ padding: 0 }}
                      onClick={() => setAppealTarget(j.type)}
                    >
                      申诉
                    </Button>
                  </Space>
                </Card>
              ))}
            </Space>
          </Card>
        </Col>
      </Row>

      <Card title="生产节点时间轴">
        <Timeline items={timelineItems} />
      </Card>

      <Card title="进度录入（人工确认后生效）">
        <Space wrap>
          <Select
            placeholder="选择节点"
            style={{ width: 160, maxWidth: '100%' }}
            value={nodeId}
            onChange={setNodeId}
            options={pendingMs.map((m) => ({ label: m.name, value: m.id }))}
          />
          <DatePicker
            value={actualDate}
            onChange={(v) => setActualDate(v ?? undefined)}
            placeholder="实际日期"
          />
          <Select
            style={{ width: 140, maxWidth: '100%' }}
            value={source}
            onChange={setSource}
            options={(
              ['工厂反馈', '人工录入', 'AI提取', 'ERP同步'] as ProgressSource[]
            ).map((s) => ({ label: s, value: s }))}
          />
          <Button
            type="primary"
            disabled={!nodeId || !actualDate}
            onClick={() => {
              if (!nodeId || !actualDate) return
              setMilestoneActual(
                nodeId,
                actualDate.format('YYYY-MM-DD'),
                source,
                OPERATOR,
              )
              setNodeId(undefined)
              setActualDate(undefined)
            }}
          >
            提交
          </Button>
          <Typography.Text type="secondary">
            {nextNode(order.status)
              ? `下一节点建议：${nextNode(order.status)}`
              : '已全部完成'}
          </Typography.Text>
        </Space>
      </Card>

      <Card title="人工申诉记录">
        <Table
          rowKey="id"
          size="small"
          scroll={{ x: 'max-content', y: 240 }}
          dataSource={myAppeals}
          columns={appealColumns}
          locale={{ emptyText: '暂无申诉记录' }}
          pagination={false}
        />
      </Card>

      <Modal
        open={!!appealTarget}
        title={`申诉：${appealTarget ?? ''}`}
        onCancel={() => setAppealTarget(undefined)}
        onOk={() => {
          if (!appealTarget) return
          const j = judgments.find((x) => x.type === appealTarget)
          addAppeal({
            orderId: order.id,
            type: appealTarget,
            autoValue: j?.text ?? '',
            humanValue: appealValue,
            reason: appealReason,
            operator: OPERATOR,
          })
          setAppealTarget(undefined)
          setAppealReason('')
        }}
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Typography.Text type="secondary">
            人工结论优先于自动判定，两者都会保留以便对照。
          </Typography.Text>
          <Select
            style={{ width: '100%' }}
            value={appealValue}
            onChange={setAppealValue}
            options={[
              { label: '撤销判定（认为不是异常）', value: '撤销判定' },
              { label: '维持判定（确认为异常）', value: '维持判定' },
            ]}
          />
          <Input.TextArea
            rows={3}
            placeholder="填写说明"
            value={appealReason}
            onChange={(e) => setAppealReason(e.target.value)}
          />
        </Space>
      </Modal>
    </Space>
  )
}
