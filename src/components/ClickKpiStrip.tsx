import React, { useMemo } from 'react';
import {
  ChevronRight,
  Clock,
  FileText,
  Globe,
  MousePointerClick,
  UserCheck,
} from 'lucide-react';
import {
  ClickEventRecord,
  HourlyBucket,
  PageAggregate,
  SiteAggregate,
} from '../types/sheets';

interface ClickKpiStripProps {
  events: ClickEventRecord[];
  allEventsCount: number;
  sites: SiteAggregate[];
  pages: PageAggregate[];
  hourlyBuckets: HourlyBucket[];
  periodLabel: string;
  hasVisitorTypeCol?: boolean;
  onOpenMapping?: () => void;
  onOpenRealPeople?: () => void;
}

export const ClickKpiStrip: React.FC<ClickKpiStripProps> = ({
  events,
  allEventsCount,
  sites,
  pages,
  hourlyBuckets,
  periodLabel,
  hasVisitorTypeCol = false,
  onOpenMapping,
  onOpenRealPeople,
}) => {
  const { totalClicks, humanClicks, botClicks, realPeopleCount } = useMemo(() => {
    let total = 0;
    let human = 0;
    let bot = 0;
    const people = new Set<string>();
    for (const e of events) {
      total += e.clicks;
      if (e.visitorType === 'human') {
        human += e.clicks;
        const key =
          e.userId || e.userName
            ? `u:${e.userId || e.userName}`
            : `row:${e.rowIndex}`;
        people.add(key);
      } else if (e.visitorType === 'bot') {
        bot += e.clicks;
      }
    }
    return {
      totalClicks: total,
      humanClicks: human,
      botClicks: bot,
      realPeopleCount: people.size,
    };
  }, [events]);

  const shareOfAll =
    allEventsCount > 0 ? Math.round((totalClicks / allEventsCount) * 100) : 0;

  const humanSharePct =
    totalClicks > 0 ? Math.round((humanClicks / totalClicks) * 100) : 0;

  const topSite = sites[0];
  const topPage = pages[0];

  const peakHourBucket = useMemo(() => {
    let best: HourlyBucket | null = null;
    for (const b of hourlyBuckets) {
      if (b.clicks > 0 && (!best || b.clicks > best.clicks)) {
        best = b;
      }
    }
    return best;
  }, [hourlyBuckets]);

  return (
    <section
      aria-label="Indicadores principais"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4"
    >
      {/* Card 1: Sage Cream + Teal 3D Icon */}
      <div className="clay-sage rounded-[24px] p-5 flex flex-col justify-between gap-4">
        <div className="w-11 h-11 rounded-2xl bg-[#4C8F84] text-white flex items-center justify-center clay-icon-tile">
          <MousePointerClick className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs font-semibold text-[#565A48]">
            Total de Cliques
          </p>
          <p className="text-3xl font-extrabold tracking-tight text-[#2C221E] font-mono tabular-nums mt-0.5">
            {totalClicks.toLocaleString('pt-BR')}
          </p>
          <p className="text-xs font-semibold text-[#3B7369] mt-1 truncate tabular-nums">
            {shareOfAll}% do total · {periodLabel}
          </p>
        </div>
      </div>

      {/* Card 2: Soft Mint + Emerald 3D Icon (Clickable Real People + Clicks right next to Total Clicks) */}
      {hasVisitorTypeCol && onOpenRealPeople ? (
        <button
          type="button"
          onClick={onOpenRealPeople}
          className="clay-mint rounded-[24px] p-5 flex flex-col justify-between gap-4 text-left cursor-pointer hover:scale-[1.015] active:scale-[0.99] transition-transform group"
          title="Clique para ver quais pessoas reais clicaram, sites, páginas, horários e cidades"
        >
          <div className="w-full flex items-start justify-between gap-2">
            <div className="w-11 h-11 rounded-2xl bg-[#2F8F6B] text-white flex items-center justify-center clay-icon-tile">
              <UserCheck className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-[#1E664B] bg-[#FAF7F2]/75 px-2.5 py-1 rounded-xl group-hover:bg-[#FAF7F2] transition-colors">
              <span>Ver quem são</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="w-full">
            <p className="text-xs font-semibold text-[#395E50]">
              Pessoas Reais
            </p>
            <div className="flex items-baseline gap-2 flex-wrap mt-0.5">
              <span className="text-3xl font-extrabold tracking-tight text-[#2C221E] font-mono tabular-nums">
                {realPeopleCount.toLocaleString('pt-BR')}
              </span>
              <span className="text-xs font-bold text-[#395E50]">
                {realPeopleCount === 1 ? 'pessoa' : 'pessoas'}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-[#FAF7F2]/80 text-[#1E664B] text-xs font-extrabold font-mono tabular-nums">
                {humanClicks.toLocaleString('pt-BR')}{' '}
                {humanClicks === 1 ? 'clique' : 'cliques'}
              </span>
            </div>
            <p className="text-xs font-semibold text-[#237053] mt-1 truncate tabular-nums">
              {humanSharePct}% dos cliques ·{' '}
              {botClicks.toLocaleString('pt-BR')}{' '}
              {botClicks === 1 ? 'robô' : 'robôs'}
            </p>
          </div>
        </button>
      ) : (
        <div className="clay-mint rounded-[24px] p-5 flex flex-col justify-between gap-4">
          <div className="w-11 h-11 rounded-2xl bg-[#2F8F6B] text-white flex items-center justify-center clay-icon-tile">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[#395E50]">
              Pessoas Reais
            </p>
            {hasVisitorTypeCol ? (
              <>
                <div className="flex items-baseline gap-2 flex-wrap mt-0.5">
                  <span className="text-3xl font-extrabold tracking-tight text-[#2C221E] font-mono tabular-nums">
                    {realPeopleCount.toLocaleString('pt-BR')}
                  </span>
                  <span className="text-xs font-bold text-[#395E50]">
                    {realPeopleCount === 1 ? 'pessoa' : 'pessoas'}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-[#FAF7F2]/80 text-[#1E664B] text-xs font-extrabold font-mono tabular-nums">
                    {humanClicks.toLocaleString('pt-BR')}{' '}
                    {humanClicks === 1 ? 'clique' : 'cliques'}
                  </span>
                </div>
                <p className="text-xs font-semibold text-[#237053] mt-1 truncate tabular-nums">
                  {humanSharePct}% dos cliques ·{' '}
                  {botClicks.toLocaleString('pt-BR')}{' '}
                  {botClicks === 1 ? 'robô' : 'robôs'}
                </p>
              </>
            ) : (
              <>
                <p className="text-3xl font-extrabold tracking-tight text-[#2C221E] font-mono tabular-nums mt-0.5">
                  —
                </p>
                {onOpenMapping ? (
                  <button
                    type="button"
                    onClick={onOpenMapping}
                    className="text-xs font-bold text-[#237053] hover:text-[#18523C] underline mt-1 cursor-pointer text-left"
                  >
                    Mapear coluna Pessoa/Robô
                  </button>
                ) : (
                  <p className="text-xs font-semibold text-[#395E50] mt-1 truncate">
                    Coluna não identificada
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Card 3: Peach Blush + Coral 3D Icon */}
      <div className="clay-peach rounded-[24px] p-5 flex flex-col justify-between gap-4">
        <div className="w-11 h-11 rounded-2xl bg-[#E36A42] text-white flex items-center justify-center clay-icon-tile">
          <Globe className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs font-semibold text-[#6F4B37]">
            Sites com Cliques
          </p>
          <p className="text-3xl font-extrabold tracking-tight text-[#2C221E] font-mono tabular-nums mt-0.5">
            {sites.length.toLocaleString('pt-BR')}
          </p>
          <p className="text-xs font-semibold text-[#B54B27] mt-1 truncate">
            {topSite ? `Líder: ${topSite.site}` : 'Nenhum site no período'}
          </p>
        </div>
      </div>

      {/* Card 4: Warm Butter + Amber 3D Icon */}
      <div className="clay-butter rounded-[24px] p-5 flex flex-col justify-between gap-4">
        <div className="w-11 h-11 rounded-2xl bg-[#DE9533] text-white flex items-center justify-center clay-icon-tile">
          <FileText className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs font-semibold text-[#6C5839]">
            Páginas Clicadas
          </p>
          <p className="text-3xl font-extrabold tracking-tight text-[#2C221E] font-mono tabular-nums mt-0.5">
            {pages.length.toLocaleString('pt-BR')}
          </p>
          <p className="text-xs font-semibold text-[#9E6514] mt-1 truncate">
            {topPage ? `Top: ${topPage.page}` : 'Nenhuma página no período'}
          </p>
        </div>
      </div>

      {/* Card 5: Soft Lavender + Plum 3D Icon */}
      <div className="clay-lavender rounded-[24px] p-5 flex flex-col justify-between gap-4 sm:col-span-2 lg:col-span-1">
        <div className="w-11 h-11 rounded-2xl bg-[#766BB0] text-white flex items-center justify-center clay-icon-tile">
          <Clock className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs font-semibold text-[#55506D]">
            Horário de Pico
          </p>
          <p className="text-3xl font-extrabold tracking-tight text-[#2C221E] font-mono tabular-nums mt-0.5">
            {peakHourBucket
              ? `${String(peakHourBucket.hour).padStart(2, '0')}h00`
              : '—'}
          </p>
          <p className="text-xs font-semibold text-[#554B8A] mt-1 truncate tabular-nums">
            {peakHourBucket
              ? `${peakHourBucket.clicks.toLocaleString('pt-BR')} cliques neste horário`
              : 'Sem horário registrado'}
          </p>
        </div>
      </div>
    </section>
  );
};
