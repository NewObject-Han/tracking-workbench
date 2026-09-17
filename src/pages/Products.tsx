import { useState } from 'react'
import {
  Card,
  Table,
  Tag,
  Button,
  Modal,
  Select,
  Input,
  message,
  Typography,
  Space,
} from 'antd'
import type { TableProps } from 'antd'
import { useWorkbench } from '@/store/useWorkbench'
import type { Lifecycle, Product, ProductComm } from '@/types'

const { Title, Paragraph, Text } = Typography

const lifeColor: Record<Lifecycle, string> = {
  首单: 'blue',
  翻单: 'green',
  废番: 'default',
}

export default function Products() {
  const products = useWorkbench((s) => s.products)
  const comms = useWorkbench((s) => s.productComms)
  const addComm = useWorkbench((s) => s.addComm)

  const [selected, setSelected] = useState<string>(products[0]?.id ?? '')
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<Lifecycle | '其他'>('首单')
  const [content, setContent] = useState('')
  const [owner, setOwner] = useState('张跟单')

  const selProduct = products.find((p) => p.id === selected)
  const selComms = comms.filter((c) => c.productId === selected)

  const openModal = () => {
    setType('首单')
    setContent('')
    setOwner('张跟单')
    setOpen(true)
  }
  const submit = () => {
    if (!selProduct) return
    if (!content.trim()) {
      message.warning('请填写沟通内容')
      return
    }
    addComm({ productId: selProduct.id, sku: selProduct.sku, type, content, owner })
    message.success('沟通记录已添加')
    setOpen(false)
  }

  const columns: TableProps<Product>['columns'] = [
    { title: 'SKU', dataIndex: 'sku', fixed: 'left', width: 110 },
    { title: '产品', dataIndex: 'skuName' },
    { title: '供应商', dataIndex: 'supplier', responsive: ['md'] },
    {
      title: '生命周期',
      dataIndex: 'lifecycle',
      render: (v: Lifecycle) => <Tag color={lifeColor[v]}>{v}</Tag>,
    },
    {
      title: '月销量',
      dataIndex: 'monthlySales',
      responsive: ['sm'],
      render: (v: number) => v.toLocaleString(),
    },
    {
      title: '日本库存',
      dataIndex: 'jpStock',
      responsive: ['sm'],
      render: (v: number) => v.toLocaleString(),
    },
  ]

  const commColumns: TableProps<ProductComm>['columns'] = [
    {
      title: '类型',
      dataIndex: 'type',
      width: 90,
      render: (v: ProductComm['type']) => (
        <Tag color={v === '废番' ? 'default' : v === '首单' ? 'blue' : 'green'}>{v}</Tag>
      ),
    },
    { title: '沟通内容', dataIndex: 'content', ellipsis: true },
    { title: '日期', dataIndex: 'date', width: 110, responsive: ['sm'] },
    { title: '跟进人', dataIndex: 'owner', width: 90, responsive: ['md'] },
  ]

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div>
        <Title level={4} style={{ marginBottom: 4 }}>
          产品与翻单沟通
        </Title>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          维护产品生命周期（首单 / 翻单 / 废番），并记录与客户的跟单沟通，包括首单下单、产品翻单、废番等问题。
        </Paragraph>
      </div>
      <Card title="产品主数据（点击行查看沟通记录）" styles={{ body: { padding: 0 } }}>
        <Table
          rowKey="id"
          size="middle"
          columns={columns}
          dataSource={products}
          scroll={{ x: 720, y: 'calc(100vh - 400px)' }}
          pagination={false}
          rowClassName={(r) => (r.id === selected ? 'ant-table-row-selected' : '')}
          onRow={(r) => ({ onClick: () => setSelected(r.id), style: { cursor: 'pointer' } })}
        />
      </Card>
      <Card
        title={
          selProduct
            ? `沟通记录 · ${selProduct.sku} ${selProduct.skuName}`
            : '沟通记录'
        }
        extra={
          <Button type="primary" size="small" onClick={openModal} disabled={!selProduct}>
            新增沟通
          </Button>
        }
      >
        {selComms.length === 0 ? (
          <Text type="secondary">该产品暂无沟通记录，点击右上角「新增沟通」添加。</Text>
        ) : (
          <Table
            rowKey="id"
            size="middle"
            columns={commColumns}
            dataSource={selComms}
            pagination={false}
            scroll={{ x: 560, y: 220 }}
          />
        )}
      </Card>
      <Modal
        title="新增沟通记录"
        open={open}
        onOk={submit}
        onCancel={() => setOpen(false)}
        okText="保存"
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <div>
            <Text>沟通类型：</Text>
            <Select
              style={{ width: '100%' }}
              value={type}
              onChange={setType}
              options={[
                { value: '首单', label: '首单' },
                { value: '翻单', label: '翻单' },
                { value: '废番', label: '废番' },
                { value: '其他', label: '其他' },
              ]}
            />
          </div>
          <div>
            <Text>沟通内容：</Text>
            <Input.TextArea
              rows={3}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="如：客户追加翻单 5000，交期要求 10 月底"
            />
          </div>
          <div>
            <Text>跟进人：</Text>
            <Input value={owner} onChange={(e) => setOwner(e.target.value)} />
          </div>
        </Space>
      </Modal>
    </Space>
  )
}
