import React, { useMemo, useState } from 'react';
import {
  Bot,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Globe,
  MapPin,
  MousePointerClick,
  Search,
  SlidersHorizontal,
  Smartphone,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { ParsedRow, UsersAnalyticsSummary } from '../types/sheets';
import { getSiteColorTheme } from '../utils/siteColors';

interface UsersAnalyticsPanelProps {
  summary: UsersAnalyticsSummary;
  siteColorIndexMap: Map<string, number>;
  selectedSite: string | null;
  onSelectSite: (site: string | null) => void;
  periodLabel: string;
  hasVisitorTypeCol?: boolean;
  onOpenMapping: () => void;
  onInspectRow: (row: ParsedRow) => void;
  onOpenRealPeople?: () => void;
}

type UserFilterMode = 'new' | 'all' | 'returning';
type UserSortMode = 'clicks' | 'days' | 'recent';
type TrafficFilterMode = 'all' | 'human' | 'bot';

export const UsersAnalyticsPanel: React.FC<UsersAnalyticsPanelProps> = ({
  summary,
  siteColorIndexMap,
  selectedSite,
  onSelectSite,
  periodLabel,
  hasVisitorTypeCol = false,
  onOpenMapping,
  onInspectRow,
  onOpenRealPeople,
}) => {
  const [filterMode, setFilterMode] = useState<UserFilterMode>('new');
  const [trafficFilter, setTrafficFilter] = useState<TrafficFilterMode>('all');
  const [sortMode, setSortMode] = useState<UserSortMode>('clicks');
  const [userSearch, setUserSearch] = useState('');
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const hasVisitorData =
    hasVisitorTypeCol ||
    summary.totalHumanClicks > 0 ||
    summary.totalBotClicks > 0;

  const siteScopedUsers = useMemo(() => {
    if (!selectedSite) return summary.users;
    return summary.users.filter((u) =>
      u.sites.some((s) => s.site === selectedSite)
    );
  }, [summary.users, selectedSite]);

  const counts = useMemo(() => {
    let newCount = 0;
    let returningCount = 0;
    let humanUsersCount = 0;
    let botUsersCount = 0;
    for (const u of siteScopedUsers) {
      const isNewForView = selectedSite
        ? u.sites.find((s) => s.site === selectedSite)?.isNewOnSite ?? u.isNewUser
        : u.isNewUser;
      if (isNewForView) newCount += 1;
      else returningCount += 1;
      if (u.humanClicks > 0) humanUsersCount += 1;
      if (u.botClicks > 0) botUsersCount += 1;
    }
    return {
      newCount,
      returningCount,
      allCount: siteScopedUsers.length,
      humanUsersCount,
      botUsersCount,
    };
  }, [siteScopedUsers, selectedSite]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    const list = siteScopedUsers.filter((u) => {
      const isNewForView = selectedSite
        ? u.sites.find((s) => s.site === selectedSite)?.isNewOnSite ?? u.isNewUser
        : u.isNewUser;

      if (filterMode === 'new' && !isNewForView) return false;
      if (filterMode === 'returning' && isNewForView) return false;
      if (trafficFilter === 'human' && u.humanClicks === 0) return false;
      if (trafficFilter === 'bot' && u.botClicks === 0) return false;

      if (!q) return true;
      const inId = u.userId.toLowerCase().includes(q);
      const inName = (u.userName ?? '').toLowerCase().includes(q);
      const inCities = u.cities.some((c) => c.toLowerCase().includes(q));
      const inDevices = u.devices.some((d) => d.toLowerCase().includes(q));
      const inTime = u.lastTimeFormatted.toLowerCase().includes(q);
      const inSites = u.sites.some((s) => s.site.toLowerCase().includes(q));
      const inDays = u.days.some((d) =>
        d.dateFormatted.toLowerCase().includes(q)
      );
      return (
        inId ||
        inName ||
        inCities ||
        inDevices ||
        inTime ||
        inSites ||
        inDays
      );
    });

    const getClicksForView = (u: (typeof list)[number]) => {
      if (!selectedSite) return u.clicksInPeriod;
      return u.sites.find((s) => s.site === selectedSite)?.clicks ?? 0;
    };

    const getDaysForView = (u: (typeof list)[number]) => {
      if (!selectedSite) return u.activeDaysCount;
      return u.days.filter((d) => d.sites.includes(selectedSite)).length;
    };

    return [...list].sort((a, b) => {
      if (sortMode === 'days') {
        return (
          getDaysForView(b) - getDaysForView(a) ||
          getClicksForView(b) - getClicksForView(a)
        );
      }
      if (sortMode === 'recent') {
        return (
          b.lastTimestamp - a.lastTimestamp ||
          getClicksForView(b) - getClicksForView(a)
        );
      }
      return (
        getClicksForView(b) - getClicksForView(a) ||
        getDaysForView(b) - getDaysForView(a)
      );
    });
  }, [siteScopedUsers, filterMode, trafficFilter, sortMode, userSearch, selectedSite]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedUsers = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, safePage]);

  if (!summary.hasUserCol) {
    return (
      <section
        aria-label="Análise de usuários novos"
        className="clay-card rounded-[28px] p-8 sm:p-10 text-center max-w-2xl mx-auto"
      >
        <div className="w-14 h-14 rounded-2xl bg-[#4C8F84] text-white flex items-center justify-center clay-icon-tile mx-auto mb-4">
          <Users className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-extrabold text-[#2C221E]">
          Identifique a coluna de usuário na planilha
        </h2>
        <p className="text-xs sm:text-sm text-[#6E5F54] mt-2 leading-relaxed max-w-lg mx-auto">
          Para mostrar quantos usuários novos clicaram no total e por site, nome, cidade, aparelho, horário, quantas vezes clicou e em quais dias, selecione as colunas correspondentes.
        </p>
        <button
          type="button"
          onClick={onOpenMapping}
          className="mt-5 px-5 py-2.5 text-xs font-bold text-white clay-coral-btn rounded-2xl inline-flex items-center gap-2 cursor-pointer"
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span>Selecionar colunas</span>
        </button>
      </section>
    );
  }

  const maxSiteNewUsers = Math.max(
    1,
    ...summary.bySite.map((s) => Math.max(s.newUsers, s.uniqueUsers))
  );
  const topNewSite = summary.bySite[0];
  const newSharePct =
    summary.totalUniqueUsers > 0
      ? Math.round((summary.totalNewUsers / summary.totalUniqueUsers) * 100)
      : 0;
  const avgClicksPerNew =
    summary.totalNewUsers > 0
      ? (summary.newUserClicks / summary.totalNewUsers).toLocaleString('pt-BR', {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })
      : '0';

  const totalPeriodClicksForPct = Math.max(
    summary.totalHumanClicks + summary.totalBotClicks,
    summary.newUserClicks
  );
  const humanSharePct =
    totalPeriodClicksForPct > 0
      ? Math.round((summary.totalHumanClicks / totalPeriodClicksForPct) * 100)
      : 0;

  return (
    <div className="space-y-5">
      {/* Claymorphism KPIs */}
      <section
        aria-label="Indicadores de usuários novos e pessoas reais"
        className={`grid grid-cols-1 sm:grid-cols-2 ${
          hasVisitorData ? 'xl:grid-cols-5 gap-4' : 'xl:grid-cols-4 gap-5'
        }`}
      >
        <div className="clay-sage rounded-[24px] p-5 flex flex-col justify-between gap-4">
          <div className="w-11 h-11 rounded-2xl bg-[#4C8F84] text-white flex items-center justify-center clay-icon-tile">
            <UserPlus className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[#565A48]">
              Usuários Novos (Total)
            </p>
            <p className="text-3xl font-extrabold tracking-tight text-[#2C221E] font-mono tabular-nums mt-0.5">
              {summary.totalNewUsers.toLocaleString('pt-BR')}
            </p>
            <p className="text-xs font-semibold text-[#3B7369] mt-1 truncate tabular-nums">
              {newSharePct}% dos usuários · {periodLabel}
            </p>
          </div>
        </div>

        {hasVisitorData && onOpenRealPeople ? (
          <button
            type="button"
            onClick={onOpenRealPeople}
            className="clay-mint rounded-[24px] p-5 flex flex-col justify-between gap-4 text-left cursor-pointer hover:scale-[1.015] active:scale-[0.99] transition-transform group"
            title="Clique para ver detalhes completos das pessoas reais"
          >
            <div className="w-full flex items-start justify-between gap-2">
              <div className="w-11 h-11 rounded-2xl bg-[#278260] text-white flex items-center justify-center clay-icon-tile">
                <UserCheck className="w-5 h-5" />
              </div>
              <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-[#1E664B] bg-[#FAF7F2]/75 px-2 py-1 rounded-xl group-hover:bg-[#FAF7F2] transition-colors">
                <span>Ver quem são</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="w-full">
              <p className="text-xs font-semibold text-[#3B5E50]">
                Pessoas Reais
              </p>
              <div className="flex items-baseline gap-2 flex-wrap mt-0.5">
                <span className="text-3xl font-extrabold tracking-tight text-[#2C221E] font-mono tabular-nums">
                  {summary.totalHumanPeopleCount.toLocaleString('pt-BR')}
                </span>
                <span className="text-xs font-bold text-[#3B5E50]">
                  {summary.totalHumanPeopleCount === 1 ? 'pessoa' : 'pessoas'}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-[#FAF7F2]/80 text-[#1E664B] text-xs font-extrabold font-mono tabular-nums">
                  {summary.totalHumanClicks.toLocaleString('pt-BR')}{' '}
                  {summary.totalHumanClicks === 1 ? 'clique' : 'cliques'}
                </span>
              </div>
              <p className="text-xs font-semibold text-[#1E664B] mt-1 truncate tabular-nums">
                {humanSharePct}% dos cliques · {summary.totalBotClicks.toLocaleString('pt-BR')} robôs
              </p>
            </div>
          </button>
        ) : (
          <div className="clay-mint rounded-[24px] p-5 flex flex-col justify-between gap-4">
            <div className="w-11 h-11 rounded-2xl bg-[#278260] text-white flex items-center justify-center clay-icon-tile">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[#3B5E50]">
                Pessoas Reais
              </p>
              {hasVisitorData ? (
                <>
                  <div className="flex items-baseline gap-2 flex-wrap mt-0.5">
                    <span className="text-3xl font-extrabold tracking-tight text-[#2C221E] font-mono tabular-nums">
                      {summary.totalHumanPeopleCount.toLocaleString('pt-BR')}
                    </span>
                    <span className="text-xs font-bold text-[#3B5E50]">
                      {summary.totalHumanPeopleCount === 1 ? 'pessoa' : 'pessoas'}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-[#FAF7F2]/80 text-[#1E664B] text-xs font-extrabold font-mono tabular-nums">
                      {summary.totalHumanClicks.toLocaleString('pt-BR')}{' '}
                      {summary.totalHumanClicks === 1 ? 'clique' : 'cliques'}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-[#1E664B] mt-1 truncate tabular-nums">
                    {humanSharePct}% dos cliques · {summary.totalBotClicks.toLocaleString('pt-BR')} robôs
                  </p>
                </>
              ) : (
                <>
                  <p className="text-lg font-extrabold tracking-tight text-[#2C221E] mt-1">
                    Não mapeado
                  </p>
                  <button
                    type="button"
                    onClick={onOpenMapping}
                    className="text-xs font-bold text-[#1E664B] hover:underline mt-1 cursor-pointer text-left"
                  >
                    Mapear coluna Pessoa / Robô →
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        <div className="clay-peach rounded-[24px] p-5 flex flex-col justify-between gap-4">
          <div className="w-11 h-11 rounded-2xl bg-[#E36A42] text-white flex items-center justify-center clay-icon-tile">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[#6F4B37]">
              Usuários Únicos no Período
            </p>
            <p className="text-3xl font-extrabold tracking-tight text-[#2C221E] font-mono tabular-nums mt-0.5">
              {summary.totalUniqueUsers.toLocaleString('pt-BR')}
            </p>
            <p className="text-xs font-semibold text-[#B54B27] mt-1 truncate tabular-nums">
              {summary.totalReturningUsers.toLocaleString('pt-BR')} recorrentes
            </p>
          </div>
        </div>

        <div className="clay-butter rounded-[24px] p-5 flex flex-col justify-between gap-4">
          <div className="w-11 h-11 rounded-2xl bg-[#DE9533] text-white flex items-center justify-center clay-icon-tile">
            <MousePointerClick className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[#6C5839]">
              Cliques de Novos Usuários
            </p>
            <p className="text-3xl font-extrabold tracking-tight text-[#2C221E] font-mono tabular-nums mt-0.5">
              {summary.newUserClicks.toLocaleString('pt-BR')}
            </p>
            <p className="text-xs font-semibold text-[#9E6514] mt-1 truncate tabular-nums">
              Média de {avgClicksPerNew} cliques por novo usuário
            </p>
          </div>
        </div>

        <div className="clay-lavender rounded-[24px] p-5 flex flex-col justify-between gap-4 sm:col-span-2 xl:col-span-1">
          <div className="w-11 h-11 rounded-2xl bg-[#766BB0] text-white flex items-center justify-center clay-icon-tile">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[#55506D]">
              Site Líder em Novos
            </p>
            <p className="text-xl font-extrabold tracking-tight text-[#2C221E] truncate mt-1">
              {topNewSite ? topNewSite.site : '—'}
            </p>
            <p className="text-xs font-semibold text-[#554B8A] mt-1 truncate tabular-nums">
              {topNewSite
                ? `${topNewSite.newUsers.toLocaleString('pt-BR')} novos · ${topNewSite.uniqueUsers.toLocaleString('pt-BR')} únicos`
                : 'Sem dados no período'}
            </p>
          </div>
        </div>
      </section>

      {/* Usuários Novos por Site */}
      <section
        aria-label="Usuários novos por site"
        className="clay-card rounded-[28px] overflow-hidden"
      >
        <div className="px-6 py-5 border-b border-[#EADFD1] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[#2C221E]">
              Usuários Novos por Site
            </h2>
            <p className="text-xs text-[#6E5F54] mt-0.5">
              Quantidade de usuários novos (1º clique no site dentro do período) e total de usuários por site
            </p>
          </div>
          {selectedSite && (
            <button
              type="button"
              onClick={() => {
                onSelectSite(null);
                setPage(1);
              }}
              className="text-xs font-bold text-[#E36A42] hover:text-[#B54B27] cursor-pointer whitespace-nowrap"
            >
              Ver todos os sites
            </button>
          )}
        </div>

        {summary.bySite.length === 0 ? (
          <div className="py-10 text-center text-xs text-[#6E5F54]">
            Nenhum site com cliques neste período.
          </div>
        ) : (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {summary.bySite.map((siteRow) => {
              const colorIdx = siteColorIndexMap.get(siteRow.site) ?? 0;
              const theme = getSiteColorTheme(colorIdx);
              const isSelected = selectedSite === siteRow.site;
              const isDimmed = selectedSite !== null && !isSelected;
              const barPct =
                siteRow.newUsers > 0
                  ? Math.max(
                      6,
                      Math.round((siteRow.newUsers / maxSiteNewUsers) * 100)
                    )
                  : 0;

              return (
                <button
                  key={siteRow.site}
                  type="button"
                  onClick={() => {
                    onSelectSite(isSelected ? null : siteRow.site);
                    setPage(1);
                  }}
                  className={`p-4 rounded-2xl text-left transition-all cursor-pointer border ${
                    isSelected
                      ? `${theme.softBgClass} border-[#D6BFA9] shadow-inner`
                      : 'bg-[#FAF4EA]/60 border-[#EFE5D8] hover:bg-[#F6EFE4]'
                  } ${isDimmed ? 'opacity-50 hover:opacity-90' : 'opacity-100'}`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-sm font-bold text-[#2C221E] truncate">
                      {siteRow.site}
                    </span>
                    <span
                      className={`text-sm font-extrabold font-mono tabular-nums shrink-0 ${theme.textClass}`}
                    >
                      {siteRow.newUsers.toLocaleString('pt-BR')} novos
                    </span>
                  </div>

                  <div className="w-full h-2 rounded-full bg-[#EDE4D8] overflow-hidden mb-2.5">
                    {barPct > 0 && (
                      <div
                        className={`h-full rounded-full transition-all ${theme.barClass}`}
                        style={{ width: `${barPct}%` }}
                      />
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-[#6E5F54] tabular-nums">
                    <span>
                      {siteRow.uniqueUsers.toLocaleString('pt-BR')} únicos ·{' '}
                      {siteRow.returningUsers.toLocaleString('pt-BR')} recorrentes
                    </span>
                    <span>
                      {siteRow.newUserClicks.toLocaleString('pt-BR')} cliques
                    </span>
                  </div>
                  {hasVisitorData && (
                    <div className="mt-2 pt-2 border-t border-[#EADFD1]/70 flex items-center justify-between text-[11px] tabular-nums">
                      <span className="inline-flex items-center gap-1 font-bold text-[#1E664B]">
                        <UserCheck className="w-3 h-3" />
                        {siteRow.humanClicks.toLocaleString('pt-BR')} pessoas reais
                      </span>
                      <span className="font-semibold text-[#8F2D22]">
                        {siteRow.botClicks.toLocaleString('pt-BR')} robôs
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Detalhamento por Usuário: Nome, Cidade, Horário, Aparelho, Cliques e Dias */}
      <section
        aria-label="Cliques e dias por usuário"
        className="clay-card rounded-[28px] overflow-hidden"
      >
        <div className="px-6 py-5 border-b border-[#EADFD1] flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-[#2C221E]">
                Cliques, Nome, Cidade, Aparelho e Dias
                {selectedSite ? ` · ${selectedSite}` : ''}
              </h2>
              <p className="text-xs text-[#6E5F54] mt-0.5">
                Veja quantas vezes cada usuário clicou, cidade, aparelho, horário e dias · Clique no usuário para expandir tudo
              </p>
            </div>

            <div className="inline-flex items-center rounded-2xl bg-[#EFE6D8] p-1 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => {
                  setFilterMode('new');
                  setPage(1);
                }}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer tabular-nums ${
                  filterMode === 'new'
                    ? 'clay-button-active text-[#2C221E]'
                    : 'text-[#6E5F54] hover:text-[#2C221E]'
                }`}
              >
                Novos ({counts.newCount.toLocaleString('pt-BR')})
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilterMode('all');
                  setPage(1);
                }}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer tabular-nums ${
                  filterMode === 'all'
                    ? 'clay-button-active text-[#2C221E]'
                    : 'text-[#6E5F54] hover:text-[#2C221E]'
                }`}
              >
                Todos ({counts.allCount.toLocaleString('pt-BR')})
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilterMode('returning');
                  setPage(1);
                }}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer tabular-nums ${
                  filterMode === 'returning'
                    ? 'clay-button-active text-[#2C221E]'
                    : 'text-[#6E5F54] hover:text-[#2C221E]'
                }`}
              >
                Recorrentes ({counts.returningCount.toLocaleString('pt-BR')})
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 min-w-[220px] sm:max-w-sm">
              <Search className="w-3.5 h-3.5 text-[#8C7A6B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => {
                  setUserSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Buscar nome, cidade, aparelho, site ou dia..."
                className="w-full pl-8 pr-3 py-2 text-xs rounded-2xl clay-input border border-[#EADFD1] text-[#2C221E] placeholder:text-[#9A897A] focus:outline-none focus:ring-2 focus:ring-[#E36A42]"
              />
            </div>

            <select
              aria-label="Ordenar usuários"
              value={sortMode}
              onChange={(e) => {
                setSortMode(e.target.value as UserSortMode);
                setPage(1);
              }}
              className="px-3.5 py-2 text-xs font-bold rounded-2xl clay-input border border-[#EADFD1] text-[#4A3B31] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#E36A42]"
            >
              <option value="clicks">Mais cliques</option>
              <option value="days">Mais dias ativos</option>
              <option value="recent">Último clique</option>
            </select>

            {hasVisitorData && (
              <div className="inline-flex items-center rounded-2xl bg-[#EFE6D8] p-1">
                <button
                  type="button"
                  onClick={() => {
                    setTrafficFilter('all');
                    setPage(1);
                  }}
                  className={`px-2.5 py-1.5 text-[11px] font-bold rounded-xl transition-all cursor-pointer tabular-nums ${
                    trafficFilter === 'all'
                      ? 'clay-button-active text-[#2C221E]'
                      : 'text-[#6E5F54] hover:text-[#2C221E]'
                  }`}
                >
                  Todos ({counts.allCount.toLocaleString('pt-BR')})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTrafficFilter('human');
                    setPage(1);
                  }}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-xl transition-all cursor-pointer tabular-nums ${
                    trafficFilter === 'human'
                      ? 'clay-button-active text-[#1E664B]'
                      : 'text-[#6E5F54] hover:text-[#1E664B]'
                  }`}
                >
                  <UserCheck className="w-3 h-3" />
                  <span>Pessoas reais ({counts.humanUsersCount.toLocaleString('pt-BR')})</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTrafficFilter('bot');
                    setPage(1);
                  }}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-xl transition-all cursor-pointer tabular-nums ${
                    trafficFilter === 'bot'
                      ? 'clay-button-active text-[#8F2D22]'
                      : 'text-[#6E5F54] hover:text-[#8F2D22]'
                  }`}
                >
                  <Bot className="w-3 h-3" />
                  <span>Robôs ({counts.botUsersCount.toLocaleString('pt-BR')})</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {pagedUsers.length === 0 ? (
          <div className="py-12 px-6 text-center space-y-2.5">
            <p className="text-xs font-semibold text-[#5E4E42]">
              Nenhum usuário encontrado para este filtro.
            </p>
            {filterMode === 'new' && counts.allCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setFilterMode('all');
                  setPage(1);
                }}
                className="px-4 py-2 text-xs font-bold rounded-2xl clay-button-active text-[#E36A42] cursor-pointer"
              >
                Mostrar todos os {counts.allCount.toLocaleString('pt-BR')} usuários do período
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-[#EFE5D8]">
            {pagedUsers.map((u) => {
              const isExpanded = expandedUserId === u.userId;
              const isNewForView = selectedSite
                ? u.sites.find((s) => s.site === selectedSite)?.isNewOnSite ??
                  u.isNewUser
                : u.isNewUser;

              const relevantDays = selectedSite
                ? u.days.filter((d) => d.sites.includes(selectedSite))
                : u.days;

              const clicksForView = selectedSite
                ? u.sites.find((s) => s.site === selectedSite)?.clicks ?? 0
                : u.clicksInPeriod;

              const showDistinctId =
                u.userName && u.userName.toLowerCase() !== u.userId.toLowerCase();

              return (
                <div key={u.userId} className="transition-colors">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedUserId((prev) =>
                        prev === u.userId ? null : u.userId
                      )
                    }
                    className={`w-full px-6 py-4 text-left flex flex-col lg:flex-row lg:items-center justify-between gap-3 cursor-pointer ${
                      isExpanded ? 'bg-[#FAF2E7]' : 'hover:bg-[#F7EFE4]'
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-extrabold text-[#2C221E] break-all">
                          {u.userName ?? u.userId}
                        </span>
                        {showDistinctId && (
                          <span className="text-[11px] font-mono text-[#6E5F54] bg-[#EFE6D8] px-2 py-0.5 rounded-lg">
                            {u.userId}
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded-lg text-[11px] font-bold ${
                            isNewForView
                              ? 'bg-[#DDF0EA] text-[#2F6A5E]'
                              : 'bg-[#E4E0EF] text-[#554B8A]'
                          }`}
                        >
                          {isNewForView ? 'Novo' : 'Recorrente'}
                        </span>
                        {hasVisitorData && u.visitorType !== 'unknown' && (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold ${
                              u.visitorType === 'human'
                                ? 'bg-[#D9ECE4] text-[#1E664B]'
                                : u.visitorType === 'bot'
                                ? 'bg-[#FDE4E1] text-[#8F2D22]'
                                : 'bg-[#F3ECE2] text-[#5E4E42]'
                            }`}
                          >
                            {u.visitorType === 'bot' ? (
                              <Bot className="w-3 h-3" />
                            ) : (
                              <UserCheck className="w-3 h-3" />
                            )}
                            {u.visitorType === 'human'
                              ? 'Pessoa real'
                              : u.visitorType === 'bot'
                              ? 'Robô'
                              : `Misto (${u.humanClicks} real · ${u.botClicks} robô)`}
                          </span>
                        )}
                        <span className="text-[11px] text-[#6E5F54] tabular-nums">
                          1º clique: {u.firstDateFormatted}
                        </span>
                      </div>

                      {/* Cidade, Aparelho, Último Horário */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#4A3B31]">
                        {u.cities.length > 0 && (
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-[#E36A42] shrink-0" />
                            <span className="font-semibold">
                              {u.cities.join(', ')}
                            </span>
                          </span>
                        )}
                        {u.devices.length > 0 && (
                          <span className="inline-flex items-center gap-1.5">
                            <Smartphone className="w-3.5 h-3.5 text-[#766BB0] shrink-0" />
                            <span className="font-semibold">
                              {u.devices.join(', ')}
                            </span>
                          </span>
                        )}
                        {u.lastTimeFormatted !== '—' && (
                          <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
                            <Clock className="w-3.5 h-3.5 text-[#4C8F84] shrink-0" />
                            <span>Último às {u.lastTimeFormatted}</span>
                          </span>
                        )}
                      </div>

                      {/* Sites clicados */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                        {u.sites.map((s) => {
                          const cIdx = siteColorIndexMap.get(s.site) ?? 0;
                          const theme = getSiteColorTheme(cIdx);
                          return (
                            <span
                              key={s.site}
                              className={`px-2 py-0.5 rounded-lg font-semibold ${theme.softBgClass} ${theme.textClass}`}
                            >
                              {s.site} ({s.clicks}x)
                            </span>
                          );
                        })}
                      </div>

                      {/* Dias em que clicou */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#5E4E42]">
                        <Calendar className="w-3.5 h-3.5 text-[#8C7A6B] shrink-0" />
                        <span className="font-semibold">Dias:</span>
                        {relevantDays.slice(0, 5).map((d) => {
                          const dayClicks = selectedSite
                            ? d.events
                                .filter((ev) => ev.site === selectedSite)
                                .reduce((acc, ev) => acc + ev.clicks, 0)
                            : d.clicks;
                          return (
                            <span
                              key={d.dayKey}
                              className="px-2 py-0.5 rounded-lg bg-[#EFE6D8] font-mono tabular-nums text-[#2C221E]"
                            >
                              {d.dateFormatted} ({dayClicks}x)
                            </span>
                          );
                        })}
                        {relevantDays.length > 5 && (
                          <span className="text-[#8C7A6B] font-semibold">
                            +{relevantDays.length - 5} dias
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between lg:justify-end gap-5 shrink-0 pt-1 lg:pt-0">
                      <div className="text-left lg:text-right tabular-nums">
                        <p className="text-base font-extrabold font-mono text-[#E36A42]">
                          {clicksForView.toLocaleString('pt-BR')}{' '}
                          {clicksForView === 1 ? 'clique' : 'cliques'}
                        </p>
                        <p className="text-[11px] text-[#6E5F54]">
                          em {relevantDays.length}{' '}
                          {relevantDays.length === 1 ? 'dia' : 'dias'}
                          {!selectedSite &&
                          u.totalHistoricClicks > u.clicksInPeriod
                            ? ` · ${u.totalHistoricClicks} no total`
                            : ''}
                        </p>
                      </div>
                      <span className="p-1.5 rounded-xl clay-card text-[#5E4E42]">
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-6 pb-5 pt-2 bg-[#FAF2E7] border-t border-[#EADFD1]/70 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#5E4E42]">
                        <span>
                          Histórico completo na planilha:{' '}
                          <strong className="font-mono">
                            {u.totalHistoricClicks.toLocaleString('pt-BR')}{' '}
                            cliques
                          </strong>{' '}
                          em{' '}
                          <strong className="font-mono">
                            {u.totalHistoricDaysCount} dias
                          </strong>
                        </span>
                        <span className="text-[11px] text-[#6E5F54]">
                          Clique em qualquer linha abaixo para abrir o registro original
                        </span>
                      </div>

                      <div className="space-y-2.5">
                        {relevantDays.map((day) => {
                          const dayEvents = selectedSite
                            ? day.events.filter((e) => e.site === selectedSite)
                            : day.events;
                          const dayClicks = dayEvents.reduce(
                            (acc, e) => acc + e.clicks,
                            0
                          );
                          return (
                            <div
                              key={day.dayKey}
                              className="rounded-2xl bg-[#FDF9F2] border border-[#EADFD1] overflow-hidden"
                            >
                              <div className="px-4 py-2.5 bg-[#F5ECE0] flex items-center justify-between text-xs">
                                <span className="font-bold font-mono text-[#2C221E] inline-flex items-center gap-1.5">
                                  <Calendar className="w-3.5 h-3.5 text-[#E36A42]" />
                                  {day.dateFormatted}
                                </span>
                                <span className="font-extrabold font-mono tabular-nums text-[#B54B27]">
                                  {dayClicks.toLocaleString('pt-BR')}{' '}
                                  {dayClicks === 1 ? 'clique' : 'cliques'}
                                </span>
                              </div>
                              <div className="divide-y divide-[#EFE5D8]">
                                {dayEvents.map((ev) => {
                                  const evTheme = getSiteColorTheme(
                                    siteColorIndexMap.get(ev.site) ?? 0
                                  );
                                  return (
                                    <button
                                      key={ev.rowIndex}
                                      type="button"
                                      onClick={() => onInspectRow(ev.rawRow)}
                                      className="w-full px-4 py-2.5 text-left text-xs hover:bg-[#FAF4EA] flex flex-wrap items-center justify-between gap-2 cursor-pointer"
                                    >
                                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0 flex-1">
                                        <span className="font-mono font-bold tabular-nums text-[#2C221E] shrink-0">
                                          {ev.timeFormatted}
                                        </span>
                                        <span
                                          className={`font-bold shrink-0 ${evTheme.textClass}`}
                                        >
                                          {ev.site}
                                        </span>
                                        <span
                                          className="font-mono text-[#4A3B31] truncate max-w-[260px]"
                                          title={ev.page}
                                        >
                                          {ev.page}
                                        </span>
                                        {ev.city && (
                                          <span className="inline-flex items-center gap-1 text-[11px] text-[#5E4E42] bg-[#F3E9DB] px-2 py-0.5 rounded-lg">
                                            <MapPin className="w-3 h-3 text-[#E36A42]" />
                                            {ev.city}
                                          </span>
                                        )}
                                        {ev.device && (
                                          <span className="inline-flex items-center gap-1 text-[11px] text-[#5E4E42] bg-[#EAE6F3] px-2 py-0.5 rounded-lg">
                                            <Smartphone className="w-3 h-3 text-[#766BB0]" />
                                            {ev.device}
                                          </span>
                                        )}
                                        {hasVisitorData && ev.visitorType !== 'unknown' && (
                                          <span
                                            className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg ${
                                              ev.visitorType === 'human'
                                                ? 'bg-[#D9ECE4] text-[#1E664B]'
                                                : 'bg-[#FDE4E1] text-[#8F2D22]'
                                            }`}
                                          >
                                            {ev.visitorType === 'human' ? (
                                              <>
                                                <UserCheck className="w-3 h-3" />
                                                <span>Pessoa real</span>
                                              </>
                                            ) : (
                                              <>
                                                <Bot className="w-3 h-3" />
                                                <span>Robô</span>
                                              </>
                                            )}
                                          </span>
                                        )}
                                      </div>
                                      <span className="font-mono font-bold tabular-nums text-[#2C221E] shrink-0">
                                        {ev.clicks}x
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {filteredUsers.length > pageSize && (
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
    </div>
  );
};
