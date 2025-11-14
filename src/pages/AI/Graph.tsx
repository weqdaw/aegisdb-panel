import { useMemo, useState } from "react";
import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  ToolboxComponent,
  DataZoomComponent,
  VisualMapComponent,
  MarkPointComponent,
} from "echarts/components";
import { ScatterChart } from "echarts/charts";
import { CanvasRenderer } from "echarts/renderers";
import { UniversalTransition } from "echarts/features";
import { useNavigate } from "react-router-dom";
import type { CallbackDataParams } from "echarts/types/dist/shared";

echarts.use([
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  ToolboxComponent,
  DataZoomComponent,
  VisualMapComponent,
  MarkPointComponent,
  ScatterChart,
  CanvasRenderer,
  UniversalTransition,
]);

type SemanticNode = {
  id: string;
  key: string;
  label: string;
  sector: string;
  region: string;
  currency: string;
  riskLevel: "低" | "中" | "高";
  embedding: number[];
  volatility: number;
  velocity: number;
  summary: string;
  lastUpdated: string;
};

type ProjectedNode = SemanticNode & {
  x: number;
  y: number;
  clusterId: number;
};

type Algorithm = "kmeans" | "agglomerative" | "dbscan";

type ClusteringResult = {
  labels: number[];
  centroids: number[][];
  iterations?: number;
  inertia?: number;
  noiseCount?: number;
};

type ClusterInsight = {
  id: number;
  label: string;
  size: number;
  avgVolatility: number;
  avgVelocity: number;
  topRegions: string[];
  sampleKeys: string[];
};

type ScatterDatum = {
  value: [number, number];
  key: string;
  name: string;
  sector: string;
  region: string;
  currency: string;
  riskLevel: SemanticNode["riskLevel"];
  volatility: number;
  velocity: number;
  clusterId: number;
  summary: string;
};

const palette = [
  "#2563eb",
  "#0ea5e9",
  "#22c55e",
  "#f97316",
  "#a855f7",
  "#ef4444",
  "#14b8a6",
  "#f59e0b",
  "#6366f1",
  "#ec4899",
  "#2dd4bf",
  "#84cc16",
  "#f43f5e",
  "#8b5cf6",
  "#0ea5e9",
];

const containerStyle: React.CSSProperties = {
  display: "grid",
  gap: 24,
  background: "linear-gradient(180deg, #f1f5ff 0%, #ffffff 40%)",
  padding: "32px clamp(24px, 4vw, 56px)",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 16,
};

const controlPanelStyle: React.CSSProperties = {
  display: "grid",
  gap: 18,
  background: "rgba(255, 255, 255, 0.92)",
  borderRadius: 18,
  border: "1px solid rgba(15, 23, 42, 0.06)",
  boxShadow: "0 18px 42px rgba(15, 23, 42, 0.12)",
  padding: "24px 28px",
};

const controlGrid: React.CSSProperties = {
  display: "grid",
  gap: 16,
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
};

const chipStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 999,
  background: "rgba(59, 130, 246, 0.12)",
  color: "#1d4ed8",
  fontSize: 13,
  fontWeight: 600,
};

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#475569",
  marginBottom: 6,
  display: "block",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 600,
  color: "#0f172a",
  margin: 0,
};

const statsGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 16,
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
};

const statCardStyle: React.CSSProperties = {
  padding: "18px 20px",
  borderRadius: 16,
  border: "1px solid rgba(148, 163, 184, 0.25)",
  background: "linear-gradient(135deg, rgba(148, 163, 244, 0.12), rgba(226, 232, 240, 0.36))",
  display: "grid",
  gap: 6,
};

const insightsContainerStyle: React.CSSProperties = {
  background: "rgba(255, 255, 255, 0.96)",
  borderRadius: 18,
  border: "1px solid rgba(15, 23, 42, 0.06)",
  padding: "24px 28px",
  display: "grid",
  gap: 18,
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: "0 10px",
};

const tableHeaderCell: React.CSSProperties = {
  textAlign: "left",
  fontSize: 13,
  color: "#475569",
  padding: "8px 12px",
};

const tableCell: React.CSSProperties = {
  padding: "12px 14px",
  background: "rgba(248, 250, 252, 0.85)",
  borderRadius: 12,
  fontSize: 13,
  color: "#334155",
};

const toolbarStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "flex-end",
};

const buttonStyle: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: 12,
  border: "none",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
  transition: "transform 0.2s ease",
};

function createSeededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s ^ (s << 13)) >>> 0;
    s = (s ^ (s >> 17)) >>> 0;
    s = (s ^ (s << 5)) >>> 0;
    return (s & 0xffffffff) / 0x100000000;
  };
}

