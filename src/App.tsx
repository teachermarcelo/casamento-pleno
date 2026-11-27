import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  auth,
  db,
  formatFirebaseAuthError,
  handleFirestoreError,
  OperationType,
  signInWithGoogle,
  signOutUser,
  type AuthErrorInfo,
} from './lib/firebase';
import { ensureUserProfile, loadPublicWeddingBySlug, updateUserProfile } from './lib/weddingService';
import {
  ADMIN_EMAIL,
  DEMO_GIFTS,
  DEMO_PARTY,
  DEMO_SCHEDULE,
  DEMO_WEDDING,
  WEDDING_THEMES,
  type GiftItem,
  type PartyMember,
  type ScheduleItem,
  type UserProfile,
  type Wedding,
} from './types/wedding';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LandingPage } from './components/LandingPage';
import { OnboardingFlow, type PendingCheckoutDraft } from './components/OnboardingFlow';
import { BrideDashboard } from './components/BrideDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { GuestWeddingSite } from './components/GuestWeddingSite';
import { OfflineIndicator } from './components/PWAInstallButton';

const PENDING_CHECKOUT_STORAGE_KEY = 'cp_pending_checkout';

function loadPendingCheckoutDraft(): PendingCheckoutDraft | null {
  try {
    const raw = window.sessionStorage.getItem(PENDING_CHECKOUT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingCheckoutDraft>;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      payerName: typeof parsed.payerName === 'string' ? parsed.payerName.slice(0, 100) : '',
      payerEmail: typeof parsed.payerEmail === 'string' ? parsed.payerEmail.slice(0, 200) : '',
      payerPhone: typeof parsed.payerPhone === 'string' ? parsed.payerPhone.slice(0, 24) : '',
      brideName: typeof parsed.brideName === 'string' ? parsed.brideName.slice(0, 80) : '',
      groomName: typeof parsed.groomName === 'string' ? parsed.groomName.slice(0, 80) : '',
      paymentMethod: parsed.paymentMethod === 'card' ? 'card' : 'pix',
      referenceId: typeof parsed.referenceId === 'string' ? parsed.referenceId.slice(0, 120) : undefined,
      confirmed: Boolean(parsed.confirmed),
      wantsSetup: Boolean(parsed.wantsSetup),
    };
  } catch {
    return null;
  }
}

interface GuestSitePreview {
  wedding: Wedding;
  schedule: ScheduleItem[];
  party: PartyMember[];
  gifts: GiftItem[];
  isDemo?: boolean;
}

