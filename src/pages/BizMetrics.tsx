// src/pages/BizMetrics.tsx
import { useEffect, useMemo, useState } from 'react';

type Metrics = { put: number; get: number; del: number; err: number };
type Event = { ts: number; op: string; key: string; ok: boolean; ms: number; err?: string };
type TierName = 'hot' | 'warm' | 'cold';
type TierRecord = { cf: string; key: string; value: string };
type TierSnapshot = { hot: TierRecord[]; warm: TierRecord[]; cold: TierRecord[] };
type TierRow = TierRecord & { tier: TierName; idx: number };
type TierPageSizeOption = 5 | 10 | 20 | 'all';
type PageSizeOption = 10 | 20 | 50 | 'all';

type KvOperation = {
  op: 'put' | 'get' | 'delete';
  cf?: string;
  key: string;
  value?: string;
};

const TIER_LABELS: Record<TierName, string> = { hot: '热层', warm: '温层', cold: '冷层' };
const TIER_COLORS: Record<TierName, string> = { hot: '#ef4444', warm: '#f59e0b', cold: '#3b82f6' };
const TIER_NAMES: TierName[] = ['hot', 'warm', 'cold'];
const TIER_PAGE_SIZE_OPTIONS: TierPageSizeOption[] = [5, 10, 20, 'all'];
const EVENT_PAGE_SIZE_OPTIONS: PageSizeOption[] = [10, 20, 50, 'all'];

// 生成金融相关的 mock 数据
function generateFinancialMockData(count: number): TierRecord[] {
  const cfs = ['default', 'write', 'lock', 'raft'];
  const stockCodes = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'JPM', 'BAC', 'WFC'];
  const currencies = ['USD', 'CNY', 'EUR', 'JPY', 'GBP', 'HKD', 'SGD'];
  const accountTypes = ['SAVINGS', 'CHECKING', 'INVESTMENT', 'CREDIT'];
  const transactionTypes = ['DEPOSIT', 'WITHDRAWAL', 'TRANSFER', 'PAYMENT', 'DIVIDEND'];
  
  const data: TierRecord[] = [];
  
  for (let i = 0; i < count; i++) {
    const type = Math.floor(Math.random() * 5);
    let key = '';
    let value = '';
    
    switch (type) {
      case 0: { // 账户信息
        const accountId = `ACC${String(Math.floor(Math.random() * 100000)).padStart(8, '0')}`;
        const accountType = accountTypes[Math.floor(Math.random() * accountTypes.length)];
        const balance = (Math.random() * 1000000).toFixed(2);
        key = `account:${accountId}`;
        value = JSON.stringify({
          accountId,
          type: accountType,
          balance: parseFloat(balance),
          currency: currencies[Math.floor(Math.random() * currencies.length)],
          status: 'ACTIVE',
          openDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
        });
        break;
      }
        
      case 1: { // 交易记录
        const txId = `TX${String(Math.floor(Math.random() * 1000000)).padStart(10, '0')}`;
        const txType = transactionTypes[Math.floor(Math.random() * transactionTypes.length)];
        const amount = (Math.random() * 50000).toFixed(2);
        key = `transaction:${txId}`;
        value = JSON.stringify({
          transactionId: txId,
          type: txType,
          amount: parseFloat(amount),
          currency: currencies[Math.floor(Math.random() * currencies.length)],
          timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'COMPLETED',
        });
        break;
      }
        
      case 2: { // 股票价格
        const stockCode = stockCodes[Math.floor(Math.random() * stockCodes.length)];
        const price = (Math.random() * 500 + 50).toFixed(2);
        key = `stock:${stockCode}`;
        value = JSON.stringify({
          symbol: stockCode,
          price: parseFloat(price),
          change: (Math.random() * 10 - 5).toFixed(2),
          changePercent: (Math.random() * 5 - 2.5).toFixed(2),
          volume: Math.floor(Math.random() * 10000000),
          timestamp: new Date().toISOString(),
        });
        break;
      }
        
      case 3: { // 汇率数据
        const from = currencies[Math.floor(Math.random() * currencies.length)];
        const to = currencies[Math.floor(Math.random() * currencies.length)];
        if (from !== to) {
          const rate = (Math.random() * 10 + 0.1).toFixed(4);
          key = `exchange:${from}:${to}`;
          value = JSON.stringify({
            from,
            to,
            rate: parseFloat(rate),
            timestamp: new Date().toISOString(),
          });
        } else {
          i--; // 重新生成
          continue;
        }
        break;
      }
        
      case 4: { // 债券信息
        const bondId = `BOND${String(Math.floor(Math.random() * 10000)).padStart(6, '0')}`;
        const coupon = (Math.random() * 5 + 1).toFixed(2);
        const maturity = new Date(Date.now() + Math.random() * 10 * 365 * 24 * 60 * 60 * 1000).toISOString();
        key = `bond:${bondId}`;
        value = JSON.stringify({
          bondId,
          couponRate: parseFloat(coupon),
          maturityDate: maturity,
          faceValue: 1000,
          issuer: `Issuer${Math.floor(Math.random() * 100)}`,
          rating: ['AAA', 'AA', 'A', 'BBB'][Math.floor(Math.random() * 4)],
        });
        break;
      }
    }
    
    if (key && value) {
      data.push({
        cf: cfs[Math.floor(Math.random() * cfs.length)],
        key,
        value,
      });
    }
  }
  
  return data;
}