const themes = [
  {
    name: "宏观经济",
    sector: "Macro Indicators",
    region: "全球",
    currency: "USD",
    risk: "中" as const,
    center: [1.4, 0.8, -0.3, 0.2, 0.5, -1.2, 0.9, 0.4],
    variance: 0.45,
    prefixes: ["macro:gdp", "macro:cpi", "macro:ppi"],
    samples: ["全球GDP增速预期", "核心CPI月度对比", "美国PPI同比压力"],
  },
  {
    name: "央行政策",
    sector: "Central Bank Watch",
    region: "北美",
    currency: "USD",
    risk: "中" as const,
    center: [-0.6, 1.8, 0.4, -0.9, 0.3, 1.5, -0.2, 0.6],
    variance: 0.4,
    prefixes: ["policy:fed", "policy:rate", "policy:bop"],
    samples: ["美联储利率决议前瞻", "央行资产负债表扩张", "准备金率预期调整"],
  },
  {
    name: "固定收益",
    sector: "Fixed Income",
    region: "亚洲",
    currency: "CNY",
    risk: "低" as const,
    center: [0.5, -1.2, 1.1, 0.8, -0.4, 0.3, -0.7, 1.2],
    variance: 0.32,
    prefixes: ["bond:gov", "bond:credit", "bond:yld"],
    samples: ["国债收益率曲线拐点", "信用债利差变动", "离岸收益率波动"],
  },
  {
    name: "外汇与大宗",
    sector: "FX & Commodities",
    region: "全球",
    currency: "MULTI",
    risk: "高" as const,
    center: [-1.1, -0.4, 1.8, -0.6, 1.1, 0.5, -1.4, 0.9],
    variance: 0.55,
    prefixes: ["fx:usd", "fx:oil", "fx:metal"],
    samples: ["美元指数波动率回升", "WTI原油库存数据", "贵金属避险需求"],
  },
  {
    name: "权益市场",
    sector: "Equity Pulse",
    region: "欧美",
    currency: "USD",
    risk: "中" as const,
    center: [1.7, -0.2, -1.2, 0.6, 0.9, -0.5, 1.1, -0.7],
    variance: 0.48,
    prefixes: ["eq:earnings", "eq:valuation", "eq:alpha"],
    samples: ["纳指成长股溢价", "金融板块ROE变动", "蓝筹股资金流向"],
  },
  {
    name: "另类投资",
    sector: "Alternatives",
    region: "欧洲",
    currency: "EUR",
    risk: "高" as const,
    center: [-0.8, 1.3, -0.4, 1.6, -1.1, 0.8, -0.2, -0.6],
    variance: 0.6,
    prefixes: ["alt:hedge", "alt:pe", "alt:reits"],
    samples: ["对冲基金净敞口", "私募股权募资热度", "欧洲商业地产资本化率"],
  },
  {
    name: "风险管理",
    sector: "Risk Signals",
    region: "全球",
    currency: "USD",
    risk: "高" as const,
    center: [0.9, 0.4, -1.5, 1.2, -0.3, -0.9, 0.7, -0.4],
    variance: 0.5,
    prefixes: ["risk:stress", "risk:liquidity", "risk:credit"],
    samples: ["系统性风险热力", "跨市场流动性指数", "违约概率预警"],
  },
  {
    name: "ESG与可持续",
    sector: "Sustainable Finance",
    region: "全球",
    currency: "MULTI",
    risk: "低" as const,
    center: [-0.3, 0.7, 1.3, -0.8, 1.5, 0.4, -0.5, 1.1],
    variance: 0.35,
    prefixes: ["esg:score", "esg:impact", "esg:bond"],
    samples: ["绿色债券发行势能", "碳排放权益价格指数", "ESG评级变动"],
  },
  {
    name: "产业链追踪",
    sector: "Supply Chain Intelligence",
    region: "亚洲",
    currency: "JPY",
    risk: "中" as const,
    center: [1.2, -1.1, 0.6, 1.4, -0.7, 0.3, 1.5, -1.2],
    variance: 0.44,
    prefixes: ["chain:semi", "chain:auto", "chain:retail"],
    samples: ["半导体产能利用率", "新能源汽车供应链稳健度", "跨国零售库存周转"],
  },
  {
    name: "财富管理",
    sector: "Wealth Advisory",
    region: "亚太",
    currency: "HKD",
    risk: "低" as const,
    center: [-1.3, 0.9, 0.5, -0.4, 1.6, -0.7, 0.4, 1.5],
    variance: 0.3,
    prefixes: ["wm:portfolio", "wm:fundflow", "wm:client"],
    samples: ["高净值资产配置倾向", "跨境理财通资金流向", "家族办公室主题偏好"],
  },
];

