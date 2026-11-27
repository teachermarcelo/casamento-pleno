import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  Check,
  CheckSquare,
  CreditCard,
  Gift,
  GripVertical,
  Link2,
  Pencil,
  Plus,
  Redo2,
  Search,
  Square,
  Trash2,
  Undo2,
  Upload,
  X,
} from 'lucide-react';
import {
  EXPENSE_CATEGORIES,
  type Expense,
  type GiftContribution,
  type GiftItem,
  type PartyMember,
  type ScheduleItem,
  type Vendor,
  type Wedding,
} from '../../types/wedding';
import {
  abateVendorPayment,
  addGiftItem,
  addPartyMember,
  addScheduleItem,
  addVendor,
  confirmGiftContribution,
  deleteGiftItem,
  deletePartyMember,
  deleteScheduleItem,
  deleteVendor,
  reorderPartyMembers,
  reorderScheduleItems,
  updateGiftItem,
  updatePartyMember,
  updateScheduleItem,
  updateVendor,
} from '../../lib/weddingService';
import {
  buildWeddingDayICS,
  compressImageToDataUrl,
  formatBRL,
  formatDateBR,
} from '../../lib/utils';
import { SafeImage } from '../SafeImage';

interface VendorsModuleProps {
  wedding: Wedding;
  vendors: Vendor[];
  expenses: Expense[];
  categories?: string[];
  accentColor: string;
}

type VendorStatusTab = 'all' | 'paid' | 'partial' | 'pending';

const PAYMENT_METHODS = ['Pix', 'Transferência', 'Cartão de Crédito', 'Boleto', 'Dinheiro'];

function resolveVendorPaid(vendor: Vendor, linkedExpense?: Expense): number {
  if (typeof vendor.paidAmount === 'number') return vendor.paidAmount;
  if (linkedExpense) return linkedExpense.paidAmount;
  if (vendor.paymentStatus === 'paid') return vendor.contractValue;
  return 0;
}

function resolveVendorBucket(vendor: Vendor, paid: number): 'paid' | 'partial' | 'pending' {
  if (vendor.contractValue > 0 && paid >= vendor.contractValue) return 'paid';
  if (vendor.paymentStatus === 'paid' && vendor.contractValue === 0) return 'paid';
  if (paid > 0 || vendor.paymentStatus === 'deposit_paid') return 'partial';
  return 'pending';
}

