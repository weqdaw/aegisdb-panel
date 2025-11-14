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

const TIER_LABELS: Record<TierName, string> = { hot: '热层', warm: '温层', cold: '冷层' };
const TIER_COLORS: Record<TierName, string> = { hot: '#ef4444', warm: '#f59e0b', cold: '#3b82f6' };
const TIER_NAMES: TierName[] = ['hot', 'warm', 'cold'];
const TIER_PAGE_SIZE_OPTIONS: TierPageSizeOption[] = [5, 10, 20, 'all'];
const EVENT_PAGE_SIZE_OPTIONS: PageSizeOption[] = [10, 20, 50, 'all'];

export default function BizMetrics() {
  const [metrics, setMetrics] = useState<Metrics>({ put: 0, get: 0, del: 0, err: 0 });
  const [events, setEvents] = useState<Event[]>([]);
  const [tiers, setTiers] = useState<TierSnapshot>({ hot: [], warm: [], cold: [] });
  const [activeTier, setActiveTier] = useState<TierName>('hot');
  const [tierPage, setTierPage] = useState<Record<TierName, number>>(() => ({ hot: 0, warm: 0, cold: 0 }));
  const [tierPageSize, setTierPageSize] = useState<TierPageSizeOption>(10);
  const [pageSize, setPageSize] = useState<PageSizeOption>(10);
  const [page, setPage] = useState(0);
  const base = 'http://127.0.0.1:8088';
  const pageSizeOptions = EVENT_PAGE_SIZE_OPTIONS;

  const refresh = async () => {
    try {
      const [m, e, t] = await Promise.all([
        fetch(`${base}/api/biz/metrics`).then(r => r.json()),
        fetch(`${base}/api/biz/events`).then(r => r.json()),
        fetch(`${base}/api/storage/tiers`).then(r => r.json()),
      ]);
      setMetrics(m);
      setEvents(e);
      setTiers(t);
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

  return (
    <div style={{ display: 'grid', gap: 16 }}>
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