function generateSemanticNodes(count = 300, seed = 2025): SemanticNode[] {
  const rand = createSeededRandom(seed);
  const nodes: SemanticNode[] = [];
  const perTheme = Math.ceil(count / themes.length);

  themes.forEach((theme, themeIndex) => {
    for (let i = 0; i < perTheme; i += 1) {
      if (nodes.length >= count) break;
      const prefix = theme.prefixes[Math.floor(rand() * theme.prefixes.length)];
      const sample = theme.samples[Math.floor(rand() * theme.samples.length)];
      const embedding = theme.center.map((value, dimIndex) => {
        const noise = (rand() - 0.5) * theme.variance * 2.4;
        const drift = Math.sin((themeIndex + 1) * (dimIndex + 1) * 0.37) * 0.08;
        return Number((value + noise + drift).toFixed(4));
      });

      const riskLevel =
        theme.risk === "高" && rand() > 0.6
          ? "高"
          : theme.risk === "低" && rand() > 0.7
            ? "低"
            : "中";

      const volatility = Number((0.25 + rand() * 0.65).toFixed(3));
      const velocity = Number((0.15 + rand() * 0.58).toFixed(3));

      const id = `${prefix}-${String(i + 1).padStart(3, "0")}`;

      nodes.push({
        id,
        key: id,
        label: `${theme.name} · ${sample}`,
        sector: theme.sector,
        region: theme.region,
        currency: theme.currency,
        riskLevel,
        embedding,
        volatility,
        velocity,
        summary: `${sample}（${theme.sector}）`,
        lastUpdated: `2025-${String(Math.floor(rand() * 12) + 1).padStart(2, "0")}-${String(
          Math.floor(rand() * 28) + 1,
        ).padStart(2, "0")}`,
      });
    }
  });

  return nodes;
}

function projectTo2D(
  data: SemanticNode[],
): { components: number[][]; projected: { x: number; y: number }[] } {
  if (data.length === 0) {
    return { components: [], projected: [] };
  }

  const dimension = data[0].embedding.length;
  const mean = new Array(dimension).fill(0);

  data.forEach((node) => {
    node.embedding.forEach((value, idx) => {
      mean[idx] += value;
    });
  });

  for (let i = 0; i < dimension; i += 1) {
    mean[i] /= data.length;
  }

  const centered = data.map((node) => node.embedding.map((value, idx) => value - mean[idx]));
  const covariance = Array.from({ length: dimension }, () => new Array(dimension).fill(0));

  centered.forEach((vector) => {
    for (let i = 0; i < dimension; i += 1) {
      for (let j = i; j < dimension; j += 1) {
        covariance[i][j] += vector[i] * vector[j];
      }
    }
  });

  for (let i = 0; i < dimension; i += 1) {
    for (let j = i; j < dimension; j += 1) {
      const value = covariance[i][j] / (data.length - 1 || 1);
      covariance[i][j] = value;
      covariance[j][i] = value;
    }
  }

  const components: number[][] = [];

  const dotProduct = (vecA: number[], vecB: number[]) =>
    vecA.reduce((acc, val, idx) => acc + val * (vecB[idx] ?? 0), 0);

  const powerIteration = (matrix: number[][], orthogonalTo: number[][] = [], iterations = 120) => {
    let vector = new Array(matrix.length).fill(0).map(() => Math.random());
    const normalize = (vec: number[]) => {
      const norm = Math.sqrt(vec.reduce((acc, val) => acc + val * val, 0)) || 1;
      return vec.map((val) => val / norm);
    };

    vector = normalize(vector);

    for (let iter = 0; iter < iterations; iter += 1) {
      const next = new Array(vector.length).fill(0);
      for (let i = 0; i < matrix.length; i += 1) {
        for (let j = 0; j < matrix.length; j += 1) {
          next[i] += matrix[i][j] * vector[j];
        }
      }

      orthogonalTo.forEach((basis) => {
        const dot = next.reduce((acc, val, idx) => acc + val * basis[idx], 0);
        for (let k = 0; k < next.length; k += 1) {
          next[k] -= dot * basis[k];
        }
      });

      vector = normalize(next);
    }

    const eigenvalue = vector.reduce((acc, val, idx) => acc + val * dotProduct(matrix[idx], vector), 0);
    return { eigenvalue, eigenvector: vector };
  };

  const { eigenvector: first } = powerIteration(covariance);
  components.push(first);

  const { eigenvector: second } = powerIteration(covariance, [first]);
  components.push(second);

  const projected = centered.map((vector) => ({
    x: dotProduct(vector, components[0]),
    y: dotProduct(vector, components[1]),
  }));

  return { components, projected };
}

function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

function extractValidEmbeddings(data: SemanticNode[]) {
  const indices: number[] = [];
  const vectors: number[][] = [];
  let dimension = 0;

  data.forEach((item, idx) => {
    const embedding = item?.embedding;
    if (!Array.isArray(embedding) || embedding.length === 0) {
      return;
    }

    const normalized = embedding
      .map((value) => {
        const num = Number(value);
        return Number.isFinite(num) ? num : 0;
      })
      .filter((value) => Number.isFinite(value));

    if (normalized.length === 0) {
      return;
    }

    if (dimension === 0) {
      dimension = normalized.length;
    }

    if (dimension === 0) {
      return;
    }

    const vector =
      normalized.length === dimension
        ? Array.from(normalized)
        : Array.from({ length: dimension }, (_, i) => {
            const value = normalized[i];
            return Number.isFinite(value) ? value : 0;
          });

    if (!vector.every((value) => Number.isFinite(value))) {
      return;
    }

    indices.push(idx);
    vectors.push(vector);
  });

  return { indices, vectors, dimension };
}

