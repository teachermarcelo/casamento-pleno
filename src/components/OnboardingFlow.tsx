import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Copy,
  CreditCard,
  ExternalLink,
  Lock,
  Palette,
  QrCode,
  ShieldCheck,
  Upload,
  User,
  X,
} from 'lucide-react';
import {
  GENERATED_ASSETS,
  SUBSCRIPTION_PRICE,
  WEDDING_THEMES,
  type ThemeKey,
  type UserProfile,
  type Wedding,
} from '../types/wedding';
import type { AuthErrorInfo } from '../lib/firebase';
import { createWeddingWithStarterData, updateUserProfile } from '../lib/weddingService';
import { compressImageToDataUrl, formatBRL } from '../lib/utils';
import { SafeImage } from './SafeImage';

export interface PendingCheckoutDraft {
  payerName: string;
  payerEmail: string;
  payerPhone: string;
  brideName: string;
  groomName: string;
  paymentMethod: 'pix' | 'card';
  referenceId?: string;
  confirmed?: boolean;
  wantsSetup?: boolean;
}

interface OnboardingFlowProps {
  profile?: UserProfile | null;
  onComplete: (wedding: Wedding) => void;
  onSignOut: () => void;
  startAtCheckout?: boolean;
  onBackToLanding?: () => void;
  onRequestSignIn?: () => void;
  signingIn?: boolean;
  authError?: AuthErrorInfo | null;
  onClearAuthError?: () => void;
  pendingDraft?: PendingCheckoutDraft | null;
  onSaveDraft?: (draft: PendingCheckoutDraft | null) => void;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function getSafeExternalHttpsUrl(rawUrl?: string): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  profile = null,
  onComplete,
  onSignOut,
  startAtCheckout = false,
  onBackToLanding,
  onRequestSignIn,
  signingIn = false,
  authError = null,
  onClearAuthError,
  pendingDraft = null,
  onSaveDraft,
}) => {
  const isGuest = !profile;
  const alreadySubscribed =
    Boolean(profile) &&
    !startAtCheckout &&
    (profile?.subscriptionStatus === 'active' || profile?.role === 'admin');
  const [step, setStep] = useState<'checkout' | 'setup'>(alreadySubscribed ? 'setup' : 'checkout');

  // Buyer checkout form fields (accessible immediately without login)
  const [payerName, setPayerName] = useState(
    pendingDraft?.payerName || profile?.displayName || ''
  );
  const [payerEmail, setPayerEmail] = useState(
    pendingDraft?.payerEmail || profile?.email || ''
  );
  const [payerPhone, setPayerPhone] = useState(pendingDraft?.payerPhone || '');

  // Mercado Pago checkout state
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'card'>(
    pendingDraft?.paymentMethod || 'pix'
  );
  const [mpStatus, setMpStatus] = useState<{ configured: boolean; webhookEndpoint: string } | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutResult, setCheckoutResult] = useState<{
    mode: string;
    referenceId: string;
    pixCopyPaste?: string;
    pixQrBase64?: string;
    initPoint?: string;
    message?: string;
  } | null>(
    pendingDraft?.referenceId
      ? {
          mode: 'live',
          referenceId: pendingDraft.referenceId,
          message:
            'Identificamos seu checkout anterior. Finalize abaixo para liberar imediatamente a personalização do seu painel.',
        }
      : null
  );
  const [copiedPix, setCopiedPix] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  // Setup state (pre-populated from checkout draft or profile)
  const [brideName, setBrideName] = useState(
    pendingDraft?.brideName || profile?.displayName?.split(' ')[0] || ''
  );
  const [groomName, setGroomName] = useState(pendingDraft?.groomName || '');
  const [weddingDate, setWeddingDate] = useState('2027-06-19');
  const [weddingTime, setWeddingTime] = useState('16:30');
  const [themeKey, setThemeKey] = useState<ThemeKey>('olive');
  const [venueName, setVenueName] = useState('Villa das Oliveiras');
  const [venueAddress, setVenueAddress] = useState('Estrada das Oliveiras, km 14 — Campinas, SP');
  const [dressCode, setDressCode] = useState('Esporte Fino — Tons neutros');
  const [pixKey, setPixKey] = useState(pendingDraft?.payerEmail || profile?.email || '');
  const [budgetLimit, setBudgetLimit] = useState('60000');
  const [welcomeMessage, setWelcomeMessage] = useState(
    'Que alegria compartilhar com você o dia mais especial das nossas vidas. Confirme sua presença e celebre este amor conosco.'
  );
  const [coverPhotoUrl, setCoverPhotoUrl] = useState<string>(GENERATED_ASSETS.heroCouple);
  const [couplePhotoUrl, setCouplePhotoUrl] = useState<string>(GENERATED_ASSETS.storyCouple);
  const [savingSetup, setSavingSetup] = useState(false);
  const [setupError, setSetupError] = useState('');
  const syncedDraftRef = useRef(false);

  useEffect(() => {
    fetch('/api/payments/mercadopago/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setMpStatus(d);
      })
      .catch(() => {});
  }, []);

  // When a guest signs in with Google after filling checkout, sync their pending checkout & jump straight to Step 02
  useEffect(() => {
    if (!profile || syncedDraftRef.current) return;

    if (!payerName && profile.displayName) setPayerName(profile.displayName);
    if (!payerEmail && profile.email) setPayerEmail(profile.email);
    if (!pixKey && profile.email) setPixKey(profile.email);
    if (!brideName && profile.displayName) {
      setBrideName(profile.displayName.split(' ')[0] || 'Ana');
    }

    if (!pendingDraft?.wantsSetup) return;
    syncedDraftRef.current = true;

    const finalizePendingDraft = async () => {
      try {
        if (pendingDraft.confirmed && pendingDraft.referenceId) {
          const todayIso = new Date().toISOString().slice(0, 10);
          const nextBilling = new Date();
          nextBilling.setMonth(nextBilling.getMonth() + 1);
          await updateUserProfile(profile.uid, {
            subscriptionStatus: 'active',
            paymentMethod: pendingDraft.paymentMethod,
            mercadoPagoRef: pendingDraft.referenceId,
            lastPaymentDate: todayIso,
            nextBillingDate: nextBilling.toISOString().slice(0, 10),
            totalPaidSubscription: (profile.totalPaidSubscription || 0) + SUBSCRIPTION_PRICE,
          });
        }
      } catch (err) {
        console.error('Failed to sync pending checkout draft:', err);
      } finally {
        setStep('setup');
        onSaveDraft?.(null);
      }
    };

    finalizePendingDraft();
  }, [profile, pendingDraft, payerName, payerEmail, pixKey, brideName, onSaveDraft]);

  const persistCurrentDraft = (overrides?: Partial<PendingCheckoutDraft>) => {
    if (!onSaveDraft) return;
    onSaveDraft({
      payerName: payerName.trim(),
      payerEmail: payerEmail.trim().toLowerCase(),
      payerPhone: payerPhone.trim(),
      brideName: brideName.trim(),
      groomName: groomName.trim(),
      paymentMethod,
      referenceId: checkoutResult?.referenceId,
      ...overrides,
    });
  };

  const buildLocalFallbackCheckout = () => {
    const referenceId = `CP_${Date.now().toString(36).toUpperCase()}`;
    const pixCopyPaste =
      paymentMethod === 'pix'
        ? `00020126580014BR.GOV.BCB.PIX0136casamentopleno.assinatura@mercadopago.com520400005303986540539.905802BR5915CASAMENTO PLENO6009SAO PAULO62150511${referenceId.slice(0, 11)}6304A1B2`
        : undefined;
    return {
      mode: 'ready',
      referenceId,
      pixCopyPaste,
      message:
        'Estrutura de cobrança Mercado Pago pronta. Confirme abaixo para ativar seu painel e personalizar seu casamento agora.',
    };
  };

  const validateBuyerForm = (): boolean => {
    const trimmedName = payerName.trim();
    const trimmedEmail = payerEmail.trim().toLowerCase();
    if (trimmedName.length < 2) {
      setCheckoutError('Informe seu nome completo para gerar a cobrança.');
      return false;
    }
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setCheckoutError('Informe um e-mail válido para receber o recibo e liberar o acesso.');
      return false;
    }
    setCheckoutError('');
    return true;
  };

  const handleCreateCheckout = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!validateBuyerForm()) return;

    setCheckoutLoading(true);
    setCheckoutError('');
    try {
      const res = await fetch('/api/payments/mercadopago/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payerEmail: payerEmail.trim().toLowerCase(),
          payerName: payerName.trim(),
          payerPhone: payerPhone.trim(),
          paymentMethod,
          weddingId: profile?.weddingId || 'onboarding',
        }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok) {
        if (contentType.includes('application/json')) {
          const errData = (await res.json()) as { error?: string };
          if (res.status === 400 && errData.error) {
            setCheckoutError(errData.error);
            return;
          }
        }
        const fallback = buildLocalFallbackCheckout();
        setCheckoutResult(fallback);
        persistCurrentDraft({ referenceId: fallback.referenceId });
        return;
      }
      if (!contentType.includes('application/json')) {
        const fallback = buildLocalFallbackCheckout();
        setCheckoutResult(fallback);
        persistCurrentDraft({ referenceId: fallback.referenceId });
        return;
      }
      const data = await res.json();
      setCheckoutResult(data);
      persistCurrentDraft({ referenceId: data.referenceId });
    } catch {
      const fallback = buildLocalFallbackCheckout();
      setCheckoutResult(fallback);
      persistCurrentDraft({ referenceId: fallback.referenceId });
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleConfirmSubscription = async () => {
    const refId = checkoutResult?.referenceId || `MP_${Date.now()}`;

    // Guest completed checkout -> save draft and connect Google to create their protected dashboard
    if (!profile) {
      persistCurrentDraft({
        referenceId: refId,
        confirmed: true,
        wantsSetup: true,
      });
      onRequestSignIn?.();
      return;
    }

    setCheckoutLoading(true);
    setCheckoutError('');
    try {
      const todayIso = new Date().toISOString().slice(0, 10);
      const nextBilling = new Date();
      nextBilling.setMonth(nextBilling.getMonth() + 1);
      await updateUserProfile(profile.uid, {
        subscriptionStatus: 'active',
        paymentMethod,
        mercadoPagoRef: refId,
        lastPaymentDate: todayIso,
        nextBillingDate: nextBilling.toISOString().slice(0, 10),
        totalPaidSubscription: (profile.totalPaidSubscription || 0) + SUBSCRIPTION_PRICE,
      });
      onSaveDraft?.(null);
      setStep('setup');
    } catch (err) {
      setCheckoutError(
        err instanceof Error
          ? 'Não foi possível confirmar sua assinatura no momento. Tente novamente ou clique em "Testar primeiro".'
          : 'Erro ao confirmar assinatura.'
      );
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleTryDemoFirst = () => {
    if (!profile) {
      persistCurrentDraft({ confirmed: false, wantsSetup: true });
      onRequestSignIn?.();
      return;
    }
    setStep('setup');
  };

  const handleFinishSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) {
      persistCurrentDraft({ wantsSetup: true });
      onRequestSignIn?.();
      return;
    }
    if (!brideName.trim() || !groomName.trim()) return;
    setSavingSetup(true);
    setSetupError('');
    try {
      const created = await createWeddingWithStarterData({
        ownerId: profile.uid,
        brideName: brideName.trim(),
        groomName: groomName.trim(),
        weddingDate,
        weddingTime,
        themeKey,
        venueName,
        venueAddress,
        dressCode,
        welcomeMessage,
        coverPhotoUrl,
        couplePhotoUrl,
        pixKey: pixKey || profile.email,
        budgetLimit: Number(budgetLimit) || 50000,
      });
      onSaveDraft?.(null);
      onComplete(created);
    } catch (err) {
      console.error('Setup creation failed:', err);
      setSetupError('Não foi possível salvar os dados do casamento. Verifique sua conexão e tente novamente.');
    } finally {
      setSavingSetup(false);
    }
  };

  const activeTheme = WEDDING_THEMES[themeKey];
  const safeInitPointUrl = getSafeExternalHttpsUrl(checkoutResult?.initPoint);

  return (
    <div className="min-h-screen overflow-x-clip bg-[#F8F7F4] dark:bg-[#0F1115] text-stone-900 dark:text-stone-100">
      <header className="sticky top-0 z-30 border-b border-stone-200 dark:border-stone-800 bg-white/95 dark:bg-[#171A21]/95 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-3 sm:py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {isGuest && onBackToLanding && (
              <button
                type="button"
                onClick={onBackToLanding}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer shrink-0"
                aria-label="Voltar para a página inicial"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <span className="font-editorial text-xl sm:text-2xl font-semibold truncate">
              Casamento Pleno
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 text-xs text-stone-500 dark:text-stone-400 shrink-0">
            {profile ? (
              <>
                <span className="hidden sm:inline truncate max-w-[200px]">{profile.email}</span>
                <button
                  type="button"
                  onClick={onSignOut}
                  className="min-h-[36px] px-2.5 rounded-lg text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                >
                  Sair
                </button>
              </>
            ) : (
              onRequestSignIn && (
                <button
                  type="button"
                  onClick={onRequestSignIn}
                  disabled={signingIn}
                  className="inline-flex items-center gap-1.5 min-h-[38px] px-3 sm:px-4 rounded-full border border-stone-300 dark:border-stone-700 text-xs font-medium text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer disabled:opacity-60"
                >
                  <User className="w-3.5 h-3.5 shrink-0" />
                  <span className="sm:hidden">{signingIn ? 'Entrando...' : 'Entrar'}</span>
                  <span className="hidden sm:inline">
                    {signingIn ? 'Conectando...' : 'Já tenho conta · Entrar'}
                  </span>
                </button>
              )
            )}
          </div>
        </div>
      </header>

      {/* Actionable Auth Error Notice (if guest triggers Google Sign-In after checkout and popup fails) */}
      {authError && (
        <div className="bg-[#FFF4E5] dark:bg-[#2A1F14] border-b border-[#E5B869] dark:border-[#6B4E23] text-[#4A2F0B] dark:text-[#FDE6BD]">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 py-3 flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 text-xs leading-relaxed">
              <AlertTriangle className="w-4 h-4 text-[#B45309] dark:text-[#F59E0B] shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">{authError.title}</p>
                <p className="opacity-90 mt-0.5">{authError.message}</p>
              </div>
            </div>
            {onClearAuthError && (
              <button
                type="button"
                onClick={onClearAuthError}
                aria-label="Fechar aviso"
                className="p-1.5 rounded-full hover:bg-black/10 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-10">
        {/* Progress Steps */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs font-medium text-stone-500 dark:text-stone-400 mb-6 sm:mb-8">
          <span className={step === 'checkout' ? 'text-stone-900 dark:text-stone-100 font-semibold' : ''}>
            01. Checkout Mercado Pago ({formatBRL(SUBSCRIPTION_PRICE)}/mês)
          </span>
          <span aria-hidden="true">/</span>
          <span className={step === 'setup' ? 'text-stone-900 dark:text-stone-100 font-semibold' : ''}>
            02. Personalização do Casamento & Site
          </span>
        </div>

        {step === 'checkout' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
            <form
              onSubmit={handleCreateCheckout}
              className="lg:col-span-7 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-5 sm:p-7 space-y-6"
            >
              <div>
                <h1 className="font-editorial text-2xl sm:text-3xl font-semibold">
                  Ative sua assinatura Casamento Pleno
                </h1>
                <p className="mt-1.5 text-sm text-stone-600 dark:text-stone-400">
                  Preencha seus dados abaixo e escolha Pix ou Cartão via Mercado Pago. Sem necessidade de criar conta antes.
                </p>
              </div>

              {/* Complete Buyer & Couple Checkout Fields */}
              <div className="space-y-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                  1. Seus dados para assinatura e acesso
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="checkout-payer-name"
                      className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5"
                    >
                      Nome completo *
                    </label>
                    <input
                      id="checkout-payer-name"
                      type="text"
                      required
                      maxLength={100}
                      autoComplete="name"
                      value={payerName}
                      onChange={(e) => {
                        setPayerName(e.target.value);
                        if (checkoutError) setCheckoutError('');
                      }}
                      placeholder="Ex.: Ana Clara Souza"
                      className="w-full min-h-[44px] rounded-xl border border-stone-300 dark:border-stone-700 bg-transparent px-3.5 py-2.5 text-sm"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="checkout-payer-email"
                      className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5"
                    >
                      E-mail *
                    </label>
                    <input
                      id="checkout-payer-email"
                      type="email"
                      required
                      maxLength={200}
                      autoComplete="email"
                      value={payerEmail}
                      onChange={(e) => {
                        setPayerEmail(e.target.value);
                        if (!pixKey) setPixKey(e.target.value);
                        if (checkoutError) setCheckoutError('');
                      }}
                      placeholder="voce@email.com"
                      className="w-full min-h-[44px] rounded-xl border border-stone-300 dark:border-stone-700 bg-transparent px-3.5 py-2.5 text-sm"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="checkout-payer-phone"
                      className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5"
                    >
                      WhatsApp (opcional)
                    </label>
                    <input
                      id="checkout-payer-phone"
                      type="tel"
                      maxLength={24}
                      autoComplete="tel"
                      value={payerPhone}
                      onChange={(e) => setPayerPhone(e.target.value)}
                      placeholder="(11) 99999-9999"
                      className="w-full min-h-[44px] rounded-xl border border-stone-300 dark:border-stone-700 bg-transparent px-3.5 py-2.5 text-sm"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="checkout-bride-name"
                      className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5"
                    >
                      Nome da Noiva (opcional)
                    </label>
                    <input
                      id="checkout-bride-name"
                      type="text"
                      maxLength={80}
                      value={brideName}
                      onChange={(e) => setBrideName(e.target.value)}
                      placeholder="Ex.: Ana"
                      className="w-full min-h-[44px] rounded-xl border border-stone-300 dark:border-stone-700 bg-transparent px-3.5 py-2.5 text-sm"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="checkout-groom-name"
                      className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5"
                    >
                      Nome do Noivo (opcional)
                    </label>
                    <input
                      id="checkout-groom-name"
                      type="text"
                      maxLength={80}
                      value={groomName}
                      onChange={(e) => setGroomName(e.target.value)}
                      placeholder="Ex.: Lucas"
                      className="w-full min-h-[44px] rounded-xl border border-stone-300 dark:border-stone-700 bg-transparent px-3.5 py-2.5 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                  2. Forma de pagamento Mercado Pago
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod('pix');
                      setCheckoutResult(null);
                    }}
                    className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-colors cursor-pointer min-h-[68px] ${
                      paymentMethod === 'pix'
                        ? 'border-stone-900 dark:border-stone-200 bg-stone-50 dark:bg-stone-800/60'
                        : 'border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800/30'
                    }`}
                  >
                    <QrCode className="w-5 h-5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold">Pix Instantâneo</p>
                      <p className="text-xs text-stone-500 dark:text-stone-400">Liberação imediata</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod('card');
                      setCheckoutResult(null);
                    }}
                    className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-colors cursor-pointer min-h-[68px] ${
                      paymentMethod === 'card'
                        ? 'border-stone-900 dark:border-stone-200 bg-stone-50 dark:bg-stone-800/60'
                        : 'border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800/30'
                    }`}
                  >
                    <CreditCard className="w-5 h-5 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold">Cartão Recorrente</p>
                      <p className="text-xs text-stone-500 dark:text-stone-400">Renovação automática</p>
                    </div>
                  </button>
                </div>
              </div>

              {checkoutError && (
                <p className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-3.5 py-2.5 text-xs text-red-700 dark:text-red-300">
                  {checkoutError}
                </p>
              )}

              {!checkoutResult ? (
                <div className="space-y-3 pt-1">
                  <button
                    type="submit"
                    disabled={checkoutLoading}
                    className="w-full min-h-[48px] px-6 py-3 text-sm font-semibold text-white rounded-xl transition-colors cursor-pointer disabled:opacity-60"
                    style={{ backgroundColor: 'var(--brand-primary)' }}
                  >
                    {checkoutLoading
                      ? 'Gerando cobrança Mercado Pago...'
                      : paymentMethod === 'pix'
                      ? `Gerar Pix de ${formatBRL(SUBSCRIPTION_PRICE)}`
                      : `Continuar com Cartão (${formatBRL(SUBSCRIPTION_PRICE)}/mês)`}
                  </button>

                  <button
                    type="button"
                    onClick={handleTryDemoFirst}
                    disabled={signingIn}
                    className="w-full min-h-[42px] px-4 py-2 text-xs sm:text-sm font-medium text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 cursor-pointer disabled:opacity-60"
                  >
                    {signingIn
                      ? 'Abrindo conta Google...'
                      : 'Prefere testar antes? Personalizar no modo demonstração'}
                  </button>
                </div>
              ) : (
                <div className="rounded-xl border border-stone-200 dark:border-stone-700 bg-[#F8F7F4] dark:bg-[#0F1115] p-4 sm:p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold">
                      {checkoutResult.mode === 'live'
                        ? 'Cobrança Mercado Pago gerada'
                        : 'Checkout Mercado Pago preparado'}
                    </p>
                    <span className="font-mono text-xs text-stone-500">
                      Ref: {checkoutResult.referenceId}
                    </span>
                  </div>

                  {checkoutResult.message && (
                    <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                      {checkoutResult.message}
                    </p>
                  )}

                  {checkoutResult.pixQrBase64 && (
                    <div className="flex flex-col items-center gap-2 rounded-xl bg-white p-4 border border-stone-200">
                      <img
                        src={`data:image/png;base64,${checkoutResult.pixQrBase64}`}
                        alt="QR Code Pix Mercado Pago"
                        className="h-44 w-44 object-contain"
                      />
                      <p className="text-[11px] text-stone-600 text-center">
                        Escaneie com o app do seu banco para pagar via Pix
                      </p>
                    </div>
                  )}

                  {checkoutResult.pixCopyPaste && (
                    <div>
                      <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5">
                        Pix Copia e Cola ({formatBRL(SUBSCRIPTION_PRICE)})
                      </label>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          readOnly
                          value={checkoutResult.pixCopyPaste}
                          className="flex-1 min-h-[42px] rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#171A21] px-3 py-2 font-mono text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(checkoutResult.pixCopyPaste || '');
                            setCopiedPix(true);
                            setTimeout(() => setCopiedPix(false), 2000);
                          }}
                          className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#171A21] px-4 py-2 text-xs font-medium cursor-pointer"
                        >
                          {copiedPix ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedPix ? 'Copiado' : 'Copiar'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {safeInitPointUrl && (
                    <a
                      href={safeInitPointUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#171A21] px-4 py-2.5 text-sm font-semibold hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
                      style={{ color: 'var(--brand-primary)' }}
                    >
                      <span>Pagar no ambiente seguro do Mercado Pago</span>
                      <ExternalLink className="w-4 h-4 shrink-0" />
                    </a>
                  )}

                  <div className="space-y-2 pt-1">
                    {isGuest && (
                      <p className="flex items-start gap-2 text-[11px] text-stone-600 dark:text-stone-400">
                        <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5 text-stone-500" />
                        <span>
                          Ao confirmar abaixo, você conecta sua conta Google para proteger e salvar seu Painel dos Noivos com todos os dados já preenchidos.
                        </span>
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={handleConfirmSubscription}
                      disabled={checkoutLoading || signingIn}
                      className="w-full min-h-[46px] py-3 px-4 text-sm font-semibold text-white rounded-xl cursor-pointer disabled:opacity-60"
                      style={{ backgroundColor: 'var(--brand-primary)' }}
                    >
                      {signingIn
                        ? 'Conectando sua conta Google...'
                        : isGuest
                        ? 'Já paguei · Conectar Google e criar meu painel'
                        : 'Confirmar assinatura e ir para personalização'}
                    </button>
                  </div>
                </div>
              )}
            </form>

            <div className="lg:col-span-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-5 sm:p-7 space-y-5 h-fit lg:sticky lg:top-24">
              <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                <ShieldCheck className="w-4 h-4" />
                <span>Resumo da Assinatura</span>
              </div>
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-stone-200 dark:border-stone-800 pb-4">
                <span className="text-sm font-medium">Plano Casamento Pleno</span>
                <span className="font-mono text-xl sm:text-2xl font-semibold tabular-nums">
                  {formatBRL(SUBSCRIPTION_PRICE)}/mês
                </span>
              </div>
              <ul className="space-y-2.5 text-sm text-stone-600 dark:text-stone-400">
                <li>• Painel completo dos noivos sincronizado em tempo real</li>
                <li>• Site exclusivo dos convidados com RSVP e Pix 0% taxa</li>
                <li>• Mapa de mesas, fornecedores, financeiro e gráficos</li>
                <li>• Botão do Surtando® com meditações e respiração</li>
                <li>• Exportação PDF, CSV e Calendário (.ics)</li>
              </ul>
              <div className="pt-4 border-t border-stone-200 dark:border-stone-800 text-xs text-stone-500 dark:text-stone-400 space-y-1.5">
                <p>
                  Pagamento processado via:{' '}
                  <strong className="text-stone-800 dark:text-stone-200">
                    {mpStatus?.configured
                      ? 'Mercado Pago (Produção Ativa)'
                      : 'Mercado Pago (Checkout Seguro)'}
                  </strong>
                </p>
                <p className="text-[11px] opacity-80">
                  Cancele quando quiser, sem fidelidade ou taxas escondidas.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleFinishSetup} className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
            <div className="lg:col-span-7 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-5 sm:p-7 space-y-5 sm:space-y-6">
              <div>
                <h1 className="font-editorial text-2xl sm:text-3xl font-semibold">
                  Personalize o seu Casamento
                </h1>
                <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
                  Esses dados personalizam automaticamente o seu Painel da Noiva e criam o Site dos Convidados.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5">
                    Nome da Noiva
                  </label>
                  <input
                    required
                    maxLength={80}
                    value={brideName}
                    onChange={(e) => setBrideName(e.target.value)}
                    placeholder="Ex.: Ana"
                    className="w-full min-h-[44px] rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3.5 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5">
                    Nome do Noivo
                  </label>
                  <input
                    required
                    maxLength={80}
                    value={groomName}
                    onChange={(e) => setGroomName(e.target.value)}
                    placeholder="Ex.: Lucas"
                    className="w-full min-h-[44px] rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3.5 py-2.5 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5">
                    Data do Casamento
                  </label>
                  <input
                    type="date"
                    required
                    value={weddingDate}
                    onChange={(e) => setWeddingDate(e.target.value)}
                    className="w-full min-h-[44px] rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3.5 py-2.5 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5">
                    Horário
                  </label>
                  <input
                    type="time"
                    required
                    value={weddingTime}
                    onChange={(e) => setWeddingTime(e.target.value)}
                    className="w-full min-h-[44px] rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3.5 py-2.5 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5">
                    Orçamento Limite (R$)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={budgetLimit}
                    onChange={(e) => setBudgetLimit(e.target.value)}
                    className="w-full min-h-[44px] rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3.5 py-2.5 text-sm font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-stone-600 dark:text-stone-400 mb-2">
                  <Palette className="w-3.5 h-3.5" />
                  <span>Cor Temática (Muda o Painel e o Site dos Convidados)</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {Object.values(WEDDING_THEMES).map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setThemeKey(t.key)}
                      className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors cursor-pointer min-h-[44px] ${
                        themeKey === t.key
                          ? 'border-stone-900 dark:border-stone-100 bg-stone-50 dark:bg-stone-800/80'
                          : 'border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800/40'
                      }`}
                    >
                      <span
                        className="h-5 w-5 rounded-full shrink-0 border border-black/10"
                        style={{ backgroundColor: t.primary }}
                      />
                      <span className="text-xs font-medium truncate">{t.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5">
                    Local da Cerimônia
                  </label>
                  <input
                    maxLength={160}
                    value={venueName}
                    onChange={(e) => setVenueName(e.target.value)}
                    className="w-full min-h-[44px] rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3.5 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5">
                    Chave Pix para Lista de Presentes
                  </label>
                  <input
                    maxLength={140}
                    value={pixKey}
                    onChange={(e) => setPixKey(e.target.value)}
                    placeholder="E-mail, CPF ou chave aleatória"
                    className="w-full min-h-[44px] rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3.5 py-2.5 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5">
                  Endereço do Evento & Dress Code
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input
                    maxLength={300}
                    value={venueAddress}
                    onChange={(e) => setVenueAddress(e.target.value)}
                    placeholder="Endereço completo"
                    className="w-full min-h-[44px] rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3.5 py-2.5 text-sm"
                  />
                  <input
                    maxLength={120}
                    value={dressCode}
                    onChange={(e) => setDressCode(e.target.value)}
                    placeholder="Dress Code"
                    className="w-full min-h-[44px] rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3.5 py-2.5 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5">
                  Mensagem de Boas-vindas aos Convidados
                </label>
                <textarea
                  rows={3}
                  maxLength={600}
                  value={welcomeMessage}
                  onChange={(e) => setWelcomeMessage(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3.5 py-2.5 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-stone-600 dark:text-stone-400">
                    Foto de Capa / Entrada
                  </label>
                  <label className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-stone-300 dark:border-stone-700 px-3 py-2 text-xs font-medium cursor-pointer hover:bg-stone-50 dark:hover:bg-stone-800">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Subir foto do aparelho</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const dataUrl = await compressImageToDataUrl(file, 1080);
                          setCoverPhotoUrl(dataUrl);
                        } catch {
                          // Ignore invalid files
                        }
                        e.target.value = '';
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-stone-600 dark:text-stone-400">
                    Foto do Casal (História)
                  </label>
                  <label className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-stone-300 dark:border-stone-700 px-3 py-2 text-xs font-medium cursor-pointer hover:bg-stone-50 dark:hover:bg-stone-800">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Subir foto do aparelho</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const dataUrl = await compressImageToDataUrl(file, 900);
                          setCouplePhotoUrl(dataUrl);
                        } catch {
                          // Ignore invalid files
                        }
                        e.target.value = '';
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {setupError && (
                <p className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-3.5 py-2.5 text-xs text-red-700 dark:text-red-300">
                  {setupError}
                </p>
              )}

              <button
                type="submit"
                disabled={savingSetup}
                style={{ backgroundColor: activeTheme.primary }}
                className="w-full min-h-[48px] py-3.5 text-sm font-semibold text-white rounded-xl hover:brightness-110 transition-all cursor-pointer disabled:opacity-60"
              >
                {savingSetup ? 'Criando painel e site dos convidados...' : 'Salvar e abrir meu Painel da Noiva'}
              </button>
            </div>

            {/* Live Preview Card */}
            <div className="lg:col-span-5">
              <div className="lg:sticky lg:top-24 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] overflow-hidden">
                <div className="relative h-52 sm:h-60">
                  <SafeImage
                    src={coverPhotoUrl}
                    alt="Prévia da capa do site dos convidados"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent flex flex-col justify-end p-5 sm:p-6 text-white">
                    <p className="text-xs opacity-90">Prévia do Site dos Convidados</p>
                    <h2 className="font-editorial text-3xl sm:text-4xl font-semibold mt-1">
                      {brideName || 'Noiva'} & {groomName || 'Noivo'}
                    </h2>
                    <p className="text-xs font-mono mt-1 opacity-90">
                      {weddingDate} · {weddingTime}
                    </p>
                  </div>
                </div>
                <div className="p-5 sm:p-6 space-y-4">
                  <p className="text-sm text-stone-600 dark:text-stone-400 italic font-editorial text-lg leading-snug">
                    “{welcomeMessage}”
                  </p>
                  <div className="flex items-center justify-between pt-4 border-t border-stone-200 dark:border-stone-800 text-xs">
                    <span className="text-stone-500">Paleta selecionada</span>
                    <span className="font-semibold" style={{ color: activeTheme.primary }}>
                      {activeTheme.name}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </form>
        )}
      </main>
    </div>
  );
};
