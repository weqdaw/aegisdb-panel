import { useState, useEffect } from 'react';

type MigrationProgress = {
  total: number;
  migrated: number;
  failed: number;
  status: 'idle' | 'running' | 'completed' | 'error';
  error?: string;
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
  const base = 'http://127.0.0.1:8088';

  // 轮询获取迁移进度
  useEffect(() => {
    if (progress.status === 'running') {
      const interval = setInterval(async () => {
        try {
          const response = await fetch(`${base}/api/migration/progress`);
          const data = await response.json();
          setProgress(data);
          
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
  }, [progress.status]);

  const startMigration = async () => {
    if (loading || progress.status === 'running') {
      return;
    }

    setLoading(true);
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
        setProgress(result.progress);
      } else {
        alert(result.message);
        setLoading(false);
      }
    } catch (err) {
      alert(`启动迁移失败: ${err instanceof Error ? err.message : String(err)}`);
      setLoading(false);
    }
  };

  const getProgressPercent = () => {
    if (progress.total === 0) return 0;
    return Math.round((progress.migrated / progress.total) * 100);
  };

  const getStatusText = () => {
    switch (progress.status) {
      case 'idle':
        return '未开始';
      case 'running':
        return '迁移中...';
      case 'completed':
        return '迁移完成';
      case 'error':
        return '迁移失败';
      default:
        return '未知状态';
    }
  };

  const getStatusColor = () => {
    switch (progress.status) {
      case 'idle':
        return '#64748b';
      case 'running':
        return '#3b82f6';
      case 'completed':
        return '#10b981';
      case 'error':
        return '#ef4444';
      default:
        return '#64748b';
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 24, color: '#0f172a' }}>数据迁移到 Redis</h2>

      {/* 配置区域 */}
      <div
        style={{
          borderRadius: 12,
          border: '1px solid #e2e8f0',
          padding: 20,
          background: '#fff',
          marginBottom: 20,
        }}
      >
        <h3 style={{ margin: '0 0 16px', fontSize: 16, color: '#0f172a' }}>
          迁移配置
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label
              style={{
                display: 'block',
                marginBottom: 8,
                fontSize: 14,
                color: '#475569',
                fontWeight: 500,
              }}
            >
              Redis 连接地址
            </label>
            <input
              type="text"
              value={redisUrl}
              onChange={(e) => setRedisUrl(e.target.value)}
              placeholder="redis://127.0.0.1:6379"
              disabled={loading || progress.status === 'running'}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 6,
                border: '1px solid #cbd5f5',
                fontSize: 14,
                fontFamily: 'monospace',
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: 'block',
                marginBottom: 8,
                fontSize: 14,
                color: '#475569',
                fontWeight: 500,
              }}
            >
              前缀过滤（可选，留空则迁移所有数据）
            </label>
            <input
              type="text"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              placeholder="例如: demo: 或 account:"
              disabled={loading || progress.status === 'running'}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 6,
                border: '1px solid #cbd5f5',
                fontSize: 14,
              }}
            />
          </div>

          <button
            onClick={startMigration}
            disabled={loading || progress.status === 'running'}
            style={{
              padding: '12px 24px',
              borderRadius: 6,
              border: 'none',
              background:
                loading || progress.status === 'running'
                  ? '#cbd5f5'
                  : '#3b82f6',
              color: '#fff',
              cursor:
                loading || progress.status === 'running'
                  ? 'not-allowed'
                  : 'pointer',
              fontWeight: 600,
              fontSize: 14,
              width: '100%',
            }}
          >
            {loading || progress.status === 'running'
              ? '迁移中...'
              : '开始迁移'}
          </button>
        </div>
      </div>

      {/* 进度区域 */}
      <div
        style={{
          borderRadius: 12,
          border: '1px solid #e2e8f0',
          padding: 20,
          background: '#fff',
        }}
      >
        <h3 style={{ margin: '0 0 16px', fontSize: 16, color: '#0f172a' }}>
          迁移进度
        </h3>

        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
            }}
          >
            <span style={{ fontSize: 14, color: '#475569', fontWeight: 500 }}>
              状态: <span style={{ color: getStatusColor() }}>{getStatusText()}</span>
            </span>
            {progress.total > 0 && (
              <span style={{ fontSize: 14, color: '#64748b' }}>
                {progress.migrated} / {progress.total} ({getProgressPercent()}%)
              </span>
            )}
          </div>

          {progress.total > 0 && (
            <div
              style={{
                width: '100%',
                height: 24,
                background: '#f1f5f9',
                borderRadius: 12,
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <div
                style={{
                  width: `${getProgressPercent()}%`,
                  height: '100%',
                  background:
                    progress.status === 'error'
                      ? '#ef4444'
                      : progress.status === 'completed'
                      ? '#10b981'
                      : '#3b82f6',
                  transition: 'width 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {getProgressPercent() > 10 && (
                  <span
                    style={{
                      fontSize: 11,
                      color: '#fff',
                      fontWeight: 600,
                    }}
                  >
                    {getProgressPercent()}%
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 统计信息 */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 12,
            marginTop: 16,
          }}
        >
          <div
            style={{
              padding: 12,
              background: '#f8fafc',
              borderRadius: 8,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>
              总数
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}>
              {progress.total}
            </div>
          </div>
          <div
            style={{
              padding: 12,
              background: '#f0fdf4',
              borderRadius: 8,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>
              已迁移
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#10b981' }}>
              {progress.migrated}
            </div>
          </div>
          <div
            style={{
              padding: 12,
              background: '#fef2f2',
              borderRadius: 8,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>
              失败
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#ef4444' }}>
              {progress.failed}
            </div>
          </div>
        </div>

        {/* 错误信息 */}
        {progress.error && (
          <div
            style={{
              marginTop: 16,
              padding: 12,
              background: '#fef2f2',
              border: '1px solid #fca5a5',
              borderRadius: 6,
              fontSize: 13,
              color: '#991b1b',
            }}
          >
            <strong>错误:</strong> {progress.error}
          </div>
        )}
      </div>
    </div>
  );
}