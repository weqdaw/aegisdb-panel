// src/pages/LogsAudit.tsx
import { useState } from 'react';
import {
  Table,
  Card,
  Tag,
  Space,
  Input,
  Select,
  DatePicker,
  Button,
  Collapse,
  Switch,
  Form,
  InputNumber,
  Typography,
  Divider,
} from 'antd';
import { SearchOutlined, ReloadOutlined, SettingOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Panel } = Collapse;
const { Text } = Typography;

type LogLevel = 'INFO' | 'WARN' | 'DEBUG';
type LogSource = 'API' | 'Storage' | 'Raft' | 'Scheduler' | 'Security';
type Operation = 'GET' | 'PUT' | 'DELETE' | 'SCAN' | 'LOGIN' | 'CONFIG_UPDATE';

interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  source: LogSource;
  operation: Operation;
  user: string;
  ip: string;
  key?: string;
  result: 'SUCCESS' | 'FAILED';
  message: string;
  duration?: number; // ms
}

// 生成10条正常的日志数据
const generateLogs = (): LogEntry[] => {
  const now = Date.now();
  return [
    {
      id: '1',
      timestamp: dayjs(now - 5 * 60 * 1000).format('YYYY-MM-DD HH:mm:ss'),
      level: 'INFO',
      source: 'API',
      operation: 'GET',
      user: 'admin',
      ip: '192.168.1.100',
      key: 'user:profile:12345',
      result: 'SUCCESS',
      message: '成功获取用户配置信息',
      duration: 12,
    },
    {
      id: '2',
      timestamp: dayjs(now - 12 * 60 * 1000).format('YYYY-MM-DD HH:mm:ss'),
      level: 'INFO',
      source: 'Storage',
      operation: 'PUT',
      user: 'system',
      ip: '127.0.0.1',
      key: 'cache:session:abc123',
      result: 'SUCCESS',
      message: '数据写入热层存储完成',
      duration: 8,
    },
    {
      id: '3',
      timestamp: dayjs(now - 18 * 60 * 1000).format('YYYY-MM-DD HH:mm:ss'),
      level: 'INFO',
      source: 'Raft',
      operation: 'CONFIG_UPDATE',
      user: 'admin',
      ip: '192.168.1.100',
      result: 'SUCCESS',
      message: 'Raft 配置更新：心跳间隔调整为 500ms',
      duration: 45,
    },
    {
      id: '4',
      timestamp: dayjs(now - 25 * 60 * 1000).format('YYYY-MM-DD HH:mm:ss'),
      level: 'INFO',
      source: 'API',
      operation: 'SCAN',
      user: 'operator',
      ip: '192.168.1.105',
      key: 'region:001',
      result: 'SUCCESS',
      message: '扫描操作完成，返回 156 条记录',
      duration: 234,
    },
    {
      id: '5',
      timestamp: dayjs(now - 32 * 60 * 1000).format('YYYY-MM-DD HH:mm:ss'),
      level: 'INFO',
      source: 'Security',
      operation: 'LOGIN',
      user: 'admin',
      ip: '192.168.1.100',
      result: 'SUCCESS',
      message: '用户登录成功',
      duration: 156,
    },
    {
      id: '6',
      timestamp: dayjs(now - 38 * 60 * 1000).format('YYYY-MM-DD HH:mm:ss'),
      level: 'INFO',
      source: 'Storage',
      operation: 'PUT',
      user: 'system',
      ip: '127.0.0.1',
      key: 'metadata:region:002',
      result: 'SUCCESS',
      message: '元数据更新完成',
      duration: 6,
    },
    {
      id: '7',
      timestamp: dayjs(now - 45 * 60 * 1000).format('YYYY-MM-DD HH:mm:ss'),
      level: 'INFO',
      source: 'Scheduler',
      operation: 'CONFIG_UPDATE',
      user: 'admin',
      ip: '192.168.1.100',
      result: 'SUCCESS',
      message: '调度器配置更新：启用热区域检测',
      duration: 23,
    },
    {
      id: '8',
      timestamp: dayjs(now - 52 * 60 * 1000).format('YYYY-MM-DD HH:mm:ss'),
      level: 'INFO',
      source: 'API',
      operation: 'DELETE',
      user: 'operator',
      ip: '192.168.1.105',
      key: 'temp:cache:expired',
      result: 'SUCCESS',
      message: '删除过期缓存数据',
      duration: 9,
    },
    {
      id: '9',
      timestamp: dayjs(now - 58 * 60 * 1000).format('YYYY-MM-DD HH:mm:ss'),
      level: 'DEBUG',
      source: 'Raft',
      operation: 'GET',
      user: 'system',
      ip: '127.0.0.1',
      result: 'SUCCESS',
      message: 'Raft 日志同步完成，索引 123456',
      duration: 3,
    },
    {
      id: '10',
      timestamp: dayjs(now - 65 * 60 * 1000).format('YYYY-MM-DD HH:mm:ss'),
      level: 'INFO',
      source: 'Storage',
      operation: 'PUT',
      user: 'system',
      ip: '127.0.0.1',
      key: 'backup:checkpoint:20241201',
      result: 'SUCCESS',
      message: '检查点备份创建成功',
      duration: 1234,
    },
  ];
};