function runKMeans(data: SemanticNode[], k: number, maxIterations = 40): ClusteringResult {
  if (data.length === 0) {
    return { labels: [], centroids: [], iterations: 0, inertia: 0 };
  }

  const { indices, vectors, dimension } = extractValidEmbeddings(data);

  if (vectors.length === 0 || dimension === 0) {
    return {
      labels: new Array(data.length).fill(-1),
      centroids: [],
      iterations: 0,
      inertia: 0,
    };
  }

  const centroids: number[][] = [];
  const rand = createSeededRandom(1993);

  const usedIndices = new Set<number>();
  const targetCentroids = Math.min(k, vectors.length);
  let safetyCounter = 0;
  const maxAttempts = targetCentroids === 0 ? 0 : vectors.length * 4;

  while (centroids.length < targetCentroids && safetyCounter < maxAttempts) {
    safetyCounter += 1;
    const index = Math.floor(rand() * vectors.length);
    if (usedIndices.has(index)) continue;
    usedIndices.add(index);
    const candidate = vectors[index];
    if (!Array.isArray(candidate) || candidate.length === 0) {
      continue;
    }
    centroids.push([...candidate]);
  }

  if (centroids.length === 0) {
    return {
      labels: new Array(data.length).fill(-1),
      centroids: [],
      iterations: 0,
      inertia: 0,
    };
  }

  const labels = new Array(vectors.length).fill(0);

  let iterations = 0;
  for (; iterations < maxIterations; iterations += 1) {
    let assignmentsChanged = false;

    for (let i = 0; i < vectors.length; i += 1) {
      let bestCluster = 0;
      let bestDistance = Infinity;

      for (let cluster = 0; cluster < centroids.length; cluster += 1) {
        const distance = euclideanDistance(vectors[i], centroids[cluster]);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestCluster = cluster;
        }
      }

      if (labels[i] !== bestCluster) {
        assignmentsChanged = true;
        labels[i] = bestCluster;
      }
    }

    if (!assignmentsChanged) break;

    const sums = Array.from({ length: centroids.length }, () => new Array(dimension).fill(0));
    const counts = new Array(centroids.length).fill(0);

    for (let i = 0; i < vectors.length; i += 1) {
      const cluster = labels[i];
      counts[cluster] += 1;
      for (let dim = 0; dim < dimension; dim += 1) {
        sums[cluster][dim] += vectors[i][dim];
      }
    }

    for (let cluster = 0; cluster < centroids.length; cluster += 1) {
      if (counts[cluster] === 0) continue;
      for (let dim = 0; dim < dimension; dim += 1) {
        centroids[cluster][dim] = sums[cluster][dim] / counts[cluster];
      }
    }
  }

  let inertia = 0;
  for (let i = 0; i < vectors.length; i += 1) {
    inertia += euclideanDistance(vectors[i], centroids[labels[i]]) ** 2;
  }

  const fullLabels = new Array(data.length).fill(-1);
  indices.forEach((dataIdx, vectorIdx) => {
    fullLabels[dataIdx] = labels[vectorIdx];
  });

  return {
    labels: fullLabels,
    centroids,
    iterations,
    inertia: Number(inertia.toFixed(3)),
  };
}

function runAgglomerative(data: SemanticNode[], targetClusters: number): ClusteringResult {
  if (data.length === 0) {
    return { labels: [], centroids: [] };
  }

  const { indices, vectors, dimension } = extractValidEmbeddings(data);

  if (vectors.length === 0 || dimension === 0) {
    return { labels: new Array(data.length).fill(-1), centroids: [] };
  }

  const clusters: number[][] = vectors.map((_, idx) => [idx]);

  if (targetClusters < 1) {
    return { labels: new Array(data.length).fill(-1), centroids: [] };
  }

  const distanceCache = new Map<string, number>();

  const clusterDistance = (clusterA: number[], clusterB: number[]) => {
    const key = `${clusterA.join("-")}::${clusterB.join("-")}`;
    if (distanceCache.has(key)) {
      return distanceCache.get(key) ?? Infinity;
    }

    let sum = 0;
    let count = 0;

    for (const indexA of clusterA) {
      for (const indexB of clusterB) {
        sum += euclideanDistance(vectors[indexA], vectors[indexB]);
        count += 1;
      }
    }

    const distance = sum / (count || 1);
    distanceCache.set(key, distance);
    return distance;
  };

  while (clusters.length > targetClusters) {
    let bestI = 0;
    let bestJ = 1;
    let bestDistance = Infinity;

    for (let i = 0; i < clusters.length; i += 1) {
      for (let j = i + 1; j < clusters.length; j += 1) {
        const distance = clusterDistance(clusters[i], clusters[j]);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestI = i;
          bestJ = j;
        }
      }
    }

    const merged = [...clusters[bestI], ...clusters[bestJ]];
    clusters.splice(bestJ, 1);
    clusters.splice(bestI, 1, merged);
  }

  const labels = new Array(vectors.length).fill(0);
  const centroids = clusters.map((cluster) => {
    const centroid = new Array(dimension).fill(0);
    cluster.forEach((index) => {
      vectors[index].forEach((value, dim) => {
        centroid[dim] += value;
      });
    });
    for (let dim = 0; dim < centroid.length; dim += 1) {
      centroid[dim] /= cluster.length;
    }
    return centroid;
  });

  clusters.forEach((cluster, clusterIdx) => {
    cluster.forEach((nodeIdx) => {
      labels[nodeIdx] = clusterIdx;
    });
  });

  const fullLabels = new Array(data.length).fill(-1);
  indices.forEach((dataIdx, vectorIdx) => {
    fullLabels[dataIdx] = labels[vectorIdx];
  });

  return { labels: fullLabels, centroids };
}

