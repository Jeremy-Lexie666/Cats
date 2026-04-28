import { api } from "../../services/api";
import type { WeightRecord } from "../../types/domain";

type RangeKey = "7" | "30" | "90" | "all";

type ChartPoint = {
  id: string;
  left: string;
  bottom: string;
  valueText: string;
};

type ChartSegment = {
  id: string;
  left: string;
  bottom: string;
  width: string;
  angle: string;
};

type ChartDateTick = {
  id: string;
  left: string;
  dateText: string;
};

type HistoryItem = {
  id: string;
  weightText: string;
  deltaText: string;
  deltaClass: string;
  dateText: string;
};

const DEFAULT_PLOT_WIDTH = 300;
const PLOT_HEIGHT = 214;

function getRecordDaysDiff(recordedAt: string, now = new Date()): number {
  const date = new Date(recordedAt);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  return Math.floor((start - target) / 86400000);
}

function filterWeights(records: WeightRecord[], range: RangeKey): WeightRecord[] {
  if (range === "all") return records;
  const maxDays = Number(range);
  return records.filter((item) => getRecordDaysDiff(item.recordedAt) <= maxDays);
}

function formatWeight(weight: number): string {
  return Number.isInteger(weight) ? `${weight}` : weight.toFixed(1);
}

function getChartBounds(weights: WeightRecord[]): { min: number; max: number } {
  const values = weights.map((item) => item.weightKg);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = Math.max((max - min) * 0.25, 0.2);
  return {
    min: Math.max(0, Number((min - padding).toFixed(1))),
    max: Number((max + padding).toFixed(1))
  };
}

function buildYAxis(weights: WeightRecord[]): string[] {
  if (!weights.length) return ["0.0", "0.0", "0.0"];
  const bounds = getChartBounds(weights);
  const middle = Number((((bounds.max + bounds.min) / 2) || 0).toFixed(1));
  return [bounds.max, middle, bounds.min].map((item) => formatWeight(item));
}

function buildChartData(
  weights: WeightRecord[],
  plotWidth: number
): {
  points: ChartPoint[];
  segments: ChartSegment[];
  dates: ChartDateTick[];
} {
  const sorted = [...weights].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  if (!sorted.length) {
    return { points: [], segments: [], dates: [] };
  }

  const bounds = getChartBounds(sorted);
  const span = Math.max(bounds.max - bounds.min, 0.1);
  const usableHeight = PLOT_HEIGHT - 16;
  const positions = sorted.map((item, index) => {
    const x = sorted.length === 1 ? plotWidth / 2 : (plotWidth / (sorted.length - 1)) * index;
    const y = 8 + ((item.weightKg - bounds.min) / span) * usableHeight;
    return {
      id: item.id,
      x,
      y,
      valueText: formatWeight(item.weightKg),
      dateText: item.recordedAt.slice(5)
    };
  });

  const points: ChartPoint[] = positions.map((item) => ({
    id: item.id,
    left: `${item.x}px`,
    bottom: `${item.y}px`,
    valueText: item.valueText
  }));

  const dates: ChartDateTick[] = positions.map((item) => ({
    id: item.id,
    left: `${item.x}px`,
    dateText: item.dateText
  }));

  const segments: ChartSegment[] = [];
  for (let index = 0; index < positions.length - 1; index += 1) {
    const current = positions[index];
    const next = positions[index + 1];
    const dx = next.x - current.x;
    const dy = next.y - current.y;
    segments.push({
      id: `${current.id}_${next.id}`,
      left: `${current.x}px`,
      bottom: `${current.y}px`,
      width: `${Math.sqrt(dx * dx + dy * dy)}px`,
      angle: `${(Math.atan2(dy, dx) * 180) / Math.PI}deg`
    });
  }

  return { points, segments, dates };
}

