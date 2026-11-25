import React, { useState } from 'react';
import { User } from 'firebase/auth';
import {
  Check,
  Clock,
  Copy,
  ExternalLink,
  Globe,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { GoogleSignInButton } from './GoogleSignInButton';
import { FIREBASE_PROJECT_ID } from '../services/firebaseAuth';

interface AuthGateProps {
  onLogin: () => void;
  isLoggingIn: boolean;
  errorMessage: string | null;
  existingUser: User | null;
}

export const AuthGate: React.FC<AuthGateProps> = ({
  onLogin,
  isLoggingIn,
  errorMessage,
  existingUser,
}) => {
  const [copiedHost, setCopiedHost] = useState(false);

  const isDomainError = Boolean(
    errorMessage &&
      (errorMessage.includes('Domínio não autorizado') ||
        errorMessage.includes('Authorized domains'))
  );

  const currentHost =
    typeof window !== 'undefined' ? window.location.hostname : '';

  const handleCopyHost = async () => {
    if (!currentHost) return;
    try {
      await navigator.clipboard.writeText(currentHost);
      setCopiedHost(true);
      window.setTimeout(() => setCopiedHost(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <div className="min-h-screen bg-[#F5EFE6] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-4xl clay-shell rounded-[32px] p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 clay-peach rounded-3xl p-7 sm:p-8 flex flex-col justify-between">
          <div>
            <p className="text-xs font-semibold text-[#8C4A2B] mb-3">
              Google Sheets · Monitoramento de Cliques
            </p>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#2C221E] text-balance mb-4">
              Veja os cliques de cada site e página de forma simples
            </h1>
            <p className="text-sm sm:text-base text-[#5E493C] leading-relaxed mb-8">
              Conecte qualquer conta Google para abrir suas planilhas e acompanhar por dia, semana, mês ou ano quantos cliques cada página recebeu e em quais horários.
            </p>

            {existingUser && (
              <div className="mb-6 p-4 rounded-2xl clay-card text-sm text-[#3D3028]">
                Sessão identificada para{' '}
                <span className="font-bold">{existingUser.email}</span>. Confirme
                abaixo ou escolha outra conta Google.
              </div>
            )}

            {errorMessage && (
              <div
                role="alert"
                className="mb-6 p-4 rounded-2xl bg-[#FDE4E1] border border-[#E8A39A] text-sm text-[#8F2D22] space-y-3"
              >
                <p>{errorMessage}</p>
                {isDomainError && FIREBASE_PROJECT_ID && (
                  <div className="flex flex-wrap items-center gap-2.5">
                    {currentHost && (
                      <button
                        type="button"
                        onClick={handleCopyHost}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 text-xs font-bold text-[#8F2D22] hover:bg-white cursor-pointer"
                      >
                        {copiedHost ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-[#366B62]" />
                            <span>Domínio copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copiar: {currentHost}</span>
                          </>
                        )}
                      </button>
                    )}
                    <a
                      href={`https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/authentication/settings`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#8F2D22] text-xs font-bold text-white hover:bg-[#732118]"
                    >
                      <span>Autorizar no Firebase</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="pt-4 flex flex-col sm:flex-row sm:items-center gap-4">
            <GoogleSignInButton
              onClick={onLogin}
              disabled={isLoggingIn}
              label={
                isLoggingIn
                  ? 'Conectando...'
                  : existingUser
                  ? 'Conectar ou trocar conta'
                  : 'Entrar com Google'
              }
            />
            <span className="text-xs text-[#6E5445]">
              Acesso somente leitura às suas planilhas.
            </span>
          </div>
        </div>

        <div className="lg:col-span-5 flex flex-col justify-between gap-4">
          <div className="clay-sage rounded-3xl p-5 flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#4C8F84] text-white flex items-center justify-center shrink-0 clay-icon-tile">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#2C221E]">
                Sites e páginas internas
              </h2>
              <p className="text-xs text-[#595D4D] mt-1 leading-relaxed">
                Clique em qualquer site para ver todas as páginas acessadas e a contagem exata.
              </p>
            </div>
          </div>

          <div className="clay-butter rounded-3xl p-5 flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#DE9533] text-white flex items-center justify-center shrink-0 clay-icon-tile">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#2C221E]">
                Dia, semana, mês e horários
              </h2>
              <p className="text-xs text-[#695A42] mt-1 leading-relaxed">
                Filtre períodos rapidamente e descubra os horários de maior movimento.
              </p>
            </div>
          </div>

          <div className="clay-lavender rounded-3xl p-5 flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#766BB0] text-white flex items-center justify-center shrink-0 clay-icon-tile">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#2C221E]">
                Atualização online automática
              </h2>
              <p className="text-xs text-[#57526B] mt-1 leading-relaxed">
                Novos cliques adicionados na planilha aparecem automaticamente no painel.
              </p>
            </div>
          </div>

          <div className="px-3 pt-1 flex items-center gap-2 text-xs text-[#6E5F54]">
            <ShieldCheck className="w-4 h-4 text-[#4C8F84] shrink-0" />
            <span>Sua planilha original nunca é modificada.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
