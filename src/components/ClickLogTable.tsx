import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Bot,
  ChevronLeft,
  ChevronRight,
  Download,
  UserCheck,
} from 'lucide-react';
import { ClickEventRecord, ParsedRow } from '../types/sheets';
import { exportClickEventsCsv } from '../utils/dataAnalyzer';
import { getSiteColorTheme } from '../utils/siteColors';

interface ClickLogTableProps {
  spreadsheetTitle: string;
  sheetTitle: string;
  events: ClickEventRecord[];
  siteColorIndexMap: Map<string, number>;
  onInspectRow: (row: ParsedRow) => void;
  hasVisitorTypeCol?: boolean;
  onOpenMapping?: () => void;
}

type SortField =
  | 'date'
  | 'time'
  | 'name'
  | 'city'
  | 'device'
  | 'visitorType'
  | 'site'
  | 'page'
  | 'clicks';
type SortDir = 'asc' | 'desc';
type TrafficFilter = 'all' | 'human' | 'bot';

export const ClickLogTable: React.FC<ClickLogTableProps> = ({
  spreadsheetTitle,
  sheetTitle,
  events,
  siteColorIndexMap,
  onInspectRow,
  hasVisitorTypeCol = false,
  onOpenMapping,
}) => {
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [trafficFilter, setTrafficFilter] = useState<TrafficFilter>('all');
  const [page, setPage] = useState(1);
  const [tableScrollWidth, setTableScrollWidth] = useState(0);
  const [hasHorizontalOverflow, setHasHorizontalOverflow] = useState(false);

  const topScrollRef = useRef<HTMLDivElement | null>(null);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const tableRef = useRef<HTMLTableElement | null>(null);
  const syncingSourceRef = useRef<'top' | 'table' | null>(null);

  const pageSize = 20;

  useEffect(() => {
    setPage(1);
  }, [events.length, trafficFilter]);

  const {
    hasName,
    hasCity,
    hasDevice,
    hasVisitorType,
    totalClicks,
    humanClicks,
    botClicks,
    humanRowsCount,
    botRowsCount,
  } = useMemo(() => {
    let nameFound = false;
    let cityFound = false;
    let deviceFound = false;
    let visitorTypeFound = hasVisitorTypeCol;
    let total = 0;
    let human = 0;
    let bot = 0;
    let humanRows = 0;
    let botRows = 0;

    for (const ev of events) {
      if (ev.userName || ev.userId) nameFound = true;
      if (ev.city) cityFound = true;
      if (ev.device) deviceFound = true;
      if (ev.visitorType !== 'unknown' || ev.visitorTypeLabel) {
        visitorTypeFound = true;
      }
      total += ev.clicks;
      if (ev.visitorType === 'human') {
        human += ev.clicks;
        humanRows += 1;
      } else if (ev.visitorType === 'bot') {
        bot += ev.clicks;
        botRows += 1;
      }
    }
    return {
      hasName: nameFound,
      hasCity: cityFound,
      hasDevice: deviceFound,
      hasVisitorType: visitorTypeFound,
      totalClicks: total,
      humanClicks: human,
      botClicks: bot,
      humanRowsCount: humanRows,
      botRowsCount: botRows,
    };
  }, [events, hasVisitorTypeCol]);

  const humanSharePct =
    totalClicks > 0 ? Math.round((humanClicks / totalClicks) * 100) : 0;

  const filteredEvents = useMemo(() => {
    if (trafficFilter === 'human') {
      return events.filter((ev) => ev.visitorType === 'human');
    }
    if (trafficFilter === 'bot') {
      return events.filter((ev) => ev.visitorType === 'bot');
    }
    return events;
  }, [events, trafficFilter]);

  const sortedEvents = useMemo(() => {
    const copy = [...filteredEvents];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'date') {
        const tsA = a.timestamp ?? a.rowIndex;
        const tsB = b.timestamp ?? b.rowIndex;
        cmp = tsA - tsB;
      } else if (sortField === 'time') {
        cmp = a.timeFormatted.localeCompare(b.timeFormatted);
      } else if (sortField === 'name') {
        cmp = (a.userName ?? a.userId ?? '').localeCompare(
          b.userName ?? b.userId ?? '',
          'pt-BR',
          { sensitivity: 'base' }
        );
      } else if (sortField === 'city') {
        cmp = (a.city ?? '').localeCompare(b.city ?? '', 'pt-BR', {
          sensitivity: 'base',
        });
      } else if (sortField === 'device') {
        cmp = (a.device ?? '').localeCompare(b.device ?? '', 'pt-BR', {
          sensitivity: 'base',
        });
      } else if (sortField === 'visitorType') {
        const labelA =
          a.visitorType === 'human'
            ? 'Pessoa real'
            : a.visitorType === 'bot'
            ? 'Robô'
            : a.visitorTypeLabel ?? '';
        const labelB =
          b.visitorType === 'human'
            ? 'Pessoa real'
            : b.visitorType === 'bot'
            ? 'Robô'
            : b.visitorTypeLabel ?? '';
        cmp = labelA.localeCompare(labelB, 'pt-BR', { sensitivity: 'base' });
      } else if (sortField === 'site') {
        cmp = a.site.localeCompare(b.site, 'pt-BR', { sensitivity: 'base' });
      } else if (sortField === 'page') {
        cmp = a.page.localeCompare(b.page, 'pt-BR', { sensitivity: 'base' });
      } else {
        cmp = a.clicks - b.clicks;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [filteredEvents, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedEvents.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const pagedEvents = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return sortedEvents.slice(start, start + pageSize);
  }, [sortedEvents, safePage]);

  const measureOverflow = useCallback(() => {
    const container = tableScrollRef.current;
    const table = tableRef.current;
    if (!container || !table) return;
    const scrollW = table.scrollWidth;
    const clientW = container.clientWidth;
    setTableScrollWidth(scrollW);
    setHasHorizontalOverflow(scrollW > clientW + 2);
  }, []);

  useEffect(() => {
    measureOverflow();
    const container = tableScrollRef.current;
    const table = tableRef.current;
    if (!container || !table || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => {
      measureOverflow();
    });
    observer.observe(container);
    observer.observe(table);
    return () => observer.disconnect();
  }, [measureOverflow, pagedEvents, hasName, hasCity, hasDevice, hasVisitorType]);

  const handleTopScroll = () => {
    if (syncingSourceRef.current === 'table') {
      syncingSourceRef.current = null;
      return;
    }
    const topEl = topScrollRef.current;
    const tableEl = tableScrollRef.current;
    if (!topEl || !tableEl) return;
    syncingSourceRef.current = 'top';
    tableEl.scrollLeft = topEl.scrollLeft;
    requestAnimationFrame(() => {
      if (syncingSourceRef.current === 'top') {
        syncingSourceRef.current = null;
      }
    });
  };

  const handleTableScroll = () => {
    if (syncingSourceRef.current === 'top') {
      syncingSourceRef.current = null;
      return;
    }
    const topEl = topScrollRef.current;
    const tableEl = tableScrollRef.current;
    if (!topEl || !tableEl) return;
    syncingSourceRef.current = 'table';
    topEl.scrollLeft = tableEl.scrollLeft;
    requestAnimationFrame(() => {
      if (syncingSourceRef.current === 'table') {
        syncingSourceRef.current = null;
      }
    });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'clicks' || field === 'date' ? 'desc' : 'asc');
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-[#B6A593]" />;
    }
    return sortDir === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-[#E36A42]" />
    ) : (
      <ArrowDown className="w-3 h-3 text-[#E36A42]" />
    );
  };

  const handleExport = () => {
    const safeName = `${spreadsheetTitle}_${sheetTitle}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, '_')
      .replace(/^_|_$/g, '');
    exportClickEventsCsv(sortedEvents, `${safeName}_cliques.csv`);
  };

  return (
    <section
      id="registros"
      aria-label="Histórico de cliques"
      className="clay-card rounded-[28px] overflow-hidden"
    >
      <div className="px-6 py-5 border-b border-[#EADFD1] flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[#2C221E]">
              Histórico Detalhado de Cliques
            </h2>
            <p className="text-xs text-[#6E5F54] mt-0.5 tabular-nums">
              {sortedEvents.length.toLocaleString('pt-BR')} registros neste
              período · Clique na linha para ver tudo
            </p>
          </div>

          <button
            type="button"
            onClick={handleExport}
            disabled={sortedEvents.length === 0}
            className="px-4 py-2 text-xs font-bold rounded-2xl clay-button-active text-[#2C221E] hover:text-[#E36A42] disabled:opacity-45 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap self-start sm:self-auto transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar CSV</span>
          </button>
        </div>

        {/* Summary & Quick Filter for Real Person vs Bot */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 pt-1">
          {hasVisitorType ? (
            <>
              <div className="clay-mint rounded-2xl px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                <span className="inline-flex items-center gap-1.5 font-extrabold text-[#1E664B] tabular-nums">
                  <UserCheck className="w-4 h-4 text-[#2F8F6B]" />
                  <span>
                    {humanClicks.toLocaleString('pt-BR')} cliques de pessoas
                    reais ({humanSharePct}%)
                  </span>
                </span>
                <span className="text-[#4E6B5F] tabular-nums">
                  <strong className="text-[#8F2D22]">
                    {botClicks.toLocaleString('pt-BR')}
                  </strong>{' '}
                  {botClicks === 1 ? 'robô' : 'robôs'}
                </span>
                <span className="text-[#4E6B5F] tabular-nums">
                  Total: <strong>{totalClicks.toLocaleString('pt-BR')}</strong>
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setTrafficFilter('all')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl cursor-pointer transition-all tabular-nums ${
                    trafficFilter === 'all'
                      ? 'clay-coral-btn text-white'
                      : 'clay-button-active text-[#3D3028] hover:text-[#E36A42]'
                  }`}
                >
                  Todos ({events.length.toLocaleString('pt-BR')})
                </button>
                <button
                  type="button"
                  onClick={() => setTrafficFilter('human')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl cursor-pointer transition-all inline-flex items-center gap-1.5 tabular-nums ${
                    trafficFilter === 'human'
                      ? 'bg-[#2F8F6B] text-white shadow-sm'
                      : 'clay-button-active text-[#1E664B] hover:bg-[#D9ECE4]'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>
                    Pessoas reais ({humanRowsCount.toLocaleString('pt-BR')})
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setTrafficFilter('bot')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl cursor-pointer transition-all inline-flex items-center gap-1.5 tabular-nums ${
                    trafficFilter === 'bot'
                      ? 'bg-[#C84B3C] text-white shadow-sm'
                      : 'clay-button-active text-[#8F2D22] hover:bg-[#FDE4E1]'
                  }`}
                >
                  <Bot className="w-3.5 h-3.5" />
                  <span>Robôs ({botRowsCount.toLocaleString('pt-BR')})</span>
                </button>
              </div>
            </>
          ) : (
            onOpenMapping && (
              <div className="clay-butter rounded-2xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-[#5E4E42]">
                  Para ver quais registros são de <strong>Pessoa real</strong> ou{' '}
                  <strong>Robô</strong> nesta aba, selecione a coluna
                  correspondente.
                </span>
                <button
                  type="button"
                  onClick={onOpenMapping}
                  className="px-3 py-1 rounded-xl clay-coral-btn text-white font-bold cursor-pointer"
                >
                  Mapear coluna Pessoa/Robô
                </button>
              </div>
            )
          )}
        </div>
      </div>

      {sortedEvents.length === 0 ? (
        <div className="py-12 px-6 text-center text-xs text-[#6E5F54]">
          Nenhum clique encontrado para os filtros atuais.
        </div>
      ) : (
        <div>
          {hasHorizontalOverflow && (
            <div
              ref={topScrollRef}
              onScroll={handleTopScroll}
              aria-label="Barra de rolagem horizontal superior"
              className="overflow-x-auto overflow-y-hidden clay-scrollbar border-b border-[#EADFD1] bg-[#FAF4EA] px-1 py-1"
            >
              <div style={{ width: `${tableScrollWidth}px`, height: '2px' }} />
            </div>
          )}

          <div
            ref={tableScrollRef}
            onScroll={handleTableScroll}
            className="overflow-auto max-h-[65vh] clay-scrollbar"
          >
            <table ref={tableRef} className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10 shadow-[0_1px_0_#EADFD1]">
                <tr className="border-b border-[#EADFD1] bg-[#FAF4EA] text-xs font-bold text-[#5E4E42]">
                  <th className="py-3.5 px-5 whitespace-nowrap bg-[#FAF4EA]">
                    <button
                      type="button"
                      onClick={() => handleSort('date')}
                      className="inline-flex items-center gap-1 cursor-pointer hover:text-[#2C221E]"
                    >
                      <span>Data</span>
                      {renderSortIcon('date')}
                    </button>
                  </th>
                  <th className="py-3.5 px-5 whitespace-nowrap bg-[#FAF4EA]">
                    <button
                      type="button"
                      onClick={() => handleSort('time')}
                      className="inline-flex items-center gap-1 cursor-pointer hover:text-[#2C221E]"
                    >
                      <span>Horário</span>
                      {renderSortIcon('time')}
                    </button>
                  </th>
                  {hasName && (
                    <th className="py-3.5 px-5 whitespace-nowrap bg-[#FAF4EA]">
                      <button
                        type="button"
                        onClick={() => handleSort('name')}
                        className="inline-flex items-center gap-1 cursor-pointer hover:text-[#2C221E]"
                      >
                        <span>Nome / Usuário</span>
                        {renderSortIcon('name')}
                      </button>
                    </th>
                  )}
                  {hasCity && (
                    <th className="py-3.5 px-5 whitespace-nowrap bg-[#FAF4EA]">
                      <button
                        type="button"
                        onClick={() => handleSort('city')}
                        className="inline-flex items-center gap-1 cursor-pointer hover:text-[#2C221E]"
                      >
                        <span>Cidade</span>
                        {renderSortIcon('city')}
                      </button>
                    </th>
                  )}
                  {hasDevice && (
                    <th className="py-3.5 px-5 whitespace-nowrap bg-[#FAF4EA]">
                      <button
                        type="button"
                        onClick={() => handleSort('device')}
                        className="inline-flex items-center gap-1 cursor-pointer hover:text-[#2C221E]"
                      >
                        <span>Aparelho</span>
                        {renderSortIcon('device')}
                      </button>
                    </th>
                  )}
                  {hasVisitorType && (
                    <th className="py-3.5 px-5 whitespace-nowrap bg-[#FAF4EA]">
                      <button
                        type="button"
                        onClick={() => handleSort('visitorType')}
                        className="inline-flex items-center gap-1 cursor-pointer hover:text-[#2C221E]"
                      >
                        <span>Pessoa / Robô</span>
                        {renderSortIcon('visitorType')}
                      </button>
                    </th>
                  )}
                  <th className="py-3.5 px-5 whitespace-nowrap bg-[#FAF4EA]">
                    <button
                      type="button"
                      onClick={() => handleSort('site')}
                      className="inline-flex items-center gap-1 cursor-pointer hover:text-[#2C221E]"
                    >
                      <span>Site</span>
                      {renderSortIcon('site')}
                    </button>
                  </th>
                  <th className="py-3.5 px-5 whitespace-nowrap bg-[#FAF4EA]">
                    <button
                      type="button"
                      onClick={() => handleSort('page')}
                      className="inline-flex items-center gap-1 cursor-pointer hover:text-[#2C221E]"
                    >
                      <span>Página Clicada</span>
                      {renderSortIcon('page')}
                    </button>
                  </th>
                  <th className="py-3.5 px-5 text-right whitespace-nowrap bg-[#FAF4EA]">
                    <button
                      type="button"
                      onClick={() => handleSort('clicks')}
                      className="inline-flex items-center gap-1 flex-row-reverse cursor-pointer hover:text-[#2C221E]"
                    >
                      <span>Cliques</span>
                      {renderSortIcon('clicks')}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFE5D8] text-xs">
                {pagedEvents.map((ev) => {
                  const colorIdx = siteColorIndexMap.get(ev.site) ?? 0;
                  const theme = getSiteColorTheme(colorIdx);
                  const displayName = ev.userName ?? ev.userId;
                  return (
                    <tr
                      key={ev.rowIndex}
                      onClick={() => onInspectRow(ev.rawRow)}
                      className="hover:bg-[#F7EFE4] transition-colors cursor-pointer"
                    >
                      <td className="py-3.5 px-5 font-mono tabular-nums text-[#5E4E42] whitespace-nowrap">
                        {ev.dateFormatted}
                      </td>
                      <td className="py-3.5 px-5 font-mono tabular-nums text-[#2C221E] font-medium whitespace-nowrap">
                        {ev.timeFormatted}
                      </td>
                      {hasName && (
                        <td
                          className="py-3.5 px-5 font-semibold text-[#2C221E] max-w-[180px] truncate"
                          title={displayName ?? ''}
                        >
                          {displayName ?? (
                            <span className="text-[#C7B8A6]">—</span>
                          )}
                        </td>
                      )}
                      {hasCity && (
                        <td
                          className="py-3.5 px-5 text-[#4A3B31] max-w-[150px] truncate"
                          title={ev.city ?? ''}
                        >
                          {ev.city ?? <span className="text-[#C7B8A6]">—</span>}
                        </td>
                      )}
                      {hasDevice && (
                        <td
                          className="py-3.5 px-5 text-[#4A3B31] max-w-[150px] truncate"
                          title={ev.device ?? ''}
                        >
                          {ev.device ?? (
                            <span className="text-[#C7B8A6]">—</span>
                          )}
                        </td>
                      )}
                      {hasVisitorType && (
                        <td className="py-3.5 px-5 whitespace-nowrap">
                          {ev.visitorType === 'human' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#D9ECE4] text-[#1E664B] font-bold text-[11px]">
                              <UserCheck className="w-3 h-3" />
                              <span>Pessoa real</span>
                            </span>
                          ) : ev.visitorType === 'bot' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#FDE4E1] text-[#8F2D22] font-bold text-[11px]">
                              <Bot className="w-3 h-3" />
                              <span>Robô</span>
                            </span>
                          ) : ev.visitorTypeLabel ? (
                            <span className="text-[#4A3B31]">
                              {ev.visitorTypeLabel}
                            </span>
                          ) : (
                            <span className="text-[#C7B8A6]">—</span>
                          )}
                        </td>
                      )}
                      <td
                        className={`py-3.5 px-5 font-bold max-w-[200px] truncate ${theme.textClass}`}
                      >
                        {ev.site}
                      </td>
                      <td
                        className="py-3.5 px-5 font-mono text-[#4A3B31] max-w-[340px] truncate"
                        title={ev.page}
                      >
                        {ev.page}
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono tabular-nums font-extrabold text-[#2C221E] whitespace-nowrap">
                        {ev.clicks.toLocaleString('pt-BR')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {sortedEvents.length > pageSize && (
        <div className="px-6 py-4 border-t border-[#EADFD1] flex items-center justify-between text-xs text-[#6E5F54]">
          <span className="font-mono tabular-nums">
            Página {safePage} de {totalPages}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="Página anterior"
              className="p-1.5 rounded-xl clay-button-active text-[#2C221E] disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              aria-label="Próxima página"
              className="p-1.5 rounded-xl clay-button-active text-[#2C221E] disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
