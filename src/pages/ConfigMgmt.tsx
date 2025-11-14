import {
  type ChangeEvent,
  type CSSProperties,
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  loadApiKey,
  type StoredApiKey,
  verifyApiKey,
} from "../utils/apiKeyManager";

type HealthStatus = "healthy" | "warning" | "critical";
type NodeState = "online" | "offline" | "draining";

type StoreConfig = {
  rocksdbOptions: string;
  flushThresholdMb: number;
  compactionStyle: "level" | "universal";
  raftLogGcSizeMb: number;
};

type NodeConfig = {
  id: string;
  address: string;
  tz: string;
  roles: string[];
  state: NodeState;
  cpuLoadPct: number;
  storageUsedPct: number;
  store: StoreConfig;
};

type SchedulerDescriptor = {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  params: Record<string, number | string | boolean>;
};

type ConfigSnapshot = {
  lastUpdatedAt: string;
  system: {
    clusterName: string;
    version: string;
    uptimeSeconds: number;
    health: HealthStatus;
    regionCount: number;
    electionTimeoutMs: number;
    heartbeatIntervalMs: number;
  };
  nodes: NodeConfig[];
  consensus: {
    raftTickIntervalMs: number;
    maxInflightMsgs: number;
    regionSplitSizeMb: number;
    regionSplitKeys: number;
    manualSplitCandidate: string;
    manualMergeTarget: string;
  };
  scheduling: {
    globalEnabled: boolean;
    hotRegionThreshold: number;
    replicaCheckIntervalSec: number;
    schedulers: SchedulerDescriptor[];
  };
  storage: {
    tiers: Array<{
      name: string;
      mountPath: string;
      capacityGb: number;
      usedGb: number;
      hotPercent: number;
      policy: "hot" | "warm" | "cold";
    }>;
  };
  recovery: {
    failureDetectionWindowSec: number;
    consecutiveFailureThreshold: number;
    autoRebalance: boolean;
    manualRecoveryTarget: string;
  };
  monitoring: {
    logLevel: "TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR";
    auditEnabled: boolean;
    metricsEndpoint: string;
    alertEndpoints: string[];
    cpuAlertThreshold: number;
    storageAlertThreshold: number;
  };
  security: {
    caCert: string;
    nodeCert: string;
    authMode: "rbac" | "acl" | "native";
    allowedCIDRs: string[];
    auditRetentionDays: number;
  };
  dangerZone: {
    nextRegionId: number;
    nextStoreId: number;
    allowForceTransferLeader: boolean;
    allowCacheReset: boolean;
  };
};

const defaultSnapshot: ConfigSnapshot = {
  lastUpdatedAt: new Date().toISOString(),
  system: {
    clusterName: "AegisDB-Prod",
    version: "5.4.2",
    uptimeSeconds: 86400 * 37 + 412,
    health: "healthy",
    regionCount: 2140,
    electionTimeoutMs: 1200,
    heartbeatIntervalMs: 500,
  },
  nodes: [
    {
      id: "store-1",
      address: "10.10.1.11:20160",
      tz: "UTC+8",
      roles: ["tikv", "raft-leader"],
      state: "online",
      cpuLoadPct: 46,
      storageUsedPct: 57,
      store: {
        rocksdbOptions: "level_compaction_dynamic_level_bytes=true",
        flushThresholdMb: 128,
        compactionStyle: "level",
        raftLogGcSizeMb: 512,
      },
    },
  ],
  consensus: {
    raftTickIntervalMs: 50,
    maxInflightMsgs: 256,
    regionSplitSizeMb: 256,
    regionSplitKeys: 200000,
    manualSplitCandidate: "",
    manualMergeTarget: "",
  },
  scheduling: {
    globalEnabled: true,
    hotRegionThreshold: 0.15,
    replicaCheckIntervalSec: 45,
    schedulers: [
      {
        id: "balance-leader-scheduler",
        label: "Balance Leader",
        description: "均衡不同 store 的 leader 数量",
        enabled: true,
        params: {
          toleranceRatio: 0.1,
        },
      },
      {
        id: "balance-region-scheduler",
        label: "Balance Region",
        description: "控制 region 副本与数据量的均衡",
        enabled: true,
        params: {
          replicaGoal: 3,
          tolerantSizeRatio: 0.15,
        },
      },
      {
        id: "hot-region-scheduler",
        label: "Hot Region",
        description: "根据热点访问情况进行负载迁移",
        enabled: true,
        params: {
          minHotDegree: 3,
          allowScheduleHotPeer: true,
        },
      },
      {
        id: "evict-leader-scheduler",
        label: "Evict Leader",
        description: "支持手动驱逐特定 store 上的 leader",
        enabled: false,
        params: {
          targetStore: "store-3",
        },
      },
    ],
  },
  storage: {
    tiers: [
      {
        name: "NVMe-Primary",
        mountPath: "/data/nvme",
        capacityGb: 4096,
        usedGb: 2275,
        hotPercent: 62,
        policy: "hot",
      },
      {
        name: "SSD-Warm",
        mountPath: "/data/ssd",
        capacityGb: 8192,
        usedGb: 5333,
        hotPercent: 28,
        policy: "warm",
      },
      {
        name: "HDD-Archive",
        mountPath: "/data/hdd",
        capacityGb: 16384,
        usedGb: 10450,
        hotPercent: 10,
        policy: "cold",
      },
    ],
  },
  recovery: {
    failureDetectionWindowSec: 90,
    consecutiveFailureThreshold: 5,
    autoRebalance: true,
    manualRecoveryTarget: "",
  },
  monitoring: {
    logLevel: "INFO",
    auditEnabled: true,
    metricsEndpoint: "http://10.10.1.21:9090",
    alertEndpoints: ["http://10.10.1.22:9093/api/v2/alerts"],
    cpuAlertThreshold: 80,
    storageAlertThreshold: 85,
  },
  security: {
    caCert: "/etc/aegisdb/certs/ca.pem",
    nodeCert: "/etc/aegisdb/certs/node.pem",
    authMode: "rbac",
    allowedCIDRs: ["10.10.0.0/16", "192.168.0.0/16"],
    auditRetentionDays: 14,
  },
  dangerZone: {
    nextRegionId: 420004,
    nextStoreId: 1099,
    allowForceTransferLeader: false,
    allowCacheReset: false,
  },
};

