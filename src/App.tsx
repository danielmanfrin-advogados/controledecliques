import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  Calendar,
  Clock,
  ExternalLink,
  FolderOpen,
  Globe,
  Home,
  ListOrdered,
  LogOut,
  Menu,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Table2,
  X,
} from 'lucide-react';
import {
  clearCachedToken,
  getAccessToken,
  googleSignIn,
  initAuth,
  logout,
} from './services/firebaseAuth';
import {
  getSheetValues,
  getSpreadsheetMetadata,
  SheetRawValues,
} from './services/googleSheetsApi';
import {
  ClickColumnMapping,
  ParsedRow,
  ParsedSheetDataset,
  PeriodPreset,
  SpreadsheetMetadata,
  SyncDiffSummary,
  SyncIntervalSeconds,
} from './types/sheets';
import {
  aggregateByHour,
  aggregateBySite,
  aggregatePages,
  aggregateTimelineForPeriod,
  buildClickEvents,
  buildParsedDataset,
  computeDatasetDiff,
  filterClickEvents,
  getPeriodBounds,
  inferClickColumnMapping,
} from './utils/dataAnalyzer';
import { AuthGate } from './components/AuthGate';
import { SpreadsheetPicker } from './components/SpreadsheetPicker';
import { PeriodControlBar } from './components/PeriodControlBar';
import { ClickKpiStrip } from './components/ClickKpiStrip';
import { SitePagesExplorer } from './components/SitePagesExplorer';
import { HourlyAndTimelineSection } from './components/HourlyAndTimelineSection';
import { ClickLogTable } from './components/ClickLogTable';
import { RawSheetTable } from './components/RawSheetTable';
import { ColumnMappingModal } from './components/ColumnMappingModal';
import { RowDetailDrawer } from './components/RowDetailDrawer';

type NavSection = 'overview' | 'sites' | 'hours' | 'logs' | 'raw';

const SECTION_META: Record<NavSection, { title: string }> = {
  overview: { title: 'Dashboard' },
  sites: { title: 'Sites e Páginas' },
  hours: { title: 'Horários de Pico' },
  logs: { title: 'Histórico de Cliques' },
  raw: { title: 'Planilha Completa' },
};

