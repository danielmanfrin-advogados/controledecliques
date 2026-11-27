export interface DriveSpreadsheetFile {
  id: string;
  name: string;
  modifiedTime?: string;
  webViewLink?: string;
  owners?: Array<{ displayName?: string; emailAddress?: string }>;
}

export interface SheetTabInfo {
  sheetId: number;
  title: string;
  rowCount: number;
  columnCount: number;
}

export interface SpreadsheetMetadata {
  spreadsheetId: string;
  title: string;
  spreadsheetUrl: string;
  sheets: SheetTabInfo[];
}

export type ColumnType = 'currency' | 'percent' | 'number' | 'date' | 'category' | 'text';

export interface ColumnSchema {
  index: number;
  key: string;
  label: string;
  type: ColumnType;
  currencySymbol?: string;
  uniqueCount: number;
  nonEmptyCount: number;
  min?: number;
  max?: number;
  minDate?: string;
  maxDate?: string;
  sampleValues: string[];
}

export interface CellValue {
  raw: string | number | boolean | null;
  formatted: string;
  numericValue: number | null;
  dateTimestamp: number | null;
  isoDate: string | null;
  timeFormatted: string | null;
  hourOfDay: number | null;
}

export interface ParsedRow {
  rowIndex: number;
  cells: Record<string, CellValue>;
}

export interface ParsedSheetDataset {
  spreadsheetId: string;
  spreadsheetTitle: string;
  spreadsheetUrl: string;
  sheetTitle: string;
  headerRowIndex: number;
  rawRowCount: number;
  columns: ColumnSchema[];
  rows: ParsedRow[];
  syncedAt: Date;
}

export type PeriodPreset = 'day' | 'week' | 'month' | 'year' | 'all' | 'custom';

export interface ClickColumnMapping {
  siteCol: string | null;
  pageCol: string | null;
  dateCol: string | null;
  timeCol: string | null;
  clicksCol: string | null; // null means 1 row = 1 click
  userCol?: string | null;
  newUserCol?: string | null;
  nameCol?: string | null;
  cityCol?: string | null;
  deviceCol?: string | null;
  visitorTypeCol?: string | null;
}

export type VisitorTrafficType = 'human' | 'bot' | 'unknown';

export interface ClickEventRecord {
  rowIndex: number;
  site: string;
  page: string;
  isoDate: string | null;
  dateFormatted: string;
  timeFormatted: string;
  hourOfDay: number | null;
  timestamp: number | null;
  clicks: number;
  userId: string | null;
  userName: string | null;
  city: string | null;
  device: string | null;
  isNewUserFlag: boolean | null;
  visitorType: VisitorTrafficType;
  visitorTypeLabel: string | null;
  rawRow: ParsedRow;
}

export interface SiteAggregate {
  site: string;
  clicks: number;
  humanClicks: number;
  humanPeopleCount: number;
  botClicks: number;
  sharePct: number;
  uniquePages: number;
  uniqueUsers: number;
  newUsers: number;
  lastDateFormatted: string;
  lastTimeFormatted: string;
  peakHour: number | null;
}

export interface PageAggregate {
  site: string;
  page: string;
  clicks: number;
  humanClicks: number;
  humanPeopleCount: number;
  botClicks: number;
  sharePct: number;
  lastDateFormatted: string;
  lastTimeFormatted: string;
  peakHour: number | null;
}

export interface UserDaySummary {
  dayKey: string;
  isoDate: string | null;
  dateFormatted: string;
  clicks: number;
  sites: string[];
  events: ClickEventRecord[];
}

export interface UserSiteSummary {
  site: string;
  clicks: number;
  isNewOnSite: boolean;
  daysCount: number;
}

export interface UserAggregate {
  userId: string;
  userName: string | null;
  cities: string[];
  devices: string[];
  visitorType: VisitorTrafficType | 'mixed';
  humanClicks: number;
  botClicks: number;
  isNewUser: boolean;
  firstIsoDate: string | null;
  firstDateFormatted: string;
  firstSite: string;
  clicksInPeriod: number;
  totalHistoricClicks: number;
  activeDaysCount: number;
  totalHistoricDaysCount: number;
  lastDateFormatted: string;
  lastTimeFormatted: string;
  lastTimestamp: number;
  sites: UserSiteSummary[];
  days: UserDaySummary[];
}

export interface SiteUsersAggregate {
  site: string;
  newUsers: number;
  uniqueUsers: number;
  returningUsers: number;
  newUserClicks: number;
  totalClicks: number;
  humanClicks: number;
  botClicks: number;
  shareOfNewUsersPct: number;
}

export interface UsersAnalyticsSummary {
  hasUserCol: boolean;
  totalNewUsers: number;
  totalUniqueUsers: number;
  totalReturningUsers: number;
  newUserClicks: number;
  totalIdentifiedClicks: number;
  totalHumanClicks: number;
  totalHumanPeopleCount: number;
  totalBotClicks: number;
  unidentifiedEventsCount: number;
  bySite: SiteUsersAggregate[];
  users: UserAggregate[];
}

export interface HourlyBucket {
  hour: number;
  label: string;
  clicks: number;
}

export interface TimelineBucket {
  key: string;
  label: string;
  clicks: number;
}

export type SyncIntervalSeconds = 0 | 5 | 15 | 30 | 60;

export interface SyncDiffSummary {
  addedRows: number;
  removedRows: number;
  updatedCells: number;
  timestamp: Date;
}

export interface RealPersonPageVisit {
  site: string;
  page: string;
  clicks: number;
  lastDateFormatted: string;
  lastTimeFormatted: string;
}

export interface RealPersonSiteVisit {
  site: string;
  clicks: number;
  isNewOnSite: boolean;
  firstDateOnSite: string;
  historicClicksOnSite: number;
  historicDaysOnSite: number;
  pages: RealPersonPageVisit[];
}

export interface RealPersonEventItem extends ClickEventRecord {
  isNewOnSite: boolean;
}

export interface RealPersonDetail {
  key: string;
  displayName: string;
  userId: string | null;
  isIdentified: boolean;
  totalHumanClicks: number;
  isNewOverall: boolean;
  cities: string[];
  devices: string[];
  firstDateFormatted: string;
  firstTimeFormatted: string;
  lastDateFormatted: string;
  lastTimeFormatted: string;
  lastTimestamp: number;
  sites: RealPersonSiteVisit[];
  pages: RealPersonPageVisit[];
  events: RealPersonEventItem[];
}

export interface RealPeopleSummary {
  totalHumanClicks: number;
  totalBotClicks: number;
  totalPeopleCount: number;
  newPeopleCount: number;
  returningPeopleCount: number;
  people: RealPersonDetail[];
  events: RealPersonEventItem[];
}