const UNLOCK_FLAG_STORAGE_KEY = "aegisdb-config:unlocked";
const UNLOCK_VERSION_STORAGE_KEY = "aegisdb-config:unlocked-version";

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  display: "grid",
  gridTemplateRows: "auto 1fr",
  background:
    "radial-gradient(circle at top, rgba(59, 130, 246, 0.08) 0%, transparent 55%)",
  padding: "24px clamp(18px, 3vw, 32px)",
  gap: 20,
  color: "#0f172a",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: 16,
};

const headingGroupStyle: CSSProperties = {
  display: "grid",
  gap: 6,
};

const actionsStyle: CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "center",
};

const buttonStyle: CSSProperties = {
  padding: "10px 18px",
  borderRadius: 12,
  border: "1px solid rgba(15, 23, 42, 0.12)",
  background: "#ffffff",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 14,
  transition: "all 0.24s ease",
};

const primaryButtonStyle: CSSProperties = {
  ...buttonStyle,
  background: "linear-gradient(120deg, #2563eb, #1d4ed8)",
  border: "none",
  color: "#ffffff",
  boxShadow: "0 14px 30px rgba(37, 99, 235, 0.32)",
};

const layoutStyle: CSSProperties = {
  width: "100%",
};

const mainColumnStyle: CSSProperties = {
  display: "grid",
  gap: 18,
  gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
};

const cardStyle: CSSProperties = {
  background: "#ffffff",
  borderRadius: 18,
  border: "1px solid rgba(15, 23, 42, 0.08)",
  boxShadow: "0 14px 28px rgba(15, 23, 42, 0.05)",
  padding: "18px 20px",
  display: "grid",
  gap: 16,
};

const sectionHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const sectionTitleStyle: CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  letterSpacing: 0.2,
};

const statGridStyle: CSSProperties = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
};

const statCardStyle: CSSProperties = {
  padding: "14px",
  borderRadius: 12,
  border: "1px solid rgba(148, 163, 184, 0.18)",
  background:
    "linear-gradient(135deg, rgba(148, 163, 184, 0.08) 0%, rgba(226, 232, 240, 0.28) 100%)",
  display: "grid",
  gap: 8,
};

const labelStyle: CSSProperties = {
  fontSize: 12,
  textTransform: "uppercase",
  fontWeight: 600,
  letterSpacing: 1,
  color: "rgba(71, 85, 105, 0.9)",
};

const valueStyle: CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
};

const fieldGridStyle: CSSProperties = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
};

const fieldStyle: CSSProperties = {
  display: "grid",
  gap: 6,
};

const inputStyle: CSSProperties = {
  borderRadius: 12,
  border: "1px solid rgba(148, 163, 184, 0.3)",
  padding: "10px 12px",
  fontSize: 14,
  fontFamily: "inherit",
  backgroundColor: "rgba(248, 250, 252, 0.9)",
};

const textareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: 96,
  resize: "vertical",
};

const toggleRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "12px 16px",
  borderRadius: 14,
  border: "1px solid rgba(148, 163, 184, 0.22)",
};

const sliderStyle: CSSProperties = {
  width: "100%",
};

const pillStyle = (tone: "success" | "warning" | "danger" | "neutral"): CSSProperties => {
  const palette = {
    success: { bg: "rgba(34, 197, 94, 0.12)", fg: "#15803d" },
    warning: { bg: "rgba(234, 179, 8, 0.16)", fg: "#b45309" },
    danger: { bg: "rgba(239, 68, 68, 0.12)", fg: "#b91c1c" },
    neutral: { bg: "rgba(148, 163, 184, 0.16)", fg: "#475569" },
  }[tone];

  return {
    padding: "6px 12px",
    borderRadius: 999,
    background: palette.bg,
    color: palette.fg,
    fontWeight: 600,
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  };
};

const listStyle: CSSProperties = {
  display: "grid",
  gap: 12,
};

const listItemStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid rgba(148, 163, 184, 0.22)",
  backgroundColor: "rgba(248, 250, 252, 0.8)",
};

const jsonPreviewStyle: CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, SFMono, Menlo, Consolas, Liberation Mono, monospace",
  fontSize: 12,
  lineHeight: 1.4,
  maxHeight: 420,
  overflowY: "auto",
  backgroundColor: "#0f172a",
  color: "#e2e8f0",
  borderRadius: 16,
  padding: 18,
  border: "1px solid rgba(148, 163, 184, 0.26)",
  boxShadow: "0 18px 36px rgba(15, 23, 42, 0.16)",
};

const Divider = () => (
  <div
    style={{
      height: 1,
      width: "100%",
      background: "linear-gradient(90deg, transparent 0%, rgba(148, 163, 184, 0.45) 40%, rgba(148, 163, 184, 0.45) 60%, transparent 100%)",
      margin: "4px 0",
    }}
  />
);

