// src/pages/ClusterOverview.tsx
import { useEffect, useMemo, useRef, useState } from 'react';

type ClusterSummary = {
  cluster_id: number;
  store_count: number;
  region_count: number;
  leader_count: number;
  total_region_size: number;
};

type ApiStore = {
  id: number;
  address: string;
  state: string;
  region_count: number;
  leader_count: number;
  region_size: number;
  leader_size: number;
  // extended metrics
  healthy: boolean;
  avg_resp_ms: number;
  error_count: number;
  mem_total: number;
  mem_used: number;
  disk_total: number;
  disk_used: number;
  network_state: string;
};

type SortKey = keyof ApiStore;
type SortOrder = 'asc' | 'desc';

const nf = new Intl.NumberFormat();
  const fmtBytes = (n: number) => {
    if (!n) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(Math.floor(Math.log2(n) / 10), units.length - 1);
    return `${(n / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
};

export default function ClusterOverview() {
  const [summary, setSummary] = useState<ClusterSummary | null>(null);
  const [stores, setStores] = useState<ApiStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('id');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  // Support multiple admin endpoints aggregation
  const env = import.meta.env as Record<string, string | undefined>;
  const baseEnv = env.VITE_API_BASE;
  const basesEnv = env.VITE_API_BASES;
  const bases: string[] = (basesEnv
    ? basesEnv.split(',').map(s => s.trim()).filter(Boolean)
    : (baseEnv ? [baseEnv] : Array.from({ length: 10 }, (_, i) => `http://localhost:${8080 + i}`)));
  const basesKey = bases.join(',');

  useEffect(() => {
    setLoading(true);
    (async () => {
      try {
        const basesLocal = basesKey ? basesKey.split(',').filter(Boolean) : [];
        const [summaries, storesLists] = await Promise.all([
          Promise.all(basesLocal.map(b =>
            fetch(`${b}/api/cluster/summary`).then(r => r.ok ? r.json() : null).catch(() => null)
          )),
          Promise.all(basesLocal.map(b =>
            fetch(`${b}/api/stores`).then(r => r.ok ? r.json() : []).catch(() => [])
          )),
        ]);
        const allStores: ApiStore[] = ([] as ApiStore[]).concat(...storesLists);
        // normalize to avoid NaN in UI if backend omits extended metrics
        const normalizedStores: ApiStore[] = allStores.map((s: any) => ({
          id: Number(s.id) || 0,
          address: String(s.address ?? ''),
          state: String(s.state ?? 'Up'),
          region_count: Number(s.region_count) || 0,
          leader_count: Number(s.leader_count) || 0,
          region_size: Number(s.region_size) || 0,
          leader_size: Number(s.leader_size) || 0,
          healthy: s.healthy === undefined ? true : Boolean(s.healthy),
          avg_resp_ms: Number(s.avg_resp_ms) || 0,
          error_count: Number(s.error_count) || 0,
          mem_total: Number(s.mem_total) || 0,
          mem_used: Number(s.mem_used) || 0,
          disk_total: Number(s.disk_total) || 0,
          disk_used: Number(s.disk_used) || 0,
          network_state: String(s.network_state ?? 'normal'),
        }));
        // Build a combined summary
        const firstSummary = summaries.find(s => !!s);
        const combined: ClusterSummary | null = firstSummary ? {
          cluster_id: firstSummary.cluster_id ?? 0,
          store_count: normalizedStores.length,
          region_count: normalizedStores.reduce((a, s) => a + (s.region_count || 0), 0),
          leader_count: normalizedStores.reduce((a, s) => a + (s.leader_count || 0), 0),
          total_region_size: normalizedStores.reduce((a, s) => a + (s.region_size || 0), 0),
        } : null;
        setSummary(combined);
        setStores(normalizedStores);
      } catch (e) {
        console.error(e);
        setSummary(null);
        setStores([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [basesKey]);

  // palette
  const palette = {
    primary: '#2563eb', // blue-600
    primarySoft: '#dbeafe', // blue-100
    success: '#16a34a', // green-600
    successSoft: '#dcfce7', // green-100
    warning: '#d97706', // amber-600
    warningSoft: '#fef3c7', // amber-100
    danger: '#dc2626', // red-600
    dangerSoft: '#fee2e2', // red-100
    purple: '#7c3aed',
    purpleSoft: '#ede9fe',
    slate: '#0f172a',
    slateSoft: '#f1f5f9',
    border: '#eef2f7',
  };

  const sortedStores = useMemo(() => {
    const data = [...stores];
    data.sort((a, b) => {
      const va = a[sortKey] as string | number;
      const vb = b[sortKey] as string | number;
      let cmp = 0;
      if (typeof va === 'number' && typeof vb === 'number') {
        cmp = va - vb;
      } else {
        cmp = String(va).localeCompare(String(vb));
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
    return data;
  }, [stores, sortKey, sortOrder]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const sortIcon = (key: SortKey) => {
    if (key !== sortKey) return '↕';
    return sortOrder === 'asc' ? '▲' : '▼';
  };

  const getStateBadge = (state: string) => {
    const normalized = state.toLowerCase();
    let bg = palette.successSoft;
    let fg = palette.success;
    if (normalized.includes('tomb') || normalized.includes('down') || normalized.includes('error')) {
      bg = palette.dangerSoft; fg = palette.danger;
    } else if (normalized.includes('offline') || normalized.includes('pause')) {
      bg = palette.warningSoft; fg = palette.warning;
    } else if (normalized.includes('up') || normalized.includes('normal')) {
      bg = palette.successSoft; fg = palette.success;
    } else {
      bg = palette.purpleSoft; fg = palette.purple;
    }
    const style: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 8px',
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 600,
      color: fg,
      background: bg,
      border: `1px solid ${fg}20`,
    };
    return <span style={style}>{state}</span>;
  };

  // utilization helpers
  const maxRegionSize = Math.max(...(stores.map(s => s.region_size)), 1);
  const maxLeaderSize = Math.max(...(stores.map(s => s.leader_size)), 1);
  const barWrap: React.CSSProperties = {
    width: '100%',
    background: palette.slateSoft,
    borderRadius: 6,
    height: 8,
    overflow: 'hidden',
  };
  const barInner = (ratio: number, color: string): React.CSSProperties => ({
    width: `${Math.max(2, Math.min(100, Math.round(ratio * 100)))}%`,
    height: '100%',
    background: color,
  });

  // styles
  const container: React.CSSProperties = {
    padding: 24,
    background: '#f7f9fc',
    minHeight: '100vh',
    color: '#0f172a',
  };
  const miniCardsGrid: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 12,
    marginBottom: 16,
  };
  const headerWrap: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  };
  const title: React.CSSProperties = {
    margin: 0,
    fontSize: 20,
    fontWeight: 600,
    letterSpacing: 0.2,
  };
  const cardsGrid: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
    gap: 16,
    marginBottom: 20,
  };
  const card: React.CSSProperties = {
    background: '#fff',
    border: '1px solid #eef2f7',
    borderRadius: 12,
    padding: 16,
    boxShadow: '0 1px 2px rgba(16,24,40,0.06)',
    position: 'relative',
  };
  const miniCard: React.CSSProperties = {
    ...card,
    padding: 12,
  };
  const cardStripe = (from: string, to: string): React.CSSProperties => ({
    position: 'absolute',
    inset: 0,
    height: 4,
    background: `linear-gradient(90deg, ${from}, ${to})`,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  });
  const cardLabel: React.CSSProperties = {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 8,
  };
  const cardValue: React.CSSProperties = {
    fontSize: 22,
    fontWeight: 700,
  };
  const cardValueSmall: React.CSSProperties = {
    fontSize: 18,
    fontWeight: 700,
  };
  const cardIcon = (bg: string, fg: string): React.CSSProperties => ({
    width: 28,
    height: 28,
    borderRadius: 8,
    background: bg,
    color: fg,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    fontSize: 14,
    border: `1px solid ${fg}20`,
  });
  const panelTitle: React.CSSProperties = {
    margin: '8px 0 12px',
    fontSize: 16,
    fontWeight: 600,
  };
  const tableWrap: React.CSSProperties = {
    background: '#fff',
    border: '1px solid #eef2f7',
    borderRadius: 12,
    boxShadow: '0 1px 2px rgba(16,24,40,0.06)',
    overflow: 'hidden',
  };
  const table: React.CSSProperties = {
    borderCollapse: 'separate',
    borderSpacing: 0,
    width: '100%',
  };
  const thCommon: React.CSSProperties = {
    textAlign: 'left',
    fontWeight: 600,
    fontSize: 12,
    color: '#475569',
    background: '#f8fafc',
    padding: '12px 12px',
    borderBottom: '1px solid #eef2f7',
    userSelect: 'none',
    cursor: 'pointer',
    position: 'sticky',
    top: 0,
    zIndex: 1,
  };
  const tdCommon: React.CSSProperties = {
    padding: '12px 12px',
    borderBottom: '1px solid #f1f5f9',
    fontSize: 14,
    color: '#0f172a',
  };
  const trZebra = (idx: number, hovered: boolean): React.CSSProperties => ({
    background: hovered ? '#f1f5ff' : (idx % 2 === 0 ? '#ffffff' : '#fcfcff'),
    transition: 'background 120ms ease',
  });
  const thButton = (active: boolean): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    color: active ? '#0f172a' : '#475569',
  });
  const empty: React.CSSProperties = {
    padding: 16,
    textAlign: 'center',
    color: '#64748b',
  };
  const detailWrap: React.CSSProperties = {
    background: '#fbfdff',
    borderTop: '1px dashed #e5e7eb',
    padding: 12,
  };
  const metricRow: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 12,
  };
  const metricCard: React.CSSProperties = {
    background: '#fff',
    border: '1px solid #eef2f7',
    borderRadius: 10,
    padding: 10,
  };
  const k: React.CSSProperties = { fontSize: 12, color: '#64748b', marginBottom: 4 };
  const v: React.CSSProperties = { fontSize: 14, fontWeight: 600 };

  // ---------- Local machine metrics (compact) ----------
  type SystemDisk = { name: string; total: number; used: number; };
  type SystemNet = { rx_bytes: number; tx_bytes: number; };
  type SystemMetrics = {
    cpu_usage_percent: number;
    mem_total: number;
    mem_used: number;
    disks: SystemDisk[];
    net: SystemNet;
  };
  const [sys, setSys] = useState<SystemMetrics | null>(null);
  const [sysLoading, setSysLoading] = useState(true);
  const [sysErr, setSysErr] = useState<string | null>(null);
  const lastRx = useRef<number>(0);
  const lastTx = useRef<number>(0);
  const lastTs = useRef<number>(0);
  const [rxRate, setRxRate] = useState<number>(0);
  const [txRate, setTxRate] = useState<number>(0);
  const sysBase = useMemo(() => {
    const arr = basesKey ? basesKey.split(',').filter(Boolean) : [];
    return arr[0] || 'http://127.0.0.1:8080';
  }, [basesKey]);
  useEffect(() => {
    let mounted = true;
    const fetchOnce = async () => {
      try {
        const res = await fetch(`${sysBase}/api/system`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as SystemMetrics;
        if (!mounted) return;
        setSys(data);
        setSysLoading(false);
        setSysErr(null);
        const now = Date.now();
        if (lastTs.current > 0) {
          const dt = (now - lastTs.current) / 1000;
          if (dt > 0) {
            const drx = Math.max(0, data.net.rx_bytes - lastRx.current);
            const dtx = Math.max(0, data.net.tx_bytes - lastTx.current);
            setRxRate(drx / dt);
            setTxRate(dtx / dt);
          }
        }
        lastTs.current = now;
        lastRx.current = data.net.rx_bytes;
        lastTx.current = data.net.tx_bytes;
      } catch (e: unknown) {
        if (!mounted) return;
        const msg = e instanceof Error ? e.message : String(e);
        setSysErr(msg || 'fetch error');
        setSysLoading(false);
      }
    };
    fetchOnce();
    const t = setInterval(fetchOnce, 1000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, [sysBase]);

  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const toggleExpand = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ---------- Topology simulation ----------
  type Role = 'primary' | 'replica' | 'cache' | 'storage';
  type Consistency = 'strong' | 'eventual';
  type LinkType = 'replication' | 'sync' | 'cache_update' | 'load_balancing';
  type TopologyNode = {
    id: number;
    label: string;
    role: Role;
    consistency: Consistency;
    healthy: boolean;
    securityScore: number; // 0-100
    trafficMBps: number;   // MB/s
    cpuLoad: number;       // 0-1
    memLoad: number;       // 0-1
    x: number;
    y: number;
  };
  type TopologyLink = {
    from: number;
    to: number;
    kind: LinkType;
  };

  const topoPalette = {
    primary: '#2563eb',
    replica: '#10b981',
    cache: '#f59e0b',
    storage: '#7c3aed',
    text: '#0f172a',
    grid: '#eef2f7',
    bg: '#ffffff',
    edge: '#94a3b8',
    edgeStrong: '#0ea5e9',
    edgeEventual: '#a78bfa',
  };

  const roleColor = (r: Role) => {
    if (r === 'primary') return topoPalette.primary;
    if (r === 'replica') return topoPalette.replica;
    if (r === 'cache') return topoPalette.cache;
    return topoPalette.storage;
  };

  const linkStyle = (k: LinkType) => {
    switch (k) {
      case 'replication':
        return { stroke: topoPalette.edgeStrong, dash: '0', width: 2.5, label: '数据复制' };
      case 'sync':
        return { stroke: topoPalette.edge, dash: '4,4', width: 2, label: '数据同步' };
      case 'cache_update':
        return { stroke: '#f97316', dash: '2,6', width: 2, label: '缓存更新' };
      case 'load_balancing':
        return { stroke: '#22c55e', dash: '8,6', width: 2, label: '负载均衡' };
      default:
        return { stroke: topoPalette.edge, dash: '0', width: 2, label: '' };
    }
  };

  const topology = useMemo(() => {
    const count = Math.max(3, Math.min(10, stores.length || 6));
    const baseWidth = 1100;
    const baseHeight = 520;
    const cx = baseWidth / 2;
    const cy = baseHeight / 2 + 10;
    const radius = Math.min(baseWidth, baseHeight) / 2 - 80;

    // Assign roles: 1 primary, ~1/2 replicas, 1 cache, rest storage
    const ids = (stores.length ? stores : Array.from({ length: count }).map((_, i) => ({
      id: i + 1,
      address: `127.0.0.1:20${160 + i + 1}`,
      state: 'Up',
      region_count: 1,
      leader_count: i === 0 ? 1 : 0,
      region_size: 1024 * (i + 1),
      leader_size: i === 0 ? 1024 : 0,
      healthy: true,
      avg_resp_ms: 3 + (i % 4),
      error_count: 0,
      mem_total: 16 * 1024,
      mem_used: 4 * 1024 + i * 128,
      disk_total: 256 * 1024,
      disk_used: 24 * 1024 + i * 1024,
      network_state: 'normal',
    } as ApiStore))).map(s => s.id);

    // Map storeId -> role
    const sortedIds = [...ids].sort((a, b) => a - b);
    const primaryId = sortedIds[0];
    const cacheId = sortedIds.length > 3 ? sortedIds[1] : sortedIds[sortedIds.length - 1];
    const replicas: number[] = sortedIds.filter(id => id !== primaryId && id !== cacheId).slice(0, Math.max(1, Math.floor((sortedIds.length - 2) / 2)));
    const storageNodes: number[] = sortedIds.filter(id => id !== primaryId && id !== cacheId && !replicas.includes(id));

    // Generate nodes with simulated metrics tailored for a local i7 13th-gen PC
    const baseCpu = 0.08;  // 8% baseline
    const nodes: TopologyNode[] = [];
    const N = sortedIds.length;
    sortedIds.forEach((id, idx) => {
      const angle = (Math.PI * 2 * idx) / N - Math.PI / 2;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      const role: Role = id === primaryId ? 'primary' : (id === cacheId ? 'cache' : (replicas.includes(id) ? 'replica' : 'storage'));
      const consistency: Consistency = role === 'cache' ? 'eventual' : (role === 'primary' ? 'strong' : 'strong');
      // Simulate realistic loads
      const roleLoadBias = role === 'primary' ? 0.16 : role === 'replica' ? 0.10 : role === 'cache' ? 0.06 : 0.05;
      const cpuLoad = Math.min(0.65, baseCpu + roleLoadBias + (idx % 3) * 0.02);
      const memLoad = Math.min(0.78, 0.30 + (idx % 5) * 0.05 + (role === 'cache' ? 0.10 : 0));
      const trafficMBps =
        role === 'primary' ? 45 + (idx % 3) * 5 :
        role === 'replica' ? 18 + (idx % 4) * 3 :
        role === 'cache' ? 30 + (idx % 2) * 4 :
        12 + (idx % 3) * 2;
      const healthy = true;
      const securityScore = 78 + (idx % 5) * 3 - (role === 'cache' ? 4 : 0);

      nodes.push({
        id,
        label: `Node ${id}`,
        role,
        consistency,
        healthy,
        securityScore: Math.max(60, Math.min(95, securityScore)),
        trafficMBps,
        cpuLoad,
        memLoad,
        x,
        y,
      });
    });

    // Links
    const links: TopologyLink[] = [];
    // Primary -> Replicas replication
    replicas.forEach(rid => links.push({ from: primaryId, to: rid, kind: 'replication' }));
    // Primary <-> Cache sync and cache update
    links.push({ from: primaryId, to: cacheId, kind: 'sync' });
    links.push({ from: cacheId, to: primaryId, kind: 'cache_update' });
    // Load balancing across all nodes
    const lbTargets = [...replicas, ...storageNodes];
    lbTargets.forEach(tid => links.push({ from: cacheId, to: tid, kind: 'load_balancing' }));
    // Storage nodes receive occasional sync from primary
    storageNodes.forEach(sid => links.push({ from: primaryId, to: sid, kind: 'sync' }));

    return {
      width: baseWidth,
      height: baseHeight,
      nodes,
      links,
    };
  }, [stores]);

  const legendItem = (color: string, label: string, dash?: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#334155' }}>
      <span style={{
        display: 'inline-block',
        width: 22,
        height: 0,
        borderTop: `${dash ? 2 : 3}px ${dash ? 'dashed' : 'solid'} ${color}`,
      }} />
      <span>{label}</span>
    </div>
  );

  // ---------- Interaction: zoom / pan / drag ----------
  type Viewport = { scale: number; tx: number; ty: number };
  const [view, setView] = useState<Viewport>({ scale: 1, tx: 0, ty: 0 });
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const zoomAtPoint = (delta: number, x: number, y: number) => {
    setView(prev => {
      const scale = clamp(prev.scale * (delta > 0 ? 0.9 : 1.1), 0.5, 2.0);
      // Zoom around pointer: adjust translate so that point stays in place
      const k = scale / prev.scale;
      const tx = x - k * (x - prev.tx);
      const ty = y - k * (y - prev.ty);
      return { scale, tx, ty };
    });
  };
  const onWheel: React.WheelEventHandler<SVGSVGElement> = (e) => {
    e.preventDefault();
    const svg = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - svg.left;
    const py = e.clientY - svg.top;
    zoomAtPoint(e.deltaY, px, py);
  };
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const onBgMouseDown: React.MouseEventHandler<SVGRectElement> = (e) => {
    setIsPanning(true);
    setPanStart({ x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty });
  };
  const onMouseMove: React.MouseEventHandler<SVGSVGElement> = (e) => {
    if (isPanning && panStart) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      setView(prev => ({ ...prev, tx: panStart.tx + dx, ty: panStart.ty + dy }));
    }
    if (dragging && dragInfo) {
      const svg = e.currentTarget.getBoundingClientRect();
      const px = (e.clientX - svg.left - view.tx) / view.scale;
      const py = (e.clientY - svg.top - view.ty) / view.scale;
      setNodePositions(prev => {
        const next = new Map(prev);
        next.set(dragInfo.id, { x: px - dragInfo.offsetX, y: py - dragInfo.offsetY });
        return next;
      });
    }
  };
  const onMouseUp: React.MouseEventHandler<SVGSVGElement> = () => {
    setIsPanning(false);
    setPanStart(null);
    setDragging(false);
    setDragInfo(null);
  };
  const onMouseLeave: React.MouseEventHandler<SVGSVGElement> = () => {
    setIsPanning(false);
    setPanStart(null);
    setDragging(false);
    setDragInfo(null);
  };
  // Node dragging
  const [nodePositions, setNodePositions] = useState<Map<number, { x: number; y: number }>>(new Map());
  const [dragging, setDragging] = useState(false);
  const [dragInfo, setDragInfo] = useState<{ id: number; offsetX: number; offsetY: number } | null>(null);
  // Initialize nodePositions when topology changes the first time
  useEffect(() => {
    if (nodePositions.size === 0 && topology.nodes.length > 0) {
      const next = new Map<number, { x: number; y: number }>();
      topology.nodes.forEach(n => next.set(n.id, { x: n.x, y: n.y }));
      setNodePositions(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topology.nodes.length]);
  const startDrag = (e: React.MouseEvent<SVGGElement>, nodeId: number) => {
    e.stopPropagation();
    setDragging(true);
    const svg = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const px = (e.clientX - svg.left - view.tx) / view.scale;
    const py = (e.clientY - svg.top - view.ty) / view.scale;
    const pos = nodePositions.get(nodeId);
    const offsetX = pos ? px - pos.x : 0;
    const offsetY = pos ? py - pos.y : 0;
    setDragInfo({ id: nodeId, offsetX, offsetY });
  };

  return (
    <div style={container}>
      <div style={headerWrap}>
        <div>
          <h3 style={title}>集群概览</h3>
        </div>
      </div>

      {/* Local machine performance - compact */}
      <div style={miniCardsGrid}>
        <div style={miniCard}>
          <div style={cardStripe(palette.primary, palette.success)} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={cardLabel}>CPU 使用率</div>
            <div style={cardValueSmall}>{sys ? `${sys.cpu_usage_percent.toFixed(1)}%` : (sysLoading ? '...' : '--')}</div>
          </div>
          <div style={{ background: '#eef2f7', height: 8, borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, Math.max(0, sys?.cpu_usage_percent ?? 0))}%`, height: '100%', background: palette.danger }} />
          </div>
        </div>
        <div style={miniCard}>
          <div style={cardStripe(palette.purple, palette.warning)} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={cardLabel}>内存</div>
            <div style={cardValueSmall}>
              {sys ? `${fmtBytes(sys.mem_used)} / ${fmtBytes(sys.mem_total)}` : (sysLoading ? '...' : '--')}
            </div>
          </div>
          <div style={{ background: '#eef2f7', height: 8, borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ width: `${sys ? Math.min(100, Math.max(0, Math.round((sys.mem_used / Math.max(1, sys.mem_total)) * 100))) : 0}%`, height: '100%', background: palette.warning }} />
          </div>
        </div>
        <div style={miniCard}>
          <div style={cardStripe(palette.primary, palette.purple)} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={cardLabel}>磁盘</div>
            <div style={cardValueSmall}>
              {sys && sys.disks && sys.disks.length > 0
                ? (() => {
                    const used = sys.disks.reduce((a, d) => a + (d?.used ?? 0), 0);
                    const total = sys.disks.reduce((a, d) => a + (d?.total ?? 0), 0);
                    return `${fmtBytes(used)} / ${fmtBytes(total)}`;
                  })()
                : (sysLoading ? '...' : '--')}
            </div>
          </div>
          <div style={{ background: '#eef2f7', height: 8, borderRadius: 6, overflow: 'hidden' }}>
            <div
              style={{
                width: `${
                  sys && sys.disks && sys.disks.length > 0
                    ? Math.min(
                        100,
                        Math.max(
                          0,
                          Math.round(
                            (sys.disks.reduce((a, d) => a + (d?.used ?? 0), 0) /
                              Math.max(1, sys.disks.reduce((a, d) => a + (d?.total ?? 0), 0))) *
                              100,
                          ),
                        ),
                      )
                    : 0
                }%`,
                height: '100%',
                background: palette.primary,
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            {sys && sys.disks && sys.disks.length > 0
              ? sys.disks
                  .slice(0, 2)
                  .map((d) => {
                    const p =
                      d.total > 0 ? Math.round((Math.max(0, Math.min(d.used, d.total)) / d.total) * 100) : 0;
                    return (
                      <span key={d.name} style={{ fontSize: 11, color: '#64748b' }}>
                        {d.name}: {p}%
                      </span>
                    );
                  })
              : null}
          </div>
        </div>
        <div style={miniCard}>
          <div style={cardStripe(palette.success, palette.primary)} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={cardLabel}>网络吞吐</div>
            <div style={cardValueSmall}>
              {sysErr ? <span style={{ color: palette.danger, fontSize: 12 }}>获取失败</span> :
                `${fmtBytes(rxRate)}/s ↓ · ${fmtBytes(txRate)}/s ↑`}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <span style={{ fontSize: 11, color: '#64748b' }}>{sysLoading ? '刷新中...' : '实时'}</span>
          </div>
        </div>
      </div>

      {loading && (
        <div style={empty}>加载中...</div>
      )}

      {!loading && summary && (
        <>
          <div style={cardsGrid}>
            <div style={card}>
              <div style={cardStripe(palette.primary, palette.purple)} />
              <div style={cardIcon(palette.primarySoft, palette.primary)}>🆔</div>
              <div style={cardLabel}>Cluster ID</div>
              <div style={cardValue}>{summary.cluster_id}</div>
            </div>
            <div style={card}>
              <div style={cardStripe(palette.success, palette.primary)} />
              <div style={cardIcon(palette.successSoft, palette.success)}>🗄️</div>
              <div style={cardLabel}>Stores</div>
              <div style={cardValue}>{nf.format(summary.store_count)}</div>
            </div>
            <div style={card}>
              <div style={cardStripe(palette.purple, palette.primary)} />
              <div style={cardIcon(palette.purpleSoft, palette.purple)}>🗂️</div>
              <div style={cardLabel}>Regions</div>
              <div style={cardValue}>{nf.format(summary.region_count)}</div>
            </div>
            <div style={card}>
              <div style={cardStripe(palette.primary, palette.success)} />
              <div style={cardIcon(palette.primarySoft, palette.primary)}>⭐</div>
              <div style={cardLabel}>Leaders</div>
              <div style={cardValue}>{nf.format(summary.leader_count)}</div>
            </div>
            <div style={card}>
              <div style={cardStripe(palette.warning, palette.danger)} />
              <div style={cardIcon(palette.warningSoft, palette.warning)}>💾</div>
              <div style={cardLabel}>Total Size (bytes)</div>
              <div style={cardValue}>{nf.format(summary.total_region_size)}</div>
            </div>
        </div>

          <h4 style={panelTitle}>Store 列表</h4>
          <div style={tableWrap}>
            <table style={table} cellPadding={0}>
        <thead>
                <tr>
                  <th
                    style={thCommon}
                    onClick={() => handleSort('id')}
                    title="按 ID 排序"
                  >
                    <span style={thButton(sortKey === 'id')}>ID {sortIcon('id')}</span>
                  </th>
                  <th
                    style={thCommon}
                    onClick={() => handleSort('address')}
                    title="按 Address 排序"
                  >
                    <span style={thButton(sortKey === 'address')}>Address {sortIcon('address')}</span>
                  </th>
                  <th
                    style={thCommon}
                    onClick={() => handleSort('state')}
                    title="按 State 排序"
                  >
                    <span style={thButton(sortKey === 'state')}>State {sortIcon('state')}</span>
                  </th>
                  <th
                    style={thCommon}
                    onClick={() => handleSort('region_count')}
                    title="按 Regions 排序"
                  >
                    <span style={thButton(sortKey === 'region_count')}>Regions {sortIcon('region_count')}</span>
                  </th>
                  <th
                    style={thCommon}
                    onClick={() => handleSort('leader_count')}
                    title="按 Leaders 排序"
                  >
                    <span style={thButton(sortKey === 'leader_count')}>Leaders {sortIcon('leader_count')}</span>
                  </th>
                  <th
                    style={thCommon}
                    onClick={() => handleSort('region_size')}
                    title="按 Region Size 排序"
                  >
                    <span style={thButton(sortKey === 'region_size')}>Region Size {sortIcon('region_size')}</span>
                  </th>
                  <th
                    style={thCommon}
                    onClick={() => handleSort('leader_size')}
                    title="按 Leader Size 排序"
                  >
                    <span style={thButton(sortKey === 'leader_size')}>Leader Size {sortIcon('leader_size')}</span>
                  </th>
          </tr>
        </thead>
        <tbody>
                {sortedStores.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={empty}>暂无数据</td>
                  </tr>
                ) : sortedStores.map((s, idx) => (
                  <>
                    <tr
                      key={s.id}
                      style={trZebra(idx, hoveredRow === s.id)}
                      onMouseEnter={() => setHoveredRow(s.id)}
                      onMouseLeave={() => setHoveredRow(null)}
                      onClick={() => toggleExpand(s.id)}
                    >
                      <td style={tdCommon}>{s.id}</td>
                      <td style={tdCommon}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ cursor: 'pointer' }}>{expanded.has(s.id) ? '▼' : '▶'}</span>
                          <span>{s.address}</span>
                        </div>
                      </td>
                      <td style={tdCommon}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {getStateBadge(s.state)}
                          <span style={{ fontSize: 12, color: '#64748b' }}>
                            {s.healthy ? 'Healthy' : 'Unhealthy'}
                          </span>
                        </div>
                      </td>
                      <td style={tdCommon}>{nf.format(s.region_count)}</td>
                      <td style={tdCommon}>{nf.format(s.leader_count)}</td>
                      <td style={tdCommon}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={barWrap}><div style={barInner(s.region_size / maxRegionSize, palette.primary)} /></div>
                          <div style={{ fontSize: 12, color: '#475569' }}>{nf.format(s.region_size)}</div>
                        </div>
                      </td>
                      <td style={tdCommon}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={barWrap}><div style={barInner(s.leader_size / maxLeaderSize, palette.purple)} /></div>
                          <div style={{ fontSize: 12, color: '#475569' }}>{nf.format(s.leader_size)}</div>
                        </div>
                      </td>
                    </tr>
                    {expanded.has(s.id) && (
                      <tr>
                        <td colSpan={7} style={detailWrap}>
                          <div style={metricRow}>
                            <div style={metricCard}>
                              <div style={k}>响应时间 (ms)</div>
                              <div style={v}>{nf.format(s.avg_resp_ms)}</div>
                            </div>
                            <div style={metricCard}>
                              <div style={k}>错误次数</div>
                              <div style={v} title="Since last interval">{nf.format(s.error_count)}</div>
                            </div>
                            <div style={metricCard}>
                              <div style={k}>网络状态</div>
                              <div style={v}>{s.network_state}</div>
                            </div>
                            <div style={metricCard}>
                              <div style={k}>健康</div>
                              <div style={{...v, color: s.healthy ? palette.success : palette.danger}}>
                                {s.healthy ? '正常' : '异常'}
                              </div>
                            </div>
                            <div style={metricCard}>
                              <div style={k}>内存使用</div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <div style={barWrap}>
                                  <div style={barInner((s.mem_used || 0) / Math.max(1, s.mem_total || 1), palette.warning)} />
                                </div>
                                <div style={{ fontSize: 12, color: '#475569' }}>
                                  {nf.format(s.mem_used)} / {nf.format(s.mem_total)}
                                </div>
                              </div>
                            </div>
                            <div style={metricCard}>
                              <div style={k}>磁盘使用</div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <div style={barWrap}>
                                  <div style={barInner((s.disk_used || 0) / Math.max(1, (s.disk_total || 1)), palette.danger)} />
                                </div>
                                <div style={{ fontSize: 12, color: '#475569' }}>
                                  {nf.format(s.disk_used)} / {nf.format(s.disk_total)}
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
            </tr>
                    )}
                  </>
          ))}
        </tbody>
      </table>
          </div>
        </>
      )}

      {!loading && !summary && (
        <div style={empty}>无法加载集群信息</div>
      )}

      {/* Topology Graph */}
      {!loading && (
        <>
          <h4 style={{ ...panelTitle, marginTop: 20 }}>节点拓扑图</h4>
          <div style={{
            background: '#fff',
            border: '1px solid #eef2f7',
            borderRadius: 12,
            boxShadow: '0 1px 2px rgba(16,24,40,0.06)',
            padding: 12,
            overflowX: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 999, background: roleColor('primary'), display: 'inline-block', border: `1px solid ${roleColor('primary')}40` }} />
                  主节点
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 999, background: roleColor('replica'), display: 'inline-block', border: `1px solid ${roleColor('replica')}40` }} />
                  从节点
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 999, background: roleColor('cache'), display: 'inline-block', border: `1px solid ${roleColor('cache')}40` }} />
                  缓存节点
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 999, background: roleColor('storage'), display: 'inline-block', border: `1px solid ${roleColor('storage')}40` }} />
                  存储节点
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                {legendItem(linkStyle('replication').stroke, '数据复制')}
                {legendItem(linkStyle('sync').stroke, '数据同步', '4,4')}
                {legendItem(linkStyle('cache_update').stroke, '缓存更新', '2,6')}
                {legendItem(linkStyle('load_balancing').stroke, '负载均衡', '8,6')}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => setView(v => ({ ...v, scale: clamp(v.scale * 1.1, 0.5, 2.0) }))}
                    style={{ padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 6, background: '#f8fafc', cursor: 'pointer' }}
                    title="放大"
                  >＋</button>
                  <button
                    onClick={() => setView(v => ({ ...v, scale: clamp(v.scale * 0.9, 0.5, 2.0) }))}
                    style={{ padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 6, background: '#f8fafc', cursor: 'pointer' }}
                    title="缩小"
                  >－</button>
                  <button
                    onClick={() => setView({ scale: 1, tx: 0, ty: 0 })}
                    style={{ padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 6, background: '#f8fafc', cursor: 'pointer' }}
                    title="重置视图"
                  >重置</button>
                </div>
              </div>
            </div>
            <svg
              width={topology.width}
              height={topology.height}
              style={{ background: topoPalette.bg, touchAction: 'none' }}
              onWheel={onWheel}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseLeave}
            >
              {/* grid */}
              <defs>
                <marker id="arrow" markerWidth="10" markerHeight="10" refX="10" refY="3" orient="auto" markerUnits="strokeWidth">
                  <path d="M0,0 L10,3 L0,6 z" fill="#94a3b8" />
                </marker>
                <style>
                  {`
                  .edge-anim-dash {
                    animation: dash-move 2.2s linear infinite;
                  }
                  @keyframes dash-move {
                    to { stroke-dashoffset: -120; }
                  }
                  .edge-pulse {
                    animation: pulse 1.6s ease-in-out infinite;
                  }
                  @keyframes pulse {
                    0% { stroke-width: 2.2; }
                    50% { stroke-width: 3.2; }
                    100% { stroke-width: 2.2; }
                  }
                  `}
                </style>
              </defs>
              {/* interaction background for panning */}
              <g transform={`translate(${view.tx},${view.ty}) scale(${view.scale})`}>
                <rect
                  x={-2000} y={-2000} width={4000} height={4000}
                  fill="transparent"
                  onMouseDown={onBgMouseDown}
                  cursor={isPanning ? 'grabbing' : 'grab'}
                />
                {/* edges */}
                {topology.links.map((e, i) => {
                  const fromPos = nodePositions.get(e.from) || { x: topology.nodes.find(n => n.id === e.from)!.x, y: topology.nodes.find(n => n.id === e.from)!.y };
                  const toPos = nodePositions.get(e.to) || { x: topology.nodes.find(n => n.id === e.to)!.x, y: topology.nodes.find(n => n.id === e.to)!.y };
                  const style = linkStyle(e.kind);
                  const dx = toPos.x - fromPos.x;
                  const dy = toPos.y - fromPos.y;
                  const len = Math.max(1, Math.hypot(dx, dy));
                  const shrink = 26;
                  const fx = fromPos.x + (dx / len) * shrink;
                  const fy = fromPos.y + (dy / len) * shrink;
                  const tx = toPos.x - (dx / len) * shrink;
                  const ty = toPos.y - (dy / len) * shrink;
                  const dashed = style.dash !== '0';
                  return (
                    <g key={i}>
                      <line
                        x1={fx} y1={fy} x2={tx} y2={ty}
                        stroke={style.stroke}
                        strokeWidth={style.width}
                        strokeDasharray={style.dash}
                        markerEnd="url(#arrow)"
                        opacity={0.95}
                        className={dashed ? 'edge-anim-dash' : 'edge-pulse'}
                      />
                    </g>
                  );
                })}
                {/* nodes */}
                {topology.nodes.map((n) => {
                  const pos = nodePositions.get(n.id) || { x: n.x, y: n.y };
                  const r = 18;
                  return (
                    <g key={n.id} transform={`translate(${pos.x},${pos.y})`} onMouseDown={(e) => startDrag(e, n.id)} style={{ cursor: 'move' }}>
                      <circle r={r} fill={roleColor(n.role)} stroke="#ffffff" strokeWidth="2" />
                      <circle r={r + 4} fill="none" stroke={n.consistency === 'strong' ? topoPalette.edgeStrong : topoPalette.edgeEventual} strokeWidth="2" opacity={0.9} />
                      <circle cx={r - 6} cy={-r + 6} r={4} fill={n.healthy ? '#16a34a' : '#dc2626'} stroke="#fff" strokeWidth="1.5" />
                      <text x={0} y={-r - 10} textAnchor="middle" fontSize="11" fill={topoPalette.text} fontWeight={600}>
                        {n.label}
                      </text>
                      <text x={0} y={r + 28} textAnchor="middle" fontSize="10" fill="#475569">
                        {n.role === 'primary' ? '主' : n.role === 'replica' ? '从' : n.role === 'cache' ? '缓存' : '存储'} · {n.consistency === 'strong' ? '强一致' : '最终一致'}
                      </text>
                      <g transform={`translate(${-34},${r + 36})`}>
                        <rect x={0} y={0} width={68} height={5} fill="#e2e8f0" rx={3} />
                        <rect x={0} y={0} width={Math.max(6, Math.min(68, Math.round(68 * n.cpuLoad)))} height={5} fill="#ef4444" rx={3} />
                        <text x={34} y={14} textAnchor="middle" fontSize="9" fill="#0f172a">CPU {(n.cpuLoad * 100).toFixed(0)}%</text>
                      </g>
                      <g transform={`translate(${-34},${r + 56})`}>
                        <rect x={0} y={0} width={68} height={5} fill="#e2e8f0" rx={3} />
                        <rect x={0} y={0} width={Math.max(6, Math.min(68, Math.round(68 * n.memLoad)))} height={5} fill="#f59e0b" rx={3} />
                        <text x={34} y={14} textAnchor="middle" fontSize="9" fill="#0f172a">内存 {(n.memLoad * 100).toFixed(0)}%</text>
                      </g>
                      <text x={0} y={r + 84} textAnchor="middle" fontSize="10" fill="#334155">
                        流量 {n.trafficMBps.toFixed(0)} MB/s · 安全 {n.securityScore}
                      </text>
                    </g>
                  );
                })}
                {/* legend title */}
                <text x={16} y={24} fontSize="12" fill="#64748b">一致性环表示: 蓝=强一致, 紫=最终一致 · 鼠标滚轮缩放, 拖动画布/节点</text>
              </g>
            </svg>
          </div>
        </>
      )}
    </div>
  );
  }