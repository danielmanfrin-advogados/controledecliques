import React, { useEffect, useState } from 'react';
import {
  FileSpreadsheet,
  Link2,
  Search,
  RefreshCw,
  ArrowRight,
  UserRoundCog,
  X,
} from 'lucide-react';
import { DriveSpreadsheetFile } from '../types/sheets';
import {
  extractSpreadsheetId,
  listUserSpreadsheets,
} from '../services/googleSheetsApi';

interface SpreadsheetPickerProps {
  accessToken: string;
  selectedSpreadsheetId: string | null;
  onSelectSpreadsheet: (spreadsheetId: string) => void;
  onSwitchAccount?: () => void;
  onClose?: () => void;
  isModal?: boolean;
  onAuthExpired: () => void;
}

export const SpreadsheetPicker: React.FC<SpreadsheetPickerProps> = ({
  accessToken,
  selectedSpreadsheetId,
  onSelectSpreadsheet,
  onSwitchAccount,
  onClose,
  isModal = false,
  onAuthExpired,
}) => {
  const [files, setFiles] = useState<DriveSpreadsheetFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadFiles = async (query?: string) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const list = await listUserSpreadsheets(accessToken, query);
      setFiles(list);
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      if (status === 401) {
        onAuthExpired();
        return;
      }
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Não foi possível listar suas planilhas do Google Drive.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, [accessToken]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadFiles(searchTerm);
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = extractSpreadsheetId(urlInput);
    if (!id) {
      setErrorMsg(
        'Link ou ID inválido. Cole a URL completa do Google Sheets ou o ID da planilha.'
      );
      return;
    }
    setErrorMsg(null);
    onSelectSpreadsheet(id);
  };

  const formatDate = (iso?: string) => {
    if (!iso) return 'Data indisponível';
    try {
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  };

  const content = (
    <div className="clay-shell rounded-[28px] w-full max-w-4xl mx-auto overflow-hidden">
      <div className="px-7 py-5 border-b border-[#EADFD1] flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[#2C221E]">
            Selecionar Planilha do Google Sheets
          </h2>
          <p className="text-xs text-[#6E5F54] mt-0.5">
            Escolha uma planilha do seu Drive ou cole o link diretamente.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onSwitchAccount && (
            <button
              type="button"
              onClick={onSwitchAccount}
              className="px-3.5 py-2 rounded-xl clay-card text-xs font-bold text-[#4C8F84] hover:text-[#366B62] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <UserRoundCog className="w-3.5 h-3.5" />
              <span>Trocar conta Google</span>
            </button>
          )}
          {isModal && onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar seletor de planilhas"
              className="p-2 rounded-xl clay-card text-[#5E4E42] hover:text-[#2C221E] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="p-7 space-y-6">
        <form
          onSubmit={handleUrlSubmit}
          className="flex flex-col sm:flex-row gap-3"
        >
          <div className="relative flex-1">
            <Link2 className="w-4 h-4 text-[#8C7A6B] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Cole a URL da sua planilha (https://docs.google.com/spreadsheets/d/...)"
              className="w-full pl-10 pr-4 py-3 text-sm rounded-2xl clay-input border border-[#EADFD1] text-[#2C221E] placeholder:text-[#9A897A] focus:outline-none focus:ring-2 focus:ring-[#E36A42]"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-3 text-sm font-semibold text-white clay-coral-btn rounded-2xl transition-transform active:scale-[0.99] whitespace-nowrap shrink-0 inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Carregar Link</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="border-t border-[#EADFD1] pt-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h3 className="text-sm font-bold text-[#2C221E]">
              Suas planilhas recentes no Google Drive
            </h3>
            <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#8C7A6B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por nome..."
                  className="pl-8 pr-3 py-2 text-xs rounded-xl clay-input border border-[#EADFD1] text-[#2C221E] focus:outline-none focus:ring-2 focus:ring-[#E36A42]"
                />
              </div>
              <button
                type="button"
                onClick={() => loadFiles(searchTerm)}
                title="Atualizar lista"
                className="p-2 rounded-xl clay-card text-[#5E4E42] hover:text-[#2C221E] cursor-pointer"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`}
                />
              </button>
            </form>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3.5 rounded-2xl bg-[#FDE4E1] border border-[#E8A39A] text-xs text-[#8F2D22]">
              {errorMsg}
            </div>
          )}

          {isLoading ? (
            <div className="space-y-2.5">
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className="h-14 rounded-2xl bg-[#EFE6D8] animate-pulse"
                />
              ))}
            </div>
          ) : files.length === 0 ? (
            <div className="py-10 text-center rounded-2xl border border-dashed border-[#D7C9B8]">
              <FileSpreadsheet className="w-8 h-8 text-[#9A897A] mx-auto mb-2" />
              <p className="text-sm font-semibold text-[#3D3028]">
                Nenhuma planilha encontrada
              </p>
              <p className="text-xs text-[#6E5F54] mt-1">
                Limpe a busca ou cole o link da planilha acima.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
              {files.map((file) => {
                const isSelected = file.id === selectedSpreadsheetId;
                const ownerName =
                  file.owners?.[0]?.displayName ||
                  file.owners?.[0]?.emailAddress ||
                  'Google Drive';
                return (
                  <button
                    key={file.id}
                    type="button"
                    onClick={() => onSelectSpreadsheet(file.id)}
                    className={`w-full px-4 py-3.5 rounded-2xl text-left flex items-center justify-between gap-4 transition-all cursor-pointer ${
                      isSelected
                        ? 'clay-sage'
                        : 'clay-card hover:-translate-y-0.5'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-[#4C8F84] text-white flex items-center justify-center shrink-0 clay-icon-tile">
                        <FileSpreadsheet className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#2C221E] truncate">
                          {file.name}
                        </p>
                        <p className="text-xs text-[#6E5F54] truncate mt-0.5">
                          {ownerName} · Modificada em{' '}
                          {formatDate(file.modifiedTime)}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-[#E36A42] whitespace-nowrap shrink-0">
                      {isSelected ? 'Ativa' : 'Abrir'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (isModal) {
    return (
      <div
        className="fixed inset-0 z-50 bg-[#2C221E]/35 backdrop-blur-xs flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
      >
        {content}
      </div>
    );
  }

  return <div className="min-h-screen bg-[#F5EFE6] py-10 px-6">{content}</div>;
};
