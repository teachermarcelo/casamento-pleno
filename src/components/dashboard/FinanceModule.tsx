import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CreditCard,
  Download,
  FileSpreadsheet,
  FileText,
  Fingerprint,
  Link2,
  Lock,
  PiggyBank,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  EXPENSE_CATEGORIES,
  type Expense,
  type Guest,
  type UserProfile,
  type Vendor,
  type Wedding,
} from '../../types/wedding';
import {
  abateExpensePayment,
  addExpense,
  deleteExpense,
  updateWedding,
} from '../../lib/weddingService';
import {
  downloadCSV,
  exportCalendarICS,
  exportWeddingReportPDF,
  formatBRL,
  formatDateBR,
  hashPin,
} from '../../lib/utils';

interface FinanceModuleProps {
  profile: UserProfile;
  wedding: Wedding;
  expenses: Expense[];
  vendors: Vendor[];
  guests: Guest[];
  categories?: string[];
  accentColor: string;
}

type PaymentFilterTab = 'all' | 'linked' | 'pending' | 'partial' | 'paid';

const PAYMENT_METHODS = ['Pix', 'Transferência', 'Cartão de Crédito', 'Boleto', 'Dinheiro'];

export const FinanceModule: React.FC<FinanceModuleProps> = ({
  profile,
  wedding,
  expenses,
  vendors,
  guests,
  categories,
  accentColor,
}) => {
  const availableCategories =
    categories && categories.length > 0 ? categories : [...EXPENSE_CATEGORIES];

  // Biometric / PIN vault state
  const [vaultUnlocked, setVaultUnlocked] = useState(!profile.biometricEnabled);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  // Ledger filter tab
  const [filterTab, setFilterTab] = useState<PaymentFilterTab>('all');

  // Add Expense form
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>(availableCategories[0] || EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState('');
  const [paidAmount, setPaidAmount] = useState('0');
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
  );
  const [paymentMethod, setPaymentMethod] = useState('Pix');
  const [saving, setSaving] = useState(false);

  // Abate payment modal
  const [abatingExpense, setAbatingExpense] = useState<Expense | null>(null);
  const [abateValue, setAbateValue] = useState('');
  const [abateDate, setAbateDate] = useState(new Date().toISOString().slice(0, 10));
  const [abateMethod, setAbateMethod] = useState('Pix');
  const [abateSubmitting, setAbateSubmitting] = useState(false);

  // Budget & Savings edit
  const [budgetInput, setBudgetInput] = useState(String(wedding.budgetLimit || 50000));
  const [savingsGoalInput, setSavingsGoalInput] = useState(String(wedding.savingsGoal || 50000));
  const [savingsAdd, setSavingsAdd] = useState('');
  const [importNotice, setImportNotice] = useState('');

  const totals = useMemo(() => {
    const committed = expenses.reduce((s, e) => s + e.amount, 0);
    const paid = expenses.reduce((s, e) => s + e.paidAmount, 0);
    const remainingToPay = Math.max(0, committed - paid);
    const paidPct = committed > 0 ? Math.round((paid / committed) * 100) : 0;
    const budget = wedding.budgetLimit || 0;
    const budgetDiff = budget - committed;
    const budgetPct = budget > 0 ? Math.round((committed / budget) * 100) : 0;
    const savingsGoal = wedding.savingsGoal || budget || 1;
    const savingsCurrent = wedding.savingsCurrent || 0;
    const savingsPct = Math.min(100, Math.round((savingsCurrent / savingsGoal) * 100));

    const denom = Math.max(budget, committed, 1);
    const barPaidPct = Math.min(100, Math.round((paid / denom) * 100));
    const barPendingPct = Math.min(100 - barPaidPct, Math.round((remainingToPay / denom) * 100));

    const linkedCount = expenses.filter((e) => Boolean(e.vendorId)).length;
    const openCount = expenses.filter((e) => e.status !== 'paid').length;
    const partialCount = expenses.filter((e) => e.status === 'partial').length;
    const paidCount = expenses.filter((e) => e.status === 'paid').length;
    const pendingCount = expenses.filter((e) => e.status === 'pending').length;

    return {
      committed,
      paid,
      remainingToPay,
      paidPct,
      budget,
      budgetDiff,
      budgetPct,
      savingsGoal,
      savingsCurrent,
      savingsPct,
      barPaidPct,
      barPendingPct,
      linkedCount,
      openCount,
      partialCount,
      paidCount,
      pendingCount,
    };
  }, [expenses, wedding]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (filterTab === 'linked') return Boolean(e.vendorId);
      if (filterTab === 'pending') return e.status === 'pending';
      if (filterTab === 'partial') return e.status === 'partial';
      if (filterTab === 'paid') return e.status === 'paid';
      return true;
    });
  }, [expenses, filterTab]);

  const upcomingDue = useMemo(() => {
    const daysAhead = profile.notifyDaysBefore ?? 5;
    const now = new Date();
    const limit = new Date();
    limit.setDate(now.getDate() + Math.max(daysAhead, 15));
    return expenses.filter((e) => {
      if (e.status === 'paid') return false;
      const d = new Date(`${e.dueDate}T12:00:00`);
      return !Number.isNaN(d.getTime()) && d <= limit;
    });
  }, [expenses, profile.notifyDaysBefore]);

  const categoryChart = useMemo(() => {
    const map = new Map<string, { category: string; Pago: number; Pendente: number }>();
    expenses.forEach((e) => {
      const short = e.category.split(' ')[0];
      const curr = map.get(short) || { category: short, Pago: 0, Pendente: 0 };
      curr.Pago += e.paidAmount;
      curr.Pendente += Math.max(0, e.amount - e.paidAmount);
      map.set(short, curr);
    });
    return Array.from(map.values());
  }, [expenses]);

  const handleUnlockPin = async (e: React.FormEvent) => {
    e.preventDefault();
    const hashed = await hashPin(pinInput);
    if (!profile.pinHash || hashed === profile.pinHash) {
      setVaultUnlocked(true);
      setPinError('');
    } else {
      setPinError('PIN incorreto. Tente novamente.');
    }
  };

  const handleBiometricUnlock = async () => {
    try {
      if (window.PublicKeyCredential && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())) {
        setVaultUnlocked(true);
        return;
      }
      setPinError('Biometria nativa indisponível neste navegador. Use seu PIN de 4 dígitos.');
    } catch {
      setPinError('Use seu PIN de 4 dígitos para desbloquear.');
    }
  };

  if (profile.biometricEnabled && !vaultUnlocked) {
    return (
      <div className="max-w-md mx-auto my-12 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800">
          <Lock className="w-5 h-5" />
        </div>
        <h2 className="mt-4 font-editorial text-3xl font-semibold">Cofre Financeiro Protegido</h2>
        <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
          Valide sua biometria ou informe seu PIN para acessar os dados financeiros do casamento.
        </p>

        <button
          type="button"
          onClick={handleBiometricUnlock}
          style={{ backgroundColor: accentColor }}
          className="mt-6 w-full inline-flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-white rounded-lg cursor-pointer"
        >
          <Fingerprint className="w-4 h-4" />
          <span>Desbloquear com Biometria do Aparelho</span>
        </button>

        <form onSubmit={handleUnlockPin} className="mt-5 pt-5 border-t border-stone-200 dark:border-stone-800 space-y-3">
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            placeholder="Ou digite seu PIN"
            className="w-full text-center font-mono tracking-[0.4em] rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-sm"
          />
          {pinError && <p className="text-xs text-red-600">{pinError}</p>}
          <button
            type="submit"
            className="w-full py-2 text-xs font-semibold rounded-lg border border-stone-300 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 cursor-pointer"
          >
            Validar PIN
          </button>
        </form>
      </div>
    );
  }

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !amount) return;
    setSaving(true);
    try {
      await addExpense(wedding.id, wedding.ownerId, {
        title,
        category,
        amount: Number(amount),
        paidAmount: Number(paidAmount) || 0,
        dueDate,
        paymentMethod,
      });
      setTitle('');
      setAmount('');
      setPaidAmount('0');
    } finally {
      setSaving(false);
    }
  };

  const openAbateExpense = (exp: Expense) => {
    const remaining = Math.max(0, exp.amount - exp.paidAmount);
    setAbatingExpense(exp);
    setAbateValue(String(Math.round(remaining * 100) / 100));
    setAbateDate(new Date().toISOString().slice(0, 10));
    setAbateMethod(exp.paymentMethod || 'Pix');
  };

  const handleAbateExpenseSubmit = async (e: React.FormEvent, mode: 'partial' | 'full') => {
    e.preventDefault();
    if (!abatingExpense) return;
    const remaining = Math.max(0, abatingExpense.amount - abatingExpense.paidAmount);
    const amountToAbate = mode === 'full' ? remaining : Math.max(0, Number(abateValue) || 0);
    if (amountToAbate <= 0) return;

    setAbateSubmitting(true);
    try {
      const linkedVendor = abatingExpense.vendorId
        ? vendors.find((v) => v.id === abatingExpense.vendorId)
        : undefined;
      await abateExpensePayment({
        weddingId: wedding.id,
        expense: abatingExpense,
        linkedVendor,
        amountToAbate,
        paymentDate: abateDate,
        paymentMethod: abateMethod,
      });
      setAbatingExpense(null);
    } finally {
      setAbateSubmitting(false);
    }
  };

  const handleSaveGoals = async () => {
    const deposit = Number(savingsAdd) || 0;
    await updateWedding(wedding.id, {
      budgetLimit: Number(budgetInput) || 0,
      savingsGoal: Number(savingsGoalInput) || 0,
      savingsCurrent: (wedding.savingsCurrent || 0) + deposit,
    });
    setSavingsAdd('');
  };

  const handleBankCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    let imported = 0;
    for (const line of lines.slice(1, 15)) {
      const cols = line.split(/[;,]/).map((c) => c.replace(/^"|"$/g, '').trim());
      if (cols.length >= 2) {
        const rawAmount = Number(cols[cols.length - 1].replace(/[^0-9.,-]/g, '').replace(',', '.'));
        const desc = cols.find((c) => /[a-zA-Z]/.test(c)) || 'Lançamento Bancário';
        if (Number.isFinite(rawAmount) && Math.abs(rawAmount) > 0) {
          await addExpense(wedding.id, wedding.ownerId, {
            title: desc.slice(0, 120),
            category: 'Outros',
            amount: Math.abs(rawAmount),
            paidAmount: Math.abs(rawAmount),
            dueDate: new Date().toISOString().slice(0, 10),
            bankSynced: true,
            notes: `Importado de ${file.name}`,
          });
          imported++;
        }
      }
    }
    setImportNotice(
      imported > 0
        ? `${imported} transações sincronizadas com sucesso a partir do extrato.`
        : 'Nenhuma transação numérica encontrada. Use CSV com colunas Descrição;Valor.'
    );
    e.target.value = '';
  };

  const handleExportPaymentsCalendar = () => {
    exportCalendarICS({
      filename: `vencimentos-${wedding.slug}.ics`,
      events: expenses
        .filter((e) => e.status !== 'paid')
        .map((e) => ({
          title: `Pagamento Casamento: ${e.title} (${formatBRL(e.amount - e.paidAmount)})`,
          date: e.dueDate,
          time: '09:00',
          description: `Categoria: ${e.category}`,
        })),
    });
  };

  const handleExportCSV = () => {
    downloadCSV(
      `pagamentos-${wedding.slug}.csv`,
      ['Serviço / Descrição', 'Categoria', 'Vencimento', 'Último Pagamento', 'Valor Total', 'Valor Pago', 'Pendente', 'Status', 'Origem'],
      expenses.map((e) => [
        e.title,
        e.category,
        e.dueDate,
        e.lastPaymentDate || '',
        e.amount.toFixed(2),
        e.paidAmount.toFixed(2),
        Math.max(0, e.amount - e.paidAmount).toFixed(2),
        e.status === 'paid' ? 'Pago' : e.status === 'partial' ? 'Parcial' : 'Pendente',
        e.vendorId ? 'Fornecedor conectado' : e.bankSynced ? 'Extrato bancário' : 'Manual',
      ])
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-editorial text-3xl font-semibold">Pagamentos & Orçamento Conectado</h2>
          <p className="text-sm text-stone-600 dark:text-stone-400">
            Conectado aos fornecedores cadastrados: abata valores parciais ou totais aqui e tudo sincroniza em tempo real.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => exportWeddingReportPDF({ wedding, guests, expenses })}
            className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#171A21] px-3 py-2 text-xs font-medium hover:bg-stone-50 dark:hover:bg-stone-800 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Relatório PDF</span>
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#171A21] px-3 py-2 text-xs font-medium hover:bg-stone-50 dark:hover:bg-stone-800 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
          <button
            type="button"
            onClick={handleExportPaymentsCalendar}
            className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#171A21] px-3 py-2 text-xs font-medium hover:bg-stone-50 dark:hover:bg-stone-800 cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Agenda (.ics)</span>
          </button>
        </div>
      </div>

      {/* Upcoming Due Alert */}
      {upcomingDue.length > 0 && (
        <div className="rounded-2xl border border-amber-300/80 dark:border-amber-800 bg-amber-50/75 dark:bg-amber-950/30 p-3.5 sm:p-4 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 dark:text-amber-200 min-w-0">
            <p className="font-semibold">
              {upcomingDue.length} pagamento(s) com vencimento próximo ou pendente
            </p>
            <p className="mt-0.5 opacity-90">
              Próximo: {upcomingDue[0].title} ({formatDateBR(upcomingDue[0].dueDate)}) — saldo de{' '}
              {formatBRL(Math.max(0, upcomingDue[0].amount - upcomingDue[0].paidAmount))}.
            </p>
          </div>
        </div>
      )}

      {/* Richer Color-Coded Financial KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-3.5 sm:p-5 min-w-0">
          <p className="text-[11px] sm:text-xs font-medium text-stone-500 truncate">Valor Contratado</p>
          <p className="mt-1.5 sm:mt-2 font-mono text-base sm:text-2xl font-semibold tabular-nums text-stone-900 dark:text-stone-100 truncate">
            {formatBRL(totals.committed)}
          </p>
          <p className={`mt-1 sm:mt-1.5 text-[11px] sm:text-xs font-mono tabular-nums leading-snug ${totals.budgetPct > 100 ? 'text-red-600' : 'text-stone-500'}`}>
            {totals.budgetPct}% do teto ({formatBRL(totals.budget)})
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/75 dark:bg-emerald-950/25 p-3.5 sm:p-5 min-w-0">
          <p className="text-[11px] sm:text-xs font-medium text-emerald-800 dark:text-emerald-300 truncate">Valor Pago</p>
          <p className="mt-1.5 sm:mt-2 font-mono text-base sm:text-2xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-400 truncate">
            {formatBRL(totals.paid)}
          </p>
          <p className="mt-1 sm:mt-1.5 text-[11px] sm:text-xs text-emerald-800/80 dark:text-emerald-300/80 tabular-nums leading-snug">
            {totals.paidPct}% · {totals.paidCount} pago(s)
          </p>
        </div>

        <div className="rounded-2xl border border-amber-200/80 dark:border-amber-900/60 bg-amber-50/75 dark:bg-amber-950/25 p-3.5 sm:p-5 min-w-0">
          <p className="text-[11px] sm:text-xs font-medium text-amber-900 dark:text-amber-300 truncate">Valor Pendente</p>
          <p className="mt-1.5 sm:mt-2 font-mono text-base sm:text-2xl font-semibold tabular-nums text-amber-700 dark:text-amber-400 truncate">
            {formatBRL(totals.remainingToPay)}
          </p>
          <p className="mt-1 sm:mt-1.5 text-[11px] sm:text-xs text-amber-900/80 dark:text-amber-300/80 leading-snug">
            {totals.openCount} em aberto ({totals.partialCount} parciais)
          </p>
        </div>

        <div
          className={`rounded-2xl border p-3.5 sm:p-5 min-w-0 ${
            totals.budgetDiff >= 0
              ? 'border-stone-200 dark:border-stone-800 bg-[#FAF7F2] dark:bg-[#171A21]'
              : 'border-red-200 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/25'
          }`}
        >
          <p className="text-[11px] sm:text-xs font-medium text-stone-600 dark:text-stone-400 truncate">
            {totals.budgetDiff >= 0 ? 'Margem Livre' : 'Acima do Teto'}
          </p>
          <p
            className={`mt-1.5 sm:mt-2 font-mono text-base sm:text-2xl font-semibold tabular-nums truncate ${
              totals.budgetDiff >= 0 ? 'text-stone-900 dark:text-stone-100' : 'text-red-700 dark:text-red-400'
            }`}
          >
            {formatBRL(Math.abs(totals.budgetDiff))}
          </p>
          <p className="mt-1 sm:mt-1.5 text-[11px] sm:text-xs text-stone-500 tabular-nums truncate">
            Reserva: {formatBRL(totals.savingsCurrent)} ({totals.savingsPct}%)
          </p>
        </div>
      </div>

      {/* Segmented Visual Bar: Pago vs Pendente vs Livre */}
      <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-stone-800 dark:text-stone-200">
            Distribuição Visual do Orçamento ({formatBRL(Math.max(totals.budget, totals.committed))})
          </span>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-stone-600 dark:text-stone-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-600" />
              Pago ({formatBRL(totals.paid)})
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" />
              Pendente ({formatBRL(totals.remainingToPay)})
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-stone-200 dark:bg-stone-700" />
              Disponível ({formatBRL(Math.max(0, totals.budgetDiff))})
            </span>
          </div>
        </div>
        <div className="h-3 w-full rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden flex">
          <div
            className="h-full bg-emerald-600 transition-all duration-500"
            style={{ width: `${totals.barPaidPct}%` }}
          />
          <div
            className="h-full bg-amber-500 transition-all duration-500"
            style={{ width: `${totals.barPendingPct}%` }}
          />
        </div>
      </div>

      {/* Savings Goal + Category Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <PiggyBank className="w-4 h-4" style={{ color: accentColor }} />
            <span>Metas de Economia & Limite</span>
          </div>

          <div className="h-2 w-full rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${totals.savingsPct}%`, backgroundColor: accentColor }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-stone-500 mb-1">Orçamento Limite (R$)</label>
              <input
                type="number"
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-1.5 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Meta de Economia (R$)</label>
              <input
                type="number"
                value={savingsGoalInput}
                onChange={(e) => setSavingsGoalInput(e.target.value)}
                className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-1.5 text-sm font-mono"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="number"
              value={savingsAdd}
              onChange={(e) => setSavingsAdd(e.target.value)}
              placeholder="Adicionar aporte (R$)"
              className="flex-1 rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-1.5 text-sm font-mono"
            />
            <button
              type="button"
              onClick={handleSaveGoals}
              style={{ backgroundColor: accentColor }}
              className="px-4 py-1.5 text-xs font-semibold text-white rounded-lg cursor-pointer"
            >
              Atualizar
            </button>
          </div>

          <div className="pt-4 border-t border-stone-200 dark:border-stone-800">
            <label className="inline-flex items-center gap-2 text-xs font-medium text-stone-700 dark:text-stone-300 cursor-pointer hover:underline">
              <Upload className="w-3.5 h-3.5" />
              <span>Importar extrato bancário (CSV / OFX)</span>
              <input type="file" accept=".csv,.ofx,.txt" onChange={handleBankCsvUpload} className="hidden" />
            </label>
            {importNotice && <p className="mt-1.5 text-xs text-emerald-700 dark:text-emerald-400">{importNotice}</p>}
          </div>
        </div>

        <div className="lg:col-span-7 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-4 sm:p-5">
          <p className="text-xs font-medium text-stone-500 mb-3">Pagamentos por Categoria (Pago vs Pendente)</p>
          <div className="h-56 w-full">
            {categoryChart.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-stone-400 text-center px-4">
                Adicione despesas ou fornecedores para visualizar o gráfico financeiro.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryChart} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                  <XAxis dataKey="category" tick={{ fontSize: 10, fill: '#78716C' }} axisLine={false} tickLine={false} />
                  <YAxis
                    width={46}
                    tickFormatter={(v) => (Number(v) >= 1000 ? `${Math.round(Number(v) / 1000)}k` : String(v))}
                    tick={{ fontSize: 10, fill: '#78716C' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip formatter={(val) => formatBRL(Number(val) || 0)} />
                  <Bar dataKey="Pago" stackId="a" fill="#15803D" radius={[0, 0, 4, 4]} maxBarSize={36} />
                  <Bar dataKey="Pendente" stackId="a" fill="#F59E0B" radius={[4, 4, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Add Manual Expense Form */}
      <form
        onSubmit={handleAddExpense}
        className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-4 sm:p-5 grid grid-cols-2 md:grid-cols-12 gap-3 items-end"
      >
        <div className="col-span-2 md:col-span-3">
          <label className="block text-xs text-stone-500 mb-1">Novo Lançamento Avulso</label>
          <input
            required
            maxLength={140}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: Vestido da Noiva"
            className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-sm"
          />
        </div>
        <div className="col-span-2 md:col-span-2">
          <label className="block text-xs text-stone-500 mb-1">Categoria</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#171A21] px-2.5 py-2 text-sm"
          >
            {availableCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs text-stone-500 mb-1">Valor Total (R$)</label>
          <input
            type="number"
            required
            min={0}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-sm font-mono"
          />
        </div>
        <div className="md:col-span-1">
          <label className="block text-xs text-stone-500 mb-1">Pago (R$)</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={paidAmount}
            onChange={(e) => setPaidAmount(e.target.value)}
            className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-2.5 py-2 text-sm font-mono"
          />
        </div>
        <div className="md:col-span-1">
          <label className="block text-xs text-stone-500 mb-1">Forma</label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#171A21] px-2 py-2 text-xs"
          >
            {PAYMENT_METHODS.map((pm) => (
              <option key={pm} value={pm}>
                {pm}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-1">
          <label className="block text-xs text-stone-500 mb-1">Venc.</label>
          <input
            type="date"
            required
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-2 py-2 text-xs font-mono"
          />
        </div>
        <div className="col-span-2 md:col-span-2">
          <button
            type="submit"
            disabled={saving}
            style={{ backgroundColor: accentColor }}
            className="w-full min-h-[42px] inline-flex items-center justify-center gap-1.5 py-2 px-3 text-sm font-medium text-white rounded-lg cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Lançar</span>
          </button>
        </div>
      </form>

      {/* Filter Tabs on Payments Ledger */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar max-w-full rounded-xl bg-stone-200/70 dark:bg-stone-800/80 p-1">
          {(
            [
              ['all', `Todos (${expenses.length})`],
              ['linked', `Fornecedores (${totals.linkedCount})`],
              ['pending', `Pendentes (${totals.pendingCount})`],
              ['partial', `Parciais (${totals.partialCount})`],
              ['paid', `Pagos (${totals.paidCount})`],
            ] as const
          ).map(([tabKey, label]) => (
            <button
              key={tabKey}
              type="button"
              onClick={() => setFilterTab(tabKey)}
              className={`shrink-0 whitespace-nowrap min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                filterTab === tabKey
                  ? 'bg-white dark:bg-[#1C2029] text-stone-900 dark:text-stone-100 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Connected Payments Ledger: Mobile Cards + Desktop Table */}
      <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] overflow-hidden">
        <div className="md:hidden divide-y divide-stone-100 dark:divide-stone-800/80">
          {filteredExpenses.length === 0 ? (
            <div className="py-8 px-4 text-center text-xs text-stone-500">
              Nenhum pagamento encontrado neste filtro.
            </div>
          ) : (
            filteredExpenses.map((exp) => {
              const pendingVal = Math.max(0, exp.amount - exp.paidAmount);
              return (
                <div key={exp.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-stone-900 dark:text-stone-100 break-words">
                        {exp.title}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-stone-500 mt-0.5">
                        <span>{exp.category}</span>
                        {exp.vendorId && (
                          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                            <Link2 className="w-3 h-3" /> Fornecedor
                          </span>
                        )}
                        <span>· Venc. {formatDateBR(exp.dueDate)}</span>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                        exp.status === 'paid'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                          : exp.status === 'partial'
                          ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400'
                          : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
                      }`}
                    >
                      {exp.status === 'paid' ? 'Pago' : exp.status === 'partial' ? 'Parcial' : 'Pendente'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 rounded-xl bg-stone-50 dark:bg-stone-900/50 border border-stone-200/70 dark:border-stone-800 p-2.5 text-[11px]">
                    <div className="min-w-0">
                      <p className="text-stone-500">Total</p>
                      <p className="font-mono font-semibold tabular-nums truncate">{formatBRL(exp.amount)}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-stone-500">Pago</p>
                      <p className="font-mono font-semibold tabular-nums text-emerald-700 dark:text-emerald-400 truncate">
                        {formatBRL(exp.paidAmount)}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-stone-500">Pendente</p>
                      <p className="font-mono font-semibold tabular-nums text-amber-700 dark:text-amber-400 truncate">
                        {formatBRL(pendingVal)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {pendingVal > 0 ? (
                      <button
                        type="button"
                        onClick={() => openAbateExpense(exp)}
                        style={{ backgroundColor: accentColor }}
                        className="flex-1 min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white hover:brightness-110 cursor-pointer"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>Abater Pagamento</span>
                      </button>
                    ) : (
                      <span className="flex-1 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                        Quitado {exp.lastPaymentDate ? `em ${formatDateBR(exp.lastPaymentDate)}` : ''}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => deleteExpense(wedding.id, exp.id)}
                      title="Excluir lançamento"
                      className="h-10 w-10 shrink-0 flex items-center justify-center rounded-lg border border-stone-200 dark:border-stone-700 text-stone-400 hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-stone-200 dark:border-stone-800 text-xs text-stone-500">
              <th className="py-3.5 px-4 font-medium">Serviço / Despesa</th>
              <th className="py-3.5 px-4 font-medium">Vencimento</th>
              <th className="py-3.5 px-4 font-medium">Último Pgto</th>
              <th className="py-3.5 px-4 font-medium text-right">Total</th>
              <th className="py-3.5 px-4 font-medium text-right">Pago</th>
              <th className="py-3.5 px-4 font-medium text-right">Pendente</th>
              <th className="py-3.5 px-4 font-medium">Status</th>
              <th className="py-3.5 px-4 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 dark:divide-stone-800/80">
            {filteredExpenses.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-xs text-stone-500">
                  Nenhum pagamento encontrado neste filtro.
                </td>
              </tr>
            ) : (
              filteredExpenses.map((exp) => {
                const pendingVal = Math.max(0, exp.amount - exp.paidAmount);
                return (
                  <tr key={exp.id} className="hover:bg-stone-50/70 dark:hover:bg-stone-800/30">
                    <td className="py-3.5 px-4">
                      <p className="font-medium text-stone-900 dark:text-stone-100">{exp.title}</p>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-stone-500 mt-0.5">
                        <span>{exp.category}</span>
                        {exp.vendorId && (
                          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                            <Link2 className="w-3 h-3" /> Fornecedor conectado
                          </span>
                        )}
                        {exp.bankSynced && <span>· Extrato bancário</span>}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs font-mono tabular-nums text-stone-600 dark:text-stone-400">
                      {formatDateBR(exp.dueDate)}
                    </td>
                    <td className="py-3.5 px-4 text-xs font-mono tabular-nums text-stone-600 dark:text-stone-400">
                      {formatDateBR(exp.lastPaymentDate)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-medium">
                      {formatBRL(exp.amount)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400 font-medium">
                      {formatBRL(exp.paidAmount)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-amber-700 dark:text-amber-400 font-medium">
                      {formatBRL(pendingVal)}
                    </td>
                    <td className="py-3.5 px-4 text-xs font-semibold">
                      <span
                        className={
                          exp.status === 'paid'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : exp.status === 'partial'
                            ? 'text-amber-700 dark:text-amber-400'
                            : 'text-stone-500 dark:text-stone-400'
                        }
                      >
                        {exp.status === 'paid' ? 'Pago' : exp.status === 'partial' ? 'Parcial' : 'Pendente'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {pendingVal > 0 && (
                          <button
                            type="button"
                            onClick={() => openAbateExpense(exp)}
                            style={{ backgroundColor: accentColor }}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-white hover:brightness-110 cursor-pointer"
                          >
                            <CreditCard className="w-3 h-3" />
                            <span>Abater</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => deleteExpense(wedding.id, exp.id)}
                          title="Excluir lançamento"
                          className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() =>
            downloadCSV(
              `metas-${wedding.slug}.csv`,
              ['Orçamento', 'Comprometido', 'Pago', 'Pendente', 'Meta Economia', 'Guardado'],
              [[totals.budget, totals.committed, totals.paid, totals.remainingToPay, totals.savingsGoal, totals.savingsCurrent]]
            )
          }
          className="inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Baixar resumo de metas (CSV)</span>
        </button>
      </div>

      {/* Abater Pagamento (Parcial / Total) Modal */}
      {abatingExpense && (() => {
        const remaining = Math.max(0, abatingExpense.amount - abatingExpense.paidAmount);
        return (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 p-0 sm:p-4 backdrop-blur-xs"
            role="dialog"
            aria-modal="true"
          >
            <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-5 sm:p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium" style={{ color: accentColor }}>
                    {abatingExpense.vendorId ? 'Abater & Sincronizar com Fornecedor' : 'Abater Pagamento'}
                  </p>
                  <h3 className="mt-1 font-editorial text-2xl font-semibold break-words">{abatingExpense.title}</h3>
                  <p className="text-xs text-stone-500">{abatingExpense.category}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAbatingExpense(null)}
                  className="h-10 w-10 shrink-0 flex items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 rounded-xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 p-3.5 text-xs">
                <div>
                  <p className="text-stone-500">Valor Total</p>
                  <p className="font-mono font-semibold tabular-nums mt-0.5">{formatBRL(abatingExpense.amount)}</p>
                </div>
                <div>
                  <p className="text-stone-500">Já Pago</p>
                  <p className="font-mono font-semibold tabular-nums text-emerald-700 dark:text-emerald-400 mt-0.5">
                    {formatBRL(abatingExpense.paidAmount)}
                  </p>
                </div>
                <div>
                  <p className="text-stone-500">Pendente</p>
                  <p className="font-mono font-semibold tabular-nums text-amber-700 dark:text-amber-400 mt-0.5">
                    {formatBRL(remaining)}
                  </p>
                </div>
              </div>

              <form onSubmit={(e) => handleAbateExpenseSubmit(e, 'partial')} className="space-y-4">
                <div>
                  <label className="block text-xs text-stone-500 mb-1">Valor a abater agora (R$)</label>
                  <input
                    type="number"
                    required
                    min={0.01}
                    max={remaining}
                    step="0.01"
                    value={abateValue}
                    onChange={(e) => setAbateValue(e.target.value)}
                    className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-sm font-mono"
                  />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {[0.25, 0.5, 1].map((ratio) => {
                      const suggested = Math.round(remaining * ratio * 100) / 100;
                      return (
                        <button
                          key={ratio}
                          type="button"
                          onClick={() => setAbateValue(String(suggested))}
                          className="rounded-md border border-stone-200 dark:border-stone-700 px-2.5 py-1 text-[11px] font-mono text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                        >
                          {ratio === 1 ? 'Total restante' : `${Math.round(ratio * 100)}% (${formatBRL(suggested)})`}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-stone-500 mb-1">Data do Pagamento</label>
                    <input
                      type="date"
                      required
                      value={abateDate}
                      onChange={(e) => setAbateDate(e.target.value)}
                      className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-stone-500 mb-1">Forma</label>
                    <select
                      value={abateMethod}
                      onChange={(e) => setAbateMethod(e.target.value)}
                      className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#171A21] px-2.5 py-2 text-xs"
                    >
                      {PAYMENT_METHODS.map((pm) => (
                        <option key={pm} value={pm}>
                          {pm}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                  <button
                    type="submit"
                    disabled={abateSubmitting}
                    className="min-h-[44px] py-2.5 px-3 text-xs font-semibold rounded-lg border border-stone-300 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 cursor-pointer disabled:opacity-60"
                  >
                    Abater Parcial
                  </button>
                  <button
                    type="button"
                    disabled={abateSubmitting}
                    onClick={(e) => handleAbateExpenseSubmit(e, 'full')}
                    style={{ backgroundColor: accentColor }}
                    className="min-h-[44px] py-2.5 px-3 text-xs font-semibold text-white rounded-lg hover:brightness-110 cursor-pointer disabled:opacity-60"
                  >
                    Quitar Total ({formatBRL(remaining)})
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