function runDbscan(data: SemanticNode[], eps: number, minPts: number): ClusteringResult {
  if (data.length === 0) {
    return { labels: [], centroids: [], noiseCount: 0 };
  }

  const { indices, vectors, dimension } = extractValidEmbeddings(data);

  if (vectors.length === 0 || dimension === 0) {
    return { labels: new Array(data.length).fill(-1), centroids: [], noiseCount: data.length };
  }

  const n = vectors.length;
  const labels = new Array(n).fill(-1);
  const visited = new Array(n).fill(false);
  let clusterId = 0;

  const regionQuery = (pointIdx: number) => {
    const neighbors: number[] = [];
    for (let i = 0; i < n; i += 1) {
      if (euclideanDistance(vectors[pointIdx], vectors[i]) <= eps) {
        neighbors.push(i);
      }
    }
    return neighbors;
  };

  for (let i = 0; i < n; i += 1) {
    if (visited[i]) continue;
    visited[i] = true;

    const neighbors = regionQuery(i);
    if (neighbors.length < minPts) {
      labels[i] = -1;
      continue;
    }

    labels[i] = clusterId;
    const seeds = [...neighbors];

    while (seeds.length > 0) {
      const current = seeds.pop();
      if (current === undefined) break;

      if (!visited[current]) {
        visited[current] = true;
        const currentNeighbors = regionQuery(current);
        if (currentNeighbors.length >= minPts) {
          currentNeighbors.forEach((neighborIdx) => {
            if (!seeds.includes(neighborIdx)) {
              seeds.push(neighborIdx);
            }
          });
        }
      }

      if (labels[current] === -1) {
        labels[current] = clusterId;
      }
    }

    clusterId += 1;
  }

  const centroids: number[][] = [];
  for (let cluster = 0; cluster < clusterId; cluster += 1) {
    const members: number[] = [];
    for (let i = 0; i < n; i += 1) {
      if (labels[i] === cluster) {
        members.push(i);
      }
    }
    if (members.length === 0) continue;

    const centroid = new Array(dimension).fill(0);
    members.forEach((index) => {
      vectors[index].forEach((value, dim) => {
        centroid[dim] += value;
      });
    });
    for (let dim = 0; dim < centroid.length; dim += 1) {
      centroid[dim] /= members.length;
    }
    centroids.push(centroid);
  }

  const fullLabels = new Array(data.length).fill(-1);
  indices.forEach((dataIdx, vectorIdx) => {
    fullLabels[dataIdx] = labels[vectorIdx];
  });

  const noiseCount = fullLabels.filter((label) => label === -1).length;

  return {
    labels: fullLabels,
    centroids,
    noiseCount,
  };
}

const formatNumber = (value: number, digits = 2) => Number(value.toFixed(digits));

const riskColorMap: Record<SemanticNode["riskLevel"], string> = {
  高: "#ef4444",
  中: "#f97316",
  低: "#22c55e",
};

const riskLabelMap: Record<SemanticNode["riskLevel"], string> = {
  高: "高风险",
  中: "中性",
  低: "稳健",
};

const chartHeight = 640;

