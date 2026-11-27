import {
  CellValue,
  ClickColumnMapping,
  ClickEventRecord,
  ColumnSchema,
  ColumnType,
  HourlyBucket,
  PageAggregate,
  ParsedRow,
  ParsedSheetDataset,
  PeriodPreset,
  RealPeopleSummary,
  RealPersonDetail,
  RealPersonEventItem,
  RealPersonPageVisit,
  RealPersonSiteVisit,
  SiteAggregate,
  SiteUsersAggregate,
  SpreadsheetMetadata,
  SyncDiffSummary,
  TimelineBucket,
  UserAggregate,
  UserDaySummary,
  UserSiteSummary,
  UsersAnalyticsSummary,
  VisitorTrafficType,
} from '../types/sheets';
import { SheetRawValues } from '../services/googleSheetsApi';

const CURRENCY_REGEX = /(R\$|US\$|\$|€|£)/;

const PT_MONTHS: Record<string, number> = {
  jan: 1,
  janeiro: 1,
  fev: 2,
  fevereiro: 2,
  feb: 2,
  mar: 3,
  marco: 3,
  abr: 4,
  abril: 4,
  apr: 4,
  mai: 5,
  maio: 5,
  may: 5,
  jun: 6,
  junho: 6,
  jul: 7,
  julho: 7,
  ago: 8,
  agosto: 8,
  aug: 8,
  set: 9,
  setembro: 9,
  sep: 9,
  out: 10,
  outubro: 10,
  oct: 10,
  nov: 11,
  novembro: 11,
  dez: 12,
  dezembro: 12,
  dec: 12,
};

export function detectBestHeaderRow(formattedRows: string[][]): number {
  if (formattedRows.length === 0) return 0;

  // In almost all spreadsheets, row 0 is the header row if it has >= 2 non-empty cells.
  const firstRowNonEmpty = (formattedRows[0] ?? []).filter(
    (cell) => String(cell ?? '').trim() !== ''
  );
  if (firstRowNonEmpty.length >= 2) {
    return 0;
  }

  // Only scan further if row 0 is empty or a single-cell banner title
  const scanLimit = Math.min(formattedRows.length, 8);
  let bestIdx = 0;
  let bestScore = firstRowNonEmpty.length;

  for (let i = 1; i < scanLimit; i++) {
    const row = formattedRows[i] ?? [];
    const nonEmpty = row.filter((cell) => String(cell ?? '').trim() !== '');
    if (nonEmpty.length === 0) continue;

    const textLabels = nonEmpty.filter((cell) => {
      const str = String(cell).trim();
      return isNaN(Number(str.replace(/[.,R$\s%]/g, '')));
    });

    const score = nonEmpty.length * 2 + textLabels.length * 3 - i * 0.5;
    if (score > bestScore && nonEmpty.length >= 2) {
      bestScore = score;
      bestIdx = i;
    }
  }

  return bestIdx;
}

export function parseNumericFromCell(
  raw: string | number | boolean | null,
  formatted: string
): number | null {
  if (typeof raw === 'number' && !Number.isNaN(raw)) {
    return raw;
  }

  const str = formatted.trim();
  if (!str) return null;

  if (
    /^\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}/.test(str) ||
    /^\d{4}[\/.\-]\d{1,2}[\/.\-]\d{1,2}/.test(str) ||
    /^\d{1,2}:\d{2}/.test(str)
  ) {
    return null;
  }

  let cleaned = str.replace(/R\$|US\$|\$|€|£|\s/g, '').replace(/%/g, '');
  if (!cleaned || !/^-?[\d.,]+$/.test(cleaned)) {
    return null;
  }

  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');

  if (hasComma && hasDot) {
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    if (lastComma > lastDot) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (hasComma) {
    const parts = cleaned.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      cleaned = cleaned.replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (hasDot) {
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      cleaned = cleaned.replace(/\./g, '');
    }
  }

  const parsed = Number(cleaned);
  if (Number.isNaN(parsed)) return null;

  if (str.includes('%') && typeof raw !== 'number') {
    return parsed / 100;
  }
  return parsed;
}

