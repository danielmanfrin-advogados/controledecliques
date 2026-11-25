import React, { useState } from 'react';
import {
  HourlyBucket,
  PeriodPreset,
  TimelineBucket,
} from '../types/sheets';

interface HourlyAndTimelineSectionProps {
  hourlyBuckets: HourlyBucket[];
  timelineBuckets: TimelineBucket[];
  period: PeriodPreset;
  periodLabel: string;
  selectedHour: number | null;
  onToggleHour: (hour: number) => void;
}

export const HourlyAndTimelineSection: React.FC<
  HourlyAndTimelineSectionProps
> = ({
  hourlyBuckets,
  timelineBuckets,
  period,
  periodLabel,
  selectedHour,
  onToggleHour,
}) => {
  const [hoveredHour, setHoveredHour] = useState<number | null>(null);
  const [hoveredTimelineIdx, setHoveredTimelineIdx] = useState<number | null>(
    null
  );

  const maxHourly = Math.max(1, ...hourlyBuckets.map((b) => b.clicks));
  const totalHourlyClicks = hourlyBuckets.reduce((acc, b) => acc + b.clicks, 0);

  const maxTimeline = Math.max(1, ...timelineBuckets.map((b) => b.clicks));
  const totalTimelineClicks = timelineBuckets.reduce(
    (acc, b) => acc + b.clicks,
    0
  );

  const timelineTitle =
    period === 'day'
      ? 'Ritmo no Dia'
      : period === 'week'
      ? 'Cliques na Semana'
      : period === 'month'
      ? 'Cliques no Mês'
      : period === 'year'
      ? 'Cliques no Ano'
      : 'Evolução Mensal';

  const useAreaChart = timelineBuckets.length > 14;
  const svgW = 600;
  const svgH = 180;
  const padX = 12;
  const padT = 14;
  const padB = 10;
  const plotW = svgW - padX * 2;
  const plotH = svgH - padT - padB;

  const areaPoints = timelineBuckets.map((b, i) => {
    const x =
      timelineBuckets.length <= 1
        ? padX + plotW / 2
        : padX + (i / (timelineBuckets.length - 1)) * plotW;
    const y = padT + plotH - (b.clicks / maxTimeline) * plotH;
    return { ...b, x, y };
  });

  const linePath = areaPoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');
  const areaPath =
    areaPoints.length > 1
      ? `${linePath} L ${areaPoints[areaPoints.length - 1].x.toFixed(1)} ${(
          padT + plotH
        ).toFixed(1)} L ${areaPoints[0].x.toFixed(1)} ${(padT + plotH).toFixed(
          1
        )} Z`
      : '';

  return (
    <section
      id="horarios"
      aria-label="Horários e evolução"
      className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch"
    >
      {/* 24h Hourly Distribution - Warm Coral & Amber */}
      <div className="xl:col-span-6 clay-card rounded-[28px] p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-3 mb-5">
            <div>
              <h2 className="text-base font-bold text-[#2C221E]">
                Horários de Movimento
              </h2>
              <p className="text-xs text-[#6E5F54] mt-0.5">
                Clique em uma barra para filtrar o horário
              </p>
            </div>
            <div className="text-right text-xs font-mono tabular-nums shrink-0">
              {hoveredHour !== null ? (
                <span className="font-bold text-[#B54B27]">
                  {String(hoveredHour).padStart(2, '0')}h ·{' '}
                  {hourlyBuckets[hoveredHour]?.clicks.toLocaleString('pt-BR')}{' '}
                  cliques
                </span>
              ) : selectedHour !== null ? (
                <button
                  type="button"
                  onClick={() => onToggleHour(selectedHour)}
                  className="font-bold text-[#E36A42] hover:underline cursor-pointer"
                >
                  {String(selectedHour).padStart(2, '0')}h (limpar)
                </button>
              ) : null}
            </div>
          </div>

          {totalHourlyClicks === 0 ? (
            <div className="h-44 flex items-center justify-center text-xs text-[#6E5F54]">
              Sem horários registrados neste recorte.
            </div>
          ) : (
            <div>
              <div className="h-44 flex items-end gap-1.5 border-b border-[#EADFD1] pb-0.5">
                {hourlyBuckets.map((bucket) => {
                  const heightPct =
                    bucket.clicks > 0
                      ? Math.max(8, Math.round((bucket.clicks / maxHourly) * 100))
                      : 3;
                  const isPeak = bucket.clicks > 0 && bucket.clicks === maxHourly;
                  const isSelected = selectedHour === bucket.hour;
                  const isDimmed =
                    selectedHour !== null && selectedHour !== bucket.hour;

                  return (
                    <button
                      key={bucket.hour}
                      type="button"
                      onClick={() => onToggleHour(bucket.hour)}
                      onMouseEnter={() => setHoveredHour(bucket.hour)}
                      onMouseLeave={() => setHoveredHour(null)}
                      title={`${bucket.label}: ${bucket.clicks.toLocaleString(
                        'pt-BR'
                      )} cliques`}
                      className={`flex-1 h-full flex flex-col justify-end items-center group cursor-pointer transition-opacity ${
                        isDimmed ? 'opacity-30 hover:opacity-80' : 'opacity-100'
                      }`}
                    >
                      <div
                        className={`w-full rounded-t-lg transition-colors duration-150 ${
                          bucket.clicks === 0
                            ? 'bg-[#EDE4D8]'
                            : isSelected || isPeak
                            ? 'bg-[#E36A42]'
                            : 'bg-[#DE9533]/80 group-hover:bg-[#E36A42]'
                        }`}
                        style={{ height: `${heightPct}%` }}
                      />
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center justify-between mt-2.5 text-[11px] font-mono text-[#8C7A6B] tabular-nums">
                <span>00h</span>
                <span>06h</span>
                <span>12h</span>
                <span>18h</span>
                <span>23h</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Period Timeline - Sage Teal */}
      <div className="xl:col-span-6 clay-card rounded-[28px] p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-3 mb-5">
            <div>
              <h2 className="text-base font-bold text-[#2C221E]">
                {timelineTitle}
              </h2>
              <p className="text-xs text-[#6E5F54] mt-0.5">{periodLabel}</p>
            </div>
            {hoveredTimelineIdx !== null &&
              timelineBuckets[hoveredTimelineIdx] && (
                <span className="text-xs font-mono font-bold tabular-nums text-[#366B62] shrink-0">
                  {timelineBuckets[hoveredTimelineIdx].label} ·{' '}
                  {timelineBuckets[hoveredTimelineIdx].clicks.toLocaleString(
                    'pt-BR'
                  )}{' '}
                  cliques
                </span>
              )}
          </div>

          {timelineBuckets.length === 0 || totalTimelineClicks === 0 ? (
            <div className="h-44 flex items-center justify-center text-xs text-[#6E5F54]">
              Sem datas registradas neste período.
            </div>
          ) : useAreaChart ? (
            <div>
              <svg
                viewBox={`0 0 ${svgW} ${svgH}`}
                className="w-full h-44 overflow-visible border-b border-[#EADFD1]"
                role="img"
                aria-label={timelineTitle}
              >
                <defs>
                  <linearGradient
                    id="clayTealGrad"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="#4C8F84" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#4C8F84" stopOpacity="0.02" />
                  </linearGradient>
                </defs>

                {areaPath && (
                  <path d={areaPath} fill="url(#clayTealGrad)" />
                )}
                <path
                  d={linePath}
                  fill="none"
                  stroke="#4C8F84"
                  strokeWidth="3"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />

                {areaPoints.map((pt, idx) => {
                  const isHovered = hoveredTimelineIdx === idx;
                  return (
                    <g
                      key={pt.key}
                      onMouseEnter={() => setHoveredTimelineIdx(idx)}
                      onMouseLeave={() => setHoveredTimelineIdx(null)}
                      className="cursor-pointer"
                    >
                      <rect
                        x={pt.x - 10}
                        y={0}
                        width={20}
                        height={svgH}
                        fill="transparent"
                      />
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={isHovered ? 5.5 : pt.clicks > 0 ? 3.2 : 0}
                        fill="#4C8F84"
                        stroke="#FCF7EE"
                        strokeWidth="1.5"
                      />
                    </g>
                  );
                })}
              </svg>

              <div className="flex items-center justify-between mt-2.5 text-[11px] font-mono text-[#8C7A6B] tabular-nums">
                <span>{timelineBuckets[0]?.label}</span>
                <span>
                  {
                    timelineBuckets[Math.floor(timelineBuckets.length / 2)]
                      ?.label
                  }
                </span>
                <span>
                  {timelineBuckets[timelineBuckets.length - 1]?.label}
                </span>
              </div>
            </div>
          ) : (
            <div>
              <div className="h-44 flex items-end gap-2.5 border-b border-[#EADFD1] pb-0.5">
                {timelineBuckets.map((bucket, idx) => {
                  const heightPct =
                    bucket.clicks > 0
                      ? Math.max(
                          8,
                          Math.round((bucket.clicks / maxTimeline) * 100)
                        )
                      : 3;

                  return (
                    <div
                      key={bucket.key}
                      onMouseEnter={() => setHoveredTimelineIdx(idx)}
                      onMouseLeave={() => setHoveredTimelineIdx(null)}
                      title={`${bucket.label}: ${bucket.clicks.toLocaleString(
                        'pt-BR'
                      )} cliques`}
                      className="flex-1 h-full flex flex-col justify-end items-center group"
                    >
                      <div
                        className={`w-full rounded-t-lg transition-colors duration-150 ${
                          bucket.clicks === 0
                            ? 'bg-[#EDE4D8]'
                            : 'bg-[#4C8F84]/85 group-hover:bg-[#3A756B]'
                        }`}
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between mt-2.5 text-[11px] font-mono text-[#8C7A6B] tabular-nums overflow-hidden">
                {timelineBuckets.map((b) => (
                  <span key={b.key} className="truncate text-center flex-1">
                    {b.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