function AppContent() {
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [wedding, setWedding] = useState<Wedding | null>(null);
  const [loadingWedding, setLoadingWedding] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<AuthErrorInfo | null>(null);

  const [viewMode, setViewMode] = useState<'bride' | 'admin'>('bride');
  const [impersonatedUser, setImpersonatedUser] = useState<UserProfile | null>(null);
  const [impersonatedWedding, setImpersonatedWedding] = useState<Wedding | null>(null);
  const [impersonateForceOnboarding, setImpersonateForceOnboarding] = useState(false);
  const [showLandingPreview, setShowLandingPreview] = useState(false);
  const [showGuestCheckout, setShowGuestCheckout] = useState<boolean>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return (
        params.get('checkout') === '1' ||
        params.get('pagamento') === 'sucesso' ||
        params.get('checkout_status') === 'success'
      );
    } catch {
      return false;
    }
  });
  const [pendingCheckoutDraft, setPendingCheckoutDraft] = useState<PendingCheckoutDraft | null>(() =>
    loadPendingCheckoutDraft()
  );
  const [guestSite, setGuestSite] = useState<GuestSitePreview | null>(null);
  const [loadingPublicSlug, setLoadingPublicSlug] = useState(false);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem('cp_dark_mode') === 'true';
    } catch {
      return false;
    }
  });

  // Sync dark mode class on <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    try {
      window.localStorage.setItem('cp_dark_mode', String(darkMode));
    } catch {
      // Ignore storage errors in private mode
    }
  }, [darkMode]);

  // Apply active wedding palette dynamically via CSS variables
  useEffect(() => {
    const activeWedding = guestSite?.wedding || wedding;
    const activeThemeKey = activeWedding?.themeKey || 'olive';
    const palette = WEDDING_THEMES[activeThemeKey] || WEDDING_THEMES.olive;
    const effectivePrimary = activeWedding?.customAccentColor || palette.primary;
    document.documentElement.style.setProperty('--brand-primary', effectivePrimary);
    document.documentElement.style.setProperty('--brand-primary-hover', effectivePrimary);
    document.documentElement.style.setProperty('--brand-soft', darkMode ? palette.softDark : palette.softLight);
    document.documentElement.style.setProperty('--brand-ink', palette.ink);
  }, [wedding?.themeKey, wedding?.customAccentColor, guestSite?.wedding.themeKey, guestSite?.wedding.customAccentColor, darkMode]);

  // Detect public ?convite=<slug> route on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('convite');
    if (!slug) return;
    if (slug === 'clara-e-henrique') {
      setGuestSite({
        wedding: DEMO_WEDDING,
        schedule: DEMO_SCHEDULE,
        party: DEMO_PARTY,
        gifts: DEMO_GIFTS,
        isDemo: true,
      });
      return;
    }

    setLoadingPublicSlug(true);
    loadPublicWeddingBySlug(slug)
      .then((res) => {
        if (res) {
          setGuestSite({ ...res, isDemo: false });
        }
      })
      .finally(() => setLoadingPublicSlug(false));
  }, []);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setProfile(null);
        setWedding(null);
        setAuthReady(true);
        return;
      }
      try {
        const ensured = await ensureUserProfile(user);
        setProfile(ensured);
        setAuthError(null);
        if (typeof ensured.darkMode === 'boolean') {
          setDarkMode(ensured.darkMode);
        }
      } catch (err) {
        console.error('Failed to ensure user profile:', err);
        setAuthError({
          code: 'firestore/profile-init-failed',
          title: 'Login Google concluído, mas o perfil não pôde ser salvo no banco',
          message:
            'Verifique sua conexão e se o Firebase Firestore está acessível neste domínio. Tente clicar em "Entrar com Google" novamente.',
        });
      } finally {
        setAuthReady(true);
      }
    });
    return () => unsub();
  }, []);

  // Real-time listener for UserProfile
  useEffect(() => {
    if (!firebaseUser) return;
    const path = `users/${firebaseUser.uid}`;
    const unsub = onSnapshot(
      doc(db, 'users', firebaseUser.uid),
      (snap) => {
        if (snap.exists()) {
          setProfile(snap.data() as UserProfile);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, path)
    );
    return () => unsub();
  }, [firebaseUser]);

  // Real-time listener for user's Wedding
  useEffect(() => {
    if (!firebaseUser || !profile?.weddingId) {
      setWedding(null);
      return;
    }
    setLoadingWedding(true);
    const path = `weddings/${profile.weddingId}`;
    const unsub = onSnapshot(
      doc(db, 'weddings', profile.weddingId),
      (snap) => {
        if (snap.exists()) {
          setWedding(snap.data() as Wedding);
        } else {
          setWedding(null);
        }
        setLoadingWedding(false);
      },
      (err) => {
        setLoadingWedding(false);
        handleFirestoreError(err, OperationType.GET, path);
      }
    );
    return () => unsub();
  }, [firebaseUser, profile?.weddingId]);

  // Real-time listeners when Admin is simulating a Lead / Client view
  useEffect(() => {
    if (!firebaseUser || !impersonatedUser?.uid) return;
    const unsub = onSnapshot(
      doc(db, 'users', impersonatedUser.uid),
      (snap) => {
        if (snap.exists()) {
          setImpersonatedUser(snap.data() as UserProfile);
        }
      },
      () => {}
    );
    return () => unsub();
  }, [firebaseUser, impersonatedUser?.uid]);

  useEffect(() => {
    if (!firebaseUser || !impersonatedUser?.weddingId) {
      setImpersonatedWedding(null);
      return;
    }
    const unsub = onSnapshot(
      doc(db, 'weddings', impersonatedUser.weddingId),
      (snap) => {
        if (snap.exists()) {
          setImpersonatedWedding(snap.data() as Wedding);
        } else {
          setImpersonatedWedding(null);
        }
      },
      () => {}
    );
    return () => unsub();
  }, [firebaseUser, impersonatedUser?.weddingId]);

  const handleSignIn = async () => {
    setSigningIn(true);
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error('Google Sign-In cancelled or failed:', err);
      setAuthError(formatFirebaseAuthError(err));
    } finally {
      setSigningIn(false);
    }
  };

  const handleSaveCheckoutDraft = (draft: PendingCheckoutDraft | null) => {
    setPendingCheckoutDraft(draft);
    try {
      if (!draft) {
        window.sessionStorage.removeItem(PENDING_CHECKOUT_STORAGE_KEY);
      } else {
        window.sessionStorage.setItem(PENDING_CHECKOUT_STORAGE_KEY, JSON.stringify(draft));
      }
    } catch {
      // Ignore storage errors in private mode
    }
  };

  const handleSignOut = async () => {
    await signOutUser();
    setViewMode('bride');
    setImpersonatedUser(null);
    setImpersonatedWedding(null);
    setImpersonateForceOnboarding(false);
    setShowLandingPreview(false);
    setShowGuestCheckout(false);
    setGuestSite(null);
  };

  const handleToggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    if (firebaseUser && profile) {
      updateUserProfile(firebaseUser.uid, { darkMode: next }).catch(() => {});
    }
  };

  const handleExitGuestSite = () => {
    setGuestSite(null);
    const url = new URL(window.location.href);
    if (url.searchParams.has('convite')) {
      url.searchParams.delete('convite');
      window.history.replaceState({}, '', url.toString());
    }
  };

  // 1. Public or Previewed Guest Wedding Site
  if (loadingPublicSlug) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF9F6] dark:bg-[#0F1115]">
        <p className="font-editorial text-2xl text-stone-600 dark:text-stone-400">
          Carregando convite...
        </p>
      </div>
    );
  }

  if (guestSite) {
    return (
      <>
        <GuestWeddingSite
          wedding={guestSite.wedding}
          schedule={guestSite.schedule}
          party={guestSite.party}
          gifts={guestSite.gifts}
          isDemo={guestSite.isDemo}
          onExit={handleExitGuestSite}
        />
        <OfflineIndicator />
      </>
    );
  }

  // 2. Loading Auth Session
  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F7F4] dark:bg-[#0F1115]">
        <div className="text-center">
          <p className="font-editorial text-3xl font-semibold text-stone-900 dark:text-stone-100">
            Casamento Pleno
          </p>
          <p className="mt-2 text-xs text-stone-500">Conectando ao Firebase...</p>
        </div>
      </div>
    );
  }

  // 3. Unauthenticated Direct Checkout or Landing Page
  if (!firebaseUser || !profile) {
    if (showGuestCheckout) {
      return (
        <>
          <OnboardingFlow
            profile={null}
            startAtCheckout
            pendingDraft={pendingCheckoutDraft}
            onSaveDraft={handleSaveCheckoutDraft}
            onRequestSignIn={handleSignIn}
            signingIn={signingIn}
            authError={authError}
            onClearAuthError={() => setAuthError(null)}
            onBackToLanding={() => {
              setAuthError(null);
              setShowGuestCheckout(false);
            }}
            onComplete={() => {}}
            onSignOut={() => setShowGuestCheckout(false)}
          />
          <OfflineIndicator />
        </>
      );
    }

    return (
      <>
        <LandingPage
          onSignIn={handleSignIn}
          onStartCheckout={() => {
            setAuthError(null);
            setShowGuestCheckout(true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          signingIn={signingIn}
          darkMode={darkMode}
          onToggleDarkMode={handleToggleDarkMode}
          authError={authError}
          onClearAuthError={() => setAuthError(null)}
          onOpenDemoSite={() =>
            setGuestSite({
              wedding: DEMO_WEDDING,
              schedule: DEMO_SCHEDULE,
              party: DEMO_PARTY,
              gifts: DEMO_GIFTS,
              isDemo: true,
            })
          }
        />
        <OfflineIndicator />
      </>
    );
  }

  const isAdminAccount =
    profile.role === 'admin' ||
    (firebaseUser.email?.toLowerCase() === ADMIN_EMAIL && Boolean(firebaseUser.emailVerified));

  // 4. Platform Owner Admin Console (or Client/Lead Simulation View)
  if (isAdminAccount && impersonatedUser) {
    const clientProfile: UserProfile = { ...impersonatedUser, role: 'bride' };
    const exitSimulation = () => {
      setImpersonatedUser(null);
      setImpersonatedWedding(null);
      setImpersonateForceOnboarding(false);
      setViewMode('admin');
    };
    const showOnboarding = impersonateForceOnboarding || !impersonatedWedding;

    return (
      <>
        <div className="sticky top-0 z-50 bg-[#10261B] text-[#FBF2DC] px-3.5 sm:px-5 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px] sm:text-xs border-b border-[#DFBE7A]/40 shadow-sm">
          <span className="truncate max-w-full">
            Visão Lead: <strong>{clientProfile.displayName}</strong>{' '}
            <span className="hidden sm:inline">({clientProfile.email}) — </span>
            <span className="text-[#DFBE7A] hidden md:inline">acesso comum sem painel Admin</span>
          </span>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {impersonatedWedding && (
              <button
                type="button"
                onClick={() => setImpersonateForceOnboarding((prev) => !prev)}
                className="rounded-full border border-[#DFBE7A]/60 px-2.5 sm:px-3 py-1 text-[11px] font-semibold text-[#FBF2DC] hover:bg-white/10 transition-colors cursor-pointer"
              >
                {showOnboarding ? 'Painel' : 'Ver Checkout'}
              </button>
            )}
            <button
              type="button"
              onClick={exitSimulation}
              className="rounded-full bg-[#DFBE7A] text-[#173526] px-3 py-1 text-[11px] font-semibold hover:bg-[#EBD198] transition-colors cursor-pointer"
            >
              Sair da Simulação
            </button>
          </div>
        </div>

        {showOnboarding ? (
          <OnboardingFlow
            profile={clientProfile}
            startAtCheckout={impersonateForceOnboarding}
            onComplete={(created) => {
              setImpersonatedWedding(created);
              setImpersonateForceOnboarding(false);
            }}
            onSignOut={exitSimulation}
          />
        ) : (
          <BrideDashboard
            profile={clientProfile}
            wedding={impersonatedWedding}
            darkMode={darkMode}
            onToggleDarkMode={handleToggleDarkMode}
            onPreviewGuestSite={(data) => setGuestSite({ ...data, isDemo: false })}
            onPreviewLanding={() => setShowLandingPreview(true)}
            onOpenAdmin={undefined}
            onSignOut={exitSimulation}
          />
        )}
        <OfflineIndicator />
      </>
    );
  }

  if (isAdminAccount && viewMode === 'admin') {
    return (
      <>
        <AdminDashboard
          profile={{ ...profile, role: 'admin' }}
          onBackToBride={() => setViewMode('bride')}
          onSimulateClient={(client, startAtOnboarding) => {
            setImpersonatedUser({ ...client, role: 'bride' });
            setImpersonateForceOnboarding(Boolean(startAtOnboarding));
          }}
          onSignOut={handleSignOut}
        />
        <OfflineIndicator />
      </>
    );
  }

  // 5. Onboarding (Mercado Pago Checkout + Wedding Setup)
  if (!loadingWedding && !wedding) {
    return (
      <>
        {isAdminAccount && (
          <div className="bg-[#173526] text-[#FBF2DC] px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs border-b border-[#DFBE7A]/35">
            <span>
              Conta Proprietária (Admin) reconhecida: <strong>{profile.email}</strong>
            </span>
            <button
              type="button"
              onClick={() => setViewMode('admin')}
              className="rounded-full bg-[#DFBE7A] text-[#173526] px-4 py-1.5 font-semibold hover:bg-[#EBD198] transition-colors cursor-pointer"
            >
              Abrir Painel Administrativo (Criador)
            </button>
          </div>
        )}
        <OnboardingFlow
          profile={profile}
          pendingDraft={pendingCheckoutDraft}
          onSaveDraft={handleSaveCheckoutDraft}
          onComplete={(created) => {
            setShowGuestCheckout(false);
            setWedding(created);
          }}
          onSignOut={handleSignOut}
        />
        <OfflineIndicator />
      </>
    );
  }

  if (loadingWedding || !wedding) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F7F4] dark:bg-[#0F1115]">
        <p className="font-editorial text-2xl text-stone-600 dark:text-stone-400">
          Preparando seu painel...
        </p>
      </div>
    );
  }

  // 6. Optional preview of Public Landing Page while signed in
  if (showLandingPreview) {
    return (
      <>
        <div className="bg-[#10261B] text-[#FBF2DC] px-3.5 sm:px-5 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px] sm:text-xs border-b border-[#DFBE7A]/30">
          <span className="truncate">Visualizando Página Inicial (visitante)</span>
          <button
            type="button"
            onClick={() => setShowLandingPreview(false)}
            className="rounded-full border border-[#DFBE7A]/70 px-3 py-1 font-semibold text-[#FBF2DC] hover:bg-[#DFBE7A] hover:text-[#173526] transition-colors cursor-pointer shrink-0"
          >
            Voltar ao Painel
          </button>
        </div>
        <LandingPage
          onSignIn={() => setShowLandingPreview(false)}
          onStartCheckout={() => setShowLandingPreview(false)}
          signingIn={false}
          darkMode={darkMode}
          onToggleDarkMode={handleToggleDarkMode}
          onOpenDemoSite={() =>
            setGuestSite({
              wedding: DEMO_WEDDING,
              schedule: DEMO_SCHEDULE,
              party: DEMO_PARTY,
              gifts: DEMO_GIFTS,
              isDemo: true,
            })
          }
        />
        <OfflineIndicator />
      </>
    );
  }

  // 7. Authenticated Bride Dashboard
  return (
    <>
      <BrideDashboard
        profile={profile}
        wedding={wedding}
        darkMode={darkMode}
        onToggleDarkMode={handleToggleDarkMode}
        onPreviewGuestSite={(data) => setGuestSite({ ...data, isDemo: false })}
        onPreviewLanding={() => setShowLandingPreview(true)}
        onOpenAdmin={isAdminAccount ? () => setViewMode('admin') : undefined}
        onSignOut={handleSignOut}
      />
      <OfflineIndicator />
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
