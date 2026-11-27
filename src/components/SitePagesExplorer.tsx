import React from 'react';
import { UserCheck } from 'lucide-react';
import { PageAggregate, SiteAggregate } from '../types/sheets';
import { getSiteColorTheme } from '../utils/siteColors';

interface SitePagesExplorerProps {
  sites: SiteAggregate[];
  pages: PageAggregate[];
  siteColorIndexMap: Map<string, number>;
  selectedSite: string | null;
  selectedPage: string | null;
  onSelectSite: (site: string | null) => void;
  onSelectPage: (page: string | null) => void;
  hasUserCol?: boolean;
  hasVisitorTypeCol?: boolean;
}

export const SitePagesExplorer: React.FC<SitePagesExplorerProps> = ({
  sites,
  pages,
  siteColorIndexMap,
  selectedSite,
  selectedPage,
  onSelectSite,
  onSelectPage,
  hasUserCol = false,
  hasVisitorTypeCol = false,
}) => {
  const maxSiteClicks = Math.max(1, ...sites.map((s) => s.clicks));
  const maxPageClicks = Math.max(1, ...pages.map((p) => p.clicks));

  const selectedTheme = selectedSite
    ? getSiteColorTheme(siteColorIndexMap.get(selectedSite) ?? 0)
    : getSiteColorTheme(0);

  return (
    <section
      id="sites-paginas"
      aria-label="Cliques por site e páginas"
      className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch"
    >
      {/* Left: Cliques por Site */}
      <div className="lg:col-span-5 clay-card rounded-[28px] flex flex-col overflow-hidden">
        <div className="px-6 py-5 border-b border-[#EADFD1] flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[#2C221E]">
              Cliques por Site
            </h2>
            <p className="text-xs text-[#6E5F54] mt-0.5">
              Clique em um site para detalhar as páginas
            </p>
          </div>
          {selectedSite && (
            <button
              type="button"
              onClick={() => {
                onSelectSite(null);
                onSelectPage(null);
              }}
              className="text-xs font-bold text-[#E36A42] hover:text-[#B54B27] cursor-pointer whitespace-nowrap"
            >
              Ver todos
            </button>
          )}
        </div>

        {sites.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#6E5F54]">
            Nenhum site com cliques neste período.
          </div>
        ) : (
          <div className="p-4 space-y-2 max-h-[430px] overflow-y-auto clay-scrollbar">
            {sites.map((site) => {
              const colorIdx = siteColorIndexMap.get(site.site) ?? 0;
              const theme = getSiteColorTheme(colorIdx);
              const isSelected = selectedSite === site.site;
              const isDimmed = selectedSite !== null && !isSelected;
              const barPct = Math.max(
                4,
                Math.round((site.clicks / maxSiteClicks) * 100)
              );

              return (
                <button
                  key={site.site}
                  type="button"
                  onClick={() => {
                    if (isSelected) {
                      onSelectSite(null);
                      onSelectPage(null);
                    } else {
                      onSelectSite(site.site);
                      onSelectPage(null);
                    }
                  }}
                  className={`w-full p-4 rounded-2xl text-left transition-all cursor-pointer ${
                    isSelected
                      ? `${theme.softBgClass} shadow-inner`
                      : 'hover:bg-[#F6EFE4]'
                  } ${isDimmed ? 'opacity-50 hover:opacity-90' : 'opacity-100'}`}
                >
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <span className="text-sm font-bold text-[#2C221E] truncate">
                      {site.site}
                    </span>
                    <span
                      className={`text-base font-extrabold font-mono tabular-nums shrink-0 ${theme.textClass}`}
                    >
                      {site.clicks.toLocaleString('pt-BR')}
                    </span>
                  </div>

                  <div className="w-full h-2.5 rounded-full bg-[#EDE4D8] overflow-hidden mb-2">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${theme.barClass}`}
                      style={{ width: `${barPct}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2 flex-wrap text-xs text-[#6E5F54] tabular-nums">
                    <span className="flex items-center gap-1.5 flex-wrap">
                      <span>
                        {site.uniquePages}{' '}
                        {site.uniquePages === 1 ? 'página' : 'páginas'}
                        {hasUserCol
                          ? ` · ${site.newUsers.toLocaleString('pt-BR')} novos`
                          : ` · ${site.sharePct.toFixed(0)}%`}
                      </span>
                      {hasVisitorTypeCol && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#D9ECE4] text-[#1E664B] font-bold text-[11px]">
                          <UserCheck className="w-3 h-3" />
                          <span>
                            {site.humanPeopleCount.toLocaleString('pt-BR')}{' '}
                            {site.humanPeopleCount === 1 ? 'pessoa' : 'pessoas'} ·{' '}
                            {site.humanClicks.toLocaleString('pt-BR')}{' '}
                            {site.humanClicks === 1 ? 'clique' : 'cliques'}
                            {site.botClicks > 0
                              ? ` · ${site.botClicks.toLocaleString('pt-BR')} ${
                                  site.botClicks === 1 ? 'robô' : 'robôs'
                                }`
                              : ''}
                          </span>
                        </span>
                      )}
                    </span>
                    <span>
                      {site.lastTimeFormatted !== '—'
                        ? `Último às ${site.lastTimeFormatted}`
                        : site.lastDateFormatted}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Right: Páginas Clicadas */}
      <div className="lg:col-span-7 clay-card rounded-[28px] flex flex-col overflow-hidden">
        <div className="px-6 py-5 border-b border-[#EADFD1] flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-[#2C221E] truncate">
              {selectedSite
                ? `Páginas de ${selectedSite}`
                : 'Páginas Mais Clicadas'}
            </h2>
            <p className="text-xs text-[#6E5F54] mt-0.5 tabular-nums">
              {pages.length}{' '}
              {pages.length === 1 ? 'página clicada' : 'páginas clicadas'}
            </p>
          </div>
          {selectedPage && (
            <button
              type="button"
              onClick={() => onSelectPage(null)}
              className="text-xs font-bold text-[#E36A42] hover:text-[#B54B27] cursor-pointer whitespace-nowrap shrink-0"
            >
              Ver todas as páginas
            </button>
          )}
        </div>

        {pages.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#6E5F54]">
            Nenhuma página encontrada neste recorte.
          </div>
        ) : (
          <div className="p-4 space-y-2 max-h-[430px] overflow-y-auto clay-scrollbar">
            {pages.map((p, idx) => {
              const colorIdx = siteColorIndexMap.get(p.site) ?? 0;
              const pageTheme = selectedSite
                ? selectedTheme
                : getSiteColorTheme(colorIdx);
              const isSelected = selectedPage === p.page;
              const isDimmed = selectedPage !== null && !isSelected;
              const barPct = Math.max(
                4,
                Math.round((p.clicks / maxPageClicks) * 100)
              );

              return (
                <button
                  key={`${p.site}|||${p.page}|||${idx}`}
                  type="button"
                  onClick={() => {
                    if (!selectedSite) {
                      onSelectSite(p.site);
                    }
                    onSelectPage(isSelected ? null : p.page);
                  }}
                  className={`w-full p-4 rounded-2xl text-left transition-all cursor-pointer ${
                    isSelected
                      ? `${pageTheme.softBgClass} shadow-inner`
                      : 'hover:bg-[#F6EFE4]'
                  } ${isDimmed ? 'opacity-50 hover:opacity-90' : 'opacity-100'}`}
                >
                  <div className="flex items-center justify-between gap-4 mb-2">
                    <div className="min-w-0">
                      <p
                        className="text-sm font-bold text-[#2C221E] truncate font-mono"
                        title={p.page}
                      >
                        {p.page}
                      </p>
                      {!selectedSite && (
                        <p
                          className={`text-xs font-semibold mt-0.5 ${pageTheme.textClass}`}
                        >
                          {p.site}
                        </p>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`text-base font-extrabold font-mono tabular-nums ${pageTheme.textClass}`}
                      >
                        {p.clicks.toLocaleString('pt-BR')}x
                      </span>
                    </div>
                  </div>

                  <div className="w-full h-2 rounded-full bg-[#EDE4D8] overflow-hidden mb-2">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${pageTheme.barClass}`}
                      style={{ width: `${barPct}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2 flex-wrap text-xs text-[#6E5F54] tabular-nums">
                    <span className="flex items-center gap-1.5 flex-wrap">
                      <span>
                        {p.peakHour !== null
                          ? `Pico às ${String(p.peakHour).padStart(2, '0')}h`
                          : `${p.sharePct.toFixed(0)}% dos cliques`}
                      </span>
                      {hasVisitorTypeCol && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#D9ECE4] text-[#1E664B] font-bold text-[11px]">
                          <UserCheck className="w-3 h-3" />
                          <span>
                            {p.humanPeopleCount.toLocaleString('pt-BR')}{' '}
                            {p.humanPeopleCount === 1 ? 'pessoa' : 'pessoas'} ·{' '}
                            {p.humanClicks.toLocaleString('pt-BR')}{' '}
                            {p.humanClicks === 1 ? 'clique' : 'cliques'}
                            {p.botClicks > 0
                              ? ` · ${p.botClicks.toLocaleString('pt-BR')} ${
                                  p.botClicks === 1 ? 'robô' : 'robôs'
                                }`
                              : ''}
                          </span>
                        </span>
                      )}
                    </span>
                    <span>
                      Último: {p.lastDateFormatted}
                      {p.lastTimeFormatted !== '—'
                        ? ` · ${p.lastTimeFormatted}`
                        : ''}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