export default function Graph() {
  const navigate = useNavigate();
  const [algorithm, setAlgorithm] = useState<Algorithm>("kmeans");
  const [clusterCount, setClusterCount] = useState(8);
  const [dbscanEps, setDbscanEps] = useState(1.6);
  const [dbscanMinPts, setDbscanMinPts] = useState(8);

  const baseNodes = useMemo(() => generateSemanticNodes(300), []);
  const { projected } = useMemo(() => projectTo2D(baseNodes), [baseNodes]);

  const clustering = useMemo(() => {
    const safeClusterCount = Math.max(2, Math.min(clusterCount, 24));

    if (algorithm === "kmeans") {
      return runKMeans(baseNodes, safeClusterCount);
    }
    if (algorithm === "agglomerative") {
      return runAgglomerative(baseNodes, safeClusterCount);
    }
    return runDbscan(baseNodes, dbscanEps, dbscanMinPts);
  }, [algorithm, baseNodes, clusterCount, dbscanEps, dbscanMinPts]);

  const enrichedNodes: ProjectedNode[] = useMemo(() => {
    return baseNodes.map((node, idx) => ({
      ...node,
      x: projected[idx]?.x ?? 0,
      y: projected[idx]?.y ?? 0,
      clusterId: clustering.labels[idx] ?? -1,
    }));
  }, [baseNodes, projected, clustering.labels]);

  const axisExtent = useMemo(() => {
    const xs = enrichedNodes.map((node) => node.x);
    const ys = enrichedNodes.map((node) => node.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const padX = (maxX - minX || 1) * 0.12;
    const padY = (maxY - minY || 1) * 0.12;
    return {
      minX: minX - padX,
      maxX: maxX + padX,
      minY: minY - padY,
      maxY: maxY + padY,
    };
  }, [enrichedNodes]);

  const clusterInsights: ClusterInsight[] = useMemo(() => {
    const grouped = new Map<number, ProjectedNode[]>();
    enrichedNodes.forEach((node) => {
      const bucket = grouped.get(node.clusterId) ?? [];
      bucket.push(node);
      grouped.set(node.clusterId, bucket);
    });

    const insights: ClusterInsight[] = [];
    grouped.forEach((nodes, clusterId) => {
      const label = clusterId === -1 ? "噪声点" : `簇 ${clusterId + 1}`;
      const avgVolatility =
        nodes.reduce((acc, node) => acc + node.volatility, 0) / (nodes.length || 1);
      const avgVelocity = nodes.reduce((acc, node) => acc + node.velocity, 0) / (nodes.length || 1);

      const regionCount = nodes.reduce<Record<string, number>>((acc, node) => {
        acc[node.region] = (acc[node.region] ?? 0) + 1;
        return acc;
      }, {});

      const topRegions = Object.entries(regionCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([name]) => name);

      const sampleKeys = nodes.slice(0, 4).map((node) => node.key);

      insights.push({
        id: clusterId,
        label,
        size: nodes.length,
        avgVolatility: formatNumber(avgVolatility, 3),
        avgVelocity: formatNumber(avgVelocity, 3),
        topRegions,
        sampleKeys,
      });
    });

    insights.sort((a, b) => b.size - a.size);
    return insights;
  }, [enrichedNodes]);

  const chartSeries = useMemo(() => {
    const groups = new Map<number, ProjectedNode[]>();
    enrichedNodes.forEach((node) => {
      const bucket = groups.get(node.clusterId) ?? [];
      bucket.push(node);
      groups.set(node.clusterId, bucket);
    });

    return Array.from(groups.entries()).map(([clusterId, nodes]) => {
      const color =
        clusterId === -1 ? "rgba(148, 163, 184, 0.65)" : palette[clusterId % palette.length];
      const avgVolatility = nodes.reduce((acc, node) => acc + node.volatility, 0) / (nodes.length || 1);
      const dataPoints: ScatterDatum[] = nodes.map((node) => ({
        value: [node.x, node.y],
        key: node.key,
        name: node.label,
        sector: node.sector,
        region: node.region,
        currency: node.currency,
        riskLevel: node.riskLevel,
        volatility: node.volatility,
        velocity: node.velocity,
        clusterId: node.clusterId,
        summary: node.summary,
      }));
      return {
        name: clusterId === -1 ? "噪声点" : `簇 ${clusterId + 1}`,
        type: "scatter" as const,
        data: dataPoints,
        symbolSize: () => {
          const base = 12;
          return Math.max(8, base + avgVolatility * 6);
        },
        itemStyle: {
          color,
          borderColor: "#ffffff",
          borderWidth: 1.2,
        },
        emphasis: {
          focus: "series" as const,
          itemStyle: {
            shadowBlur: 18,
            shadowColor: "rgba(15, 23, 42, 0.25)",
            borderWidth: 2,
          },
        },
        large: nodes.length > 80,
        progressive: 200,
      };
    });
  }, [enrichedNodes]);

  const chartOption = useMemo(() => {
    return {
      backgroundColor: "rgba(248, 250, 255, 0.6)",
      textStyle: {
        fontFamily:
          '"SF Pro Display", "PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif',
      },
      title: {
        text: "语义索引向量图谱",
        subtext: "金融语义向量（300） · 支持聚类与缩放分析",
        left: "center",
        top: 12,
        textStyle: {
          fontSize: 20,
          fontWeight: 600,
          color: "#0f172a",
        },
        subtextStyle: {
          fontSize: 13,
          color: "#475569",
        },
      },
      tooltip: {
        trigger: "item",
        backgroundColor: "rgba(15, 23, 42, 0.92)",
        borderColor: "rgba(148, 163, 184, 0.35)",
        textStyle: { color: "#e2e8f0" },
        formatter: (params: CallbackDataParams) => {
          const data = params.data as ScatterDatum | undefined;
          if (!data) {
            return "";
          }
          return `
            <div style="font-size:13px;">
              <div style="font-weight:600;color:#f8fafc;margin-bottom:6px;">${data.key}</div>
              <div>主题：${data.name}</div>
              <div>行业：${data.sector} · 区域：${data.region}</div>
              <div>风险：<span style="color:${riskColorMap[data.riskLevel]};font-weight:600;">${riskLabelMap[data.riskLevel]}</span></div>
              <div>波动率：${formatNumber(data.volatility, 2)} · 向量速度：${formatNumber(data.velocity, 2)}</div>
              <div style="margin-top:6px;color:#94a3b8;">${data.summary}</div>
            </div>
          `;
        },
      },
      legend: {
        type: "scroll",
        bottom: 12,
        textStyle: { color: "#475569" },
      },
      grid: {
        left: 48,
        right: 24,
        top: 96,
        bottom: 88,
      },
      xAxis: {
        type: "value",
        name: "语义主成分 1",
        nameLocation: "middle",
        nameGap: 36,
        scale: true,
        min: axisExtent.minX,
        max: axisExtent.maxX,
        axisLine: { lineStyle: { color: "rgba(148, 163, 184, 0.65)" } },
        axisLabel: { color: "#475569" },
        splitLine: { lineStyle: { color: "rgba(148, 163, 184, 0.18)" } },
      },
      yAxis: {
        type: "value",
        name: "语义主成分 2",
        nameLocation: "middle",
        nameGap: 42,
        scale: true,
        min: axisExtent.minY,
        max: axisExtent.maxY,
        axisLine: { lineStyle: { color: "rgba(148, 163, 184, 0.65)" } },
        axisLabel: { color: "#475569" },
        splitLine: { lineStyle: { color: "rgba(148, 163, 184, 0.18)" } },
      },
      dataZoom: [
        {
          type: "inside",
          filterMode: "none",
          zoomOnMouseWheel: true,
        },
        {
          type: "slider",
          height: 16,
          bottom: 50,
        },
        {
          type: "slider",
          height: 16,
          orient: "vertical",
          right: 4,
        },
      ],
      toolbox: {
        feature: {
          saveAsImage: { show: true, title: "导出图像" },
          restore: { show: true, title: "重置" },
          dataZoom: { show: true, title: { zoom: "缩放", back: "还原" } },
        },
        right: 16,
        top: 16,
        iconStyle: {
          borderColor: "#1f2937",
        },
      },
      series: chartSeries,
    };
  }, [chartSeries, axisExtent]);

  const clusterCountDisplay =
    algorithm === "dbscan"
      ? Array.from(new Set(clustering.labels.filter((label) => label !== -1))).length
      : new Set(clustering.labels).size;

  const handleExport = (format: "json" | "csv") => {
    const rows = enrichedNodes.map((node) => ({
      id: node.id,
      key: node.key,
      label: node.label,
      sector: node.sector,
      region: node.region,
      currency: node.currency,
      clusterId: node.clusterId,
      riskLevel: node.riskLevel,
      volatility: node.volatility,
      velocity: node.velocity,
      embedding: `[${node.embedding.join(", ")}]`,
      projected: `[${formatNumber(node.x, 3)}, ${formatNumber(node.y, 3)}]`,
      lastUpdated: node.lastUpdated,
    }));

    let content = "";
    let mime = "";
    let filename = "";

    if (format === "json") {
      content = JSON.stringify(rows, null, 2);
      mime = "application/json";
      filename = "semantic-graph-export.json";
    } else {
      const header = Object.keys(rows[0]).join(",");
      const csvRows = rows.map((row) =>
        Object.values(row)
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(","),
      );
      content = [header, ...csvRows].join("\n");
      mime = "text/csv";
      filename = "semantic-graph-export.csv";
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const algorithmDescription: Record<Algorithm, string> = {
    kmeans: "K-Means：适用于球状簇，快速迭代评估语义相近的向量分布。",
    agglomerative: "层次聚类：自底向上的语义凝聚过程，保留语义层级关系。",
    dbscan: "DBSCAN：发现任意形状的语义簇，自动识别噪声与孤立概念。",
  };

  return (
    <div style={containerStyle}>
      <header style={headerStyle}>
        <div>
          <div style={chipStyle}>语义向量分析实验室</div>
          <h1 style={{ margin: "12px 0 0", fontSize: 32, color: "#0f172a" }}>金融语义索引图谱</h1>
          <p style={{ margin: "8px 0 0", color: "#475569", maxWidth: 720, lineHeight: 1.6 }}>
            该图谱展示 300 个与金融市场相关的语义向量节点，涵盖宏观、固收、外汇、风控等场景。
            支持多聚类算法、语义主成分缩放，以及向量数据导出，用于构建语义检索与索引体系。
          </p>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              ...buttonStyle,
              background: "rgba(15, 23, 42, 0.08)",
              color: "#0f172a",
            }}
          >
            返回 AI 面板
          </button>
          <button
            type="button"
            onClick={() => handleExport("json")}
            style={{
              ...buttonStyle,
              background: "linear-gradient(120deg, #1d4ed8, #2563eb)",
              color: "#ffffff",
            }}
          >
            导出 JSON
          </button>
          <button
            type="button"
            onClick={() => handleExport("csv")}
            style={{
              ...buttonStyle,
              background: "linear-gradient(120deg, #0ea5e9, #22d3ee)",
              color: "#0f172a",
            }}
          >
            导出 CSV
          </button>
        </div>
      </header>

      <section style={controlPanelStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <h2 style={sectionTitleStyle}>聚类与可视化控制</h2>
          <span style={{ color: "#475569", fontSize: 13 }}>{algorithmDescription[algorithm]}</span>
        </div>
        <div style={controlGrid}>
          <label>
            <span style={labelStyle}>聚类算法</span>
            <select
              value={algorithm}
              onChange={(evt) => setAlgorithm(evt.target.value as Algorithm)}
              style={{
                width: "100%",
                borderRadius: 12,
                padding: "12px 14px",
                border: "1px solid rgba(148, 163, 184, 0.35)",
                fontSize: 14,
              }}
            >
              <option value="kmeans">K-Means 聚类</option>
              <option value="agglomerative">层次聚类</option>
              <option value="dbscan">DBSCAN 密度聚类</option>
            </select>
          </label>
          {algorithm !== "dbscan" && (
            <label>
              <span style={labelStyle}>聚类簇数（2 - 24）</span>
              <input
                type="range"
                min={2}
                max={24}
                value={clusterCount}
                onChange={(evt) => setClusterCount(Number(evt.target.value))}
                style={{ width: "100%" }}
              />
              <div style={{ marginTop: 6, fontSize: 13, color: "#0f172a", fontWeight: 600 }}>
                当前：{clusterCount} 簇
              </div>
            </label>
          )}
          {algorithm === "dbscan" && (
            <>
              <label>
                <span style={labelStyle}>密度阈值 eps</span>
                <input
                  type="number"
                  min={0.2}
                  max={4}
                  step={0.1}
                  value={dbscanEps}
                  onChange={(evt) => setDbscanEps(Number(evt.target.value))}
                  style={{
                    width: "100%",
                    borderRadius: 12,
                    padding: "12px 14px",
                    border: "1px solid rgba(148, 163, 184, 0.35)",
                    fontSize: 14,
                  }}
                />
              </label>
              <label>
                <span style={labelStyle}>核心点最少邻居数</span>
                <input
                  type="number"
                  min={3}
                  max={30}
                  value={dbscanMinPts}
                  onChange={(evt) => setDbscanMinPts(Number(evt.target.value))}
                  style={{
                    width: "100%",
                    borderRadius: 12,
                    padding: "12px 14px",
                    border: "1px solid rgba(148, 163, 184, 0.35)",
                    fontSize: 14,
                  }}
                />
              </label>
            </>
          )}
        </div>

        <div style={statsGridStyle}>
          <div style={statCardStyle}>
            <span style={{ fontSize: 13, color: "#475569" }}>语义向量数量</span>
            <strong style={{ fontSize: 24, color: "#0f172a" }}>{enrichedNodes.length}</strong>
            <span style={{ fontSize: 12, color: "#64748b" }}>覆盖金融语义实体</span>
          </div>
          <div style={statCardStyle}>
            <span style={{ fontSize: 13, color: "#475569" }}>聚类簇数</span>
            <strong style={{ fontSize: 24, color: "#0f172a" }}>{clusterCountDisplay}</strong>
            <span style={{ fontSize: 12, color: "#64748b" }}>
              {algorithm === "dbscan" ? "自动识别密度簇与噪声" : "基于主成分空间的聚类"}
            </span>
          </div>
          <div style={statCardStyle}>
            <span style={{ fontSize: 13, color: "#475569" }}>平均波动率</span>
            <strong style={{ fontSize: 24, color: "#0f172a" }}>
              {formatNumber(
                enrichedNodes.reduce((acc, node) => acc + node.volatility, 0) /
                  (enrichedNodes.length || 1),
              )}
            </strong>
            <span style={{ fontSize: 12, color: "#64748b" }}>用于调整点大小与高亮程度</span>
          </div>
          {algorithm === "dbscan" && (
            <div style={statCardStyle}>
              <span style={{ fontSize: 13, color: "#475569" }}>噪声点数量</span>
              <strong style={{ fontSize: 24, color: "#0f172a" }}>{clustering.noiseCount ?? 0}</strong>
              <span style={{ fontSize: 12, color: "#64748b" }}>密度不足的孤立节点</span>
            </div>
          )}
        </div>
      </section>

      <section>
        <ReactEChartsCore
          echarts={echarts}
          option={chartOption}
          style={{ height: chartHeight }}
          notMerge
          lazyUpdate
        />
      </section>

      <section style={insightsContainerStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <h2 style={sectionTitleStyle}>聚类洞察</h2>
          <div style={{ color: "#64748b", fontSize: 13 }}>
            按聚类簇体量排序，显示区域集中度、样本节点及风险态势。
          </div>
        </div>
        <div style={toolbarStyle}>
          <span style={{ fontSize: 13, color: "#475569" }}>
            语义分层覆盖：{new Set(enrichedNodes.map((node) => node.sector)).size} 个专题，{" "}
            {new Set(enrichedNodes.map((node) => node.region)).size} 个区域
          </span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={tableHeaderCell}>簇 ID</th>
                <th style={tableHeaderCell}>样本数</th>
                <th style={tableHeaderCell}>平均波动率</th>
                <th style={tableHeaderCell}>向量速度</th>
                <th style={tableHeaderCell}>主要区域</th>
                <th style={tableHeaderCell}>样例向量键</th>
              </tr>
            </thead>
            <tbody>
              {clusterInsights.map((cluster) => (
                <tr key={cluster.id}>
                  <td style={tableCell}>{cluster.label}</td>
                  <td style={tableCell}>{cluster.size}</td>
                  <td style={tableCell}>{cluster.avgVolatility}</td>
                  <td style={tableCell}>{cluster.avgVelocity}</td>
                  <td style={tableCell}>{cluster.topRegions.join("、")}</td>
                  <td style={tableCell}>{cluster.sampleKeys.join("、")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