export const VendorsModule: React.FC<VendorsModuleProps> = ({
  wedding,
  vendors,
  expenses,
  categories,
  accentColor,
}) => {
  const availableCategories =
    categories && categories.length > 0 ? categories : [...EXPENSE_CATEGORIES];

  const [statusTab, setStatusTab] = useState<VendorStatusTab>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // Add vendor form state
  const [name, setName] = useState('');
  const [service, setService] = useState(availableCategories[0] || 'Buffet & Gastronomia');
  const [contact, setContact] = useState('');
  const [contractValue, setContractValue] = useState('');
  const [paidAmount, setPaidAmount] = useState('0');
  const [installmentsTotal, setInstallmentsTotal] = useState('1');
  const [nextDueDate, setNextDueDate] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
  );
  const [paymentMethod, setPaymentMethod] = useState('Pix');
  const [saving, setSaving] = useState(false);

  // Abatement modal state
  const [abatingVendor, setAbatingVendor] = useState<Vendor | null>(null);
  const [abateAmount, setAbateAmount] = useState('');
  const [abateDate, setAbateDate] = useState(new Date().toISOString().slice(0, 10));
  const [abateMethod, setAbateMethod] = useState('Pix');
  const [abateNextDue, setAbateNextDue] = useState('');
  const [abateSubmitting, setAbateSubmitting] = useState(false);

  const enrichedVendors = useMemo(() => {
    return vendors.map((v) => {
      const linkedExpense = expenses.find((e) => e.vendorId === v.id);
      const paid = resolveVendorPaid(v, linkedExpense);
      const pending = Math.max(0, v.contractValue - paid);
      const bucket = resolveVendorBucket(v, paid);
      const pct = v.contractValue > 0 ? Math.min(100, Math.round((paid / v.contractValue) * 100)) : bucket === 'paid' ? 100 : 0;
      return {
        vendor: v,
        linkedExpense,
        paid,
        pending,
        bucket,
        pct,
        lastDate: v.lastPaymentDate || linkedExpense?.lastPaymentDate || '',
        dueDate: v.nextDueDate || linkedExpense?.dueDate || '',
        method: v.paymentMethod || linkedExpense?.paymentMethod || 'Pix',
      };
    });
  }, [vendors, expenses]);

  const summary = useMemo(() => {
    const totalContract = enrichedVendors.reduce((s, item) => s + item.vendor.contractValue, 0);
    const totalPaid = enrichedVendors.reduce((s, item) => s + item.paid, 0);
    const totalPending = enrichedVendors.reduce((s, item) => s + item.pending, 0);
    const pctPaid = totalContract > 0 ? Math.round((totalPaid / totalContract) * 100) : 0;
    const counts = {
      all: enrichedVendors.length,
      paid: enrichedVendors.filter((i) => i.bucket === 'paid').length,
      partial: enrichedVendors.filter((i) => i.bucket === 'partial').length,
      pending: enrichedVendors.filter((i) => i.bucket === 'pending').length,
      checklistDone: enrichedVendors.filter((i) => i.vendor.checklistDone).length,
    };
    return { totalContract, totalPaid, totalPending, pctPaid, counts };
  }, [enrichedVendors]);

  const filteredVendors = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return enrichedVendors.filter((item) => {
      if (statusTab !== 'all' && item.bucket !== statusTab) return false;
      if (!q) return true;
      return (
        item.vendor.name.toLowerCase().includes(q) ||
        item.vendor.service.toLowerCase().includes(q) ||
        (item.vendor.contact || '').toLowerCase().includes(q)
      );
    });
  }, [enrichedVendors, statusTab, searchTerm]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const totalVal = Math.max(0, Number(contractValue) || 0);
      const paidVal = Math.min(totalVal, Math.max(0, Number(paidAmount) || 0));
      const todayIso = new Date().toISOString().slice(0, 10);
      await addVendor(wedding.id, wedding.ownerId, {
        name,
        service,
        contact,
        contractValue: totalVal,
        paidAmount: paidVal,
        lastPaymentDate: paidVal > 0 ? todayIso : '',
        nextDueDate,
        paymentMethod,
        installmentsTotal: Math.max(1, Number(installmentsTotal) || 1),
        installmentsPaid: paidVal >= totalVal && totalVal > 0 ? Math.max(1, Number(installmentsTotal) || 1) : paidVal > 0 ? 1 : 0,
        checklistDone: false,
        syncToPayments: true,
      });
      setName('');
      setContact('');
      setContractValue('');
      setPaidAmount('0');
      setInstallmentsTotal('1');
      setShowAddForm(false);
    } finally {
      setSaving(false);
    }
  };

  const openAbateModal = (vendor: Vendor, pendingVal: number, currentDue: string, currentMethod: string) => {
    setAbatingVendor(vendor);
    setAbateAmount(pendingVal > 0 ? String(Math.round(pendingVal * 100) / 100) : '');
    setAbateDate(new Date().toISOString().slice(0, 10));
    setAbateMethod(currentMethod || 'Pix');
    setAbateNextDue(currentDue || '');
  };

  const handleAbateSubmit = async (e: React.FormEvent, mode: 'custom' | 'full') => {
    e.preventDefault();
    if (!abatingVendor) return;
    const linked = expenses.find((ex) => ex.vendorId === abatingVendor.id);
    const paid = resolveVendorPaid(abatingVendor, linked);
    const pending = Math.max(0, abatingVendor.contractValue - paid);
    const valueToApply = mode === 'full' ? pending : Math.max(0, Number(abateAmount) || 0);
    if (valueToApply <= 0) return;

    setAbateSubmitting(true);
    try {
      await abateVendorPayment({
        weddingId: wedding.id,
        vendor: abatingVendor,
        linkedExpense: linked,
        amountToAbate: valueToApply,
        paymentDate: abateDate,
        paymentMethod: abateMethod,
        nextDueDate: abateNextDue,
      });
      setAbatingVendor(null);
    } finally {
      setAbateSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-editorial text-3xl font-semibold">Fornecedores & Pagamentos</h2>
          <p className="text-sm text-stone-600 dark:text-stone-400">
            Cada fornecedor cadastrado sincroniza automaticamente com a área de Pagamentos para controle de sinal, parcelas e quitação.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddForm((prev) => !prev)}
          style={{ backgroundColor: accentColor }}
          className="min-h-[42px] w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white rounded-xl hover:brightness-110 transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>{showAddForm ? 'Fechar formulário' : 'Novo Fornecedor / Serviço'}</span>
        </button>
      </div>

      {/* 4 Detailed Color-Coded Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-3.5 sm:p-5 min-w-0">
          <p className="text-[11px] sm:text-xs font-medium text-stone-500 truncate">Total Contratado</p>
          <p className="mt-1.5 sm:mt-2 font-mono text-base sm:text-2xl font-semibold tabular-nums text-stone-900 dark:text-stone-100 truncate">
            {formatBRL(summary.totalContract)}
          </p>
          <p className="mt-1 sm:mt-1.5 text-[11px] sm:text-xs text-stone-500 leading-snug">
            {summary.counts.all} forn. · {summary.counts.checklistDone} OK
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/25 p-3.5 sm:p-5 min-w-0">
          <p className="text-[11px] sm:text-xs font-medium text-emerald-800 dark:text-emerald-300 truncate">Valor Pago</p>
          <p className="mt-1.5 sm:mt-2 font-mono text-base sm:text-2xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-400 truncate">
            {formatBRL(summary.totalPaid)}
          </p>
          <p className="mt-1 sm:mt-1.5 text-[11px] sm:text-xs text-emerald-800/80 dark:text-emerald-300/80 tabular-nums leading-snug">
            {summary.pctPaid}% · {summary.counts.paid} quitado(s)
          </p>
        </div>

        <div className="rounded-2xl border border-amber-200/80 dark:border-amber-900/60 bg-amber-50/75 dark:bg-amber-950/25 p-3.5 sm:p-5 min-w-0">
          <p className="text-[11px] sm:text-xs font-medium text-amber-900 dark:text-amber-300 truncate">Valor Pendente</p>
          <p className="mt-1.5 sm:mt-2 font-mono text-base sm:text-2xl font-semibold tabular-nums text-amber-700 dark:text-amber-400 truncate">
            {formatBRL(summary.totalPending)}
          </p>
          <p className="mt-1 sm:mt-1.5 text-[11px] sm:text-xs text-amber-900/80 dark:text-amber-300/80 leading-snug">
            {summary.counts.partial} parc. · {summary.counts.pending} pend.
          </p>
        </div>

        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-[#FBF9F5] dark:bg-[#171A21] p-3.5 sm:p-5 flex flex-col justify-between min-w-0">
          <div className="flex items-center justify-between gap-2 text-[11px] sm:text-xs">
            <span className="font-medium text-stone-600 dark:text-stone-400 truncate">Quitado</span>
            <span className="font-mono font-semibold tabular-nums shrink-0" style={{ color: accentColor }}>
              {summary.pctPaid}%
            </span>
          </div>
          <div className="mt-2.5 sm:mt-3 h-2.5 w-full rounded-full bg-stone-200/80 dark:bg-stone-800 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${summary.pctPaid}%`, backgroundColor: '#15803D' }}
            />
          </div>
          <p className="mt-2 text-[11px] sm:text-xs text-stone-500 truncate">
            Sincronizado com Pagamentos
          </p>
        </div>
      </div>

      {/* Collapsible Add Vendor Form */}
      {showAddForm && (
        <form
          onSubmit={handleAdd}
          className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-4 sm:p-6 space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="font-editorial text-2xl font-semibold">Cadastrar Fornecedor & Contrato</h3>
            <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
              <Link2 className="w-3.5 h-3.5 shrink-0" />
              Conectado automaticamente à área de Pagamentos
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div>
              <label className="block text-xs text-stone-500 mb-1">Nome do Fornecedor</label>
              <input
                required
                maxLength={140}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Buffet Sabor & Arte"
                className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-stone-500 mb-1">Categoria / Serviço</label>
              <select
                value={service}
                onChange={(e) => setService(e.target.value)}
                className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#171A21] px-3 py-2 text-sm"
              >
                {availableCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-stone-500 mb-1">Contato / WhatsApp</label>
              <input
                maxLength={100}
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="(11) 99999-0000"
                className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-stone-500 mb-1">Forma de Pagamento</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#171A21] px-3 py-2 text-sm"
              >
                {PAYMENT_METHODS.map((pm) => (
                  <option key={pm} value={pm}>
                    {pm}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-stone-500 mb-1">Valor Total do Contrato (R$)</label>
              <input
                type="number"
                required
                min={0}
                step="0.01"
                value={contractValue}
                onChange={(e) => setContractValue(e.target.value)}
                placeholder="0,00"
                className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-xs text-stone-500 mb-1">Valor Já Pago / Sinal (R$)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                placeholder="0,00"
                className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-xs text-stone-500 mb-1">Parcelas Totais</label>
              <input
                type="number"
                min={1}
                max={60}
                value={installmentsTotal}
                onChange={(e) => setInstallmentsTotal(e.target.value)}
                className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-sm font-mono"
              />
            </div>

            <div>
              <label className="block text-xs text-stone-500 mb-1">Próximo Vencimento</label>
              <input
                type="date"
                value={nextDueDate}
                onChange={(e) => setNextDueDate(e.target.value)}
                className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 text-xs font-medium rounded-lg border border-stone-300 dark:border-stone-700 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{ backgroundColor: accentColor }}
              className="px-5 py-2 text-xs font-semibold text-white rounded-lg hover:brightness-110 cursor-pointer disabled:opacity-60"
            >
              {saving ? 'Salvando...' : 'Salvar e conectar aos Pagamentos'}
            </button>
          </div>
        </form>
      )}

      {/* Interactive Filter Tabs + Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar max-w-full rounded-xl bg-stone-200/70 dark:bg-stone-800/80 p-1">
          {(
            [
              ['all', `Todos (${summary.counts.all})`],
              ['paid', `Pagos (${summary.counts.paid})`],
              ['partial', `Parciais (${summary.counts.partial})`],
              ['pending', `Pendentes (${summary.counts.pending})`],
            ] as const
          ).map(([tabKey, label]) => (
            <button
              key={tabKey}
              type="button"
              onClick={() => setStatusTab(tabKey)}
              className={`shrink-0 whitespace-nowrap min-h-[36px] px-3 sm:px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                statusTab === tabKey
                  ? 'bg-white dark:bg-[#1C2029] text-stone-900 dark:text-stone-100 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar fornecedor ou serviço..."
            className="w-full rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] pl-9 pr-3 py-2 text-xs"
          />
        </div>
      </div>

      {/* Detailed Vendor Financial Cards */}
      {filteredVendors.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-8 sm:p-10 text-center">
          <p className="text-sm text-stone-500">
            Nenhum fornecedor encontrado neste filtro. Clique em “Novo Fornecedor / Serviço” para cadastrar.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredVendors.map(({ vendor: v, linkedExpense, paid, pending, bucket, pct, lastDate, dueDate, method }) => (
            <div
              key={v.id}
              className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-4 sm:p-5 space-y-4 transition-colors hover:border-stone-300 dark:hover:border-stone-700"
            >
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => updateVendor(wedding.id, v.id, { checklistDone: !v.checklistDone })}
                    className="mt-0.5 text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 cursor-pointer shrink-0"
                    aria-label="Alternar checklist do fornecedor"
                  >
                    {v.checklistDone ? (
                      <CheckSquare className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                    ) : (
                      <Square className="w-5 h-5" />
                    )}
                  </button>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
                      <p className={`text-base font-semibold ${v.checklistDone ? 'line-through opacity-65' : ''}`}>
                        {v.name}
                      </p>
                      <span
                        className={`text-xs font-semibold ${
                          bucket === 'paid'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : bucket === 'partial'
                            ? 'text-amber-700 dark:text-amber-400'
                            : 'text-stone-500 dark:text-stone-400'
                        }`}
                      >
                        {bucket === 'paid' ? '· Quitado' : bucket === 'partial' ? '· Parcial' : '· Pendente'}
                      </span>
                    </div>
                    <p className="text-xs text-stone-500 mt-0.5">
                      {v.service}
                      {v.contact ? ` · ${v.contact}` : ''}
                      {` · ${method}`}
                      {v.installmentsTotal && v.installmentsTotal > 1
                        ? ` · Parcelas ${v.installmentsPaid || 0}/${v.installmentsTotal}`
                        : ''}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {pending > 0 ? (
                    <button
                      type="button"
                      onClick={() => openAbateModal(v, pending, dueDate, method)}
                      style={{ backgroundColor: accentColor }}
                      className="flex-1 sm:flex-none min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold text-white hover:brightness-110 transition-all cursor-pointer"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Abater Pagamento</span>
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 px-2">
                      <Check className="w-3.5 h-3.5" />
                      100% Quitado
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => deleteVendor(wedding.id, v.id, linkedExpense?.id)}
                    title="Remover fornecedor e lançamento conectado"
                    className="h-10 w-10 shrink-0 flex items-center justify-center rounded-lg border border-stone-200 dark:border-stone-700 sm:border-transparent text-stone-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Financial Detail Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-3 border-t border-stone-100 dark:border-stone-800/80 text-xs">
                <div>
                  <p className="text-stone-500">Valor Total</p>
                  <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums">
                    {formatBRL(v.contractValue)}
                  </p>
                </div>
                <div>
                  <p className="text-stone-500">Valor Pago</p>
                  <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                    {formatBRL(paid)}
                  </p>
                </div>
                <div>
                  <p className="text-stone-500">Pendente</p>
                  <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                    {formatBRL(pending)}
                  </p>
                </div>
                <div>
                  <p className="text-stone-500">Último Pagamento</p>
                  <p className="mt-0.5 font-mono text-xs font-medium tabular-nums text-stone-700 dark:text-stone-300">
                    {formatDateBR(lastDate)}
                  </p>
                </div>
                <div>
                  <p className="text-stone-500">Próx. Vencimento</p>
                  <p className="mt-0.5 font-mono text-xs font-medium tabular-nums text-stone-700 dark:text-stone-300">
                    {pending === 0 ? 'Quitado' : formatDateBR(dueDate)}
                  </p>
                </div>
              </div>

              {/* Per-Vendor Progress Bar */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: bucket === 'paid' ? '#15803D' : bucket === 'partial' ? '#D97706' : '#A8A29E',
                    }}
                  />
                </div>
                <span className="font-mono text-[11px] tabular-nums text-stone-500 w-9 text-right">
                  {pct}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Abater Pagamento Modal (Partial or Full) */}
      {abatingVendor && (() => {
        const linked = expenses.find((e) => e.vendorId === abatingVendor.id);
        const alreadyPaid = resolveVendorPaid(abatingVendor, linked);
        const remaining = Math.max(0, abatingVendor.contractValue - alreadyPaid);
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
                    Abater Pagamento · Sincronizado com Financeiro
                  </p>
                  <h3 className="mt-1 font-editorial text-2xl font-semibold break-words">{abatingVendor.name}</h3>
                  <p className="text-xs text-stone-500">{abatingVendor.service}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAbatingVendor(null)}
                  className="h-10 w-10 shrink-0 flex items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 rounded-xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 p-3.5 text-xs">
                <div>
                  <p className="text-stone-500">Contrato</p>
                  <p className="font-mono font-semibold tabular-nums mt-0.5">{formatBRL(abatingVendor.contractValue)}</p>
                </div>
                <div>
                  <p className="text-stone-500">Já Pago</p>
                  <p className="font-mono font-semibold tabular-nums text-emerald-700 dark:text-emerald-400 mt-0.5">
                    {formatBRL(alreadyPaid)}
                  </p>
                </div>
                <div>
                  <p className="text-stone-500">Restante</p>
                  <p className="font-mono font-semibold tabular-nums text-amber-700 dark:text-amber-400 mt-0.5">
                    {formatBRL(remaining)}
                  </p>
                </div>
              </div>

              <form onSubmit={(e) => handleAbateSubmit(e, 'custom')} className="space-y-4">
                <div>
                  <label className="block text-xs text-stone-500 mb-1">Valor a abater agora (R$)</label>
                  <input
                    type="number"
                    required
                    min={0.01}
                    max={remaining}
                    step="0.01"
                    value={abateAmount}
                    onChange={(e) => setAbateAmount(e.target.value)}
                    className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-sm font-mono"
                  />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {[0.25, 0.5, 1].map((ratio) => {
                      const suggested = Math.round(remaining * ratio * 100) / 100;
                      return (
                        <button
                          key={ratio}
                          type="button"
                          onClick={() => setAbateAmount(String(suggested))}
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

                <div>
                  <label className="block text-xs text-stone-500 mb-1">Próximo Vencimento (se parcial)</label>
                  <input
                    type="date"
                    value={abateNextDue}
                    onChange={(e) => setAbateNextDue(e.target.value)}
                    className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-xs font-mono"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                  <button
                    type="submit"
                    disabled={abateSubmitting}
                    className="min-h-[44px] py-2.5 px-3 text-xs font-semibold rounded-lg border border-stone-300 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 cursor-pointer disabled:opacity-60"
                  >
                    Abater Valor Parcial
                  </button>
                  <button
                    type="button"
                    disabled={abateSubmitting}
                    onClick={(e) => handleAbateSubmit(e, 'full')}
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

// ============================================================================
// Módulo 5: Cerimônia, Cronograma, Padrinhos & Lista de Presentes Pix
// ============================================================================
interface CeremonyAndGiftsModuleProps {
  wedding: Wedding;
  schedule: ScheduleItem[];
  party: PartyMember[];
  gifts: GiftItem[];
  contributions: GiftContribution[];
  accentColor: string;
}

type OrgHistoryAction =
  | {
      kind: 'schedule_add';
      label: string;
      item: { id: string; time: string; title: string; description: string; location: string; order: number };
    }
  | {
      kind: 'schedule_delete';
      label: string;
      item: { id: string; time: string; title: string; description: string; location: string; order: number };
    }
  | {
      kind: 'schedule_edit';
      label: string;
      id: string;
      before: { time: string; title: string; description: string; location: string };
      after: { time: string; title: string; description: string; location: string };
    }
  | {
      kind: 'schedule_reorder';
      label: string;
      beforeIds: string[];
      afterIds: string[];
    }
  | {
      kind: 'party_add';
      label: string;
      item: { id: string; name: string; role: PartyMember['role']; description: string; photoUrl: string; order: number };
    }
  | {
      kind: 'party_delete';
      label: string;
      item: { id: string; name: string; role: PartyMember['role']; description: string; photoUrl: string; order: number };
    }
  | {
      kind: 'party_edit';
      label: string;
      id: string;
      before: { name: string; role: PartyMember['role']; description: string; photoUrl: string };
      after: { name: string; role: PartyMember['role']; description: string; photoUrl: string };
    }
  | {
      kind: 'party_reorder';
      label: string;
      beforeIds: string[];
      afterIds: string[];
    }
  | {
      kind: 'gift_add';
      label: string;
      item: { id: string; title: string; category: string; price: number; description: string; active: boolean };
    }
  | {
      kind: 'gift_delete';
      label: string;
      item: { id: string; title: string; category: string; price: number; description: string; active: boolean };
    }
  | {
      kind: 'gift_edit';
      label: string;
      id: string;
      before: { title: string; category: string; price: number; description: string };
      after: { title: string; category: string; price: number; description: string };
    };

export const CeremonyAndGiftsModule: React.FC<CeremonyAndGiftsModuleProps> = ({
  wedding,
  schedule,
  party,
  gifts,
  contributions,
  accentColor,
}) => {
  const [subTab, setSubTab] = useState<'schedule' | 'party' | 'gifts'>('schedule');

  // Undo / Redo history & floating action status
  const [undoStack, setUndoStack] = useState<OrgHistoryAction[]>([]);
  const [redoStack, setRedoStack] = useState<OrgHistoryAction[]>([]);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const toastTimeoutRef = useRef<number | null>(null);

  // Refs for quick-add scroll focus
  const scheduleTitleRef = useRef<HTMLInputElement>(null);
  const partyNameRef = useRef<HTMLInputElement>(null);
  const giftTitleRef = useRef<HTMLInputElement>(null);

  // Schedule add form + edit + drag state
  const [sTime, setSTime] = useState('18:00');
  const [sTitle, setSTitle] = useState('');
  const [sDesc, setSDesc] = useState('');
  const [sLoc, setSLoc] = useState('');
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [editSTime, setEditSTime] = useState('');
  const [editSTitle, setEditSTitle] = useState('');
  const [editSDesc, setEditSDesc] = useState('');
  const [editSLoc, setEditSLoc] = useState('');
  const [dragScheduleId, setDragScheduleId] = useState<string | null>(null);
  const [dragOverScheduleId, setDragOverScheduleId] = useState<string | null>(null);

  // Party add form + edit + drag state
  const [pName, setPName] = useState('');
  const [pRole, setPRole] = useState<PartyMember['role']>('Madrinha');
  const [pDesc, setPDesc] = useState('');
  const [pPhoto, setPPhoto] = useState('');
  const [editingPartyId, setEditingPartyId] = useState<string | null>(null);
  const [editPName, setEditPName] = useState('');
  const [editPRole, setEditPRole] = useState<PartyMember['role']>('Madrinha');
  const [editPDesc, setEditPDesc] = useState('');
  const [editPPhoto, setEditPPhoto] = useState('');
  const [dragPartyId, setDragPartyId] = useState<string | null>(null);
  const [dragOverPartyId, setDragOverPartyId] = useState<string | null>(null);

  // Gift add form + edit state
  const [gTitle, setGTitle] = useState('');
  const [gCat, setGCat] = useState('Lua de Mel');
  const [gPrice, setGPrice] = useState('150');
  const [gDesc, setGDesc] = useState('');
  const [editingGiftId, setEditingGiftId] = useState<string | null>(null);
  const [editGTitle, setEditGTitle] = useState('');
  const [editGCat, setEditGCat] = useState('');
  const [editGPrice, setEditGPrice] = useState('');
  const [editGDesc, setEditGDesc] = useState('');

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = window.setTimeout(() => setToastMessage(''), 2600);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  const recordAction = useCallback((action: OrgHistoryAction) => {
    setUndoStack((prev) => [...prev.slice(-29), action]);
    setRedoStack([]);
  }, []);

  const applyAction = useCallback(
    async (action: OrgHistoryAction, direction: 'undo' | 'redo') => {
      const isUndo = direction === 'undo';
      switch (action.kind) {
        case 'schedule_add':
          if (isUndo) {
            await deleteScheduleItem(wedding.id, action.item.id);
          } else {
            await addScheduleItem(wedding.id, wedding.ownerId, action.item);
          }
          break;
        case 'schedule_delete':
          if (isUndo) {
            await addScheduleItem(wedding.id, wedding.ownerId, action.item);
          } else {
            await deleteScheduleItem(wedding.id, action.item.id);
          }
          break;
        case 'schedule_edit':
          await updateScheduleItem(wedding.id, action.id, isUndo ? action.before : action.after);
          break;
        case 'schedule_reorder':
          await reorderScheduleItems(wedding.id, isUndo ? action.beforeIds : action.afterIds);
          break;
        case 'party_add':
          if (isUndo) {
            await deletePartyMember(wedding.id, action.item.id);
          } else {
            await addPartyMember(wedding.id, wedding.ownerId, action.item);
          }
          break;
        case 'party_delete':
          if (isUndo) {
            await addPartyMember(wedding.id, wedding.ownerId, action.item);
          } else {
            await deletePartyMember(wedding.id, action.item.id);
          }
          break;
        case 'party_edit':
          await updatePartyMember(wedding.id, action.id, isUndo ? action.before : action.after);
          break;
        case 'party_reorder':
          await reorderPartyMembers(wedding.id, isUndo ? action.beforeIds : action.afterIds);
          break;
        case 'gift_add':
          if (isUndo) {
            await deleteGiftItem(wedding.id, action.item.id);
          } else {
            await addGiftItem(wedding.id, wedding.ownerId, action.item);
          }
          break;
        case 'gift_delete':
          if (isUndo) {
            await addGiftItem(wedding.id, wedding.ownerId, action.item);
          } else {
            await deleteGiftItem(wedding.id, action.item.id);
          }
          break;
        case 'gift_edit':
          await updateGiftItem(wedding.id, action.id, isUndo ? action.before : action.after);
          break;
      }
    },
    [wedding.id, wedding.ownerId]
  );

  const handleUndo = useCallback(async () => {
    if (historyBusy || undoStack.length === 0) return;
    const action = undoStack[undoStack.length - 1];
    setHistoryBusy(true);
    try {
      await applyAction(action, 'undo');
      setUndoStack((prev) => prev.slice(0, -1));
      setRedoStack((prev) => [...prev.slice(-29), action]);
      showToast(`Desfeito: ${action.label}`);
    } finally {
      setHistoryBusy(false);
    }
  }, [applyAction, historyBusy, showToast, undoStack]);

  const handleRedo = useCallback(async () => {
    if (historyBusy || redoStack.length === 0) return;
    const action = redoStack[redoStack.length - 1];
    setHistoryBusy(true);
    try {
      await applyAction(action, 'redo');
      setRedoStack((prev) => prev.slice(0, -1));
      setUndoStack((prev) => [...prev.slice(-29), action]);
      showToast(`Refeito: ${action.label}`);
    } finally {
      setHistoryBusy(false);
    }
  }, [applyAction, historyBusy, redoStack, showToast]);

  // Keyboard shortcuts Ctrl+Z / Ctrl+Y when not typing inside inputs
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        if (undoStack.length > 0) {
          e.preventDefault();
          handleUndo();
        }
      } else if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        if (redoStack.length > 0) {
          e.preventDefault();
          handleRedo();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleRedo, handleUndo, redoStack.length, undoStack.length]);

  const handlePartyPhotoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'new' | 'edit' = 'new'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageToDataUrl(file, 480);
      if (target === 'edit') {
        setEditPPhoto(compressed);
      } else {
        setPPhoto(compressed);
      }
    } catch {
      // Ignore invalid image files
    }
    e.target.value = '';
  };

  // Schedule handlers
  const handleMoveSchedule = async (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= schedule.length || fromIndex === toIndex) return;
    const beforeIds = schedule.map((s) => s.id);
    const reordered = [...schedule];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    const afterIds = reordered.map((s) => s.id);
    await reorderScheduleItems(wedding.id, afterIds);
    recordAction({
      kind: 'schedule_reorder',
      label: `Mover "${moved.title}"`,
      beforeIds,
      afterIds,
    });
    showToast(`Ordem atualizada: ${moved.title}`);
  };

  const startEditSchedule = (item: ScheduleItem) => {
    setEditingScheduleId(item.id);
    setEditSTime(item.time);
    setEditSTitle(item.title);
    setEditSDesc(item.description || '');
    setEditSLoc(item.location || '');
  };

  const saveEditSchedule = async (item: ScheduleItem) => {
    if (!editSTitle.trim()) return;
    const before = {
      time: item.time,
      title: item.title,
      description: item.description || '',
      location: item.location || '',
    };
    const after = {
      time: editSTime,
      title: editSTitle.trim(),
      description: editSDesc.trim(),
      location: editSLoc.trim(),
    };
    await updateScheduleItem(wedding.id, item.id, after);
    recordAction({
      kind: 'schedule_edit',
      label: `Editar "${after.title}"`,
      id: item.id,
      before,
      after,
    });
    setEditingScheduleId(null);
    showToast(`Momento atualizado: ${after.title}`);
  };

  const handleDeleteSchedule = async (item: ScheduleItem) => {
    await deleteScheduleItem(wedding.id, item.id);
    recordAction({
      kind: 'schedule_delete',
      label: `Remover "${item.title}"`,
      item: {
        id: item.id,
        time: item.time,
        title: item.title,
        description: item.description || '',
        location: item.location || '',
        order: item.order,
      },
    });
    if (editingScheduleId === item.id) setEditingScheduleId(null);
    showToast(`Removido: ${item.title} (clique em Desfazer para voltar)`);
  };

  // Party handlers
  const handleMoveParty = async (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= party.length || fromIndex === toIndex) return;
    const beforeIds = party.map((m) => m.id);
    const reordered = [...party];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    const afterIds = reordered.map((m) => m.id);
    await reorderPartyMembers(wedding.id, afterIds);
    recordAction({
      kind: 'party_reorder',
      label: `Mover "${moved.name}"`,
      beforeIds,
      afterIds,
    });
    showToast(`Ordem atualizada: ${moved.name}`);
  };

  const startEditParty = (member: PartyMember) => {
    setEditingPartyId(member.id);
    setEditPName(member.name);
    setEditPRole(member.role);
    setEditPDesc(member.description || '');
    setEditPPhoto(member.photoUrl || '');
  };

  const saveEditParty = async (member: PartyMember) => {
    if (!editPName.trim()) return;
    const before = {
      name: member.name,
      role: member.role,
      description: member.description || '',
      photoUrl: member.photoUrl || '',
    };
    const after = {
      name: editPName.trim(),
      role: editPRole,
      description: editPDesc.trim(),
      photoUrl: editPPhoto || member.photoUrl || '',
    };
    await updatePartyMember(wedding.id, member.id, after);
    recordAction({
      kind: 'party_edit',
      label: `Editar "${after.name}"`,
      id: member.id,
      before,
      after,
    });
    setEditingPartyId(null);
    showToast(`Atualizado: ${after.name}`);
  };

  const handleDeleteParty = async (member: PartyMember) => {
    await deletePartyMember(wedding.id, member.id);
    recordAction({
      kind: 'party_delete',
      label: `Remover "${member.name}"`,
      item: {
        id: member.id,
        name: member.name,
        role: member.role,
        description: member.description || '',
        photoUrl: member.photoUrl || '',
        order: member.order,
      },
    });
    if (editingPartyId === member.id) setEditingPartyId(null);
    showToast(`Removido: ${member.name} (clique em Desfazer para voltar)`);
  };

  // Gift handlers
  const startEditGift = (gift: GiftItem) => {
    setEditingGiftId(gift.id);
    setEditGTitle(gift.title);
    setEditGCat(gift.category);
    setEditGPrice(String(gift.price));
    setEditGDesc(gift.description || '');
  };

  const saveEditGift = async (gift: GiftItem) => {
    if (!editGTitle.trim()) return;
    const before = {
      title: gift.title,
      category: gift.category,
      price: gift.price,
      description: gift.description || '',
    };
    const after = {
      title: editGTitle.trim(),
      category: editGCat.trim() || 'Lua de Mel',
      price: Math.max(1, Number(editGPrice) || gift.price),
      description: editGDesc.trim(),
    };
    await updateGiftItem(wedding.id, gift.id, after);
    recordAction({
      kind: 'gift_edit',
      label: `Editar "${after.title}"`,
      id: gift.id,
      before,
      after,
    });
    setEditingGiftId(null);
    showToast(`Presente atualizado: ${after.title}`);
  };

  const handleDeleteGift = async (gift: GiftItem) => {
    await deleteGiftItem(wedding.id, gift.id);
    recordAction({
      kind: 'gift_delete',
      label: `Remover "${gift.title}"`,
      item: {
        id: gift.id,
        title: gift.title,
        category: gift.category,
        price: gift.price,
        description: gift.description || '',
        active: gift.active,
      },
    });
    if (editingGiftId === gift.id) setEditingGiftId(null);
    showToast(`Removido: ${gift.title} (clique em Desfazer para voltar)`);
  };

  const focusQuickAdd = () => {
    const target =
      subTab === 'schedule'
        ? scheduleTitleRef.current
        : subTab === 'party'
        ? partyNameRef.current
        : giftTitleRef.current;
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      window.setTimeout(() => target.focus(), 250);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-editorial text-2xl sm:text-3xl font-semibold">
            Cerimônia, Padrinhos & Presentes
          </h2>
          <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400">
            Mova, edite ou remova qualquer item. Tudo atualiza em tempo real no Site dos Convidados.
          </p>
        </div>

        <div className="grid grid-cols-3 sm:inline-flex items-center gap-1 rounded-xl bg-stone-200/70 dark:bg-stone-800 p-1 w-full sm:w-auto">
          {(
            [
              ['schedule', 'Cronograma'],
              ['party', 'Padrinhos'],
              ['gifts', 'Presentes Pix'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSubTab(id)}
              className={`min-h-[38px] px-2.5 sm:px-3.5 py-2 sm:py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer text-center truncate ${
                subTab === id
                  ? 'bg-white dark:bg-[#1C2029] text-stone-900 dark:text-stone-100 shadow-xs font-semibold'
                  : 'text-stone-600 dark:text-stone-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Inline Toast Feedback Banner */}
      {toastMessage && (
        <div className="rounded-xl border border-[#DFBE7A]/60 bg-[#173526] text-[#FBF7F0] px-4 py-2.5 flex items-center justify-between gap-3 text-xs shadow-sm">
          <span>{toastMessage}</span>
          {undoStack.length > 0 && (
            <button
              type="button"
              onClick={handleUndo}
              disabled={historyBusy}
              className="inline-flex items-center gap-1 rounded-full bg-[#DFBE7A] text-[#173526] px-3 py-1 text-[11px] font-semibold hover:bg-[#EBD198] cursor-pointer shrink-0"
            >
              <Undo2 className="w-3 h-3" />
              <span>Desfazer</span>
            </button>
          )}
        </div>
      )}

      {subTab === 'schedule' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Arraste os blocos ou use as setas para reordenar o roteiro do grande dia.
            </p>
            <button
              type="button"
              onClick={() => buildWeddingDayICS(wedding, schedule)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#171A21] px-3.5 py-2 text-xs font-medium hover:bg-stone-50 dark:hover:bg-stone-800 cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Exportar Cronograma (.ics)</span>
            </button>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!sTitle.trim()) return;
              const nextOrder = schedule.length + 1;
              const newItemData = {
                time: sTime,
                title: sTitle.trim(),
                description: sDesc.trim(),
                location: sLoc.trim(),
                order: nextOrder,
              };
              const createdId = await addScheduleItem(wedding.id, wedding.ownerId, newItemData);
              recordAction({
                kind: 'schedule_add',
                label: `Adicionar "${newItemData.title}"`,
                item: { id: createdId, ...newItemData },
              });
              setSTitle('');
              setSDesc('');
              setSLoc('');
              showToast(`Adicionado ao cronograma: ${newItemData.title}`);
            }}
            className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end"
          >
            <div className="lg:col-span-2 min-w-0">
              <label className="block text-xs text-stone-500 mb-1">Horário</label>
              <input
                type="time"
                required
                value={sTime}
                onChange={(e) => setSTime(e.target.value)}
                className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-sm font-mono"
              />
            </div>
            <div className="lg:col-span-3 min-w-0">
              <label className="block text-xs text-stone-500 mb-1">Momento</label>
              <input
                ref={scheduleTitleRef}
                required
                maxLength={120}
                value={sTitle}
                onChange={(e) => setSTitle(e.target.value)}
                placeholder="Ex.: Corte do Bolo"
                className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div className="lg:col-span-3 min-w-0">
              <label className="block text-xs text-stone-500 mb-1">Descrição</label>
              <input
                maxLength={300}
                value={sDesc}
                onChange={(e) => setSDesc(e.target.value)}
                placeholder="Detalhes breves"
                className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div className="lg:col-span-2 min-w-0">
              <label className="block text-xs text-stone-500 mb-1">Local (opcional)</label>
              <input
                maxLength={120}
                value={sLoc}
                onChange={(e) => setSLoc(e.target.value)}
                placeholder="Ex.: Salão"
                className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-2">
              <button
                type="submit"
                style={{ backgroundColor: accentColor }}
                className="w-full py-2.5 lg:py-2 px-3 text-sm font-semibold text-white rounded-lg hover:brightness-110 transition-all cursor-pointer"
              >
                Adicionar
              </button>
            </div>
          </form>

          <div className="space-y-2.5">
            {schedule.length === 0 ? (
              <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-8 text-center text-sm text-stone-500">
                Nenhum momento no cronograma ainda. Adicione o primeiro acima.
              </div>
            ) : (
              schedule.map((item, idx) => {
                const isEditing = editingScheduleId === item.id;
                const isDragTarget = dragOverScheduleId === item.id && dragScheduleId !== item.id;
                return (
                  <div
                    key={item.id}
                    draggable={!isEditing}
                    onDragStart={() => setDragScheduleId(item.id)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (dragScheduleId && dragScheduleId !== item.id) {
                        setDragOverScheduleId(item.id);
                      }
                    }}
                    onDragLeave={() => setDragOverScheduleId(null)}
                    onDrop={async (e) => {
                      e.preventDefault();
                      if (dragScheduleId && dragScheduleId !== item.id) {
                        const fromIdx = schedule.findIndex((s) => s.id === dragScheduleId);
                        if (fromIdx !== -1) {
                          await handleMoveSchedule(fromIdx, idx);
                        }
                      }
                      setDragScheduleId(null);
                      setDragOverScheduleId(null);
                    }}
                    onDragEnd={() => {
                      setDragScheduleId(null);
                      setDragOverScheduleId(null);
                    }}
                    className={`rounded-2xl border bg-white dark:bg-[#171A21] p-4 transition-all ${
                      isDragTarget
                        ? 'border-[#B68B3C] ring-2 ring-[#DFBE7A]/40'
                        : 'border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700'
                    }`}
                  >
                    {isEditing ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5">
                          <div className="lg:col-span-2">
                            <label className="block text-[11px] text-stone-500 mb-1">Horário</label>
                            <input
                              type="time"
                              value={editSTime}
                              onChange={(e) => setEditSTime(e.target.value)}
                              className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-2.5 py-2 text-sm font-mono"
                            />
                          </div>
                          <div className="lg:col-span-4">
                            <label className="block text-[11px] text-stone-500 mb-1">Momento</label>
                            <input
                              maxLength={120}
                              value={editSTitle}
                              onChange={(e) => setEditSTitle(e.target.value)}
                              className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-2.5 py-2 text-sm"
                            />
                          </div>
                          <div className="lg:col-span-4">
                            <label className="block text-[11px] text-stone-500 mb-1">Descrição</label>
                            <input
                              maxLength={300}
                              value={editSDesc}
                              onChange={(e) => setEditSDesc(e.target.value)}
                              className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-2.5 py-2 text-sm"
                            />
                          </div>
                          <div className="lg:col-span-2">
                            <label className="block text-[11px] text-stone-500 mb-1">Local</label>
                            <input
                              maxLength={120}
                              value={editSLoc}
                              onChange={(e) => setEditSLoc(e.target.value)}
                              className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-2.5 py-2 text-sm"
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingScheduleId(null)}
                            className="inline-flex items-center gap-1 rounded-lg border border-stone-300 dark:border-stone-700 px-3 py-1.5 text-xs font-medium cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Cancelar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => saveEditSchedule(item)}
                            style={{ backgroundColor: accentColor }}
                            className="inline-flex items-center gap-1 rounded-lg px-3.5 py-1.5 text-xs font-semibold text-white cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Salvar</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <span
                            className="hidden sm:inline-flex mt-0.5 text-stone-300 dark:text-stone-600 cursor-grab active:cursor-grabbing shrink-0"
                            title="Arraste para mover"
                          >
                            <GripVertical className="w-4 h-4" />
                          </span>
                          <span
                            className="font-mono text-sm font-semibold tabular-nums shrink-0 rounded-lg bg-stone-100 dark:bg-stone-800/80 px-2.5 py-1"
                            style={{ color: accentColor }}
                          >
                            {item.time}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold break-words">{item.title}</p>
                            {item.description && (
                              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 break-words">
                                {item.description}
                              </p>
                            )}
                            {item.location && (
                              <p className="text-[11px] text-stone-400 mt-0.5">Local: {item.location}</p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-1.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100 dark:border-stone-800">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveSchedule(idx, idx - 1)}
                            title="Mover para cima"
                            aria-label={`Mover ${item.title} para cima`}
                            className="p-2 rounded-lg border border-stone-200 dark:border-stone-700 text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-50 dark:hover:bg-stone-800 disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === schedule.length - 1}
                            onClick={() => handleMoveSchedule(idx, idx + 1)}
                            title="Mover para baixo"
                            aria-label={`Mover ${item.title} para baixo`}
                            className="p-2 rounded-lg border border-stone-200 dark:border-stone-700 text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-50 dark:hover:bg-stone-800 disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => startEditSchedule(item)}
                            title="Editar momento"
                            aria-label={`Editar ${item.title}`}
                            className="p-2 rounded-lg border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSchedule(item)}
                            title="Remover momento"
                            aria-label={`Remover ${item.title}`}
                            className="p-2 rounded-lg border border-stone-200 dark:border-stone-700 text-stone-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {subTab === 'party' && (
        <div className="space-y-5">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!pName.trim()) return;
              const newMember = {
                name: pName.trim(),
                role: pRole,
                description: pDesc.trim(),
                photoUrl: pPhoto,
                order: party.length + 1,
              };
              const createdId = await addPartyMember(wedding.id, wedding.ownerId, newMember);
              recordAction({
                kind: 'party_add',
                label: `Adicionar "${newMember.name}"`,
                item: { id: createdId, ...newMember },
              });
              setPName('');
              setPDesc('');
              setPPhoto('');
              showToast(`Adicionado aos padrinhos: ${newMember.name}`);
            }}
            className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end"
          >
            <div className="lg:col-span-3 min-w-0">
              <label className="block text-xs text-stone-500 mb-1">Nome</label>
              <input
                ref={partyNameRef}
                required
                maxLength={100}
                value={pName}
                onChange={(e) => setPName(e.target.value)}
                placeholder="Nome completo"
                className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div className="lg:col-span-2 min-w-0">
              <label className="block text-xs text-stone-500 mb-1">Papel</label>
              <select
                value={pRole}
                onChange={(e) => setPRole(e.target.value as PartyMember['role'])}
                className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#171A21] px-2.5 py-2 text-sm"
              >
                <option value="Madrinha">Madrinha</option>
                <option value="Padrinho">Padrinho</option>
                <option value="Dama de Honra">Dama de Honra</option>
                <option value="Pajem">Pajem</option>
              </select>
            </div>
            <div className="lg:col-span-3 min-w-0">
              <label className="block text-xs text-stone-500 mb-1">Homenagem / Descrição</label>
              <input
                maxLength={300}
                value={pDesc}
                onChange={(e) => setPDesc(e.target.value)}
                placeholder="Ex.: Melhor amiga da noiva"
                className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div className="lg:col-span-2 min-w-0">
              <label className="block text-xs text-stone-500 mb-1">Foto (arquivo)</label>
              <label className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-stone-300 dark:border-stone-700 px-3 py-2 text-xs font-medium cursor-pointer hover:bg-stone-50 dark:hover:bg-stone-800">
                <Upload className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{pPhoto ? 'Foto pronta' : 'Escolher foto'}</span>
                <input type="file" accept="image/*" onChange={(e) => handlePartyPhotoUpload(e, 'new')} className="hidden" />
              </label>
            </div>
            <div className="sm:col-span-2 lg:col-span-2">
              <button
                type="submit"
                style={{ backgroundColor: accentColor }}
                className="w-full py-2.5 lg:py-2 px-3 text-sm font-semibold text-white rounded-lg hover:brightness-110 transition-all cursor-pointer"
              >
                Adicionar
              </button>
            </div>
          </form>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {party.map((m, idx) => {
              const isEditing = editingPartyId === m.id;
              const isDragTarget = dragOverPartyId === m.id && dragPartyId !== m.id;
              return (
                <div
                  key={m.id}
                  draggable={!isEditing}
                  onDragStart={() => setDragPartyId(m.id)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragPartyId && dragPartyId !== m.id) setDragOverPartyId(m.id);
                  }}
                  onDragLeave={() => setDragOverPartyId(null)}
                  onDrop={async (e) => {
                    e.preventDefault();
                    if (dragPartyId && dragPartyId !== m.id) {
                      const fromIdx = party.findIndex((p) => p.id === dragPartyId);
                      if (fromIdx !== -1) await handleMoveParty(fromIdx, idx);
                    }
                    setDragPartyId(null);
                    setDragOverPartyId(null);
                  }}
                  onDragEnd={() => {
                    setDragPartyId(null);
                    setDragOverPartyId(null);
                  }}
                  className={`rounded-2xl border bg-white dark:bg-[#171A21] p-4 flex flex-col justify-between gap-3 transition-all ${
                    isDragTarget
                      ? 'border-[#B68B3C] ring-2 ring-[#DFBE7A]/40'
                      : 'border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700'
                  }`}
                >
                  {isEditing ? (
                    <div className="space-y-2.5">
                      <input
                        maxLength={100}
                        value={editPName}
                        onChange={(e) => setEditPName(e.target.value)}
                        placeholder="Nome"
                        className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-2.5 py-1.5 text-sm"
                      />
                      <select
                        value={editPRole}
                        onChange={(e) => setEditPRole(e.target.value as PartyMember['role'])}
                        className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#171A21] px-2.5 py-1.5 text-xs"
                      >
                        <option value="Madrinha">Madrinha</option>
                        <option value="Padrinho">Padrinho</option>
                        <option value="Dama de Honra">Dama de Honra</option>
                        <option value="Pajem">Pajem</option>
                      </select>
                      <input
                        maxLength={300}
                        value={editPDesc}
                        onChange={(e) => setEditPDesc(e.target.value)}
                        placeholder="Homenagem / Descrição"
                        className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-2.5 py-1.5 text-xs"
                      />
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <label className="inline-flex items-center gap-1 rounded-lg border border-stone-300 dark:border-stone-700 px-2.5 py-1.5 text-[11px] font-medium cursor-pointer">
                          <Upload className="w-3 h-3" />
                          <span>Trocar foto</span>
                          <input type="file" accept="image/*" onChange={(e) => handlePartyPhotoUpload(e, 'edit')} className="hidden" />
                        </label>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingPartyId(null)}
                            className="p-1.5 rounded-lg border border-stone-300 dark:border-stone-700 text-stone-500 cursor-pointer"
                            aria-label="Cancelar edição"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => saveEditParty(m)}
                            style={{ backgroundColor: accentColor }}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Salvar</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-12 w-12 rounded-full overflow-hidden shrink-0 border border-stone-200 dark:border-stone-700">
                          <SafeImage src={m.photoUrl} alt={m.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium" style={{ color: accentColor }}>
                            {m.role}
                          </p>
                          <p className="text-sm font-semibold truncate">{m.name}</p>
                          {m.description && (
                            <p className="text-xs text-stone-500 dark:text-stone-400 line-clamp-2">
                              {m.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2.5 border-t border-stone-100 dark:border-stone-800">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveParty(idx, idx - 1)}
                            title="Mover para trás"
                            className="p-1.5 rounded-lg border border-stone-200 dark:border-stone-700 text-stone-500 hover:bg-stone-50 dark:hover:bg-stone-800 disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === party.length - 1}
                            onClick={() => handleMoveParty(idx, idx + 1)}
                            title="Mover para frente"
                            className="p-1.5 rounded-lg border border-stone-200 dark:border-stone-700 text-stone-500 hover:bg-stone-50 dark:hover:bg-stone-800 disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => startEditParty(m)}
                            title="Editar"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 text-xs text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 cursor-pointer"
                          >
                            <Pencil className="w-3 h-3" />
                            <span>Editar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteParty(m)}
                            title="Remover"
                            className="p-1.5 rounded-lg border border-stone-200 dark:border-stone-700 text-stone-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {subTab === 'gifts' && (
        <div className="space-y-6">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!gTitle.trim()) return;
              const newGift = {
                title: gTitle.trim(),
                category: gCat.trim() || 'Lua de Mel',
                price: Math.max(1, Number(gPrice) || 100),
                description: gDesc.trim(),
                active: true,
              };
              const createdId = await addGiftItem(wedding.id, wedding.ownerId, newGift);
              recordAction({
                kind: 'gift_add',
                label: `Criar cota "${newGift.title}"`,
                item: { id: createdId, ...newGift },
              });
              setGTitle('');
              setGDesc('');
              showToast(`Cota criada: ${newGift.title}`);
            }}
            className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end"
          >
            <div className="lg:col-span-3 min-w-0">
              <label className="block text-xs text-stone-500 mb-1">Presente Simbólico</label>
              <input
                ref={giftTitleRef}
                required
                maxLength={120}
                value={gTitle}
                onChange={(e) => setGTitle(e.target.value)}
                placeholder="Ex.: Passeio na Lua de Mel"
                className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div className="lg:col-span-2 min-w-0">
              <label className="block text-xs text-stone-500 mb-1">Categoria</label>
              <input
                maxLength={60}
                value={gCat}
                onChange={(e) => setGCat(e.target.value)}
                className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div className="lg:col-span-2 min-w-0">
              <label className="block text-xs text-stone-500 mb-1">Valor Pix (R$)</label>
              <input
                type="number"
                required
                min={1}
                value={gPrice}
                onChange={(e) => setGPrice(e.target.value)}
                className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-sm font-mono"
              />
            </div>
            <div className="lg:col-span-3 min-w-0">
              <label className="block text-xs text-stone-500 mb-1">Descrição</label>
              <input
                maxLength={300}
                value={gDesc}
                onChange={(e) => setGDesc(e.target.value)}
                placeholder="Mensagem do presente"
                className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-2">
              <button
                type="submit"
                style={{ backgroundColor: accentColor }}
                className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 lg:py-2 px-3 text-sm font-semibold text-white rounded-lg hover:brightness-110 transition-all cursor-pointer"
              >
                <Gift className="w-4 h-4" />
                <span>Criar Cota</span>
              </button>
            </div>
          </form>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {gifts.map((g) => {
              const isEditing = editingGiftId === g.id;
              return (
                <div
                  key={g.id}
                  className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-4 flex flex-col justify-between gap-3"
                >
                  {isEditing ? (
                    <div className="space-y-2.5">
                      <input
                        maxLength={120}
                        value={editGTitle}
                        onChange={(e) => setEditGTitle(e.target.value)}
                        placeholder="Título do presente"
                        className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-2.5 py-1.5 text-sm"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          maxLength={60}
                          value={editGCat}
                          onChange={(e) => setEditGCat(e.target.value)}
                          placeholder="Categoria"
                          className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-2.5 py-1.5 text-xs"
                        />
                        <input
                          type="number"
                          min={1}
                          value={editGPrice}
                          onChange={(e) => setEditGPrice(e.target.value)}
                          className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-2.5 py-1.5 text-xs font-mono"
                        />
                      </div>
                      <input
                        maxLength={300}
                        value={editGDesc}
                        onChange={(e) => setEditGDesc(e.target.value)}
                        placeholder="Descrição"
                        className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-2.5 py-1.5 text-xs"
                      />
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditingGiftId(null)}
                          className="px-2.5 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 text-xs cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => saveEditGift(g)}
                          style={{ backgroundColor: accentColor }}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white cursor-pointer"
                        >
                          Salvar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <p className="text-xs text-stone-500">{g.category}</p>
                        <p className="text-sm font-semibold mt-0.5">{g.title}</p>
                        {g.description && (
                          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 line-clamp-2">
                            {g.description}
                          </p>
                        )}
                        <p className="font-mono text-sm font-semibold tabular-nums mt-2" style={{ color: accentColor }}>
                          {formatBRL(g.price)}
                        </p>
                      </div>
                      <div className="flex items-center justify-end gap-1.5 pt-2.5 border-t border-stone-100 dark:border-stone-800">
                        <button
                          type="button"
                          onClick={() => startEditGift(g)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-stone-200 dark:border-stone-700 text-xs text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 cursor-pointer"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>Editar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteGift(g)}
                          className="p-1.5 rounded-lg border border-stone-200 dark:border-stone-700 text-stone-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                          title="Remover cota"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {contributions.length > 0 && (
            <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-5">
              <h3 className="text-sm font-semibold mb-3">Presentes Pix Recebidos pelo Site</h3>
              <div className="divide-y divide-stone-100 dark:divide-stone-800">
                {contributions.map((c) => (
                  <div key={c.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm">
                    <div>
                      <p className="font-medium">
                        {c.guestName} · <span className="text-stone-500">{c.giftTitle}</span>
                      </p>
                      {c.message && <p className="text-xs text-stone-500 italic">“{c.message}”</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-semibold tabular-nums">{formatBRL(c.amount)}</span>
                      {c.status === 'confirmed' ? (
                        <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                          Confirmado
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => confirmGiftContribution(wedding.id, c.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-stone-300 dark:border-stone-700 px-2.5 py-1 text-xs font-medium hover:bg-stone-50 dark:hover:bg-stone-800 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Confirmar Pix</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Floating Organizational Action Dock: Desfazer / Refazer / Novo */}
      <div
        className="fixed bottom-[76px] lg:bottom-5 left-3 lg:left-auto lg:right-60 z-30 inline-flex items-center gap-0.5 sm:gap-1 rounded-full border border-[#DFBE7A]/50 bg-[#173526]/95 backdrop-blur-md text-[#FBF7F0] p-1 shadow-xl"
        aria-label="Ações rápidas de organização"
      >
        <button
          type="button"
          onClick={handleUndo}
          disabled={historyBusy || undoStack.length === 0}
          title={
            undoStack.length > 0
              ? `Desfazer: ${undoStack[undoStack.length - 1].label}`
              : 'Nada para desfazer'
          }
          className="min-h-[38px] inline-flex items-center gap-1.5 rounded-full px-2.5 sm:px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-white/10 disabled:opacity-40 cursor-pointer"
        >
          <Undo2 className="w-3.5 h-3.5 text-[#DFBE7A]" />
          <span className="hidden sm:inline">Desfazer</span>
          {undoStack.length > 0 && (
            <span className="font-mono text-[10px] rounded-full bg-[#DFBE7A]/20 text-[#DFBE7A] px-1.5">
              {undoStack.length}
            </span>
          )}
        </button>

        <span className="h-4 w-px bg-white/15" aria-hidden="true" />

        <button
          type="button"
          onClick={handleRedo}
          disabled={historyBusy || redoStack.length === 0}
          title={
            redoStack.length > 0
              ? `Refazer: ${redoStack[redoStack.length - 1].label}`
              : 'Nada para refazer'
          }
          className="min-h-[38px] inline-flex items-center gap-1.5 rounded-full px-2.5 sm:px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-white/10 disabled:opacity-40 cursor-pointer"
        >
          <Redo2 className="w-3.5 h-3.5 text-[#DFBE7A]" />
          <span className="hidden sm:inline">Refazer</span>
          {redoStack.length > 0 && (
            <span className="font-mono text-[10px] rounded-full bg-[#DFBE7A]/20 text-[#DFBE7A] px-1.5">
              {redoStack.length}
            </span>
          )}
        </button>

        <span className="h-4 w-px bg-white/15" aria-hidden="true" />

        <button
          type="button"
          onClick={focusQuickAdd}
          title="Adicionar novo item"
          className="min-h-[38px] inline-flex items-center gap-1 rounded-full bg-[#DFBE7A] text-[#173526] hover:bg-[#EBD198] px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Novo</span>
        </button>
      </div>
    </div>
  );
};
