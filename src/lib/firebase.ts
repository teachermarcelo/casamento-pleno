import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const FIREBASE_META = {
  projectId: firebaseConfig.projectId,
  databaseId: firebaseConfig.firestoreDatabaseId,
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid ?? null,
      email: auth.currentUser?.email ?? null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
      tenantId: auth.currentUser?.tenantId ?? null,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export interface AuthErrorInfo {
  code: string;
  title: string;
  message: string;
  hostname?: string;
  consoleUrl?: string;
}

export function formatFirebaseAuthError(error: unknown): AuthErrorInfo {
  const errObj = error as { code?: string; message?: string } | null;
  const code = errObj?.code || '';
  const rawMessage = errObj?.message || (error instanceof Error ? error.message : String(error));
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const consoleUrl = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/settings`;

  if (code === 'auth/unauthorized-domain' || rawMessage.includes('unauthorized-domain')) {
    return {
      code: 'auth/unauthorized-domain',
      title: 'Domínio ainda não autorizado no Firebase Authentication',
      message: `O domínio "${hostname}" precisa ser autorizado no seu projeto Firebase (${firebaseConfig.projectId}) para liberar o cadastro e login com Google.`,
      hostname,
      consoleUrl,
    };
  }

  if (code === 'auth/popup-blocked') {
    return {
      code,
      title: 'Pop-up de login bloqueado pelo navegador',
      message: 'Seu navegador bloqueou a janela do Google. Permita pop-ups para este site e clique em "Entrar com Google" novamente.',
    };
  }

  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return {
      code,
      title: 'Login cancelado antes de concluir',
      message: 'A janela de autenticação do Google foi fechada. Clique em "Entrar com Google" para tentar novamente.',
    };
  }

  if (code === 'auth/network-request-failed') {
    return {
      code,
      title: 'Falha de conexão com o Firebase',
      message: 'Não foi possível conectar ao servidor de autenticação. Verifique sua conexão com a internet e tente novamente.',
    };
  }

  return {
    code: code || 'auth/unknown',
    title: 'Não foi possível concluir o cadastro/login',
    message: rawMessage || 'Ocorreu um erro inesperado ao autenticar com o Google. Tente novamente.',
  };
}

export async function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export async function signOutUser() {
  return signOut(auth);
}
