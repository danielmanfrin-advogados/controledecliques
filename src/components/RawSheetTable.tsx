import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Search,
} from 'lucide-react';
import { ColumnSchema, ParsedRow } from '../types/sheets';

interface RawSheetTableProps {
  spreadsheetTitle: string;
  sheetTitle: string;
  columns: ColumnSchema[];
  rows: ParsedRow[];
  onInspectRow: (row: ParsedRow) => void;
}

export const RawSheetTable: React.FC<RawSheetTableProps> = ({
  spreadsheetTitle,
  sheetTitle,
  columns,
  rows,
  onInspectRow,
}) => {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [tableScrollWidth, setTableScrollWidth] = useState(0);
  const [hasHorizontalOverflow, setHasHorizontalOverflow] = useState(false);

  const topScrollRef = useRef<HTMLDivElement | null>(null);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const tableRef = useRef<HTMLTableElement | null>(null);
  const syncingSourceRef = useRef<'top' | 'table' | null>(null);

  const pageSize = 50;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      columns.some((c) =>
        (row.cells[c.key]?.formatted ?? '').toLowerCase().includes(q)
      )
    );
  }, [rows, columns, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage]);

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
  }, [measureOverflow, columns, paged]);

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

  const handleExport = () => {
    const esc = (v: string) => {
      const s = v.replace(/"/g, '""');
      return /[;"\n\r,]/.test(v) ? `"${s}"` : s;
    };
    const header = columns.map((c) => esc(c.label)).join(',');
    const body = filtered
      .map((r) => columns.map((c) => esc(r.cells[c.key]?.formatted ?? '')).join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + header + '\n' + body], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute(
      'download',
      `${spreadsheetTitle}_${sheetTitle}_completo.csv`.replace(/\s+/g, '_')
    );
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <section
      aria-label="Planilha completa"
      className="clay-card rounded-[28px] overflow-hidden"
    >
      <div className="px-6 py-5 border-b border-[#EADFD1] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[#2C221E]">
            Dados Completos da Aba "{sheetTitle}"
          </h2>
          <p className="text-xs text-[#6E5F54] mt-0.5 tabular-nums">
            {filtered.length.toLocaleString('pt-BR')} linhas · {columns.length}{' '}
            colunas lidas diretamente do Google Sheets
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#8C7A6B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar na planilha..."
              className="pl-8 pr-3 py-2 text-xs rounded-2xl clay-input border border-[#EADFD1] text-[#2C221E] placeholder:text-[#9A897A] focus:outline-none focus:ring-2 focus:ring-[#E36A42]"
            />
          </div>

          <button
            type="button"
            onClick={handleExport}
            disabled={filtered.length === 0}
            className="px-3.5 py-2 text-xs font-bold rounded-2xl clay-button-active text-[#2C221E] hover:text-[#E36A42] disabled:opacity-45 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-12 text-center text-xs text-[#6E5F54]">
          Nenhuma linha encontrada na planilha.
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
                  <th className="py-3 px-4 text-right font-mono text-[#8C7A6B] w-12 bg-[#FAF4EA]">
                    #
                  </th>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className="py-3 px-4 whitespace-nowrap bg-[#FAF4EA]"
                    >
                      {col.label}
                    </th>
                  ))}
                  <th
                    className="py-3 px-3 w-10 bg-[#FAF4EA]"
                    aria-label="Inspecionar"
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFE5D8] text-xs">
                {paged.map((row) => (
                  <tr
                    key={row.rowIndex}
                    onClick={() => onInspectRow(row)}
                    className="hover:bg-[#F7EFE4] transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-[#8C7A6B]">
                      {row.rowIndex}
                    </td>
                    {columns.map((col) => {
                      const val = row.cells[col.key]?.formatted;
                      return (
                        <td
                          key={col.key}
                          className="py-3 px-4 max-w-[280px] truncate text-[#2C221E]"
                          title={val || ''}
                        >
                          {val || <span className="text-[#C7B8A6]">—</span>}
                        </td>
                      );
                    })}
                    <td className="py-3 px-3 text-right">
                      <Eye className="w-3.5 h-3.5 text-[#8C7A6B] inline-block" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {filtered.length > pageSize && (
        <div className="px-6 py-4 border-t border-[#EADFD1] flex items-center justify-between text-xs text-[#6E5F54]">
          <span className="font-mono tabular-nums">
            Página {safePage} de {totalPages}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-xl clay-button-active text-[#2C221E] disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-xl clay-button-active text-[#2C221E] disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
