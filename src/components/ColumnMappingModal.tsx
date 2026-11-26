import React, { useState } from 'react';
import { X } from 'lucide-react';
import { ClickColumnMapping, ColumnSchema } from '../types/sheets';

interface ColumnMappingModalProps {
  columns: ColumnSchema[];
  mapping: ClickColumnMapping;
  headerRowIndex: number;
  rawRowCount: number;
  onSave: (nextMapping: ClickColumnMapping, nextHeaderRow: number) => void;
  onClose: () => void;
}

export const ColumnMappingModal: React.FC<ColumnMappingModalProps> = ({
  columns,
  mapping,
  headerRowIndex,
  rawRowCount,
  onSave,
  onClose,
}) => {
  const [draft, setDraft] = useState<ClickColumnMapping>(mapping);
  const [draftHeaderRow, setDraftHeaderRow] = useState<number>(headerRowIndex);

  const maxHeaderRows = Math.min(Math.max(rawRowCount - 1, 1), 6);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(draft, draftHeaderRow);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#2C221E]/35 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg clay-shell rounded-[28px] overflow-hidden"
      >
        <div className="px-6 py-5 border-b border-[#EADFD1] flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-[#2C221E]">
              Mapear Colunas da Planilha
            </h2>
            <p className="text-xs text-[#6E5F54] mt-0.5">
              Ajuste qual coluna da sua planilha corresponde a cada informação.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="p-2 rounded-xl clay-card text-[#5E4E42] hover:text-[#2C221E] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs">
          <div>
            <label className="block font-bold text-[#4A3B31] mb-1.5">
              Linha de cabeçalho
            </label>
            <select
              value={draftHeaderRow}
              onChange={(e) => setDraftHeaderRow(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 rounded-2xl clay-input border border-[#EADFD1] text-[#2C221E] focus:outline-none focus:ring-2 focus:ring-[#E36A42]"
            >
              {Array.from({ length: maxHeaderRows }, (_, idx) => (
                <option key={idx} value={idx}>
                  Linha {idx + 1}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-[#4A3B31] mb-1.5">
              Coluna do Site / Domínio
            </label>
            <select
              value={draft.siteCol ?? ''}
              onChange={(e) =>
                setDraft((d) => ({ ...d, siteCol: e.target.value || null }))
              }
              className="w-full px-3.5 py-2.5 rounded-2xl clay-input border border-[#EADFD1] text-[#2C221E] focus:outline-none focus:ring-2 focus:ring-[#E36A42]"
            >
              <option value="">Extrair automaticamente da URL da página</option>
              {columns.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-bold text-[#4A3B31] mb-1.5">
              Coluna da Página Clicada / URL
            </label>
            <select
              value={draft.pageCol ?? ''}
              onChange={(e) =>
                setDraft((d) => ({ ...d, pageCol: e.target.value || null }))
              }
              className="w-full px-3.5 py-2.5 rounded-2xl clay-input border border-[#EADFD1] text-[#2C221E] focus:outline-none focus:ring-2 focus:ring-[#E36A42]"
            >
              <option value="">Não mapeada</option>
              {columns.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-[#4A3B31] mb-1.5">
                Coluna de Data
              </label>
              <select
                value={draft.dateCol ?? ''}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, dateCol: e.target.value || null }))
                }
                className="w-full px-3.5 py-2.5 rounded-2xl clay-input border border-[#EADFD1] text-[#2C221E] focus:outline-none focus:ring-2 focus:ring-[#E36A42]"
              >
                <option value="">Não mapeada</option>
                {columns.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-[#4A3B31] mb-1.5">
                Coluna de Horário (se separada)
              </label>
              <select
                value={draft.timeCol ?? ''}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, timeCol: e.target.value || null }))
                }
                className="w-full px-3.5 py-2.5 rounded-2xl clay-input border border-[#EADFD1] text-[#2C221E] focus:outline-none focus:ring-2 focus:ring-[#E36A42]"
              >
                <option value="">Usar hora da coluna Data</option>
                {columns.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold text-[#4A3B31] mb-1.5">
              Coluna de Quantidade de Cliques (opcional)
            </label>
            <select
              value={draft.clicksCol ?? ''}
              onChange={(e) =>
                setDraft((d) => ({ ...d, clicksCol: e.target.value || null }))
              }
              className="w-full px-3.5 py-2.5 rounded-2xl clay-input border border-[#EADFD1] text-[#2C221E] focus:outline-none focus:ring-2 focus:ring-[#E36A42]"
            >
              <option value="">Contar cada linha como 1 clique</option>
              {columns.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-[#4A3B31] mb-1.5">
                Coluna do Usuário / IP / ID (opcional)
              </label>
              <select
                value={draft.userCol ?? ''}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, userCol: e.target.value || null }))
                }
                className="w-full px-3.5 py-2.5 rounded-2xl clay-input border border-[#EADFD1] text-[#2C221E] focus:outline-none focus:ring-2 focus:ring-[#E36A42]"
              >
                <option value="">Não mapeada</option>
                {columns.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-[#4A3B31] mb-1.5">
                Coluna "Usuário Novo" (opcional)
              </label>
              <select
                value={draft.newUserCol ?? ''}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, newUserCol: e.target.value || null }))
                }
                className="w-full px-3.5 py-2.5 rounded-2xl clay-input border border-[#EADFD1] text-[#2C221E] focus:outline-none focus:ring-2 focus:ring-[#E36A42]"
              >
                <option value="">Detectar automaticamente pelo 1º clique</option>
                {columns.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-[#4A3B31] mb-1.5">
                Coluna de Nome (opcional)
              </label>
              <select
                value={draft.nameCol ?? ''}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, nameCol: e.target.value || null }))
                }
                className="w-full px-3.5 py-2.5 rounded-2xl clay-input border border-[#EADFD1] text-[#2C221E] focus:outline-none focus:ring-2 focus:ring-[#E36A42]"
              >
                <option value="">Não mapeada</option>
                {columns.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-[#4A3B31] mb-1.5">
                Coluna de Cidade (opcional)
              </label>
              <select
                value={draft.cityCol ?? ''}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, cityCol: e.target.value || null }))
                }
                className="w-full px-3.5 py-2.5 rounded-2xl clay-input border border-[#EADFD1] text-[#2C221E] focus:outline-none focus:ring-2 focus:ring-[#E36A42]"
              >
                <option value="">Não mapeada</option>
                {columns.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-[#4A3B31] mb-1.5">
                Coluna de Aparelho (opcional)
              </label>
              <select
                value={draft.deviceCol ?? ''}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, deviceCol: e.target.value || null }))
                }
                className="w-full px-3.5 py-2.5 rounded-2xl clay-input border border-[#EADFD1] text-[#2C221E] focus:outline-none focus:ring-2 focus:ring-[#E36A42]"
              >
                <option value="">Não mapeada</option>
                {columns.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-[#EADFD1] flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold rounded-2xl clay-card text-[#5E4E42] hover:text-[#2C221E] cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-5 py-2 text-xs font-bold rounded-2xl clay-coral-btn text-white cursor-pointer"
          >
            Aplicar mapeamento
          </button>
        </div>
      </form>
    </div>
  );
};
