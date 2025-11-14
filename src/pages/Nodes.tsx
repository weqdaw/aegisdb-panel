// src/pages/Nodes.tsx
import { useEffect, useRef, useState } from "react";

type SystemDisk = { name: string; total: number; used: number; };
type SystemNet = { rx_bytes: number; tx_bytes: number; };
type SystemMetrics = {
  cpu_usage_percent: number;
  mem_total: number;
  mem_used: number;
  disks: SystemDisk[];
  net: SystemNet;
};

function fmtBytes(n: number) {
  if (!n) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log2(n) / 10), u.length - 1);
  return `${(n / Math.pow(1024, i)).toFixed(1)} ${u[i]}`;
}
function pct(used: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((used / total) * 100)));
}

export default function Nodes() {
  const [m, setM] = useState<SystemMetrics | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // 用累计字节求瞬时速率
  const lastRx = useRef<number>(0);
  const lastTx = useRef<number>(0);
  const lastTs = useRef<number>(0);
  const [rxRate, setRxRate] = useState<number>(0);
  const [txRate, setTxRate] = useState<number>(0);

  useEffect(() => {
    let mounted = true;
    const fetchOnce = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8080/api/system");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as SystemMetrics;

        if (mounted) {
          setM(data);
          setErr(null);
          setLoading(false);

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
        }
      } catch (e: any) {
        if (mounted) {
          setErr(e?.message ?? "fetch error");
          setLoading(false);
        }
      }
    };

    fetchOnce();
    const t = setInterval(fetchOnce, 1000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, []);

  if (loading) return <div>加载中...</div>;
  if (err) return <div style={{ color: "red" }}>加载失败: {err}</div>;
  if (!m) return null;

  const memP = pct(m.mem_used, m.mem_total);

  return (
    <div style={{ padding: 16 }}>
      <h2>本机性能</h2>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: "#666" }}>CPU 使用率</div>
          <div style={{ fontSize: 28, fontWeight: 600 }}>{m.cpu_usage_percent.toFixed(1)}%</div>
          <div style={{ background: "#eee", height: 10, borderRadius: 6, overflow: "hidden", marginTop: 8 }}>
            <div style={{ width: `${Math.min(100, Math.max(0, m.cpu_usage_percent))}%`, height: "100%", background: "#5cb85c" }} />
          </div>
        </div>

        <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: "#666" }}>内存</div>
          <div style={{ fontSize: 14, marginBottom: 6 }}>
            {fmtBytes(m.mem_used)} / {fmtBytes(m.mem_total)} ({memP}%)
          </div>
          <div style={{ background: "#eee", height: 10, borderRadius: 6, overflow: "hidden" }}>
            <div style={{ width: `${memP}%`, height: "100%", background: "#5bc0de" }} />
          </div>
        </div>

        <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: "#666" }}>网络吞吐</div>
          <div style={{ fontSize: 14 }}>
            下行: {fmtBytes(rxRate)}/s&nbsp;&nbsp; 上行: {fmtBytes(txRate)}/s
          </div>
        </div>
      </div>

      <h3 style={{ marginTop: 24 }}>磁盘</h3>
      <div style={{ display: "grid", gap: 12 }}>
        {m.disks.map((d) => {
          const p = pct(d.used, d.total);
          return (
            <div key={d.name} style={{ padding: 12, border: "1px solid #eee", borderRadius: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ fontWeight: 600 }}>{d.name}</div>
                <div style={{ fontSize: 12, color: "#666" }}>
                  {fmtBytes(d.used)} / {fmtBytes(d.total)} ({p}%)
                </div>
              </div>
              <div style={{ background: "#eee", height: 10, borderRadius: 6, overflow: "hidden" }}>
                <div style={{ width: `${p}%`, height: "100%", background: "#428bca" }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}