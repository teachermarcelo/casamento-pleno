import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Briefcase,
  Calendar,
  Camera,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Heart,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Megaphone,
  Menu,
  Moon,
  Settings,
  Shield,
  Sun,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import {
  GENERATED_ASSETS,
  WEDDING_THEMES,
  type Expense,
  type GiftContribution,
  type GiftItem,
  type Guest,
  type PartyMember,
  type PlatformConfig,
  type ScheduleItem,
  type SeatingTable,
  type SupportMessage,
  type UserProfile,
  type Vendor,
  type Wedding,
} from '../types/wedding';
import {
  DEFAULT_PLATFORM_CONFIG,
  subscribePlatformConfig,
  subscribeWeddingSubcollections,
} from '../lib/weddingService';
import {
  buildWeddingDayICS,
  downloadCSV,
  exportWeddingReportPDF,
  formatBRL,
  formatDateBR,
  getObjectPositionClass,
} from '../lib/utils';
import { GuestsModule, TablesModule } from './dashboard/GuestsAndTablesModule';
import { FinanceModule } from './dashboard/FinanceModule';
import { AnalyticsModule } from './dashboard/AnalyticsModule';
import { CeremonyAndGiftsModule, VendorsModule } from './dashboard/CeremonyVendorsGiftsModule';
import { SettingsAndSupportModule } from './dashboard/SettingsAndSupportModule';
import { PanicButtonModal } from './PanicButtonModal';
import { PWAInstallButton } from './PWAInstallButton';
import { SafeImage } from './SafeImage';

interface BrideDashboardProps {
  profile: UserProfile;
  wedding: Wedding;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onPreviewGuestSite: (data: {
    wedding: Wedding;
    schedule: ScheduleItem[];
    party: PartyMember[];
    gifts: GiftItem[];
  }) => void;
  onOpenAdmin?: () => void;
  onSignOut: () => void;
}

type NavTab = 'overview' | 'analytics' | 'guests' | 'tables' | 'finance' | 'vendors' | 'ceremony' | 'settings';

