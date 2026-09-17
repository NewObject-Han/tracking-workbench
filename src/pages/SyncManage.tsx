import { Button, Card, Col, Progress, Row, Space, Table, Tag, Typography, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { SyncFailure, SyncLogEntry, SyncTask } from '@/types'
import { useWorkbench } from '@/store/useWorkbench'

const statusMeta: Record<SyncTask['status'], { text: string; color: string }> = {
  idle: { text: '待运行', color: 'default' },
  running: { text: '同步中', color: 'processing' },
  success: { text: '成功', color: 'success' },
  partial: { text: '部分失败', color: 'warning' },
  failed: { text: '失败', color: 'error' },
}

const dirMeta: Record<SyncLogEntry['dir'], { text: string; color: string }> = {
  pull: { text: '拉取', color: 'blue' },
  push: { text: '回写', color: 'green' },
}

export default function SyncManage() {
  const { syncTasks, runSync, retryFailure, pullFromKingdee, syncLog } = useWorkbench()

  const onPull = () => {
    pullFromKingdee()
    message.success('已从金蝶云星空拉取最新单据')
  }

  const makeFailureColumns = (taskId: string): ColumnsType<SyncFailure> => [
    { title: '业务主键', dataIndex: 'bizKey', width: 200 },
    { title: '失败原因', dataIndex: 'reason' },
    {
      title: '操作',
      width: 100,
      render: (_, f) => (
        <Button size="small" type="link" onClick={() => retryFailure(taskId, f.id)}>
          重试
        </Button>
      ),
    },
  ]

  const logColumns: ColumnsType<SyncLogEntry> = [
    {
      title: '方向',
      dataIndex: 'dir',
      width: 80,
      render: (d: SyncLogEntry['dir']) => <Tag color={dirMeta[d].color}>{dirMeta[d].text}</Tag>,
    },
    { title: 'FormId', dataIndex: 'formId', width: 180, render: (v: string) => <Typography.Text code>{v}</Typography.Text> },
    { title: '描述', dataIndex: 'desc' },
    { title: '时间', dataIndex: 'at', width: 180 },
    {
      title: '结果',
      dataIndex: 'ok',
      width: 80,
      render: (ok: boolean) => <Tag color={ok ? 'success' : 'error'}>{ok ? '成功' : '失败'}</Tag>,
    },
  ]

  const pushCount = syncLog.filter((l) => l.dir === 'push').length
  const pullCount = syncLog.filter((l) => l.dir === 'pull').length
  const lastPull = syncLog.find((l) => l.dir === 'pull')

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div>
        <Typography.Title level={4} style={{ marginBottom: 4 }}>
          金蝶双向同步中心
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          同步方向：金蝶云星空 ↔ 跟单工作台。
          <Typography.Text strong>拉取</Typography.Text>（pull）从金蝶 WebAPI 刷新物料 / 供应商 / 采购 / 发货 / 应付 / 出库单据；
          <Typography.Text strong>回写</Typography.Text>（push）在跟单动作发生时自动将「采购订单 / 出货确认 / 付款 / 物流状态」写回对应金蝶单据。
        </Typography.Paragraph>
      </div>

      <Row gutter={16}>
        <Col xs={24} sm={8}>
          <Card>
            <Typography.Text type="secondary">累计回写金蝶</Typography.Text>
            <div style={{ fontSize: 28, fontWeight: 600, color: '#52c41a' }}>{pushCount} 次</div>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Typography.Text type="secondary">累计拉取</Typography.Text>
            <div style={{ fontSize: 28, fontWeight: 600, color: '#1677ff' }}>{pullCount} 次</div>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Typography.Text type="secondary">最近拉取</Typography.Text>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{lastPull?.at ?? '尚未拉取'}</div>
          </Card>
        </Col>
      </Row>

      <Button type="primary" onClick={onPull}>
        立即从金蝶拉取最新单据
      </Button>

      <Row gutter={[16, 16]}>
        {syncTasks.map((t) => {
          const total = t.successCount + t.failedCount
          const percent = total === 0 ? 0 : Math.round((t.successCount / total) * 100)
          return (
            <Col xs={24} sm={12} lg={8} key={t.id}>
              <Card
                title={t.object}
                extra={<Tag color={statusMeta[t.status].color}>{statusMeta[t.status].text}</Tag>}
              >
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    FormId：{t.formId}
                  </Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    上次同步：{t.lastRunAt}
                  </Typography.Text>
                  <Progress percent={percent} size="small" />
                  <Space>
                    <Tag color="success">成功 {t.successCount}</Tag>
                    <Tag color={t.failedCount > 0 ? 'error' : 'default'}>失败 {t.failedCount}</Tag>
                  </Space>
                  <Button size="small" loading={t.status === 'running'} onClick={() => runSync(t.id)}>
                    触发同步
                  </Button>
                </Space>
              </Card>
            </Col>
          )
        })}
      </Row>

      {syncTasks
        .filter((t) => t.failures.length > 0)
        .map((t) => (
          <Card key={t.id} title={`失败明细 · ${t.object}`}>
            <Table
              scroll={{ x: 'max-content', y: 200 }}
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={t.failures}
              columns={makeFailureColumns(t.id)}
            />
          </Card>
        ))}

      <Card title="同步日志（拉取 / 回写）" styles={{ body: { padding: 0 } }}>
        <Table
          scroll={{ x: 'max-content', y: 'calc(100vh - 520px)' }}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 8 }}
          dataSource={syncLog}
          columns={logColumns}
          locale={{ emptyText: '暂无同步记录，尝试「立即从金蝶拉取」或执行跟单动作' }}
        />
      </Card>
    </Space>
  )
}
