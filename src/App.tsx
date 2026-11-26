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
  UserPlus,
  UserRoundCog,
  Users,
  X,
} from 'lucide-react';
import {
  clearCachedToken,
  FIREBASE_PROJECT_ID,
  getAccessToken,
  googleContinueSession,
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
  analyzeUsers,
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
import { HourlyRecordsPanel } from './components/HourlyRecordsPanel';
import { UsersAnalyticsPanel } from './components/UsersAnalyticsPanel';
import { ClickLogTable } from './components/ClickLogTable';
import { RawSheetTable } from './components/RawSheetTable';
import { ColumnMappingModal } from './components/ColumnMappingModal';
import { RowDetailDrawer } from './components/RowDetailDrawer';

type NavSection = 'overview' | 'sites' | 'users' | 'hours' | 'logs' | 'raw';

const SECTION_META: Record<NavSection, { title: string }> = {
  overview: { title: 'Dashboard' },
  sites: { title: 'Sites e Páginas' },
  users: { title: 'Usuários Novos e Cliques' },
  hours: { title: 'Horários de Pico' },
  logs: { title: 'Histórico de Cliques' },
  raw: { title: 'Planilha Completa' },
};

const LAST_SHEET_STORAGE_PREFIX = 'sheetspulse_last_sheet_';

interface SavedSheetSelection {
  spreadsheetId: string;
  sheetTitle?: string;
}

function saveLastSheetSelection(
  uid: string | undefined,
  spreadsheetId: string,
  sheetTitle?: string
): void {
  if (!uid || !spreadsheetId) return;
  try {
    window.localStorage.setItem(
      `${LAST_SHEET_STORAGE_PREFIX}${uid}`,
      JSON.stringify({ spreadsheetId, sheetTitle })
    );
  } catch {
    // Ignore storage error
  }
}

function loadLastSheetSelection(uid: string | undefined): SavedSheetSelection | null {
  if (!uid) return null;
  try {
    const raw = window.localStorage.getItem(`${LAST_SHEET_STORAGE_PREFIX}${uid}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedSheetSelection;
    return parsed?.spreadsheetId ? parsed : null;
  } catch {
    return null;
  }
}

function clearLastSheetSelection(uid: string | undefined): void {
  if (!uid) return;
  try {
    window.localStorage.removeItem(`${LAST_SHEET_STORAGE_PREFIX}${uid}`);
  } catch {
    // Ignore storage error
  }
}

export default function App() {
  const [needsAuth, setNeedsAuth] = useState<boolean>(true);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [tokenNeedsRenewal, setTokenNeedsRenewal] = useState<boolean>(false);
  const [isRenewingToken, setIsRenewingToken] = useState<boolean>(false);
  const [renewalError, setRenewalError] = useState<string | null>(null);
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
  const userRef = useRef<User | null>(null);
  userRef.current = user;
  const selectedSpreadsheetIdRef = useRef<string | null>(null);
  selectedSpreadsheetIdRef.current = selectedSpreadsheetId;
  const hasAutoPickedPeriodRef = useRef<boolean>(false);

  const handleAuthExpired = useCallback(() => {
    clearCachedToken();
    setAccessToken(null);
    setIsSyncing(false);
    setIsInitialLoading(false);
    if (userRef.current && datasetRef.current) {
      // Keep the user logged in on the dashboard instead of kicking them out
      setTokenNeedsRenewal(true);
      setNeedsAuth(false);
    } else {
      setNeedsAuth(true);
    }
  }, []);

  const fetchSheetData = useCallback(
    async (
      spreadsheetId: string,
      targetSheetTitle?: string,
      headerOverride?: number,
      isBackgroundSync = false,
      tokenOverride?: string
    ) => {
      const token = tokenOverride || accessToken || getAccessToken();
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

        const normalizeTab = (t: string) =>
          t
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');

        const preferredCliquesTab =
          meta.sheets.find((s) => {
            const norm = normalizeTab(s.title);
            return norm === 'cliques' || norm === 'clique';
          }) ??
          meta.sheets.find((s) => {
            const norm = normalizeTab(s.title);
            return norm.includes('cliques') || norm.includes('clique');
          });

        let resolvedTab =
          targetSheetTitle &&
          meta.sheets.some((s) => s.title === targetSheetTitle)
            ? targetSheetTitle
            : preferredCliquesTab?.title ?? meta.sheets[0].title;

        let values = await getSheetValues(spreadsheetId, resolvedTab, token);

        if (
          !targetSheetTitle &&
          !preferredCliquesTab &&
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
        setTokenNeedsRenewal(false);
        setRenewalError(null);
        saveLastSheetSelection(userRef.current?.uid, spreadsheetId, resolvedTab);

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

  const restoreOrFetchSavedSheet = useCallback(
    (uid: string, token: string) => {
      if (selectedSpreadsheetIdRef.current) return;
      const saved = loadLastSheetSelection(uid);
      if (saved) {
        setSelectedSpreadsheetId(saved.spreadsheetId);
        fetchSheetData(
          saved.spreadsheetId,
          saved.sheetTitle,
          undefined,
          false,
          token
        );
      }
    },
    [fetchSheetData]
  );

  useEffect(() => {
    const unsubscribe = initAuth(
      (authedUser, token) => {
        setUser(authedUser);
        setAvatarFailed(false);
        setAccessToken(token);
        setNeedsAuth(false);
        setTokenNeedsRenewal(false);
        setRenewalError(null);
        setAuthReady(true);
        restoreOrFetchSavedSheet(authedUser.uid, token);
      },
      (existingUser, errorMsg) => {
        setUser(existingUser);
        setAvatarFailed(false);
        setAccessToken(null);
        if (existingUser && datasetRef.current) {
          setTokenNeedsRenewal(true);
          setNeedsAuth(false);
        } else {
          setNeedsAuth(true);
        }
        setAuthReady(true);
        if (errorMsg) {
          setAuthError(errorMsg);
        }
      }
    );
    return () => unsubscribe();
  }, [restoreOrFetchSavedSheet]);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      const result = await googleSignIn();
      setUser(result.user);
      setAvatarFailed(false);
      setAccessToken(result.accessToken);
      setNeedsAuth(false);
      setTokenNeedsRenewal(false);
      setRenewalError(null);
      restoreOrFetchSavedSheet(result.user.uid, result.accessToken);
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

  const handleContinueExisting = async () => {
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      const result = await googleContinueSession(user?.email);
      setUser(result.user);
      setAvatarFailed(false);
      setAccessToken(result.accessToken);
      setNeedsAuth(false);
      setTokenNeedsRenewal(false);
      setRenewalError(null);
      restoreOrFetchSavedSheet(result.user.uid, result.accessToken);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Não foi possível retomar a conexão com o Google.';
      setAuthError(msg);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleRenewToken = async (openPickerAfter = false) => {
    setIsRenewingToken(true);
    setRenewalError(null);
    try {
      const result = await googleContinueSession(user?.email);
      setUser(result.user);
      setAvatarFailed(false);
      setAccessToken(result.accessToken);
      setTokenNeedsRenewal(false);
      setNeedsAuth(false);
      if (openPickerAfter) {
        setShowPickerModal(true);
      } else if (selectedSpreadsheetId) {
        fetchSheetData(
          selectedSpreadsheetId,
          activeSheetTitle || undefined,
          explicitHeaderRow,
          true,
          result.accessToken
        );
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Não foi possível renovar a sincronização agora.';
      setRenewalError(msg);
    } finally {
      setIsRenewingToken(false);
    }
  };

  const handleOpenPickerModal = () => {
    if (!accessToken || tokenNeedsRenewal) {
      handleRenewToken(true);
      return;
    }
    setShowPickerModal(true);
  };

  const handleSwitchAccount = async () => {
    setAuthError(null);
    setRenewalError(null);
    setIsLoggingIn(true);
    try {
      const previousUid = user?.uid;
      const result = await googleSignIn();
      if (previousUid && previousUid !== result.user.uid) {
        clearLastSheetSelection(previousUid);
      }
      setUser(result.user);
      setAvatarFailed(false);
      setAccessToken(result.accessToken);
      setNeedsAuth(false);
      setTokenNeedsRenewal(false);
      setSelectedSpreadsheetId(null);
      setActiveSheetTitle('');
      setExplicitHeaderRow(undefined);
      setMetadata(null);
      setDataset(null);
      setRawValues(null);
      setCustomMapping(null);
      setLoadError(null);
      setSyncDiff(null);
      setSelectedSite(null);
      setSelectedPage(null);
      setSelectedHour(null);
      setShowPickerModal(false);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Não foi possível trocar de conta Google.';
      setAuthError(msg);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    clearLastSheetSelection(user?.uid);
    await logout();
    setUser(null);
    setAccessToken(null);
    setNeedsAuth(true);
    setTokenNeedsRenewal(false);
    setRenewalError(null);
    setSelectedSpreadsheetId(null);
    setActiveSheetTitle('');
    setMetadata(null);
    setDataset(null);
    setRawValues(null);
    setCustomMapping(null);
  };

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
      tokenNeedsRenewal ||
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
    tokenNeedsRenewal,
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
        userCol: null,
        newUserCol: null,
        nameCol: null,
        cityCol: null,
        deviceCol: null,
      };
    }
    const inferred = inferClickColumnMapping(dataset.columns, dataset.rows);
    if (!customMapping) return inferred;
    return {
      ...customMapping,
      userCol:
        'userCol' in customMapping ? customMapping.userCol ?? null : inferred.userCol ?? null,
      newUserCol:
        'newUserCol' in customMapping
          ? customMapping.newUserCol ?? null
          : inferred.newUserCol ?? null,
      nameCol:
        'nameCol' in customMapping ? customMapping.nameCol ?? null : inferred.nameCol ?? null,
      cityCol:
        'cityCol' in customMapping ? customMapping.cityCol ?? null : inferred.cityCol ?? null,
      deviceCol:
        'deviceCol' in customMapping
          ? customMapping.deviceCol ?? null
          : inferred.deviceCol ?? null,
    };
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

  const usersSummary = useMemo(
    () =>
      analyzeUsers(allClickEvents, eventsWithHourFilter, {
        period,
        referenceDate,
        customStart,
        customEnd,
        hasUserCol: Boolean(effectiveMapping.userCol || effectiveMapping.nameCol),
      }),
    [
      allClickEvents,
      eventsWithHourFilter,
      period,
      referenceDate,
      customStart,
      customEnd,
      effectiveMapping.userCol,
      effectiveMapping.nameCol,
    ]
  );

  const newUsersBySiteMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of usersSummary.bySite) {
      m.set(s.site, s.newUsers);
    }
    return m;
  }, [usersSummary.bySite]);

  const sitesAgg = useMemo(
    () => aggregateBySite(eventsWithHourFilter, newUsersBySiteMap),
    [eventsWithHourFilter, newUsersBySiteMap]
  );

  const scopedSitesAgg = useMemo(
    () => aggregateBySite(scopedEvents, newUsersBySiteMap),
    [scopedEvents, newUsersBySiteMap]
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
      id: 'users',
      label: 'Usuários',
      icon: <Users className="w-4 h-4" />,
      iconColor: 'text-[#366B62]',
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
        onContinueExisting={handleContinueExisting}
        onLogout={handleLogout}
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

        {authError && (
          <div className="max-w-4xl mx-auto mt-4 px-6">
            <div
              role="alert"
              className="p-3.5 rounded-2xl bg-[#FDE4E1] border border-[#E8A39A] text-xs text-[#8F2D22] flex flex-wrap items-center justify-between gap-2"
            >
              <span>{authError}</span>
              {FIREBASE_PROJECT_ID && (
                <a
                  href={`https://console.cloud.google.com/auth/audience?project=${FIREBASE_PROJECT_ID}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-[#8F2D22] font-bold text-white hover:bg-[#732118] shrink-0"
                >
                  <span>Liberar contas no Google Cloud</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        )}

        {accessToken && (
          <SpreadsheetPicker
            accessToken={accessToken}
            selectedSpreadsheetId={selectedSpreadsheetId}
            onSelectSpreadsheet={handleSelectSpreadsheet}
            onSwitchAccount={handleSwitchAccount}
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
            setMobileMenuOpen(false);
            handleOpenPickerModal();
          }}
          className="w-full px-3.5 py-2.5 rounded-2xl text-xs font-bold text-[#3F5149] hover:bg-[#FCF7EE]/45 flex items-center gap-2.5 cursor-pointer transition-colors"
        >
          <FolderOpen className="w-4 h-4 text-[#4C8F84]" />
          <span>Trocar planilha</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setMobileMenuOpen(false);
            handleSwitchAccount();
          }}
          className="w-full px-3.5 py-2.5 rounded-2xl text-xs font-bold text-[#3F5149] hover:bg-[#FCF7EE]/45 flex items-center gap-2.5 cursor-pointer transition-colors"
        >
          <UserRoundCog className="w-4 h-4 text-[#766BB0]" />
          <span>Trocar conta Google</span>
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
                onClick={() => {
                  if (tokenNeedsRenewal || !accessToken) {
                    handleRenewToken();
                  } else {
                    fetchSheetData(
                      selectedSpreadsheetId,
                      activeSheetTitle,
                      explicitHeaderRow,
                      true
                    );
                  }
                }}
                disabled={isSyncing || isRenewingToken}
                className="px-5 py-2.5 text-xs font-bold text-white clay-coral-btn rounded-2xl transition-transform active:scale-[0.98] whitespace-nowrap shrink-0 inline-flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${
                    isSyncing || isRenewingToken ? 'animate-spin' : ''
                  }`}
                />
                <span>
                  {tokenNeedsRenewal ? 'Renovar e atualizar' : 'Atualizar'}
                </span>
              </button>
            </div>
          </header>

          {tokenNeedsRenewal && (
            <div
              role="status"
              className="clay-butter rounded-[24px] px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-1">
                <p className="text-xs sm:text-sm font-bold text-[#2C221E]">
                  Você continua logado como {user?.email || userFirstName}.
                </p>
                <p className="text-xs text-[#695A42]">
                  O Google encerra cada leitura automática após 1 hora. Seus dados continuam abertos aqui — clique ao lado para retomar a sincronização em 1 clique.
                </p>
                {renewalError && (
                  <p className="text-xs font-semibold text-[#8F2D22] pt-0.5">
                    {renewalError}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleRenewToken(false)}
                disabled={isRenewingToken}
                className="px-4 py-2.5 text-xs font-bold rounded-2xl clay-coral-btn text-white whitespace-nowrap shrink-0 inline-flex items-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isRenewingToken ? 'animate-spin' : ''}`}
                />
                <span>
                  {isRenewingToken
                    ? 'Renovando...'
                    : 'Renovar sincronização'}
                </span>
              </button>
            </div>
          )}

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
                  onClick={handleOpenPickerModal}
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
                  onClick={handleOpenPickerModal}
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
                      {tokenNeedsRenewal && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-[#9E5E12] font-bold">
                            Sincronização pausada (clique em Renovar)
                          </span>
                        </>
                      )}
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

                  {usersSummary.hasUserCol && (
                    <section
                      aria-label="Resumo de usuários novos"
                      className="clay-card rounded-[24px] px-5 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-2xl bg-[#4C8F84] text-white flex items-center justify-center shrink-0 clay-icon-tile">
                          <UserPlus className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-extrabold text-[#2C221E] tabular-nums">
                            {usersSummary.totalNewUsers.toLocaleString('pt-BR')}{' '}
                            {usersSummary.totalNewUsers === 1
                              ? 'usuário novo clicou'
                              : 'usuários novos clicaram'}{' '}
                            <span className="text-[#6E5F54] font-semibold text-xs">
                              ({usersSummary.newUserClicks.toLocaleString('pt-BR')} cliques ·{' '}
                              {usersSummary.totalUniqueUsers.toLocaleString('pt-BR')} únicos no período)
                            </span>
                          </p>
                          {usersSummary.bySite.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-[11px]">
                              {usersSummary.bySite.slice(0, 4).map((s) => (
                                <span
                                  key={s.site}
                                  className="px-2.5 py-0.5 rounded-lg bg-[#EFE6D8] font-semibold text-[#3D3028] tabular-nums"
                                >
                                  {s.site}: {s.newUsers.toLocaleString('pt-BR')} novos
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setActiveSection('users')}
                        className="px-4 py-2 text-xs font-bold rounded-2xl clay-button-active text-[#366B62] hover:text-[#E36A42] cursor-pointer whitespace-nowrap self-start lg:self-auto shrink-0"
                      >
                        Ver usuários, cliques e dias →
                      </button>
                    </section>
                  )}

                  <SitePagesExplorer
                    sites={sitesAgg}
                    pages={pagesAgg}
                    siteColorIndexMap={siteColorIndexMap}
                    selectedSite={selectedSite}
                    selectedPage={selectedPage}
                    onSelectSite={(s) => setSelectedSite(s)}
                    onSelectPage={(p) => setSelectedPage(p)}
                    hasUserCol={usersSummary.hasUserCol}
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
                  hasUserCol={usersSummary.hasUserCol}
                />
              )}

              {activeSection === 'users' && (
                <UsersAnalyticsPanel
                  summary={usersSummary}
                  siteColorIndexMap={siteColorIndexMap}
                  selectedSite={selectedSite}
                  onSelectSite={(s) => setSelectedSite(s)}
                  periodLabel={periodLabel}
                  onOpenMapping={() => setShowMappingModal(true)}
                  onInspectRow={setInspectedRow}
                />
              )}

              {activeSection === 'hours' && (
                <>
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

                  <HourlyRecordsPanel
                    events={siteAndPageEvents}
                    siteColorIndexMap={siteColorIndexMap}
                    selectedHour={selectedHour}
                    onToggleHour={(hr) =>
                      setSelectedHour((prev) => (prev === hr ? null : hr))
                    }
                    periodLabel={periodLabel}
                  />

                  <ClickLogTable
                    spreadsheetTitle={dataset.spreadsheetTitle}
                    sheetTitle={dataset.sheetTitle}
                    events={scopedEvents}
                    siteColorIndexMap={siteColorIndexMap}
                    onInspectRow={setInspectedRow}
                  />
                </>
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
          onSwitchAccount={handleSwitchAccount}
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
