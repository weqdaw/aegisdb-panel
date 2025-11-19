// src/pages/DistributedMgmt.tsx
import { useEffect, useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';

// 工具函数
const fmtBytes = (n: number) => {
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log2(n) / 10), units.length - 1);
  return `${(n / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
};

const nf = new Intl.NumberFormat();

// 生成基于节点ID的确定性随机数
function seededRand(seed: number, salt: number) {
  const x = Math.sin(seed * 9301 + salt * 49297) * 233280;
  return x - Math.floor(x);
}

// 类型定义
type ConsistencyState = {
  node_id: number;
  address: string;
  consistency_level: 'strong' | 'eventual';
  last_commit_index: number;
  applied_index: number;
  lag_ms: number;
  status: 'normal' | 'warning' | 'error';
};

type ReplicationState = {
  node_id: number;
  address: string;
  role: 'leader' | 'follower' | 'candidate';
  replication_lag_ms: number;
  sync_status: 'synced' | 'syncing' | 'lagging';
  replica_count: number;
  status: 'normal' | 'warning' | 'error';
};

type ShardingState = {
  shard_id: number;
  primary_node: number;
  replica_nodes: number[];
  shard_size: number;
  distribution_score: number; // 0-100, 越高越均衡
  status: 'normal' | 'warning' | 'error';
};

type LoadBalanceState = {
  node_id: number;
  address: string;
  request_count: number;
  avg_latency_ms: number;
  load_score: number; // 0-100, 越低越均衡
  status: 'normal' | 'warning' | 'error';
};

type ReplicaSyncState = {
  from_node: number;
  to_node: number;
  sync_lag_ms: number;
  sync_rate_mbps: number;
  status: 'normal' | 'warning' | 'error';
};

type LeaderElectionState = {
  region_id: number;
  current_leader: number;
  election_count: number;
  last_election_ms: number;
  term: number;
  status: 'normal' | 'warning' | 'error';
};

type RaftState = {
  node_id: number;
  address: string;
  role: 'leader' | 'follower' | 'candidate';
  term: number;
  commit_index: number;
  last_applied: number;
  match_index: number;
  next_index: number;
  status: 'normal' | 'warning' | 'error';
};

type ProtocolDistribution = {
  protocol: string;
  count: number;
  percentage: number;
  avg_latency_ms: number;
};

type NetworkLatency = {
  from_node: number;
  to_node: number;
  latency_ms: number;
  packet_loss: number; // 0-1
  bandwidth_mbps: number;
};

type ConnectionStats = {
  node_id: number;
  address: string;
  active_connections: number;
  total_connections: number;
  bytes_sent: number;
  bytes_received: number;
  connection_errors: number;
};

export default function DistributedMgmt() {
  const [loading, setLoading] = useState(true);

  // 生成10个节点的地址
  const nodes = useMemo(() => {
    return Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      address: `127.0.0.1:${20160 + i}`,
    }));
  }, []);

  // 模拟数据生成
  const consistencyStates = useMemo<ConsistencyState[]>(() => {
    return nodes.map((node, idx) => {
      const lag = Math.floor(2 + seededRand(node.id, 1) * 8); // 2-10ms
      const commitIdx = 100000 + Math.floor(seededRand(node.id, 2) * 50000);
      return {
        node_id: node.id,
        address: node.address,
        consistency_level: idx === 0 ? 'strong' : (idx < 3 ? 'strong' : 'eventual'),
        last_commit_index: commitIdx,
        applied_index: commitIdx - Math.floor(seededRand(node.id, 3) * 100),
        lag_ms: lag,
        status: lag < 15 ? 'normal' : lag < 30 ? 'warning' : 'error',
      };
    });
  }, [nodes]);

  const replicationStates = useMemo<ReplicationState[]>(() => {
    return nodes.map((node, idx) => {
      const isLeader = idx === 0 || idx === 3 || idx === 6;
      const lag = isLeader ? 0 : Math.floor(3 + seededRand(node.id, 4) * 12); // 3-15ms
      return {
        node_id: node.id,
        address: node.address,
        role: isLeader ? 'leader' : 'follower',
        replication_lag_ms: lag,
        sync_status: lag < 10 ? 'synced' : lag < 20 ? 'syncing' : 'lagging',
        replica_count: isLeader ? Math.floor(2 + seededRand(node.id, 5) * 3) : 0,
        status: lag < 15 ? 'normal' : lag < 30 ? 'warning' : 'error',
      };
    });
  }, [nodes]);

  const shardingStates = useMemo<ShardingState[]>(() => {
    const shardCount = 5;
    return Array.from({ length: shardCount }, (_, i) => {
      const primaryNode = (i * 2) % 10 + 1;
      const replicaNodes = [
        ((i * 2 + 1) % 10) + 1,
        ((i * 2 + 2) % 10) + 1,
      ];
      const size = Math.floor((80 + seededRand(i + 1, 6) * 40) * 1024 * 1024 * 1024); // 80-120GB
      const score = 75 + seededRand(i + 1, 7) * 20; // 75-95
      return {
        shard_id: i + 1,
        primary_node: primaryNode,
        replica_nodes: replicaNodes,
        shard_size: size,
        distribution_score: score,
        status: score > 80 ? 'normal' : score > 60 ? 'warning' : 'error',
      };
    });
  }, []);

  const loadBalanceStates = useMemo<LoadBalanceState[]>(() => {
    const totalRequests = 10000;
    const avgPerNode = totalRequests / 10;
    return nodes.map((node) => {
      const variance = 0.15; // 15% 方差
      const requestCount = Math.floor(avgPerNode * (1 + (seededRand(node.id, 8) - 0.5) * variance * 2));
      const latency = Math.floor(3 + seededRand(node.id, 9) * 7); // 3-10ms
      const loadScore = 50 + seededRand(node.id, 10) * 30; // 50-80
      return {
        node_id: node.id,
        address: node.address,
        request_count: requestCount,
        avg_latency_ms: latency,
        load_score: loadScore,
        status: loadScore < 70 ? 'normal' : loadScore < 85 ? 'warning' : 'error',
      };
    });
  }, [nodes]);

  const replicaSyncStates = useMemo<ReplicaSyncState[]>(() => {
    const syncs: ReplicaSyncState[] = [];
    replicationStates.forEach((rep) => {
      if (rep.role === 'leader') {
        for (let i = 0; i < rep.replica_count && i < 3; i++) {
          const toNode = ((rep.node_id + i) % 10) + 1;
          const lag = Math.floor(4 + seededRand(rep.node_id * 10 + toNode, 11) * 11); // 4-15ms
          const rate = 15 + seededRand(rep.node_id * 10 + toNode, 12) * 25; // 15-40 MB/s
          syncs.push({
            from_node: rep.node_id,
            to_node: toNode,
            sync_lag_ms: lag,
            sync_rate_mbps: rate,
            status: lag < 15 ? 'normal' : lag < 25 ? 'warning' : 'error',
          });
        }
      }
    });
    return syncs;
  }, [replicationStates]);

  const leaderElectionStates = useMemo<LeaderElectionState[]>(() => {
    const regionCount = 8;
    return Array.from({ length: regionCount }, (_, i) => {
      const leader = (i % 10) + 1;
      const electionCount = Math.floor(seededRand(i + 1, 13) * 5); // 0-5
      const lastElection = electionCount > 0 ? Math.floor(30000 + seededRand(i + 1, 14) * 600000) : 0; // 30s-10min ago
      return {
        region_id: i + 1,
        current_leader: leader,
        election_count: electionCount,
        last_election_ms: lastElection,
        term: 100 + i * 10 + Math.floor(seededRand(i + 1, 15) * 5),
        status: electionCount < 3 ? 'normal' : electionCount < 5 ? 'warning' : 'error',
      };
    });
  }, []);

  const raftStates = useMemo<RaftState[]>(() => {
    return nodes.map((node, idx) => {
      const isLeader = idx === 0 || idx === 3 || idx === 6;
      const commitIdx = 100000 + Math.floor(seededRand(node.id, 16) * 50000);
      return {
        node_id: node.id,
        address: node.address,
        role: isLeader ? 'leader' : 'follower',
        term: 100 + Math.floor(seededRand(node.id, 17) * 10),
        commit_index: commitIdx,
        last_applied: commitIdx - Math.floor(seededRand(node.id, 18) * 50),
        match_index: isLeader ? commitIdx : commitIdx - Math.floor(seededRand(node.id, 19) * 100),
        next_index: isLeader ? commitIdx + 1 : commitIdx - Math.floor(seededRand(node.id, 20) * 50) + 1,
        status: 'normal',
      };
    });
  }, [nodes]);

  const protocolDistribution = useMemo<ProtocolDistribution[]>(() => {
    const protocols = [
      { name: 'Raft', base: 0.45 },
      { name: 'gRPC', base: 0.30 },
      { name: 'HTTP', base: 0.15 },
      { name: 'TCP', base: 0.10 },
    ];
    const total = 1000;
    return protocols.map((p, idx) => {
      const count = Math.floor(total * p.base * (0.9 + seededRand(idx, 21) * 0.2));
      const latency = Math.floor(2 + seededRand(idx, 22) * 8); // 2-10ms
      return {
        protocol: p.name,
        count,
        percentage: (count / total) * 100,
        avg_latency_ms: latency,
      };
    });
  }, []);

  const networkLatencies = useMemo<NetworkLatency[]>(() => {
    const latencies: NetworkLatency[] = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const latency = Math.floor(0.5 + seededRand(i * 10 + j, 23) * 2); // 0.5-2.5ms (本地网络)
        const packetLoss = seededRand(i * 10 + j, 24) * 0.001; // 0-0.1%
        const bandwidth = 900 + seededRand(i * 10 + j, 25) * 100; // 900-1000 Mbps (本地)
        latencies.push({
          from_node: nodes[i].id,
          to_node: nodes[j].id,
          latency_ms: latency,
          packet_loss: packetLoss,
          bandwidth_mbps: bandwidth,
        });
      }
    }
    return latencies;
  }, [nodes]);

  const connectionStats = useMemo<ConnectionStats[]>(() => {
    return nodes.map((node) => {
      const active = Math.floor(50 + seededRand(node.id, 26) * 150); // 50-200
      const total = Math.floor(active * (1.2 + seededRand(node.id, 27) * 0.3)); // 总连接数略高于活跃
      const sent = Math.floor((100 + seededRand(node.id, 28) * 400) * 1024 * 1024); // 100-500 MB
      const received = Math.floor((80 + seededRand(node.id, 29) * 350) * 1024 * 1024); // 80-430 MB
      const errors = Math.floor(seededRand(node.id, 30) * 5); // 0-5
      return {
        node_id: node.id,
        address: node.address,
        active_connections: active,
        total_connections: total,
        bytes_sent: sent,
        bytes_received: received,
        connection_errors: errors,
      };
    });
  }, [nodes]);

  useEffect(() => {
    // 模拟加载
    setTimeout(() => setLoading(false), 500);
  }, []);

  // 状态徽章组件
  const StatusBadge = ({ status }: { status: string }) => {
    const colors = {
      normal: { bg: '#dcfce7', fg: '#16a34a' },
      warning: { bg: '#fef3c7', fg: '#d97706' },
      error: { bg: '#fee2e2', fg: '#dc2626' },
    };
    const color = colors[status as keyof typeof colors] || colors.normal;
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        color: color.fg,
        background: color.bg,
        border: `1px solid ${color.fg}20`,
      }}>
        {status === 'normal' ? '正常' : status === 'warning' ? '警告' : '错误'}
      </span>
    );
  };

  // 样式定义
  const container: React.CSSProperties = {
    padding: 20,
    background: '#f7f9fc',
    minHeight: '100vh',
  };

  const section: React.CSSProperties = {
    background: '#fff',
    border: '1px solid #eef2f7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    boxShadow: '0 1px 2px rgba(16,24,40,0.06)',
  };

  const sectionTitle: React.CSSProperties = {
    fontSize: 18,
    fontWeight: 600,
    marginBottom: 16,
    color: '#0f172a',
    borderBottom: '2px solid #eef2f7',
    paddingBottom: 8,
  };

  const subsectionTitle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 600,
    marginTop: 16,
    marginBottom: 12,
    color: '#334155',
  };

  const grid: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: 12,
  };

  const card: React.CSSProperties = {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    padding: 12,
  };

  const table: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 12,
  };

  const th: React.CSSProperties = {
    textAlign: 'left',
    padding: '8px 12px',
    background: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
    fontWeight: 600,
    color: '#475569',
    fontSize: 11,
  };

  const td: React.CSSProperties = {
    padding: '8px 12px',
    borderBottom: '1px solid #f1f5f9',
    color: '#0f172a',
    fontSize: 12,
  };

  if (loading) {
    return <div style={{ padding: 20 }}>加载中...</div>;
  }

  return (
    <div style={container}>
      <h2 style={{ marginBottom: 20, fontSize: 24, fontWeight: 600, color: '#0f172a' }}>分布式管理</h2>

      {/* 第一部分：分布式状态 */}
      <div style={section}>
        <h3 style={sectionTitle}>分布式状态</h3>

        {/* 一致性状态 */}
        <div>
          <h4 style={subsectionTitle}>一致性状态</h4>
          <div style={{ overflowX: 'auto' }}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>节点</th>
                  <th style={th}>地址</th>
                  <th style={th}>一致性级别</th>
                  <th style={th}>提交索引</th>
                  <th style={th}>应用索引</th>
                  <th style={th}>延迟 (ms)</th>
                  <th style={th}>状态</th>
                </tr>
              </thead>
              <tbody>
                {consistencyStates.map((cs) => (
                  <tr key={cs.node_id}>
                    <td style={td}>Node {cs.node_id}</td>
                    <td style={td}>{cs.address}</td>
                    <td style={td}>
                      <span style={{
                        padding: '2px 6px',
                        borderRadius: 4,
                        fontSize: 10,
                        background: cs.consistency_level === 'strong' ? '#dbeafe' : '#fef3c7',
                        color: cs.consistency_level === 'strong' ? '#2563eb' : '#d97706',
                      }}>
                        {cs.consistency_level === 'strong' ? '强一致' : '最终一致'}
                      </span>
                    </td>
                    <td style={td}>{nf.format(cs.last_commit_index)}</td>
                    <td style={td}>{nf.format(cs.applied_index)}</td>
                    <td style={td}>{cs.lag_ms}</td>
                    <td style={td}><StatusBadge status={cs.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 复制状态 */}
        <div>
          <h4 style={subsectionTitle}>复制状态</h4>
          <div style={{ overflowX: 'auto' }}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>节点</th>
                  <th style={th}>地址</th>
                  <th style={th}>角色</th>
                  <th style={th}>复制延迟 (ms)</th>
                  <th style={th}>同步状态</th>
                  <th style={th}>副本数</th>
                  <th style={th}>状态</th>
                </tr>
              </thead>
              <tbody>
                {replicationStates.map((rs) => (
                  <tr key={rs.node_id}>
                    <td style={td}>Node {rs.node_id}</td>
                    <td style={td}>{rs.address}</td>
                    <td style={td}>
                      <span style={{
                        padding: '2px 6px',
                        borderRadius: 4,
                        fontSize: 10,
                        background: rs.role === 'leader' ? '#dbeafe' : '#dcfce7',
                        color: rs.role === 'leader' ? '#2563eb' : '#16a34a',
                      }}>
                        {rs.role === 'leader' ? 'Leader' : 'Follower'}
                      </span>
                    </td>
                    <td style={td}>{rs.replication_lag_ms}</td>
                    <td style={td}>
                      <span style={{
                        padding: '2px 6px',
                        borderRadius: 4,
                        fontSize: 10,
                        background: rs.sync_status === 'synced' ? '#dcfce7' : rs.sync_status === 'syncing' ? '#fef3c7' : '#fee2e2',
                        color: rs.sync_status === 'synced' ? '#16a34a' : rs.sync_status === 'syncing' ? '#d97706' : '#dc2626',
                      }}>
                        {rs.sync_status === 'synced' ? '已同步' : rs.sync_status === 'syncing' ? '同步中' : '延迟'}
                      </span>
                    </td>
                    <td style={td}>{rs.replica_count}</td>
                    <td style={td}><StatusBadge status={rs.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 分片状态 */}
        <div>
          <h4 style={subsectionTitle}>分片状态</h4>
          <div style={{ overflowX: 'auto' }}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>分片ID</th>
                  <th style={th}>主节点</th>
                  <th style={th}>副本节点</th>
                  <th style={th}>分片大小</th>
                  <th style={th}>分布均衡度</th>
                  <th style={th}>状态</th>
                </tr>
              </thead>
              <tbody>
                {shardingStates.map((ss) => (
                  <tr key={ss.shard_id}>
                    <td style={td}>Shard {ss.shard_id}</td>
                    <td style={td}>Node {ss.primary_node}</td>
                    <td style={td}>
                      {ss.replica_nodes.map(n => `Node ${n}`).join(', ')}
                    </td>
                    <td style={td}>{fmtBytes(ss.shard_size)}</td>
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, background: '#eef2f7', height: 6, borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{
                            width: `${ss.distribution_score}%`,
                            height: '100%',
                            background: ss.distribution_score > 80 ? '#16a34a' : ss.distribution_score > 60 ? '#f59e0b' : '#ef4444',
                          }} />
                        </div>
                        <span style={{ fontSize: 11, color: '#475569', minWidth: 40 }}>
                          {ss.distribution_score.toFixed(0)}
                        </span>
                      </div>
                    </td>
                    <td style={td}><StatusBadge status={ss.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 负载均衡 */}
        <div>
          <h4 style={subsectionTitle}>负载均衡</h4>
          <div style={grid}>
            {loadBalanceStates.map((lb) => (
              <div key={lb.node_id} style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>Node {lb.node_id}</div>
                  <StatusBadge status={lb.status} />
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{lb.address}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                  <div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>请求数</div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{nf.format(lb.request_count)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>平均延迟</div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{lb.avg_latency_ms} ms</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>负载评分</div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{lb.load_score.toFixed(0)}</div>
                  </div>
                </div>
                <div style={{ marginTop: 8 }}>
                  <div style={{ background: '#eef2f7', height: 6, borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      width: `${lb.load_score}%`,
                      height: '100%',
                      background: lb.load_score < 70 ? '#16a34a' : lb.load_score < 85 ? '#f59e0b' : '#ef4444',
                    }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 副本同步 */}
        <div>
          <h4 style={subsectionTitle}>副本同步</h4>
          <div style={{ overflowX: 'auto' }}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>源节点</th>
                  <th style={th}>目标节点</th>
                  <th style={th}>同步延迟 (ms)</th>
                  <th style={th}>同步速率 (MB/s)</th>
                  <th style={th}>状态</th>
                </tr>
              </thead>
              <tbody>
                {replicaSyncStates.map((sync, idx) => (
                  <tr key={idx}>
                    <td style={td}>Node {sync.from_node}</td>
                    <td style={td}>Node {sync.to_node}</td>
                    <td style={td}>{sync.sync_lag_ms}</td>
                    <td style={td}>{sync.sync_rate_mbps.toFixed(1)}</td>
                    <td style={td}><StatusBadge status={sync.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Leader选举状态 */}
        <div>
          <h4 style={subsectionTitle}>Leader选举状态</h4>
          <div style={{ overflowX: 'auto' }}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>Region ID</th>
                  <th style={th}>当前Leader</th>
                  <th style={th}>选举次数</th>
                  <th style={th}>上次选举</th>
                  <th style={th}>Term</th>
                  <th style={th}>状态</th>
                </tr>
              </thead>
              <tbody>
                {leaderElectionStates.map((le) => (
                  <tr key={le.region_id}>
                    <td style={td}>Region {le.region_id}</td>
                    <td style={td}>Node {le.current_leader}</td>
                    <td style={td}>{le.election_count}</td>
                    <td style={td}>
                      {le.last_election_ms > 0
                        ? `${(le.last_election_ms / 1000).toFixed(0)}秒前`
                        : '无'}
                    </td>
                    <td style={td}>{le.term}</td>
                    <td style={td}><StatusBadge status={le.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Raft状态 */}
        <div>
          <h4 style={subsectionTitle}>Raft状态</h4>
          <div style={{ overflowX: 'auto' }}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>节点</th>
                  <th style={th}>地址</th>
                  <th style={th}>角色</th>
                  <th style={th}>Term</th>
                  <th style={th}>提交索引</th>
                  <th style={th}>最后应用</th>
                  <th style={th}>匹配索引</th>
                  <th style={th}>下一索引</th>
                  <th style={th}>状态</th>
                </tr>
              </thead>
              <tbody>
                {raftStates.map((rs) => (
                  <tr key={rs.node_id}>
                    <td style={td}>Node {rs.node_id}</td>
                    <td style={td}>{rs.address}</td>
                    <td style={td}>
                      <span style={{
                        padding: '2px 6px',
                        borderRadius: 4,
                        fontSize: 10,
                        background: rs.role === 'leader' ? '#dbeafe' : '#dcfce7',
                        color: rs.role === 'leader' ? '#2563eb' : '#16a34a',
                      }}>
                        {rs.role === 'leader' ? 'Leader' : 'Follower'}
                      </span>
                    </td>
                    <td style={td}>{rs.term}</td>
                    <td style={td}>{nf.format(rs.commit_index)}</td>
                    <td style={td}>{nf.format(rs.last_applied)}</td>
                    <td style={td}>{nf.format(rs.match_index)}</td>
                    <td style={td}>{nf.format(rs.next_index)}</td>
                    <td style={td}><StatusBadge status={rs.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 第二部分：网络与连接 */}
      <div style={section}>
        <h3 style={sectionTitle}>网络与连接</h3>

        {/* 协议分布 */}
        <div>
          <h4 style={subsectionTitle}>协议分布</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <div style={{ overflowX: 'auto' }}>
                <table style={table}>
                  <thead>
                    <tr>
                      <th style={th}>协议</th>
                      <th style={th}>连接数</th>
                      <th style={th}>占比</th>
                      <th style={th}>平均延迟 (ms)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {protocolDistribution.map((pd) => (
                      <tr key={pd.protocol}>
                        <td style={td}>{pd.protocol}</td>
                        <td style={td}>{nf.format(pd.count)}</td>
                        <td style={td}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, background: '#eef2f7', height: 6, borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{
                                width: `${pd.percentage}%`,
                                height: '100%',
                                background: '#3b82f6',
                              }} />
                            </div>
                            <span style={{ fontSize: 11, color: '#475569', minWidth: 45 }}>
                              {pd.percentage.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td style={td}>{pd.avg_latency_ms}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <ReactECharts
                option={{
                  tooltip: {
                    trigger: 'item',
                    formatter: '{b}: {c} ({d}%)',
                  },
                  series: [{
                    type: 'pie',
                    radius: ['40%', '70%'],
                    data: protocolDistribution.map(pd => ({
                      value: pd.count,
                      name: pd.protocol,
                    })),
                    emphasis: {
                      itemStyle: {
                        shadowBlur: 10,
                        shadowOffsetX: 0,
                        shadowColor: 'rgba(0, 0, 0, 0.5)',
                      },
                    },
                  }],
                }}
                style={{ height: '250px' }}
              />
            </div>
          </div>
        </div>

        {/* 网络延迟 */}
        <div>
          <h4 style={subsectionTitle}>网络延迟矩阵</h4>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ display: 'inline-block', minWidth: '100%' }}>
              <table style={table}>
                <thead>
                  <tr>
                    <th style={th}>源节点</th>
                    <th style={th}>目标节点</th>
                    <th style={th}>延迟 (ms)</th>
                    <th style={th}>丢包率</th>
                    <th style={th}>带宽 (Mbps)</th>
                  </tr>
                </thead>
                <tbody>
                  {networkLatencies.slice(0, 20).map((nl, idx) => (
                    <tr key={idx}>
                      <td style={td}>Node {nl.from_node}</td>
                      <td style={td}>Node {nl.to_node}</td>
                      <td style={td}>{nl.latency_ms.toFixed(1)}</td>
                      <td style={td}>{(nl.packet_loss * 100).toFixed(3)}%</td>
                      <td style={td}>{nl.bandwidth_mbps.toFixed(0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {networkLatencies.length > 20 && (
                <div style={{ padding: 12, textAlign: 'center', color: '#64748b', fontSize: 12 }}>
                  显示前20条，共{networkLatencies.length}条连接
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 连接统计 */}
        <div>
          <h4 style={subsectionTitle}>连接统计</h4>
          <div style={{ overflowX: 'auto' }}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>节点</th>
                  <th style={th}>地址</th>
                  <th style={th}>活跃连接</th>
                  <th style={th}>总连接数</th>
                  <th style={th}>发送字节</th>
                  <th style={th}>接收字节</th>
                  <th style={th}>连接错误</th>
                </tr>
              </thead>
              <tbody>
                {connectionStats.map((cs) => (
                  <tr key={cs.node_id}>
                    <td style={td}>Node {cs.node_id}</td>
                    <td style={td}>{cs.address}</td>
                    <td style={td}>{nf.format(cs.active_connections)}</td>
                    <td style={td}>{nf.format(cs.total_connections)}</td>
                    <td style={td}>{fmtBytes(cs.bytes_sent)}</td>
                    <td style={td}>{fmtBytes(cs.bytes_received)}</td>
                    <td style={td}>
                      <span style={{
                        color: cs.connection_errors > 0 ? '#dc2626' : '#16a34a',
                        fontWeight: cs.connection_errors > 0 ? 600 : 400,
                      }}>
                        {cs.connection_errors}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 网络延迟热力图 */}
        <div>
          <h4 style={subsectionTitle}>网络延迟热力图</h4>
          <div style={{ height: '400px' }}>
            <ReactECharts
              option={{
                tooltip: {
                  position: 'top',
                  formatter: (params: any) => {
                    return `Node ${params.data[0]} → Node ${params.data[1]}<br/>延迟: ${params.data[2].toFixed(1)} ms`;
                  },
                },
                grid: {
                  height: '60%',
                  top: '10%',
                },
                xAxis: {
                  type: 'category',
                  data: nodes.map(n => `N${n.id}`),
                  splitArea: {
                    show: true,
                  },
                },
                yAxis: {
                  type: 'category',
                  data: nodes.map(n => `N${n.id}`),
                  splitArea: {
                    show: true,
                  },
                },
                visualMap: {
                  min: 0,
                  max: 3,
                  calculable: true,
                  orient: 'horizontal',
                  left: 'center',
                  bottom: '5%',
                  inRange: {
                    color: ['#16a34a', '#fef3c7', '#dc2626'],
                  },
                },
                series: [{
                  name: '延迟',
                  type: 'heatmap',
                  data: networkLatencies.map(nl => [nl.from_node - 1, nl.to_node - 1, nl.latency_ms]),
                  label: {
                    show: true,
                    formatter: (params: any) => params.value[2].toFixed(1),
                  },
                  emphasis: {
                    itemStyle: {
                      shadowBlur: 10,
                      shadowColor: 'rgba(0, 0, 0, 0.5)',
                    },
                  },
                }],
              }}
              style={{ height: '100%' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}