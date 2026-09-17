import { useState } from 'react'
import {
  Button,
  Card,
  Col,
  Empty,
  Input,
  List,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type {
  AppNotification,
  PendingAction,
  Rule,
  RuleAction,
  RuleCondition,
  RuleExecution,
  RuleTrigger,
} from '@/types'
import { useWorkbench } from '@/store/useWorkbench'
import {
  ACTION_LABEL,
  TRIGGER_LABEL,
  conditionText,
} from '@/utils/rules'

const { Title, Paragraph, Text } = Typography

const TRIGGER_OPTIONS = (Object.keys(TRIGGER_LABEL) as RuleTrigger[]).map((k) => ({
  value: k,
  label: TRIGGER_LABEL[k],
}))
const ACTION_OPTIONS = (Object.keys(ACTION_LABEL) as RuleAction[]).map((k) => ({
  value: k,
  label: ACTION_LABEL[k],
}))
const COND_FIELD_OPTIONS = [
  { value: '', label: '不限' },
  { value: 'supplier', label: '供应商' },
  { value: 'lifecycle', label: '生命周期' },
  { value: 'sku', label: 'SKU' },
]
const COND_OP_OPTIONS = [
  { value: 'eq', label: '等于 (=)' },
  { value: 'neq', label: '不等于 (≠)' },
  { value: 'in', label: '属于 (∈, 逗号分隔)' },
]
const LEVEL_META: Record<AppNotification['level'], { color: string; text: string }> = {
  info: { color: 'blue', text: '提示' },
  warning: { color: 'orange', text: '预警' },
  error: { color: 'red', text: '严重' },
}
const STATUS_META: Record<RuleExecution['status'], { color: string }> = {
  executed: { color: 'success' },
  pending: { color: 'gold' },
  skipped: { color: 'default' },
}

interface RuleFormState {
  name: string
  trigger: RuleTrigger
  action: RuleAction
  condField: string
  condOp: 'eq' | 'neq' | 'in'
  condValue: string
  autoExecute: boolean
  enabled: boolean
}

const emptyForm = (): RuleFormState => ({
  name: '',
  trigger: 'REPLENISH_SUGGESTED',
  action: 'CREATE_CONTRACT',
  condField: '',
  condOp: 'eq',
  condValue: '',
  autoExecute: false,
  enabled: true,
})

export default function Rules() {
  const rules = useWorkbench((s) => s.rules)
  const ruleLog = useWorkbench((s) => s.ruleLog)
  const pendingActions = useWorkbench((s) => s.pendingActions)
  const notifications = useWorkbench((s) => s.notifications)
  const runRules = useWorkbench((s) => s.runRules)
  const executePending = useWorkbench((s) => s.executePending)
  const addRule = useWorkbench((s) => s.addRule)
  const updateRule = useWorkbench((s) => s.updateRule)
  const deleteRule = useWorkbench((s) => s.deleteRule)
  const toggleRule = useWorkbench((s) => s.toggleRule)
  const clearPending = useWorkbench((s) => s.clearPending)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<RuleFormState>(emptyForm())

  const enabledCount = rules.filter((r) => r.enabled).length
  const executedCount = ruleLog.filter((l) => l.status === 'executed').length

  const openAdd = () => {
    setEditingId(null)
    setForm(emptyForm())
    setModalOpen(true)
  }
  const openEdit = (r: Rule) => {
    setEditingId(r.id)
    setForm({
      name: r.name,
      trigger: r.trigger,
      action: r.action,
      condField: r.condition?.field ?? '',
      condOp: r.condition?.op ?? 'eq',
      condValue: Array.isArray(r.condition?.value)
        ? r.condition.value.join(',')
        : (r.condition?.value ?? ''),
      autoExecute: r.autoExecute,
      enabled: r.enabled,
    })
    setModalOpen(true)
  }

  const save = () => {
    if (!form.name.trim()) {
      message.warning('请填写规则名称')
      return
    }
    const condition: RuleCondition | undefined =
      form.condField && form.condValue.trim()
        ? {
            field: form.condField as RuleCondition['field'],
            op: form.condOp,
            value: form.condOp === 'in' ? form.condValue.split(',').map((v) => v.trim()).filter(Boolean) : form.condValue.trim(),
          }
        : undefined
    if (editingId) {
      updateRule(editingId, {
        name: form.name.trim(),
        trigger: form.trigger,
        action: form.action,
        condition,
        autoExecute: form.autoExecute,
        enabled: form.enabled,
      })
      message.success('规则已更新')
    } else {
      addRule({
        name: form.name.trim(),
        trigger: form.trigger,
        action: form.action,
        condition,
        autoExecute: form.autoExecute,
        enabled: form.enabled,
      })
      message.success('规则已新增')
    }
    setModalOpen(false)
  }

  const onRun = () => {
    runRules()
    message.success('规则引擎已运行')
  }

  const ruleColumns: ColumnsType<Rule> = [
    { title: '规则名称', dataIndex: 'name' },
    {
      title: '触发条件',
      dataIndex: 'trigger',
      responsive: ['md'],
      render: (t: RuleTrigger) => <Tag>{TRIGGER_LABEL[t]}</Tag>,
    },
    {
      title: '执行动作',
      dataIndex: 'action',
      responsive: ['md'],
      render: (a: RuleAction) => ACTION_LABEL[a],
    },
    {
      title: '条件',
      responsive: ['lg'],
      render: (_: unknown, r: Rule) => conditionText(r.condition),
    },
    {
      title: '自动执行',
      width: 90,
      render: (_: unknown, r: Rule) => (
        <Switch
          size="small"
          checked={r.autoExecute}
          onChange={(v) => updateRule(r.id, { autoExecute: v })}
        />
      ),
    },
    {
      title: '启用',
      width: 80,
      render: (_: unknown, r: Rule) => (
        <Switch size="small" checked={r.enabled} onChange={() => toggleRule(r.id)} />
      ),
    },
    {
      title: '操作',
      width: 120,
      render: (_: unknown, r: Rule) => (
        <Space>
          <Button type="link" size="small" onClick={() => openEdit(r)}>
            编辑
          </Button>
          <Popconfirm title="确认删除该规则？" onConfirm={() => deleteRule(r.id)}>
            <Button type="link" size="small" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const pendingColumns: ColumnsType<PendingAction> = [
    { title: '规则', dataIndex: 'ruleName' },
    { title: '对象', dataIndex: 'targetName' },
    {
      title: '动作',
      dataIndex: 'action',
      render: (a: RuleAction) => ACTION_LABEL[a],
    },
    { title: '说明', dataIndex: 'message' },
    {
      title: '操作',
      width: 90,
      render: (_: unknown, p: PendingAction) => (
        <Button
          type="link"
          size="small"
          onClick={() => {
            executePending(p.ruleId, p.target)
            message.success('已执行')
          }}
        >
          执行
        </Button>
      ),
    },
  ]

  const logColumns: ColumnsType<RuleExecution> = [
    { title: '规则', dataIndex: 'ruleName', responsive: ['sm'] },
    { title: '对象', dataIndex: 'targetName', responsive: ['md'] },
    {
      title: '动作',
      dataIndex: 'action',
      render: (a: RuleAction) => ACTION_LABEL[a],
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (s: RuleExecution['status']) => (
        <Tag color={STATUS_META[s].color}>
          {s === 'executed' ? '已执行' : s === 'pending' ? '待执行' : '跳过'}
        </Tag>
      ),
    },
    { title: '说明', dataIndex: 'message', responsive: ['md'] },
    { title: '时间', dataIndex: 'at', responsive: ['lg'], width: 170 },
  ]

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div>
        <Title level={4} style={{ marginBottom: 4 }}>
          自定义规则引擎
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          以「当（触发条件）满足时 → 执行（动作）」配置自动化策略。开启「自动执行」的规则匹配后立即生效；关闭则进入「待执行」队列，可逐条人工确认。引擎基于实时业务数据求值，天然幂等（同一对象不重复触发）。
        </Paragraph>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="启用规则" value={enabledCount} suffix={`/ ${rules.length}`} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="待执行动作" value={pendingActions.length} valueStyle={{ color: pendingActions.length ? '#cf1322' : '#000' }} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="累计执行" value={executedCount} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Button type="primary" block onClick={onRun}>
                运行规则引擎
              </Button>
              <Button block onClick={openAdd}>
                新增规则
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card title="规则列表" styles={{ body: { padding: 0 } }}>
        <Table<Rule>
          rowKey="id"
          size="middle"
          columns={ruleColumns}
          dataSource={rules}
          scroll={{ x: 800, y: 220 }}
          pagination={false}
        />
      </Card>

      <Card
        title={`待执行动作（${pendingActions.length}）`}
        extra={
          pendingActions.length > 0 ? (
            <Button size="small" onClick={clearPending}>
              清空
            </Button>
          ) : null
        }
        styles={{ body: { padding: 0 } }}
      >
        {pendingActions.length === 0 ? (
          <Empty description="暂无待执行动作，运行规则引擎后将在此列出" style={{ padding: 24 }} />
        ) : (
          <Table<PendingAction>
            rowKey={(r) => `${r.ruleId}-${r.target}`}
            size="small"
            columns={pendingColumns}
            dataSource={pendingActions}
            scroll={{ x: 700, y: 170 }}
            pagination={false}
          />
        )}
      </Card>

      <Card title={`提醒中心（${notifications.length}）`} styles={{ body: { padding: 0 } }}>
        {notifications.length === 0 ? (
          <Empty description="暂无提醒" style={{ padding: 24 }} />
        ) : (
          <List
            size="small"
            dataSource={notifications}
            renderItem={(n) => (
              <List.Item>
                <Space direction="vertical" size={2} style={{ width: '100%' }}>
                  <Space size={6} wrap>
                    <Tag color={LEVEL_META[n.level].color}>{LEVEL_META[n.level].text}</Tag>
                    <Text strong>{n.title}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {n.at}
                    </Text>
                  </Space>
                  <Text type="secondary">{n.desc}</Text>
                </Space>
              </List.Item>
            )}
          />
        )}
      </Card>

      <Card title="执行日志" styles={{ body: { padding: 0 } }}>
        <Table<RuleExecution>
          rowKey="id"
          size="small"
          columns={logColumns}
          dataSource={ruleLog}
          scroll={{ x: 800, y: 170 }}
          pagination={{ pageSize: 8 }}
          locale={{ emptyText: '尚未运行规则引擎' }}
        />
      </Card>

      <Modal
        title={editingId ? '编辑规则' : '新增规则'}
        open={modalOpen}
        onOk={save}
        onCancel={() => setModalOpen(false)}
        okText="保存"
        destroyOnClose
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <div>
            <Text>规则名称</Text>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="例如：备货建议自动建合同"
            />
          </div>
          <div>
            <Text>触发条件（WHEN）</Text>
            <Select
              style={{ width: '100%' }}
              value={form.trigger}
              options={TRIGGER_OPTIONS}
              onChange={(v) => setForm({ ...form, trigger: v })}
            />
          </div>
          <div>
            <Text>执行动作（THEN）</Text>
            <Select
              style={{ width: '100%' }}
              value={form.action}
              options={ACTION_OPTIONS}
              onChange={(v) => setForm({ ...form, action: v })}
            />
          </div>
          <div>
            <Text>前置条件（可选，为空=全部）</Text>
            <Space direction="vertical" size={6} style={{ width: '100%' }}>
              <Select
                style={{ width: '100%' }}
                value={form.condField}
                options={COND_FIELD_OPTIONS}
                onChange={(v) => setForm({ ...form, condField: v })}
              />
              {form.condField && (
                <>
                  <Select
                    style={{ width: '100%' }}
                    value={form.condOp}
                    options={COND_OP_OPTIONS}
                    onChange={(v) => setForm({ ...form, condOp: v })}
                  />
                  <Input
                    value={form.condValue}
                    onChange={(e) => setForm({ ...form, condValue: e.target.value })}
                    placeholder="值（in 时多个用逗号分隔，如 翻单,首单）"
                  />
                </>
              )}
            </Space>
          </div>
          <Space>
            <Text>自动执行</Text>
            <Switch
              checked={form.autoExecute}
              onChange={(v) => setForm({ ...form, autoExecute: v })}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              （关=进入待执行队列）
            </Text>
          </Space>
          <Space>
            <Text>启用</Text>
            <Switch
              checked={form.enabled}
              onChange={(v) => setForm({ ...form, enabled: v })}
            />
          </Space>
        </Space>
      </Modal>
    </Space>
  )
}