export default function LogsAudit() {
  const [logs] = useState<LogEntry[]>(generateLogs());
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>(logs);
  const [searchText, setSearchText] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [alertEnabled, setAlertEnabled] = useState(true);
  const [alertConfig, setAlertConfig] = useState({
    errorThreshold: 10,
    warningThreshold: 50,
    notificationEmail: 'admin@example.com',
    notificationWebhook: '',
  });

  // 过滤日志
  const handleFilter = () => {
    let filtered = [...logs];
    
    if (searchText) {
      filtered = filtered.filter(
        (log) =>
          log.message.toLowerCase().includes(searchText.toLowerCase()) ||
          log.user.toLowerCase().includes(searchText.toLowerCase()) ||
          log.key?.toLowerCase().includes(searchText.toLowerCase())
      );
    }
    
    if (levelFilter !== 'all') {
      filtered = filtered.filter((log) => log.level === levelFilter);
    }
    
    if (sourceFilter !== 'all') {
      filtered = filtered.filter((log) => log.source === sourceFilter);
    }
    
    setFilteredLogs(filtered);
  };

  const handleReset = () => {
    setSearchText('');
    setLevelFilter('all');
    setSourceFilter('all');
    setFilteredLogs(logs);
  };

  const getLevelColor = (level: LogLevel) => {
    switch (level) {
      case 'INFO':
        return 'blue';
      case 'WARN':
        return 'orange';
      case 'DEBUG':
        return 'default';
      default:
        return 'default';
    }
  };

  const getResultColor = (result: string) => {
    return result === 'SUCCESS' ? 'green' : 'red';
  };

  const columns = [
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 180,
      sorter: (a: LogEntry, b: LogEntry) =>
        dayjs(a.timestamp).unix() - dayjs(b.timestamp).unix(),
    },
    {
      title: '级别',
      dataIndex: 'level',
      key: 'level',
      width: 100,
      render: (level: LogLevel) => (
        <Tag color={getLevelColor(level)}>{level}</Tag>
      ),
    },
    {
      title: '来源',
      dataIndex: 'source',
      key: 'source',
      width: 120,
    },
    {
      title: '操作',
      dataIndex: 'operation',
      key: 'operation',
      width: 120,
    },
    {
      title: '用户',
      dataIndex: 'user',
      key: 'user',
      width: 100,
    },
    {
      title: 'IP地址',
      dataIndex: 'ip',
      key: 'ip',
      width: 140,
    },
    {
      title: 'Key',
      dataIndex: 'key',
      key: 'key',
      width: 200,
      ellipsis: true,
    },
    {
      title: '结果',
      dataIndex: 'result',
      key: 'result',
      width: 100,
      render: (result: string) => (
        <Tag color={getResultColor(result)}>{result}</Tag>
      ),
    },
    {
      title: '耗时(ms)',
      dataIndex: 'duration',
      key: 'duration',
      width: 100,
      render: (duration?: number) => (duration ? `${duration}` : '-'),
    },
    {
      title: '消息',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
    },
  ];

  return (
    <div>
      <Card title="日志与审计" style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          {/* 搜索和过滤区域 */}
          <Space wrap>
            <Input
              placeholder="搜索日志内容、用户或Key"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 300 }}
              onPressEnter={handleFilter}
            />
            <Select
              placeholder="日志级别"
              value={levelFilter}
              onChange={setLevelFilter}
              style={{ width: 120 }}
            >
              <Select.Option value="all">全部级别</Select.Option>
              <Select.Option value="INFO">INFO</Select.Option>
              <Select.Option value="WARN">WARN</Select.Option>
              <Select.Option value="DEBUG">DEBUG</Select.Option>
            </Select>
            <Select
              placeholder="来源"
              value={sourceFilter}
              onChange={setSourceFilter}
              style={{ width: 150 }}
            >
              <Select.Option value="all">全部来源</Select.Option>
              <Select.Option value="API">API</Select.Option>
              <Select.Option value="Storage">Storage</Select.Option>
              <Select.Option value="Raft">Raft</Select.Option>
              <Select.Option value="Scheduler">Scheduler</Select.Option>
              <Select.Option value="Security">Security</Select.Option>
            </Select>
            <Button type="primary" icon={<SearchOutlined />} onClick={handleFilter}>
              搜索
            </Button>
            <Button icon={<ReloadOutlined />} onClick={handleReset}>
              重置
            </Button>
          </Space>

          {/* 日志表格 */}
          <Table
            columns={columns}
            dataSource={filteredLogs}
            rowKey="id"
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条日志`,
            }}
            scroll={{ x: 1400 }}
          />
        </Space>
      </Card>

      {/* 告警配置 */}
      <Card
        title={
          <Space>
            <SettingOutlined />
            <span>告警配置</span>
          </Space>
        }
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div>
            <Space>
              <Text strong>启用告警通知：</Text>
              <Switch
                checked={alertEnabled}
                onChange={setAlertEnabled}
                checkedChildren="开启"
                unCheckedChildren="关闭"
              />
            </Space>
          </div>

          {alertEnabled && (
            <>
              <Divider style={{ margin: '8px 0' }} />
              <Form layout="vertical" style={{ maxWidth: 600 }}>
                <Form.Item label="错误日志阈值（条/小时）">
                  <InputNumber
                    value={alertConfig.errorThreshold}
                    onChange={(value) =>
                      setAlertConfig({ ...alertConfig, errorThreshold: value || 0 })
                    }
                    min={1}
                    style={{ width: '100%' }}
                  />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    当错误日志数量超过此阈值时触发告警
                  </Text>
                </Form.Item>

                <Form.Item label="警告日志阈值（条/小时）">
                  <InputNumber
                    value={alertConfig.warningThreshold}
                    onChange={(value) =>
                      setAlertConfig({ ...alertConfig, warningThreshold: value || 0 })
                    }
                    min={1}
                    style={{ width: '100%' }}
                  />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    当警告日志数量超过此阈值时触发告警
                  </Text>
                </Form.Item>

                <Form.Item label="通知邮箱">
                  <Input
                    value={alertConfig.notificationEmail}
                    onChange={(e) =>
                      setAlertConfig({ ...alertConfig, notificationEmail: e.target.value })
                    }
                    placeholder="admin@example.com"
                  />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    告警通知将发送到此邮箱
                  </Text>
                </Form.Item>

                <Form.Item>
                  <Button type="primary" onClick={() => console.log('保存配置', alertConfig)}>
                    保存配置
                  </Button>
                </Form.Item>
              </Form>
            </>
          )}
        </Space>
      </Card>
    </div>
  );
}