function buildHistory(records: WeightRecord[]): HistoryItem[] {
  const sorted = [...records].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
  return sorted.map((item, index) => {
    const previous = sorted[index + 1];
    const delta = previous ? Number((item.weightKg - previous.weightKg).toFixed(1)) : 0;
    return {
      id: item.id,
      weightText: `${formatWeight(item.weightKg)} kg`,
      deltaText: previous ? `${delta >= 0 ? "↑" : "↓"} ${Math.abs(delta).toFixed(1)} kg` : "",
      deltaClass: delta > 0 ? "up" : delta < 0 ? "down" : "",
      dateText: item.recordedAt
    };
  });
}

Page({
  data: {
    petId: "",
    selectedRange: "30" as RangeKey,
    currentWeight: "--",
    compareValue: "--",
    compareDeltaClass: "",
    historyCountText: "0条",
    yAxisLabels: ["0.0", "0.0", "0.0"],
    rangeTabs: [
      { key: "7", label: "7天" },
      { key: "30", label: "30天" },
      { key: "90", label: "90天" },
      { key: "all", label: "全部" }
    ],
    chartPoints: [] as ChartPoint[],
    chartSegments: [] as ChartSegment[],
    chartDates: [] as ChartDateTick[],
    historyItems: [] as HistoryItem[]
  },
  async onShow() {
    await this.refresh();
  },
  onLoad(options: Record<string, string>) {
    this.setData({
      petId: options.petId || ""
    });
  },
  async refresh() {
    const records = await api.listRecords({ petId: this.data.petId, type: "weight" });
    const weights = records.filter((item): item is WeightRecord => item.type === "weight");
    const filtered = filterWeights(weights, this.data.selectedRange);
    const chartSource = filtered.length ? filtered : weights;
    const sortedDesc = [...weights].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
    const latest = sortedDesc[0];
    const previous = sortedDesc[1];
    const delta = latest && previous ? Number((latest.weightKg - previous.weightKg).toFixed(1)) : 0;
    const deltaPercent =
      latest && previous && previous.weightKg > 0 ? ((Math.abs(delta) / previous.weightKg) * 100).toFixed(1) : "0.0";
    const plotWidth = await this.measurePlotWidth();
    const { points, segments, dates } = buildChartData(chartSource, plotWidth);

    this.setData({
      currentWeight: latest ? formatWeight(latest.weightKg) : "--",
      compareValue: latest && previous ? `${delta >= 0 ? "+" : "-"}${Math.abs(delta).toFixed(1)} kg (${deltaPercent}%)` : "--",
      compareDeltaClass: delta > 0 ? "up" : delta < 0 ? "down" : "",
      yAxisLabels: buildYAxis(chartSource),
      chartPoints: points,
      chartSegments: segments,
      chartDates: dates,
      historyItems: buildHistory(weights),
      historyCountText: `${weights.length}条`
    });
  },
  measurePlotWidth(): Promise<number> {
    return new Promise((resolve) => {
      const query = this.createSelectorQuery();
      query
        .select(".chart-plot")
        .boundingClientRect((rect) => {
          resolve(rect?.width || DEFAULT_PLOT_WIDTH);
        })
        .exec();
    });
  },
  switchRange(event: WechatMiniprogram.TouchEvent) {
    this.setData({ selectedRange: event.currentTarget.dataset.range as RangeKey });
    this.refresh();
  },
  addWeightRecord() {
    wx.navigateTo({ url: `/pages/records/edit/index?petId=${this.data.petId}&mode=weightOnly&type=weight` });
  },
  editWeight(event: WechatMiniprogram.TouchEvent) {
    const recordId = String(event.currentTarget.dataset.id || "");
    if (!recordId) return;
    wx.navigateTo({
      url: `/pages/records/edit/index?petId=${this.data.petId}&mode=weightOnly&type=weight&recordId=${recordId}`
    });
  },
  deleteWeight(event: WechatMiniprogram.TouchEvent) {
    const recordId = String(event.currentTarget.dataset.id || "");
    if (!recordId) return;

    wx.showModal({
      title: "删除记录",
      content: "确认删除这条体重记录吗？",
      confirmColor: "#d47c86",
      success: async (result) => {
        if (!result.confirm) return;
        await api.deleteRecord(recordId);
        wx.showToast({ title: "已删除", icon: "success" });
        await this.refresh();
      }
    });
  }
});
