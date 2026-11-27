import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Calendar,
  Check,
  Copy,
  ExternalLink,
  Heart,
  LayoutGrid,
  Monitor,
  Moon,
  PlayCircle,
  ShieldCheck,
  Smartphone,
  Store,
  Sun,
  User,
  Users,
  Wallet,
  Wind,
  X,
  Zap,
} from 'lucide-react';
import { GENERATED_ASSETS, SUBSCRIPTION_PRICE } from '../types/wedding';
import type { AuthErrorInfo } from '../lib/firebase';
import { formatBRL } from '../lib/utils';
import { PWAInstallButton } from './PWAInstallButton';
import { SafeImage } from './SafeImage';

interface LandingPageProps {
  onSignIn: () => void;
  onOpenDemoSite: () => void;
  signingIn: boolean;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  authError?: AuthErrorInfo | null;
  onClearAuthError?: () => void;
}

const IntertwinedHeartsLogo: React.FC<{ className?: string }> = ({ className = 'w-9 h-8' }) => (
  <svg
    viewBox="0 0 48 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M17.5 31.5C17.5 31.5 6.5 23.8 6.5 14.5C6.5 9.8 10.1 6.5 14.3 6.5C17.2 6.5 19.6 8.1 20.8 10.4C22 8.1 24.4 6.5 27.3 6.5C31.5 6.5 35.1 9.8 35.1 14.5C35.1 23.8 24.1 31.5 17.5 31.5Z"
      stroke="#DFBE7A"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M27.5 33.5C27.5 33.5 16.5 25.8 16.5 16.5C16.5 11.8 20.1 8.5 24.3 8.5C27.2 8.5 29.6 10.1 30.8 12.4C32 10.1 34.4 8.5 37.3 8.5C41.5 8.5 45.1 11.8 45.1 16.5C45.1 25.8 34.1 33.5 27.5 33.5Z"
      stroke="#C99F54"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const CalligraphicHeartFlourish: React.FC<{ className?: string }> = ({ className = 'inline-block w-16 h-10 -ml-1 -mt-2' }) => (
  <svg
    viewBox="0 0 96 56"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M4 44C22 44 38 42 52 33C64 25 71 15 66 9C62 4 54 7 53 15C52 7 44 4 40 9C35 15 41 25 53 33C65 41 79 44 92 42"
      stroke="#C89F52"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const BotanicalCornerSvg: React.FC<{ className?: string }> = ({ className = 'w-28 h-36' }) => (
  <svg
    viewBox="0 0 120 160"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M8 152C16 118 30 82 54 44"
      stroke="#C9A35B"
      strokeWidth="1.2"
      strokeLinecap="round"
      opacity="0.7"
    />
    <path
      d="M20 124C6 112 4 95 16 86C26 95 27 110 20 124Z"
      stroke="#C9A35B"
      strokeWidth="1.1"
      opacity="0.6"
    />
    <path
      d="M32 96C48 86 64 88 70 100C57 109 42 108 32 96Z"
      stroke="#C9A35B"
      strokeWidth="1.1"
      opacity="0.6"
    />
    <path
      d="M40 72C26 60 25 42 36 34C46 43 48 58 40 72Z"
      stroke="#C9A35B"
      strokeWidth="1.1"
      opacity="0.6"
    />
    <path
      d="M52 46C65 36 80 37 86 48C74 56 60 56 52 46Z"
      stroke="#C9A35B"
      strokeWidth="1.1"
      opacity="0.55"
    />
  </svg>
);

export const LandingPage: React.FC<LandingPageProps> = ({
  onSignIn,
  onOpenDemoSite,
  signingIn,
  darkMode,
  onToggleDarkMode,
  authError,
  onClearAuthError,
}) => {
  const [copiedDomain, setCopiedDomain] = useState(false);
  const featureDockItems = [
    {
      icon: <Users className="w-6 h-6 text-[#B68B3C]" strokeWidth={1.6} />,
      title: 'Lista de Convidados inteligente',
    },
    {
      icon: <LayoutGrid className="w-6 h-6 text-[#B68B3C]" strokeWidth={1.6} />,
      title: 'Mapa de Mesas',
    },
    {
      icon: <Wallet className="w-6 h-6 text-[#B68B3C]" strokeWidth={1.6} />,
      title: 'Orçamento e Cofre Seguro',
    },
    {
      icon: <Store className="w-6 h-6 text-[#B68B3C]" strokeWidth={1.6} />,
      title: 'Fornecedores organizados',
    },
    {
      icon: <Monitor className="w-6 h-6 text-[#B68B3C]" strokeWidth={1.6} />,
      title: 'Site dos Convidados com Presentes via Pix',
    },
    {
      icon: <Heart className="w-6 h-6 text-[#B68B3C]" strokeWidth={1.6} />,
      title: 'Botão do Surtando®',
    },
  ];

  return (
    <div className="min-h-screen bg-[#FDF8F2] dark:bg-[#0D1310] text-[#1D2620] dark:text-[#F4EFE6]">
      {/* Deep Forest Green & Champagne Gold Top Bar */}
      <header className="sticky top-0 z-40 bg-[#173526] text-[#FBF7F0] border-b border-[#C9A35B]/25 shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-5 sm:px-8 py-3.5">
          {/* Brand Emblem */}
          <a href="#inicio" className="flex items-center gap-3 shrink-0 group">
            <IntertwinedHeartsLogo className="w-9 h-8 transition-transform group-hover:scale-105" />
            <div className="leading-none">
              <span className="font-editorial text-2xl sm:text-[26px] font-semibold tracking-tight text-white block">
                Casamento Pleno
              </span>
              <div className="mt-0.5 flex items-center justify-center gap-2 text-[9px] tracking-[0.28em] text-[#DFBE7A]">
                <span className="h-px w-6 bg-[#DFBE7A]/60" />
                <span>APP</span>
                <span className="h-px w-6 bg-[#DFBE7A]/60" />
              </div>
            </div>
          </a>

          {/* Center Navigation */}
          <nav className="hidden lg:flex items-center gap-7 text-sm font-medium text-[#EFE9DC]/90">
            <a href="#recursos" className="hover:text-[#DFBE7A] transition-colors whitespace-nowrap shrink-0">
              Recursos
            </a>
            <a href="#como-funciona" className="hover:text-[#DFBE7A] transition-colors whitespace-nowrap shrink-0">
              Como Funciona
            </a>
            <a href="#plano" className="hover:text-[#DFBE7A] transition-colors whitespace-nowrap shrink-0">
              Planos
            </a>
            <button
              type="button"
              onClick={onOpenDemoSite}
              className="hover:text-[#DFBE7A] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Site Modelo
            </button>
            <a href="#celular" className="hover:text-[#DFBE7A] transition-colors whitespace-nowrap shrink-0">
              Aplicativo
            </a>
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onToggleDarkMode}
              className="p-2 rounded-full border border-[#DFBE7A]/35 text-[#F2DFB6] hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Alternar tema claro ou escuro"
              title={darkMode ? 'Modo Claro' : 'Modo Escuro'}
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={onSignIn}
              disabled={signingIn}
              className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 text-xs sm:text-sm font-medium text-[#FBF2DC] rounded-full border border-[#DFBE7A]/80 bg-[#1F4532]/70 hover:bg-[#DFBE7A] hover:text-[#173526] transition-all whitespace-nowrap shrink-0 disabled:opacity-60 cursor-pointer"
            >
              <User className="w-4 h-4" />
              <span>{signingIn ? 'Conectando...' : 'Entrar com Google'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Actionable Auth / Domain Configuration Notice */}
      {authError && (
        <div className="bg-[#FFF4E5] dark:bg-[#2A1F14] border-b border-[#E5B869] dark:border-[#6B4E23] text-[#4A2F0B] dark:text-[#FDE6BD]">
          <div className="mx-auto max-w-7xl px-5 sm:px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-[#B45309] dark:text-[#F59E0B] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-semibold">{authError.title}</p>
                <p className="text-xs leading-relaxed opacity-90">{authError.message}</p>
                {authError.code === 'auth/unauthorized-domain' && authError.hostname && (
                  <p className="text-xs opacity-90">
                    No Firebase Console, acesse <strong>Authentication → Settings → Authorized domains → Add domain</strong> e adicione:{' '}
                    <code className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono font-semibold">
                      {authError.hostname}
                    </code>
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {authError.hostname && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(authError.hostname || '');
                    setCopiedDomain(true);
                    setTimeout(() => setCopiedDomain(false), 2000);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#B45309]/40 bg-white/80 dark:bg-black/20 px-3.5 py-1.5 text-xs font-semibold hover:bg-white transition-colors cursor-pointer"
                >
                  {copiedDomain ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedDomain ? 'Domínio copiado' : `Copiar ${authError.hostname}`}</span>
                </button>
              )}
              {authError.consoleUrl && (
                <a
                  href={authError.consoleUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#173526] text-[#FBF2DC] px-4 py-1.5 text-xs font-semibold hover:bg-[#10261B] transition-colors"
                >
                  <span>Abrir Firebase Console</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              {onClearAuthError && (
                <button
                  type="button"
                  onClick={onClearAuthError}
                  aria-label="Fechar aviso"
                  className="p-1.5 rounded-full hover:bg-black/10 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Editorial Luxury Hero with Curved Gold Arch & Floating 6-Pillar Dock */}
      <section id="inicio" className="relative overflow-hidden bg-[#FDF8F2] dark:bg-[#0F1612]">
        {/* Right-side Full Bleed Wedding Photograph on Desktop */}
        <div className="lg:absolute lg:inset-y-0 lg:right-0 lg:w-[54%] relative h-[360px] sm:h-[440px] lg:h-auto overflow-hidden">
          <SafeImage
            src={GENERATED_ASSETS.heroCouple}
            alt="Noivos sorrindo de mãos dadas sob arcos florais e luz dourada do entardecer"
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#173526]/40 via-transparent to-transparent lg:bg-gradient-to-r lg:from-[#FDF8F2]/15 lg:via-transparent lg:to-transparent dark:lg:from-[#0F1612]/40" />

          {/* Sweeping Curved Golden Arch Divider (Desktop) */}
          <svg
            viewBox="0 0 180 720"
            preserveAspectRatio="none"
            className="hidden lg:block absolute inset-y-0 -left-1 h-full w-40 pointer-events-none"
            aria-hidden="true"
          >
            {/* Outer warm cream sweep masking the left edge of the photo */}
            <path
              d="M0 0 H148 C48 180 28 450 96 720 H0 Z"
              className="fill-[#FDF8F2] dark:fill-[#0F1612]"
            />
            {/* Delicate Champagne Gold Ribbon Arch */}
            <path
              d="M148 0 C48 180 28 450 96 720"
              fill="none"
              stroke="url(#goldArchStroke)"
              strokeWidth="14"
              strokeLinecap="round"
            />
            <defs>
              <linearGradient id="goldArchStroke" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#E4C684" />
                <stop offset="50%" stopColor="#C89F52" />
                <stop offset="100%" stopColor="#DFBE7A" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Botanical Line-Art Accent Bottom Left */}
        <div className="hidden lg:block pointer-events-none absolute left-0 bottom-20 z-10">
          <BotanicalCornerSvg />
        </div>

        {/* Left Editorial Content Column */}
        <div className="relative z-20 mx-auto max-w-7xl px-5 sm:px-8 pt-10 lg:pt-16 pb-20 lg:pb-28">
          <div className="lg:w-[52%] lg:pr-10">
            {/* Eyebrow with Golden Hairlines */}
            <div className="flex items-center gap-3 text-[11px] sm:text-xs font-semibold tracking-[0.18em] uppercase text-[#4B584E] dark:text-[#CFC6B4]">
              <span className="h-px w-8 bg-[#C89F52]" />
              <span>Planejamento de casamento, simples e completo</span>
              <span className="hidden sm:inline-block h-px w-8 bg-[#C89F52]" />
            </div>

            {/* Hero Headline with Italic Gold Accent + Calligraphic Heart */}
            <h1
              className="mt-5 font-editorial font-semibold tracking-tight text-[#1A241E] dark:text-[#FAF6EE] leading-[1.04]"
              style={{ fontSize: 'clamp(2.65rem, 4.8vw, 4.35rem)', textWrap: 'balance' }}
            >
              Organize cada detalhe do seu casamento{' '}
              <span className="italic font-normal text-[#A87F32] dark:text-[#DFBE7A] whitespace-nowrap">
                sem perder a paz.
              </span>
              <CalligraphicHeartFlourish className="inline-block w-14 sm:w-16 h-9 sm:h-10 align-middle -ml-1" />
            </h1>

            <p className="mt-5 text-base sm:text-[17px] text-[#465149] dark:text-[#C4C0B6] leading-relaxed max-w-xl">
              Um painel sereno e completo para gerenciar convidados, mapa de mesas, orçamento com cofre biométrico, fornecedores conectados e o site dos convidados com presentes via Pix — acompanhado pelo exclusivo Botão do Surtando.
            </p>

            {/* Luxury Pill CTA Buttons */}
            <div className="mt-8 flex flex-wrap items-center gap-3.5">
              <button
                type="button"
                onClick={onSignIn}
                disabled={signingIn}
                className="inline-flex items-center gap-2.5 px-7 py-3.5 text-sm font-semibold text-white bg-[#173526] hover:bg-[#11281D] rounded-full shadow-md shadow-[#173526]/20 transition-all whitespace-nowrap cursor-pointer disabled:opacity-60"
              >
                <Heart className="w-4 h-4 text-[#DFBE7A]" />
                <span>Começar por {formatBRL(SUBSCRIPTION_PRICE)}/mês</span>
                <ArrowRight className="w-4 h-4 text-[#DFBE7A]" />
              </button>

              <button
                type="button"
                onClick={onOpenDemoSite}
                className="inline-flex items-center gap-2 px-6 py-3.5 text-sm font-semibold text-[#173526] dark:text-[#F4EFE6] bg-white/80 dark:bg-[#17211C] border border-[#173526]/55 dark:border-[#DFBE7A]/50 rounded-full hover:bg-[#173526]/5 dark:hover:bg-[#1E2B24] transition-all whitespace-nowrap cursor-pointer"
              >
                <PlayCircle className="w-4 h-4 text-[#B68B3C]" />
                <span>Ver site modelo</span>
              </button>
            </div>

            {/* Clean Trust Micro-Indicators */}
            <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2.5 text-xs font-medium text-[#36443A] dark:text-[#C7C1B5]">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#1E4733] dark:text-[#DFBE7A]" />
                Seguro e Privado
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-[#1E4733] dark:text-[#DFBE7A]" />
                Acesso em qualquer dispositivo
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-[#1E4733] dark:text-[#DFBE7A]" />
                Fácil de usar
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Forest Green Wave + Floating 6-Pillar Feature Dock */}
        <div className="relative z-20">
          {/* Decorative Forest Green Wave with Gold Edge behind the Floating Dock */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 sm:h-28 overflow-hidden">
            <svg
              viewBox="0 0 1440 120"
              preserveAspectRatio="none"
              className="w-full h-full"
              aria-hidden="true"
            >
              <path
                d="M0 44 C260 112 520 12 860 66 C1120 106 1310 58 1440 14 L1440 120 L0 120 Z"
                fill="#173526"
              />
              <path
                d="M0 44 C260 112 520 12 860 66 C1120 106 1310 58 1440 14"
                fill="none"
                stroke="#DFBE7A"
                strokeWidth="3.5"
                opacity="0.85"
              />
            </svg>
          </div>

          {/* Floating Warm Ivory 6-Pillar Dock */}
          <div className="relative mx-auto max-w-6xl px-5 sm:px-8 pb-8">
            <div className="rounded-2xl sm:rounded-3xl bg-[#FDF9F3] dark:bg-[#151D19] border border-[#E5D8BF] dark:border-[#2C3A31] shadow-xl shadow-black/8 px-4 py-5 sm:px-6 sm:py-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-y-5 lg:gap-y-0 lg:divide-x divide-[#E8DDC8] dark:divide-[#29352D]">
                {featureDockItems.map((item) => (
                  <div
                    key={item.title}
                    className="flex flex-col items-center justify-start text-center px-3"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F5ECDC] dark:bg-[#1E2A23]">
                      {item.icon}
                    </div>
                    <p className="mt-2.5 text-xs font-semibold leading-snug text-[#1F2C24] dark:text-[#EFE9DC]">
                      {item.title}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Como Funciona — 3 Serene Steps on Deep Forest Green Accent Band */}
      <section id="como-funciona" className="bg-[#173526] text-[#FBF7F0] py-16">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-[#DFBE7A]">
              Como Funciona
            </p>
            <h2 className="mt-2 font-editorial text-3xl sm:text-4xl font-semibold text-white">
              Do primeiro passo ao sim, tudo sincronizado em tempo real
            </h2>
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                step: '01',
                title: 'Personalize com suas fotos e cores',
                desc: 'Suba sua foto de entrada, ajuste o enquadramento e escolha a paleta ou cor exata do seu casamento em poucos cliques.',
              },
              {
                step: '02',
                title: 'Gerencie fornecedores, pagamentos e mesas',
                desc: 'Cadastre contratos, abata valores parciais ou totais, acompanhe gráficos Analytics e organize convidados no mapa interativo.',
              },
              {
                step: '03',
                title: 'Envie seu Site dos Convidados com Pix',
                desc: 'Seu site exclusivo nasce pronto com contagem regressiva, história, padrinhos, RSVP automático e lista de presentes via Pix sem taxas.',
              },
            ].map((item) => (
              <div
                key={item.step}
                className="rounded-2xl bg-white/6 border border-[#DFBE7A]/25 p-6 space-y-3"
              >
                <span className="font-editorial text-3xl font-semibold text-[#DFBE7A]">
                  {item.step}
                </span>
                <h3 className="font-editorial text-2xl font-semibold text-white">
                  {item.title}
                </h3>
                <p className="text-sm text-[#E5E0D5]/85 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Core Modules — Warm Luxury Editorial Bento */}
      <section id="recursos" className="mx-auto max-w-7xl px-5 sm:px-8 py-20">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[#A87F32] dark:text-[#DFBE7A]">
            Arquitetura pensada para a tranquilidade
          </p>
          <h2 className="mt-2 font-editorial text-3xl sm:text-5xl font-semibold tracking-tight text-[#1A241E] dark:text-[#FAF6EE]">
            Tudo o que os noivos precisam em um único refúgio
          </h2>
        </div>

        <div className="mt-12 grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 rounded-3xl border border-[#E5D8BF] dark:border-[#27332C] bg-white dark:bg-[#141B17] p-8 flex flex-col justify-between shadow-xs">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-[#A87F32] dark:text-[#DFBE7A]">
                <Wind className="w-4 h-4" />
                <span>01 · Diferencial exclusivo de bem-estar</span>
              </div>
              <h3 className="mt-3 font-editorial text-3xl font-semibold">
                Botão do Surtando® personalizável
              </h3>
              <p className="mt-3 text-sm text-[#4B584E] dark:text-[#B9B5AB] leading-relaxed max-w-xl">
                Sempre acessível no painel, o botão flutuante abre um refúgio imediato com respiração guiada animada, áudios relaxantes para crises de ansiedade pré-casamento e higiene do sono. Personalize texto, cor, posição e ritmo da respiração.
              </p>
            </div>
            <div className="mt-6 pt-5 border-t border-[#F0E6D4] dark:border-[#222D27] flex flex-wrap gap-6 text-xs font-medium text-[#5A655C] dark:text-[#ABA79D]">
              <span>Respiração 4-4-6 guiada</span>
              <span>Áudios relaxantes offline</span>
              <span>Dicas diárias de sono</span>
            </div>
          </div>

          <div className="lg:col-span-5 rounded-3xl border border-[#E5D8BF] dark:border-[#27332C] bg-white dark:bg-[#141B17] p-8 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-[#A87F32] dark:text-[#DFBE7A]">
                <Heart className="w-4 h-4" />
                <span>02 · Gerado automaticamente</span>
              </div>
              <h3 className="mt-3 font-editorial text-3xl font-semibold">
                Site dos Convidados + Pix 0% taxa
              </h3>
              <p className="mt-3 text-sm text-[#4B584E] dark:text-[#B9B5AB] leading-relaxed">
                Contagem regressiva, história do casal, Google Maps, dress code, área dos padrinhos, lista de presentes via Pix Copia e Cola direto na sua conta e RSVP em tempo real.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenDemoSite}
              className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#173526] dark:text-[#DFBE7A] hover:underline cursor-pointer"
            >
              <span>Explorar site modelo de Clara & Henrique</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="lg:col-span-5 rounded-3xl border border-[#E5D8BF] dark:border-[#27332C] bg-white dark:bg-[#141B17] p-8 shadow-xs">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#A87F32] dark:text-[#DFBE7A]">
              <Users className="w-4 h-4" />
              <span>03 · Convidados & Mesas</span>
            </div>
            <h3 className="mt-3 font-editorial text-3xl font-semibold">
              RSVP WhatsApp e Mapa Interativo
            </h3>
            <p className="mt-3 text-sm text-[#4B584E] dark:text-[#B9B5AB] leading-relaxed">
              Envie links de confirmação pelo WhatsApp, acompanhe adultos e crianças em tempo real e distribua os convidados nas mesas da recepção com arrastar e soltar.
            </p>
          </div>

          <div className="lg:col-span-7 rounded-3xl border border-[#E5D8BF] dark:border-[#27332C] bg-white dark:bg-[#141B17] p-8 shadow-xs">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#A87F32] dark:text-[#DFBE7A]">
              <BarChart3 className="w-4 h-4" />
              <span>04 · Financeiro Conectado & Analytics</span>
            </div>
            <h3 className="mt-3 font-editorial text-3xl font-semibold">
              Fornecedores, Pagamentos, Cofre Biométrico e Gráficos
            </h3>
            <p className="mt-3 text-sm text-[#4B584E] dark:text-[#B9B5AB] leading-relaxed">
              Cadastre fornecedores com sinal, parcelas e vencimentos, abata valores parciais ou totais, visualize gráficos de pizza por categoria e orçamento vs. total gasto, além de relatórios em PDF, CSV e agenda (.ics).
            </p>
            <div className="mt-6 pt-5 border-t border-[#F0E6D4] dark:border-[#222D27] flex flex-wrap gap-6 text-xs font-medium text-[#5A655C] dark:text-[#ABA79D]">
              <span>Gráficos Analytics Recharts</span>
              <span>Cofre com PIN / Biometria</span>
              <span>Exportação PDF, CSV e .ICS</span>
            </div>
          </div>
        </div>
      </section>

      {/* Luxury Forest Green & Gold Pricing Card */}
      <section id="plano" className="mx-auto max-w-7xl px-5 sm:px-8 pb-20">
        <div className="rounded-3xl bg-[#173526] text-[#FBF7F0] border border-[#DFBE7A]/35 p-8 lg:p-12 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center shadow-xl shadow-[#173526]/15">
          <div className="lg:col-span-7">
            <p className="text-xs font-semibold tracking-[0.2em] uppercase text-[#DFBE7A]">
              Plano único · Sem surpresas
            </p>
            <h2 className="mt-2 font-editorial text-3xl sm:text-5xl font-semibold text-white leading-tight">
              Tudo liberado para os noivos por R$ 39,90/mês
            </h2>
            <p className="mt-3 text-sm text-[#E5E0D5]/85 leading-relaxed max-w-xl">
              Personalize cores, fotos e mensagens logo após a assinatura. Cobrança mensal transparente via Mercado Pago (Pix ou Cartão), com cancelamento simples a qualquer momento.
            </p>

            <ul className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-[#F5F0E6]">
              {[
                'Painel exclusivo com suas fotos e cores',
                'Site dos convidados + Lista Pix sem taxas',
                'Fornecedores conectados aos pagamentos',
                'Gráficos Analytics, PDF, CSV e Calendário',
                'Mapa de mesas interativo (Drag & Drop)',
                'Botão do Surtando® e suporte em tempo real',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 shrink-0 mt-0.5 text-[#DFBE7A]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-5 rounded-2xl bg-[#FDF8F2] text-[#1A241E] border border-[#DFBE7A]/60 p-7 shadow-lg">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#A87F32]">
              Assinatura Casamento Pleno
            </p>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="font-mono text-4xl font-semibold tabular-nums text-[#173526]">
                R$ 39,90
              </span>
              <span className="text-sm text-[#58655B]">/mês</span>
            </div>
            <p className="mt-2 text-xs text-[#58655B]">
              Checkout seguro Mercado Pago · Pix ou Cartão Recorrente
            </p>

            <button
              type="button"
              onClick={onSignIn}
              disabled={signingIn}
              className="mt-6 w-full inline-flex items-center justify-center gap-2 py-3.5 px-5 text-sm font-semibold text-white bg-[#173526] hover:bg-[#10261B] rounded-full transition-colors cursor-pointer disabled:opacity-60"
            >
              <Heart className="w-4 h-4 text-[#DFBE7A]" />
              <span>{signingIn ? 'Abrindo login Google...' : 'Criar conta e personalizar agora'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Mobile PWA Section */}
      <section id="celular" className="mx-auto max-w-7xl px-5 sm:px-8 pb-20">
        <div className="rounded-3xl border border-[#E5D8BF] dark:border-[#27332C] bg-white dark:bg-[#141B17] p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#F5ECDC] dark:bg-[#1F2B24] text-[#173526] dark:text-[#DFBE7A]">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-editorial text-2xl sm:text-3xl font-semibold">
                Abra no navegador ou baixe direto no celular
              </h3>
              <p className="mt-1 text-sm text-[#4B584E] dark:text-[#B9B5AB] max-w-xl">
                Compatível com Android, iPhone, tablets e desktop. Instale como aplicativo PWA para receber alertas de vencimentos e acessar seu planejamento em qualquer lugar.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <PWAInstallButton />
          </div>
        </div>
      </section>

      {/* Forest Green & Gold Footer */}
      <footer className="bg-[#173526] text-[#E5DFD3] border-t border-[#DFBE7A]/25 py-10">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-5 text-xs">
          <div className="flex items-center gap-3">
            <IntertwinedHeartsLogo className="w-7 h-6" />
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-[#DFBE7A]" />
              <span>Casamento Pleno © {new Date().getFullYear()} · Planejamento & Bem-Estar</span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <button type="button" onClick={onOpenDemoSite} className="hover:text-[#DFBE7A] transition-colors cursor-pointer">
              Site Modelo
            </button>
            <button type="button" onClick={onSignIn} className="hover:text-[#DFBE7A] transition-colors cursor-pointer">
              Entrar no Painel
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
