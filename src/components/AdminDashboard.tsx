import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Database,
  Download,
  ExternalLink,
  Eye,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings2,
  Shield,
  Tag,
  Trash2,
  UserPlus,
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
  createLeadClientByAdmin,
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
  onSimulateClient: (client: UserProfile, startAtOnboarding?: boolean) => void;
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
  onSimulateClient,
  onSignOut,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('crm');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [weddings, setWeddings] = useState<Wedding[]>([]);
  const seededGestorRef = useRef(false);
  const [showAddLead, setShowAddLead] = useState(false);
  const [newLeadEmail, setNewLeadEmail] = useState('');
  const [newLeadName, setNewLeadName] = useState('');
  const [creatingLead, setCreatingLead] = useState(false);
  const [mpStatus, setMpStatus] = useState<{
    configured: boolean;
    hasPublicKey: boolean;
    hasWebhookSecret: boolean;
    environment?: 'unconfigured' | 'sandbox' | 'production';
    webhookEndpoint: string;
    checkoutEndpoint: string;
    liveCheck?: { ok: boolean; accountName?: string; siteId?: string; error?: string };
  } | null>(null);
  const [testingMp, setTestingMp] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

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
      onUsers: (list) => {
        setUsers(list);
        setUsersLoaded(true);
      },
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
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setMpStatus(d);
      })
      .catch(() => {});
    return () => {
      unsub();
      unsubCfg();
    };
  }, [selectedWeddingId]);

  // Automatically insert gestorpaid@gmail.com as a groom lead contracting the service if not yet present
  useEffect(() => {
    if (!usersLoaded || seededGestorRef.current) return;
    const alreadyExists = users.some((u) => u.email.toLowerCase() === 'gestorpaid@gmail.com');
    seededGestorRef.current = true;
    if (!alreadyExists) {
      createLeadClientByAdmin({
        id: 'lead_gestorpaid',
        email: 'gestorpaid@gmail.com',
        displayName: 'Gestor Paid (Noivo Lead)',
        leadSource: 'Lead Noivo (Teste de Jornada)',
        adminNotes: 'Inserido para simular a jornada completa de contratação (Checkout R$ 39,90 -> Setup -> Painel do Noivo).',
      }).catch((err) => {
        console.error('Could not seed gestorpaid@gmail.com lead:', err);
      });
    }
  }, [usersLoaded, users]);

  const gestorLead = useMemo(
    () => users.find((u) => u.email.toLowerCase() === 'gestorpaid@gmail.com') || null,
    [users]
  );

  const handleCreateManualLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeadEmail.trim()) return;
    setCreatingLead(true);
    try {
      await createLeadClientByAdmin({
        email: newLeadEmail.trim(),
        displayName: newLeadName.trim() || newLeadEmail.split('@')[0],
        leadSource: 'Cadastro Manual (Admin)',
      });
      setNewLeadEmail('');
      setNewLeadName('');
      setShowAddLead(false);
    } finally {
      setCreatingLead(false);
    }
  };

  const handleTestMercadoPago = async () => {
    setTestingMp(true);
    try {
      const res = await fetch('/api/payments/mercadopago/status?verify=1');
      if (res.ok) {
        const data = await res.json();
        setMpStatus(data);
      } else {
        setMpStatus({
          configured: false,
          hasPublicKey: false,
          hasWebhookSecret: false,
          environment: 'unconfigured',
          webhookEndpoint: `${window.location.origin}/api/payments/mercadopago/webhook`,
          checkoutEndpoint: '/api/payments/mercadopago/create-subscription',
          liveCheck: {
            ok: false,
            error: 'Rota /api/payments/mercadopago/status indisponível. Faça redeploy na Vercel para ativar as Serverless Functions.',
          },
        });
      }
    } catch {
      setMpStatus({
        configured: false,
        hasPublicKey: false,
        hasWebhookSecret: false,
        environment: 'unconfigured',
        webhookEndpoint: `${window.location.origin}/api/payments/mercadopago/webhook`,
        checkoutEndpoint: '/api/payments/mercadopago/create-subscription',
        liveCheck: {
          ok: false,
          error: 'Não foi possível contactar a API do servidor.',
        },
      });
    } finally {
      setTestingMp(false);
    }
  };

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
    <div className="min-h-screen overflow-x-clip bg-[#FAF7F2] dark:bg-[#0F1115] text-stone-900 dark:text-stone-100">
      <header className="sticky top-0 z-20 border-b border-stone-200 dark:border-stone-800 bg-white/95 dark:bg-[#14171D]/95 backdrop-blur-md px-4 sm:px-6 py-3 sm:py-4">
        <div className="mx-auto max-w-7xl flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <Shield className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <span className="font-editorial text-lg sm:text-2xl font-semibold block leading-tight truncate">
                Casamento Pleno — Console do Criador
              </span>
              <span className="text-[11px] text-stone-500 block truncate">
                Assinaturas, CRM de Leads, Categorias & Suporte
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={onBackToBride}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-stone-300 dark:border-stone-700 px-3 sm:px-3.5 py-2 text-xs font-medium hover:bg-stone-50 dark:hover:bg-stone-800 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
              <span className="sm:hidden">Meu Painel</span>
              <span className="hidden sm:inline">Meu Painel de Casamento</span>
            </button>
            <button
              type="button"
              onClick={onSignOut}
              className="min-h-[38px] px-2 text-xs font-medium text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 cursor-pointer"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-5 sm:py-8 space-y-5 sm:space-y-7">
        {/* Top Color-Coded Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <div className="rounded-2xl border border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/75 dark:bg-emerald-950/25 p-3.5 sm:p-5 min-w-0">
            <p className="text-[11px] sm:text-xs font-medium text-emerald-800 dark:text-emerald-300 truncate">Receita Mensal (MRR)</p>
            <p className="mt-1.5 sm:mt-2 font-mono text-lg sm:text-2xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-400 truncate">
              {formatBRL(metrics.mrr)}
            </p>
            <p className="mt-1 text-[11px] sm:text-xs text-emerald-800/80 dark:text-emerald-300/80 truncate">
              {metrics.active} ativa(s) · {formatBRL(platformConfig.defaultPlanPrice)}/mês
            </p>
          </div>

          <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-3.5 sm:p-5 min-w-0">
            <p className="text-[11px] sm:text-xs font-medium text-stone-500 truncate">Total Arrecadado</p>
            <p className="mt-1.5 sm:mt-2 font-mono text-lg sm:text-2xl font-semibold tabular-nums text-stone-900 dark:text-stone-100 truncate">
              {formatBRL(metrics.totalCollected)}
            </p>
            <p className="mt-1 text-[11px] sm:text-xs text-stone-500 truncate">Pagamentos registrados</p>
          </div>

          <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-3.5 sm:p-5 min-w-0">
            <p className="text-[11px] sm:text-xs font-medium text-stone-500 truncate">Leads / Assinantes</p>
            <p className="mt-1.5 sm:mt-2 font-mono text-2xl sm:text-3xl font-semibold tabular-nums">{metrics.total}</p>
            <p className="mt-1 text-[11px] sm:text-xs text-stone-500 truncate">{weddings.length} painel(is) ativos</p>
          </div>

          <div className="rounded-2xl border border-amber-200/80 dark:border-amber-900/60 bg-amber-50/75 dark:bg-amber-950/25 p-3.5 sm:p-5 min-w-0">
            <p className="text-[11px] sm:text-xs font-medium text-amber-900 dark:text-amber-300 truncate">Em Teste / Pendentes</p>
            <p className="mt-1.5 sm:mt-2 font-mono text-2xl sm:text-3xl font-semibold tabular-nums text-amber-700 dark:text-amber-400">
              {metrics.trial + metrics.pastDue}
            </p>
            <p className="mt-1 text-[11px] sm:text-xs text-amber-900/80 dark:text-amber-300/80 truncate">
              {metrics.trial} teste · {metrics.pastDue} inadimpl.
            </p>
          </div>

          <div className="col-span-2 sm:col-span-1 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-3.5 sm:p-5 min-w-0">
            <p className="text-[11px] sm:text-xs font-medium text-stone-500 truncate">Suporte em Aberto</p>
            <p className="mt-1.5 sm:mt-2 font-mono text-2xl sm:text-3xl font-semibold tabular-nums text-stone-900 dark:text-stone-100">
              {metrics.priorityLeads}
            </p>
            <p className="mt-1 text-[11px] sm:text-xs text-stone-500 truncate">{metrics.canceled} cancelada(s)</p>
          </div>
        </div>

        {/* Section Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar max-w-full rounded-2xl bg-stone-200/70 dark:bg-stone-800/80 p-1.5">
          {(
            [
              ['crm', 'Assinaturas, Pagamentos & Leads (CRM)', <Users key="u" className="w-4 h-4 shrink-0" />],
              ['categories', 'Categorias & Config Remota', <Settings2 key="c" className="w-4 h-4 shrink-0" />],
              ['support', 'Suporte em Tempo Real & Infra', <MessageSquare key="s" className="w-4 h-4 shrink-0" />],
            ] as const
          ).map(([id, label, icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`shrink-0 whitespace-nowrap min-h-[40px] inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 text-xs font-semibold rounded-xl transition-colors cursor-pointer ${
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
          <div className="space-y-5">
            {/* Lead Journey Simulator Card for gestorpaid@gmail.com */}
            {gestorLead && (
              <div className="rounded-2xl bg-[#173526] text-[#FBF7F0] border border-[#DFBE7A]/40 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-sm">
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#DFBE7A]">
                    Simulador de Jornada do Lead / Noivo
                  </p>
                  <h3 className="font-editorial text-2xl font-semibold text-white">
                    {gestorLead.displayName} ({gestorLead.email})
                  </h3>
                  <p className="text-xs text-[#E5E0D5]/85 max-w-2xl">
                    Teste exatamente até onde um lead contratante consegue ir (Checkout R$ 39,90 → Personalização → Painel do Noivo/Noiva e Site dos Convidados), sem nenhum acesso ao Console do Criador.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => onSimulateClient(gestorLead, true)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#DFBE7A] text-[#173526] hover:bg-[#EBD198] px-4 py-2 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Simular Checkout & Setup</span>
                  </button>
                  {gestorLead.weddingId && (
                    <button
                      type="button"
                      onClick={() => onSimulateClient(gestorLead, false)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#DFBE7A]/70 text-[#FBF2DC] hover:bg-white/10 px-4 py-2 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Abrir Painel do Noivo</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-stone-200 dark:border-stone-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <h2 className="font-editorial text-2xl font-semibold">
                    Assinaturas, Pagamentos & Suporte aos Leads
                  </h2>
                  <p className="text-xs text-stone-500">
                    Controle renovações, registre pagamentos mensais, acompanhe status de suporte e visualize o painel exato de cada lead.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                  <div className="relative w-full sm:w-52">
                    <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar cliente ou nota..."
                      className="w-full min-h-[38px] rounded-xl border border-stone-300 dark:border-stone-700 bg-transparent pl-8 pr-3 py-1.5 text-xs"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddLead((prev) => !prev)}
                    className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl bg-[#173526] text-white px-3.5 py-1.5 text-xs font-semibold hover:bg-[#10261B] cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5 text-[#DFBE7A]" />
                    <span>Inserir Lead</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportSubscribers}
                    className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-stone-300 dark:border-stone-700 px-3.5 py-1.5 text-xs font-medium hover:bg-stone-50 dark:hover:bg-stone-800 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Exportar CSV</span>
                  </button>
                </div>
              </div>

              {showAddLead && (
                <form
                  onSubmit={handleCreateManualLead}
                  className="p-4 bg-[#FAF7F2] dark:bg-[#14171D] border-b border-stone-200 dark:border-stone-800 flex flex-wrap items-end gap-3"
                >
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-[11px] text-stone-500 mb-1">E-mail do Lead (Noiva/Noivo)</label>
                    <input
                      type="email"
                      required
                      value={newLeadEmail}
                      onChange={(e) => setNewLeadEmail(e.target.value)}
                      placeholder="Ex.: cliente@gmail.com"
                      className="w-full min-h-[40px] rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#171A21] px-3 py-1.5 text-xs"
                    />
                  </div>
                  <div className="flex-1 min-w-[180px]">
                    <label className="block text-[11px] text-stone-500 mb-1">Nome do Casal / Lead</label>
                    <input
                      value={newLeadName}
                      onChange={(e) => setNewLeadName(e.target.value)}
                      placeholder="Ex.: João & Camila"
                      className="w-full min-h-[40px] rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#171A21] px-3 py-1.5 text-xs"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={creatingLead}
                    className="min-h-[40px] rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-1.5 text-xs font-semibold cursor-pointer disabled:opacity-60"
                  >
                    {creatingLead ? 'Salvando...' : 'Criar Lead'}
                  </button>
                </form>
              )}

            <div className="px-4 sm:px-5 py-3 border-b border-stone-100 dark:border-stone-800/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-full">
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
                  className={`shrink-0 whitespace-nowrap min-h-[34px] px-3 py-1 text-xs font-medium rounded-lg cursor-pointer ${
                    leadFilter === k
                      ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900'
                      : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Mobile CRM Lead Cards */}
            <div className="md:hidden divide-y divide-stone-100 dark:divide-stone-800/80">
              {filteredUsers.map((u) => {
                const wed = weddings.find((w) => w.ownerId === u.uid);
                const draft = notesDraft[u.uid] ?? u.adminNotes ?? '';
                return (
                  <div key={u.uid} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-stone-900 dark:text-stone-100 truncate">
                          {u.displayName}
                        </p>
                        <p className="text-xs text-stone-500 break-all">{u.email}</p>
                        {wed ? (
                          <a
                            href={getGuestSiteUrl(wed.slug)}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
                          >
                            <span>{wed.brideName} & {wed.groomName}</span>
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                        ) : (
                          <span className="mt-1 block text-[11px] text-stone-400">Setup pendente</span>
                        )}
                      </div>
                      <span className="font-mono text-xs font-semibold tabular-nums text-emerald-700 dark:text-emerald-400 shrink-0">
                        {formatBRL(u.planPrice || SUBSCRIPTION_PRICE)}/mês
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 rounded-xl bg-stone-50 dark:bg-stone-900/50 p-2.5 text-[11px] font-mono tabular-nums">
                      <div>
                        <p className="text-stone-500 font-sans">Últ. pgto</p>
                        <p className="font-medium mt-0.5">{formatDateBR(u.lastPaymentDate)}</p>
                      </div>
                      <div>
                        <p className="text-stone-500 font-sans">Próx. venc</p>
                        <p className="font-medium mt-0.5">{formatDateBR(u.nextBillingDate)}</p>
                      </div>
                      <div>
                        <p className="text-stone-500 font-sans">Total pago</p>
                        <p className="font-semibold text-emerald-700 dark:text-emerald-400 mt-0.5">
                          {formatBRL(u.totalPaidSubscription || 0)}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={u.subscriptionStatus}
                        onChange={(e) =>
                          updateUserProfile(u.uid, {
                            subscriptionStatus: e.target.value as UserProfile['subscriptionStatus'],
                          })
                        }
                        aria-label="Status da assinatura"
                        className="w-full min-h-[40px] rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#171A21] px-2.5 py-1.5 text-xs font-medium"
                      >
                        <option value="active">Ativa</option>
                        <option value="trial">Em Teste</option>
                        <option value="past_due">Inadimplente</option>
                        <option value="canceled">Cancelada</option>
                      </select>

                      <select
                        value={u.supportStatus || 'new'}
                        onChange={(e) =>
                          updateUserProfile(u.uid, {
                            supportStatus: e.target.value as SupportStatus,
                          })
                        }
                        aria-label="Status de suporte"
                        className="w-full min-h-[40px] rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#171A21] px-2.5 py-1.5 text-xs font-medium"
                      >
                        {SUPPORT_STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex gap-1.5">
                      <input
                        maxLength={600}
                        value={draft}
                        onChange={(e) =>
                          setNotesDraft((prev) => ({ ...prev, [u.uid]: e.target.value }))
                        }
                        placeholder="Anotação de atendimento..."
                        className="flex-1 min-w-0 min-h-[40px] rounded-lg border border-stone-200 dark:border-stone-700 bg-transparent px-2.5 py-1.5 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveNotes(u)}
                        className="min-h-[40px] rounded-lg border border-stone-300 dark:border-stone-700 px-3 py-1.5 text-xs font-medium hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer shrink-0"
                      >
                        {savedUserId === u.uid ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          'Salvar'
                        )}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-0.5">
                      <button
                        type="button"
                        onClick={() => onSimulateClient(u, !wed)}
                        className="min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#173526] hover:bg-[#10261B] text-[#FBF2DC] border border-[#DFBE7A]/50 px-3 py-2 text-xs font-semibold cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-[#DFBE7A] shrink-0" />
                        <span>{wed ? 'Ver Cliente' : 'Simular'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRecordSubscriptionPayment(u)}
                        className="min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 px-3 py-2 text-xs font-semibold text-white cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>Registrar Pgto</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="hidden md:block overflow-x-auto">
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
                              onClick={() => onSimulateClient(u, !wed)}
                              className="inline-flex items-center gap-1 rounded-lg bg-[#173526] hover:bg-[#10261B] text-[#FBF2DC] border border-[#DFBE7A]/50 px-3 py-1.5 text-[11px] font-semibold cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5 text-[#DFBE7A]" />
                              <span>{wed ? 'Ver como Cliente' : 'Simular Jornada'}</span>
                            </button>
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-4 sm:p-6 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Database className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                  <span>Banco de Dados Firebase Conectado</span>
                </div>
                <div className="space-y-1.5 text-xs text-stone-600 dark:text-stone-400">
                  <p className="break-all">
                    Projeto Firebase: <strong className="font-mono text-stone-900 dark:text-stone-100">{FIREBASE_META.projectId}</strong>
                  </p>
                  <p className="break-all">
                    Firestore Database ID: <strong className="font-mono text-stone-900 dark:text-stone-100">{FIREBASE_META.databaseId}</strong>
                  </p>
                  <p className="break-all">
                    Administrador proprietário: <strong className="font-mono text-stone-900 dark:text-stone-100">{profile.email}</strong>
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-4 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <CreditCard className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                    <span>Integração Mercado Pago (R$ 39,90/mês)</span>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      mpStatus?.configured
                        ? mpStatus.environment === 'sandbox'
                          ? 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                    }`}
                  >
                    {mpStatus?.configured
                      ? mpStatus.environment === 'sandbox'
                        ? 'Modo Teste (Sandbox)'
                        : 'Produção Ativa'
                      : 'Aguardando Credenciais'}
                  </span>
                </div>

                {/* Status Checklist for the 3 env vars */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                  {[
                    { key: 'MERCADO_PAGO_ACCESS_TOKEN', ok: Boolean(mpStatus?.configured) },
                    { key: 'MERCADO_PAGO_PUBLIC_KEY', ok: Boolean(mpStatus?.hasPublicKey) },
                    { key: 'MERCADO_PAGO_WEBHOOK_SECRET', ok: Boolean(mpStatus?.hasWebhookSecret) },
                  ].map((item) => (
                    <div
                      key={item.key}
                      className={`rounded-xl border px-3 py-2 flex items-center justify-between gap-2 ${
                        item.ok
                          ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300'
                          : 'border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/50 text-stone-600 dark:text-stone-400'
                      }`}
                    >
                      <span className="font-mono truncate" title={item.key}>
                        {item.key.replace('MERCADO_PAGO_', '')}
                      </span>
                      <span className="font-semibold shrink-0">{item.ok ? 'OK' : 'Falta'}</span>
                    </div>
                  ))}
                </div>

                {/* Webhook URL + 1-click Copy */}
                <div className="space-y-1.5 text-xs">
                  <p className="text-stone-500">URL do Webhook para colar no Painel Mercado Pago Developers:</p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      readOnly
                      value={
                        mpStatus?.webhookEndpoint && mpStatus.webhookEndpoint.startsWith('http')
                          ? mpStatus.webhookEndpoint
                          : `${typeof window !== 'undefined' ? window.location.origin : ''}/api/payments/mercadopago/webhook`
                      }
                      className="flex-1 rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-[#0F1115] px-3 py-1.5 font-mono text-[11px]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const url =
                          mpStatus?.webhookEndpoint && mpStatus.webhookEndpoint.startsWith('http')
                            ? mpStatus.webhookEndpoint
                            : `${window.location.origin}/api/payments/mercadopago/webhook`;
                        navigator.clipboard?.writeText(url);
                        setCopiedWebhook(true);
                        setTimeout(() => setCopiedWebhook(false), 2000);
                      }}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-stone-300 dark:border-stone-700 px-3 py-1.5 text-xs font-medium hover:bg-stone-50 dark:hover:bg-stone-800 cursor-pointer shrink-0"
                    >
                      {copiedWebhook ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedWebhook ? 'Copiado' : 'Copiar Webhook'}</span>
                    </button>
                  </div>
                </div>

                {/* Live Connection Verification */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleTestMercadoPago}
                    disabled={testingMp}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#173526] hover:bg-[#10261B] text-[#FBF2DC] border border-[#DFBE7A]/40 px-4 py-2 text-xs font-semibold cursor-pointer disabled:opacity-60"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-[#DFBE7A] ${testingMp ? 'animate-spin' : ''}`} />
                    <span>{testingMp ? 'Verificando no servidor...' : 'Testar Conexão Mercado Pago'}</span>
                  </button>
                  <p className="text-[11px] text-stone-500">
                    Configure as 3 chaves em <strong>Vercel → Settings → Environment Variables</strong>.
                  </p>
                </div>

                {mpStatus?.liveCheck && (
                  <div
                    className={`rounded-xl border px-3.5 py-2.5 text-xs ${
                      mpStatus.liveCheck.ok
                        ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300'
                        : 'border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-300'
                    }`}
                  >
                    {mpStatus.liveCheck.ok
                      ? `Conexão confirmada com a conta Mercado Pago: ${mpStatus.liveCheck.accountName} (${mpStatus.liveCheck.siteId}). Pix e Cartão prontos!`
                      : mpStatus.liveCheck.error}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
