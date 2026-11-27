import React from 'react';
import { ExternalLink, X } from 'lucide-react';
import { ColumnSchema, ParsedRow } from '../types/sheets';

interface RowDetailDrawerProps {
  row: ParsedRow | null;
  columns: ColumnSchema[];
  spreadsheetUrl: string;
  sheetTitle: string;
  onClose: () => void;
}

export const RowDetailDrawer: React.FC<RowDetailDrawerProps> = ({
  row,
  columns,
  spreadsheetUrl,
  sheetTitle,
  onClose,
}) => {
  if (!row) return null;

  return (
    <div
      className="fixed inset-0 z-[60] bg-[#2C221E]/35 backdrop-blur-xs flex justify-end"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md clay-shell h-full flex flex-col rounded-l-[28px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-[#EADFD1] flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-[#2C221E]">
              Detalhes do Registro
            </h3>
            <p className="text-xs text-[#6E5F54] font-mono mt-0.5">
              {sheetTitle} · Linha {row.rowIndex}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar detalhes"
            className="p-2 rounded-xl clay-card text-[#5E4E42] hover:text-[#2C221E] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 divide-y divide-[#EFE5D8]">
          {columns.map((col) => {
            const cell = row.cells[col.key];
            const isNumericOrDate =
              col.type === 'currency' ||
              col.type === 'number' ||
              col.type === 'percent' ||
              col.type === 'date';

            return (
              <div key={col.key} className="py-3.5 first:pt-0 last:pb-0">
                <dt className="text-xs font-semibold text-[#6E5F54]">
                  {col.label}
                </dt>
                <dd
                  className={`mt-1 text-sm text-[#2C221E] font-medium break-words ${
                    isNumericOrDate ? 'font-mono tabular-nums' : ''
                  }`}
                >
                  {cell?.formatted || (
                    <span className="text-[#B8A795]">Vazio</span>
                  )}
                </dd>
              </div>
            );
          })}
        </div>

        <div className="px-6 py-4 border-t border-[#EADFD1] flex items-center justify-between gap-3">
          <a
            href={spreadsheetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-bold text-[#4C8F84] hover:text-[#366B62] inline-flex items-center gap-1.5"
          >
            <span>Abrir no Google Sheets</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold rounded-2xl clay-coral-btn text-white cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
