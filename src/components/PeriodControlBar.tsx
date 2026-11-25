import React from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { PeriodPreset } from '../types/sheets';
import { getPeriodBounds } from '../utils/dataAnalyzer';

interface PeriodControlBarProps {
  period: PeriodPreset;
  onChangePeriod: (p: PeriodPreset) => void;
  referenceDate: Date;
  onChangeReferenceDate: (d: Date) => void;
  customStart: string;
  customEnd: string;
  onChangeCustomStart: (v: string) => void;
  onChangeCustomEnd: (v: string) => void;
  selectedSite: string | null;
  selectedPage: string | null;
  selectedHour: number | null;
  onClearSubFilters: () => void;
  embedded?: boolean;
}

const PERIOD_OPTIONS: Array<{ id: PeriodPreset; label: string }> = [
  { id: 'day', label: 'Dia' },
  { id: 'week', label: 'Semana' },
  { id: 'month', label: 'Mês' },
  { id: 'year', label: 'Ano' },
  { id: 'all', label: 'Tudo' },
  { id: 'custom', label: 'Datas' },
];

export const PeriodControlBar: React.FC<PeriodControlBarProps> = ({
  period,
  onChangePeriod,
  referenceDate,
  onChangeReferenceDate,
  customStart,
  customEnd,
  onChangeCustomStart,
  onChangeCustomEnd,
  selectedSite,
  selectedPage,
  selectedHour,
  onClearSubFilters,
  embedded = false,
}) => {
  const stepDate = (direction: -1 | 1) => {
    const next = new Date(referenceDate);
    if (period === 'day') {
      next.setDate(next.getDate() + direction);
    } else if (period === 'week') {
      next.setDate(next.getDate() + direction * 7);
    } else if (period === 'month') {
      next.setMonth(next.getMonth() + direction);
    } else if (period === 'year') {
      next.setFullYear(next.getFullYear() + direction);
    }
    onChangeReferenceDate(next);
  };

  const bounds = getPeriodBounds(period, referenceDate);
  const hasSubFilters =
    Boolean(selectedSite) || Boolean(selectedPage) || selectedHour !== null;

  return (
    <div
      className={
        embedded
          ? 'space-y-3'
          : 'clay-card rounded-[24px] p-4 space-y-3'
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Selecionar período"
          className="inline-flex flex-wrap items-center gap-1 p-1.5 rounded-2xl bg-[#FCF7EE]/90 shadow-inner"
        >
          {PERIOD_OPTIONS.map((opt) => {
            const active = period === opt.id;
            return (
              <button
                key={opt.id}
                role="tab"
                aria-selected={active}
                type="button"
                onClick={() => onChangePeriod(opt.id)}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  active
                    ? 'clay-coral-btn text-white'
                    : 'text-[#5E4E42] hover:text-[#2C221E] hover:bg-[#F5EDE1]'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {period !== 'all' && period !== 'custom' && (
          <div className="inline-flex items-center gap-1 rounded-2xl bg-[#FCF7EE]/90 px-2 py-1 shadow-inner">
            <button
              type="button"
              onClick={() => stepDate(-1)}
              aria-label="Período anterior"
              className="p-1.5 rounded-xl text-[#5E4E42] hover:text-[#2C221E] hover:bg-[#F5EDE1] cursor-pointer transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2.5 text-xs font-bold text-[#2C221E] whitespace-nowrap font-mono tabular-nums">
              {bounds.label}
            </span>
            <button
              type="button"
              onClick={() => stepDate(1)}
              aria-label="Próximo período"
              className="p-1.5 rounded-xl text-[#5E4E42] hover:text-[#2C221E] hover:bg-[#F5EDE1] cursor-pointer transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onChangeReferenceDate(new Date())}
              className="px-2.5 py-1 text-xs font-bold text-[#E36A42] hover:bg-[#FDECE4] rounded-xl cursor-pointer whitespace-nowrap transition-colors"
            >
              Hoje
            </button>
          </div>
        )}

        {period === 'custom' && (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              aria-label="Data inicial"
              value={customStart}
              onChange={(e) => onChangeCustomStart(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl clay-input border border-[#EADFD1] text-[#2C221E] font-mono focus:outline-none focus:ring-2 focus:ring-[#E36A42]"
            />
            <span className="text-xs font-medium text-[#6E5F54]">até</span>
            <input
              type="date"
              aria-label="Data final"
              value={customEnd}
              onChange={(e) => onChangeCustomEnd(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl clay-input border border-[#EADFD1] text-[#2C221E] font-mono focus:outline-none focus:ring-2 focus:ring-[#E36A42]"
            />
          </div>
        )}
      </div>

      {hasSubFilters && (
        <div className="pt-2.5 border-t border-[#E6C3AD]/60 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2 text-[#4A3B31]">
            <span className="text-[#7D5E4C] font-medium">Filtro ativo:</span>
            {selectedSite && (
              <span className="font-bold text-[#366B62]">{selectedSite}</span>
            )}
            {selectedPage && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono font-semibold text-[#2C221E]">
                  {selectedPage}
                </span>
              </>
            )}
            {selectedHour !== null && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono font-bold text-[#B54B27]">
                  {String(selectedHour).padStart(2, '0')}h00–
                  {String(selectedHour).padStart(2, '0')}h59
                </span>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={onClearSubFilters}
            className="text-[#B54B27] hover:text-[#8E3518] font-bold inline-flex items-center gap-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>Limpar filtro</span>
          </button>
        </div>
      )}
    </div>
  );
};
