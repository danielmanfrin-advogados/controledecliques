import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;

export const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets.readonly',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
] as const;

const provider = new GoogleAuthProvider();
for (const scope of SCOPES) {
  provider.addScope(scope);
}
provider.setCustomParameters({
  prompt: 'select_account',
});

let isSigningIn = false;
let cachedAccessToken: string | null = null;

function formatFirebaseAuthError(err: unknown): Error {
  const code = (err as { code?: string })?.code ?? '';
  const message = err instanceof Error ? err.message : '';
  const hostname =
    typeof window !== 'undefined' ? window.location.hostname : '';

  if (code === 'auth/unauthorized-domain') {
    return new Error(
      `Domínio não autorizado (${hostname}). Adicione "${hostname}" em Firebase Console > Authentication > Settings > Authorized domains.`
    );
  }
  if (code === 'auth/popup-closed-by-user') {
    return new Error(
      'A janela de login do Google foi fechada antes de concluir a autenticação. Tente novamente.'
    );
  }
  if (code === 'auth/cancelled-popup-request') {
    return new Error(
      'Já existe uma tentativa de login aberta. Conclua ou feche a janela anterior e tente novamente.'
    );
  }
  if (code === 'auth/popup-blocked') {
    return new Error(
      'O navegador bloqueou a janela de login do Google. Permita pop-ups para este site e tente novamente.'
    );
  }
  if (code === 'auth/network-request-failed') {
    return new Error(
      'Falha de conexão ao tentar autenticar com o Google. Verifique sua internet e tente novamente.'
    );
  }
  if (
    code === 'auth/api-key-not-valid' ||
    message.includes('API_KEY_HTTP_REFERRER_BLOCKED')
  ) {
    return new Error(
      `A chave de API do Firebase está bloqueada para o domínio "${hostname}". Libere este domínio nas restrições da API Key no Google Cloud Console.`
    );
  }

  const detail = code ? ` (${code})` : '';
  return err instanceof Error
    ? new Error(`${err.message}${detail && !err.message.includes(code) ? detail : ''}`)
    : new Error(`Não foi possível concluir o login com o Google${detail}.`);
}

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: (currentUser: User | null, errorMsg?: string) => void
) => {
  let active = true;

  getRedirectResult(auth)
    .then((result) => {
      if (!active || !result) return;
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        cachedAccessToken = credential.accessToken;
        onAuthSuccess?.(result.user, cachedAccessToken);
      }
    })
    .catch((err) => {
      if (!active) return;
      const formatted = formatFirebaseAuthError(err);
      onAuthFailure?.(auth.currentUser, formatted.message);
    });

  const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
    if (!active) return;
    if (user) {
      if (cachedAccessToken) {
        onAuthSuccess?.(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        onAuthFailure?.(user);
      }
    } else {
      cachedAccessToken = null;
      onAuthFailure?.(null);
    }
  });

  return () => {
    active = false;
    unsubscribe();
  };
};

export const googleSignIn = async (): Promise<{
  user: User;
  accessToken: string;
}> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error(
        'Não foi possível obter o token de acesso do Google Workspace.'
      );
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code ?? '';
    const isTopLevel =
      typeof window !== 'undefined' && window.self === window.top;
    if (
      isTopLevel &&
      (code === 'auth/popup-blocked' ||
        code === 'auth/operation-not-supported-in-this-environment')
    ) {
      await signInWithRedirect(auth, provider);
      throw new Error('Redirecionando para o login do Google...');
    }
    throw formatFirebaseAuthError(err);
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const clearCachedToken = (): void => {
  cachedAccessToken = null;
};

export const logout = async (): Promise<void> => {
  cachedAccessToken = null;
  await auth.signOut();
};
