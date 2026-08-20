import { useMemo } from "react";
import type { ProgressPoint } from "./homeTypes";

export function useProgressChart(
  progressHistory: ProgressPoint[],
  activeProgressAttemptId: string | null,
) {
  const chronologicalProgress = useMemo(
    () => [...progressHistory].reverse(),
    [progressHistory],
  );

  const progressBounds = useMemo(() => {
    const scores = chronologicalProgress.map(point => Math.max(0, Math.min(800, point.display_bli)));
    if (scores.length === 0) return { lo: 0, hi: 800 };
    const dataLo = Math.min(...scores);
    const dataHi = Math.max(...scores);
    const span = Math.max(dataHi - dataLo, 90);
    const pad = span * 0.28;
    const lo = Math.max(0, Math.floor((dataLo - pad) / 10) * 10);
    const hi = Math.min(800, Math.ceil((dataHi + pad) / 10) * 10);
    return { lo, hi: hi > lo ? hi : lo + 100 };
  }, [chronologicalProgress]);

  const plottedProgress = useMemo(() => {
    const lastIndex = chronologicalProgress.length - 1;
    const { lo, hi } = progressBounds;
    const range = Math.max(hi - lo, 1);
    return chronologicalProgress.map((point, index) => {
      const score = Math.max(0, Math.min(800, point.display_bli));
      return {
        point,
        x: lastIndex <= 0 ? 50 : 3 + (index / lastIndex) * 94,
        y: 92 - ((score - lo) / range) * 84,
      };
    });
  }, [chronologicalProgress, progressBounds]);

  const progressAxisLabels = useMemo(() => {
    const { lo, hi } = progressBounds;
    return [hi, Math.round((hi + lo) / 2), lo];
  }, [progressBounds]);

  const progressXAxisLabels = useMemo(() => {
    const count = plottedProgress.length;
    if (count === 0) return [];
    const times = plottedProgress.map(entry => new Date(entry.point.captured_at).getTime());
    const spanDays = (times[count - 1] - times[0]) / 86400000;
    if (count === 1) {
      return [{
        x: plottedProgress[0].x,
        text: new Date(times[0]).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }),
      }];
    }

    const formatTick = (time: number) => {
      const date = new Date(time);
      if (spanDays < 1) return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
      if (spanDays < 3) return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric" });
      if (spanDays < 400) return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      return date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
    };

    const target = count <= 5 ? count : spanDays < 3 ? 4 : count <= 12 ? 4 : count <= 30 ? 5 : 6;
    const indexes = Array.from(
      new Set(Array.from({ length: target }, (_, index) => Math.round((index * (count - 1)) / Math.max(target - 1, 1)))),
    ).sort((a, b) => a - b);

    const labels: Array<{ x: number; text: string }> = [];
    indexes.forEach((progressIndex, labelIndex) => {
      const text = formatTick(times[progressIndex]);
      if (
        labelIndex > 0
        && labelIndex < indexes.length - 1
        && labels.length > 0
        && labels[labels.length - 1].text === text
      ) {
        return;
      }
      labels.push({ x: plottedProgress[progressIndex].x, text });
    });
    if (labels.length > 1 && labels[labels.length - 1].text === labels[labels.length - 2].text) {
      labels.splice(labels.length - 2, 1);
    }
    return labels;
  }, [plottedProgress]);

  const progressPath = plottedProgress
    .map((entry, index) => `${index === 0 ? "M" : "L"} ${entry.x.toFixed(2)} ${entry.y.toFixed(2)}`)
    .join(" ");
  const progressAreaPath = plottedProgress.length > 0
    ? `${progressPath} L ${plottedProgress[plottedProgress.length - 1].x.toFixed(2)} 100 L ${plottedProgress[0].x.toFixed(2)} 100 Z`
    : "";
  const activeProgressPoint = progressHistory.find(point => point.attempt_id === activeProgressAttemptId)
    ?? progressHistory[0];

  return {
    activeProgressPoint,
    plottedProgress,
    progressAreaPath,
    progressAxisLabels,
    progressPath,
    progressXAxisLabels,
  };
}
