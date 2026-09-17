import React from 'react'
import {
  Alert,
  Card,
  Col,
  List,
  Progress,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { TableProps } from 'antd'
import { useWorkbench } from '@/store/useWorkbench'
import {
  buildFlows,
  collectAlerts,
  flowStats,
  type FlowStage,
  type StageStatus,
  type TrackingFlow,
} from '@/utils/flow'

const { Title, Paragraph, Text } = Typography

const STAGE_COLOR: Record<StageStatus, string> = {
  done: '#52c41a',
  active: '#1677ff',
  blocked: '#ff4d4f',
  pending: '#faad14',
  'n/a': '#bfbfbf',
}
const STAGE_LABEL: Record<StageStatus, string> = {
  done: '已完成',
  active: '进行中',
  blocked: '受阻',
  pending: '待处理',
  'n/a': '不适用',
}
const RISK_META: Record<TrackingFlow['risk'], { color: string; text: string }> = {
  high: { color: 'error', text: '高风险' },
  mid: { color: 'warning', text: '关注' },
  low: { color: 'success', text: '正常' },
}

function StagePills({ stages }: { stages: FlowStage[] }) {
  return (
    <Space size={4} wrap>
      {stages.map((s, i) => {
        const c = STAGE_COLOR[s.status]
        return (
          <React.Fragment key={s.key}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 12,
                padding: '2px 8px',
                borderRadius: 10,
                background: `${c}1f`,
                color: c,
                border: `1px solid ${c}55`,
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: c }} />
              {s.name}
              {s.status === 'done' ? '✓' : ''}
            </span>
            {i < stages.length - 1 && <Text type="secondary">›</Text>}
          </React.Fragment>
        )
      })}
    </Space>
  )
}

export default function Flow() {
  const products = useWorkbench((s) => s.products)
  const contracts = useWorkbench((s) => s.contracts)
  const shipments = useWorkbench((s) => s.shipments)
  const logistics = useWorkbench((s) => s.logistics)
  const invoices = useWorkbench((s) => s.invoices)
  const orders = useWorkbench((s) => s.orders)

  const flows = buildFlows({ products, contracts, shipments, logistics, invoices, orders })
  const stats = flowStats(flows)
  const alerts = collectAlerts(flows)

  const columns: TableProps<TrackingFlow>['columns'] = [
    { title: 'SKU', dataIndex: 'sku', fixed: 'left', width: 110 },
    { title: '产品', dataIndex: 'skuName' },
    { title: '供应商', dataIndex: 'supplier', responsive: ['md'] },
    {
      title: '流程编排',
      responsive: ['sm'],
      render: (_: unknown, r: TrackingFlow) => <StagePills stages={r.stages} />,
    },
    {
      title: '当前阶段',
      width: 110,
      render: (_: unknown, r: TrackingFlow) => {
        const cur = r.stages[r.currentStageIdx]
        return cur ? cur.name : '已闭环'
      },
    },
    {
      title: '进度',
      width: 120,
      render: (_: unknown, r: TrackingFlow) => (
        <Progress percent={r.progress} size="small" status={r.risk === 'high' ? 'exception' : 'normal'} />
      ),
    },
    {
      title: '风险',
      width: 90,
      render: (_: unknown, r: TrackingFlow) => (
        <Tag color={RISK_META[r.risk].color}>{RISK_META[r.risk].text}</Tag>
      ),
    },
    {
      title: '异常',
      width: 80,
      render: (_: unknown, r: TrackingFlow) =>
        r.anomalies.length > 0 ? (
          <Tag color="red">{r.anomalies.length} 项</Tag>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
  ]

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div>
        <Title level={4} style={{ marginBottom: 4 }}>
          流程编排看板
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          以 SKU 为单位串联「备货 → 出货确认 → 报关物流 → 财务对账」主链路，阶段状态由底层业务数据自动推导；标红项触发 SLA 异常预警，自动给出下一步动作建议。
        </Paragraph>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="在跟产品" value={stats.total} suffix="款" />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="流程已闭环" value={stats.done} suffix="款" valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="进行中" value={stats.inProgress} suffix="款" valueStyle={{ color: '#1677ff' }} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="SLA 异常" value={stats.alerts} suffix="款" valueStyle={{ color: stats.alerts ? '#cf1322' : '#000' }} />
          </Card>
        </Col>
      </Row>

      {alerts.length > 0 && (
        <Alert
          type="error"
          showIcon
          message={`SLA 异常预警 · 共 ${alerts.length} 款需要关注`}
          description={
            <List
              size="small"
              dataSource={alerts}
              renderItem={(f) => (
                <List.Item>
                  <Space direction="vertical" size={2} style={{ width: '100%' }}>
                    <Space size={6} wrap>
                      <Tag color="red">{f.sku}</Tag>
                      <Text strong>{f.skuName}</Text>
                      <Text type="secondary">{f.nextAction}</Text>
                    </Space>
                    <div>
                      {f.anomalies.map((a, i) => (
                        <Tag key={i} color="volcano">
                          {a}
                        </Tag>
                      ))}
                    </div>
                  </Space>
                </List.Item>
              )}
            />
          }
        />
      )}

      <Card title="跟单流程编排" styles={{ body: { padding: 0 } }}>
        <Table<TrackingFlow>
          rowKey="sku"
          size="middle"
          columns={columns}
          dataSource={flows}
          scroll={{ x: 900, y: 'calc(100vh - 480px)' }}
          pagination={false}
          expandable={{
            expandedRowRender: (r) => (
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <div>
                  <Text strong>流程进度：</Text>
                  <Text>{r.progress}%</Text>
                  <Text type="secondary">（当前阶段：{r.stages[r.currentStageIdx]?.name ?? '已闭环'}）</Text>
                </div>
                <div>
                  <Text strong>阶段明细：</Text>
                  <Space direction="vertical" size={2} style={{ marginTop: 4 }}>
                    {r.stages.map((s) => (
                      <div key={s.key}>
                        <Tag color={STAGE_COLOR[s.status]} style={{ width: 64, textAlign: 'center' }}>
                          {STAGE_LABEL[s.status]}
                        </Tag>
                        <Text>{s.name}</Text>
                        {s.due && <Text type="secondary"> · 截止 {s.due}</Text>}
                        {s.note && <Text type="secondary"> · {s.note}</Text>}
                      </div>
                    ))}
                  </Space>
                </div>
                {r.anomalies.length > 0 && (
                  <div>
                    <Text strong>SLA 异常：</Text>
                    {r.anomalies.map((a, i) => (
                      <Tag key={i} color="volcano">
                        {a}
                      </Tag>
                    ))}
                  </div>
                )}
                <div>
                  <Text strong>下一步建议：</Text>
                  <Text strong style={{ color: '#1677ff' }}>
                    {r.nextAction}
                  </Text>
                </div>
              </Space>
            ),
          }}
        />
      </Card>
    </Space>
  )
}