export function parseTimeFromString(
  value: string,
  raw?: string | number | boolean | null
): {
  timeFormatted: string;
  hourOfDay: number;
} | null {
  const str = value.trim();

  // Match HH:MM:SS or HH:MM anywhere in a standalone time string (supports AM/PM, ms, timezone)
  if (str) {
    const timeMatch = str.match(
      /^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(?:\s*(AM|PM))?(?:\s*[A-Z]{2,5}(?:[+-]\d{2,4})?)?$/i
    );
    if (timeMatch) {
      let hour = Number(timeMatch[1]);
      const minute = Number(timeMatch[2]);
      const second = timeMatch[3] ? Number(timeMatch[3]) : null;
      const ampm = timeMatch[4]?.toUpperCase();

      if (ampm === 'PM' && hour < 12) hour += 12;
      if (ampm === 'AM' && hour === 12) hour = 0;

      if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
        const hh = String(hour).padStart(2, '0');
        const mm = String(minute).padStart(2, '0');
        const ss = second !== null ? `:${String(second).padStart(2, '0')}` : '';
        return {
          timeFormatted: `${hh}:${mm}${ss}`,
          hourOfDay: hour,
        };
      }
    }

    const ptMatch = str.match(/^(\d{1,2})h(\d{2})?$/i);
    if (ptMatch) {
      const hour = Number(ptMatch[1]);
      const minute = ptMatch[2] ? Number(ptMatch[2]) : 0;
      if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
        return {
          timeFormatted: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
          hourOfDay: hour,
        };
      }
    }
  }

  // Handle Google Sheets fractional day serial time (0 < raw < 1)
  if (typeof raw === 'number' && raw > 0 && raw < 1) {
    const totalSeconds = Math.round(raw * 86400);
    const hour = Math.floor(totalSeconds / 3600) % 24;
    const minute = Math.floor((totalSeconds % 3600) / 60);
    const second = totalSeconds % 60;
    return {
      timeFormatted: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`,
      hourOfDay: hour,
    };
  }

  return null;
}

function buildDateResult(
  year: number,
  month: number,
  day: number,
  hour: number | null,
  min: number,
  sec: number,
  hasSeconds: boolean
): {
  timestamp: number;
  isoDate: string;
  timeFormatted: string | null;
  hourOfDay: number | null;
} | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day, hour ?? 0, min, sec);
  if (Number.isNaN(date.getTime())) return null;

  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const timeFormatted =
    hour !== null && hour >= 0 && hour <= 23
      ? `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}${
          hasSeconds ? `:${String(sec).padStart(2, '0')}` : ''
        }`
      : null;

  return {
    timestamp: date.getTime(),
    isoDate: iso,
    timeFormatted,
    hourOfDay: hour !== null && hour >= 0 && hour <= 23 ? hour : null,
  };
}

export function parseDateFromString(
  value: string,
  preferMonthFirst = false
): {
  timestamp: number;
  isoDate: string;
  timeFormatted: string | null;
  hourOfDay: number | null;
} | null {
  const str = value.trim();
  if (!str) return null;

  // 1. YYYY-MM-DD or YYYY/MM/DD (ISO or slash-ISO, with optional time & Z/offset)
  const isoMatch = str.match(
    /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:[T\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(?:\s*(AM|PM))?(Z|[+-]\d{2}:?\d{2})?)?/i
  );
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    let hour = isoMatch[4] !== undefined ? Number(isoMatch[4]) : null;
    const min = isoMatch[5] !== undefined ? Number(isoMatch[5]) : 0;
    const sec = isoMatch[6] !== undefined ? Number(isoMatch[6]) : 0;
    const ampm = isoMatch[7]?.toUpperCase();
    const tz = isoMatch[8];

    if (tz && hour !== null) {
      const parsedUtc = new Date(str);
      if (!Number.isNaN(parsedUtc.getTime())) {
        return buildDateResult(
          parsedUtc.getFullYear(),
          parsedUtc.getMonth() + 1,
          parsedUtc.getDate(),
          parsedUtc.getHours(),
          parsedUtc.getMinutes(),
          parsedUtc.getSeconds(),
          true
        );
      }
    }

    if (hour !== null && ampm === 'PM' && hour < 12) hour += 12;
    if (hour !== null && ampm === 'AM' && hour === 12) hour = 0;

    return buildDateResult(
      year,
      month,
      day,
      hour,
      min,
      sec,
      isoMatch[6] !== undefined
    );
  }

  // 2. DD/MM/YYYY or MM/DD/YYYY or DD.MM.YYYY (with optional time & AM/PM)
  const slashMatch = str.match(
    /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})(?:[,\sT]+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?)?/i
  );
  if (slashMatch) {
    const p1 = Number(slashMatch[1]);
    const p2 = Number(slashMatch[2]);
    let year = Number(slashMatch[3]);
    if (year < 100) year += 2000;

    let day = p1;
    let month = p2;
    if (p2 > 12 && p1 <= 12) {
      // Unambiguously MM/DD/YYYY
      month = p1;
      day = p2;
    } else if (p1 > 12 && p2 <= 12) {
      // Unambiguously DD/MM/YYYY
      day = p1;
      month = p2;
    } else if (preferMonthFirst) {
      month = p1;
      day = p2;
    }

    let hour = slashMatch[4] !== undefined ? Number(slashMatch[4]) : null;
    const min = slashMatch[5] !== undefined ? Number(slashMatch[5]) : 0;
    const sec = slashMatch[6] !== undefined ? Number(slashMatch[6]) : 0;
    const ampm = slashMatch[7]?.toUpperCase();

    if (hour !== null && ampm === 'PM' && hour < 12) hour += 12;
    if (hour !== null && ampm === 'AM' && hour === 12) hour = 0;

    return buildDateResult(
      year,
      month,
      day,
      hour,
      min,
      sec,
      slashMatch[6] !== undefined
    );
  }

  // 3. Text month in Portuguese or English: "25/nov/2026", "25 de nov. de 2026", "Nov 25, 2026"
  const normalized = str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const ptTextMatch = normalized.match(
    /^(\d{1,2})\s*(?:de\s+)?([a-z]{3,})\.?\s*(?:de\s+)?(\d{4})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/
  );
  if (ptTextMatch) {
    const day = Number(ptTextMatch[1]);
    const month = PT_MONTHS[ptTextMatch[2]];
    const year = Number(ptTextMatch[3]);
    const hour = ptTextMatch[4] !== undefined ? Number(ptTextMatch[4]) : null;
    const min = ptTextMatch[5] !== undefined ? Number(ptTextMatch[5]) : 0;
    const sec = ptTextMatch[6] !== undefined ? Number(ptTextMatch[6]) : 0;
    if (month) {
      return buildDateResult(
        year,
        month,
        day,
        hour,
        min,
        sec,
        ptTextMatch[6] !== undefined
      );
    }
  }

  const enTextMatch = normalized.match(
    /^([a-z]{3,})\.?\s+(\d{1,2}),?\s+(\d{4})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(am|pm))?)?/
  );
  if (enTextMatch) {
    const month = PT_MONTHS[enTextMatch[1]];
    const day = Number(enTextMatch[2]);
    const year = Number(enTextMatch[3]);
    let hour = enTextMatch[4] !== undefined ? Number(enTextMatch[4]) : null;
    const min = enTextMatch[5] !== undefined ? Number(enTextMatch[5]) : 0;
    const sec = enTextMatch[6] !== undefined ? Number(enTextMatch[6]) : 0;
    const ampm = enTextMatch[7]?.toUpperCase();
    if (hour !== null && ampm === 'PM' && hour < 12) hour += 12;
    if (hour !== null && ampm === 'AM' && hour === 12) hour = 0;
    if (month) {
      return buildDateResult(
        year,
        month,
        day,
        hour,
        min,
        sec,
        enTextMatch[6] !== undefined
      );
    }
  }

  // 4. Short DD/MM without year -> assume current year
  const shortSlash = str.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (shortSlash) {
    const p1 = Number(shortSlash[1]);
    const p2 = Number(shortSlash[2]);
    const year = new Date().getFullYear();
    const day = preferMonthFirst ? p2 : p1;
    const month = preferMonthFirst ? p1 : p2;
    return buildDateResult(year, month, day, null, 0, 0, false);
  }

  return null;
}

export function buildParsedDataset(
  meta: SpreadsheetMetadata,
  sheetTitle: string,
  rawValues: SheetRawValues,
  explicitHeaderRow?: number
): ParsedSheetDataset {
  const { formattedRows, unformattedRows } = rawValues;
  const headerRowIndex =
    explicitHeaderRow !== undefined
      ? Math.max(
          0,
          Math.min(explicitHeaderRow, Math.max(0, formattedRows.length - 1))
        )
      : detectBestHeaderRow(formattedRows);

  const headerRow = formattedRows[headerRowIndex] ?? [];
  const maxCols = formattedRows.reduce(
    (max, r) => Math.max(max, r.length),
    headerRow.length
  );

  const usedKeys = new Set<string>();
  const rawColumns: Array<{ index: number; key: string; label: string }> = [];

  for (let c = 0; c < maxCols; c++) {
    const rawLabel = String(headerRow[c] ?? '').trim();
    const label = rawLabel || `Coluna ${c + 1}`;
    let key = label;
    let suffix = 2;
    while (usedKeys.has(key)) {
      key = `${label} (${suffix++})`;
    }
    usedKeys.add(key);
    rawColumns.push({ index: c, key, label });
  }

  // Detect per-column whether slash dates are MM/DD/YYYY (US) vs DD/MM/YYYY (BR)
  const colPreferMonthFirst = new Map<string, boolean>();
  for (const col of rawColumns) {
    let secondGt12 = 0;
    let firstGt12 = 0;
    for (
      let r = headerRowIndex + 1;
      r < Math.min(formattedRows.length, headerRowIndex + 200);
      r++
    ) {
      const val = String(formattedRows[r]?.[col.index] ?? '').trim();
      const m = val.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-]\d{2,4}/);
      if (m) {
        const p1 = Number(m[1]);
        const p2 = Number(m[2]);
        if (p2 > 12 && p1 <= 12) secondGt12++;
        if (p1 > 12 && p2 <= 12) firstGt12++;
      }
    }
    colPreferMonthFirst.set(col.key, secondGt12 > firstGt12);
  }

  const dataRows: ParsedRow[] = [];
  for (let r = headerRowIndex + 1; r < formattedRows.length; r++) {
    const fmtRow = formattedRows[r] ?? [];
    const unfRow = unformattedRows[r] ?? [];

    const hasAnyValue = fmtRow.some((cell) => String(cell ?? '').trim() !== '');
    if (!hasAnyValue) continue;

    const cells: Record<string, CellValue> = {};
    for (const col of rawColumns) {
      const formatted = String(fmtRow[col.index] ?? '').trim();
      const raw = unfRow[col.index] ?? null;
      const preferUS = colPreferMonthFirst.get(col.key) ?? false;
      const dateParsed = parseDateFromString(formatted, preferUS);
      const timeOnlyParsed = !dateParsed
        ? parseTimeFromString(formatted, raw)
        : null;
      const numericValue =
        dateParsed || timeOnlyParsed
          ? null
          : parseNumericFromCell(raw, formatted);

      cells[col.key] = {
        raw,
        formatted,
        numericValue,
        dateTimestamp: dateParsed?.timestamp ?? null,
        isoDate: dateParsed?.isoDate ?? null,
        timeFormatted:
          dateParsed?.timeFormatted ?? timeOnlyParsed?.timeFormatted ?? null,
        hourOfDay: dateParsed?.hourOfDay ?? timeOnlyParsed?.hourOfDay ?? null,
      };
    }

    dataRows.push({
      rowIndex: r + 1,
      cells,
    });
  }

  const columns: ColumnSchema[] = rawColumns.map((col) => {
    let nonEmptyCount = 0;
    let numericCount = 0;
    let currencyCount = 0;
    let percentCount = 0;
    let dateCount = 0;
    let detectedSymbol = 'R$';
    const uniqueValues = new Set<string>();
    let min: number | undefined;
    let max: number | undefined;
    let minDate: string | undefined;
    let maxDate: string | undefined;

    for (const row of dataRows) {
      const cell = row.cells[col.key];
      if (!cell || !cell.formatted) continue;
      nonEmptyCount++;
      uniqueValues.add(cell.formatted);

      if (cell.isoDate) {
        dateCount++;
        if (!minDate || cell.isoDate < minDate) minDate = cell.isoDate;
        if (!maxDate || cell.isoDate > maxDate) maxDate = cell.isoDate;
      }

      if (cell.numericValue !== null) {
        numericCount++;
        const symMatch = cell.formatted.match(CURRENCY_REGEX);
        if (symMatch) {
          currencyCount++;
          detectedSymbol = symMatch[1];
        }
        if (cell.formatted.includes('%')) {
          percentCount++;
        }
        if (min === undefined || cell.numericValue < min) min = cell.numericValue;
        if (max === undefined || cell.numericValue > max) max = cell.numericValue;
      }
    }

    let type: ColumnType = 'text';
    if (nonEmptyCount > 0) {
      const dateRatio = dateCount / nonEmptyCount;
      const numRatio = numericCount / nonEmptyCount;

      if (dateRatio >= 0.5) {
        type = 'date';
      } else if (numRatio >= 0.65) {
        if (currencyCount / numericCount >= 0.4) {
          type = 'currency';
        } else if (percentCount / numericCount >= 0.4) {
          type = 'percent';
        } else {
          type = 'number';
        }
      } else if (
        uniqueValues.size >= 1 &&
        uniqueValues.size <= Math.max(30, Math.floor(dataRows.length * 0.45))
      ) {
        type = 'category';
      }
    }

    return {
      index: col.index,
      key: col.key,
      label: col.label,
      type,
      currencySymbol: type === 'currency' ? detectedSymbol : undefined,
      uniqueCount: uniqueValues.size,
      nonEmptyCount,
      min,
      max,
      minDate,
      maxDate,
      sampleValues: Array.from(uniqueValues).slice(0, 5),
    };
  });

  const activeColumns = columns.filter(
    (col) => col.nonEmptyCount > 0 || !col.label.startsWith('Coluna ')
  );

  return {
    spreadsheetId: meta.spreadsheetId,
    spreadsheetTitle: meta.title,
    spreadsheetUrl: meta.spreadsheetUrl,
    sheetTitle,
    headerRowIndex,
    rawRowCount: formattedRows.length,
    columns: activeColumns,
    rows: dataRows,
    syncedAt: new Date(),
  };
}

function normalizeLabel(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function classifyVisitorValue(
  rawValue: string | null | undefined,
  colLabelNorm?: string
): VisitorTrafficType {
  if (!rawValue) return 'unknown';
  const val = normalizeLabel(rawValue);
  if (!val || val === '-' || val === '—') return 'unknown';

  const isBotWord =
    val === 'robo' ||
    val === 'robos' ||
    val === 'bot' ||
    val === 'bots' ||
    val === 'crawler' ||
    val === 'spider' ||
    val === 'scraper' ||
    val === 'automacao' ||
    val === 'automatico' ||
    val === 'script' ||
    val === 'fake' ||
    val === 'falso' ||
    /\b(robo|robos|bot|bots|crawler|spider|scraper)\b/.test(val);

  const isNegatedBot =
    val.includes('nao robo') ||
    val.includes('nao e robo') ||
    val.includes('sem robo') ||
    val.includes('not bot') ||
    val.includes('no bot');

  if (isNegatedBot) return 'human';

  const isHumanWord =
    val === 'pessoa real' ||
    val === 'pessoa' ||
    val === 'pessoas' ||
    val === 'humano' ||
    val === 'humana' ||
    val === 'human' ||
    val === 'real' ||
    val === 'usuario real' ||
    val === 'visitante real' ||
    val === 'legitimo' ||
    val === 'valido' ||
    val.includes('pessoa real') ||
    val.includes('humano') ||
    val.includes('humana') ||
    val.includes('usuario real') ||
    val.includes('visitante real');

  if (isHumanWord && !isBotWord) return 'human';
  if (isBotWord) return 'bot';

  const isTrueBool =
    val === 'sim' ||
    val === 's' ||
    val === 'yes' ||
    val === 'true' ||
    val === '1' ||
    val === 'verdadeiro';
  const isFalseBool =
    val === 'nao' ||
    val === 'n' ||
    val === 'no' ||
    val === 'false' ||
    val === '0' ||
    val === 'falso';

  if ((isTrueBool || isFalseBool) && colLabelNorm) {
    const headerAsksBot =
      (colLabelNorm.includes('robo') || /\bbot\b/.test(colLabelNorm)) &&
      !colLabelNorm.includes('pessoa') &&
      !colLabelNorm.includes('human');
    if (headerAsksBot) {
      return isTrueBool ? 'bot' : 'human';
    }
    return isTrueBool ? 'human' : 'bot';
  }

  return 'unknown';
}

export function inferClickColumnMapping(
  columns: ColumnSchema[],
  rows: ParsedRow[]
): ClickColumnMapping {
  const findByKeywords = (keywords: string[], excludeKeys: Set<string>) => {
    for (const kw of keywords) {
      const match = columns.find(
        (c) => !excludeKeys.has(c.key) && normalizeLabel(c.label).includes(kw)
      );
      if (match) return match.key;
    }
    return null;
  };

  const findByWordToken = (tokens: string[], excludeKeys: Set<string>) => {
    for (const token of tokens) {
      const re = new RegExp(`(^|[\\s_\\-/])${token}($|[\\s_\\-/])`);
      const match = columns.find(
        (c) => !excludeKeys.has(c.key) && re.test(normalizeLabel(c.label))
      );
      if (match) return match.key;
    }
    return null;
  };

  const used = new Set<string>();

  // 0. Visitor Type: Real Person vs Bot (check before site/name/user so "Origem (Pessoa/Robô)" or "Pessoa Real" isn't stolen)
  let visitorTypeCol = findByKeywords(
    [
      'pessoa_real',
      'pessoa real',
      'pessoa_ou_robo',
      'pessoa ou robo',
      'pessoa/robo',
      'humano_ou_robo',
      'humano ou robo',
      'tipo_clique',
      'tipo_acesso',
      'tipo_visitante',
      'origem_clique',
      'eh_robo',
      'e_robo',
      'is_bot',
      'is_human',
      'autenticidade',
      'crawler',
    ],
    used
  );
  if (!visitorTypeCol) {
    visitorTypeCol = findByWordToken(
      ['robo', 'robos', 'bot', 'bots', 'humano', 'humanos', 'humana', 'trafego'],
      used
    );
  }
  if (!visitorTypeCol) {
    const sampleCol = columns.find((c) => {
      if (
        used.has(c.key) ||
        c.type === 'date' ||
        c.type === 'currency' ||
        c.type === 'percent' ||
        c.type === 'number'
      ) {
        return false;
      }
      const samples = rows
        .slice(0, 25)
        .map((r) => (r.cells[c.key]?.formatted ?? '').trim())
        .filter(Boolean);
      if (samples.length === 0) return false;
      const colNorm = normalizeLabel(c.label);
      const hits = samples.filter(
        (v) => classifyVisitorValue(v, colNorm) !== 'unknown'
      ).length;
      return hits >= Math.max(1, Math.ceil(samples.length * 0.35));
    });
    if (sampleCol) visitorTypeCol = sampleCol.key;
  }
  if (visitorTypeCol) used.add(visitorTypeCol);

  // 1. Site
  let siteCol = findByKeywords(
    [
      'site',
      'dominio',
      'domain',
      'host',
      'portal',
      'website',
      'origem',
      'marca',
      'projeto',
    ],
    used
  );
  if (siteCol) used.add(siteCol);

  // 2. Page
  let pageCol = findByKeywords(
    [
      'pagina',
      'page',
      'caminho',
      'path',
      'rota',
      'url',
      'link',
      'destino',
      'slug',
      'titulo',
      'title',
      'secao',
      'botao',
      'elemento',
      'evento',
    ],
    used
  );
  if (pageCol) used.add(pageCol);

  // 3. Date
  let dateCol = findByKeywords(
    [
      'data',
      'date',
      'dia',
      'timestamp',
      'carimbo',
      'criado',
      'created',
      'registro',
      'acesso',
      'quando',
      'dt',
    ],
    used
  );
  if (!dateCol) {
    const firstDateCol = columns.find(
      (c) => !used.has(c.key) && c.type === 'date'
    );
    if (firstDateCol) dateCol = firstDateCol.key;
  }
  if (dateCol) used.add(dateCol);

  // 4. Time
  let timeCol = findByKeywords(['horario', 'hora', 'time', 'hour', 'hr'], used);
  if (!timeCol) {
    const timeCandidate = columns.find((c) => {
      if (used.has(c.key)) return false;
      const sampleHits = rows
        .slice(0, 15)
        .filter((r) => r.cells[c.key]?.timeFormatted !== null).length;
      return sampleHits >= Math.min(2, Math.max(1, rows.length));
    });
    if (timeCandidate) timeCol = timeCandidate.key;
  }
  if (timeCol) used.add(timeCol);

  // 5. Clicks count (only match numeric columns)
  const numericOnlyCols = columns.filter(
    (c) => c.type === 'number' || c.type === 'currency'
  );
  let clicksCol: string | null = null;
  for (const kw of [
    'clique',
    'click',
    'qtd',
    'quantidade',
    'count',
    'total',
    'acessos',
    'visitas',
    'hits',
    'views',
    'vezes',
    'numero',
  ]) {
    const m = numericOnlyCols.find(
      (c) => !used.has(c.key) && normalizeLabel(c.label).includes(kw)
    );
    if (m) {
      clicksCol = m.key;
      break;
    }
  }

  // 5b. Device / City / Name (detect before user fallback so Aparelho/Cidade/Nome are separated cleanly)
  let deviceCol = findByKeywords(
    [
      'aparelho',
      'dispositivo',
      'device',
      'celular',
      'smartphone',
      'mobile',
      'plataforma',
      'sistema',
      'navegador',
      'browser',
      'user_agent',
      'useragent',
      'modelo',
    ],
    used
  );
  if (!deviceCol) {
    deviceCol = findByWordToken(['os'], used);
  }
  if (deviceCol) used.add(deviceCol);

  let cityCol = findByKeywords(
    [
      'cidade',
      'city',
      'municipio',
      'localidade',
      'regiao',
      'origem_cidade',
      'bairro',
    ],
    used
  );
  if (!cityCol) {
    cityCol = findByWordToken(['local', 'estado', 'uf'], used);
  }
  if (cityCol) used.add(cityCol);

  let nameCol = findByKeywords(
    ['nome_completo', 'nome_usuario', 'nome_cliente', 'autor'],
    used
  );
  if (!nameCol) {
    nameCol = findByWordToken(['nome', 'name'], used);
  }
  if (nameCol) used.add(nameCol);

  // 5c. User / Visitor / IP identifier (detect before generic site/page fallbacks)
  let userCol = findByKeywords(
    [
      'usuario',
      'user_id',
      'userid',
      'id_usuario',
      'visitante',
      'visitor',
      'cliente',
      'client_id',
      'email',
      'e-mail',
      'sessao',
      'session',
      'fingerprint',
      'cookie',
      'identificador',
      'whatsapp',
      'telefone',
      'lead',
      'endereco_ip',
      'ip_address',
    ],
    used
  );
  if (!userCol) {
    userCol = findByWordToken(['user', 'uid', 'ip', 'contato', 'id'], used);
  }
  if (!userCol) {
    const patternCol = columns.find((c) => {
      if (
        used.has(c.key) ||
        c.type === 'date' ||
        c.type === 'currency' ||
        c.type === 'percent'
      ) {
        return false;
      }
      const samples = rows
        .slice(0, 15)
        .map((r) => (r.cells[c.key]?.formatted ?? '').trim())
        .filter(Boolean);
      if (samples.length === 0) return false;
      const hits = samples.filter(
        (v) =>
          /^(\d{1,3}\.){3}\d{1,3}$/.test(v) ||
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
      ).length;
      return hits >= Math.ceil(samples.length * 0.6);
    });
    if (patternCol) userCol = patternCol.key;
  }
  // If sheet only has Nome (and no separate ID/IP), use Nome as user identifier too
  if (!userCol && nameCol) {
    userCol = nameCol;
  }
  if (userCol) used.add(userCol);

  // 5d. Explicit New User indicator column (optional)
  let newUserCol = findByKeywords(
    [
      'novo_usuario',
      'usuario_novo',
      'new_user',
      'is_new',
      'primeira_vez',
      'first_visit',
      'tipo_usuario',
      'tipo_visitante',
      'recorrente',
    ],
    used
  );
  if (!newUserCol) {
    newUserCol = findByWordToken(['novo', 'nova', 'new'], used);
  }
  if (newUserCol) used.add(newUserCol);

  // Fallback for page if still missing
  if (!pageCol) {
    const urlLikeCol = columns.find((c) => {
      if (used.has(c.key)) return false;
      return rows
        .slice(0, 10)
        .some((r) => /https?:\/\/|^\//i.test(r.cells[c.key]?.formatted ?? ''));
    });
    if (urlLikeCol) {
      pageCol = urlLikeCol.key;
      used.add(pageCol);
    }
  }

  // Only fallback siteCol to a category column if pageCol does NOT already contain full URLs
  if (!siteCol) {
    const pageHasFullUrls =
      pageCol &&
      rows
        .slice(0, 15)
        .some((r) => /^https?:\/\//i.test(r.cells[pageCol!]?.formatted ?? ''));
    if (!pageHasFullUrls) {
      const catCol = columns.find(
        (c) => !used.has(c.key) && (c.type === 'category' || c.type === 'text')
      );
      if (catCol) {
        siteCol = catCol.key;
        used.add(siteCol);
      }
    }
  }

  if (!pageCol) {
    const textCol = columns.find(
      (c) => !used.has(c.key) && (c.type === 'text' || c.type === 'category')
    );
    if (textCol) {
      pageCol = textCol.key;
      used.add(pageCol);
    }
  }

  return {
    siteCol,
    pageCol,
    dateCol,
    timeCol,
    clicksCol,
    userCol,
    newUserCol,
    nameCol,
    cityCol,
    deviceCol,
    visitorTypeCol,
  };
}

function cleanSiteName(rawSite: string): string {
  const trimmed = rawSite.trim();
  if (!trimmed) return 'Site não informado';
  try {
    if (/^https?:\/\//i.test(trimmed)) {
      const url = new URL(trimmed);
      return url.hostname.replace(/^www\./i, '');
    }
    if (/^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(trimmed)) {
      return trimmed.split('/')[0].replace(/^www\./i, '');
    }
  } catch {
    // Use as-is
  }
  return trimmed.replace(/^www\./i, '');
}

function cleanPageName(rawPage: string, fallbackSite: string): string {
  const trimmed = rawPage.trim();
  if (!trimmed) return '/';
  try {
    if (/^https?:\/\//i.test(trimmed)) {
      const url = new URL(trimmed);
      const path = `${url.pathname}${url.search}` || '/';
      return path;
    }
  } catch {
    // Use as-is
  }
  if (trimmed === fallbackSite) return '/';
  return trimmed;
}

export function buildClickEvents(
  rows: ParsedRow[],
  mapping: ClickColumnMapping
): ClickEventRecord[] {
  return rows.map((row) => {
    const rawSiteVal = mapping.siteCol
      ? row.cells[mapping.siteCol]?.formatted ?? ''
      : '';
    const rawPageVal = mapping.pageCol
      ? row.cells[mapping.pageCol]?.formatted ?? ''
      : '';

    let site = cleanSiteName(rawSiteVal);
    if (
      (!mapping.siteCol || !rawSiteVal.trim()) &&
      (/^https?:\/\//i.test(rawPageVal) ||
        /^[a-z0-9.-]+\.[a-z]{2,}\//i.test(rawPageVal))
    ) {
      site = cleanSiteName(rawPageVal);
    }

    const page = cleanPageName(rawPageVal, site);

    const dateCell = mapping.dateCol ? row.cells[mapping.dateCol] : undefined;
    const timeCell = mapping.timeCol ? row.cells[mapping.timeCol] : undefined;

    const isoDate = dateCell?.isoDate ?? null;
    const dateFormatted = isoDate
      ? `${isoDate.slice(8, 10)}/${isoDate.slice(5, 7)}/${isoDate.slice(0, 4)}`
      : dateCell?.formatted || '—';

    const timeFormatted =
      timeCell?.timeFormatted ||
      dateCell?.timeFormatted ||
      timeCell?.formatted ||
      '—';

    const hourOfDay = timeCell?.hourOfDay ?? dateCell?.hourOfDay ?? null;

    let timestamp = dateCell?.dateTimestamp ?? null;
    if (
      timestamp !== null &&
      hourOfDay !== null &&
      dateCell?.hourOfDay === null
    ) {
      const d = new Date(timestamp);
      const parts = timeFormatted.split(':');
      d.setHours(hourOfDay, Number(parts[1] ?? 0), Number(parts[2] ?? 0), 0);
      timestamp = d.getTime();
    }

    let clicks = 1;
    if (mapping.clicksCol) {
      const n = row.cells[mapping.clicksCol]?.numericValue;
      if (n !== null && n !== undefined && !Number.isNaN(n)) {
        clicks = Math.max(0, Math.round(n));
      }
    }

    const cleanOptionalCell = (colKey?: string | null): string | null => {
      if (!colKey) return null;
      const val = (row.cells[colKey]?.formatted ?? '').trim();
      if (!val || val === '-' || val === '—') return null;
      return val;
    };

    const userName = cleanOptionalCell(mapping.nameCol);
    const city = cleanOptionalCell(mapping.cityCol);
    const device = cleanOptionalCell(mapping.deviceCol);
    const userId = cleanOptionalCell(mapping.userCol) ?? userName;
    const visitorTypeLabel = cleanOptionalCell(mapping.visitorTypeCol);
    const visitorType = classifyVisitorValue(
      visitorTypeLabel,
      mapping.visitorTypeCol ? normalizeLabel(mapping.visitorTypeCol) : undefined
    );

    let isNewUserFlag: boolean | null = null;
    if (mapping.newUserCol) {
      const flagVal = normalizeLabel(
        row.cells[mapping.newUserCol]?.formatted ?? ''
      );
      if (
        flagVal === 'sim' ||
        flagVal === 's' ||
        flagVal === 'yes' ||
        flagVal === 'true' ||
        flagVal === '1' ||
        flagVal === 'novo' ||
        flagVal === 'nova' ||
        flagVal === 'new' ||
        flagVal.includes('novo') ||
        flagVal.includes('primeira') ||
        flagVal.includes('1a vez')
      ) {
        isNewUserFlag = true;
      } else if (
        flagVal === 'nao' ||
        flagVal === 'n' ||
        flagVal === 'no' ||
        flagVal === 'false' ||
        flagVal === '0' ||
        flagVal.includes('recorrente') ||
        flagVal.includes('returning') ||
        flagVal.includes('antigo') ||
        flagVal.includes('existente') ||
        flagVal.includes('retorno')
      ) {
        isNewUserFlag = false;
      }
    }

    return {
      rowIndex: row.rowIndex,
      site,
      page,
      isoDate,
      dateFormatted,
      timeFormatted,
      hourOfDay,
      timestamp,
      clicks,
      userId,
      userName,
      city,
      device,
      isNewUserFlag,
      visitorType,
      visitorTypeLabel,
      rawRow: row,
    };
  });
}

export function getPeriodBounds(
  preset: PeriodPreset,
  referenceDate: Date = new Date()
): { startIso: string | null; endIso: string | null; label: string } {
  const toIso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;

  if (preset === 'all' || preset === 'custom') {
    return { startIso: null, endIso: null, label: 'Todo o período' };
  }

  const today = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  );

  if (preset === 'day') {
    const iso = toIso(today);
    return {
      startIso: iso,
      endIso: iso,
      label: `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`,
    };
  }

  if (preset === 'week') {
    const dayOfWeek = today.getDay();
    const diffToMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const start = new Date(today);
    start.setDate(today.getDate() - diffToMon);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return {
      startIso: toIso(start),
      endIso: toIso(end),
      label: `${String(start.getDate()).padStart(2, '0')}/${String(
        start.getMonth() + 1
      ).padStart(2, '0')} – ${String(end.getDate()).padStart(2, '0')}/${String(
        end.getMonth() + 1
      ).padStart(2, '0')}`,
    };
  }

  if (preset === 'month') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const monthName = new Intl.DateTimeFormat('pt-BR', {
      month: 'long',
      year: 'numeric',
    }).format(today);
    return {
      startIso: toIso(start),
      endIso: toIso(end),
      label: monthName.charAt(0).toUpperCase() + monthName.slice(1),
    };
  }

  const start = `${today.getFullYear()}-01-01`;
  const end = `${today.getFullYear()}-12-31`;
  return {
    startIso: start,
    endIso: end,
    label: `Ano ${today.getFullYear()}`,
  };
}

export function filterClickEvents(
  events: ClickEventRecord[],
  options: {
    period: PeriodPreset;
    referenceDate: Date;
    customStart?: string;
    customEnd?: string;
    search?: string;
    selectedHour?: number | null;
  }
): ClickEventRecord[] {
  const { period, referenceDate, customStart, customEnd, search, selectedHour } =
    options;
  const searchLower = search?.trim().toLowerCase() ?? '';

  let startIso: string | null = null;
  let endIso: string | null = null;

  if (period === 'custom') {
    startIso = customStart || null;
    endIso = customEnd || null;
  } else if (period !== 'all') {
    const bounds = getPeriodBounds(period, referenceDate);
    startIso = bounds.startIso;
    endIso = bounds.endIso;
  }

  return events.filter((ev) => {
    if (startIso || endIso) {
      if (!ev.isoDate) return false;
      if (startIso && ev.isoDate < startIso) return false;
      if (endIso && ev.isoDate > endIso) return false;
    }

    if (selectedHour !== null && selectedHour !== undefined) {
      if (ev.hourOfDay !== selectedHour) return false;
    }

    if (searchLower) {
      const hay =
        `${ev.site} ${ev.page} ${ev.dateFormatted} ${ev.timeFormatted} ${ev.userName ?? ''} ${ev.userId ?? ''} ${ev.city ?? ''} ${ev.device ?? ''} ${ev.visitorTypeLabel ?? ''}`.toLowerCase();
      if (!hay.includes(searchLower)) return false;
    }

    return true;
  });
}

function getPeakHour(hourCounts: Map<number, number>): number | null {
  let bestHour: number | null = null;
  let bestCount = -1;
  for (const [hr, cnt] of hourCounts.entries()) {
    if (cnt > bestCount) {
      bestCount = cnt;
      bestHour = hr;
    }
  }
  return bestHour;
}

export function aggregateBySite(
  events: ClickEventRecord[],
  newUsersBySiteMap?: Map<string, number>
): SiteAggregate[] {
  const totalClicks = events.reduce((acc, e) => acc + e.clicks, 0);
  const map = new Map<
    string,
    {
      clicks: number;
      humanClicks: number;
      botClicks: number;
      pages: Set<string>;
      users: Set<string>;
      lastTs: number;
      lastDate: string;
      lastTime: string;
      hours: Map<number, number>;
    }
  >();

  for (const ev of events) {
    let entry = map.get(ev.site);
    if (!entry) {
      entry = {
        clicks: 0,
        humanClicks: 0,
        botClicks: 0,
        pages: new Set(),
        users: new Set(),
        lastTs: -1,
        lastDate: ev.dateFormatted,
        lastTime: ev.timeFormatted,
        hours: new Map(),
      };
      map.set(ev.site, entry);
    }

    entry.clicks += ev.clicks;
    if (ev.visitorType === 'human') entry.humanClicks += ev.clicks;
    else if (ev.visitorType === 'bot') entry.botClicks += ev.clicks;
    entry.pages.add(ev.page);
    if (ev.userId) {
      entry.users.add(ev.userId);
    }

    if (ev.hourOfDay !== null) {
      entry.hours.set(
        ev.hourOfDay,
        (entry.hours.get(ev.hourOfDay) ?? 0) + ev.clicks
      );
    }

    const ts = ev.timestamp ?? ev.rowIndex;
    if (ts >= entry.lastTs) {
      entry.lastTs = ts;
      entry.lastDate = ev.dateFormatted;
      entry.lastTime = ev.timeFormatted;
    }
  }

  return Array.from(map.entries())
    .map(([site, d]) => ({
      site,
      clicks: d.clicks,
      humanClicks: d.humanClicks,
      botClicks: d.botClicks,
      sharePct: totalClicks > 0 ? (d.clicks / totalClicks) * 100 : 0,
      uniquePages: d.pages.size,
      uniqueUsers: d.users.size,
      newUsers: newUsersBySiteMap?.get(site) ?? 0,
      lastDateFormatted: d.lastDate,
      lastTimeFormatted: d.lastTime,
      peakHour: getPeakHour(d.hours),
    }))
    .sort((a, b) => b.clicks - a.clicks);
}

export function aggregatePages(
  events: ClickEventRecord[],
  selectedSite: string | null
): PageAggregate[] {
  const scoped = selectedSite
    ? events.filter((e) => e.site === selectedSite)
    : events;
  const totalClicks = scoped.reduce((acc, e) => acc + e.clicks, 0);

  const map = new Map<
    string,
    {
      site: string;
      page: string;
      clicks: number;
      humanClicks: number;
      botClicks: number;
      lastTs: number;
      lastDate: string;
      lastTime: string;
      hours: Map<number, number>;
    }
  >();

  for (const ev of scoped) {
    const key = selectedSite ? ev.page : `${ev.site}|||${ev.page}`;
    let entry = map.get(key);
    if (!entry) {
      entry = {
        site: ev.site,
        page: ev.page,
        clicks: 0,
        humanClicks: 0,
        botClicks: 0,
        lastTs: -1,
        lastDate: ev.dateFormatted,
        lastTime: ev.timeFormatted,
        hours: new Map(),
      };
      map.set(key, entry);
    }

    entry.clicks += ev.clicks;
    if (ev.visitorType === 'human') entry.humanClicks += ev.clicks;
    else if (ev.visitorType === 'bot') entry.botClicks += ev.clicks;
    if (ev.hourOfDay !== null) {
      entry.hours.set(
        ev.hourOfDay,
        (entry.hours.get(ev.hourOfDay) ?? 0) + ev.clicks
      );
    }

    const ts = ev.timestamp ?? ev.rowIndex;
    if (ts >= entry.lastTs) {
      entry.lastTs = ts;
      entry.lastDate = ev.dateFormatted;
      entry.lastTime = ev.timeFormatted;
    }
  }

  return Array.from(map.values())
    .map((d) => ({
      site: d.site,
      page: d.page,
      clicks: d.clicks,
      humanClicks: d.humanClicks,
      botClicks: d.botClicks,
      sharePct: totalClicks > 0 ? (d.clicks / totalClicks) * 100 : 0,
      lastDateFormatted: d.lastDate,
      lastTimeFormatted: d.lastTime,
      peakHour: getPeakHour(d.hours),
    }))
    .sort((a, b) => b.clicks - a.clicks);
}

function compareEventOrder(a: ClickEventRecord, b: ClickEventRecord): number {
  if (a.isoDate && b.isoDate && a.isoDate !== b.isoDate) {
    return a.isoDate.localeCompare(b.isoDate);
  }
  if (a.timestamp !== null && b.timestamp !== null && a.timestamp !== b.timestamp) {
    return a.timestamp - b.timestamp;
  }
  return a.rowIndex - b.rowIndex;
}

export function analyzeUsers(
  allEvents: ClickEventRecord[],
  periodEvents: ClickEventRecord[],
  options: {
    period: PeriodPreset;
    referenceDate: Date;
    customStart?: string;
    customEnd?: string;
    hasUserCol: boolean;
  }
): UsersAnalyticsSummary {
  if (!options.hasUserCol) {
    let totalHumanClicks = 0;
    let totalBotClicks = 0;
    for (const ev of periodEvents) {
      if (ev.visitorType === 'human') totalHumanClicks += ev.clicks;
      else if (ev.visitorType === 'bot') totalBotClicks += ev.clicks;
    }
    return {
      hasUserCol: false,
      totalNewUsers: 0,
      totalUniqueUsers: 0,
      totalReturningUsers: 0,
      newUserClicks: 0,
      totalIdentifiedClicks: 0,
      totalHumanClicks,
      totalBotClicks,
      unidentifiedEventsCount: periodEvents.length,
      bySite: [],
      users: [],
    };
  }

  let startIso: string | null = null;
  let endIso: string | null = null;
  if (options.period === 'custom') {
    startIso = options.customStart || null;
    endIso = options.customEnd || null;
  } else if (options.period !== 'all') {
    const bounds = getPeriodBounds(options.period, options.referenceDate);
    startIso = bounds.startIso;
    endIso = bounds.endIso;
  }

  const hasWindowBounds = Boolean(startIso || endIso);
  const isInWindow = (isoDate: string | null): boolean => {
    if (!hasWindowBounds) return true;
    if (!isoDate) return false;
    if (startIso && isoDate < startIso) return false;
    if (endIso && isoDate > endIso) return false;
    return true;
  };

  interface HistoricUserInfo {
    totalClicks: number;
    days: Set<string>;
    firstEvent: ClickEventRecord;
    firstBySite: Map<string, ClickEventRecord>;
  }

  const historicMap = new Map<string, HistoricUserInfo>();
  for (const ev of allEvents) {
    if (!ev.userId) continue;
    const dayKey = ev.isoDate ?? (ev.dateFormatted !== '—' ? ev.dateFormatted : `row_${ev.rowIndex}`);
    let info = historicMap.get(ev.userId);
    if (!info) {
      info = {
        totalClicks: 0,
        days: new Set(),
        firstEvent: ev,
        firstBySite: new Map([[ev.site, ev]]),
      };
      historicMap.set(ev.userId, info);
    } else {
      if (compareEventOrder(ev, info.firstEvent) < 0) {
        info.firstEvent = ev;
      }
      const prevSiteFirst = info.firstBySite.get(ev.site);
      if (!prevSiteFirst || compareEventOrder(ev, prevSiteFirst) < 0) {
        info.firstBySite.set(ev.site, ev);
      }
    }
    info.totalClicks += ev.clicks;
    info.days.add(dayKey);
  }

  interface PeriodUserAcc {
    userId: string;
    userName: string | null;
    cities: Set<string>;
    devices: Set<string>;
    clicksInPeriod: number;
    humanClicks: number;
    botClicks: number;
    lastTs: number;
    lastDateFormatted: string;
    lastTimeFormatted: string;
    hasTrueFlag: boolean;
    hasFalseFlag: boolean;
    siteMap: Map<string, { clicks: number; days: Set<string> }>;
    dayMap: Map<
      string,
      {
        dayKey: string;
        isoDate: string | null;
        dateFormatted: string;
        clicks: number;
        sites: Set<string>;
        events: ClickEventRecord[];
      }
    >;
  }

  const periodUsersMap = new Map<string, PeriodUserAcc>();
  const siteTotalClicksMap = new Map<string, number>();
  const siteHumanClicksMap = new Map<string, number>();
  const siteBotClicksMap = new Map<string, number>();
  let unidentifiedEventsCount = 0;
  let totalIdentifiedClicks = 0;
  let totalHumanClicks = 0;
  let totalBotClicks = 0;

  for (const ev of periodEvents) {
    siteTotalClicksMap.set(
      ev.site,
      (siteTotalClicksMap.get(ev.site) ?? 0) + ev.clicks
    );
    if (ev.visitorType === 'human') {
      totalHumanClicks += ev.clicks;
      siteHumanClicksMap.set(
        ev.site,
        (siteHumanClicksMap.get(ev.site) ?? 0) + ev.clicks
      );
    } else if (ev.visitorType === 'bot') {
      totalBotClicks += ev.clicks;
      siteBotClicksMap.set(
        ev.site,
        (siteBotClicksMap.get(ev.site) ?? 0) + ev.clicks
      );
    }

    if (!ev.userId) {
      unidentifiedEventsCount += 1;
      continue;
    }

    totalIdentifiedClicks += ev.clicks;
    const dayKey = ev.isoDate ?? (ev.dateFormatted !== '—' ? ev.dateFormatted : `row_${ev.rowIndex}`);

    let acc = periodUsersMap.get(ev.userId);
    if (!acc) {
      acc = {
        userId: ev.userId,
        userName: ev.userName,
        cities: new Set(),
        devices: new Set(),
        clicksInPeriod: 0,
        humanClicks: 0,
        botClicks: 0,
        lastTs: -1,
        lastDateFormatted: ev.dateFormatted,
        lastTimeFormatted: ev.timeFormatted,
        hasTrueFlag: false,
        hasFalseFlag: false,
        siteMap: new Map(),
        dayMap: new Map(),
      };
      periodUsersMap.set(ev.userId, acc);
    }

    if (ev.userName) acc.userName = ev.userName;
    if (ev.city) acc.cities.add(ev.city);
    if (ev.device) acc.devices.add(ev.device);

    acc.clicksInPeriod += ev.clicks;
    if (ev.visitorType === 'human') acc.humanClicks += ev.clicks;
    else if (ev.visitorType === 'bot') acc.botClicks += ev.clicks;
    if (ev.isNewUserFlag === true) acc.hasTrueFlag = true;
    if (ev.isNewUserFlag === false) acc.hasFalseFlag = true;

    const ts = ev.timestamp ?? ev.rowIndex;
    if (ts >= acc.lastTs) {
      acc.lastTs = ts;
      acc.lastDateFormatted = ev.dateFormatted;
      acc.lastTimeFormatted = ev.timeFormatted;
    }

    let siteEntry = acc.siteMap.get(ev.site);
    if (!siteEntry) {
      siteEntry = { clicks: 0, days: new Set() };
      acc.siteMap.set(ev.site, siteEntry);
    }
    siteEntry.clicks += ev.clicks;
    siteEntry.days.add(dayKey);

    let dayEntry = acc.dayMap.get(dayKey);
    if (!dayEntry) {
      dayEntry = {
        dayKey,
        isoDate: ev.isoDate,
        dateFormatted: ev.dateFormatted,
        clicks: 0,
        sites: new Set(),
        events: [],
      };
      acc.dayMap.set(dayKey, dayEntry);
    }
    dayEntry.clicks += ev.clicks;
    dayEntry.sites.add(ev.site);
    dayEntry.events.push(ev);
  }

  const siteAggAcc = new Map<
    string,
    {
      uniqueUsers: number;
      newUsers: number;
      newUserClicks: number;
    }
  >();

  for (const site of siteTotalClicksMap.keys()) {
    siteAggAcc.set(site, {
      uniqueUsers: 0,
      newUsers: 0,
      newUserClicks: 0,
    });
  }

  let totalNewUsers = 0;
  let newUserClicks = 0;
  const users: UserAggregate[] = [];

  for (const acc of periodUsersMap.values()) {
    const hist = historicMap.get(acc.userId);
    const firstEv = hist?.firstEvent;

    let isNewUser = true;
    if (acc.hasTrueFlag) {
      isNewUser = true;
    } else if (acc.hasFalseFlag) {
      isNewUser = false;
    } else if (firstEv && hasWindowBounds) {
      isNewUser = isInWindow(firstEv.isoDate);
    }

    if (isNewUser) {
      totalNewUsers += 1;
      newUserClicks += acc.clicksInPeriod;
    }

    const sites: UserSiteSummary[] = [];
    for (const [site, sInfo] of acc.siteMap.entries()) {
      const firstOnSite = hist?.firstBySite.get(site);
      let isNewOnSite = isNewUser;
      if (!acc.hasTrueFlag && !acc.hasFalseFlag && firstOnSite && hasWindowBounds) {
        isNewOnSite = isInWindow(firstOnSite.isoDate);
      }

      sites.push({
        site,
        clicks: sInfo.clicks,
        isNewOnSite,
        daysCount: sInfo.days.size,
      });

      const sAgg = siteAggAcc.get(site);
      if (sAgg) {
        sAgg.uniqueUsers += 1;
        if (isNewOnSite) {
          sAgg.newUsers += 1;
          sAgg.newUserClicks += sInfo.clicks;
        }
      }
    }

    sites.sort((a, b) => b.clicks - a.clicks);

    const days: UserDaySummary[] = Array.from(acc.dayMap.values())
      .map((d) => ({
        dayKey: d.dayKey,
        isoDate: d.isoDate,
        dateFormatted: d.dateFormatted,
        clicks: d.clicks,
        sites: Array.from(d.sites),
        events: [...d.events].sort((a, b) => compareEventOrder(b, a)),
      }))
      .sort((a, b) => {
        if (a.isoDate && b.isoDate && a.isoDate !== b.isoDate) {
          return b.isoDate.localeCompare(a.isoDate);
        }
        return b.dayKey.localeCompare(a.dayKey);
      });

    const visitorType: VisitorTrafficType | 'mixed' =
      acc.humanClicks > 0 && acc.botClicks > 0
        ? 'mixed'
        : acc.humanClicks > 0
        ? 'human'
        : acc.botClicks > 0
        ? 'bot'
        : 'unknown';

    users.push({
      userId: acc.userId,
      userName: acc.userName,
      cities: Array.from(acc.cities),
      devices: Array.from(acc.devices),
      visitorType,
      humanClicks: acc.humanClicks,
      botClicks: acc.botClicks,
      isNewUser,
      firstIsoDate: firstEv?.isoDate ?? null,
      firstDateFormatted: firstEv?.dateFormatted ?? acc.lastDateFormatted,
      firstSite: firstEv?.site ?? sites[0]?.site ?? 'Site não informado',
      clicksInPeriod: acc.clicksInPeriod,
      totalHistoricClicks: hist?.totalClicks ?? acc.clicksInPeriod,
      activeDaysCount: days.length,
      totalHistoricDaysCount: hist?.days.size ?? days.length,
      lastDateFormatted: acc.lastDateFormatted,
      lastTimeFormatted: acc.lastTimeFormatted,
      lastTimestamp: acc.lastTs,
      sites,
      days,
    });
  }

  users.sort(
    (a, b) =>
      b.clicksInPeriod - a.clicksInPeriod ||
      b.activeDaysCount - a.activeDaysCount ||
      b.lastTimestamp - a.lastTimestamp
  );

  const bySite: SiteUsersAggregate[] = Array.from(siteAggAcc.entries())
    .map(([site, s]) => {
      const totalClicks = siteTotalClicksMap.get(site) ?? 0;
      return {
        site,
        newUsers: s.newUsers,
        uniqueUsers: s.uniqueUsers,
        returningUsers: Math.max(0, s.uniqueUsers - s.newUsers),
        newUserClicks: s.newUserClicks,
        totalClicks,
        humanClicks: siteHumanClicksMap.get(site) ?? 0,
        botClicks: siteBotClicksMap.get(site) ?? 0,
        shareOfNewUsersPct:
          totalNewUsers > 0 ? (s.newUsers / totalNewUsers) * 100 : 0,
      };
    })
    .sort((a, b) => b.newUsers - a.newUsers || b.totalClicks - a.totalClicks);

  return {
    hasUserCol: true,
    totalNewUsers,
    totalUniqueUsers: periodUsersMap.size,
    totalReturningUsers: Math.max(0, periodUsersMap.size - totalNewUsers),
    newUserClicks,
    totalIdentifiedClicks,
    totalHumanClicks,
    totalBotClicks,
    unidentifiedEventsCount,
    bySite,
    users,
  };
}

export function aggregateByHour(events: ClickEventRecord[]): HourlyBucket[] {
  const counts = new Array<number>(24).fill(0);
  for (const ev of events) {
    if (ev.hourOfDay !== null && ev.hourOfDay >= 0 && ev.hourOfDay <= 23) {
      counts[ev.hourOfDay] += ev.clicks;
    }
  }

  return counts.map((clicks, hour) => ({
    hour,
    label: `${String(hour).padStart(2, '0')}h`,
    clicks,
  }));
}

export function aggregateTimelineForPeriod(
  events: ClickEventRecord[],
  period: PeriodPreset,
  referenceDate: Date
): TimelineBucket[] {
  if (period === 'day') {
    return aggregateByHour(events).map((h) => ({
      key: String(h.hour),
      label: h.label,
      clicks: h.clicks,
    }));
  }

  if (period === 'week') {
    const bounds = getPeriodBounds('week', referenceDate);
    const startParts = (bounds.startIso ?? '').split('-').map(Number);
    const dayNames = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
    const buckets: TimelineBucket[] = [];

    if (startParts.length === 3) {
      const start = new Date(startParts[0], startParts[1] - 1, startParts[2]);
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
          2,
          '0'
        )}-${String(d.getDate()).padStart(2, '0')}`;
        const clicks = events
          .filter((e) => e.isoDate === iso)
          .reduce((acc, e) => acc + e.clicks, 0);
        buckets.push({
          key: iso,
          label: `${dayNames[i]} ${d.getDate()}`,
          clicks,
        });
      }
      return buckets;
    }
  }

  if (period === 'month') {
    const year = referenceDate.getFullYear();
    const month = referenceDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const buckets: TimelineBucket[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(
        day
      ).padStart(2, '0')}`;
      const clicks = events
        .filter((e) => e.isoDate === iso)
        .reduce((acc, e) => acc + e.clicks, 0);
      buckets.push({
        key: iso,
        label: String(day).padStart(2, '0'),
        clicks,
      });
    }
    return buckets;
  }

  if (period === 'year') {
    const year = referenceDate.getFullYear();
    const monthLabels = [
      'Jan',
      'Fev',
      'Mar',
      'Abr',
      'Mai',
      'Jun',
      'Jul',
      'Ago',
      'Set',
      'Out',
      'Nov',
      'Dez',
    ];
    return monthLabels.map((lbl, idx) => {
      const ym = `${year}-${String(idx + 1).padStart(2, '0')}`;
      const clicks = events
        .filter((e) => e.isoDate?.startsWith(ym))
        .reduce((acc, e) => acc + e.clicks, 0);
      return {
        key: ym,
        label: lbl,
        clicks,
      };
    });
  }

  const map = new Map<string, number>();
  for (const ev of events) {
    if (!ev.isoDate) continue;
    const key = ev.isoDate.slice(0, 7);
    map.set(key, (map.get(key) ?? 0) + ev.clicks);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, clicks]) => ({
      key,
      label: `${key.slice(5, 7)}/${key.slice(2, 4)}`,
      clicks,
    }));
}

export function computeDatasetDiff(
  prev: ParsedSheetDataset | null,
  next: ParsedSheetDataset
): SyncDiffSummary | null {
  if (!prev) return null;
  if (
    prev.spreadsheetId !== next.spreadsheetId ||
    prev.sheetTitle !== next.sheetTitle
  ) {
    return null;
  }

  const prevMap = new Map<number, ParsedRow>();
  for (const r of prev.rows) prevMap.set(r.rowIndex, r);
  const nextMap = new Map<number, ParsedRow>();
  for (const r of next.rows) nextMap.set(r.rowIndex, r);

  let addedRows = 0;
  let removedRows = 0;
  let updatedCells = 0;

  for (const [rowIdx, nextRow] of nextMap.entries()) {
    const prevRow = prevMap.get(rowIdx);
    if (!prevRow) {
      addedRows++;
    } else {
      for (const col of next.columns) {
        const a = prevRow.cells[col.key]?.formatted ?? '';
        const b = nextRow.cells[col.key]?.formatted ?? '';
        if (a !== b) updatedCells++;
      }
    }
  }

  for (const rowIdx of prevMap.keys()) {
    if (!nextMap.has(rowIdx)) removedRows++;
  }

  if (addedRows === 0 && removedRows === 0 && updatedCells === 0) {
    return null;
  }

  return {
    addedRows,
    removedRows,
    updatedCells,
    timestamp: new Date(),
  };
}

export function exportClickEventsCsv(
  events: ClickEventRecord[],
  filename: string
): void {
  const escapeCell = (val: string) => {
    const needsQuotes = /[;"\n\r,]/.test(val);
    const escaped = val.replace(/"/g, '""');
    return needsQuotes ? `"${escaped}"` : escaped;
  };

  const includeUser = events.some((ev) => Boolean(ev.userName || ev.userId));
  const includeCity = events.some((ev) => Boolean(ev.city));
  const includeDevice = events.some((ev) => Boolean(ev.device));
  const includeVisitorType = events.some(
    (ev) => ev.visitorType !== 'unknown' || Boolean(ev.visitorTypeLabel)
  );

  const headers = [
    'Data',
    'Horário',
    ...(includeUser ? ['Nome / Usuário'] : []),
    ...(includeCity ? ['Cidade'] : []),
    ...(includeDevice ? ['Aparelho'] : []),
    ...(includeVisitorType ? ['Pessoa / Robô'] : []),
    'Site',
    'Página Clicada',
    'Cliques',
  ];
  const lines = events.map((ev) =>
    [
      ev.dateFormatted,
      ev.timeFormatted,
      ...(includeUser ? [ev.userName ?? ev.userId ?? ''] : []),
      ...(includeCity ? [ev.city ?? ''] : []),
      ...(includeDevice ? [ev.device ?? ''] : []),
      ...(includeVisitorType
        ? [
            ev.visitorTypeLabel ??
              (ev.visitorType === 'human'
                ? 'Pessoa real'
                : ev.visitorType === 'bot'
                ? 'Robô'
                : ''),
          ]
        : []),
      ev.site,
      ev.page,
      String(ev.clicks),
    ]
      .map(escapeCell)
      .join(',')
  );

  const csvContent =
    '\uFEFF' + [headers.map(escapeCell).join(','), ...lines].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function analyzeRealPeople(
  allEvents: ClickEventRecord[],
  scopedEvents: ClickEventRecord[],
  options: {
    period: PeriodPreset;
    referenceDate: Date;
    customStart?: string;
    customEnd?: string;
  }
): RealPeopleSummary {
  let startIso: string | null = null;
  let endIso: string | null = null;
  if (options.period === 'custom') {
    startIso = options.customStart || null;
    endIso = options.customEnd || null;
  } else if (options.period !== 'all') {
    const bounds = getPeriodBounds(options.period, options.referenceDate);
    startIso = bounds.startIso;
    endIso = bounds.endIso;
  }

  const hasWindowBounds = Boolean(startIso || endIso);
  const isInWindow = (isoDate: string | null): boolean => {
    if (!hasWindowBounds) return true;
    if (!isoDate) return false;
    if (startIso && isoDate < startIso) return false;
    if (endIso && isoDate > endIso) return false;
    return true;
  };

  interface SiteHistInfo {
    firstEvent: ClickEventRecord;
    clicks: number;
    days: Set<string>;
  }
  interface UserHistInfo {
    firstEvent: ClickEventRecord;
    days: Set<string>;
    bySite: Map<string, SiteHistInfo>;
  }

  const historicMap = new Map<string, UserHistInfo>();
  for (const ev of allEvents) {
    if (!ev.userId) continue;
    const dayKey =
      ev.isoDate ??
      (ev.dateFormatted !== '—' ? ev.dateFormatted : `row_${ev.rowIndex}`);
    let uHist = historicMap.get(ev.userId);
    if (!uHist) {
      uHist = {
        firstEvent: ev,
        days: new Set([dayKey]),
        bySite: new Map([
          [
            ev.site,
            { firstEvent: ev, clicks: ev.clicks, days: new Set([dayKey]) },
          ],
        ]),
      };
      historicMap.set(ev.userId, uHist);
    } else {
      if (compareEventOrder(ev, uHist.firstEvent) < 0) {
        uHist.firstEvent = ev;
      }
      uHist.days.add(dayKey);
      let sHist = uHist.bySite.get(ev.site);
      if (!sHist) {
        sHist = { firstEvent: ev, clicks: 0, days: new Set() };
        uHist.bySite.set(ev.site, sHist);
      }
      if (compareEventOrder(ev, sHist.firstEvent) < 0) {
        sHist.firstEvent = ev;
      }
      sHist.clicks += ev.clicks;
      sHist.days.add(dayKey);
    }
  }

  let totalHumanClicks = 0;
  let totalBotClicks = 0;
  const humanScopedEvents: ClickEventRecord[] = [];
  for (const ev of scopedEvents) {
    if (ev.visitorType === 'human') {
      totalHumanClicks += ev.clicks;
      humanScopedEvents.push(ev);
    } else if (ev.visitorType === 'bot') {
      totalBotClicks += ev.clicks;
    }
  }

  interface PersonAcc {
    key: string;
    displayName: string;
    userId: string | null;
    isIdentified: boolean;
    totalHumanClicks: number;
    cities: Set<string>;
    devices: Set<string>;
    firstEvent: ClickEventRecord;
    lastEvent: ClickEventRecord;
    lastTs: number;
    hasTrueFlag: boolean;
    hasFalseFlag: boolean;
    events: ClickEventRecord[];
  }

  const peopleMap = new Map<string, PersonAcc>();

  for (const ev of humanScopedEvents) {
    const identifiedId = ev.userId || ev.userName;
    const key = identifiedId ? `u:${identifiedId}` : `row:${ev.rowIndex}`;
    const displayName =
      ev.userName || ev.userId || `Visitante #${ev.rowIndex}`;

    let acc = peopleMap.get(key);
    if (!acc) {
      acc = {
        key,
        displayName,
        userId: ev.userId,
        isIdentified: Boolean(identifiedId),
        totalHumanClicks: 0,
        cities: new Set(),
        devices: new Set(),
        firstEvent: ev,
        lastEvent: ev,
        lastTs: ev.timestamp ?? ev.rowIndex,
        hasTrueFlag: false,
        hasFalseFlag: false,
        events: [],
      };
      peopleMap.set(key, acc);
    }

    if (ev.userName) acc.displayName = ev.userName;
    if (ev.city) acc.cities.add(ev.city);
    if (ev.device) acc.devices.add(ev.device);
    acc.totalHumanClicks += ev.clicks;
    if (ev.isNewUserFlag === true) acc.hasTrueFlag = true;
    if (ev.isNewUserFlag === false) acc.hasFalseFlag = true;
    if (compareEventOrder(ev, acc.firstEvent) < 0) {
      acc.firstEvent = ev;
    }
    if (compareEventOrder(ev, acc.lastEvent) >= 0) {
      acc.lastEvent = ev;
      acc.lastTs = ev.timestamp ?? ev.rowIndex;
    }
    acc.events.push(ev);
  }

  const people: RealPersonDetail[] = [];
  const enrichedEvents: RealPersonEventItem[] = [];

  for (const acc of peopleMap.values()) {
    const uHist = acc.userId ? historicMap.get(acc.userId) : undefined;

    const siteAccMap = new Map<
      string,
      {
        clicks: number;
        hasTrue: boolean;
        hasFalse: boolean;
        pagesMap: Map<string, RealPersonPageVisit & { lastOrder: ClickEventRecord }>;
      }
    >();

    const allPagesMap = new Map<
      string,
      RealPersonPageVisit & { lastOrder: ClickEventRecord }
    >();

    for (const ev of acc.events) {
      let sAcc = siteAccMap.get(ev.site);
      if (!sAcc) {
        sAcc = {
          clicks: 0,
          hasTrue: false,
          hasFalse: false,
          pagesMap: new Map(),
        };
        siteAccMap.set(ev.site, sAcc);
      }
      sAcc.clicks += ev.clicks;
      if (ev.isNewUserFlag === true) sAcc.hasTrue = true;
      if (ev.isNewUserFlag === false) sAcc.hasFalse = true;

      const existingSitePage = sAcc.pagesMap.get(ev.page);
      if (!existingSitePage) {
        sAcc.pagesMap.set(ev.page, {
          site: ev.site,
          page: ev.page,
          clicks: ev.clicks,
          lastDateFormatted: ev.dateFormatted,
          lastTimeFormatted: ev.timeFormatted,
          lastOrder: ev,
        });
      } else {
        existingSitePage.clicks += ev.clicks;
        if (compareEventOrder(ev, existingSitePage.lastOrder) >= 0) {
          existingSitePage.lastOrder = ev;
          existingSitePage.lastDateFormatted = ev.dateFormatted;
          existingSitePage.lastTimeFormatted = ev.timeFormatted;
        }
      }

      const globalPageKey = `${ev.site}|||${ev.page}`;
      const existingGlobalPage = allPagesMap.get(globalPageKey);
      if (!existingGlobalPage) {
        allPagesMap.set(globalPageKey, {
          site: ev.site,
          page: ev.page,
          clicks: ev.clicks,
          lastDateFormatted: ev.dateFormatted,
          lastTimeFormatted: ev.timeFormatted,
          lastOrder: ev,
        });
      } else {
        existingGlobalPage.clicks += ev.clicks;
        if (compareEventOrder(ev, existingGlobalPage.lastOrder) >= 0) {
          existingGlobalPage.lastOrder = ev;
          existingGlobalPage.lastDateFormatted = ev.dateFormatted;
          existingGlobalPage.lastTimeFormatted = ev.timeFormatted;
        }
      }
    }

    const siteStatusMap = new Map<string, boolean>();
    const sites: RealPersonSiteVisit[] = [];

    for (const [site, sAcc] of siteAccMap.entries()) {
      const sHist = uHist?.bySite.get(site);
      const historicDaysOnSite = sHist?.days.size ?? 1;
      const historicClicksOnSite = sHist?.clicks ?? sAcc.clicks;
      const firstDateOnSite =
        sHist?.firstEvent.dateFormatted ?? acc.firstEvent.dateFormatted;

      let isNewOnSite = true;
      if (sAcc.hasFalse) {
        isNewOnSite = false;
      } else if (sAcc.hasTrue && historicDaysOnSite <= 1) {
        isNewOnSite = true;
      } else if (hasWindowBounds && sHist) {
        isNewOnSite = isInWindow(sHist.firstEvent.isoDate);
      } else if (!hasWindowBounds) {
        isNewOnSite = historicDaysOnSite <= 1;
      }

      siteStatusMap.set(site, isNewOnSite);

      const sitePages: RealPersonPageVisit[] = Array.from(sAcc.pagesMap.values())
        .map(({ lastOrder: _lo, ...p }) => p)
        .sort((a, b) => b.clicks - a.clicks);

      sites.push({
        site,
        clicks: sAcc.clicks,
        isNewOnSite,
        firstDateOnSite,
        historicClicksOnSite,
        historicDaysOnSite,
        pages: sitePages,
      });
    }

    sites.sort((a, b) => b.clicks - a.clicks);

    const pages: RealPersonPageVisit[] = Array.from(allPagesMap.values())
      .map(({ lastOrder: _lo, ...p }) => p)
      .sort((a, b) => b.clicks - a.clicks);

    const sortedEvents: RealPersonEventItem[] = [...acc.events]
      .sort((a, b) => compareEventOrder(b, a))
      .map((ev) => {
        const item: RealPersonEventItem = {
          ...ev,
          isNewOnSite: siteStatusMap.get(ev.site) ?? true,
        };
        enrichedEvents.push(item);
        return item;
      });

    const isNewOverall =
      sites.length > 0 ? sites.every((s) => s.isNewOnSite) : !acc.hasFalseFlag;

    people.push({
      key: acc.key,
      displayName: acc.displayName,
      userId: acc.userId,
      isIdentified: acc.isIdentified,
      totalHumanClicks: acc.totalHumanClicks,
      isNewOverall,
      cities: Array.from(acc.cities),
      devices: Array.from(acc.devices),
      firstDateFormatted: acc.firstEvent.dateFormatted,
      firstTimeFormatted: acc.firstEvent.timeFormatted,
      lastDateFormatted: acc.lastEvent.dateFormatted,
      lastTimeFormatted: acc.lastEvent.timeFormatted,
      lastTimestamp: acc.lastTs,
      sites,
      pages,
      events: sortedEvents,
    });
  }

  people.sort(
    (a, b) =>
      b.lastTimestamp - a.lastTimestamp ||
      b.totalHumanClicks - a.totalHumanClicks
  );

  enrichedEvents.sort((a, b) => compareEventOrder(b, a));

  const newPeopleCount = people.filter((p) => p.isNewOverall).length;
  const returningPeopleCount = people.length - newPeopleCount;

  return {
    totalHumanClicks,
    totalBotClicks,
    totalPeopleCount: people.length,
    newPeopleCount,
    returningPeopleCount,
    people,
    events: enrichedEvents,
  };
}