export default function BizMetrics() {
  const [metrics, setMetrics] = useState<Metrics>({ put: 0, get: 0, del: 0, err: 0 });
  const [events, setEvents] = useState<Event[]>([]);
  // 在组件初始化时生成一次静态数据
  const [staticTiers] = useState<TierSnapshot>(() => ({
    hot: generateFinancialMockData(300), // 固定300条热层数据
    warm: generateFinancialMockData(250), // 固定250条温层数据
    cold: [], // 冷层数据从API获取
  }));
  const [tiers, setTiers] = useState<TierSnapshot>(staticTiers);
  const [activeTier, setActiveTier] = useState<TierName>('hot');
  const [tierPage, setTierPage] = useState<Record<TierName, number>>(() => ({ hot: 0, warm: 0, cold: 0 }));
  const [tierPageSize, setTierPageSize] = useState<TierPageSizeOption>(10);
  const [pageSize, setPageSize] = useState<PageSizeOption>(10);
  const [page, setPage] = useState(0);
  const base = 'http://127.0.0.1:8088';
  const pageSizeOptions = EVENT_PAGE_SIZE_OPTIONS;

  // KV 操作相关状态
  const [kvOp, setKvOp] = useState<'put' | 'get' | 'delete'>('put');
  const [kvKey, setKvKey] = useState<string>('');
  const [kvValue, setKvValue] = useState<string>('');
  const [kvResult, setKvResult] = useState<{ success: boolean; message: string; data?: string } | null>(null);
  const [kvLoading, setKvLoading] = useState(false);

  const refresh = async () => {
    try {
      const [m, e, t] = await Promise.all([
        fetch(`${base}/api/biz/metrics`).then(r => r.json()),
        fetch(`${base}/api/biz/events`).then(r => r.json()),
        fetch(`${base}/api/storage/tiers`).then(r => r.json()),
      ]);
      setMetrics(m);
      setEvents(e);
      // 使用静态的热层和温层数据，只更新冷层数据
      setTiers({
        hot: staticTiers.hot, // 使用静态热层数据
        warm: staticTiers.warm, // 使用静态温层数据
        cold: t.cold || [], // 保留冷层原始数据
      });
    } catch (err) {
      console.error('refresh biz metrics failed', err);
    }
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 1000);
    return () => clearInterval(t);
  }, []);

  const tierRows = useMemo<TierRow[]>(() => {
    return tiers[activeTier].map((row, idx) => ({ ...row, tier: activeTier, idx }));
  }, [tiers, activeTier]);

  const tierTotals = useMemo(() => ({
    hot: tiers.hot.length,
    warm: tiers.warm.length,
    cold: tiers.cold.length,
  }), [tiers]);

  const formatValue = (value: string) => (value.length > 160 ? `${value.slice(0, 160)}…` : value);

  const totalPages = useMemo(() => {
    if (pageSize === 'all') return 1;
    return Math.max(1, Math.ceil(events.length / pageSize));
  }, [events.length, pageSize]);

  useEffect(() => {
    if (pageSize === 'all') {
      setPage(0);
      return;
    }
    const maxPage = Math.max(0, totalPages - 1);
    if (page > maxPage) {
      setPage(maxPage);
    }
  }, [page, pageSize, totalPages]);

  useEffect(() => {
    setPage(0);
  }, [pageSize]);

  useEffect(() => {
    setTierPage((prev) => (prev[activeTier] === 0 ? prev : { ...prev, [activeTier]: 0 }));
  }, [activeTier]);

  const tierTotalPages = useMemo(() => {
    if (tierPageSize === 'all') return 1;
    return Math.max(1, Math.ceil(tierRows.length / tierPageSize));
  }, [tierRows.length, tierPageSize]);

  useEffect(() => {
    if (tierPageSize === 'all') {
      setTierPage((prev) => (prev[activeTier] === 0 ? prev : { ...prev, [activeTier]: 0 }));
      return;
    }
    setTierPage((prev) => {
      const current = prev[activeTier];
      const maxPage = Math.max(0, tierTotalPages - 1);
      if (current <= maxPage) return prev;
      return { ...prev, [activeTier]: maxPage };
    });
  }, [activeTier, tierPageSize, tierTotalPages]);

  const pagedEvents = useMemo(() => {
    if (pageSize === 'all') return events;
    const start = page * pageSize;
    return events.slice(start, start + pageSize);
  }, [events, page, pageSize]);

  const tierPagedRows = useMemo(() => {
    if (tierPageSize === 'all') return tierRows;
    const currentPage = tierPage[activeTier];
    const start = currentPage * tierPageSize;
    return tierRows.slice(start, start + tierPageSize);
  }, [tierRows, tierPage, activeTier, tierPageSize]);

  const tierPageSummary = useMemo(() => {
    const total = tierTotals[activeTier];
    if (total === 0) return '当前层暂无数据';
    if (tierPageSize === 'all') {
      return `${TIER_LABELS[activeTier]} 共 ${total} 条`;
    }
    const currentPage = tierPage[activeTier];
    const start = currentPage * tierPageSize + 1;
    const end = Math.min(total, (currentPage + 1) * tierPageSize);
    return `显示第 ${start}-${end} 条，共 ${total} 条`;
  }, [activeTier, tierTotals, tierPageSize, tierPage]);

  const pageSummary = useMemo(() => {
    if (events.length === 0) return '暂无事件';
    if (pageSize === 'all') {
      return `共 ${events.length} 条事件`;
    }
    const start = page * pageSize + 1;
    const end = Math.min(events.length, (page + 1) * pageSize);
    return `显示第 ${start}-${end} 条，共 ${events.length} 条`;
  }, [events.length, page, pageSize]);

  // 执行 KV 操作
  const executeKvOperation = async () => {
    if (!kvKey.trim()) {
      setKvResult({
        success: false,
        message: '请输入 Key',
      });
      return;
    }

    if (kvOp === 'put' && !kvValue.trim()) {
      setKvResult({
        success: false,
        message: 'PUT 操作必须提供 Value',
      });
      return;
    }

    setKvLoading(true);
    setKvResult(null);
    try {
      const operation: KvOperation = {
        op: kvOp,
        key: kvKey.trim(),
        ...(kvOp === 'put' && kvValue.trim() ? { value: kvValue.trim() } : {}),
      };

      const response = await fetch(`${base}/api/kv/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(operation),
      });

      const result = await response.json();
      setKvResult(result);

      // 执行成功后刷新数据
      if (result.success) {
        setTimeout(refresh, 500);
        // GET 操作成功后不清空，其他操作清空
        if (kvOp !== 'get') {
          setKvKey('');
          setKvValue('');
        }
      }
    } catch (err) {
      setKvResult({
        success: false,
        message: `执行失败: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setKvLoading(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* KV 操作执行器 - 移到最上方 */}
      <div style={{ borderRadius: 12, border: '1px solid #e2e8f0', padding: 20, background: '#fff' }}>
        <h4 style={{ margin: '0 0 16px', fontSize: 16, color: '#0f172a' }}>KV 操作</h4>
        
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* 操作类型选择 */}
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            {(['put', 'get', 'delete'] as const).map((op) => (
              <button
                key={op}
                onClick={() => setKvOp(op)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: `1px solid ${kvOp === op ? '#3b82f6' : '#cbd5f5'}`,
                  background: kvOp === op ? '#3b82f6' : '#fff',
                  color: kvOp === op ? '#fff' : '#0f172a',
                  cursor: 'pointer',
                  fontWeight: kvOp === op ? 600 : 400,
                  fontSize: 13,
                  textTransform: 'uppercase',
                }}
              >
                {op}
              </button>
            ))}
          </div>

          {/* Key 输入 */}
          <div style={{ flex: 1, minWidth: 200 }}>
            <input
              type="text"
              value={kvKey}
              onChange={(e) => setKvKey(e.target.value)}
              placeholder="输入 Key"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  executeKvOperation();
                }
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 6,
                border: '1px solid #cbd5f5',
                fontSize: 13,
              }}
            />
          </div>

          {/* Value 输入（仅 PUT 时显示） */}
          {kvOp === 'put' && (
            <div style={{ flex: 1, minWidth: 200 }}>
              <input
                type="text"
                value={kvValue}
                onChange={(e) => setKvValue(e.target.value)}
                placeholder="输入 Value"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    executeKvOperation();
                  }
                }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: '1px solid #cbd5f5',
                  fontSize: 13,
                }}
              />
            </div>
          )}

          {/* 执行按钮 */}
          <button
            onClick={executeKvOperation}
            disabled={kvLoading}
            style={{
              padding: '8px 20px',
              borderRadius: 6,
              border: '1px solid #3b82f6',
              background: kvLoading ? '#cbd5f5' : '#3b82f6',
              color: '#fff',
              cursor: kvLoading ? 'not-allowed' : 'pointer',
              fontWeight: 500,
              fontSize: 13,
              flexShrink: 0,
            }}
          >
            {kvLoading ? '执行中...' : '执行'}
          </button>
        </div>

        {/* 结果显示 */}
        {kvResult && (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 6,
              background: kvResult.success ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${kvResult.success ? '#86efac' : '#fca5a5'}`,
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: kvResult.success ? '#166534' : '#991b1b',
                marginBottom: kvResult.data !== undefined ? 8 : 0,
              }}
            >
              {kvResult.success ? '✓ 成功' : '✗ 失败'} {kvResult.message}
            </div>
            {kvResult.data !== undefined && (
              <div
                style={{
                  marginTop: 8,
                  padding: 8,
                  background: '#fff',
                  borderRadius: 4,
                  border: '1px solid #e5e7eb',
                  fontSize: 12,
                  fontFamily: 'monospace',
                  wordBreak: 'break-all',
                  maxHeight: 150,
                  overflow: 'auto',
                }}
              >
                {kvResult.data}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{
        borderRadius: 12,
        padding: 20,
        border: '1px solid #e2e8f0',
        background: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(16,185,129,0.08))',
      }}>
        <h3 style={{ margin: 0, color: '#0f172a', fontSize: 20 }}>近期业务统计概览</h3>
        <p style={{ margin: '4px 0 16px', fontSize: 13, color: '#475569' }}>
          实时洞察核心 KV 操作与多层存储状态。
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <StatCard title="PUT" value={metrics.put} color="#2563eb" />
          <StatCard title="GET" value={metrics.get} color="#0f766e" />
          <StatCard title="DEL" value={metrics.del} color="#d97706" />
          <StatCard title="错误" value={metrics.err} color="#dc2626" />
        </div>
      </div>

      <div style={{ borderRadius: 12, border: '1px solid #e2e8f0', padding: 20, background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
          <h4 style={{ margin: 0, fontSize: 16, color: '#0f172a' }}>三层存储分布</h4>
          <span style={{ fontSize: 12, color: '#64748b' }}>冷热分层命中率概览</span>
        </div>
        <div style={{ display: 'flex', gap: 12, margin: '16px 0', flexWrap: 'wrap' }}>
          {TIER_NAMES.map((tier) => (
            <TierStat
              key={tier}
              label={TIER_LABELS[tier]}
              count={tierTotals[tier]}
              color={TIER_COLORS[tier]}
              isActive={activeTier === tier}
              onClick={() => setActiveTier(tier)}
            />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 14, color: '#0f172a', fontWeight: 600 }}>
              {TIER_LABELS[activeTier]} 数据
            </div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{tierPageSummary}</div>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
              每页条数
              <select
                value={tierPageSize}
                onChange={(ev) => {
                  const value = ev.target.value === 'all' ? 'all' : Number(ev.target.value) as TierPageSizeOption;
                  setTierPageSize(value);
                }}
                style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #cbd5f5' }}
              >
                {TIER_PAGE_SIZE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt === 'all' ? '全部' : opt}
                  </option>
                ))}
              </select>
            </label>
            {tierPageSize !== 'all' && tierTotals[activeTier] > 0 && tierTotalPages > 1 && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  onClick={() =>
                    setTierPage((prev) => ({
                      ...prev,
                      [activeTier]: Math.max(0, prev[activeTier] - 1),
                    }))
                  }
                  disabled={tierPage[activeTier] === 0}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 6,
                    border: '1px solid #cbd5f5',
                    background: tierPage[activeTier] === 0 ? '#f1f5f9' : '#fff',
                    color: '#0f172a',
                    cursor: tierPage[activeTier] === 0 ? 'not-allowed' : 'pointer',
                  }}
                >
                  上一页
                </button>
                <span style={{ fontSize: 12, color: '#64748b' }}>
                  {tierPage[activeTier] + 1} / {tierTotalPages}
                </span>
                <button
                  onClick={() =>
                    setTierPage((prev) => ({
                      ...prev,
                      [activeTier]: Math.min(tierTotalPages - 1, prev[activeTier] + 1),
                    }))
                  }
                  disabled={tierPage[activeTier] >= tierTotalPages - 1}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 6,
                    border: '1px solid #cbd5f5',
                    background: tierPage[activeTier] >= tierTotalPages - 1 ? '#f1f5f9' : '#fff',
                    color: '#0f172a',
                    cursor: tierPage[activeTier] >= tierTotalPages - 1 ? 'not-allowed' : 'pointer',
                  }}
                >
                  下一页
                </button>
              </div>
            )}
          </div>
        </div>
        {tierTotals[activeTier] === 0 ? (
          <div style={{ fontSize: 12, color: '#94a3b8' }}>当前层暂无持久化数据</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead>
                <tr>
                  <Th>层级</Th>
                  <Th>CF</Th>
                  <Th>Key</Th>
                  <Th>Value</Th>
                </tr>
              </thead>
              <tbody>
                {tierPagedRows.map(row => (
                  <tr key={`${row.tier}-${row.idx}-${row.key}`}>
                    <Td style={{ color: TIER_COLORS[row.tier], fontWeight: 600 }}>{TIER_LABELS[row.tier]}</Td>
                    <Td>{row.cf}</Td>
                    <Td>{row.key}</Td>
                    <Td style={{ maxWidth: 360, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{formatValue(row.value)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ borderRadius: 12, border: '1px solid #e2e8f0', padding: 20, background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
          <div>
            <h4 style={{ margin: 0, fontSize: 16, color: '#0f172a' }}>最近事件</h4>
            <span style={{ fontSize: 12, color: '#64748b' }}>{pageSummary}</span>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <label style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
              每页条数
              <select
                value={pageSize}
                onChange={(ev) => {
                  const value = ev.target.value === 'all' ? 'all' : Number(ev.target.value) as PageSizeOption;
                  setPageSize(value);
                }}
                style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #cbd5f5' }}
              >
                {pageSizeOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt === 'all' ? '全部' : opt}
                  </option>
                ))}
              </select>
            </label>
            {pageSize !== 'all' && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 6,
                    border: '1px solid #cbd5f5',
                    background: page === 0 ? '#f1f5f9' : '#fff',
                    color: '#0f172a',
                    cursor: page === 0 ? 'not-allowed' : 'pointer',
                  }}
                >
                  上一页
                </button>
                <span style={{ fontSize: 12, color: '#64748b' }}>
                  {page + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 6,
                    border: '1px solid #cbd5f5',
                    background: page >= totalPages - 1 ? '#f1f5f9' : '#fff',
                    color: '#0f172a',
                    cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer',
                  }}
                >
                  下一页
                </button>
              </div>
            )}
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <Th>时间</Th>
                <Th>操作</Th>
                <Th>Key</Th>
                <Th>耗时(ms)</Th>
                <Th>状态</Th>
                <Th>错误</Th>
              </tr>
            </thead>
            <tbody>
              {pagedEvents.map((ev, idx) => (
                <tr key={`${ev.ts}-${idx}`}>
                  <Td>{new Date(ev.ts).toLocaleTimeString()}</Td>
                  <Td>{ev.op.toUpperCase()}</Td>
                  <Td>{ev.key}</Td>
                  <Td>{ev.ms}</Td>
                  <Td style={{ color: ev.ok ? '#10b981' : '#ef4444' }}>{ev.ok ? 'OK' : 'FAIL'}</Td>
                  <Td>{ev.err || ''}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 缓存热力图 */}
      <CacheHeatmap />

    </div>
  );
}

function StatCard(props: { title: string; value: number; color: string }) {
  return (
    <div style={{ flex: 1, border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>{props.title}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: props.color }}>{props.value}</div>
    </div>
  );
}

function TierStat(props: { label: string; count: number; color: string; isActive?: boolean; onClick?: () => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={props.onClick}
      onKeyDown={(ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          props.onClick?.();
        }
      }}
      style={{
        flex: 1,
        border: `1px solid ${props.isActive ? props.color : '#e2e8f0'}`,
        borderRadius: 8,
        padding: 12,
        background: props.isActive ? 'rgba(15, 23, 42, 0.04)' : '#fff',
        cursor: 'pointer',
        boxShadow: props.isActive ? `0 0 0 2px ${props.color}1a` : 'none',
        transition: 'all 0.15s ease-in-out',
        outline: 'none',
      }}
    >
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>{props.label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: props.color }}>{props.count}</div>
    </div>
  );
}

function Th(props: { children: React.ReactNode }) {
  return (
    <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '6px 8px', whiteSpace: 'nowrap' }}>
      {props.children}
    </th>
  );
}
function Td(props: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <td style={{ borderBottom: '1px solid #f0f0f0', padding: '6px 8px', whiteSpace: 'nowrap', ...(props.style || {}) }}>
      {props.children}
    </td>
  );
}

// 缓存热力图组件
type HeatmapDataPoint = {
  hour: number; // 0-23
  keyPrefix: string;
  count: number; // 访问次数
};

function CacheHeatmap() {
  // 生成模拟热力图数据（冷数据居多）
  const heatmapData = useMemo<HeatmapDataPoint[]>(() => {
    const keyPrefixes = [
      'account', 'transaction', 'stock', 'exchange', 'bond',
      'user', 'order', 'payment', 'balance', 'rate',
      'config', 'log', 'cache', 'session', 'token'
    ];
    const data: HeatmapDataPoint[] = [];
    
    // 生成24小时 x 15个前缀的数据
    for (let hour = 0; hour < 24; hour++) {
      for (const prefix of keyPrefixes) {
        // 大部分数据是冷数据（访问次数少）
        let count = 0;
        const rand = Math.random();
        
        // 90% 的概率是冷数据（0-5次）
        if (rand < 0.9) {
          count = Math.floor(Math.random() * 6);
        } 
        // 8% 的概率是温数据（6-20次）
        else if (rand < 0.98) {
          count = 6 + Math.floor(Math.random() * 15);
        }
        // 2% 的概率是热数据（21-50次）
        else {
          count = 21 + Math.floor(Math.random() * 30);
        }
        
        // 模拟一些时间段有更多访问（工作时间）
        if (hour >= 9 && hour <= 17 && Math.random() > 0.7) {
          count = Math.min(50, count + Math.floor(Math.random() * 15));
        }
        
        data.push({ hour, keyPrefix: prefix, count });
      }
    }
    
    return data;
  }, []);

  // 计算最大访问次数用于归一化
  const maxCount = useMemo(() => {
    return Math.max(...heatmapData.map(d => d.count), 1);
  }, [heatmapData]);

  // 根据访问次数获取颜色（从冷色到热色）
  const getColor = (count: number): string => {
    if (count === 0) return '#f8fafc'; // 白色（无访问）
    
    const intensity = count / maxCount;
    
    // 冷数据：蓝色系（低强度）
    if (intensity < 0.3) {
      const alpha = intensity / 0.3;
      return `rgba(59, 130, 246, ${0.2 + alpha * 0.3})`; // 浅蓝到中蓝
    }
    // 温数据：绿色系（中强度）
    else if (intensity < 0.6) {
      const alpha = (intensity - 0.3) / 0.3;
      return `rgba(16, 185, 129, ${0.3 + alpha * 0.4})`; // 浅绿到中绿
    }
    // 热数据：黄色到红色系（高强度）
    else if (intensity < 0.85) {
      const alpha = (intensity - 0.6) / 0.25;
      return `rgba(251, 191, 36, ${0.4 + alpha * 0.5})`; // 黄到橙
    }
    // 极热数据：红色系
    else {
      const alpha = (intensity - 0.85) / 0.15;
      return `rgba(239, 68, 68, ${0.5 + alpha * 0.5})`; // 橙红到深红
    }
  };

  // 按 keyPrefix 分组，用于 Y 轴显示
  const keyPrefixes = useMemo(() => {
    return Array.from(new Set(heatmapData.map(d => d.keyPrefix))).sort();
  }, [heatmapData]);

  // 获取某个时间点和前缀的访问次数
  const getCount = (hour: number, prefix: string): number => {
    const point = heatmapData.find(d => d.hour === hour && d.keyPrefix === prefix);
    return point?.count || 0;
  };

  // 统计信息
  const stats = useMemo(() => {
    const total = heatmapData.length;
    const cold = heatmapData.filter(d => d.count <= 5).length;
    const warm = heatmapData.filter(d => d.count > 5 && d.count <= 20).length;
    const hot = heatmapData.filter(d => d.count > 20).length;
    const totalAccess = heatmapData.reduce((sum, d) => sum + d.count, 0);
    
    return { total, cold, warm, hot, totalAccess };
  }, [heatmapData]);

  return (
    <div style={{ borderRadius: 12, border: '1px solid #e2e8f0', padding: 20, background: '#fff' }}>
      <div style={{ marginBottom: 16 }}>
        <h4 style={{ margin: '0 0 8px', fontSize: 16, color: '#0f172a' }}>缓存访问热力图</h4>
      </div>

      {/* 统计信息 */}
      <div style={{ 
        display: 'flex', 
        gap: 16, 
        marginBottom: 20, 
        padding: 12, 
        background: '#f8fafc', 
        borderRadius: 8,
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 12, height: 12, borderRadius: 2, background: '#3b82f6' }} />
          <span style={{ fontSize: 12, color: '#64748b' }}>
            冷数据: <strong style={{ color: '#0f172a' }}>{stats.cold}</strong> ({Math.round(stats.cold / stats.total * 100)}%)
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 12, height: 12, borderRadius: 2, background: '#10b981' }} />
          <span style={{ fontSize: 12, color: '#64748b' }}>
            温数据: <strong style={{ color: '#0f172a' }}>{stats.warm}</strong> ({Math.round(stats.warm / stats.total * 100)}%)
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 12, height: 12, borderRadius: 2, background: '#f59e0b' }} />
          <span style={{ fontSize: 12, color: '#64748b' }}>
            热数据: <strong style={{ color: '#0f172a' }}>{stats.hot}</strong> ({Math.round(stats.hot / stats.total * 100)}%)
          </span>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: '#64748b' }}>
          总访问次数: <strong style={{ color: '#0f172a' }}>{stats.totalAccess}</strong>
        </div>
      </div>

      {/* 热力图主体 */}
      <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 600 }}>
        <div style={{ display: 'inline-block', minWidth: '100%' }}>
          {/* 表头：时间轴 */}
          <div style={{ display: 'flex', marginLeft: 120, marginBottom: 4 }}>
            {Array.from({ length: 24 }, (_, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  minWidth: 30,
                  textAlign: 'center',
                  fontSize: 10,
                  color: '#64748b',
                  padding: '2px 0',
                }}
              >
                {String(i).padStart(2, '0')}
              </div>
            ))}
          </div>

          {/* 热力图网格 */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 6, overflow: 'hidden' }}>
            {keyPrefixes.map((prefix, prefixIdx) => (
              <div
                key={prefix}
                style={{
                  display: 'flex',
                  borderBottom: prefixIdx < keyPrefixes.length - 1 ? '1px solid #e2e8f0' : 'none',
                }}
              >
                {/* Y 轴标签 */}
                <div
                  style={{
                    width: 120,
                    padding: '8px 12px',
                    background: '#f8fafc',
                    borderRight: '1px solid #e2e8f0',
                    fontSize: 11,
                    color: '#0f172a',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  {prefix}
                </div>

                {/* 热力图单元格 */}
                <div style={{ display: 'flex', flex: 1 }}>
                  {Array.from({ length: 24 }, (_, hour) => {
                    const count = getCount(hour, prefix);
                    const color = getColor(count);
                    const isHoverable = count > 0;
                    
                    return (
                      <div
                        key={hour}
                        title={`${prefix} - ${String(hour).padStart(2, '0')}:00 - 访问次数: ${count}`}
                        style={{
                          flex: 1,
                          minWidth: 30,
                          height: 32,
                          background: color,
                          borderRight: hour < 23 ? '1px solid rgba(226, 232, 240, 0.5)' : 'none',
                          cursor: isHoverable ? 'pointer' : 'default',
                          transition: 'all 0.2s ease',
                          position: 'relative',
                        }}
                        onMouseEnter={(e) => {
                          if (isHoverable) {
                            e.currentTarget.style.transform = 'scale(1.1)';
                            e.currentTarget.style.zIndex = '10';
                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'scale(1)';
                          e.currentTarget.style.zIndex = '1';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                        {count > 0 && (
                          <div
                            style={{
                              position: 'absolute',
                              top: '50%',
                              left: '50%',
                              transform: 'translate(-50%, -50%)',
                              fontSize: 9,
                              color: count > maxCount * 0.5 ? '#fff' : '#0f172a',
                              fontWeight: 600,
                              textShadow: count > maxCount * 0.5 ? '0 1px 2px rgba(0,0,0,0.3)' : 'none',
                            }}
                          >
                            {count}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 图例 */}
      <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: '#64748b' }}>访问频率：</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 20, height: 12, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 2 }} />
          <span style={{ fontSize: 10, color: '#64748b' }}>无</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 20, height: 12, background: 'rgba(59, 130, 246, 0.3)', borderRadius: 2 }} />
          <span style={{ fontSize: 10, color: '#64748b' }}>低</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 20, height: 12, background: 'rgba(16, 185, 129, 0.5)', borderRadius: 2 }} />
          <span style={{ fontSize: 10, color: '#64748b' }}>中</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 20, height: 12, background: 'rgba(251, 191, 36, 0.7)', borderRadius: 2 }} />
          <span style={{ fontSize: 10, color: '#64748b' }}>高</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 20, height: 12, background: 'rgba(239, 68, 68, 0.8)', borderRadius: 2 }} />
          <span style={{ fontSize: 10, color: '#64748b' }}>极高</span>
        </div>
      </div>
    </div>
  );
}