export default function ConfigMgmt() {
  const [snapshot, setSnapshot] = useState<ConfigSnapshot>(defaultSnapshot);
  const [jsonCollapsed, setJsonCollapsed] = useState(true);
  const [storedApiKey, setStoredApiKey] = useState<StoredApiKey | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const storedApiKeyRef = useRef<StoredApiKey | null>(null);

  useEffect(() => {
    storedApiKeyRef.current = storedApiKey;
  }, [storedApiKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const record = loadApiKey();
    setStoredApiKey(record);
    storedApiKeyRef.current = record;
    const savedUnlocked =
      window.sessionStorage.getItem(UNLOCK_FLAG_STORAGE_KEY) === "true";
    const savedVersion = window.sessionStorage.getItem(
      UNLOCK_VERSION_STORAGE_KEY
    );
    if (record && savedUnlocked && savedVersion === record.createdAt) {
      setUnlocked(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleKeyRefresh = () => {
      const previous = storedApiKeyRef.current;
      const next = loadApiKey();
      storedApiKeyRef.current = next;
      setStoredApiKey(next);
      if (!previous || !next || previous.key !== next.key) {
        setUnlocked(false);
        setTokenInput("");
        setUnlockError(null);
        window.sessionStorage.removeItem(UNLOCK_FLAG_STORAGE_KEY);
        window.sessionStorage.removeItem(UNLOCK_VERSION_STORAGE_KEY);
      }
    };
    window.addEventListener("storage", handleKeyRefresh);
    window.addEventListener(
      "aegisdb:api-key-changed",
      handleKeyRefresh as EventListener
    );
    return () => {
      window.removeEventListener("storage", handleKeyRefresh);
      window.removeEventListener(
        "aegisdb:api-key-changed",
        handleKeyRefresh as EventListener
      );
    };
  }, []);

  const selectedNode = useMemo(
    () => snapshot.nodes[0],
    [snapshot.nodes]
  );

  const regionHealth = useMemo(() => {
    const unhealthyNodes = snapshot.nodes.filter((node) => node.state !== "online")
      .length;
    if (unhealthyNodes === 0 && snapshot.system.health === "healthy")
      return { label: "Stable", tone: "success" as const };
    if (unhealthyNodes === 0) return { label: "Observe", tone: "warning" as const };
    if (unhealthyNodes === snapshot.nodes.length)
      return { label: "Critical", tone: "danger" as const };
    return { label: "Partial Degraded", tone: "warning" as const };
  }, [snapshot.nodes, snapshot.system.health]);

  const handleUnlock = () => {
    if (typeof window === "undefined") return;
    const latestRecord = loadApiKey();
    setStoredApiKey(latestRecord);
    storedApiKeyRef.current = latestRecord;
    if (!latestRecord) {
      setUnlockError("尚未生成 API Key，请先前往设置页面生成新密钥。");
      return;
    }
    const candidate = tokenInput.trim();
    if (!candidate) {
      setUnlockError("请输入 API Key");
      return;
    }
    const valid = verifyApiKey(candidate);
    if (valid) {
      setUnlockError(null);
      setUnlocked(true);
      setTokenInput("");
      window.sessionStorage.setItem(UNLOCK_FLAG_STORAGE_KEY, "true");
      window.sessionStorage.setItem(
        UNLOCK_VERSION_STORAGE_KEY,
        latestRecord.createdAt
      );
    } else {
      setUnlockError("API Key 不正确，请重试");
    }
  };

  const handleUnlockKeyDown = (evt: KeyboardEvent<HTMLInputElement>) => {
    if (evt.key === "Enter") {
      evt.preventDefault();
      handleUnlock();
    }
  };

  const handleConsensusFieldChange =
    (key: keyof ConfigSnapshot["consensus"]) =>
    (evt: ChangeEvent<HTMLInputElement>) => {
      const value =
        key === "manualSplitCandidate" || key === "manualMergeTarget"
          ? evt.target.value
          : Number(evt.target.value);
      setSnapshot((prev) => ({
        ...prev,
        consensus: {
          ...prev.consensus,
          [key]: value,
        },
        lastUpdatedAt: new Date().toISOString(),
      }));
    };

  const handleRecoveryFieldChange =
    (key: keyof ConfigSnapshot["recovery"]) =>
    (evt: ChangeEvent<HTMLInputElement>) => {
      const value =
        key === "manualRecoveryTarget"
          ? evt.target.value
          : evt.target.type === "checkbox"
          ? (evt.target as HTMLInputElement).checked
          : Number(evt.target.value);
      setSnapshot((prev) => ({
        ...prev,
        recovery: {
          ...prev.recovery,
          [key]: value,
        },
        lastUpdatedAt: new Date().toISOString(),
      }));
    };

  const handleMonitoringFieldChange =
    (key: keyof ConfigSnapshot["monitoring"]) =>
    (evt: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { value } = evt.target;
      const normalizedValue =
        key === "logLevel"
          ? (value as ConfigSnapshot["monitoring"]["logLevel"])
          : key === "metricsEndpoint"
          ? value
          : Number(value);
      setSnapshot((prev) => ({
        ...prev,
        monitoring: {
          ...prev.monitoring,
          [key]: normalizedValue,
        },
        lastUpdatedAt: new Date().toISOString(),
      }));
    };

  const handleSecurityFieldChange =
    (key: keyof ConfigSnapshot["security"]) =>
    (
      evt: ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >
    ) => {
      const { value } = evt.target;
      const normalizedValue =
        key === "allowedCIDRs"
          ? value.split(",").map((cidr) => cidr.trim()).filter(Boolean)
          : key === "auditRetentionDays"
          ? Number(value)
          : value;
      setSnapshot((prev) => ({
        ...prev,
        security: {
          ...prev.security,
          [key]: normalizedValue,
        },
        lastUpdatedAt: new Date().toISOString(),
      }));
    };

  const handleToggleScheduler = (schedulerId: string) => {
    setSnapshot((prev) => ({
      ...prev,
      scheduling: {
        ...prev.scheduling,
        schedulers: prev.scheduling.schedulers.map((scheduler) =>
          scheduler.id === schedulerId
            ? { ...scheduler, enabled: !scheduler.enabled }
            : scheduler
        ),
      },
      lastUpdatedAt: new Date().toISOString(),
    }));
  };

  const handleSchedulerParamChange =
    (schedulerId: string, key: string) =>
    (evt: ChangeEvent<HTMLInputElement>) => {
      const target = evt.target as HTMLInputElement;
      const value =
        target.type === "checkbox"
          ? target.checked
          : target.type === "number"
          ? Number(target.value)
          : target.value;
      setSnapshot((prev) => ({
        ...prev,
        scheduling: {
          ...prev.scheduling,
          schedulers: prev.scheduling.schedulers.map((scheduler) =>
            scheduler.id === schedulerId
              ? {
                  ...scheduler,
                  params: {
                    ...scheduler.params,
                    [key]: value,
                  },
                }
              : scheduler
          ),
        },
        lastUpdatedAt: new Date().toISOString(),
      }));
    };

  const handleNodeUpdate =
    <K extends keyof NodeConfig>(key: K) =>
    (evt: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const target = evt.target;
      let value: NodeConfig[K];
      if (key === "roles") {
        value = target.value.split(",").map((role) => role.trim()) as NodeConfig[K];
      } else if (key === "state") {
        value = target.value as NodeConfig[K];
      } else if (key === "cpuLoadPct" || key === "storageUsedPct") {
        value = Number(target.value) as NodeConfig[K];
      } else {
        value = target.value as NodeConfig[K];
      }
      setSnapshot((prev) => {
        if (!prev.nodes[0]) return prev;
        const nextNodes = [...prev.nodes];
        nextNodes[0] = {
          ...nextNodes[0],
          [key]: value,
        } as NodeConfig;
        return {
          ...prev,
          nodes: nextNodes,
          lastUpdatedAt: new Date().toISOString(),
        };
      });
    };

  const handleStoreConfigChange =
    <K extends keyof StoreConfig>(key: K) =>
    (evt: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const target = evt.target;
      const value =
        key === "rocksdbOptions"
          ? target.value
          : key === "compactionStyle"
          ? (target.value as StoreConfig[K])
          : Number(target.value);
      setSnapshot((prev) => {
        if (!prev.nodes[0]) return prev;
        const nextNodes = [...prev.nodes];
        nextNodes[0] = {
          ...nextNodes[0],
          store: {
            ...nextNodes[0].store,
            [key]: value,
          },
        };
        return {
          ...prev,
          nodes: nextNodes,
          lastUpdatedAt: new Date().toISOString(),
        };
      });
    };

  const handleSchedulerGlobalToggle = (evt: ChangeEvent<HTMLInputElement>) => {
    const enabled = (evt.target as HTMLInputElement).checked;
    setSnapshot((prev) => ({
      ...prev,
      scheduling: {
        ...prev.scheduling,
        globalEnabled: enabled,
      },
      lastUpdatedAt: new Date().toISOString(),
    }));
  };

  const handleHotThresholdChange = (evt: ChangeEvent<HTMLInputElement>) => {
    const value = Number(evt.target.value);
    setSnapshot((prev) => ({
      ...prev,
      scheduling: {
        ...prev.scheduling,
        hotRegionThreshold: value,
      },
      lastUpdatedAt: new Date().toISOString(),
    }));
  };

  const handleReplicaIntervalChange = (evt: ChangeEvent<HTMLInputElement>) => {
    const value = Number(evt.target.value);
    setSnapshot((prev) => ({
      ...prev,
      scheduling: {
        ...prev.scheduling,
        replicaCheckIntervalSec: value,
      },
      lastUpdatedAt: new Date().toISOString(),
    }));
  };

  const handleTierChange =
    (tierIndex: number, key: "mountPath" | "policy" | "hotPercent") =>
    (evt: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const target = evt.target;
      const value =
        key === "hotPercent" ? Number(target.value) : (target.value as string);
      setSnapshot((prev) => ({
        ...prev,
        storage: {
          ...prev.storage,
          tiers: prev.storage.tiers.map((tier, index) =>
            index === tierIndex
              ? { ...tier, [key]: value }
              : tier
          ),
        },
        lastUpdatedAt: new Date().toISOString(),
      }));
    };

  const handleTierCapacityChange =
    (tierIndex: number, key: "capacityGb" | "usedGb") =>
    (evt: ChangeEvent<HTMLInputElement>) => {
      const value = Number(evt.target.value);
      setSnapshot((prev) => ({
        ...prev,
        storage: {
          ...prev.storage,
          tiers: prev.storage.tiers.map((tier, index) =>
            index === tierIndex
              ? { ...tier, [key]: value }
              : tier
          ),
        },
        lastUpdatedAt: new Date().toISOString(),
      }));
    };

  const handleDangerZoneToggle =
    (key: keyof ConfigSnapshot["dangerZone"]) =>
    (evt: ChangeEvent<HTMLInputElement>) => {
      const target = evt.target as HTMLInputElement;
      const value =
        key === "allowForceTransferLeader" || key === "allowCacheReset"
          ? target.checked
          : Number(target.value);
      setSnapshot((prev) => ({
        ...prev,
        dangerZone: {
          ...prev.dangerZone,
          [key]: value,
        },
        lastUpdatedAt: new Date().toISOString(),
      }));
    };

  const triggerManualAction = (action: string) => {
    if (!unlocked) {
      window.alert("请先通过 API Key 解锁配置管理");
      return;
    }
    window.alert(`已执行操作：${action}`);
    setSnapshot((prev) => ({
      ...prev,
      lastUpdatedAt: new Date().toISOString(),
    }));
  };

  const exportConfig = () => {
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const date = new Date().toISOString().replace(/[:.]/g, "-");
    link.download = `aegisdb-config-${date}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleFileInput = (evt: ChangeEvent<HTMLInputElement>) => {
    if (!unlocked) {
      window.alert("请先通过 API Key 解锁配置管理");
      if (evt.target) {
        evt.target.value = "";
      }
      return;
    }
    const file = evt.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string) as ConfigSnapshot;
        setSnapshot(parsed);
        window.alert("配置导入成功");
      } catch (err) {
        window.alert(`配置导入失败: ${(err as Error).message}`);
      }
    };
    reader.readAsText(file);
    evt.target.value = "";
  };

  const openFileChooser = () => {
    fileInputRef.current?.click();
  };

  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <div style={headingGroupStyle}>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: 0.4,
              margin: 0,
            }}
          >
            配置管理中心
          </h1>
          {/* <span
            style={{
              color: "rgba(71, 85, 105, 0.85)",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            运行时间：{Math.floor(pageUptimeSeconds / 3600)
              .toString()
              .padStart(2, "0")}
            :{Math.floor((pageUptimeSeconds % 3600) / 60)
              .toString()
              .padStart(2, "0")}
            :{Math.floor(pageUptimeSeconds % 60)
              .toString()
              .padStart(2, "0")}
          </span> */}
        </div>
        <div style={actionsStyle}>
          <button
            style={{
              ...buttonStyle,
              opacity: unlocked ? 1 : 0.55,
              cursor: unlocked ? "pointer" : "not-allowed",
            }}
            onClick={() => setJsonCollapsed((prev) => !prev)}
            disabled={!unlocked}
          >
            {jsonCollapsed ? "展开预览 JSON" : "折叠预览 JSON"}
          </button>
          <button
            style={{
              ...buttonStyle,
              opacity: unlocked ? 1 : 0.55,
              cursor: unlocked ? "pointer" : "not-allowed",
            }}
            onClick={openFileChooser}
            disabled={!unlocked}
          >
            导入 JSON 配置
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            onChange={handleFileInput}
            disabled={!unlocked}
            hidden
          />
          <button
            style={{
              ...primaryButtonStyle,
              opacity: unlocked ? 1 : 0.7,
              cursor: unlocked ? "pointer" : "not-allowed",
            }}
            onClick={exportConfig}
            disabled={!unlocked}
          >
            导出当前配置
          </button>
        </div>
      </header>

      <div style={layoutStyle}>
        <main style={mainColumnStyle}>
          {!unlocked ? (
            <section
              style={{
                ...cardStyle,
                gridColumn: "1 / -1",
                maxWidth: 520,
                justifySelf: "center",
              }}
            >
              <div style={sectionHeaderStyle}>
                <span style={sectionTitleStyle}>配置中心解锁</span>
                <span style={pillStyle("danger")}>未通过验证</span>
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: "rgba(71, 85, 105, 0.85)",
                }}
              >
                为防止误操作，请输入在设置页面生成的 API Key 以解锁配置修改功能。
              </p>
              <label style={fieldStyle}>
                <span style={labelStyle}>API Key</span>
                <input
                  style={inputStyle}
                  type="password"
                  value={tokenInput}
                  onChange={(evt) => setTokenInput(evt.target.value)}
                  onKeyDown={handleUnlockKeyDown}
                  placeholder={
                    storedApiKey
                      ? "请输入从设置页面获取的 API Key"
                      : "尚未检测到 API Key，请先前往设置页生成"
                  }
                  autoFocus
                />
              </label>
              {unlockError ? (
                <span style={{ fontSize: 13, color: "#b91c1c" }}>{unlockError}</span>
              ) : (
                <span style={{ fontSize: 13, color: "rgba(71, 85, 105, 0.85)" }}>
                  {storedApiKey
                    ? "验证通过后，本次浏览器会话将在密钥更新前保持解锁。"
                    : "完成生成后再次返回此页面进行验证。"}
                </span>
              )}
              <div style={actionsStyle}>
                <button
                  style={{
                    ...primaryButtonStyle,
                    opacity: storedApiKey ? 1 : 0.7,
                    cursor: storedApiKey ? "pointer" : "not-allowed",
                  }}
                  onClick={handleUnlock}
                  disabled={!storedApiKey}
                >
                  验证并解锁
                </button>
                <button
                  style={buttonStyle}
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      window.location.href = "/settings";
                    }
                  }}
                >
                  前往设置
                </button>
              </div>
            </section>
          ) : (
            <>
          <section style={{ ...cardStyle, gridColumn: "1 / -1" }}>
            <div style={sectionHeaderStyle}>
              <span style={sectionTitleStyle}>节点管理</span>
              <span style={pillStyle(regionHealth.tone)}>
                运行状态 • {regionHealth.label}
              </span>
            </div>
            <div style={{ display: "grid", gap: 16 }}>
              {selectedNode ? (
                <div style={{ display: "grid", gap: 20 }}>
                  <div style={statGridStyle}>
                    <div style={statCardStyle}>
                      <span style={labelStyle}>节点状态</span>
                      <span
                        style={{
                          ...valueStyle,
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          fontSize: 18,
                        }}
                      >
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            backgroundColor:
                              selectedNode.state === "online"
                                ? "#22c55e"
                                : selectedNode.state === "draining"
                                ? "#eab308"
                                : "#ef4444",
                          }}
                        />
                        {selectedNode.state}
                      </span>
                    </div>
                    {/* <div style={statCardStyle}>
                      <span style={labelStyle}>CPU 负载</span>
                      <span style={valueStyle}>{selectedNode.cpuLoadPct}%</span>
                    </div> */}
                    {/* <div style={statCardStyle}>
                      <span style={labelStyle}>存储利用率</span>
                      <span style={valueStyle}>{selectedNode.storageUsedPct}%</span>
                    </div> */}
                    <div style={statCardStyle}>
                      <span style={labelStyle}>角色</span>
                      <span style={{ ...valueStyle, fontSize: 16 }}>
                        {selectedNode.roles.join(", ")}
                      </span>
                    </div>
                  </div>

                  <Divider />

                  <div style={fieldGridStyle}>
                    <label style={fieldStyle}>
                      <span style={labelStyle}>地址</span>
                      <input
                        style={inputStyle}
                        value={selectedNode.address}
                        onChange={handleNodeUpdate("address")}
                      />
                    </label>
                    <label style={fieldStyle}>
                      <span style={labelStyle}>时区</span>
                      <input
                        style={inputStyle}
                        value={selectedNode.tz}
                        onChange={handleNodeUpdate("tz")}
                      />
                    </label>
                    <label style={fieldStyle}>
                      <span style={labelStyle}>角色 (逗号分隔)</span>
                      <input
                        style={inputStyle}
                        value={selectedNode.roles.join(", ")}
                        onChange={handleNodeUpdate("roles")}
                      />
                    </label>
                    <label style={fieldStyle}>
                      <span style={labelStyle}>状态</span>
                      <select
                        style={inputStyle}
                        value={selectedNode.state}
                        onChange={handleNodeUpdate("state")}
                      >
                        <option value="online">online</option>
                        <option value="offline">offline</option>
                        <option value="draining">draining</option>
                      </select>
                    </label>
                    <label style={fieldStyle}>
                      <span style={labelStyle}>CPU 负载 (%)</span>
                      <input
                        style={inputStyle}
                        type="number"
                        min={0}
                        max={100}
                        value={selectedNode.cpuLoadPct}
                        onChange={handleNodeUpdate("cpuLoadPct")}
                      />
                    </label>
                    <label style={fieldStyle}>
                      <span style={labelStyle}>存储利用率 (%)</span>
                      <input
                        style={inputStyle}
                        type="number"
                        min={0}
                        max={100}
                        value={selectedNode.storageUsedPct}
                        onChange={handleNodeUpdate("storageUsedPct")}
                      />
                    </label>
                  </div>

                  <div style={{ ...listItemStyle, gap: 12 }}>
                    <span style={{ ...labelStyle, fontSize: 13 }}>Store 级配置</span>
                    <label style={fieldStyle}>
                      <span style={labelStyle}>RocksDB Options</span>
                      <textarea
                        style={textareaStyle}
                        value={selectedNode.store.rocksdbOptions}
                        onChange={handleStoreConfigChange("rocksdbOptions")}
                      />
                    </label>
                    <div style={fieldGridStyle}>
                      <label style={fieldStyle}>
                        <span style={labelStyle}>Flush 阈值 (MB)</span>
                        <input
                          style={inputStyle}
                          type="number"
                          min={32}
                          step={32}
                          value={selectedNode.store.flushThresholdMb}
                          onChange={handleStoreConfigChange("flushThresholdMb")}
                        />
                      </label>
                      <label style={fieldStyle}>
                        <span style={labelStyle}>Raft Log GC (MB)</span>
                        <input
                          style={inputStyle}
                          type="number"
                          step={128}
                          value={selectedNode.store.raftLogGcSizeMb}
                          onChange={handleStoreConfigChange("raftLogGcSizeMb")}
                        />
                      </label>
                      <label style={fieldStyle}>
                        <span style={labelStyle}>Compaction Style</span>
                        <select
                          style={inputStyle}
                          value={selectedNode.store.compactionStyle}
                          onChange={handleStoreConfigChange("compactionStyle")}
                        >
                          <option value="level">level</option>
                          <option value="universal">universal</option>
                        </select>
                      </label>
                    </div>
                    <div style={actionsStyle}>
                      <button
                        style={{ ...buttonStyle, fontSize: 12 }}
                        onClick={() => triggerManualAction(`对 ${selectedNode.id} 执行调度隔离`)}
                      >
                        调度隔离
                      </button>
                      <button
                        style={{ ...buttonStyle, fontSize: 12 }}
                        onClick={() => triggerManualAction(`对 ${selectedNode.id} 执行滚动重启`)}
                      >
                        滚动重启
                      </button>
                      <button
                        style={{ ...buttonStyle, fontSize: 12 }}
                        onClick={() => triggerManualAction(`对 ${selectedNode.id} 清理 RocksDB Blobfile`)}
                      >
                        清理 Blobfile
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={listItemStyle}>尚未配置节点</div>
              )}
            </div>
          </section>

          <section style={cardStyle}>
            <div style={sectionHeaderStyle}>
              <span style={sectionTitleStyle}>共识与 Region</span>
              <span style={pillStyle("neutral")}>Raft 控制</span>
            </div>
            <div style={fieldGridStyle}>
              <label style={fieldStyle}>
                <span style={labelStyle}>Raft Tick 间隔 (ms)</span>
                <input
                  style={inputStyle}
                  type="number"
                  value={snapshot.consensus.raftTickIntervalMs}
                  onChange={handleConsensusFieldChange("raftTickIntervalMs")}
                />
              </label>
              <label style={fieldStyle}>
                <span style={labelStyle}>最大 Inflight 消息</span>
                <input
                  style={inputStyle}
                  type="number"
                  value={snapshot.consensus.maxInflightMsgs}
                  onChange={handleConsensusFieldChange("maxInflightMsgs")}
                />
              </label>
              <label style={fieldStyle}>
                <span style={labelStyle}>Region Split 大小 (MB)</span>
                <input
                  style={inputStyle}
                  type="number"
                  value={snapshot.consensus.regionSplitSizeMb}
                  onChange={handleConsensusFieldChange("regionSplitSizeMb")}
                />
              </label>
              <label style={fieldStyle}>
                <span style={labelStyle}>Region Split Keys</span>
                <input
                  style={inputStyle}
                  type="number"
                  value={snapshot.consensus.regionSplitKeys}
                  onChange={handleConsensusFieldChange("regionSplitKeys")}
                />
              </label>
            </div>
            <Divider />
            <div style={{ display: "grid", gap: 12 }}>
              <label style={fieldStyle}>
                <span style={labelStyle}>手动 Split (Region ID)</span>
                <input
                  style={inputStyle}
                  value={snapshot.consensus.manualSplitCandidate}
                  onChange={handleConsensusFieldChange("manualSplitCandidate")}
                  placeholder="region-xxxx"
                />
              </label>
              <label style={fieldStyle}>
                <span style={labelStyle}>手动 Merge (目标 Region)</span>
                <input
                  style={inputStyle}
                  value={snapshot.consensus.manualMergeTarget}
                  onChange={handleConsensusFieldChange("manualMergeTarget")}
                  placeholder="region-yyyy"
                />
              </label>
              <div style={actionsStyle}>
                <button
                  style={buttonStyle}
                  onClick={() => triggerManualAction("执行手动 Region Split")}
                >
                  执行 Split
                </button>
                <button
                  style={buttonStyle}
                  onClick={() => triggerManualAction("执行手动 Region Merge")}
                >
                  执行 Merge
                </button>
              </div>
            </div>
          </section>

          <section style={cardStyle}>
            <div style={sectionHeaderStyle}>
              <span style={sectionTitleStyle}>调度策略</span>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <label style={{ ...toggleRowStyle, padding: "6px 12px" }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>全局调度</span>
                  <input
                    type="checkbox"
                    checked={snapshot.scheduling.globalEnabled}
                    aria-label="切换全局调度"
                    onChange={handleSchedulerGlobalToggle}
                  />
                </label>
              </div>
            </div>
            <div style={fieldGridStyle}>
              <label style={fieldStyle}>
                <span style={labelStyle}>热点阈值</span>
                <input
                  style={sliderStyle}
                  type="range"
                  min={0.05}
                  max={0.6}
                  step={0.01}
                  value={snapshot.scheduling.hotRegionThreshold}
                  onChange={handleHotThresholdChange}
                />
                <span style={{ fontSize: 13, color: "rgba(71, 85, 105, 0.9)" }}>
                  {(snapshot.scheduling.hotRegionThreshold * 100).toFixed(0)}%
                </span>
              </label>
              <label style={fieldStyle}>
                <span style={labelStyle}>副本巡检间隔 (秒)</span>
                <input
                  style={inputStyle}
                  type="number"
                  min={15}
                  step={5}
                  value={snapshot.scheduling.replicaCheckIntervalSec}
                  onChange={handleReplicaIntervalChange}
                />
              </label>
            </div>
            <Divider />
            <div style={listStyle}>
              {snapshot.scheduling.schedulers.map((scheduler) => (
                <div key={scheduler.id} style={listItemStyle}>
                  <div style={sectionHeaderStyle}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{scheduler.label}</div>
                      <div style={{ fontSize: 13, color: "rgba(71, 85, 105, 0.85)" }}>
                        {scheduler.description}
                      </div>
                    </div>
                    <label style={{ ...toggleRowStyle, padding: "6px 12px" }}>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>启用</span>
                      <input
                        type="checkbox"
                        checked={scheduler.enabled}
                        aria-label={`${scheduler.label} 切换`}
                        onChange={() => handleToggleScheduler(scheduler.id)}
                      />
                    </label>
                  </div>
                  <div style={fieldGridStyle}>
                    {Object.entries(scheduler.params).map(([key, value]) => (
                      <label key={key} style={fieldStyle}>
                        <span style={labelStyle}>{key}</span>
                        {typeof value === "boolean" ? (
                          <label style={{ ...toggleRowStyle, padding: "6px 12px" }}>
                            <input
                              type="checkbox"
                              checked={value}
                              aria-label={`${scheduler.label} 参数 ${key}`}
                              onChange={handleSchedulerParamChange(scheduler.id, key)}
                            />
                          </label>
                        ) : (
                          <input
                            style={inputStyle}
                            type={typeof value === "number" ? "number" : "text"}
                            value={value}
                            onChange={handleSchedulerParamChange(scheduler.id, key)}
                          />
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section style={cardStyle}>
            <div style={sectionHeaderStyle}>
              <span style={sectionTitleStyle}>分层存储</span>
            </div>
            <div style={listStyle}>
              {snapshot.storage.tiers.map((tier, index) => (
                <div key={tier.name} style={listItemStyle}>
                  <div style={sectionHeaderStyle}>
                    <div style={{ fontWeight: 700 }}>{tier.name}</div>
                  </div>
                  <div style={fieldGridStyle}>
                    <label style={fieldStyle}>
                      <span style={labelStyle}>挂载路径</span>
                      <input
                        style={inputStyle}
                        value={tier.mountPath}
                        onChange={handleTierChange(index, "mountPath")}
                      />
                    </label>
                    <label style={fieldStyle}>
                      <span style={labelStyle}>容量 (GB)</span>
                      <input
                        style={inputStyle}
                        type="number"
                        value={tier.capacityGb}
                        onChange={handleTierCapacityChange(index, "capacityGb")}
                      />
                    </label>
                    <label style={fieldStyle}>
                      <span style={labelStyle}>已使用 (GB)</span>
                      <input
                        style={inputStyle}
                        type="number"
                        value={tier.usedGb}
                        onChange={handleTierCapacityChange(index, "usedGb")}
                      />
                    </label>
                    <label style={fieldStyle}>
                      <span style={labelStyle}>热度策略</span>
                      <select
                        style={inputStyle}
                        value={tier.policy}
                        onChange={handleTierChange(index, "policy")}
                      >
                        <option value="hot">hot</option>
                        <option value="warm">warm</option>
                        <option value="cold">cold</option>
                      </select>
                    </label>
                    <label style={fieldStyle}>
                      <span style={labelStyle}>实时热点 (%)</span>
                      <input
                        style={inputStyle}
                        type="number"
                        min={0}
                        max={100}
                        value={tier.hotPercent}
                        onChange={handleTierChange(index, "hotPercent")}
                      />
                    </label>
                  </div>
                  <div style={actionsStyle}>
                    <button
                      style={{ ...buttonStyle, fontSize: 12 }}
                      onClick={() => triggerManualAction(`${tier.name} 执行冷热数据重平衡`)}
                    >
                      冷热数据重平衡
                    </button>
                    <button
                      style={{ ...buttonStyle, fontSize: 12 }}
                      onClick={() => triggerManualAction(`${tier.name} 触发实时数据 flush`)}
                    >
                      触发 Flush
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section style={cardStyle}>
            <div style={sectionHeaderStyle}>
              <span style={sectionTitleStyle}>故障与恢复</span>
              <span style={pillStyle("warning")}>自动化 + 手动兜底</span>
            </div>
            <div style={fieldGridStyle}>
              <label style={fieldStyle}>
                <span style={labelStyle}>故障检测窗口 (秒)</span>
                <input
                  style={inputStyle}
                  type="number"
                  value={snapshot.recovery.failureDetectionWindowSec}
                  onChange={handleRecoveryFieldChange("failureDetectionWindowSec")}
                />
              </label>
              <label style={fieldStyle}>
                <span style={labelStyle}>连续故障阈值</span>
                <input
                  style={inputStyle}
                  type="number"
                  value={snapshot.recovery.consecutiveFailureThreshold}
                  onChange={handleRecoveryFieldChange("consecutiveFailureThreshold")}
                />
              </label>
              <label style={fieldStyle}>
                <span style={labelStyle}>自动 Rebalance</span>
                <label style={{ ...toggleRowStyle, padding: "6px 12px" }}>
                  <input
                    type="checkbox"
                    checked={snapshot.recovery.autoRebalance}
                    aria-label="切换自动 Rebalance"
                    onChange={handleRecoveryFieldChange("autoRebalance")}
                  />
                </label>
              </label>
            </div>
            <label style={fieldStyle}>
              <span style={labelStyle}>手动恢复目标</span>
              <input
                style={inputStyle}
                value={snapshot.recovery.manualRecoveryTarget}
                onChange={handleRecoveryFieldChange("manualRecoveryTarget")}
                placeholder="store-1 / region-xxxx"
              />
            </label>
            <div style={actionsStyle}>
              <button
                style={{ ...buttonStyle, fontSize: 12 }}
                onClick={() => triggerManualAction("触发故障模拟")}
              >
                模拟故障
              </button>
              <button
                style={{ ...buttonStyle, fontSize: 12 }}
                onClick={() => triggerManualAction("触发手动恢复流程")}
              >
                手动恢复
              </button>
              <button
                style={{ ...buttonStyle, fontSize: 12 }}
                onClick={() => triggerManualAction("执行 Leader 重新选举")}
              >
                Leader 重选
              </button>
            </div>
          </section>

          <section style={cardStyle}>
            <div style={sectionHeaderStyle}>
              <span style={sectionTitleStyle}>日志与监控</span>
            </div>
            <div style={fieldGridStyle}>
              <label style={fieldStyle}>
                <span style={labelStyle}>日志级别</span>
                <select
                  style={inputStyle}
                  value={snapshot.monitoring.logLevel}
                  onChange={handleMonitoringFieldChange("logLevel")}
                >
                  <option value="TRACE">TRACE</option>
                  <option value="DEBUG">DEBUG</option>
                  <option value="INFO">INFO</option>
                  <option value="WARN">WARN</option>
                  <option value="ERROR">ERROR</option>
                </select>
              </label>
              <label style={fieldStyle}>
                <span style={labelStyle}>Metrics Endpoint</span>
                <input
                  style={inputStyle}
                  value={snapshot.monitoring.metricsEndpoint}
                  onChange={handleMonitoringFieldChange("metricsEndpoint")}
                />
              </label>
              <label style={fieldStyle}>
                <span style={labelStyle}>CPU Alert 阈值 (%)</span>
                <input
                  style={inputStyle}
                  type="number"
                  value={snapshot.monitoring.cpuAlertThreshold}
                  onChange={handleMonitoringFieldChange("cpuAlertThreshold")}
                />
              </label>
              <label style={fieldStyle}>
                <span style={labelStyle}>存储 Alert 阈值 (%)</span>
                <input
                  style={inputStyle}
                  type="number"
                  value={snapshot.monitoring.storageAlertThreshold}
                  onChange={handleMonitoringFieldChange("storageAlertThreshold")}
                />
              </label>
            </div>
            <label style={fieldStyle}>
              <span style={labelStyle}>报警 Endpoints (逗号分隔)</span>
              <textarea
                style={textareaStyle}
                value={snapshot.monitoring.alertEndpoints.join(", ")}
                onChange={(evt) =>
                  setSnapshot((prev) => ({
                    ...prev,
                    monitoring: {
                      ...prev.monitoring,
                      alertEndpoints: evt.target.value
                        .split(",")
                        .map((url) => url.trim())
                        .filter(Boolean),
                    },
                    lastUpdatedAt: new Date().toISOString(),
                  }))
                }
              />
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>启用审计日志</span>
              <label style={{ ...toggleRowStyle, padding: "6px 12px" }}>
                <input
                  type="checkbox"
                  checked={snapshot.monitoring.auditEnabled}
                    aria-label="切换审计日志"
                  onChange={(evt) =>
                    setSnapshot((prev) => ({
                      ...prev,
                      monitoring: {
                        ...prev.monitoring,
                        auditEnabled: (evt.target as HTMLInputElement).checked,
                      },
                      lastUpdatedAt: new Date().toISOString(),
                    }))
                  }
                />
              </label>
            </label>
          </section>

          <section style={cardStyle}>
            <div style={sectionHeaderStyle}>
              <span style={sectionTitleStyle}>安全</span>
            </div>
            <div style={fieldGridStyle}>
              <label style={fieldStyle}>
                <span style={labelStyle}>CA 证书路径</span>
                <input
                  style={inputStyle}
                  value={snapshot.security.caCert}
                  onChange={handleSecurityFieldChange("caCert")}
                />
              </label>
              <label style={fieldStyle}>
                <span style={labelStyle}>节点证书路径</span>
                <input
                  style={inputStyle}
                  value={snapshot.security.nodeCert}
                  onChange={handleSecurityFieldChange("nodeCert")}
                />
              </label>
              <label style={fieldStyle}>
                <span style={labelStyle}>认证模式</span>
                <select
                  style={inputStyle}
                  value={snapshot.security.authMode}
                  onChange={handleSecurityFieldChange("authMode")}
                >
                  <option value="rbac">RBAC</option>
                  <option value="acl">ACL</option>
                  <option value="native">原生</option>
                </select>
              </label>
              <label style={fieldStyle}>
                <span style={labelStyle}>审计保留 (天)</span>
                <input
                  style={inputStyle}
                  type="number"
                  value={snapshot.security.auditRetentionDays}
                  onChange={handleSecurityFieldChange("auditRetentionDays")}
                />
              </label>
            </div>
            <label style={fieldStyle}>
              <span style={labelStyle}>白名单 CIDRs (逗号分隔)</span>
              <textarea
                style={textareaStyle}
                value={snapshot.security.allowedCIDRs.join(", ")}
                onChange={handleSecurityFieldChange("allowedCIDRs")}
              />
            </label>
            <div style={actionsStyle}>
              <button
                style={{ ...buttonStyle, fontSize: 12 }}
                onClick={() => triggerManualAction("证书轮换")}
              >
                证书轮换
              </button>
              <button
                style={{ ...buttonStyle, fontSize: 12 }}
                onClick={() => triggerManualAction("触发全量权限审计")}
              >
                权限审计
              </button>
            </div>
          </section>

          <section
            style={{
              ...cardStyle,
              border: "1px solid rgba(239, 68, 68, 0.22)",
              gridColumn: "1 / -1",
            }}
          >
            <div style={sectionHeaderStyle}>
              <span style={sectionTitleStyle}>高级 / Danger Zone</span>
              <span style={pillStyle("danger")}>需谨慎操作</span>
            </div>
            <div style={fieldGridStyle}>
              <label style={fieldStyle}>
                <span style={labelStyle}>下一个 Region ID</span>
                <input
                  style={inputStyle}
                  type="number"
                  value={snapshot.dangerZone.nextRegionId}
                  onChange={handleDangerZoneToggle("nextRegionId")}
                />
              </label>
              <label style={fieldStyle}>
                <span style={labelStyle}>下一个 Store ID</span>
                <input
                  style={inputStyle}
                  type="number"
                  value={snapshot.dangerZone.nextStoreId}
                  onChange={handleDangerZoneToggle("nextStoreId")}
                />
              </label>
            </div>
            <div style={fieldGridStyle}>
              <label style={fieldStyle}>
                <span style={labelStyle}>允许强制迁移 Leader</span>
                <label style={{ ...toggleRowStyle, padding: "6px 12px" }}>
                  <input
                    type="checkbox"
                    checked={snapshot.dangerZone.allowForceTransferLeader}
                    aria-label="切换强制迁移 Leader"
                    onChange={handleDangerZoneToggle("allowForceTransferLeader")}
                  />
                </label>
              </label>
              <label style={fieldStyle}>
                <span style={labelStyle}>允许重置缓存</span>
                <label style={{ ...toggleRowStyle, padding: "6px 12px" }}>
                  <input
                    type="checkbox"
                    checked={snapshot.dangerZone.allowCacheReset}
                    aria-label="切换重置缓存"
                    onChange={handleDangerZoneToggle("allowCacheReset")}
                  />
                </label>
              </label>
            </div>
            <div style={actionsStyle}>
              <button
                style={{ ...primaryButtonStyle, background: "#ef4444", boxShadow: "0 16px 34px rgba(239, 68, 68, 0.28)" }}
                onClick={() => triggerManualAction("强制迁移 Leader")}
              >
                强制迁移 Leader
              </button>
              <button
                style={{ ...primaryButtonStyle, background: "#f97316", boxShadow: "0 16px 34px rgba(249, 115, 22, 0.28)" }}
                onClick={() => triggerManualAction("重置全部缓存")}
              >
                重置缓存
              </button>
              <button
                style={{ ...primaryButtonStyle, background: "#334155", boxShadow: "0 16px 34px rgba(51, 65, 85, 0.28)" }}
                onClick={() => triggerManualAction("ID 分配器回滚")}
              >
                ID 分配回滚
              </button>
            </div>
          </section>
          {!jsonCollapsed && (
            <section style={{ ...cardStyle, gridColumn: "1 / -1" }}>
              <div style={sectionHeaderStyle}>
                <span style={sectionTitleStyle}>配置 JSON 预览</span>
                <button
                  style={{ ...buttonStyle, fontSize: 12, padding: "6px 12px" }}
                  onClick={() =>
                    navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2))
                  }
                >
                  复制 JSON
                </button>
              </div>
              <pre style={jsonPreviewStyle}>{JSON.stringify(snapshot, null, 2)}</pre>
            </section>
          )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}