export const BrideDashboard: React.FC<BrideDashboardProps> = ({
  profile,
  wedding,
  darkMode,
  onToggleDarkMode,
  onPreviewGuestSite,
  onOpenAdmin,
  onSignOut,
}) => {
  const [tab, setTab] = useState<NavTab>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [guests, setGuests] = useState<Guest[]>([]);
  const [tables, setTables] = useState<SeatingTable[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [party, setParty] = useState<PartyMember[]>([]);
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [contributions, setContributions] = useState<GiftContribution[]>([]);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [platformConfig, setPlatformConfig] = useState<PlatformConfig>(DEFAULT_PLATFORM_CONFIG);

  useEffect(() => {
    const unsubSub = subscribeWeddingSubcollections(wedding.id, wedding.ownerId, {
      onGuests: setGuests,
      onTables: setTables,
      onExpenses: setExpenses,
      onVendors: setVendors,
      onSchedule: setSchedule,
      onParty: setParty,
      onGifts: setGifts,
      onContributions: setContributions,
      onMessages: setMessages,
    });
    const unsubCfg = subscribePlatformConfig(setPlatformConfig);
    return () => {
      unsubSub();
      unsubCfg();
    };
  }, [wedding.id, wedding.ownerId]);

  const theme = WEDDING_THEMES[wedding.themeKey] || WEDDING_THEMES.olive;
  const effectiveAccent = wedding.customAccentColor || theme.primary;

  const daysUntilWedding = useMemo(() => {
    const target = new Date(`${wedding.weddingDate}T${wedding.weddingTime || '16:30'}:00`);
    const diff = target.getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [wedding.weddingDate, wedding.weddingTime]);

  const overviewStats = useMemo(() => {
    const confirmedPeople = guests
      .filter((g) => g.status === 'confirmed')
      .reduce((s, g) => s + g.adults + g.children, 0);
    const totalPeople = guests.reduce((s, g) => s + g.adults + g.children, 0);
    const committed = expenses.reduce((s, e) => s + e.amount, 0);
    const paid = expenses.reduce((s, e) => s + e.paidAmount, 0);
    const pending = Math.max(0, committed - paid);
    const paidPct = committed > 0 ? Math.round((paid / committed) * 100) : 0;
    const budget = wedding.budgetLimit || 0;
    const budgetPct = budget > 0 ? Math.round((committed / budget) * 100) : 0;
    const giftsReceived = contributions.reduce((s, c) => s + c.amount, 0);
    const vendorsDone = vendors.filter((v) => v.checklistDone).length;
    const openPayments = expenses
      .filter((e) => e.status !== 'paid')
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const nextDue = openPayments[0]?.dueDate || '';

    return {
      confirmedPeople,
      totalPeople,
      committed,
      paid,
      pending,
      paidPct,
      budget,
      budgetPct,
      giftsReceived,
      vendorsDone,
      openCount: openPayments.length,
      nextDue,
    };
  }, [guests, expenses, contributions, vendors, wedding.budgetLimit]);

  const rsvpPieData = useMemo(() => {
    const confirmed = guests.filter((g) => g.status === 'confirmed').length;
    const pending = guests.filter((g) => g.status === 'pending').length;
    const declined = guests.filter((g) => g.status === 'declined').length;
    return [
      { name: 'Confirmados', value: confirmed, color: '#15803D' },
      { name: 'Pendentes', value: pending, color: '#D97706' },
      { name: 'Recusados', value: declined, color: '#DC2626' },
    ].filter((d) => d.value > 0);
  }, [guests]);

  const navItems: { id: NavTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Visão Geral', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'guests', label: 'Convidados & RSVP', icon: <Users className="w-4 h-4" /> },
    { id: 'tables', label: 'Mapa de Mesas', icon: <LayoutGrid className="w-4 h-4" /> },
    { id: 'finance', label: 'Pagamentos & Orçamento', icon: <Wallet className="w-4 h-4" /> },
    { id: 'vendors', label: 'Fornecedores', icon: <Briefcase className="w-4 h-4" /> },
    { id: 'ceremony', label: 'Cerimônia & Pix', icon: <Heart className="w-4 h-4" /> },
    { id: 'settings', label: 'Fotos, Cores & Suporte', icon: <Settings className="w-4 h-4" /> },
  ];

  const activeNavLabel = navItems.find((n) => n.id === tab)?.label || 'Visão Geral';

  return (
    <div className="min-h-screen bg-[#FAF7F2] dark:bg-[#0F1115] text-stone-900 dark:text-stone-100 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-stone-200/90 dark:border-stone-800 bg-white dark:bg-[#14171D]">
        <div className="px-6 py-5 border-b border-stone-200 dark:border-stone-800">
          <p className="font-editorial text-2xl font-semibold tracking-tight">Casamento Pleno</p>
          <p className="mt-0.5 text-xs text-stone-500 truncate">
            {wedding.brideName} & {wedding.groomName}
          </p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                style={active ? { backgroundColor: effectiveAccent } : undefined}
                className={`w-full flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
                  active
                    ? 'text-white'
                    : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800/70 hover:text-stone-900 dark:hover:text-stone-100'
                }`}
              >
                {item.icon}
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-stone-200 dark:border-stone-800 space-y-2">
          {onOpenAdmin && (
            <button
              type="button"
              onClick={onOpenAdmin}
              className="w-full flex items-center gap-2.5 rounded-xl border border-stone-300 dark:border-stone-700 px-3 py-2 text-xs font-semibold text-stone-800 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 cursor-pointer"
            >
              <Shield className="w-4 h-4" />
              <span>Painel Admin (Criador)</span>
            </button>
          )}
          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={onToggleDarkMode}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
            >
              {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              <span>{darkMode ? 'Claro' : 'Escuro'}</span>
            </button>
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-stone-600 dark:text-stone-400 hover:text-red-600 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative w-72 max-w-[82vw] bg-white dark:bg-[#14171D] h-full flex flex-col p-4 z-10">
            <div className="flex items-center justify-between pb-4 border-b border-stone-200 dark:border-stone-800">
              <span className="font-editorial text-2xl font-semibold">Casamento Pleno</span>
              <button type="button" onClick={() => setMobileMenuOpen(false)} className="p-1.5">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 py-4 space-y-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  style={tab === item.id ? { backgroundColor: effectiveAccent } : undefined}
                  className={`w-full flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium ${
                    tab === item.id ? 'text-white' : 'text-stone-700 dark:text-stone-300'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
            <div className="pt-4 border-t border-stone-200 dark:border-stone-800 space-y-2">
              {onOpenAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenAdmin();
                  }}
                  className="w-full flex items-center gap-2 rounded-xl border border-stone-300 dark:border-stone-700 px-3 py-2 text-xs font-semibold"
                >
                  <Shield className="w-4 h-4" />
                  <span>Painel Admin (Criador)</span>
                </button>
              )}
              <button
                type="button"
                onClick={onSignOut}
                className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-red-600"
              >
                <LogOut className="w-4 h-4" />
                <span>Sair da conta</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 border-b border-stone-200/80 dark:border-stone-800 bg-[#FAF7F2]/95 dark:bg-[#0F1115]/95 backdrop-blur-md px-5 sm:px-8 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 rounded-lg border border-stone-300 dark:border-stone-700"
              aria-label="Abrir menu"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-sm truncate">
              <span className="text-stone-500 hidden sm:inline">
                {wedding.brideName} & {wedding.groomName}
              </span>
              <span className="text-stone-400 hidden sm:inline">/</span>
              <span className="font-semibold truncate">{activeNavLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <PWAInstallButton compact />
            <button
              type="button"
              onClick={() => onPreviewGuestSite({ wedding, schedule, party, gifts })}
              style={{ backgroundColor: effectiveAccent }}
              className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold text-white hover:brightness-110 transition-all whitespace-nowrap cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Site dos Convidados</span>
            </button>
          </div>
        </header>

        <main className="flex-1 mx-auto max-w-6xl w-full px-5 sm:px-8 py-7 pb-24">
          {/* Optional Remote Announcement Banner controlled by Admin */}
          {platformConfig.announcementBanner && (
            <div className="mb-6 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] px-4 py-3 flex items-center gap-3 text-xs text-stone-700 dark:text-stone-300">
              <Megaphone className="w-4 h-4 shrink-0" style={{ color: effectiveAccent }} />
              <span>{platformConfig.announcementBanner}</span>
            </div>
          )}

          {tab === 'overview' && (
            <div className="space-y-6">
              {/* Cozy Entrance Cover Hero Banner */}
              <div className="relative rounded-3xl overflow-hidden border border-stone-200/80 dark:border-stone-800 min-h-[230px] sm:min-h-[260px] flex items-end shadow-xs">
                <SafeImage
                  src={wedding.coverPhotoUrl || GENERATED_ASSETS.heroCouple}
                  alt={`Capa de ${wedding.brideName} e ${wedding.groomName}`}
                  className={`absolute inset-0 w-full h-full object-cover ${getObjectPositionClass(wedding.coverPhotoPosition)}`}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/15" />

                <div className="relative z-10 w-full p-6 sm:p-8 flex flex-col md:flex-row md:items-end justify-between gap-5 text-white">
                  <div>
                    <p className="text-xs tracking-[0.18em] uppercase text-white/85">
                      {formatDateBR(wedding.weddingDate)} · {wedding.weddingTime}
                      {wedding.venueName ? ` · ${wedding.venueName}` : ''}
                    </p>
                    <h1 className="mt-1.5 font-editorial text-4xl sm:text-5xl font-semibold tracking-tight leading-none">
                      {wedding.brideName} & {wedding.groomName}
                    </h1>
                    <p className="mt-2.5 text-sm text-white/85 max-w-xl">
                      Faltam <strong className="font-mono">{daysUntilWedding} dias</strong> para o grande dia. Tudo sob controle e no seu ritmo.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setTab('settings')}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/25 px-3.5 py-2 text-xs font-semibold text-white transition-colors cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Ajustar fotos e cores</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => exportWeddingReportPDF({ wedding, guests, expenses })}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/25 px-3 py-2 text-xs font-medium text-white cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        downloadCSV(
                          `resumo-${wedding.slug}.csv`,
                          ['Casal', 'Data', 'Confirmados', 'Valor Total', 'Valor Pago', 'Valor Pendente', 'Presentes Pix'],
                          [[`${wedding.brideName} & ${wedding.groomName}`, wedding.weddingDate, overviewStats.confirmedPeople, overviewStats.committed, overviewStats.paid, overviewStats.pending, overviewStats.giftsReceived]]
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/25 px-3 py-2 text-xs font-medium text-white cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>CSV</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => buildWeddingDayICS(wedding, schedule)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/25 px-3 py-2 text-xs font-medium text-white cursor-pointer"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>.ICS</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Detailed Color-Coded Financial & Guest KPI Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-5">
                  <p className="text-xs font-medium text-stone-500">Valor Total Contratado</p>
                  <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-stone-900 dark:text-stone-100">
                    {formatBRL(overviewStats.committed)}
                  </p>
                  <p className="mt-1.5 text-xs text-stone-500 tabular-nums">
                    {overviewStats.budgetPct}% do limite ({formatBRL(overviewStats.budget)})
                  </p>
                </div>

                <div className="rounded-2xl border border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/75 dark:bg-emerald-950/25 p-5">
                  <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">Valor Pago</p>
                  <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                    {formatBRL(overviewStats.paid)}
                  </p>
                  <p className="mt-1.5 text-xs text-emerald-800/80 dark:text-emerald-300/80 tabular-nums">
                    {overviewStats.paidPct}% quitado até hoje
                  </p>
                </div>

                <div className="rounded-2xl border border-amber-200/80 dark:border-amber-900/60 bg-amber-50/75 dark:bg-amber-950/25 p-5">
                  <p className="text-xs font-medium text-amber-900 dark:text-amber-300">Valor Pendente</p>
                  <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                    {formatBRL(overviewStats.pending)}
                  </p>
                  <p className="mt-1.5 text-xs text-amber-900/80 dark:text-amber-300/80">
                    {overviewStats.openCount > 0
                      ? `${overviewStats.openCount} em aberto · próx. ${formatDateBR(overviewStats.nextDue)}`
                      : 'Todos os serviços quitados'}
                  </p>
                </div>

                <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-5">
                  <p className="text-xs font-medium text-stone-500">Confirmados & Presentes Pix</p>
                  <p className="mt-2 font-mono text-2xl font-semibold tabular-nums" style={{ color: effectiveAccent }}>
                    {overviewStats.confirmedPeople} / {overviewStats.totalPeople}
                  </p>
                  <p className="mt-1.5 text-xs text-stone-500 tabular-nums">
                    Pix recebidos: {formatBRL(overviewStats.giftsReceived)}
                  </p>
                </div>
              </div>

              {/* Financial Progress Bar Strip */}
              <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-5 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-stone-800 dark:text-stone-200">
                    Saúde Financeira do Casamento
                  </span>
                  <div className="flex items-center gap-4 text-stone-600 dark:text-stone-400 font-mono tabular-nums">
                    <span className="text-emerald-700 dark:text-emerald-400">
                      Pago: {overviewStats.paidPct}%
                    </span>
                    <span className="text-amber-700 dark:text-amber-400">
                      Pendente: {Math.max(0, 100 - overviewStats.paidPct)}%
                    </span>
                  </div>
                </div>
                <div className="h-2.5 w-full rounded-full bg-amber-100 dark:bg-amber-950/40 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-600 transition-all duration-500"
                    style={{ width: `${overviewStats.paidPct}%` }}
                  />
                </div>
              </div>

              {/* Analytics + Quick Modules */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-5">
                  <p className="text-xs font-medium text-stone-500 mb-2">Engajamento RSVP em Tempo Real</p>
                  <div className="h-48 w-full">
                    {rsvpPieData.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-xs text-stone-400">
                        Adicione convidados para ver o gráfico de confirmações.
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={rsvpPieData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={3}>
                            {rsvpPieData.map((entry) => (
                              <Cell key={entry.name} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                  <div className="mt-2 flex items-center justify-center gap-4 text-xs text-stone-600 dark:text-stone-400">
                    <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                      Confirmados: {guests.filter((g) => g.status === 'confirmed').length}
                    </span>
                    <span className="text-amber-700 dark:text-amber-400 font-medium">
                      Pendentes: {guests.filter((g) => g.status === 'pending').length}
                    </span>
                    <span className="text-red-600 dark:text-red-400 font-medium">
                      Recusados: {guests.filter((g) => g.status === 'declined').length}
                    </span>
                  </div>
                </div>

                <div className="lg:col-span-7 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-5 flex flex-col justify-between">
                  <div>
                    <p className="text-xs font-medium text-stone-500">Progresso dos Preparativos</p>
                    <h2 className="mt-1 font-editorial text-2xl font-semibold">
                      Próximos passos com tranquilidade
                    </h2>
                    <div className="mt-4 space-y-3 text-sm">
                      <div className="flex items-center justify-between py-2 border-b border-stone-100 dark:border-stone-800">
                        <span>Fornecedores confirmados no checklist</span>
                        <span className="font-mono text-xs tabular-nums">
                          {overviewStats.vendorsDone} / {vendors.length}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b border-stone-100 dark:border-stone-800">
                        <span>Mesas configuradas na recepção</span>
                        <span className="font-mono text-xs tabular-nums">{tables.length} mesas</span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b border-stone-100 dark:border-stone-800">
                        <span>Padrinhos e madrinhas publicados no site</span>
                        <span className="font-mono text-xs tabular-nums">{party.length} pessoas</span>
                      </div>
                      <div className="flex items-center justify-between py-2">
                        <span>Cotas de presentes Pix ativas</span>
                        <span className="font-mono text-xs tabular-nums">{gifts.length} opções</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setTab('analytics')}
                      className="rounded-xl border border-stone-300 dark:border-stone-700 px-3.5 py-2 text-xs font-medium hover:bg-stone-50 dark:hover:bg-stone-800 cursor-pointer"
                    >
                      Ver Gráficos Analytics
                    </button>
                    <button
                      type="button"
                      onClick={() => setTab('vendors')}
                      className="rounded-xl border border-stone-300 dark:border-stone-700 px-3.5 py-2 text-xs font-medium hover:bg-stone-50 dark:hover:bg-stone-800 cursor-pointer"
                    >
                      Gerenciar Fornecedores
                    </button>
                    <button
                      type="button"
                      onClick={() => setTab('finance')}
                      style={{ backgroundColor: effectiveAccent }}
                      className="rounded-xl px-3.5 py-2 text-xs font-semibold text-white hover:brightness-110 cursor-pointer"
                    >
                      Abater Pagamentos
                    </button>
                    <button
                      type="button"
                      onClick={() => setTab('tables')}
                      className="rounded-xl border border-stone-300 dark:border-stone-700 px-3.5 py-2 text-xs font-medium hover:bg-stone-50 dark:hover:bg-stone-800 cursor-pointer"
                    >
                      Mapa de Mesas
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'analytics' && (
            <AnalyticsModule
              wedding={wedding}
              expenses={expenses}
              vendors={vendors}
              guests={guests}
              contributions={contributions}
              accentColor={effectiveAccent}
            />
          )}
          {tab === 'guests' && <GuestsModule wedding={wedding} guests={guests} accentColor={effectiveAccent} />}
          {tab === 'tables' && <TablesModule wedding={wedding} guests={guests} tables={tables} accentColor={effectiveAccent} />}
          {tab === 'finance' && (
            <FinanceModule
              profile={profile}
              wedding={wedding}
              expenses={expenses}
              vendors={vendors}
              guests={guests}
              categories={platformConfig.expenseCategories}
              accentColor={effectiveAccent}
            />
          )}
          {tab === 'vendors' && (
            <VendorsModule
              wedding={wedding}
              vendors={vendors}
              expenses={expenses}
              categories={platformConfig.vendorCategories}
              accentColor={effectiveAccent}
            />
          )}
          {tab === 'ceremony' && (
            <CeremonyAndGiftsModule
              wedding={wedding}
              schedule={schedule}
              party={party}
              gifts={gifts}
              contributions={contributions}
              accentColor={effectiveAccent}
            />
          )}
          {tab === 'settings' && (
            <SettingsAndSupportModule
              profile={profile}
              wedding={wedding}
              messages={messages}
              accentColor={effectiveAccent}
            />
          )}
        </main>
      </div>

      {/* Módulo 6: Botão do Surtando (Personalizável pela cliente) */}
      <PanicButtonModal
        label={profile.panicButtonLabel || 'Botão do Surtando'}
        color={profile.panicButtonColor || effectiveAccent}
        position={profile.panicButtonPosition || 'bottom-right'}
        breathingSeconds={profile.breathingSeconds || 4}
      />
    </div>
  );
};
