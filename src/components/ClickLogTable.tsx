import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
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
}

type SortField =
  | 'date'
  | 'time'
  | 'name'
  | 'city'
  | 'device'
  | 'site'
  | 'page'
  | 'clicks';
type SortDir = 'asc' | 'desc';

export const ClickLogTable: React.FC<ClickLogTableProps> = ({
  spreadsheetTitle,
  sheetTitle,
  events,
  siteColorIndexMap,
  onInspectRow,
}) => {
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    setPage(1);
  }, [events.length]);

  const { hasName, hasCity, hasDevice } = useMemo(() => {
    let nameFound = false;
    let cityFound = false;
    let deviceFound = false;
    for (const ev of events) {
      if (ev.userName || ev.userId) nameFound = true;
      if (ev.city) cityFound = true;
      if (ev.device) deviceFound = true;
      if (nameFound && cityFound && deviceFound) break;
    }
    return {
      hasName: nameFound,
      hasCity: cityFound,
      hasDevice: deviceFound,
    };
  }, [events]);

  const sortedEvents = useMemo(() => {
    const copy = [...events];
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
  }, [events, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedEvents.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const pagedEvents = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return sortedEvents.slice(start, start + pageSize);
  }, [sortedEvents, safePage]);

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
      <div className="px-6 py-5 border-b border-[#EADFD1] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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

      {sortedEvents.length === 0 ? (
        <div className="py-12 px-6 text-center text-xs text-[#6E5F54]">
          Nenhum clique encontrado para os filtros atuais.
        </div>
      ) : (
        <div className="overflow-x-auto clay-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#EADFD1] bg-[#FAF4EA] text-xs font-bold text-[#5E4E42]">
                <th className="py-3.5 px-5 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort('date')}
                    className="inline-flex items-center gap-1 cursor-pointer hover:text-[#2C221E]"
                  >
                    <span>Data</span>
                    {renderSortIcon('date')}
                  </button>
                </th>
                <th className="py-3.5 px-5 whitespace-nowrap">
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
                  <th className="py-3.5 px-5 whitespace-nowrap">
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
                  <th className="py-3.5 px-5 whitespace-nowrap">
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
                  <th className="py-3.5 px-5 whitespace-nowrap">
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
                <th className="py-3.5 px-5 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort('site')}
                    className="inline-flex items-center gap-1 cursor-pointer hover:text-[#2C221E]"
                  >
                    <span>Site</span>
                    {renderSortIcon('site')}
                  </button>
                </th>
                <th className="py-3.5 px-5 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort('page')}
                    className="inline-flex items-center gap-1 cursor-pointer hover:text-[#2C221E]"
                  >
                    <span>Página Clicada</span>
                    {renderSortIcon('page')}
                  </button>
                </th>
                <th className="py-3.5 px-5 text-right whitespace-nowrap">
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
                        {displayName ?? <span className="text-[#C7B8A6]">—</span>}
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
                        {ev.device ?? <span className="text-[#C7B8A6]">—</span>}
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
