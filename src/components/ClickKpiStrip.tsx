import React, { useMemo } from 'react';
import { Clock, FileText, Globe, MousePointerClick } from 'lucide-react';
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
}

export const ClickKpiStrip: React.FC<ClickKpiStripProps> = ({
  events,
  allEventsCount,
  sites,
  pages,
  hourlyBuckets,
  periodLabel,
}) => {
  const totalClicks = useMemo(
    () => events.reduce((acc, e) => acc + e.clicks, 0),
    [events]
  );

  const shareOfAll =
    allEventsCount > 0 ? Math.round((totalClicks / allEventsCount) * 100) : 0;

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
      className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5"
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

      {/* Card 2: Peach Blush + Coral 3D Icon */}
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

      {/* Card 3: Warm Butter + Amber 3D Icon */}
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

      {/* Card 4: Soft Lavender + Plum 3D Icon */}
      <div className="clay-lavender rounded-[24px] p-5 flex flex-col justify-between gap-4">
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
