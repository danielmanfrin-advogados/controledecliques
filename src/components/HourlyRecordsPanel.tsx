import React, { useMemo, useState } from 'react';
import { ChevronRight, Clock, UserCheck, X } from 'lucide-react';
import { ClickEventRecord } from '../types/sheets';
import { getSiteColorTheme } from '../utils/siteColors';

interface HourlyRecordsPanelProps {
  events: ClickEventRecord[];
  siteColorIndexMap: Map<string, number>;
  selectedHour: number | null;
  onToggleHour: (hour: number) => void;
  periodLabel: string;
  hasVisitorTypeCol?: boolean;
  onOpenRealPeople?: () => void;
}

interface HourDetailRow {
  hour: number;
  rangeLabel: string;
  clicks: number;
  humanClicks: number;
  botClicks: number;
  recordCount: number;
  sharePct: number;
  topSite: string | null;
  topPage: string | null;
}

export const HourlyRecordsPanel: React.FC<HourlyRecordsPanelProps> = ({
  events,
  siteColorIndexMap,
  selectedHour,
  onToggleHour,
  periodLabel,
  hasVisitorTypeCol = false,
  onOpenRealPeople,
}) => {
  const [onlyWithClicks, setOnlyWithClicks] = useState(false);

  const {
    rows,
    maxClicks,
    totalClicks,
    totalHumanClicks,
    totalBotClicks,
    unscheduledCount,
    hasVisitorType,
  } = useMemo(() => {
    const byHour = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      clicks: 0,
      humanClicks: 0,
      botClicks: 0,
      recordCount: 0,
      siteMap: new Map<string, number>(),
      pageMap: new Map<string, number>(),
    }));

    let unscheduled = 0;
    let visitorFound = hasVisitorTypeCol;

    for (const ev of events) {
      if (ev.visitorType !== 'unknown' || ev.visitorTypeLabel) {
        visitorFound = true;
      }
      if (ev.hourOfDay === null || ev.hourOfDay < 0 || ev.hourOfDay > 23) {
        unscheduled += ev.clicks;
        continue;
      }
      const bucket = byHour[ev.hourOfDay];
      bucket.clicks += ev.clicks;
      if (ev.visitorType === 'human') bucket.humanClicks += ev.clicks;
      else if (ev.visitorType === 'bot') bucket.botClicks += ev.clicks;
      bucket.recordCount += 1;
      bucket.siteMap.set(ev.site, (bucket.siteMap.get(ev.site) ?? 0) + ev.clicks);
      bucket.pageMap.set(ev.page, (bucket.pageMap.get(ev.page) ?? 0) + ev.clicks);
    }

    const total = byHour.reduce((acc, b) => acc + b.clicks, 0);
    const totalHuman = byHour.reduce((acc, b) => acc + b.humanClicks, 0);
    const totalBot = byHour.reduce((acc, b) => acc + b.botClicks, 0);
    const max = Math.max(1, ...byHour.map((b) => b.clicks));

    const built: HourDetailRow[] = byHour.map((b) => {
      let topSite: string | null = null;
      let topSiteVal = 0;
      for (const [site, count] of b.siteMap.entries()) {
        if (count > topSiteVal) {
          topSiteVal = count;
          topSite = site;
        }
      }

      let topPage: string | null = null;
      let topPageVal = 0;
      for (const [page, count] of b.pageMap.entries()) {
        if (count > topPageVal) {
          topPageVal = count;
          topPage = page;
        }
      }

      const hh = String(b.hour).padStart(2, '0');
      return {
        hour: b.hour,
        rangeLabel: `${hh}:00 – ${hh}:59`,
        clicks: b.clicks,
        humanClicks: b.humanClicks,
        botClicks: b.botClicks,
        recordCount: b.recordCount,
        sharePct: total > 0 ? Math.round((b.clicks / total) * 1000) / 10 : 0,
        topSite,
        topPage,
      };
    });

    return {
      rows: built,
      maxClicks: max,
      totalClicks: total,
      totalHumanClicks: totalHuman,
      totalBotClicks: totalBot,
      unscheduledCount: unscheduled,
      hasVisitorType: visitorFound,
    };
  }, [events, hasVisitorTypeCol]);

  const visibleRows = useMemo(() => {
    if (!onlyWithClicks) return rows;
    return rows.filter((r) => r.clicks > 0);
  }, [rows, onlyWithClicks]);

  const humanPct =
    totalClicks > 0 ? Math.round((totalHumanClicks / totalClicks) * 100) : 0;

  return (
    <section
      aria-label="Registro de todos os horários"
      className="clay-card rounded-[28px] overflow-hidden"
    >
      <div className="px-6 py-5 border-b border-[#EADFD1] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-base font-bold text-[#2C221E]">
              Registro de Todos os Horários (00h às 23h)
            </h2>
            {hasVisitorType && (
              <button
                type="button"
                onClick={onOpenRealPeople}
                disabled={!onOpenRealPeople}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#D9ECE4] text-[11px] font-bold text-[#1E664B] tabular-nums ${
                  onOpenRealPeople
                    ? 'cursor-pointer hover:bg-[#CBE4DA] transition-colors'
                    : ''
                }`}
              >
                <UserCheck className="w-3.5 h-3.5 text-[#2F8F6B]" />
                <span>
                  {totalHumanClicks.toLocaleString('pt-BR')} pessoas reais ({humanPct}%)
                  {totalBotClicks > 0
                    ? ` · ${totalBotClicks.toLocaleString('pt-BR')} ${
                        totalBotClicks === 1 ? 'robô' : 'robôs'
                      }`
                    : ''}
                </span>
                {onOpenRealPeople && <ChevronRight className="w-3 h-3" />}
              </button>
            )}
            {selectedHour !== null && (
              <button
                type="button"
                onClick={() => onToggleHour(selectedHour)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#FDE4DC] text-[11px] font-bold text-[#B54B27] hover:bg-[#F9D5BE] cursor-pointer"
              >
                <span>
                  Filtro: {String(selectedHour).padStart(2, '0')}:00
                </span>
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <p className="text-xs text-[#6E5F54] mt-0.5 tabular-nums">
            {periodLabel} · {totalClicks.toLocaleString('pt-BR')} cliques com horário registrado
            {unscheduledCount > 0
              ? ` · ${unscheduledCount.toLocaleString('pt-BR')} sem horário`
              : ''}{' '}
            · Clique em um horário para filtrar os registros abaixo
          </p>
        </div>

        <div className="inline-flex items-center rounded-2xl bg-[#EFE6D8] p-1 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setOnlyWithClicks(false)}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              !onlyWithClicks
                ? 'clay-button-active text-[#2C221E]'
                : 'text-[#6E5F54] hover:text-[#2C221E]'
            }`}
          >
            Todos (24h)
          </button>
          <button
            type="button"
            onClick={() => setOnlyWithClicks(true)}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              onlyWithClicks
                ? 'clay-button-active text-[#2C221E]'
                : 'text-[#6E5F54] hover:text-[#2C221E]'
            }`}
          >
            Com cliques
          </button>
        </div>
      </div>

      {visibleRows.length === 0 ? (
        <div className="py-10 px-6 text-center text-xs text-[#6E5F54]">
          Nenhum horário com cliques neste período.
        </div>
      ) : (
        <div className="overflow-x-auto clay-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#EADFD1] bg-[#FAF4EA] text-xs font-bold text-[#5E4E42]">
                <th className="py-3 px-5 whitespace-nowrap">Faixa de Horário</th>
                <th className="py-3 px-5 text-right whitespace-nowrap">Cliques</th>
                {hasVisitorType && (
                  <th className="py-3 px-5 text-right whitespace-nowrap text-[#1E664B]">
                    Pessoas Reais
                  </th>
                )}
                <th className="py-3 px-5 whitespace-nowrap min-w-[140px]">Volume</th>
                <th className="py-3 px-5 text-right whitespace-nowrap">Participação</th>
                <th className="py-3 px-5 text-right whitespace-nowrap">Registros</th>
                <th className="py-3 px-5 whitespace-nowrap">Site Mais Clicado</th>
                <th className="py-3 px-5 whitespace-nowrap">Página Mais Clicada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFE5D8] text-xs">
              {visibleRows.map((row) => {
                const isSelected = selectedHour === row.hour;
                const isPeak = row.clicks > 0 && row.clicks === maxClicks;
                const barWidth =
                  row.clicks > 0
                    ? Math.max(4, Math.round((row.clicks / maxClicks) * 100))
                    : 0;
                const colorIdx = row.topSite
                  ? siteColorIndexMap.get(row.topSite) ?? 0
                  : 0;
                const theme = getSiteColorTheme(colorIdx);

                return (
                  <tr
                    key={row.hour}
                    onClick={() => onToggleHour(row.hour)}
                    className={`transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#F9E3D3]'
                        : row.clicks === 0
                        ? 'opacity-55 hover:bg-[#F7EFE4]'
                        : 'hover:bg-[#F7EFE4]'
                    }`}
                  >
                    <td className="py-3 px-5 font-mono font-bold text-[#2C221E] whitespace-nowrap">
                      <span className="inline-flex items-center gap-2">
                        <Clock
                          className={`w-3.5 h-3.5 ${
                            isSelected || isPeak
                              ? 'text-[#E36A42]'
                              : 'text-[#8C7A6B]'
                          }`}
                        />
                        <span>{row.rangeLabel}</span>
                      </span>
                    </td>
                    <td className="py-3 px-5 text-right font-mono tabular-nums font-extrabold text-[#2C221E] whitespace-nowrap">
                      {row.clicks.toLocaleString('pt-BR')}
                    </td>
                    {hasVisitorType && (
                      <td className="py-3 px-5 text-right font-mono tabular-nums whitespace-nowrap">
                        <span className="font-extrabold text-[#1E664B]">
                          {row.humanClicks.toLocaleString('pt-BR')}
                        </span>
                        {row.botClicks > 0 && (
                          <span className="text-[11px] text-[#8F2D22] ml-1">
                            ({row.botClicks.toLocaleString('pt-BR')} rob.)
                          </span>
                        )}
                      </td>
                    )}
                    <td className="py-3 px-5">
                      <div className="w-full h-2.5 rounded-full bg-[#EDE4D8] overflow-hidden">
                        {barWidth > 0 && (
                          <div
                            className={`h-full rounded-full transition-all ${
                              isSelected || isPeak
                                ? 'bg-[#E36A42]'
                                : 'bg-[#DE9533]'
                            }`}
                            style={{ width: `${barWidth}%` }}
                          />
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-5 text-right font-mono tabular-nums text-[#5E4E42] whitespace-nowrap">
                      {row.sharePct.toLocaleString('pt-BR', {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                      })}
                      %
                    </td>
                    <td className="py-3 px-5 text-right font-mono tabular-nums text-[#5E4E42] whitespace-nowrap">
                      {row.recordCount.toLocaleString('pt-BR')}
                    </td>
                    <td
                      className={`py-3 px-5 font-bold max-w-[200px] truncate ${
                        row.topSite ? theme.textClass : 'text-[#9A897A]'
                      }`}
                      title={row.topSite ?? ''}
                    >
                      {row.topSite ?? '—'}
                    </td>
                    <td
                      className="py-3 px-5 font-mono text-[#4A3B31] max-w-[260px] truncate"
                      title={row.topPage ?? ''}
                    >
                      {row.topPage ?? '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
