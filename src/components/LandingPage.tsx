import React from 'react';
import { ArrowRight, Calendar, Check, Database, Heart, Lock, Moon, Smartphone, Sun, Users, Wind } from 'lucide-react';
import { FIREBASE_META } from '../lib/firebase';
import { GENERATED_ASSETS, SUBSCRIPTION_PRICE } from '../types/wedding';
import { formatBRL } from '../lib/utils';
import { PWAInstallButton } from './PWAInstallButton';
import { SafeImage } from './SafeImage';

interface LandingPageProps {
  onSignIn: () => void;
  onOpenDemoSite: () => void;
  signingIn: boolean;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onSignIn,
  onOpenDemoSite,
  signingIn,
  darkMode,
  onToggleDarkMode,
}) => {
  return (
    <div className="min-h-screen bg-[#F8F7F4] dark:bg-[#0F1115] text-stone-900 dark:text-stone-100">
      {/* Top Bar Contract: 3 clean zones */}
      <header className="sticky top-0 z-30 border-b border-stone-200/80 dark:border-stone-800/80 bg-[#F8F7F4]/95 dark:bg-[#0F1115]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-6 py-4">
          <a
            href="#inicio"
            className="font-editorial text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-100 whitespace-nowrap shrink-0"
          >
            Casamento Pleno
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-stone-600 dark:text-stone-400">
            <a href="#recursos" className="hover:text-stone-900 dark:hover:text-stone-100 transition-colors whitespace-nowrap shrink-0">
              Recursos
            </a>
            <button
              type="button"
              onClick={onOpenDemoSite}
              className="hover:text-stone-900 dark:hover:text-stone-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Site Modelo
            </button>
            <a href="#plano" className="hover:text-stone-900 dark:hover:text-stone-100 transition-colors whitespace-nowrap shrink-0">
              Plano
            </a>
            <a href="#celular" className="hover:text-stone-900 dark:hover:text-stone-100 transition-colors whitespace-nowrap shrink-0">
              Aplicativo
            </a>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onSignIn}
              disabled={signingIn}
              className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-60 cursor-pointer"
              style={{ backgroundColor: 'var(--brand-primary)' }}
            >
              {signingIn ? 'Conectando...' : 'Entrar com Google'}
            </button>
          </div>
        </div>
      </header>

      {/* Hero Split Section */}
      <section id="inicio" className="mx-auto max-w-7xl px-6 pt-12 pb-16 lg:pt-20 lg:pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-between py-2">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-stone-500 dark:text-stone-400">
                <span>Casamento Pleno</span>
                <span aria-hidden="true">·</span>
                <span>Organização & Saúde Mental</span>
                <span aria-hidden="true">·</span>
                <span>Banco Firebase em Tempo Real</span>
              </div>

              <h1
                className="mt-5 font-editorial font-semibold tracking-tight text-stone-900 dark:text-stone-100 leading-[1.06]"
                style={{ fontSize: 'clamp(2.5rem, 4.4vw, 4rem)', textWrap: 'balance' }}
              >
                Organize cada detalhe do seu casamento sem perder a paz.
              </h1>

              <p className="mt-6 text-base sm:text-lg text-stone-600 dark:text-stone-400 leading-relaxed max-w-xl">
                Um painel sereno e completo para gerenciar convidados, mapa de mesas, orçamento com cofre biométrico, fornecedores e o site dos convidados com presentes via Pix — acompanhado pelo exclusivo Botão do Surtando.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={onSignIn}
                  disabled={signingIn}
                  className="inline-flex items-center gap-2 px-6 py-3.5 text-sm font-semibold text-white rounded-lg transition-colors whitespace-nowrap cursor-pointer disabled:opacity-60"
                  style={{ backgroundColor: 'var(--brand-primary)' }}
                >
                  <span>Começar por {formatBRL(SUBSCRIPTION_PRICE)}/mês</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={onOpenDemoSite}
                  className="inline-flex items-center gap-2 px-5 py-3.5 text-sm font-medium text-stone-800 dark:text-stone-200 border border-stone-300 dark:border-stone-700 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800/70 transition-colors whitespace-nowrap cursor-pointer"
                >
                  Ver site modelo dos convidados
                </button>
              </div>
            </div>

            <div className="mt-10 pt-6 border-t border-stone-200 dark:border-stone-800 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                <Database className="w-4 h-4 text-stone-600 dark:text-stone-300" />
                <span>
                  Firebase Firestore ativo · Projeto <strong className="font-mono text-stone-700 dark:text-stone-300">{FIREBASE_META.projectId}</strong>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <PWAInstallButton compact />
                <button
                  type="button"
                  onClick={onToggleDarkMode}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 dark:border-stone-700 px-3 py-1.5 text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                  aria-label="Alternar tema claro ou escuro"
                >
                  {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                  <span>{darkMode ? 'Modo Claro' : 'Modo Escuro'}</span>
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="h-full min-h-[340px] lg:min-h-[500px] overflow-hidden rounded-2xl border border-stone-200 dark:border-stone-800 bg-stone-200 dark:bg-stone-900">
              <SafeImage
                src={GENERATED_ASSETS.heroCouple}
                alt="Noivos caminhando de mãos dadas em um pátio de pedras e oliveiras ao entardecer"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>

        {/* Full-width 4-column KPI/Trust Strip below Hero */}
        <div className="mt-12 grid grid-cols-2 lg:grid-cols-4 gap-6 border-y border-stone-200 dark:border-stone-800 py-8">
          <div>
            <p className="font-mono text-2xl font-semibold tabular-nums text-stone-900 dark:text-stone-100">
              {formatBRL(SUBSCRIPTION_PRICE)}
            </p>
            <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">
              Assinatura mensal transparente via Mercado Pago (Pix ou Cartão)
            </p>
          </div>
          <div>
            <p className="font-mono text-2xl font-semibold tabular-nums text-stone-900 dark:text-stone-100">
              0% taxa
            </p>
            <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">
              Presentes simbólicos via Pix caem direto na conta dos noivos
            </p>
          </div>
          <div>
            <p className="font-mono text-2xl font-semibold tabular-nums text-stone-900 dark:text-stone-100">
              Tempo real
            </p>
            <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">
              RSVP dos convidados sincronizado instantaneamente no Firebase
            </p>
          </div>
          <div>
            <p className="font-mono text-2xl font-semibold tabular-nums text-stone-900 dark:text-stone-100">
              Web + App
            </p>
            <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">
              Abra no navegador ou baixe direto para a tela inicial do celular
            </p>
          </div>
        </div>
      </section>

      {/* Core Capabilities — Asymmetric Editorial Bento */}
      <section id="recursos" className="mx-auto max-w-7xl px-6 py-16">
        <div className="max-w-2xl">
          <p className="text-xs font-medium text-stone-500 dark:text-stone-400">
            Arquitetura pensada para a tranquilidade
          </p>
          <h2 className="mt-2 font-editorial text-3xl sm:text-4xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
            Seis módulos integrados do planejamento ao grande dia
          </h2>
        </div>

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-8 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                <Wind className="w-4 h-4" />
                <span>01. Diferencial exclusivo de bem-estar</span>
              </div>
              <h3 className="mt-3 font-editorial text-3xl font-semibold text-stone-900 dark:text-stone-100">
                Botão do Surtando personalizável
              </h3>
              <p className="mt-3 text-sm text-stone-600 dark:text-stone-400 leading-relaxed max-w-xl">
                Sempre acessível no painel, o botão flutuante abre um refúgio imediato com respiração guiada animada, áudios de acolhimento para crises de ansiedade pré-casamento e higiene do sono. A noiva personaliza o texto, a cor, a posição e o ritmo da respiração.
              </p>
            </div>
            <div className="mt-6 pt-5 border-t border-stone-100 dark:border-stone-800 flex flex-wrap gap-6 text-xs text-stone-600 dark:text-stone-400">
              <span>Respiração 4-4-6 guiada</span>
              <span>Áudios relaxantes offline</span>
              <span>Dicas diárias de sono</span>
            </div>
          </div>

          <div className="lg:col-span-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-8">
            <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
              <Heart className="w-4 h-4" />
              <span>02. Gerado automaticamente</span>
            </div>
            <h3 className="mt-3 font-editorial text-3xl font-semibold text-stone-900 dark:text-stone-100">
              Site dos Convidados + Pix
            </h3>
            <p className="mt-3 text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
              Contagem regressiva, história do casal, Google Maps, dress code, área dos padrinhos, lista de presentes via Pix Copia e Cola e RSVP que atualiza seu painel na hora.
            </p>
            <button
              type="button"
              onClick={onOpenDemoSite}
              className="mt-6 inline-flex items-center gap-2 text-sm font-semibold hover:underline cursor-pointer"
              style={{ color: 'var(--brand-primary)' }}
            >
              <span>Explorar site modelo de Clara & Henrique</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="lg:col-span-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-8">
            <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
              <Users className="w-4 h-4" />
              <span>03. Convidados & Mesas</span>
            </div>
            <h3 className="mt-3 font-editorial text-3xl font-semibold text-stone-900 dark:text-stone-100">
              RSVP WhatsApp e Mapa Interativo
            </h3>
            <p className="mt-3 text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
              Envie links de confirmação direto no WhatsApp, acompanhe adultos e crianças em gráficos e organize todas as mesas da recepção com arrastar e soltar.
            </p>
          </div>

          <div className="lg:col-span-7 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-8">
            <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
              <Lock className="w-4 h-4" />
              <span>04. Transparência Financeira & Segurança</span>
            </div>
            <h3 className="mt-3 font-editorial text-3xl font-semibold text-stone-900 dark:text-stone-100">
              Orçamento, Metas de Economia e Relatórios PDF/CSV
            </h3>
            <p className="mt-3 text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
              Controle despesas por categoria, metas de economia do casal, vencimentos no calendário digital (.ics), importação de extrato bancário CSV/OFX e proteção extra com bloqueio biométrico/PIN.
            </p>
            <div className="mt-6 pt-5 border-t border-stone-100 dark:border-stone-800 flex flex-wrap gap-6 text-xs text-stone-600 dark:text-stone-400">
              <span>Exportação PDF e CSV</span>
              <span>Sincronização .ics</span>
              <span>Webhooks REST configuráveis</span>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing & Mercado Pago Section */}
      <section id="plano" className="mx-auto max-w-7xl px-6 py-16">
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-8 lg:p-12 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7">
            <p className="text-xs font-medium text-stone-500 dark:text-stone-400">
              Plano único · Sem surpresas
            </p>
            <h2 className="mt-2 font-editorial text-3xl sm:text-4xl font-semibold text-stone-900 dark:text-stone-100">
              Tudo liberado para os noivos por R$ 39,90/mês
            </h2>
            <p className="mt-3 text-sm text-stone-600 dark:text-stone-400 leading-relaxed max-w-xl">
              Personalize cores, fotos e mensagens após a assinatura. Cobrança mensal estruturada para Mercado Pago (Cartão Recorrente ou Pix), com cancelamento simples a qualquer momento.
            </p>

            <ul className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-stone-700 dark:text-stone-300">
              {[
                'Site dos convidados personalizado em tempo real',
                'Lista de presentes via Pix sem comissões',
                'Mapa de mesas interativo (Drag & Drop)',
                'Painel financeiro, metas e exportação PDF/CSV',
                'Botão do Surtando com design personalizável',
                'Suporte em tempo real via chat interno',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 shrink-0 mt-0.5 text-emerald-700 dark:text-emerald-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-5 rounded-xl bg-[#F8F7F4] dark:bg-[#0F1115] border border-stone-200 dark:border-stone-800 p-7">
            <p className="text-xs font-medium text-stone-500 dark:text-stone-400">
              Assinatura Casamento Pleno
            </p>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="font-mono text-4xl font-semibold tabular-nums text-stone-900 dark:text-stone-100">
                R$ 39,90
              </span>
              <span className="text-sm text-stone-500 dark:text-stone-400">/mês</span>
            </div>
            <p className="mt-2 text-xs text-stone-600 dark:text-stone-400">
              Checkout integrado ao Mercado Pago · Pix ou Cartão de Crédito
            </p>

            <button
              type="button"
              onClick={onSignIn}
              disabled={signingIn}
              className="mt-6 w-full py-3 px-4 text-sm font-semibold text-white rounded-lg transition-colors cursor-pointer disabled:opacity-60"
              style={{ backgroundColor: 'var(--brand-primary)' }}
            >
              {signingIn ? 'Abrindo login Google...' : 'Criar conta e personalizar agora'}
            </button>
          </div>
        </div>
      </section>

      {/* Mobile PWA Section */}
      <section id="celular" className="mx-auto max-w-7xl px-6 pb-20">
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-editorial text-2xl font-semibold text-stone-900 dark:text-stone-100">
                Abra no navegador ou baixe direto no celular
              </h3>
              <p className="mt-1 text-sm text-stone-600 dark:text-stone-400 max-w-xl">
                Compatível com Android, iPhone, tablets e desktop. Instale como aplicativo PWA para receber lembretes de vencimentos e acessar seu planejamento mesmo sem internet.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <PWAInstallButton />
          </div>
        </div>
      </section>

      <footer className="border-t border-stone-200 dark:border-stone-800 py-8">
        <div className="mx-auto max-w-7xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-stone-500 dark:text-stone-400">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5" />
            <span>Casamento Pleno © {new Date().getFullYear()} · Plataforma SaaS com Firebase Firestore</span>
          </div>
          <div className="flex items-center gap-6">
            <button type="button" onClick={onOpenDemoSite} className="hover:text-stone-900 dark:hover:text-stone-100 cursor-pointer">
              Site Modelo
            </button>
            <button type="button" onClick={onSignIn} className="hover:text-stone-900 dark:hover:text-stone-100 cursor-pointer">
              Painel da Noiva / Admin
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