export default function App() {
  const [needsAuth, setNeedsAuth] = useState<boolean>(true);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [avatarFailed, setAvatarFailed] = useState<boolean>(false);

  const [selectedSpreadsheetId, setSelectedSpreadsheetId] = useState<
    string | null
  >(null);
  const [showPickerModal, setShowPickerModal] = useState<boolean>(false);

  const [metadata, setMetadata] = useState<SpreadsheetMetadata | null>(null);
  const [activeSheetTitle, setActiveSheetTitle] = useState<string>('');
  const [explicitHeaderRow, setExplicitHeaderRow] = useState<
    number | undefined
  >(undefined);
  const [rawValues, setRawValues] = useState<SheetRawValues | null>(null);
  const [dataset, setDataset] = useState<ParsedSheetDataset | null>(null);

  const [customMapping, setCustomMapping] =
    useState<ClickColumnMapping | null>(null);
  const [showMappingModal, setShowMappingModal] = useState<boolean>(false);
  const [activeSection, setActiveSection] = useState<NavSection>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [syncInterval, setSyncInterval] = useState<SyncIntervalSeconds>(15);
  const [syncDiff, setSyncDiff] = useState<SyncDiffSummary | null>(null);

  const [period, setPeriod] = useState<PeriodPreset>('day');
  const [referenceDate, setReferenceDate] = useState<Date>(() => new Date());
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [selectedSite, setSelectedSite] = useState<string | null>(null);
  const [selectedPage, setSelectedPage] = useState<string | null>(null);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);

  const [inspectedRow, setInspectedRow] = useState<ParsedRow | null>(null);

  const datasetRef = useRef<ParsedSheetDataset | null>(null);
  datasetRef.current = dataset;
  const hasAutoPickedPeriodRef = useRef<boolean>(false);

  useEffect(() => {
    const unsubscribe = initAuth(
      (authedUser, token) => {
        setUser(authedUser);
        setAvatarFailed(false);
        setAccessToken(token);
        setNeedsAuth(false);
        setAuthReady(true);
      },
      (existingUser, errorMsg) => {
        setUser(existingUser);
        setAvatarFailed(false);
        setAccessToken(null);
        setNeedsAuth(true);
        setAuthReady(true);
        if (errorMsg) {
          setAuthError(errorMsg);
        }
      }
    );
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      const result = await googleSignIn();
      setUser(result.user);
      setAvatarFailed(false);
      setAccessToken(result.accessToken);
      setNeedsAuth(false);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Não foi possível concluir o login com o Google.';
      setAuthError(msg);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleAuthExpired = useCallback(() => {
    clearCachedToken();
    setAccessToken(null);
    setNeedsAuth(true);
  }, []);

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setAccessToken(null);
    setNeedsAuth(true);
    setSelectedSpreadsheetId(null);
    setMetadata(null);
    setDataset(null);
    setRawValues(null);
    setCustomMapping(null);
  };

  const fetchSheetData = useCallback(
    async (
      spreadsheetId: string,
      targetSheetTitle?: string,
      headerOverride?: number,
      isBackgroundSync = false
    ) => {
      const token = accessToken || getAccessToken();
      if (!token) {
        handleAuthExpired();
        return;
      }

      if (isBackgroundSync) {
        setIsSyncing(true);
      } else {
        setIsInitialLoading(true);
        setLoadError(null);
      }

      try {
        const meta = await getSpreadsheetMetadata(spreadsheetId, token);
        setMetadata(meta);

        if (meta.sheets.length === 0) {
          throw new Error('Esta planilha não possui abas visíveis.');
        }

        let resolvedTab =
          targetSheetTitle &&
          meta.sheets.some((s) => s.title === targetSheetTitle)
            ? targetSheetTitle
            : meta.sheets[0].title;

        let values = await getSheetValues(spreadsheetId, resolvedTab, token);

        if (
          !targetSheetTitle &&
          values.formattedRows.length <= 1 &&
          meta.sheets.length > 1
        ) {
          for (const candidate of meta.sheets.slice(1, 6)) {
            const candidateValues = await getSheetValues(
              spreadsheetId,
              candidate.title,
              token
            );
            if (candidateValues.formattedRows.length > 1) {
              resolvedTab = candidate.title;
              values = candidateValues;
              break;
            }
          }
        }

        setActiveSheetTitle(resolvedTab);
        setRawValues(values);

        const parsed = buildParsedDataset(
          meta,
          resolvedTab,
          values,
          headerOverride
        );

        const diff = computeDatasetDiff(datasetRef.current, parsed);
        if (diff) {
          setSyncDiff(diff);
        }
        setDataset(parsed);
      } catch (err: unknown) {
        const status = (err as { status?: number })?.status;
        if (status === 401) {
          handleAuthExpired();
          return;
        }
        if (!isBackgroundSync) {
          setLoadError(
            err instanceof Error
              ? err.message
              : 'Erro ao carregar os dados da planilha.'
          );
        }
      } finally {
        setIsInitialLoading(false);
        setIsSyncing(false);
      }
    },
    [accessToken, handleAuthExpired]
  );

  const loadSavedMapping = (spreadsheetId: string, sheetTitle: string) => {
    try {
      const raw = window.localStorage.getItem(
        `sheetspulse_map_${spreadsheetId}_${sheetTitle}`
      );
      if (raw) {
        return JSON.parse(raw) as ClickColumnMapping;
      }
    } catch {
      // Ignore storage error
    }
    return null;
  };

  const handleSelectSpreadsheet = (spreadsheetId: string) => {
    setSelectedSpreadsheetId(spreadsheetId);
    setShowPickerModal(false);
    setExplicitHeaderRow(undefined);
    setCustomMapping(null);
    setSelectedSite(null);
    setSelectedPage(null);
    setSelectedHour(null);
    setSearch('');
    setSyncDiff(null);
    hasAutoPickedPeriodRef.current = false;
    fetchSheetData(spreadsheetId, undefined, undefined, false);
  };

  const handleSelectSheetTab = (tabTitle: string) => {
    if (!selectedSpreadsheetId) return;
    setExplicitHeaderRow(undefined);
    setCustomMapping(null);
    setSelectedSite(null);
    setSelectedPage(null);
    setSelectedHour(null);
    setSearch('');
    setSyncDiff(null);
    hasAutoPickedPeriodRef.current = false;
    fetchSheetData(selectedSpreadsheetId, tabTitle, undefined, false);
  };

  useEffect(() => {
    if (dataset) {
      const saved = loadSavedMapping(
        dataset.spreadsheetId,
        dataset.sheetTitle
      );
      if (saved) {
        setCustomMapping(saved);
      }
    }
  }, [dataset?.spreadsheetId, dataset?.sheetTitle]);

  useEffect(() => {
    if (
      needsAuth ||
      !accessToken ||
      !selectedSpreadsheetId ||
      !activeSheetTitle ||
      syncInterval === 0
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchSheetData(
          selectedSpreadsheetId,
          activeSheetTitle,
          explicitHeaderRow,
          true
        );
      }
    }, syncInterval * 1000);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchSheetData(
          selectedSpreadsheetId,
          activeSheetTitle,
          explicitHeaderRow,
          true
        );
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [
    needsAuth,
    accessToken,
    selectedSpreadsheetId,
    activeSheetTitle,
    explicitHeaderRow,
    syncInterval,
    fetchSheetData,
  ]);

  const effectiveMapping = useMemo<ClickColumnMapping>(() => {
    if (!dataset) {
      return {
        siteCol: null,
        pageCol: null,
        dateCol: null,
        timeCol: null,
        clicksCol: null,
      };
    }
    if (customMapping) return customMapping;
    return inferClickColumnMapping(dataset.columns, dataset.rows);
  }, [dataset, customMapping]);

  const allClickEvents = useMemo(() => {
    if (!dataset) return [];
    return buildClickEvents(dataset.rows, effectiveMapping);
  }, [dataset, effectiveMapping]);

  const latestDataDate = useMemo(() => {
    let maxIso: string | null = null;
    for (const ev of allClickEvents) {
      if (ev.isoDate && (!maxIso || ev.isoDate > maxIso)) {
        maxIso = ev.isoDate;
      }
    }
    return maxIso;
  }, [allClickEvents]);

  const siteColorIndexMap = useMemo(() => {
    const agg = aggregateBySite(allClickEvents);
    const map = new Map<string, number>();
    agg.forEach((s, idx) => map.set(s.site, idx));
    return map;
  }, [allClickEvents]);

  useEffect(() => {
    if (hasAutoPickedPeriodRef.current || allClickEvents.length === 0) return;
    hasAutoPickedPeriodRef.current = true;

    const now = new Date();
    const checkPeriod = (p: PeriodPreset, ref: Date) =>
      filterClickEvents(allClickEvents, {
        period: p,
        referenceDate: ref,
      }).length > 0;

    if (checkPeriod('day', now)) {
      setReferenceDate(now);
      setPeriod('day');
    } else if (checkPeriod('week', now)) {
      setReferenceDate(now);
      setPeriod('week');
    } else if (checkPeriod('month', now)) {
      setReferenceDate(now);
      setPeriod('month');
    } else if (checkPeriod('year', now)) {
      setReferenceDate(now);
      setPeriod('year');
    } else {
      setReferenceDate(now);
      setPeriod('all');
    }
  }, [allClickEvents]);

  const periodEvents = useMemo(() => {
    return filterClickEvents(allClickEvents, {
      period,
      referenceDate,
      customStart,
      customEnd,
      search,
    });
  }, [allClickEvents, period, referenceDate, customStart, customEnd, search]);

  const scopedEvents = useMemo(() => {
    return periodEvents.filter((ev) => {
      if (selectedSite && ev.site !== selectedSite) return false;
      if (selectedPage && ev.page !== selectedPage) return false;
      if (selectedHour !== null && ev.hourOfDay !== selectedHour) return false;
      return true;
    });
  }, [periodEvents, selectedSite, selectedPage, selectedHour]);

  const siteAndPageEvents = useMemo(() => {
    return periodEvents.filter((ev) => {
      if (selectedSite && ev.site !== selectedSite) return false;
      if (selectedPage && ev.page !== selectedPage) return false;
      return true;
    });
  }, [periodEvents, selectedSite, selectedPage]);

  const eventsWithHourFilter = useMemo(() => {
    if (selectedHour === null) return periodEvents;
    return periodEvents.filter((ev) => ev.hourOfDay === selectedHour);
  }, [periodEvents, selectedHour]);

  const sitesAgg = useMemo(
    () => aggregateBySite(eventsWithHourFilter),
    [eventsWithHourFilter]
  );

  const scopedSitesAgg = useMemo(
    () => aggregateBySite(scopedEvents),
    [scopedEvents]
  );

  const pagesAgg = useMemo(
    () => aggregatePages(eventsWithHourFilter, selectedSite),
    [eventsWithHourFilter, selectedSite]
  );

  const scopedPagesAgg = useMemo(
    () => aggregatePages(scopedEvents, selectedSite),
    [scopedEvents, selectedSite]
  );

  const hourlyBuckets = useMemo(
    () => aggregateByHour(siteAndPageEvents),
    [siteAndPageEvents]
  );

  const timelineBuckets = useMemo(
    () => aggregateTimelineForPeriod(scopedEvents, period, referenceDate),
    [scopedEvents, period, referenceDate]
  );

  const allEventsTotalClicks = useMemo(
    () => allClickEvents.reduce((acc, e) => acc + e.clicks, 0),
    [allClickEvents]
  );

  const periodLabel = useMemo(() => {
    if (period === 'custom') {
      if (customStart || customEnd) {
        return `${customStart || '...'} até ${customEnd || '...'}`;
      }
      return 'Período personalizado';
    }
    return getPeriodBounds(period, referenceDate).label;
  }, [period, referenceDate, customStart, customEnd]);

  const handleSaveMapping = (
    nextMapping: ClickColumnMapping,
    nextHeaderRow: number
  ) => {
    setShowMappingModal(false);
    setCustomMapping(nextMapping);

    if (dataset) {
      try {
        window.localStorage.setItem(
          `sheetspulse_map_${dataset.spreadsheetId}_${dataset.sheetTitle}`,
          JSON.stringify(nextMapping)
        );
      } catch {
        // Ignore storage error
      }
    }

    if (
      nextHeaderRow !== explicitHeaderRow &&
      metadata &&
      rawValues &&
      activeSheetTitle
    ) {
      setExplicitHeaderRow(nextHeaderRow);
      const parsed = buildParsedDataset(
        metadata,
        activeSheetTitle,
        rawValues,
        nextHeaderRow
      );
      setDataset(parsed);
    }
  };

  const jumpToLatestDate = () => {
    if (!latestDataDate) {
      setPeriod('all');
      return;
    }
    const [y, m, d] = latestDataDate.split('-').map(Number);
    setReferenceDate(new Date(y, m - 1, d));
    setPeriod('day');
    setSelectedHour(null);
  };

  const formatSyncTime = (date: Date) =>
    new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);

  const userFirstName = useMemo(() => {
    const rawName = user?.displayName?.trim();
    if (rawName) {
      return rawName.split(/\s+/)[0];
    }
    const emailPrefix = user?.email?.split('@')[0];
    return emailPrefix || 'Visitante';
  }, [user]);

  const userInitials = useMemo(() => {
    const rawName = user?.displayName?.trim();
    if (rawName) {
      const parts = rawName.split(/\s+/);
      return (
        (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')
      ).toUpperCase();
    }
    return (user?.email?.[0] ?? 'U').toUpperCase();
  }, [user]);

  const navItems: Array<{
    id: NavSection;
    label: string;
    icon: React.ReactNode;
    iconColor: string;
  }> = [
    {
      id: 'overview',
      label: 'Visão Geral',
      icon: <Home className="w-4 h-4" />,
      iconColor: 'text-[#4C8F84]',
    },
    {
      id: 'sites',
      label: 'Sites e Páginas',
      icon: <Globe className="w-4 h-4" />,
      iconColor: 'text-[#E36A42]',
    },
    {
      id: 'hours',
      label: 'Horários',
      icon: <Clock className="w-4 h-4" />,
      iconColor: 'text-[#D9912B]',
    },
    {
      id: 'logs',
      label: 'Registros',
      icon: <ListOrdered className="w-4 h-4" />,
      iconColor: 'text-[#766BB0]',
    },
    {
      id: 'raw',
      label: 'Planilha',
      icon: <Table2 className="w-4 h-4" />,
      iconColor: 'text-[#6B8E58]',
    },
  ];

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#F5EFE6] flex items-center justify-center p-6">
        <div className="w-full max-w-md h-36 rounded-[28px] clay-shell animate-pulse" />
      </div>
    );
  }

  if (needsAuth) {
    return (
      <AuthGate
        onLogin={handleLogin}
        isLoggingIn={isLoggingIn}
        errorMessage={authError}
        existingUser={user}
      />
    );
  }

  if (!selectedSpreadsheetId) {
    return (
      <div className="min-h-screen bg-[#F5EFE6]">
        <div className="max-w-4xl mx-auto pt-6 px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-[#FCF7EE] bg-[#F9D5BE] shadow-sm overflow-hidden flex items-center justify-center text-xs font-extrabold text-[#2C221E]">
              {user?.photoURL && !avatarFailed ? (
                <img
                  src={user.photoURL}
                  alt={userFirstName}
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarFailed(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                userInitials
              )}
            </div>
            <div>
              <p className="text-sm font-bold text-[#2C221E]">
                Olá, {userFirstName}!
              </p>
              <p className="text-xs text-[#6E5F54]">
                Escolha uma planilha para começar
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="px-4 py-2 text-xs font-bold rounded-2xl clay-card text-[#5E4E42] hover:text-[#2C221E] inline-flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sair</span>
          </button>
        </div>

        {accessToken && (
          <SpreadsheetPicker
            accessToken={accessToken}
            selectedSpreadsheetId={selectedSpreadsheetId}
            onSelectSpreadsheet={handleSelectSpreadsheet}
            onAuthExpired={handleAuthExpired}
          />
        )}
      </div>
    );
  }

  const sidebarContent = (
    <>
      <div>
        {/* Profile Avatar + Greeting */}
        <div className="flex flex-col items-center text-center pt-1 pb-5 border-b border-[#B2C6BD]/60">
          <div className="w-20 h-20 rounded-full border-4 border-[#FCF7EE] bg-[#F9D5BE] shadow-md overflow-hidden flex items-center justify-center text-xl font-extrabold text-[#2C221E]">
            {user?.photoURL && !avatarFailed ? (
              <img
                src={user.photoURL}
                alt={userFirstName}
                referrerPolicy="no-referrer"
                onError={() => setAvatarFailed(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              userInitials
            )}
          </div>
          <p className="mt-3 text-base font-extrabold text-[#2C221E] font-display">
            Olá, {userFirstName}!
          </p>
          {user?.email && (
            <p className="text-[11px] text-[#4E6158] truncate max-w-full mt-0.5">
              {user.email}
            </p>
          )}
        </div>

        {/* Navigation Links */}
        <nav aria-label="Menu principal" className="mt-5 space-y-1.5">
          {navItems.map((item) => {
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveSection(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full px-4 py-3 rounded-2xl text-left text-sm flex items-center gap-3 transition-all cursor-pointer ${
                  active
                    ? 'clay-button-active text-[#2C221E] font-bold'
                    : 'text-[#3F5149] hover:bg-[#FCF7EE]/45 font-semibold'
                }`}
              >
                <span className={item.iconColor}>{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Utility Actions */}
      <div className="pt-5 mt-6 border-t border-[#B2C6BD]/60 space-y-1.5">
        <button
          type="button"
          onClick={() => {
            setShowPickerModal(true);
            setMobileMenuOpen(false);
          }}
          className="w-full px-3.5 py-2.5 rounded-2xl text-xs font-bold text-[#3F5149] hover:bg-[#FCF7EE]/45 flex items-center gap-2.5 cursor-pointer transition-colors"
        >
          <FolderOpen className="w-4 h-4 text-[#4C8F84]" />
          <span>Trocar planilha</span>
        </button>

        {dataset && (
          <button
            type="button"
            onClick={() => {
              setShowMappingModal(true);
              setMobileMenuOpen(false);
            }}
            className="w-full px-3.5 py-2.5 rounded-2xl text-xs font-bold text-[#3F5149] hover:bg-[#FCF7EE]/45 flex items-center gap-2.5 cursor-pointer transition-colors"
          >
            <SlidersHorizontal className="w-4 h-4 text-[#D9912B]" />
            <span>Mapear colunas</span>
          </button>
        )}

        <button
          type="button"
          onClick={handleLogout}
          className="w-full px-3.5 py-2.5 rounded-2xl text-xs font-bold text-[#5C4940] hover:bg-[#FCF7EE]/45 flex items-center gap-2.5 cursor-pointer transition-colors"
        >
          <LogOut className="w-4 h-4 text-[#C95D76]" />
          <span>Sair da conta</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#F5EFE6] text-[#2C221E] p-3 sm:p-5 lg:p-6">
      <div className="max-w-[1440px] mx-auto clay-shell rounded-[32px] p-4 sm:p-5 lg:p-6 flex flex-col lg:flex-row gap-6 min-h-[calc(100vh-3rem)]">
        {/* Desktop Left Sage Sidebar */}
        <aside className="hidden lg:flex lg:w-[235px] shrink-0 clay-sidebar rounded-[26px] p-5 flex-col justify-between">
          {sidebarContent}
        </aside>

        {/* Mobile Slide-Over Sidebar */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-50 bg-[#2C221E]/35 backdrop-blur-xs lg:hidden flex"
            onClick={() => setMobileMenuOpen(false)}
          >
            <aside
              className="w-[260px] clay-sidebar h-full p-5 flex flex-col justify-between overflow-y-auto rounded-r-[28px]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-end mb-2">
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Fechar menu"
                  className="p-2 rounded-xl clay-button-active text-[#2C221E] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {sidebarContent}
            </aside>
          </div>
        )}

        {/* Right Main Content */}
        <main className="flex-1 min-w-0 flex flex-col gap-5">
          {/* Top Header Row: Title + Clay Search + Sync Select + Coral CTA */}
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Abrir menu"
                className="lg:hidden p-2.5 rounded-2xl clay-card text-[#2C221E] cursor-pointer"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl sm:text-[26px] font-extrabold tracking-tight text-[#2C221E]">
                  {SECTION_META[activeSection].title}
                </h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {activeSection !== 'raw' && (
                <div className="relative flex-1 sm:w-64 min-w-[200px]">
                  <Search className="w-4 h-4 text-[#8C7A6B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar site ou página..."
                    className="w-full pl-10 pr-8 py-2.5 text-xs font-medium rounded-2xl clay-input border border-[#EADFD1] text-[#2C221E] placeholder:text-[#9A897A] focus:outline-none focus:ring-2 focus:ring-[#E36A42]"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      aria-label="Limpar busca"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8C7A6B] hover:text-[#2C221E] cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}

              <select
                aria-label="Intervalo de atualização automática"
                value={syncInterval}
                onChange={(e) =>
                  setSyncInterval(Number(e.target.value) as SyncIntervalSeconds)
                }
                className="px-3.5 py-2.5 text-xs font-bold rounded-2xl clay-input border border-[#EADFD1] text-[#4A3B31] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#E36A42]"
              >
                <option value={5}>Auto: 5s</option>
                <option value={15}>Auto: 15s</option>
                <option value={30}>Auto: 30s</option>
                <option value={60}>Auto: 60s</option>
                <option value={0}>Auto: Pausado</option>
              </select>

              <button
                type="button"
                onClick={() =>
                  fetchSheetData(
                    selectedSpreadsheetId,
                    activeSheetTitle,
                    explicitHeaderRow,
                    true
                  )
                }
                disabled={isSyncing}
                className="px-5 py-2.5 text-xs font-bold text-white clay-coral-btn rounded-2xl transition-transform active:scale-[0.98] whitespace-nowrap shrink-0 inline-flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`}
                />
                <span>Atualizar</span>
              </button>
            </div>
          </header>

          {loadError ? (
            <div className="clay-card rounded-[28px] p-8 text-center max-w-2xl mx-auto my-8">
              <p className="text-base font-bold text-[#8F2D22]">
                Não foi possível ler esta planilha
              </p>
              <p className="text-xs text-[#6E5F54] mt-1.5">{loadError}</p>
              <div className="mt-5 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    fetchSheetData(
                      selectedSpreadsheetId,
                      activeSheetTitle || undefined,
                      explicitHeaderRow,
                      false
                    )
                  }
                  className="px-5 py-2.5 text-xs font-bold text-white clay-coral-btn rounded-2xl cursor-pointer"
                >
                  Tentar novamente
                </button>
                <button
                  type="button"
                  onClick={() => setShowPickerModal(true)}
                  className="px-5 py-2.5 text-xs font-bold clay-button-active text-[#2C221E] rounded-2xl cursor-pointer"
                >
                  Escolher outra planilha
                </button>
              </div>
            </div>
          ) : isInitialLoading || !dataset ? (
            <div className="space-y-5">
              <div className="h-32 rounded-[28px] bg-[#F3E5D5] animate-pulse" />
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
                {[1, 2, 3, 4].map((n) => (
                  <div
                    key={n}
                    className="h-36 rounded-[24px] bg-[#EFE6D8] animate-pulse"
                  />
                ))}
              </div>
              <div className="h-80 rounded-[28px] bg-[#EFE6D8] animate-pulse" />
            </div>
          ) : dataset.rows.length === 0 ? (
            <div className="clay-card rounded-[28px] p-10 text-center space-y-3">
              <p className="text-sm font-bold text-[#2C221E]">
                Nenhuma linha encontrada na aba "{dataset.sheetTitle}"
              </p>
              <p className="text-xs text-[#6E5F54]">
                Verifique se os dados estão em outra aba ou ajuste a linha de cabeçalho.
              </p>
              <div className="flex flex-wrap justify-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowMappingModal(true)}
                  className="px-5 py-2.5 text-xs font-bold rounded-2xl clay-coral-btn text-white cursor-pointer"
                >
                  Ajustar colunas
                </button>
                <button
                  type="button"
                  onClick={() => setShowPickerModal(true)}
                  className="px-5 py-2.5 text-xs font-bold rounded-2xl clay-button-active text-[#2C221E] cursor-pointer"
                >
                  Trocar planilha
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Warm Peach Hero Banner with Sheet Metadata + Period Switcher */}
              <section className="clay-peach rounded-[28px] p-5 sm:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h2 className="text-lg sm:text-xl font-extrabold text-[#2C221E] truncate max-w-xl">
                        {dataset.spreadsheetTitle}
                      </h2>
                      {dataset.spreadsheetUrl && (
                        <a
                          href={dataset.spreadsheetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-bold text-[#B54B27] hover:text-[#8E3518] inline-flex items-center gap-1 whitespace-nowrap"
                        >
                          <span>Abrir no Sheets</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                    <p className="text-xs text-[#6E4D3B] mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 tabular-nums">
                      <span>Aba: {dataset.sheetTitle}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        Atualizado às {formatSyncTime(dataset.syncedAt)}
                      </span>
                      {syncDiff && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-[#366B62] font-bold">
                            +{syncDiff.addedRows} novas linhas
                          </span>
                        </>
                      )}
                    </p>
                  </div>

                  {metadata && metadata.sheets.length > 1 && (
                    <select
                      aria-label="Selecionar aba"
                      value={activeSheetTitle}
                      onChange={(e) => handleSelectSheetTab(e.target.value)}
                      className="px-3.5 py-2 text-xs font-bold rounded-2xl clay-button-active text-[#2C221E] cursor-pointer shrink-0 self-start sm:self-auto focus:outline-none focus:ring-2 focus:ring-[#E36A42]"
                    >
                      {metadata.sheets.map((tab) => (
                        <option key={tab.sheetId} value={tab.title}>
                          Aba: {tab.title}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {activeSection !== 'raw' && (
                  <PeriodControlBar
                    embedded
                    period={period}
                    onChangePeriod={(p) => {
                      setPeriod(p);
                      setSelectedHour(null);
                    }}
                    referenceDate={referenceDate}
                    onChangeReferenceDate={setReferenceDate}
                    customStart={customStart}
                    customEnd={customEnd}
                    onChangeCustomStart={setCustomStart}
                    onChangeCustomEnd={setCustomEnd}
                    selectedSite={selectedSite}
                    selectedPage={selectedPage}
                    selectedHour={selectedHour}
                    onClearSubFilters={() => {
                      setSelectedSite(null);
                      setSelectedPage(null);
                      setSelectedHour(null);
                    }}
                  />
                )}
              </section>

              {activeSection !== 'raw' &&
                periodEvents.length === 0 &&
                allClickEvents.length > 0 && (
                  <div className="clay-butter rounded-[24px] px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 text-xs">
                      <Calendar className="w-4 h-4 text-[#B57214] shrink-0" />
                      <span className="text-[#3D3028]">
                        Sem cliques em <strong>{periodLabel}</strong>. A
                        planilha tem{' '}
                        <strong className="font-mono tabular-nums">
                          {allClickEvents.length.toLocaleString('pt-BR')}
                        </strong>{' '}
                        registros no histórico.
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {latestDataDate && (
                        <button
                          type="button"
                          onClick={jumpToLatestDate}
                          className="px-4 py-2 text-xs font-bold rounded-2xl clay-coral-btn text-white cursor-pointer whitespace-nowrap"
                        >
                          Ver último dia
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setPeriod('all');
                          setSearch('');
                        }}
                        className="px-4 py-2 text-xs font-bold rounded-2xl clay-button-active text-[#2C221E] cursor-pointer whitespace-nowrap"
                      >
                        Mostrar tudo
                      </button>
                    </div>
                  </div>
                )}

              {activeSection === 'overview' && (
                <>
                  <ClickKpiStrip
                    events={scopedEvents}
                    allEventsCount={allEventsTotalClicks}
                    sites={scopedSitesAgg}
                    pages={scopedPagesAgg}
                    hourlyBuckets={hourlyBuckets}
                    periodLabel={periodLabel}
                  />

                  <SitePagesExplorer
                    sites={sitesAgg}
                    pages={pagesAgg}
                    siteColorIndexMap={siteColorIndexMap}
                    selectedSite={selectedSite}
                    selectedPage={selectedPage}
                    onSelectSite={(s) => setSelectedSite(s)}
                    onSelectPage={(p) => setSelectedPage(p)}
                  />

                  <HourlyAndTimelineSection
                    hourlyBuckets={hourlyBuckets}
                    timelineBuckets={timelineBuckets}
                    period={period}
                    periodLabel={periodLabel}
                    selectedHour={selectedHour}
                    onToggleHour={(hr) =>
                      setSelectedHour((prev) => (prev === hr ? null : hr))
                    }
                  />
                </>
              )}

              {activeSection === 'sites' && (
                <SitePagesExplorer
                  sites={sitesAgg}
                  pages={pagesAgg}
                  siteColorIndexMap={siteColorIndexMap}
                  selectedSite={selectedSite}
                  selectedPage={selectedPage}
                  onSelectSite={(s) => setSelectedSite(s)}
                  onSelectPage={(p) => setSelectedPage(p)}
                />
              )}

              {activeSection === 'hours' && (
                <HourlyAndTimelineSection
                  hourlyBuckets={hourlyBuckets}
                  timelineBuckets={timelineBuckets}
                  period={period}
                  periodLabel={periodLabel}
                  selectedHour={selectedHour}
                  onToggleHour={(hr) =>
                    setSelectedHour((prev) => (prev === hr ? null : hr))
                  }
                />
              )}

              {activeSection === 'logs' && (
                <ClickLogTable
                  spreadsheetTitle={dataset.spreadsheetTitle}
                  sheetTitle={dataset.sheetTitle}
                  events={scopedEvents}
                  siteColorIndexMap={siteColorIndexMap}
                  onInspectRow={setInspectedRow}
                />
              )}

              {activeSection === 'raw' && (
                <RawSheetTable
                  spreadsheetTitle={dataset.spreadsheetTitle}
                  sheetTitle={dataset.sheetTitle}
                  columns={dataset.columns}
                  rows={dataset.rows}
                  onInspectRow={setInspectedRow}
                />
              )}
            </>
          )}
        </main>
      </div>

      {showPickerModal && accessToken && (
        <SpreadsheetPicker
          accessToken={accessToken}
          selectedSpreadsheetId={selectedSpreadsheetId}
          onSelectSpreadsheet={handleSelectSpreadsheet}
          onClose={() => setShowPickerModal(false)}
          isModal={true}
          onAuthExpired={handleAuthExpired}
        />
      )}

      {showMappingModal && dataset && (
        <ColumnMappingModal
          columns={dataset.columns}
          mapping={effectiveMapping}
          headerRowIndex={dataset.headerRowIndex}
          rawRowCount={dataset.rawRowCount}
          onSave={handleSaveMapping}
          onClose={() => setShowMappingModal(false)}
        />
      )}

      {dataset && (
        <RowDetailDrawer
          row={inspectedRow}
          columns={dataset.columns}
          spreadsheetUrl={dataset.spreadsheetUrl}
          sheetTitle={dataset.sheetTitle}
          onClose={() => setInspectedRow(null)}
        />
      )}
    </div>
  );
}
