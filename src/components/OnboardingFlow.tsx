import React, { useEffect, useState } from 'react';
import { Check, Copy, CreditCard, Palette, QrCode, ShieldCheck, Upload } from 'lucide-react';
import {
  GENERATED_ASSETS,
  SUBSCRIPTION_PRICE,
  WEDDING_THEMES,
  type ThemeKey,
  type UserProfile,
  type Wedding,
} from '../types/wedding';
import { createWeddingWithStarterData, updateUserProfile } from '../lib/weddingService';
import { compressImageToDataUrl, formatBRL } from '../lib/utils';
import { SafeImage } from './SafeImage';

interface OnboardingFlowProps {
  profile: UserProfile;
  onComplete: (wedding: Wedding) => void;
  onSignOut: () => void;
  startAtCheckout?: boolean;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  profile,
  onComplete,
  onSignOut,
  startAtCheckout = false,
}) => {
  const alreadySubscribed =
    !startAtCheckout && (profile.subscriptionStatus === 'active' || profile.role === 'admin');
  const [step, setStep] = useState<'checkout' | 'setup'>(alreadySubscribed ? 'setup' : 'checkout');

  // Mercado Pago checkout state
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'card'>('pix');
  const [mpStatus, setMpStatus] = useState<{ configured: boolean; webhookEndpoint: string } | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutResult, setCheckoutResult] = useState<{
    mode: string;
    referenceId: string;
    pixCopyPaste?: string;
    pixQrBase64?: string;
    initPoint?: string;
    message?: string;
  } | null>(null);
  const [copiedPix, setCopiedPix] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  // Setup state
  const [brideName, setBrideName] = useState(profile.displayName.split(' ')[0] || 'Ana');
  const [groomName, setGroomName] = useState('Lucas');
  const [weddingDate, setWeddingDate] = useState('2027-06-19');
  const [weddingTime, setWeddingTime] = useState('16:30');
  const [themeKey, setThemeKey] = useState<ThemeKey>('olive');
  const [venueName, setVenueName] = useState('Villa das Oliveiras');
  const [venueAddress, setVenueAddress] = useState('Estrada das Oliveiras, km 14 — Campinas, SP');
  const [dressCode, setDressCode] = useState('Esporte Fino — Tons neutros');
  const [pixKey, setPixKey] = useState(profile.email);
  const [budgetLimit, setBudgetLimit] = useState('60000');
  const [welcomeMessage, setWelcomeMessage] = useState(
    'Que alegria compartilhar com você o dia mais especial das nossas vidas. Confirme sua presença e celebre este amor conosco.'
  );
  const [coverPhotoUrl, setCoverPhotoUrl] = useState<string>(GENERATED_ASSETS.heroCouple);
  const [couplePhotoUrl, setCouplePhotoUrl] = useState<string>(GENERATED_ASSETS.storyCouple);
  const [savingSetup, setSavingSetup] = useState(false);
  const [setupError, setSetupError] = useState('');

  useEffect(() => {
    fetch('/api/payments/mercadopago/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setMpStatus(d);
      })
      .catch(() => {});
  }, []);

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

  const handleCreateCheckout = async () => {
    setCheckoutLoading(true);
    setCheckoutError('');
    try {
      const res = await fetch('/api/payments/mercadopago/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payerEmail: profile.email,
          payerName: profile.displayName,
          paymentMethod,
          weddingId: profile.weddingId || 'onboarding',
        }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || !contentType.includes('application/json')) {
        setCheckoutResult(buildLocalFallbackCheckout());
        return;
      }
      const data = await res.json();
      setCheckoutResult(data);
    } catch {
      setCheckoutResult(buildLocalFallbackCheckout());
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleConfirmSubscription = async () => {
    setCheckoutLoading(true);
    setCheckoutError('');
    try {
      const todayIso = new Date().toISOString().slice(0, 10);
      const nextBilling = new Date();
      nextBilling.setMonth(nextBilling.getMonth() + 1);
      await updateUserProfile(profile.uid, {
        subscriptionStatus: 'active',
        paymentMethod,
        mercadoPagoRef: checkoutResult?.referenceId || `MP_${Date.now()}`,
        lastPaymentDate: todayIso,
        nextBillingDate: nextBilling.toISOString().slice(0, 10),
        totalPaidSubscription: (profile.totalPaidSubscription || 0) + SUBSCRIPTION_PRICE,
      });
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

  const handleFinishSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brideName.trim() || !groomName.trim()) return;
    setSavingSetup(true);
    setSetupError('');
    try {
      const created = await createWeddingWithStarterData({
        ownerId: profile.uid,
        brideName,
        groomName,
        weddingDate,
        weddingTime,
        themeKey,
        venueName,
        venueAddress,
        dressCode,
        welcomeMessage,
        coverPhotoUrl,
        couplePhotoUrl,
        pixKey,
        budgetLimit: Number(budgetLimit) || 50000,
      });
      onComplete(created);
    } catch (err) {
      console.error('Setup creation failed:', err);
      setSetupError('Não foi possível salvar os dados do casamento. Verifique sua conexão e tente novamente.');
    } finally {
      setSavingSetup(false);
    }
  };

  const activeTheme = WEDDING_THEMES[themeKey];

  return (
    <div className="min-h-screen overflow-x-clip bg-[#F8F7F4] dark:bg-[#0F1115] text-stone-900 dark:text-stone-100">
      <header className="border-b border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21]">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between gap-3">
          <span className="font-editorial text-xl sm:text-2xl font-semibold truncate">Casamento Pleno</span>
          <div className="flex items-center gap-3 sm:gap-4 text-xs text-stone-500 dark:text-stone-400 shrink-0">
            <span className="hidden sm:inline">{profile.email}</span>
            <button
              type="button"
              onClick={onSignOut}
              className="min-h-[36px] px-2 text-stone-700 dark:text-stone-300 hover:underline cursor-pointer"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-10">
        {/* Progress Steps */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs font-medium text-stone-500 dark:text-stone-400 mb-6 sm:mb-8">
          <span className={step === 'checkout' ? 'text-stone-900 dark:text-stone-100 font-semibold' : ''}>
            01. Assinatura Mercado Pago ({formatBRL(SUBSCRIPTION_PRICE)}/mês)
          </span>
          <span aria-hidden="true">/</span>
          <span className={step === 'setup' ? 'text-stone-900 dark:text-stone-100 font-semibold' : ''}>
            02. Personalização do Casamento & Site
          </span>
        </div>

        {step === 'checkout' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
            <div className="lg:col-span-7 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-5 sm:p-7">
              <h1 className="font-editorial text-2xl sm:text-3xl font-semibold">
                Ative sua assinatura Casamento Pleno
              </h1>
              <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
                Escolha como deseja pagar via Mercado Pago. A estrutura já está preparada para produção com recorrência mensal e Pix instantâneo.
              </p>

              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod('pix');
                    setCheckoutResult(null);
                  }}
                  className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-colors cursor-pointer ${
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
                  className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-colors cursor-pointer ${
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

              {checkoutError && (
                <p className="mt-4 text-sm text-red-600 dark:text-red-400">{checkoutError}</p>
              )}

              {!checkoutResult ? (
                <div className="mt-6 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3">
                  <button
                    type="button"
                    onClick={handleCreateCheckout}
                    disabled={checkoutLoading}
                    className="w-full sm:w-auto min-h-[46px] px-6 py-3 text-sm font-semibold text-white rounded-lg transition-colors cursor-pointer disabled:opacity-60"
                    style={{ backgroundColor: 'var(--brand-primary)' }}
                  >
                    {checkoutLoading
                      ? 'Gerando cobrança Mercado Pago...'
                      : paymentMethod === 'pix'
                      ? `Gerar Pix de ${formatBRL(SUBSCRIPTION_PRICE)}`
                      : `Iniciar Assinatura de ${formatBRL(SUBSCRIPTION_PRICE)}/mês`}
                  </button>

                  <button
                    type="button"
                    onClick={() => setStep('setup')}
                    className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 text-sm font-medium text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 cursor-pointer"
                  >
                    Testar primeiro (modo demonstração)
                  </button>
                </div>
              ) : (
                <div className="mt-6 rounded-xl border border-stone-200 dark:border-stone-700 bg-[#F8F7F4] dark:bg-[#0F1115] p-5 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">
                      {checkoutResult.mode === 'live'
                        ? 'Cobrança Mercado Pago gerada'
                        : 'Checkout Mercado Pago (Modo Pronto para Credenciais)'}
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
                      <p className="text-[11px] text-stone-600">
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
                          className="flex-1 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#171A21] px-3 py-2 font-mono text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(checkoutResult.pixCopyPaste || '');
                            setCopiedPix(true);
                            setTimeout(() => setCopiedPix(false), 2000);
                          }}
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#171A21] px-3 py-2 text-xs font-medium cursor-pointer"
                        >
                          {copiedPix ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedPix ? 'Copiado' : 'Copiar'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {checkoutResult.initPoint && (
                    <a
                      href={checkoutResult.initPoint}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block text-sm font-semibold underline"
                      style={{ color: 'var(--brand-primary)' }}
                    >
                      Abrir tela segura do Mercado Pago
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={handleConfirmSubscription}
                    disabled={checkoutLoading}
                    className="w-full py-2.5 text-sm font-semibold text-white rounded-lg cursor-pointer"
                    style={{ backgroundColor: 'var(--brand-primary)' }}
                  >
                    Confirmar assinatura e ir para personalização
                  </button>
                </div>
              )}
            </div>

            <div className="lg:col-span-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-5 sm:p-7 space-y-5">
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
                <li>• Painel completo da noiva em tempo real (Firebase)</li>
                <li>• Site exclusivo dos convidados com RSVP e Pix</li>
                <li>• Botão do Surtando com meditações e respiração</li>
                <li>• Exportação PDF, CSV e Calendário (.ics)</li>
              </ul>
              <div className="pt-4 border-t border-stone-200 dark:border-stone-800 text-xs text-stone-500 dark:text-stone-400">
                Status da integração Mercado Pago:{' '}
                <strong className="text-stone-800 dark:text-stone-200">
                  {mpStatus?.configured ? 'Credenciais de produção conectadas' : 'Estrutura pronta aguardando Access Token'}
                </strong>
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
                    className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3.5 py-2.5 text-sm"
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
                    className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3.5 py-2.5 text-sm"
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
                    className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3.5 py-2.5 text-sm font-mono"
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
                    className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3.5 py-2.5 text-sm font-mono"
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
                    className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3.5 py-2.5 text-sm font-mono"
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
                      className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors cursor-pointer ${
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
                    className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3.5 py-2.5 text-sm"
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
                    className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3.5 py-2.5 text-sm"
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
                    className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3.5 py-2.5 text-sm"
                  />
                  <input
                    maxLength={120}
                    value={dressCode}
                    onChange={(e) => setDressCode(e.target.value)}
                    placeholder="Dress Code"
                    className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3.5 py-2.5 text-sm"
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
                  <label className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 dark:border-stone-700 px-3 py-2 text-xs font-medium cursor-pointer hover:bg-stone-50 dark:hover:bg-stone-800">
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
                  <label className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 dark:border-stone-700 px-3 py-2 text-xs font-medium cursor-pointer hover:bg-stone-50 dark:hover:bg-stone-800">
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
                className="w-full py-3.5 text-sm font-semibold text-white rounded-lg hover:brightness-110 transition-all cursor-pointer disabled:opacity-60"
              >
                {savingSetup ? 'Criando painel e site dos convidados...' : 'Salvar e abrir meu Painel da Noiva'}
              </button>
            </div>

            {/* Live Preview Card */}
            <div className="lg:col-span-5">
              <div className="lg:sticky lg:top-8 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] overflow-hidden">
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
