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
}

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
  rawRow: ParsedRow;
}

export interface SiteAggregate {
  site: string;
  clicks: number;
  sharePct: number;
  uniquePages: number;
  lastDateFormatted: string;
  lastTimeFormatted: string;
  peakHour: number | null;
}

export interface PageAggregate {
  site: string;
  page: string;
  clicks: number;
  sharePct: number;
  lastDateFormatted: string;
  lastTimeFormatted: string;
  peakHour: number | null;
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
