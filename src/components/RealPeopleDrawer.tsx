import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Globe,
  List,
  MapPin,
  Search,
  SlidersHorizontal,
  Smartphone,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import {
  ParsedRow,
  RealPeopleSummary,
  RealPersonDetail,
} from '../types/sheets';
import { exportClickEventsCsv } from '../utils/dataAnalyzer';
import { getSiteColorTheme } from '../utils/siteColors';

interface RealPeopleDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  summary: RealPeopleSummary;
  siteColorIndexMap: Map<string, number>;
  periodLabel: string;
  selectedSite: string | null;
  selectedPage: string | null;
  selectedHour: number | null;
  hasUserCol: boolean;
  hasVisitorTypeCol: boolean;
  spreadsheetTitle: string;
  onOpenMapping: () => void;
  onInspectRow: (row: ParsedRow) => void;
}

type ViewMode = 'people' | 'events';
type StatusFilter = 'all' | 'new' | 'returning';

export const RealPeopleDrawer: React.FC<RealPeopleDrawerProps> = ({
  isOpen,
  onClose,
  summary,
  siteColorIndexMap,
  periodLabel,
  selectedSite,
  selectedPage,
  selectedHour,
  hasUserCol,
  hasVisitorTypeCol,
  spreadsheetTitle,
  onOpenMapping,
  onInspectRow,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('people');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    setPage(1);
  }, [viewMode, statusFilter, query, isOpen]);

  const filteredPeople = useMemo(() => {
    const q = query.trim().toLowerCase();
    return summary.people.filter((p) => {
      if (statusFilter === 'new' && !p.isNewOverall) return false;
      if (statusFilter === 'returning' && p.isNewOverall) return false;
      if (!q) return true;
      const hay = [
        p.displayName,
        p.userId ?? '',
        ...p.cities,
        ...p.devices,
        ...p.sites.map((s) => s.site),
        ...p.pages.map((pg) => pg.page),
        p.firstDateFormatted,
        p.firstTimeFormatted,
        p.lastDateFormatted,
        p.lastTimeFormatted,
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [summary.people, statusFilter, query]);

  const filteredEvents = useMemo(() => {
    const q = query.trim().toLowerCase();
    return summary.events.filter((ev) => {
      if (statusFilter === 'new' && !ev.isNewOnSite) return false;
      if (statusFilter === 'returning' && ev.isNewOnSite) return false;
      if (!q) return true;
      const hay = [
        ev.userName ?? '',
        ev.userId ?? '',
        ev.site,
        ev.page,
        ev.city ?? '',
        ev.device ?? '',
        ev.dateFormatted,
        ev.timeFormatted,
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [summary.events, statusFilter, query]);

  if (!isOpen) return null;

  const pageSize = viewMode === 'people' ? 20 : 40;
  const totalItems =
    viewMode === 'people' ? filteredPeople.length : filteredEvents.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);

  const pagedPeople = filteredPeople.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );
  const pagedEvents = filteredEvents.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  const toggleExpanded = (key: string) => {
    setExpandedKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const getPersonStatusBadge = (p: RealPersonDetail) => {
    const hasNewSite = p.sites.some((s) => s.isNewOnSite);
    const hasReturningSite = p.sites.some((s) => !s.isNewOnSite);
    if (hasNewSite && hasReturningSite) {
      return {
        label: 'Nova e Reincidente',
        className: 'bg-[#F3ECE2] text-[#5E4E42]',
      };
    }
    if (p.isNewOverall) {
      return {
        label: 'Nova no site',
        className: 'bg-[#D9ECE4] text-[#1E664B]',
      };
    }
    return {
      label: 'Reincidente no site',
      className: 'bg-[#EAE6F3] text-[#554B8A]',
    };
  };

  const contextParts: string[] = [periodLabel];
  if (selectedSite) contextParts.push(`Site: ${selectedSite}`);
  if (selectedPage) contextParts.push(`Página: ${selectedPage}`);
  if (selectedHour !== null) {
    contextParts.push(`Horário: ${String(selectedHour).padStart(2, '0')}h`);
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-[#2C221E]/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label="Detalhes de pessoas reais"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl max-h-[90vh] clay-shell rounded-[28px] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 sm:py-5 border-b border-[#EADFD1] flex items-start justify-between gap-4 shrink-0">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-[#278260] text-white flex items-center justify-center shrink-0 clay-icon-tile">
              <UserCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-extrabold text-[#2C221E]">
                Detalhes de Pessoas Reais
              </h2>
              <p className="text-xs text-[#6E5F54] mt-0.5 truncate">
                {contextParts.join(' · ')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {filteredEvents.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const slug = spreadsheetTitle
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/gi, '-')
                    .replace(/(^-|-$)/g, '');
                  exportClickEventsCsv(
                    filteredEvents,
                    `${slug || 'planilha'}-pessoas-reais.csv`
                  );
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-2xl clay-button-active text-[#2C221E] hover:text-[#1E664B] cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Exportar CSV</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar detalhes de pessoas reais"
              className="p-2 rounded-xl clay-card text-[#5E4E42] hover:text-[#2C221E] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Summary Strip */}
        <div className="px-5 sm:px-6 py-3.5 bg-[#FAF3E8] border-b border-[#EADFD1] grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
          <div className="rounded-2xl bg-[#D9ECE4]/75 px-3.5 py-2.5">
            <p className="text-[11px] font-semibold text-[#395E50]">
              Cliques de Pessoas Reais
            </p>
            <p className="text-lg font-extrabold font-mono tabular-nums text-[#1E664B]">
              {summary.totalHumanClicks.toLocaleString('pt-BR')}
            </p>
          </div>
          <div className="rounded-2xl bg-[#FDF9F2] border border-[#EADFD1] px-3.5 py-2.5">
            <p className="text-[11px] font-semibold text-[#6E5F54]">
              {hasUserCol ? 'Pessoas Identificadas' : 'Registros de Pessoas'}
            </p>
            <p className="text-lg font-extrabold font-mono tabular-nums text-[#2C221E]">
              {summary.totalPeopleCount.toLocaleString('pt-BR')}
            </p>
          </div>
          <div className="rounded-2xl bg-[#DDF0EA]/80 px-3.5 py-2.5">
            <p className="text-[11px] font-semibold text-[#2F6A5E]">
              Novas no Site
            </p>
            <p className="text-lg font-extrabold font-mono tabular-nums text-[#1E664B]">
              {summary.newPeopleCount.toLocaleString('pt-BR')}
            </p>
          </div>
          <div className="rounded-2xl bg-[#EAE6F3]/80 px-3.5 py-2.5">
            <p className="text-[11px] font-semibold text-[#554B8A]">
              Reincidentes
            </p>
            <p className="text-lg font-extrabold font-mono tabular-nums text-[#554B8A]">
              {summary.returningPeopleCount.toLocaleString('pt-BR')}
            </p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="px-5 sm:px-6 py-3.5 border-b border-[#EADFD1] flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center rounded-2xl bg-[#EFE6D8] p-1">
              <button
                type="button"
                onClick={() => setViewMode('people')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer tabular-nums ${
                  viewMode === 'people'
                    ? 'clay-button-active text-[#2C221E]'
                    : 'text-[#6E5F54] hover:text-[#2C221E]'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Por pessoa ({filteredPeople.length.toLocaleString('pt-BR')})</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('events')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer tabular-nums ${
                  viewMode === 'events'
                    ? 'clay-button-active text-[#2C221E]'
                    : 'text-[#6E5F54] hover:text-[#2C221E]'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>Cliques ({filteredEvents.length.toLocaleString('pt-BR')})</span>
              </button>
            </div>

            <div className="inline-flex items-center rounded-2xl bg-[#EFE6D8] p-1">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1.5 text-[11px] font-bold rounded-xl transition-all cursor-pointer ${
                  statusFilter === 'all'
                    ? 'clay-button-active text-[#2C221E]'
                    : 'text-[#6E5F54] hover:text-[#2C221E]'
                }`}
              >
                Todas
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('new')}
                className={`px-2.5 py-1.5 text-[11px] font-bold rounded-xl transition-all cursor-pointer ${
                  statusFilter === 'new'
                    ? 'clay-button-active text-[#1E664B]'
                    : 'text-[#6E5F54] hover:text-[#1E664B]'
                }`}
              >
                Novas no site
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('returning')}
                className={`px-2.5 py-1.5 text-[11px] font-bold rounded-xl transition-all cursor-pointer ${
                  statusFilter === 'returning'
                    ? 'clay-button-active text-[#554B8A]'
                    : 'text-[#6E5F54] hover:text-[#554B8A]'
                }`}
              >
                Reincidentes
              </button>
            </div>
          </div>

          <div className="relative flex-1 min-w-[210px] sm:max-w-xs">
            <Search className="w-3.5 h-3.5 text-[#8C7A6B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar pessoa, site, página, cidade..."
              className="w-full pl-8 pr-3 py-2 text-xs rounded-2xl clay-input border border-[#EADFD1] text-[#2C221E] placeholder:text-[#9A897A] focus:outline-none focus:ring-2 focus:ring-[#278260]"
            />
          </div>
        </div>

        {/* Mapping Hint if needed */}
        {(!hasVisitorTypeCol || !hasUserCol) && (
          <div className="px-5 sm:px-6 py-2.5 bg-[#FFF6EB] border-b border-[#EADFD1] flex flex-wrap items-center justify-between gap-2 text-xs text-[#6F4B37] shrink-0">
            <span>
              {!hasVisitorTypeCol
                ? 'Coluna de Pessoa Real / Robô não está mapeada.'
                : 'Dica: mapeie a coluna de Nome/Usuário para agrupar todos os cliques da mesma pessoa.'}
            </span>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenMapping();
              }}
              className="inline-flex items-center gap-1.5 font-bold text-[#E36A42] hover:underline cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Configurar colunas</span>
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 clay-scrollbar">
          {totalItems === 0 ? (
            <div className="py-12 text-center space-y-2">
              <p className="text-sm font-bold text-[#2C221E]">
                Nenhuma pessoa real encontrada neste recorte.
              </p>
              <p className="text-xs text-[#6E5F54]">
                Ajuste a busca, o filtro acima ou o período selecionado.
              </p>
            </div>
          ) : viewMode === 'people' ? (
            <div className="space-y-3.5">
              {pagedPeople.map((person) => {
                const statusBadge = getPersonStatusBadge(person);
                const isExpanded =
                  Boolean(expandedKeys[person.key]) ||
                  (pagedPeople.length <= 5 && person.events.length <= 5);
                const showDistinctId =
                  person.userId &&
                  person.userId.toLowerCase() !==
                    person.displayName.toLowerCase();

                return (
                  <article
                    key={person.key}
                    className="rounded-2xl bg-[#FDF9F2] border border-[#EADFD1] overflow-hidden shadow-xs"
                  >
                    <div className="p-4 sm:p-5 space-y-3">
                      {/* Top header line */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <span className="inline-flex items-center gap-1.5 text-sm sm:text-base font-extrabold text-[#2C221E] break-all">
                            <UserCheck className="w-4 h-4 text-[#278260] shrink-0" />
                            <span>{person.displayName}</span>
                          </span>
                          {showDistinctId && (
                            <span className="text-[11px] font-mono text-[#6E5F54] bg-[#EFE6D8] px-2 py-0.5 rounded-lg">
                              {person.userId}
                            </span>
                          )}
                          <span
                            className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold ${statusBadge.className}`}
                          >
                            {statusBadge.label}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 text-xs tabular-nums">
                          <span className="font-mono font-extrabold text-[#1E664B] bg-[#D9ECE4] px-2.5 py-1 rounded-xl">
                            {person.totalHumanClicks.toLocaleString('pt-BR')}{' '}
                            {person.totalHumanClicks === 1 ? 'clique' : 'cliques'}
                          </span>
                          <span className="font-mono text-[#6E5F54]">
                            {person.lastDateFormatted} · {person.lastTimeFormatted}
                          </span>
                        </div>
                      </div>

                      {/* Metadata: Cidade, Aparelho, Horários */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#4A3B31]">
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-[#E36A42] shrink-0" />
                          <span className="font-semibold">
                            {person.cities.length > 0
                              ? person.cities.join(', ')
                              : 'Cidade não informada'}
                          </span>
                        </span>
                        {person.devices.length > 0 && (
                          <span className="inline-flex items-center gap-1.5">
                            <Smartphone className="w-3.5 h-3.5 text-[#766BB0] shrink-0" />
                            <span className="font-semibold">
                              {person.devices.join(', ')}
                            </span>
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
                          <Clock className="w-3.5 h-3.5 text-[#4C8F84] shrink-0" />
                          <span>
                            {person.firstTimeFormatted === person.lastTimeFormatted &&
                            person.firstDateFormatted === person.lastDateFormatted
                              ? `Horário: ${person.lastTimeFormatted}`
                              : `1º às ${person.firstTimeFormatted} (${person.firstDateFormatted}) · Último às ${person.lastTimeFormatted}`}
                          </span>
                        </span>
                      </div>

                      {/* Sites clicados + Nova ou Reincidente no site */}
                      <div className="space-y-1.5">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-[#8C7A6B] flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5" />
                          <span>Sites clicados</span>
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {person.sites.map((s) => {
                            const theme = getSiteColorTheme(
                              siteColorIndexMap.get(s.site) ?? 0
                            );
                            return (
                              <div
                                key={s.site}
                                className={`inline-flex flex-wrap items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs border border-[#EADFD1]/80 ${theme.softBgClass}`}
                              >
                                <span className={`font-bold ${theme.textClass}`}>
                                  {s.site}
                                </span>
                                <span className="font-mono font-bold text-[#2C221E] tabular-nums">
                                  ({s.clicks}x)
                                </span>
                                <span
                                  className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                                    s.isNewOnSite
                                      ? 'bg-[#D9ECE4] text-[#1E664B]'
                                      : 'bg-[#EAE6F3] text-[#554B8A]'
                                  }`}
                                >
                                  {s.isNewOnSite
                                    ? 'Nova no site'
                                    : `Reincidente · desde ${s.firstDateOnSite}`}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Páginas visitadas */}
                      <div className="space-y-1.5">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-[#8C7A6B] flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5" />
                          <span>Páginas visitadas ({person.pages.length})</span>
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {person.pages.map((pg) => (
                            <span
                              key={`${pg.site}|||${pg.page}`}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#EFE6D8]/80 text-xs text-[#2C221E]"
                              title={`${pg.site}${pg.page}`}
                            >
                              {person.sites.length > 1 && (
                                <span className="font-bold text-[#6E5F54]">
                                  {pg.site}
                                </span>
                              )}
                              <span className="font-mono break-all">
                                {pg.page}
                              </span>
                              <span className="font-mono font-bold text-[#1E664B] tabular-nums">
                                ({pg.clicks}x · {pg.lastTimeFormatted})
                              </span>
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Expandable click-by-click details */}
                      <div className="pt-1 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => toggleExpanded(person.key)}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1E664B] hover:text-[#154A36] cursor-pointer"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="w-3.5 h-3.5" />
                              <span>Ocultar histórico de cliques</span>
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3.5 h-3.5" />
                              <span>
                                Ver {person.events.length}{' '}
                                {person.events.length === 1
                                  ? 'registro detalhado'
                                  : 'registros detalhados'}
                              </span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-[#EADFD1] bg-[#FAF4EA] divide-y divide-[#EFE5D8]">
                        {person.events.map((ev) => {
                          const evTheme = getSiteColorTheme(
                            siteColorIndexMap.get(ev.site) ?? 0
                          );
                          return (
                            <button
                              key={ev.rowIndex}
                              type="button"
                              onClick={() => onInspectRow(ev.rawRow)}
                              className="w-full px-4 sm:px-5 py-2.5 text-left text-xs hover:bg-[#F3E9DB]/70 flex flex-wrap items-center justify-between gap-2 cursor-pointer"
                            >
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0 flex-1">
                                <span className="inline-flex items-center gap-1 font-mono font-bold tabular-nums text-[#2C221E] shrink-0">
                                  <Calendar className="w-3 h-3 text-[#8C7A6B]" />
                                  {ev.dateFormatted} · {ev.timeFormatted}
                                </span>
                                <span
                                  className={`font-bold shrink-0 ${evTheme.textClass}`}
                                >
                                  {ev.site}
                                </span>
                                <span className="font-mono text-[#4A3B31] break-all">
                                  {ev.page}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
                                    ev.isNewOnSite
                                      ? 'bg-[#D9ECE4] text-[#1E664B]'
                                      : 'bg-[#EAE6F3] text-[#554B8A]'
                                  }`}
                                >
                                  {ev.isNewOnSite ? 'Nova no site' : 'Reincidente'}
                                </span>
                                {ev.city && (
                                  <span className="text-[11px] text-[#5E4E42]">
                                    {ev.city}
                                  </span>
                                )}
                                {ev.device && (
                                  <span className="text-[11px] text-[#6E5F54]">
                                    {ev.device}
                                  </span>
                                )}
                              </div>
                              <span className="inline-flex items-center gap-1 font-mono font-bold tabular-nums text-[#2C221E] shrink-0">
                                <span>{ev.clicks}x</span>
                                <ExternalLink className="w-3 h-3 text-[#8C7A6B]" />
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-[#EADFD1] bg-[#FDF9F2] overflow-x-auto clay-scrollbar">
              <table className="w-full text-left border-collapse min-w-[780px]">
                <thead>
                  <tr className="border-b border-[#EADFD1] bg-[#F5ECE0] text-[11px] font-bold uppercase tracking-wider text-[#6E5F54]">
                    <th className="py-3 px-4">Data / Horário</th>
                    <th className="py-3 px-4">Pessoa</th>
                    <th className="py-3 px-4">Status no Site</th>
                    <th className="py-3 px-4">Site</th>
                    <th className="py-3 px-4">Página Visitada</th>
                    <th className="py-3 px-4">Cidade</th>
                    <th className="py-3 px-4">Aparelho</th>
                    <th className="py-3 px-4 text-right">Cliques</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFE5D8] text-xs">
                  {pagedEvents.map((ev) => {
                    const theme = getSiteColorTheme(
                      siteColorIndexMap.get(ev.site) ?? 0
                    );
                    return (
                      <tr
                        key={ev.rowIndex}
                        onClick={() => onInspectRow(ev.rawRow)}
                        className="hover:bg-[#FAF2E7] cursor-pointer transition-colors"
                      >
                        <td className="py-3 px-4 font-mono tabular-nums whitespace-nowrap text-[#2C221E]">
                          <span className="font-bold">{ev.dateFormatted}</span>{' '}
                          <span className="text-[#6E5F54]">{ev.timeFormatted}</span>
                        </td>
                        <td className="py-3 px-4 font-bold text-[#2C221E]">
                          {ev.userName ?? ev.userId ?? `Visitante #${ev.rowIndex}`}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-lg text-[11px] font-bold ${
                              ev.isNewOnSite
                                ? 'bg-[#D9ECE4] text-[#1E664B]'
                                : 'bg-[#EAE6F3] text-[#554B8A]'
                            }`}
                          >
                            {ev.isNewOnSite ? 'Nova no site' : 'Reincidente'}
                          </span>
                        </td>
                        <td className={`py-3 px-4 font-bold whitespace-nowrap ${theme.textClass}`}>
                          {ev.site}
                        </td>
                        <td className="py-3 px-4 font-mono text-[#4A3B31] max-w-[240px] truncate" title={ev.page}>
                          {ev.page}
                        </td>
                        <td className="py-3 px-4 text-[#4A3B31]">
                          {ev.city ?? <span className="text-[#B8A795]">—</span>}
                        </td>
                        <td className="py-3 px-4 text-[#4A3B31]">
                          {ev.device ?? <span className="text-[#B8A795]">—</span>}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold tabular-nums text-[#1E664B]">
                          {ev.clicks.toLocaleString('pt-BR')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer / Pagination */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-[#EADFD1] flex flex-wrap items-center justify-between gap-3 shrink-0 bg-[#FCF7EE]">
          <span className="text-xs font-mono tabular-nums text-[#6E5F54]">
            {totalPages > 1
              ? `Página ${safePage} de ${totalPages} · ${totalItems.toLocaleString('pt-BR')} ${
                  viewMode === 'people' ? 'pessoas' : 'registros'
                }`
              : `${totalItems.toLocaleString('pt-BR')} ${
                  viewMode === 'people' ? 'pessoas reais' : 'cliques reais'
                }`}
          </span>

          <div className="flex items-center gap-2">
            {totalPages > 1 && (
              <div className="flex items-center gap-1.5 mr-2">
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
            )}
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
    </div>
  );
};
