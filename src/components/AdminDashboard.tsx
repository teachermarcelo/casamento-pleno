import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  CreditCard,
  Database,
  Download,
  ExternalLink,
  MessageSquare,
  Plus,
  Search,
  Send,
  Settings2,
  Shield,
  Tag,
  Trash2,
  Users,
} from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db, FIREBASE_META, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  SUBSCRIPTION_PRICE,
  type PlatformConfig,
  type SupportMessage,
  type SupportStatus,
  type UserProfile,
  type Wedding,
} from '../types/wedding';
import {
  DEFAULT_PLATFORM_CONFIG,
  savePlatformConfig,
  sendSupportMessage,
  subscribeAdminData,
  subscribePlatformConfig,
  updateUserProfile,
} from '../lib/weddingService';
import { downloadCSV, formatBRL, formatDateBR, getGuestSiteUrl } from '../lib/utils';

interface AdminDashboardProps {
  profile: UserProfile;
  onBackToBride: () => void;
  onSignOut: () => void;
}

type AdminTab = 'crm' | 'categories' | 'support';
type LeadFilter = 'all' | 'active' | 'trial' | 'past_due' | 'priority';

const SUPPORT_STATUS_OPTIONS: { value: SupportStatus; label: string }[] = [
  { value: 'new', label: 'Novo Lead' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'active_support', label: 'Em Atendimento' },
  { value: 'priority', label: 'Prioridade' },
  { value: 'resolved', label: 'Resolvido' },
];

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  profile,
  onBackToBride,
  onSignOut,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('crm');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [weddings, setWeddings] = useState<Wedding[]>([]);
  const [mpStatus, setMpStatus] = useState<{
    configured: boolean;
    hasPublicKey: boolean;
    hasWebhookSecret: boolean;
    webhookEndpoint: string;
    checkoutEndpoint: string;
  } | null>(null);

  // CRM filters & inline notes
  const [leadFilter, setLeadFilter] = useState<LeadFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [savedUserId, setSavedUserId] = useState<string | null>(null);

  // Remote Platform Config (Categories, Plan Price, Banner)
  const [platformConfig, setPlatformConfig] = useState<PlatformConfig>(DEFAULT_PLATFORM_CONFIG);
  const [vendorCats, setVendorCats] = useState<string[]>(DEFAULT_PLATFORM_CONFIG.vendorCategories);
  const [expenseCats, setExpenseCats] = useState<string[]>(DEFAULT_PLATFORM_CONFIG.expenseCategories);
  const [newVendorCat, setNewVendorCat] = useState('');
  const [newExpenseCat, setNewExpenseCat] = useState('');
  const [defaultPlanPrice, setDefaultPlanPrice] = useState(String(SUBSCRIPTION_PRICE));
  const [supportWhatsApp, setSupportWhatsApp] = useState('');
  const [announcementBanner, setAnnouncementBanner] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSavedNotice, setConfigSavedNotice] = useState(false);

  // Real-time support inbox
  const [selectedWeddingId, setSelectedWeddingId] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<SupportMessage[]>([]);
  const [replyText, setReplyText] = useState('');

  useEffect(() => {
    const unsub = subscribeAdminData({
      onUsers: setUsers,
      onWeddings: (list) => {
        setWeddings(list);
        if (!selectedWeddingId && list.length > 0) {
          setSelectedWeddingId(list[0].id);
        }
      },
    });
    const unsubCfg = subscribePlatformConfig((cfg) => {
      setPlatformConfig(cfg);
      setVendorCats(cfg.vendorCategories);
      setExpenseCats(cfg.expenseCategories);
      setDefaultPlanPrice(String(cfg.defaultPlanPrice || SUBSCRIPTION_PRICE));
      setSupportWhatsApp(cfg.supportWhatsApp || '');
      setAnnouncementBanner(cfg.announcementBanner || '');
    });
    fetch('/api/payments/mercadopago/status')
      .then((r) => r.json())
      .then((d) => setMpStatus(d))
      .catch(() => {});
    return () => {
      unsub();
      unsubCfg();
    };
  }, [selectedWeddingId]);

  useEffect(() => {
    if (!selectedWeddingId) {
      setChatMessages([]);
      return;
    }
    const path = `weddings/${selectedWeddingId}/supportMessages`;
    const q = query(collection(db, path), where('weddingId', '==', selectedWeddingId));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SupportMessage, 'id'>) }));
        setChatMessages(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, path)
    );
    return () => unsub();
  }, [selectedWeddingId]);

  const metrics = useMemo(() => {
    const active = users.filter((u) => u.subscriptionStatus === 'active').length;
    const trial = users.filter((u) => u.subscriptionStatus === 'trial').length;
    const pastDue = users.filter((u) => u.subscriptionStatus === 'past_due').length;
    const canceled = users.filter((u) => u.subscriptionStatus === 'canceled').length;
    const priorityLeads = users.filter((u) => u.supportStatus === 'priority' || u.supportStatus === 'active_support').length;
    const mrr = users
      .filter((u) => u.subscriptionStatus === 'active')
      .reduce((s, u) => s + (u.planPrice || SUBSCRIPTION_PRICE), 0);
    const totalCollected = users.reduce((s, u) => s + (u.totalPaidSubscription || 0), 0);
    return { total: users.length, active, trial, pastDue, canceled, priorityLeads, mrr, totalCollected };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return users.filter((u) => {
      if (leadFilter === 'active' && u.subscriptionStatus !== 'active') return false;
      if (leadFilter === 'trial' && u.subscriptionStatus !== 'trial') return false;
      if (leadFilter === 'past_due' && u.subscriptionStatus !== 'past_due') return false;
      if (leadFilter === 'priority' && u.supportStatus !== 'priority' && u.supportStatus !== 'active_support') return false;
      if (!q) return true;
      return (
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.adminNotes || '').toLowerCase().includes(q)
      );
    });
  }, [users, leadFilter, searchQuery]);

  const selectedWedding = weddings.find((w) => w.id === selectedWeddingId);

  const handleRecordSubscriptionPayment = async (u: UserProfile) => {
    const todayIso = new Date().toISOString().slice(0, 10);
    const nextBilling = new Date();
    nextBilling.setMonth(nextBilling.getMonth() + 1);
    const nextIso = nextBilling.toISOString().slice(0, 10);
    const chargeValue = u.planPrice || platformConfig.defaultPlanPrice || SUBSCRIPTION_PRICE;

    await updateUserProfile(u.uid, {
      subscriptionStatus: 'active',
      paymentMethod: u.paymentMethod === 'card' ? 'card' : 'pix',
      lastPaymentDate: todayIso,
      nextBillingDate: nextIso,
      totalPaidSubscription: (u.totalPaidSubscription || 0) + chargeValue,
    });
    setSavedUserId(u.uid);
    setTimeout(() => setSavedUserId(null), 2000);
  };

  const handleSaveNotes = async (u: UserProfile) => {
    const text = notesDraft[u.uid] ?? u.adminNotes ?? '';
    await updateUserProfile(u.uid, { adminNotes: text });
    setSavedUserId(u.uid);
    setTimeout(() => setSavedUserId(null), 2000);
  };

  const handleSaveRemoteConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      await savePlatformConfig({
        vendorCategories: vendorCats,
        expenseCategories: expenseCats,
        defaultPlanPrice: Number(defaultPlanPrice) || SUBSCRIPTION_PRICE,
        supportWhatsApp,
        announcementBanner,
      });
      setConfigSavedNotice(true);
      setTimeout(() => setConfigSavedNotice(false), 3000);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleAddCategory = (target: 'vendor' | 'expense') => {
    if (target === 'vendor') {
      const clean = newVendorCat.trim();
      if (!clean || vendorCats.includes(clean)) return;
      setVendorCats([...vendorCats, clean]);
      setNewVendorCat('');
    } else {
      const clean = newExpenseCat.trim();
      if (!clean || expenseCats.includes(clean)) return;
      setExpenseCats([...expenseCats, clean]);
      setNewExpenseCat('');
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedWedding) return;
    await sendSupportMessage(
      selectedWedding.id,
      selectedWedding.ownerId,
      'admin',
      'Equipe Casamento Pleno',
      replyText
    );
    setReplyText('');
  };

  const handleExportSubscribers = () => {
    downloadCSV(
      'assinantes-leads-casamento-pleno.csv',
      [
        'Nome',
        'E-mail',
        'Status Assinatura',
        'Valor Mensal',
        'Total Arrecadado',
        'Último Pagamento',
        'Próxima Cobrança',
        'Status Suporte CRM',
        'Observações Admin',
      ],
      users.map((u) => [
        u.displayName,
        u.email,
        u.subscriptionStatus,
        u.planPrice,
        u.totalPaidSubscription || 0,
        u.lastPaymentDate || '',
        u.nextBillingDate || '',
        u.supportStatus || 'new',
        u.adminNotes || '',
      ])
    );
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] dark:bg-[#0F1115] text-stone-900 dark:text-stone-100">
      <header className="sticky top-0 z-20 border-b border-stone-200 dark:border-stone-800 bg-white/95 dark:bg-[#14171D]/95 backdrop-blur-md px-6 py-4">
        <div className="mx-auto max-w-7xl flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
            <div>
              <span className="font-editorial text-2xl font-semibold block leading-none">
                Casamento Pleno — Console do Criador
              </span>
              <span className="text-[11px] text-stone-500">
                Assinaturas, CRM de Leads, Categorias Remotas & Suporte
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBackToBride}
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 dark:border-stone-700 px-3.5 py-2 text-xs font-medium hover:bg-stone-50 dark:hover:bg-stone-800 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Meu Painel de Casamento</span>
            </button>
            <button
              type="button"
              onClick={onSignOut}
              className="text-xs font-medium text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 cursor-pointer"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8 space-y-7">
        {/* Top Color-Coded Metrics Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="rounded-2xl border border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/75 dark:bg-emerald-950/25 p-5">
            <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">Receita Mensal (MRR)</p>
            <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
              {formatBRL(metrics.mrr)}
            </p>
            <p className="mt-1 text-xs text-emerald-800/80 dark:text-emerald-300/80">
              {metrics.active} ativa(s) · {formatBRL(platformConfig.defaultPlanPrice)}/mês
            </p>
          </div>

          <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-5">
            <p className="text-xs font-medium text-stone-500">Total Arrecadado</p>
            <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-stone-900 dark:text-stone-100">
              {formatBRL(metrics.totalCollected)}
            </p>
            <p className="mt-1 text-xs text-stone-500">Pagamentos registrados</p>
          </div>

          <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-5">
            <p className="text-xs font-medium text-stone-500">Leads / Assinantes</p>
            <p className="mt-2 font-mono text-3xl font-semibold tabular-nums">{metrics.total}</p>
            <p className="mt-1 text-xs text-stone-500">{weddings.length} painel(is) ativos</p>
          </div>

          <div className="rounded-2xl border border-amber-200/80 dark:border-amber-900/60 bg-amber-50/75 dark:bg-amber-950/25 p-5">
            <p className="text-xs font-medium text-amber-900 dark:text-amber-300">Em Teste / Pendentes</p>
            <p className="mt-2 font-mono text-3xl font-semibold tabular-nums text-amber-700 dark:text-amber-400">
              {metrics.trial + metrics.pastDue}
            </p>
            <p className="mt-1 text-xs text-amber-900/80 dark:text-amber-300/80">
              {metrics.trial} teste · {metrics.pastDue} inadimpl.
            </p>
          </div>

          <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-5">
            <p className="text-xs font-medium text-stone-500">Suporte em Aberto</p>
            <p className="mt-2 font-mono text-3xl font-semibold tabular-nums text-stone-900 dark:text-stone-100">
              {metrics.priorityLeads}
            </p>
            <p className="mt-1 text-xs text-stone-500">{metrics.canceled} cancelada(s)</p>
          </div>
        </div>

        {/* Section Tabs */}
        <div className="inline-flex flex-wrap items-center gap-1 rounded-2xl bg-stone-200/70 dark:bg-stone-800/80 p-1.5">
          {(
            [
              ['crm', 'Assinaturas, Pagamentos & Leads (CRM)', <Users key="u" className="w-4 h-4" />],
              ['categories', 'Categorias & Config Remota', <Settings2 key="c" className="w-4 h-4" />],
              ['support', 'Suporte em Tempo Real & Infra', <MessageSquare key="s" className="w-4 h-4" />],
            ] as const
          ).map(([id, label, icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-colors cursor-pointer ${
                activeTab === id
                  ? 'bg-white dark:bg-[#1C2029] text-stone-900 dark:text-stone-100 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              {icon}
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* TAB 1: Assinaturas, Pagamentos & CRM de Leads */}
        {activeTab === 'crm' && (
          <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] overflow-hidden">
            <div className="p-5 border-b border-stone-200 dark:border-stone-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h2 className="font-editorial text-2xl font-semibold">
                  Assinaturas, Pagamentos & Suporte aos Leads
                </h2>
                <p className="text-xs text-stone-500">
                  Controle renovações, registre pagamentos mensais, acompanhe status de suporte e anotações de cada cliente.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar cliente ou nota..."
                    className="rounded-xl border border-stone-300 dark:border-stone-700 bg-transparent pl-8 pr-3 py-1.5 text-xs w-52"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleExportSubscribers}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 dark:border-stone-700 px-3 py-1.5 text-xs font-medium hover:bg-stone-50 dark:hover:bg-stone-800 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Exportar CSV</span>
                </button>
              </div>
            </div>

            <div className="px-5 py-3 border-b border-stone-100 dark:border-stone-800/80 flex flex-wrap gap-1.5">
              {(
                [
                  ['all', `Todos (${users.length})`],
                  ['active', `Ativas (${metrics.active})`],
                  ['trial', `Em Teste (${metrics.trial})`],
                  ['past_due', `Inadimplentes (${metrics.pastDue})`],
                  ['priority', `Em Suporte (${metrics.priorityLeads})`],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setLeadFilter(k)}
                  className={`px-3 py-1 text-xs font-medium rounded-lg cursor-pointer ${
                    leadFilter === k
                      ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900'
                      : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-stone-200 dark:border-stone-800 text-xs text-stone-500">
                    <th className="py-3 px-4 font-medium">Cliente & Casamento</th>
                    <th className="py-3 px-4 font-medium">Assinatura & Cobrança</th>
                    <th className="py-3 px-4 font-medium">Status Pgto</th>
                    <th className="py-3 px-4 font-medium">Suporte / CRM</th>
                    <th className="py-3 px-4 font-medium">Notas Internas</th>
                    <th className="py-3 px-4 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800/80">
                  {filteredUsers.map((u) => {
                    const wed = weddings.find((w) => w.ownerId === u.uid);
                    const draft = notesDraft[u.uid] ?? u.adminNotes ?? '';
                    return (
                      <tr key={u.uid} className="hover:bg-stone-50/70 dark:hover:bg-stone-800/25 align-top">
                        <td className="py-3.5 px-4">
                          <p className="font-medium text-stone-900 dark:text-stone-100">{u.displayName}</p>
                          <p className="text-xs text-stone-500">{u.email}</p>
                          {wed ? (
                            <a
                              href={getGuestSiteUrl(wed.slug)}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
                            >
                              <span>{wed.brideName} & {wed.groomName}</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="mt-1 block text-[11px] text-stone-400">Setup pendente</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-xs space-y-1">
                          <p className="font-mono font-semibold tabular-nums">
                            {formatBRL(u.planPrice || SUBSCRIPTION_PRICE)}/mês · {(u.paymentMethod || 'pending').toUpperCase()}
                          </p>
                          <p className="text-stone-500 font-mono tabular-nums">
                            Últ. pgto: {formatDateBR(u.lastPaymentDate)}
                          </p>
                          <p className="text-stone-500 font-mono tabular-nums">
                            Próx. venc: {formatDateBR(u.nextBillingDate)}
                          </p>
                          <p className="text-emerald-700 dark:text-emerald-400 font-mono tabular-nums font-medium">
                            Total pago: {formatBRL(u.totalPaidSubscription || 0)}
                          </p>
                        </td>

                        <td className="py-3.5 px-4">
                          <select
                            value={u.subscriptionStatus}
                            onChange={(e) =>
                              updateUserProfile(u.uid, {
                                subscriptionStatus: e.target.value as UserProfile['subscriptionStatus'],
                              })
                            }
                            className="rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#171A21] px-2.5 py-1.5 text-xs font-medium"
                          >
                            <option value="active">Ativa</option>
                            <option value="trial">Em Teste</option>
                            <option value="past_due">Inadimplente</option>
                            <option value="canceled">Cancelada</option>
                          </select>
                        </td>

                        <td className="py-3.5 px-4">
                          <select
                            value={u.supportStatus || 'new'}
                            onChange={(e) =>
                              updateUserProfile(u.uid, {
                                supportStatus: e.target.value as SupportStatus,
                              })
                            }
                            className="rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#171A21] px-2.5 py-1.5 text-xs font-medium"
                          >
                            {SUPPORT_STATUS_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="py-3.5 px-4 min-w-[210px]">
                          <div className="flex gap-1.5">
                            <input
                              maxLength={600}
                              value={draft}
                              onChange={(e) =>
                                setNotesDraft((prev) => ({ ...prev, [u.uid]: e.target.value }))
                              }
                              placeholder="Anotação de atendimento..."
                              className="flex-1 rounded-lg border border-stone-200 dark:border-stone-700 bg-transparent px-2.5 py-1.5 text-xs"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveNotes(u)}
                              className="rounded-lg border border-stone-300 dark:border-stone-700 px-2.5 py-1.5 text-xs font-medium hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                              title="Salvar observação"
                            >
                              {savedUserId === u.uid ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                'Salvar'
                              )}
                            </button>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex flex-col items-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleRecordSubscriptionPayment(u)}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 px-3 py-1.5 text-[11px] font-semibold text-white cursor-pointer"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Registrar Pgto</span>
                            </button>
                            {wed && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedWeddingId(wed.id);
                                  setActiveTab('support');
                                }}
                                className="text-[11px] text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 underline cursor-pointer"
                              >
                                Abrir chat suporte
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: Categorias & Configurações Remotas (platformConfig/global) */}
        {activeTab === 'categories' && (
          <form onSubmit={handleSaveRemoteConfig} className="space-y-6">
            <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="font-editorial text-2xl font-semibold">
                    Gestão Remota de Categorias & Plataforma
                  </h2>
                  <p className="text-xs text-stone-500">
                    Todas as alterações salvas aqui são propagadas em tempo real para o painel de todas as noivas assinantes.
                  </p>
                </div>
                {configSavedNotice && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    <Check className="w-4 h-4" /> Publicado para todas as assinantes
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Vendor Categories */}
                <div className="rounded-xl border border-stone-200 dark:border-stone-800 p-5 space-y-4">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Tag className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                    <span>Categorias de Fornecedores ({vendorCats.length})</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      maxLength={80}
                      value={newVendorCat}
                      onChange={(e) => setNewVendorCat(e.target.value)}
                      placeholder="Ex.: Bar & Drinks, Celebrante..."
                      className="flex-1 rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddCategory('vendor')}
                      className="inline-flex items-center gap-1 rounded-lg bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 px-3 py-2 text-xs font-semibold cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Adicionar</span>
                    </button>
                  </div>

                  <div className="divide-y divide-stone-100 dark:divide-stone-800 max-h-64 overflow-y-auto">
                    {vendorCats.map((cat) => (
                      <div key={cat} className="py-2 flex items-center justify-between text-xs">
                        <span>{cat}</span>
                        <button
                          type="button"
                          onClick={() => setVendorCats(vendorCats.filter((c) => c !== cat))}
                          className="p-1 text-stone-400 hover:text-red-600 cursor-pointer"
                          aria-label={`Remover ${cat}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Expense Categories */}
                <div className="rounded-xl border border-stone-200 dark:border-stone-800 p-5 space-y-4">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <CreditCard className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                    <span>Categorias de Pagamentos / Financeiro ({expenseCats.length})</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      maxLength={80}
                      value={newExpenseCat}
                      onChange={(e) => setNewExpenseCat(e.target.value)}
                      placeholder="Ex.: Cartório & Civil, Hotel..."
                      className="flex-1 rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddCategory('expense')}
                      className="inline-flex items-center gap-1 rounded-lg bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 px-3 py-2 text-xs font-semibold cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Adicionar</span>
                    </button>
                  </div>

                  <div className="divide-y divide-stone-100 dark:divide-stone-800 max-h-64 overflow-y-auto">
                    {expenseCats.map((cat) => (
                      <div key={cat} className="py-2 flex items-center justify-between text-xs">
                        <span>{cat}</span>
                        <button
                          type="button"
                          onClick={() => setExpenseCats(expenseCats.filter((c) => c !== cat))}
                          className="p-1 text-stone-400 hover:text-red-600 cursor-pointer"
                          aria-label={`Remover ${cat}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Global Plan Price, Support WhatsApp, Announcement Banner */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-stone-200 dark:border-stone-800">
                <div>
                  <label className="block text-xs text-stone-500 mb-1">Valor Padrão da Assinatura (R$/mês)</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={defaultPlanPrice}
                    onChange={(e) => setDefaultPlanPrice(e.target.value)}
                    className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-stone-500 mb-1">WhatsApp Oficial de Suporte</label>
                  <input
                    maxLength={40}
                    value={supportWhatsApp}
                    onChange={(e) => setSupportWhatsApp(e.target.value)}
                    placeholder="(11) 99999-9999"
                    className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-stone-500 mb-1">Aviso Global no Painel das Noivas (opcional)</label>
                  <input
                    maxLength={300}
                    value={announcementBanner}
                    onChange={(e) => setAnnouncementBanner(e.target.value)}
                    placeholder="Ex.: Nova atualização: envie suas fotos de capa!"
                    className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingConfig}
                  className="rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white px-6 py-2.5 text-xs font-semibold cursor-pointer disabled:opacity-60"
                >
                  {savingConfig ? 'Publicando...' : 'Salvar e publicar alterações remotamente'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* TAB 3: Suporte em Tempo Real & Infraestrutura */}
        {activeTab === 'support' && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200 dark:border-stone-800">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-stone-500" />
                  <h2 className="font-editorial text-2xl font-semibold">Central de Suporte às Noivas</h2>
                </div>

                <select
                  value={selectedWeddingId}
                  onChange={(e) => setSelectedWeddingId(e.target.value)}
                  className="rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#171A21] px-3 py-2 text-xs"
                >
                  {weddings.length === 0 && <option value="">Nenhum casamento cadastrado</option>}
                  {weddings.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.brideName} & {w.groomName} ({w.slug})
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-4 h-72 overflow-y-auto space-y-2.5 pr-1">
                {chatMessages.length === 0 ? (
                  <p className="text-xs text-stone-400 text-center py-12">
                    Nenhuma mensagem de suporte recebida deste casamento ainda.
                  </p>
                ) : (
                  chatMessages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex flex-col ${m.senderRole === 'admin' ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-xl px-3.5 py-2 text-sm ${
                          m.senderRole === 'admin'
                            ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900'
                            : 'bg-stone-100 dark:bg-stone-800'
                        }`}
                      >
                        <p className="text-[11px] opacity-70">{m.senderName}</p>
                        <p>{m.text}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {selectedWedding && (
                <form onSubmit={handleSendReply} className="mt-4 flex gap-2">
                  <input
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={`Responder para ${selectedWedding.brideName} & ${selectedWedding.groomName}...`}
                    className="flex-1 rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3.5 py-2 text-sm"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 px-4 py-2 text-xs font-semibold cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Enviar</span>
                  </button>
                </form>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-6 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Database className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                  <span>Banco de Dados Firebase Conectado</span>
                </div>
                <div className="space-y-1.5 text-xs text-stone-600 dark:text-stone-400">
                  <p>
                    Projeto Firebase: <strong className="font-mono text-stone-900 dark:text-stone-100">{FIREBASE_META.projectId}</strong>
                  </p>
                  <p>
                    Firestore Database ID: <strong className="font-mono text-stone-900 dark:text-stone-100">{FIREBASE_META.databaseId}</strong>
                  </p>
                  <p>
                    Administrador proprietário: <strong className="font-mono text-stone-900 dark:text-stone-100">{profile.email}</strong>
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-6 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <CreditCard className="w-4 h-4 text-stone-700 dark:text-stone-300" />
                    <span>Integração Mercado Pago (R$ 39,90/mês)</span>
                  </div>
                  <span
                    className={`text-xs font-semibold ${
                      mpStatus?.configured
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-amber-700 dark:text-amber-400'
                    }`}
                  >
                    {mpStatus?.configured ? 'Produção Ativa' : 'Pronto para Credenciais'}
                  </span>
                </div>
                <div className="space-y-1.5 text-xs text-stone-600 dark:text-stone-400">
                  <p>
                    Para ativar cobranças reais, adicione nos <strong>Secrets</strong> do projeto:
                    <span className="font-mono block mt-1 text-stone-800 dark:text-stone-200">
                      MERCADO_PAGO_ACCESS_TOKEN · MERCADO_PAGO_PUBLIC_KEY · MERCADO_PAGO_WEBHOOK_SECRET
                    </span>
                  </p>
                  <p>
                    Webhook URL:{' '}
                    <code className="font-mono text-stone-800 dark:text-stone-200 break-all">
                      {mpStatus?.webhookEndpoint || '/api/payments/mercadopago/webhook'}
                    </code>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
