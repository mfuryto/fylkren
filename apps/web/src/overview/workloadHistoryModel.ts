export type WorkloadHistoryPoint = {
  at: string;
  total: number;
  series: Array<{ key: string; name: string; kind: "unit" | "site"; count: number }>;
};

export function buildWorkloadHistoryLines(points: WorkloadHistoryPoint[]) {
  const series = Array.from(new Map(points.flatMap(point => point.series).map(value => [value.key, value])).values());
  const lines = [
    { key: "total", name: "Hele siten", kind: "total", values: points.map(point => point.total) },
    ...series.map(value => ({
      ...value,
      values: points.map(point => point.series.find(candidate => candidate.key === value.key)?.count ?? 0),
    })),
  ];
  return { lines, maximum: Math.max(1, ...lines.flatMap(line => line.values)) };
}
