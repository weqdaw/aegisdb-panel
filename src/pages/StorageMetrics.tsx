import { useEffect, useMemo, useState, useCallback } from 'react';


type ApiStore = {
  id: number;
  address: string;
  state: string;
  region_count: number;
  leader_count: number;
  region_size: number;
  leader_size: number;
};

type StoreLoadView = {
  store_id: number;
  region_count: number;
  leader_count: number;
  region_size: number;
  leader_size: number;
};

type MockStoreStorageStat = {
  capacity: number;
  used: number;
  read_iops: number;
  write_iops: number;
  block_cache_hit: number; // 0~1
  l0_files: number;
  sst_files: number;
  compaction_pending_bytes: number;
  wal_size: number;
  memtable_size: number;
};

function formatBytes(n: number) {
  if (!n || n < 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let i = 0;
  let num = n;
  while (num >= 1024 && i < units.length - 1) {
    num /= 1024;
    i++;
  }
  return `${num.toFixed(num >= 100 ? 0 : num >= 10 ? 1 : 2)} ${units[i]}`;
}

function formatNumber(n: number) {
  try {
    return new Intl.NumberFormat().format(n || 0);
  } catch {
    return String(n || 0);
  }
}

export default function StorageMetrics() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [stores, setStores] = useState<ApiStore[]>([]);
  const [loads, setLoads] = useState<StoreLoadView[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function fetchAll() {
      setLoading(true);
      setError(null);
      try {
        const [storesRes, loadsRes] = await Promise.all([
          fetch('/api/stores'),
          fetch('/api/storeloads'),
        ]);

        if (!storesRes.ok || !loadsRes.ok) {
          const msg = `HTTP error: stores=${storesRes.status}, storeloads=${loadsRes.status}`;
          throw new Error(msg);
        }

        const [storesJson, loadsJson] = await Promise.all([
          storesRes.json(),
          loadsRes.json(),
        ]);

        const normStores: ApiStore[] = Array.isArray(storesJson)
          ? storesJson.map((s: unknown) => {
              const o = (s ?? {}) as Record<string, unknown>;
              return {
                id: Number(o.id as number | string) || 0,
                address: String((o.address as string) ?? ''),
                state: String((o.state as string) ?? 'Up'),
                region_count: Number(o.region_count as number | string) || 0,
                leader_count: Number(o.leader_count as number | string) || 0,
                region_size: Number(o.region_size as number | string) || 0,
                leader_size: Number(o.leader_size as number | string) || 0,
              };
            })
          : [];

        const normLoads: StoreLoadView[] = Array.isArray(loadsJson)
          ? loadsJson.map((l: unknown) => {
              const o = (l ?? {}) as Record<string, unknown>;
              return {
                store_id: Number(o.store_id as number | string) || 0,
                region_count: Number(o.region_count as number | string) || 0,
                leader_count: Number(o.leader_count as number | string) || 0,
                region_size: Number(o.region_size as number | string) || 0,
                leader_size: Number(o.leader_size as number | string) || 0,
              };
            })
          : [];

        if (!cancelled) {
          setStores(normStores);
          setLoads(normLoads);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : String(e);
          setError(msg || '加载失败');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchAll();
    const t = setInterval(fetchAll, 5000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const loadsByStore = useMemo(() => {
    const m = new Map<number, StoreLoadView>();
    for (const l of loads) m.set(l.store_id, l);
    return m;
  }, [loads]);

  // ========= Mock helpers (deterministic by store id) =========
  function seededRand(seed: number, salt: number) {
    const x = Math.sin(seed * 9301 + salt * 49297) * 233280;
    return x - Math.floor(x);
  }

  const mockStatsForStore = useCallback((id: number): MockStoreStorageStat => {
    // Capacity ~70-100GB (we will normalize total to 800GB later)
    const cap = (70 + seededRand(id, 1) * 30) * 1024 ** 3;
    // Used 45%~88%
    const usedRatio = 0.45 + seededRand(id, 2) * 0.43;
    const used = cap * usedRatio;
    // IO
    const read_iops = Math.floor(400 + seededRand(id, 3) * 4600);
    const write_iops = Math.floor(350 + seededRand(id, 4) * 4200);
    // RocksDB-related
    const block_cache_hit = 0.86 + seededRand(id, 5) * 0.12; // 0.86~0.98
    const l0_files = Math.floor(seededRand(id, 6) * 24);
    const sst_files = Math.floor(80 + seededRand(id, 7) * 420);
    const compaction_pending_bytes = Math.floor(seededRand(id, 8) * 18 * 1024 ** 3); // up to 18GB
    const wal_size = Math.floor(256 * 1024 ** 2 + seededRand(id, 9) * 3.8 * 1024 ** 3);
    const memtable_size = Math.floor(64 * 1024 ** 2 + seededRand(id, 10) * 1.8 * 1024 ** 3);
    return {
      capacity: Math.floor(cap),
      used: Math.floor(used),
      read_iops,
      write_iops,
      block_cache_hit: Math.min(0.99, Math.max(0.5, block_cache_hit)),
      l0_files,
      sst_files,
      compaction_pending_bytes,
      wal_size,
      memtable_size,
    };
  }, []);

  // Merge actual stores with loads and ensure we display 10 nodes (mock-filled if fewer)
  const storeRows = useMemo(() => {
    const actual = stores.map((s, idx) => {
      const l = loadsByStore.get(s.id);
      const stats = mockStatsForStore(s.id || (1000 + idx));
      return {
        id: s.id,
        address: s.address,
        state: s.state,
        region_count: s.region_count,
        leader_count: s.leader_count,
        region_size: l ? l.region_size : s.region_size,
        leader_size: l ? l.leader_size : s.leader_size,
        stats,
      };
    });
    // If fewer than 10, synthesize nodes to reach 10
    const need = Math.max(0, 10 - actual.length);
    for (let i = 0; i < need; i++) {
      const id = 9000 + i + 1;
      const addr = `127.0.0.1:${20160 + i}`;
      const stats = mockStatsForStore(id);
      actual.push({
        id,
        address: addr,
        state: 'Up',
        region_count: Math.floor(5 + seededRand(id, 11) * 30),
        leader_count: Math.floor(2 + seededRand(id, 12) * 15),
        region_size: Math.floor(seededRand(id, 13) * 30 * 1024 ** 3), // up to 30GB
        leader_size: Math.floor(seededRand(id, 14) * 20 * 1024 ** 3), // up to 20GB
        stats,
      });
    }
    // Normalize total capacity to 800 GB across the 10 nodes
    const desiredTotal = 800 * 1024 ** 3;
    const totalCap = actual.reduce((a, r) => a + (r.stats.capacity || 0), 0);
    if (totalCap > 0) {
      const scale = desiredTotal / totalCap;
      for (const r of actual) {
        r.stats.capacity = Math.max(1, Math.floor(r.stats.capacity * scale));
        r.stats.used = Math.min(r.stats.capacity, Math.floor(r.stats.used * scale));
      }
    }
    // Sort by address for stable UI
    actual.sort((a, b) => (a.address > b.address ? 1 : a.address < b.address ? -1 : 0));
    return actual.slice(0, 10);
  }, [stores, loadsByStore, mockStatsForStore]);

  const clusterView = useMemo(() => {
    const totalCapacity = storeRows.reduce((a, r) => a + (r.stats.capacity || 0), 0);
    const totalUsed = storeRows.reduce((a, r) => a + (r.stats.used || 0), 0);
    const perStore = storeRows.map((r) => {
      const cap = r.stats.capacity || 0;
      const used = r.stats.used || 0;
      const util = cap > 0 ? used / cap : 0;
      return {
        key: r.address,
        address: r.address,
        capacity: cap,
        used,
        util,
      };
    });
    return { totalCapacity, totalUsed, perStore };
  }, [storeRows]);

  return (
    <div style={{ padding: 16 }}>
      <h2>存储监控</h2>

      {loading && <div>加载中...</div>}
      {error && (
        <div style={{ color: 'red', marginBottom: 12 }}>
          {error}
        </div>
      )}

      {/* Store 一览（卡片视图） */}
      <section>
        <h3>Store 一览</h3>
        {storeRows.length > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 12,
            marginTop: 8,
          }}>
            {storeRows.map((r) => {
              const util = r.stats.capacity ? r.stats.used / r.stats.capacity : 0;
              const palette = {
                primary: '#3b82f6',
                success: '#10b981',
                warning: '#f59e0b',
                danger: '#ef4444',
                accent: '#8b5cf6',
                slate600: '#475569',
                slate500: '#64748b',
              };
              return (
                <div key={r.address} style={{
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: 10,
                  padding: 12,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontWeight: 600, color: palette.slate600, fontSize: 14 }}>{r.address}</div>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: 999,
                      fontSize: 12,
                      color: '#fff',
                      background: r.state === 'Up' ? palette.success : r.state === 'Down' ? palette.danger : palette.warning,
                    }}>{r.state}</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr auto', gap: 10, alignItems: 'center', margin: '6px 0' }}>
                    <div style={{ fontSize: 12, color: palette.slate500 }}>容量</div>
                    <div style={{ background: '#eef2f7', height: 10, borderRadius: 6, overflow: 'hidden' }}>
                      <div style={{
                        width: `${Math.min(100, Math.max(0, Math.round(util * 100)))}%`,
                        height: '100%',
                        background: util < 0.6 ? palette.primary : util < 0.8 ? palette.warning : palette.danger,
                      }} />
                    </div>
                    <div style={{ fontSize: 12, color: palette.slate600 }}>
                      {formatBytes(r.stats.used)} / {formatBytes(r.stats.capacity)} ({(util * 100).toFixed(1)}%)
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr auto', gap: 10, alignItems: 'center', margin: '6px 0' }}>
                    <div style={{ fontSize: 12, color: palette.slate500 }}>Region/Leader</div>
                    <div style={{ fontSize: 12, color: palette.slate600 }}>
                      {formatNumber(r.region_count)} / {formatNumber(r.leader_count)}
                    </div>
                    <div style={{ fontSize: 12, color: palette.slate600 }}>
                      {formatBytes(r.region_size)} / {formatBytes(r.leader_size)}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
                    <div style={{ fontSize: 12, color: palette.slate500 }}>读 IOPS: <b style={{ color: palette.primary }}>{formatNumber(r.stats.read_iops)}</b></div>
                    <div style={{ fontSize: 12, color: palette.slate500 }}>写 IOPS: <b style={{ color: palette.accent }}>{formatNumber(r.stats.write_iops)}</b></div>
                    <div style={{ fontSize: 12, color: palette.slate500 }}>BlockCache: <b style={{ color: palette.success }}>{(r.stats.block_cache_hit * 100).toFixed(1)}%</b></div>
                    <div style={{ fontSize: 12, color: palette.slate500 }}>L0: <b>{formatNumber(r.stats.l0_files)}</b></div>
                    <div style={{ fontSize: 12, color: palette.slate500 }}>SST: <b>{formatNumber(r.stats.sst_files)}</b></div>
                  </div>

                  {/* 存储状态图（紧凑条形图组） */}
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8 }}>
                    <span style={{ fontSize: 12, color: palette.slate500, width: 54 }}>利用率</span>
                    <div style={{ width: 80, background: '#eef2f7', height: 8, borderRadius: 6, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.max(0, Math.min(100, util * 100))}%`, height: '100%', background: util < 0.6 ? palette.primary : util < 0.8 ? palette.warning : palette.danger }} />
                    </div>
                    <span style={{ fontSize: 12, color: palette.slate600 }}>{(util * 100).toFixed(0)}%</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6 }}>
                    <span style={{ fontSize: 12, color: palette.slate500, width: 54 }}>读/写</span>
                    <div style={{ width: 80, background: '#eef2f7', height: 8, borderRadius: 6, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, (r.stats.read_iops / 5000) * 100)}%`, height: '100%', background: palette.primary }} />
                    </div>
                    <div style={{ width: 80, background: '#eef2f7', height: 8, borderRadius: 6, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, (r.stats.write_iops / 4500) * 100)}%`, height: '100%', background: palette.accent }} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
                    <div style={{ fontSize: 12, color: palette.slate500 }}>Compaction 待处理: <b>{formatBytes(r.stats.compaction_pending_bytes)}</b></div>
                    <div style={{ fontSize: 12, color: palette.slate500 }}>WAL: <b>{formatBytes(r.stats.wal_size)}</b></div>
                    <div style={{ fontSize: 12, color: palette.slate500 }}>Memtable: <b>{formatBytes(r.stats.memtable_size)}</b></div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div>暂无数据</div>
        )}
      </section>

      {/* 存储状态图（聚合视图） */}
      <section style={{ marginTop: 16 }}>
        <h3>存储状态图</h3>
        {storeRows.length > 0 ? (
          <div style={{ display: 'grid', gap: 12, marginTop: 8 }}>
            {/* 集群总容量占用 */}
            <div>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>集群总容量</div>
              <div style={{ background: '#eef2f7', borderRadius: 8, height: 14, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${Math.min(100, Math.max(0, (clusterView.totalUsed / Math.max(1, clusterView.totalCapacity)) * 100))}%`,
                    height: '100%',
                    background:
                      (clusterView.totalUsed / Math.max(1, clusterView.totalCapacity)) < 0.6
                        ? '#3b82f6'
                        : (clusterView.totalUsed / Math.max(1, clusterView.totalCapacity)) < 0.8
                        ? '#f59e0b'
                        : '#ef4444',
                  }}
                />
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: '#475569' }}>
                {formatBytes(clusterView.totalUsed)} / {formatBytes(clusterView.totalCapacity)} (
                {(
                  (clusterView.totalUsed / Math.max(1, clusterView.totalCapacity)) *
                  100
                ).toFixed(1)}
                %)
              </div>
            </div>

            {/* 分 Store 容量占比分片条（宽度按容量占比，颜色按利用率） */}
            <div>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>各 Store 容量与利用率</div>
              <div style={{ display: 'flex', width: '100%', height: 18, borderRadius: 10, overflow: 'hidden', background: '#f5f7fb' }}>
                {clusterView.perStore.map((s) => {
                  const widthPct = clusterView.totalCapacity > 0 ? (s.capacity / clusterView.totalCapacity) * 100 : 0;
                  const color = s.util < 0.6 ? '#3b82f6' : s.util < 0.8 ? '#f59e0b' : '#ef4444';
                  return (
                    <div key={s.key} style={{ position: 'relative', width: `${widthPct}%`, minWidth: 2, background: '#eef2f7' }}>
                      <div
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: `${Math.min(100, Math.max(0, s.util * 100))}%`,
                          background: color,
                        }}
                      />
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
                {clusterView.perStore.map((s) => {
                  const color = s.util < 0.6 ? '#3b82f6' : s.util < 0.8 ? '#f59e0b' : '#ef4444';
                  return (
                    <div key={s.key} style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{
                          display: 'inline-block',
                          width: 8,
                          height: 8,
                          borderRadius: 2,
                          background: color,
                        }}
                      />
                      <span style={{ color: '#475569' }}>{s.address}</span>
                      <span>({(s.util * 100).toFixed(0)}%)</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div>暂无数据</div>
        )}
      </section>
    </div>
  );
  }