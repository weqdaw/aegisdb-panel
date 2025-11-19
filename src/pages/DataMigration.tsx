import { useState, useEffect } from 'react';
import { Card, Input, Button, Progress, Statistic, Alert, Space, Divider, Typography, Tag } from 'antd';
import { SwapOutlined, DatabaseOutlined, CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined, InfoCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

type MigrationProgress = {
  total: number;
  migrated: number;
  failed: number;
  status: 'idle' | 'running' | 'completed' | 'error';
  error?: string;
  startTime?: number;
  currentSpeed?: number; // 每秒迁移数量
};

export default function DataMigration() {
  const [redisUrl, setRedisUrl] = useState('redis://127.0.0.1:6379');
  const [prefix, setPrefix] = useState('');
  const [progress, setProgress] = useState<MigrationProgress>({
    total: 0,
    migrated: 0,
    failed: 0,
    status: 'idle',
  });
  const [loading, setLoading] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const base = 'http://127.0.0.1:8088';

  // 计算已用时间
  useEffect(() => {
    if (progress.status === 'running' && progress.startTime) {
      const interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - progress.startTime!) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setElapsedTime(0);
    }
  }, [progress.status, progress.startTime]);

  // 轮询获取迁移进度
  useEffect(() => {
    if (progress.status === 'running') {
      const interval = setInterval(async () => {
        try {
          const response = await fetch(`${base}/api/migration/progress`);
          const data = await response.json();
          setProgress((prev) => ({
            ...data,
            startTime: prev.startTime || Date.now(),
          }));
          
          // 如果迁移完成或出错，停止轮询
          if (data.status === 'completed' || data.status === 'error') {
            clearInterval(interval);
            setLoading(false);
          }
        } catch (err) {
          console.error('获取迁移进度失败:', err);
        }
      }, 500); // 每500ms轮询一次

      return () => clearInterval(interval);
    }
  }, [progress.status, base]);

  const startMigration = async () => {
    if (loading || progress.status === 'running') {
      return;
    }

    setLoading(true);
    setElapsedTime(0);
    try {
      const response = await fetch(`${base}/api/migration/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          redis_url: redisUrl || undefined,
          prefix: prefix.trim() || undefined,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setProgress({
          ...result.progress,
          startTime: Date.now(),
        });
      } else {
        setProgress((prev) => ({ ...prev, status: 'error', error: result.message }));
        setLoading(false);
      }
    } catch (err) {
      setProgress((prev) => ({
        ...prev,
        status: 'error',
        error: `启动迁移失败: ${err instanceof Error ? err.message : String(err)}`,
      }));
      setLoading(false);
    }
  };

  const getProgressPercent = () => {
    if (progress.total === 0) return 0;
    return Math.round((progress.migrated / progress.total) * 100);
  };

  const getStatusConfig = () => {
    switch (progress.status) {
      case 'idle':
        return { text: '未开始', color: 'default', icon: <InfoCircleOutlined /> };
      case 'running':
        return { text: '迁移中', color: 'processing', icon: <LoadingOutlined spin /> };
      case 'completed':
        return { text: '迁移完成', color: 'success', icon: <CheckCircleOutlined /> };
      case 'error':
        return { text: '迁移失败', color: 'error', icon: <CloseCircleOutlined /> };
      default:
        return { text: '未知状态', color: 'default', icon: <InfoCircleOutlined /> };
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}时${m}分${s}秒`;
    if (m > 0) return `${m}分${s}秒`;
    return `${s}秒`;
  };

  const getEstimatedTime = () => {
    if (progress.status !== 'running' || progress.migrated === 0 || !progress.currentSpeed || progress.currentSpeed === 0) {
      return null;
    }
    const remaining = progress.total - progress.migrated;
    const estimatedSeconds = Math.ceil(remaining / progress.currentSpeed);
    return formatTime(estimatedSeconds);
  };

  const statusConfig = getStatusConfig();

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 页面标题 */}
        <div>
          <Title level={2} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
            <SwapOutlined style={{ fontSize: 28, color: '#1890ff' }} />
            数据迁移
          </Title>
          <Text type="secondary" style={{ fontSize: 14 }}>
            从 Redis 迁移数据到 AegisDB，支持前缀过滤和实时进度监控
          </Text>
        </div>

        {/* 配置卡片 */}
        <Card
          title={
            <Space>
              <DatabaseOutlined />
              <span>迁移配置</span>
            </Space>
          }
          style={{
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            borderRadius: 8,
          }}
        >
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                Redis 连接地址
              </Text>
              <Input
                size="large"
                prefix={<DatabaseOutlined style={{ color: '#bfbfbf' }} />}
                value={redisUrl}
                onChange={(e) => setRedisUrl(e.target.value)}
                placeholder="redis://127.0.0.1:6379"
                disabled={loading || progress.status === 'running'}
                style={{ fontFamily: 'monospace' }}
              />
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                支持标准 Redis URL 格式，例如：redis://127.0.0.1:6379 或 redis://:password@host:port
              </Text>
            </div>

            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                前缀过滤
                <Text type="secondary" style={{ fontWeight: 'normal', marginLeft: 8 }}>
                  （可选）
                </Text>
              </Text>
              <Input
                size="large"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                placeholder="例如: demo: 或 account:"
                disabled={loading || progress.status === 'running'}
              />
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                留空则迁移所有数据，指定前缀则只迁移匹配该前缀的键
              </Text>
            </div>

            <Divider style={{ margin: '16px 0' }} />

            <Button
              type="primary"
              size="large"
              icon={<SwapOutlined />}
              onClick={startMigration}
              disabled={loading || progress.status === 'running'}
              loading={loading || progress.status === 'running'}
              block
              style={{
                height: 48,
                fontSize: 16,
                fontWeight: 600,
              }}
            >
              {loading || progress.status === 'running' ? '迁移进行中...' : '开始迁移'}
            </Button>
          </Space>
        </Card>

        {/* 进度卡片 */}
        <Card
          title={
            <Space>
              <ClockCircleOutlined />
              <span>迁移进度</span>
              <Tag icon={statusConfig.icon} color={statusConfig.color} style={{ marginLeft: 8 }}>
                {statusConfig.text}
              </Tag>
            </Space>
          }
          style={{
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            borderRadius: 8,
          }}
        >
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* 进度条 */}
            {progress.total > 0 && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text strong>总体进度</Text>
                  <Text strong style={{ fontSize: 16 }}>
                    {getProgressPercent()}%
                  </Text>
                </div>
                <Progress
                  percent={getProgressPercent()}
                  status={
                    progress.status === 'error'
                      ? 'exception'
                      : progress.status === 'completed'
                      ? 'success'
                      : 'active'
                  }
                  strokeColor={
                    progress.status === 'completed'
                      ? {
                          '0%': '#108ee9',
                          '100%': '#87d068',
                        }
                      : progress.status === 'error'
                      ? '#ff4d4f'
                      : undefined
                  }
                  style={{ marginBottom: 16 }}
                />
              </div>
            )}

            {/* 统计信息 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              <Card
                size="small"
                style={{
                  textAlign: 'center',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: 'none',
                }}
                bodyStyle={{ padding: '20px 16px' }}
              >
                <Statistic
                  title={
                    <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13 }}>
                      总数据量
                    </Text>
                  }
                  value={progress.total}
                  valueStyle={{ color: '#fff', fontSize: 28, fontWeight: 700 }}
                  prefix={<DatabaseOutlined style={{ color: 'rgba(255,255,255,0.8)' }} />}
                />
              </Card>

              <Card
                size="small"
                style={{
                  textAlign: 'center',
                  background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
                  border: 'none',
                }}
                bodyStyle={{ padding: '20px 16px' }}
              >
                <Statistic
                  title={
                    <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13 }}>
                      已迁移
                    </Text>
                  }
                  value={progress.migrated}
                  valueStyle={{ color: '#fff', fontSize: 28, fontWeight: 700 }}
                  prefix={<CheckCircleOutlined style={{ color: 'rgba(255,255,255,0.8)' }} />}
                />
              </Card>

              <Card
                size="small"
                style={{
                  textAlign: 'center',
                  background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                  border: 'none',
                }}
                bodyStyle={{ padding: '20px 16px' }}
              >
                <Statistic
                  title={
                    <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13 }}>
                      失败数量
                    </Text>
                  }
                  value={progress.failed}
                  valueStyle={{ color: '#fff', fontSize: 28, fontWeight: 700 }}
                  prefix={<CloseCircleOutlined style={{ color: 'rgba(255,255,255,0.8)' }} />}
                />
              </Card>

              {progress.status === 'running' && (
                <Card
                  size="small"
                  style={{
                    textAlign: 'center',
                    background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                    border: 'none',
                  }}
                  bodyStyle={{ padding: '20px 16px' }}
                >
                  <Statistic
                    title={
                      <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13 }}>
                        已用时间
                      </Text>
                    }
                    value={formatTime(elapsedTime)}
                    valueStyle={{ color: '#fff', fontSize: 20, fontWeight: 700 }}
                    prefix={<ClockCircleOutlined style={{ color: 'rgba(255,255,255,0.8)' }} />}
                  />
                </Card>
              )}
            </div>

            {/* 实时信息 */}
            {progress.status === 'running' && (
              <div
                style={{
                  padding: 16,
                  background: '#f0f9ff',
                  borderRadius: 8,
                  border: '1px solid #bae6fd',
                }}
              >
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text type="secondary">迁移速度：</Text>
                    <Text strong>
                      {progress.currentSpeed
                        ? `${progress.currentSpeed.toFixed(1)} 条/秒`
                        : '计算中...'}
                    </Text>
                  </div>
                  {getEstimatedTime() && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text type="secondary">预计剩余时间：</Text>
                      <Text strong style={{ color: '#1890ff' }}>
                        {getEstimatedTime()}
                      </Text>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text type="secondary">成功率：</Text>
                    <Text strong style={{ color: '#52c41a' }}>
                      {progress.total > 0
                        ? `${(
                            ((progress.total - progress.failed) / progress.total) *
                            100
                          ).toFixed(2)}%`
                        : '100%'}
                    </Text>
                  </div>
                </Space>
              </div>
            )}

            {/* 错误信息 */}
            {progress.error && (
              <Alert
                message="迁移错误"
                description={progress.error}
                type="error"
                icon={<CloseCircleOutlined />}
                showIcon
                closable
                onClose={() => {
                  setProgress((prev) => ({ ...prev, error: undefined }));
                }}
              />
            )}

            {/* 完成提示 */}
            {progress.status === 'completed' && (
              <Alert
                message="迁移完成"
                description={`成功迁移 ${progress.migrated} 条数据，失败 ${progress.failed} 条`}
                type="success"
                icon={<CheckCircleOutlined />}
                showIcon
                style={{ marginTop: 8 }}
              />
            )}

            {/* 空状态 */}
            {progress.status === 'idle' && progress.total === 0 && (
              <div
                style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  color: '#8c8c8c',
                }}
              >
                <InfoCircleOutlined style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }} />
                <div>请配置迁移参数并点击"开始迁移"按钮</div>
              </div>
            )}
          </Space>
        </Card>
      </Space>
    </div>
  );
}