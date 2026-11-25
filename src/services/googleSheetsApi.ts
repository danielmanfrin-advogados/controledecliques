import {
  DriveSpreadsheetFile,
  SpreadsheetMetadata,
} from '../types/sheets';

export class WorkspaceApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'WorkspaceApiError';
    this.status = status;
  }
}

export function extractSpreadsheetId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }

  // Raw spreadsheet ID pattern
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

async function fetchWithAuth<T>(url: string, accessToken: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    let errorMessage = `Erro na API do Google (${response.status})`;
    try {
      const errBody = await response.json();
      if (errBody?.error?.message) {
        errorMessage = errBody.error.message;
      }
    } catch {
      // Ignore JSON parse failure
    }
    throw new WorkspaceApiError(errorMessage, response.status);
  }

  return (await response.json()) as T;
}

export async function listUserSpreadsheets(
  accessToken: string,
  searchQuery?: string
): Promise<DriveSpreadsheetFile[]> {
  const queryParts = [
    "mimeType='application/vnd.google-apps.spreadsheet'",
    'trashed=false',
  ];

  if (searchQuery && searchQuery.trim()) {
    const escaped = searchQuery.trim().replace(/'/g, "\\'");
    queryParts.push(`name contains '${escaped}'`);
  }

  const params = new URLSearchParams({
    q: queryParts.join(' and '),
    orderBy: 'modifiedTime desc',
    pageSize: '30',
    fields: 'files(id,name,modifiedTime,webViewLink,owners(displayName,emailAddress))',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  });

  const data = await fetchWithAuth<{ files?: DriveSpreadsheetFile[] }>(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
    accessToken
  );

  return data.files ?? [];
}

export async function getSpreadsheetMetadata(
  spreadsheetId: string,
  accessToken: string
): Promise<SpreadsheetMetadata> {
  const params = new URLSearchParams({
    fields:
      'spreadsheetId,properties.title,spreadsheetUrl,sheets(properties(sheetId,title,hidden,gridProperties(rowCount,columnCount)))',
  });

  const data = await fetchWithAuth<{
    spreadsheetId: string;
    properties?: { title?: string };
    spreadsheetUrl?: string;
    sheets?: Array<{
      properties?: {
        sheetId?: number;
        title?: string;
        hidden?: boolean;
        gridProperties?: { rowCount?: number; columnCount?: number };
      };
    }>;
  }>(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}?${params.toString()}`,
    accessToken
  );

  const sheets = (data.sheets ?? [])
    .filter((s) => !s.properties?.hidden)
    .map((s) => ({
      sheetId: s.properties?.sheetId ?? 0,
      title: s.properties?.title ?? 'Sem título',
      rowCount: s.properties?.gridProperties?.rowCount ?? 1000,
      columnCount: s.properties?.gridProperties?.columnCount ?? 26,
    }));

  return {
    spreadsheetId: data.spreadsheetId,
    title: data.properties?.title ?? 'Planilha sem título',
    spreadsheetUrl:
      data.spreadsheetUrl ??
      `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}`,
    sheets,
  };
}

export interface SheetRawValues {
  formattedRows: string[][];
  unformattedRows: Array<Array<string | number | boolean | null>>;
}

export async function getSheetValues(
  spreadsheetId: string,
  sheetTitle: string,
  accessToken: string
): Promise<SheetRawValues> {
  const escapedTitle = sheetTitle.replace(/'/g, "''");
  const range = `'${escapedTitle}'`;

  const formattedUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
  )}/values/${encodeURIComponent(
    range
  )}?valueRenderOption=FORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`;

  const unformattedUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
  )}/values/${encodeURIComponent(
    range
  )}?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`;

  const [formattedData, unformattedData] = await Promise.all([
    fetchWithAuth<{ values?: string[][] }>(formattedUrl, accessToken),
    fetchWithAuth<{ values?: Array<Array<string | number | boolean | null>> }>(
      unformattedUrl,
      accessToken
    ),
  ]);

  return {
    formattedRows: formattedData.values ?? [],
    unformattedRows: unformattedData.values ?? [],
  };
}
