import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Briefcase,
  Calendar,
  Camera,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Globe,
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
  onPreviewLanding?: () => void;
  onOpenAdmin?: () => void;
  onSignOut: () => void;
}

type NavTab = 'overview' | 'analytics' | 'guests' | 'tables' | 'finance' | 'vendors' | 'ceremony' | 'settings';

const BrandHeartsMark: React.FC<{ className?: string }> = ({ className = 'w-8 h-7' }) => (
  <svg viewBox="0 0 48 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
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

export const BrideDashboard: React.FC<BrideDashboardProps> = ({
  profile,
  wedding,
  darkMode,
  onToggleDarkMode,
  onPreviewGuestSite,
  onPreviewLanding,
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
  const effectiveAccent = wedding.customAccentColor || (wedding.themeKey === 'olive' ? '#173526' : theme.primary);

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

  const quickDockItems: { tab: NavTab; label: string; sub: string; icon: React.ReactNode }[] = [
    {
      tab: 'guests',
      label: 'Convidados',
      sub: `${overviewStats.confirmedPeople} confirmados`,
      icon: <Users className="w-5 h-5 text-[#B68B3C]" strokeWidth={1.7} />,
    },
    {
      tab: 'tables',
      label: 'Mapa de Mesas',
      sub: `${tables.length} mesa(s)`,
      icon: <LayoutGrid className="w-5 h-5 text-[#B68B3C]" strokeWidth={1.7} />,
    },
    {
      tab: 'finance',
      label: 'Orçamento',
      sub: `${overviewStats.paidPct}% quitado`,
      icon: <Wallet className="w-5 h-5 text-[#B68B3C]" strokeWidth={1.7} />,
    },
    {
      tab: 'vendors',
      label: 'Fornecedores',
      sub: `${overviewStats.vendorsDone}/${vendors.length} prontos`,
      icon: <Briefcase className="w-5 h-5 text-[#B68B3C]" strokeWidth={1.7} />,
    },
    {
      tab: 'analytics',
      label: 'Analytics',
      sub: 'Pizza & Barras',
      icon: <BarChart3 className="w-5 h-5 text-[#B68B3C]" strokeWidth={1.7} />,
    },
    {
      tab: 'ceremony',
      label: 'Presentes Pix',
      sub: `${gifts.length} cotas`,
      icon: <Heart className="w-5 h-5 text-[#B68B3C]" strokeWidth={1.7} />,
    },
  ];

  return (
    <div className="min-h-screen bg-[#FDF8F2] dark:bg-[#0D1310] text-[#1D2620] dark:text-[#F4EFE6] flex">
      {/* Desktop Deep Forest Green & Gold Sidebar */}
      <aside className="hidden lg:flex w-68 shrink-0 flex-col bg-[#173526] text-[#FBF7F0] border-r border-[#DFBE7A]/20">
        <div className="px-6 py-5 border-b border-[#DFBE7A]/20 flex items-center gap-3">
          <BrandHeartsMark className="w-8 h-7 shrink-0" />
          <div className="min-w-0 leading-none">
            <p className="font-editorial text-2xl font-semibold tracking-tight text-white truncate">
              Casamento Pleno
            </p>
            <div className="mt-1 flex items-center gap-1.5 text-[9px] tracking-[0.24em] text-[#DFBE7A]">
              <span className="h-px w-4 bg-[#DFBE7A]/60" />
              <span className="truncate uppercase">
                {wedding.brideName} & {wedding.groomName}
              </span>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`w-full flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all cursor-pointer ${
                  active
                    ? 'bg-[#FDF8F2] text-[#173526] shadow-xs font-semibold'
                    : 'text-[#E7E1D5]/85 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className={active ? 'text-[#B68B3C]' : 'text-[#DFBE7A]/80'}>{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[#DFBE7A]/20 space-y-2">
          {onOpenAdmin && (
            <button
              type="button"
              onClick={onOpenAdmin}
              className="w-full flex items-center gap-2.5 rounded-full border border-[#DFBE7A]/65 bg-[#1F4532] px-3.5 py-2 text-xs font-semibold text-[#FBF2DC] hover:bg-[#DFBE7A] hover:text-[#173526] transition-colors cursor-pointer"
            >
              <Shield className="w-4 h-4" />
              <span>Painel Admin (Criador)</span>
            </button>
          )}
          {onPreviewLanding && (
            <button
              type="button"
              onClick={onPreviewLanding}
              className="w-full flex items-center gap-2.5 rounded-full border border-white/20 px-3.5 py-2 text-xs font-medium text-[#E7E1D5] hover:bg-white/10 transition-colors cursor-pointer"
            >
              <Globe className="w-4 h-4 text-[#DFBE7A]" />
              <span>Ver Página Inicial</span>
            </button>
          )}
          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={onToggleDarkMode}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-[#DFBE7A] hover:bg-white/10 cursor-pointer"
            >
              {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              <span>{darkMode ? 'Claro' : 'Escuro'}</span>
            </button>
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-[#E7E1D5]/75 hover:text-red-300 cursor-pointer"
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
          <div className="fixed inset-0 bg-black/55" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative w-72 max-w-[84vw] bg-[#173526] text-[#FBF7F0] h-full flex flex-col p-4 z-10">
            <div className="flex items-center justify-between pb-4 border-b border-[#DFBE7A]/25">
              <div className="flex items-center gap-2.5">
                <BrandHeartsMark className="w-7 h-6" />
                <span className="font-editorial text-2xl font-semibold text-white">Casamento Pleno</span>
              </div>
              <button type="button" onClick={() => setMobileMenuOpen(false)} className="p-1.5 text-[#DFBE7A]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 py-4 space-y-1">
              {navItems.map((item) => {
                const active = tab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium ${
                      active ? 'bg-[#FDF8F2] text-[#173526] font-semibold' : 'text-[#E7E1D5]'
                    }`}
                  >
                    <span className={active ? 'text-[#B68B3C]' : 'text-[#DFBE7A]'}>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="pt-4 border-t border-[#DFBE7A]/25 space-y-2">
              {onOpenAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenAdmin();
                  }}
                  className="w-full flex items-center gap-2 rounded-full border border-[#DFBE7A]/65 px-3.5 py-2 text-xs font-semibold text-[#FBF2DC]"
                >
                  <Shield className="w-4 h-4" />
                  <span>Painel Admin (Criador)</span>
                </button>
              )}
              {onPreviewLanding && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onPreviewLanding();
                  }}
                  className="w-full flex items-center gap-2 rounded-full border border-white/25 px-3.5 py-2 text-xs font-medium text-[#E7E1D5]"
                >
                  <Globe className="w-4 h-4 text-[#DFBE7A]" />
                  <span>Ver Página Inicial</span>
                </button>
              )}
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={onToggleDarkMode}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-[#DFBE7A]"
                >
                  {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                  <span>{darkMode ? 'Claro' : 'Escuro'}</span>
                </button>
                <button
                  type="button"
                  onClick={onSignOut}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-red-300"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sair</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Deep Forest Green & Gold Header Bar */}
        <header className="sticky top-0 z-20 bg-[#173526] text-[#FBF7F0] border-b border-[#DFBE7A]/25 px-4 sm:px-8 py-3 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-full border border-[#DFBE7A]/45 text-[#DFBE7A] hover:bg-white/10 cursor-pointer"
              aria-label="Abrir menu"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2.5 min-w-0">
              <BrandHeartsMark className="w-7 h-6 lg:hidden shrink-0" />
              <div className="flex items-center gap-2 text-sm truncate">
                <span className="font-editorial text-xl font-semibold text-white hidden sm:inline">
                  {wedding.brideName} & {wedding.groomName}
                </span>
                <span className="text-[#DFBE7A]/60 hidden sm:inline">/</span>
                <span className="text-xs sm:text-sm font-medium text-[#F5E7C6] truncate">
                  {activeNavLabel}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onPreviewLanding && (
              <button
                type="button"
                onClick={onPreviewLanding}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-white/25 px-3.5 py-1.5 text-xs font-medium text-[#EFE9DC] hover:bg-white/10 transition-colors whitespace-nowrap cursor-pointer"
              >
                <Globe className="w-3.5 h-3.5 text-[#DFBE7A]" />
                <span>Página Inicial</span>
              </button>
            )}
            <PWAInstallButton compact />
            <button
              type="button"
              onClick={() => onPreviewGuestSite({ wedding, schedule, party, gifts })}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#DFBE7A]/80 bg-[#1F4532] hover:bg-[#DFBE7A] text-[#FBF2DC] hover:text-[#173526] px-4 py-1.5 text-xs font-semibold transition-all whitespace-nowrap cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Site dos Convidados</span>
            </button>
          </div>
        </header>

        <main className="flex-1 mx-auto max-w-6xl w-full px-4 sm:px-8 py-7 pb-24">
          {/* Optional Remote Announcement Banner controlled by Admin */}
          {platformConfig.announcementBanner && (
            <div className="mb-6 rounded-2xl border border-[#E5D8BF] dark:border-[#2C3A31] bg-white dark:bg-[#141B17] px-4 py-3 flex items-center gap-3 text-xs text-stone-700 dark:text-stone-300">
              <Megaphone className="w-4 h-4 shrink-0 text-[#B68B3C]" />
              <span>{platformConfig.announcementBanner}</span>
            </div>
          )}

          {tab === 'overview' && (
            <div className="space-y-6">
              {/* Luxury Editorial Split Hero Banner matching Reference Aesthetic */}
              <div className="relative rounded-3xl overflow-hidden border border-[#E5D8BF] dark:border-[#2A3730] bg-[#FDF8F2] dark:bg-[#141B17] shadow-md shadow-black/5">
                <div className="grid grid-cols-1 md:grid-cols-12 items-stretch">
                  {/* Left Cream Luxury Copy */}
                  <div className="md:col-span-6 relative z-20 p-6 sm:p-8 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2.5 text-[11px] font-semibold tracking-[0.16em] uppercase text-[#56635A] dark:text-[#CFC6B4]">
                        <span className="h-px w-6 bg-[#C89F52]" />
                        <span className="truncate">
                          {formatDateBR(wedding.weddingDate)} · {wedding.weddingTime}
                        </span>
                      </div>

                      <h1 className="mt-3 font-editorial text-4xl sm:text-5xl font-semibold tracking-tight text-[#1A241E] dark:text-[#FAF6EE] leading-[1.05]">
                        {wedding.brideName} & {wedding.groomName}
                      </h1>

                      <p className="mt-2 font-editorial italic text-2xl sm:text-3xl text-[#A87F32] dark:text-[#DFBE7A] flex items-center gap-2">
                        <span>Faltam {daysUntilWedding} dias para o sim.</span>
                        <Heart className="w-5 h-5 text-[#C89F52] shrink-0" />
                      </p>

                      {wedding.venueName && (
                        <p className="mt-2 text-xs text-[#5A655C] dark:text-[#B4AFA5]">
                          {wedding.venueName}
                        </p>
                      )}
                    </div>

                    <div className="mt-6 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setTab('settings')}
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#173526] hover:bg-[#10261B] text-white px-4 py-2 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5 text-[#DFBE7A]" />
                        <span>Ajustar fotos e cores</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => exportWeddingReportPDF({ wedding, guests, expenses })}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[#173526]/40 dark:border-[#DFBE7A]/40 bg-white/80 dark:bg-white/5 px-3.5 py-2 text-xs font-medium hover:bg-[#173526]/5 cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5 text-[#B68B3C]" />
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
                        className="inline-flex items-center gap-1.5 rounded-full border border-[#173526]/40 dark:border-[#DFBE7A]/40 bg-white/80 dark:bg-white/5 px-3.5 py-2 text-xs font-medium hover:bg-[#173526]/5 cursor-pointer"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-[#B68B3C]" />
                        <span>CSV</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => buildWeddingDayICS(wedding, schedule)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[#173526]/40 dark:border-[#DFBE7A]/40 bg-white/80 dark:bg-white/5 px-3.5 py-2 text-xs font-medium hover:bg-[#173526]/5 cursor-pointer"
                      >
                        <Calendar className="w-3.5 h-3.5 text-[#B68B3C]" />
                        <span>.ICS</span>
                      </button>
                    </div>
                  </div>

                  {/* Right Bleed Photo with Curved Golden Ribbon Arch */}
                  <div className="md:col-span-6 relative min-h-[220px] sm:min-h-[260px] overflow-hidden">
                    <SafeImage
                      src={wedding.coverPhotoUrl || GENERATED_ASSETS.heroCouple}
                      alt={`Capa de ${wedding.brideName} e ${wedding.groomName}`}
                      className={`absolute inset-0 w-full h-full object-cover ${getObjectPositionClass(wedding.coverPhotoPosition)}`}
                    />
                    <svg
                      viewBox="0 0 120 320"
                      preserveAspectRatio="none"
                      className="hidden md:block absolute inset-y-0 -left-1 h-full w-24 pointer-events-none"
                      aria-hidden="true"
                    >
                      <path
                        d="M0 0 H102 C36 90 22 220 72 320 H0 Z"
                        className="fill-[#FDF8F2] dark:fill-[#141B17]"
                      />
                      <path
                        d="M102 0 C36 90 22 220 72 320"
                        fill="none"
                        stroke="#D4AE62"
                        strokeWidth="10"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Luxury 6-Pillar Quick Access Dock (matching reference bottom bar) */}
              <div className="rounded-2xl bg-white dark:bg-[#141B17] border border-[#E5D8BF] dark:border-[#2A3730] shadow-xs px-3 py-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-y-4 lg:gap-y-0 lg:divide-x divide-[#EDE3D0] dark:divide-[#26322B]">
                  {quickDockItems.map((item) => (
                    <button
                      key={item.tab}
                      type="button"
                      onClick={() => setTab(item.tab)}
                      className="flex flex-col items-center text-center px-2.5 group cursor-pointer"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F6EEDF] dark:bg-[#1D2922] group-hover:scale-105 transition-transform">
                        {item.icon}
                      </div>
                      <span className="mt-2 text-xs font-semibold text-[#1D2620] dark:text-[#F4EFE6]">
                        {item.label}
                      </span>
                      <span className="text-[11px] text-stone-500 dark:text-stone-400 font-mono tabular-nums">
                        {item.sub}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Detailed Color-Coded Financial & Guest KPI Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-2xl border border-[#E5D8BF] dark:border-[#2A3730] bg-white dark:bg-[#141B17] p-5">
                  <p className="text-xs font-medium text-stone-500">Valor Total Contratado</p>
                  <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-[#1A241E] dark:text-stone-100">
                    {formatBRL(overviewStats.committed)}
                  </p>
                  <p className="mt-1.5 text-xs text-stone-500 tabular-nums">
                    {overviewStats.budgetPct}% do limite ({formatBRL(overviewStats.budget)})
                  </p>
                </div>

                <div className="rounded-2xl border border-emerald-200/90 dark:border-emerald-900/60 bg-emerald-50/75 dark:bg-emerald-950/25 p-5">
                  <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">Valor Pago</p>
                  <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                    {formatBRL(overviewStats.paid)}
                  </p>
                  <p className="mt-1.5 text-xs text-emerald-800/80 dark:text-emerald-300/80 tabular-nums">
                    {overviewStats.paidPct}% quitado até hoje
                  </p>
                </div>

                <div className="rounded-2xl border border-amber-200/90 dark:border-amber-900/60 bg-amber-50/75 dark:bg-amber-950/25 p-5">
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

                <div className="rounded-2xl border border-[#E5D8BF] dark:border-[#2A3730] bg-white dark:bg-[#141B17] p-5">
                  <p className="text-xs font-medium text-stone-500">Confirmados & Presentes Pix</p>
                  <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-[#173526] dark:text-[#DFBE7A]">
                    {overviewStats.confirmedPeople} / {overviewStats.totalPeople}
                  </p>
                  <p className="mt-1.5 text-xs text-stone-500 tabular-nums">
                    Pix recebidos: {formatBRL(overviewStats.giftsReceived)}
                  </p>
                </div>
              </div>

              {/* Financial Progress Bar Strip */}
              <div className="rounded-2xl border border-[#E5D8BF] dark:border-[#2A3730] bg-white dark:bg-[#141B17] p-5 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-[#1A241E] dark:text-stone-200">
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
                <div className="lg:col-span-5 rounded-2xl border border-[#E5D8BF] dark:border-[#2A3730] bg-white dark:bg-[#141B17] p-5">
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

                <div className="lg:col-span-7 rounded-2xl border border-[#E5D8BF] dark:border-[#2A3730] bg-white dark:bg-[#141B17] p-5 flex flex-col justify-between">
                  <div>
                    <p className="text-xs font-medium text-[#A87F32] dark:text-[#DFBE7A]">
                      Progresso dos Preparativos
                    </p>
                    <h2 className="mt-1 font-editorial text-2xl font-semibold">
                      Próximos passos com tranquilidade
                    </h2>
                    <div className="mt-4 space-y-3 text-sm">
                      <div className="flex items-center justify-between py-2 border-b border-[#F2E9DA] dark:border-stone-800">
                        <span>Fornecedores confirmados no checklist</span>
                        <span className="font-mono text-xs tabular-nums">
                          {overviewStats.vendorsDone} / {vendors.length}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b border-[#F2E9DA] dark:border-stone-800">
                        <span>Mesas configuradas na recepção</span>
                        <span className="font-mono text-xs tabular-nums">{tables.length} mesas</span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b border-[#F2E9DA] dark:border-stone-800">
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
                      className="rounded-full border border-[#173526]/40 dark:border-[#DFBE7A]/40 px-4 py-2 text-xs font-medium hover:bg-[#173526]/5 cursor-pointer"
                    >
                      Ver Gráficos Analytics
                    </button>
                    <button
                      type="button"
                      onClick={() => setTab('vendors')}
                      className="rounded-full border border-[#173526]/40 dark:border-[#DFBE7A]/40 px-4 py-2 text-xs font-medium hover:bg-[#173526]/5 cursor-pointer"
                    >
                      Gerenciar Fornecedores
                    </button>
                    <button
                      type="button"
                      onClick={() => setTab('finance')}
                      style={{ backgroundColor: effectiveAccent }}
                      className="rounded-full px-4 py-2 text-xs font-semibold text-white hover:brightness-110 cursor-pointer"
                    >
                      Abater Pagamentos
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
        color={profile.panicButtonColor || '#173526'}
        position={profile.panicButtonPosition || 'bottom-right'}
        breathingSeconds={profile.breathingSeconds || 4}
      />
    </div>
  );
};
