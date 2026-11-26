import React, { useMemo, useState } from 'react';
import {
  Calendar,
  Check,
  CheckSquare,
  CreditCard,
  Gift,
  Link2,
  Plus,
  Search,
  Square,
  Trash2,
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
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white rounded-xl hover:brightness-110 transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>{showAddForm ? 'Fechar formulário' : 'Novo Fornecedor / Serviço'}</span>
        </button>
      </div>

      {/* 4 Detailed Color-Coded Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-5">
          <p className="text-xs font-medium text-stone-500">Valor Total Contratado</p>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-stone-900 dark:text-stone-100">
            {formatBRL(summary.totalContract)}
          </p>
          <p className="mt-1.5 text-xs text-stone-500">
            {summary.counts.all} fornecedor(es) · {summary.counts.checklistDone} no checklist
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/25 p-5">
          <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">Valor Pago</p>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
            {formatBRL(summary.totalPaid)}
          </p>
          <p className="mt-1.5 text-xs text-emerald-800/80 dark:text-emerald-300/80 tabular-nums">
            {summary.pctPaid}% quitado · {summary.counts.paid} totalmente pago(s)
          </p>
        </div>

        <div className="rounded-2xl border border-amber-200/80 dark:border-amber-900/60 bg-amber-50/75 dark:bg-amber-950/25 p-5">
          <p className="text-xs font-medium text-amber-900 dark:text-amber-300">Valor Pendente</p>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-amber-700 dark:text-amber-400">
            {formatBRL(summary.totalPending)}
          </p>
          <p className="mt-1.5 text-xs text-amber-900/80 dark:text-amber-300/80">
            {summary.counts.partial} parcial(is) · {summary.counts.pending} sem pagamento
          </p>
        </div>

        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-[#FBF9F5] dark:bg-[#171A21] p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-stone-600 dark:text-stone-400">Progresso Quitado</span>
            <span className="font-mono font-semibold tabular-nums" style={{ color: accentColor }}>
              {summary.pctPaid}%
            </span>
          </div>
          <div className="mt-3 h-2.5 w-full rounded-full bg-stone-200/80 dark:bg-stone-800 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${summary.pctPaid}%`, backgroundColor: '#15803D' }}
            />
          </div>
          <p className="mt-2 text-xs text-stone-500">
            Sincronizado em tempo real com Pagamentos
          </p>
        </div>
      </div>

      {/* Collapsible Add Vendor Form */}
      {showAddForm && (
        <form
          onSubmit={handleAdd}
          className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-editorial text-2xl font-semibold">Cadastrar Fornecedor & Contrato</h3>
            <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
              <Link2 className="w-3.5 h-3.5" />
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
        <div className="inline-flex flex-wrap items-center gap-1 rounded-xl bg-stone-200/70 dark:bg-stone-800/80 p-1">
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
              className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
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
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-10 text-center">
          <p className="text-sm text-stone-500">
            Nenhum fornecedor encontrado neste filtro. Clique em “Novo Fornecedor / Serviço” para cadastrar.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredVendors.map(({ vendor: v, linkedExpense, paid, pending, bucket, pct, lastDate, dueDate, method }) => (
            <div
              key={v.id}
              className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-5 space-y-4 transition-colors hover:border-stone-300 dark:hover:border-stone-700"
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
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {pending > 0 ? (
                    <button
                      type="button"
                      onClick={() => openAbateModal(v, pending, dueDate, method)}
                      style={{ backgroundColor: accentColor }}
                      className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold text-white hover:brightness-110 transition-all cursor-pointer"
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
                    className="p-2 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs"
            role="dialog"
            aria-modal="true"
          >
            <div className="w-full max-w-md rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-6 shadow-2xl space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium" style={{ color: accentColor }}>
                    Abater Pagamento · Sincronizado com Financeiro
                  </p>
                  <h3 className="mt-1 font-editorial text-2xl font-semibold">{abatingVendor.name}</h3>
                  <p className="text-xs text-stone-500">{abatingVendor.service}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAbatingVendor(null)}
                  className="p-1.5 rounded-lg text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
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

                <div className="grid grid-cols-2 gap-2.5 pt-2">
                  <button
                    type="submit"
                    disabled={abateSubmitting}
                    className="py-2.5 px-3 text-xs font-semibold rounded-lg border border-stone-300 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 cursor-pointer disabled:opacity-60"
                  >
                    Abater Valor Parcial
                  </button>
                  <button
                    type="button"
                    disabled={abateSubmitting}
                    onClick={(e) => handleAbateSubmit(e, 'full')}
                    style={{ backgroundColor: accentColor }}
                    className="py-2.5 px-3 text-xs font-semibold text-white rounded-lg hover:brightness-110 cursor-pointer disabled:opacity-60"
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

export const CeremonyAndGiftsModule: React.FC<CeremonyAndGiftsModuleProps> = ({
  wedding,
  schedule,
  party,
  gifts,
  contributions,
  accentColor,
}) => {
  const [subTab, setSubTab] = useState<'schedule' | 'party' | 'gifts'>('schedule');

  // Schedule form
  const [sTime, setSTime] = useState('18:00');
  const [sTitle, setSTitle] = useState('');
  const [sDesc, setSDesc] = useState('');

  // Party form
  const [pName, setPName] = useState('');
  const [pRole, setPRole] = useState<PartyMember['role']>('Madrinha');
  const [pDesc, setPDesc] = useState('');
  const [pPhoto, setPPhoto] = useState('');

  // Gift form
  const [gTitle, setGTitle] = useState('');
  const [gCat, setGCat] = useState('Lua de Mel');
  const [gPrice, setGPrice] = useState('150');
  const [gDesc, setGDesc] = useState('');

  const handlePartyPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageToDataUrl(file, 480);
      setPPhoto(compressed);
    } catch {
      // Ignore invalid image files
    }
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-editorial text-3xl font-semibold">Cerimônia, Padrinhos & Presentes</h2>
          <p className="text-sm text-stone-600 dark:text-stone-400">
            Tudo o que você edita aqui aparece automaticamente no Site dos Convidados.
          </p>
        </div>

        <div className="inline-flex items-center gap-1 rounded-xl bg-stone-200/70 dark:bg-stone-800 p-1">
          {(
            [
              ['schedule', 'Cronograma'],
              ['party', 'Padrinhos & Damas'],
              ['gifts', 'Presentes Pix'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSubTab(id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                subTab === id
                  ? 'bg-white dark:bg-[#1C2029] text-stone-900 dark:text-stone-100 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {subTab === 'schedule' && (
        <div className="space-y-5">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => buildWeddingDayICS(wedding, schedule)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#171A21] px-3.5 py-2 text-xs font-medium cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Exportar Cronograma (.ics)</span>
            </button>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!sTitle.trim()) return;
              await addScheduleItem(wedding.id, wedding.ownerId, {
                time: sTime,
                title: sTitle,
                description: sDesc,
                order: schedule.length + 1,
              });
              setSTitle('');
              setSDesc('');
            }}
            className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-5 grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
          >
            <div className="md:col-span-2">
              <label className="block text-xs text-stone-500 mb-1">Horário</label>
              <input
                type="time"
                required
                value={sTime}
                onChange={(e) => setSTime(e.target.value)}
                className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-sm font-mono"
              />
            </div>
            <div className="md:col-span-4">
              <label className="block text-xs text-stone-500 mb-1">Momento</label>
              <input
                required
                maxLength={120}
                value={sTitle}
                onChange={(e) => setSTitle(e.target.value)}
                placeholder="Ex.: Corte do Bolo"
                className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div className="md:col-span-4">
              <label className="block text-xs text-stone-500 mb-1">Descrição</label>
              <input
                maxLength={300}
                value={sDesc}
                onChange={(e) => setSDesc(e.target.value)}
                placeholder="Detalhes breves"
                className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <button
                type="submit"
                style={{ backgroundColor: accentColor }}
                className="w-full py-2 px-3 text-sm font-medium text-white rounded-lg cursor-pointer"
              >
                Adicionar
              </button>
            </div>
          </form>

          <div className="space-y-2.5">
            {schedule.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-4 flex items-center justify-between gap-4"
              >
                <div className="flex items-baseline gap-4">
                  <span className="font-mono text-sm font-semibold tabular-nums" style={{ color: accentColor }}>
                    {item.time}
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{item.title}</p>
                    {item.description && <p className="text-xs text-stone-500">{item.description}</p>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => deleteScheduleItem(wedding.id, item.id)}
                  className="p-1.5 text-stone-400 hover:text-red-600 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {subTab === 'party' && (
        <div className="space-y-5">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!pName.trim()) return;
              await addPartyMember(wedding.id, wedding.ownerId, {
                name: pName,
                role: pRole,
                description: pDesc,
                photoUrl: pPhoto,
                order: party.length + 1,
              });
              setPName('');
              setPDesc('');
              setPPhoto('');
            }}
            className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-5 grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
          >
            <div className="md:col-span-3">
              <label className="block text-xs text-stone-500 mb-1">Nome</label>
              <input
                required
                maxLength={100}
                value={pName}
                onChange={(e) => setPName(e.target.value)}
                placeholder="Nome completo"
                className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div className="md:col-span-2">
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
            <div className="md:col-span-3">
              <label className="block text-xs text-stone-500 mb-1">Homenagem / Descrição</label>
              <input
                maxLength={300}
                value={pDesc}
                onChange={(e) => setPDesc(e.target.value)}
                placeholder="Ex.: Melhor amiga da noiva"
                className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-stone-500 mb-1">Foto (arquivo)</label>
              <label className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-stone-300 dark:border-stone-700 px-3 py-2 text-xs font-medium cursor-pointer hover:bg-stone-50 dark:hover:bg-stone-800">
                <Upload className="w-3.5 h-3.5" />
                <span>{pPhoto ? 'Foto pronta' : 'Escolher foto'}</span>
                <input type="file" accept="image/*" onChange={handlePartyPhotoUpload} className="hidden" />
              </label>
            </div>
            <div className="md:col-span-2">
              <button
                type="submit"
                style={{ backgroundColor: accentColor }}
                className="w-full py-2 px-3 text-sm font-medium text-white rounded-lg cursor-pointer"
              >
                Adicionar
              </button>
            </div>
          </form>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {party.map((m) => (
              <div
                key={m.id}
                className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-4 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-12 w-12 rounded-full overflow-hidden shrink-0 border border-stone-200 dark:border-stone-700">
                    <SafeImage src={m.photoUrl} alt={m.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium" style={{ color: accentColor }}>
                      {m.role}
                    </p>
                    <p className="text-sm font-semibold truncate">{m.name}</p>
                    {m.description && <p className="text-xs text-stone-500 truncate">{m.description}</p>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => deletePartyMember(wedding.id, m.id)}
                  className="p-1.5 text-stone-400 hover:text-red-600 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {subTab === 'gifts' && (
        <div className="space-y-6">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!gTitle.trim()) return;
              await addGiftItem(wedding.id, wedding.ownerId, {
                title: gTitle,
                category: gCat,
                price: Number(gPrice) || 100,
                description: gDesc,
              });
              setGTitle('');
              setGDesc('');
            }}
            className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-5 grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
          >
            <div className="md:col-span-3">
              <label className="block text-xs text-stone-500 mb-1">Presente Simbólico</label>
              <input
                required
                maxLength={120}
                value={gTitle}
                onChange={(e) => setGTitle(e.target.value)}
                placeholder="Ex.: Passeio na Lua de Mel"
                className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-stone-500 mb-1">Categoria</label>
              <input
                maxLength={60}
                value={gCat}
                onChange={(e) => setGCat(e.target.value)}
                className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div className="md:col-span-2">
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
            <div className="md:col-span-3">
              <label className="block text-xs text-stone-500 mb-1">Descrição</label>
              <input
                maxLength={300}
                value={gDesc}
                onChange={(e) => setGDesc(e.target.value)}
                placeholder="Mensagem do presente"
                className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <button
                type="submit"
                style={{ backgroundColor: accentColor }}
                className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 text-sm font-medium text-white rounded-lg cursor-pointer"
              >
                <Gift className="w-4 h-4" />
                <span>Criar Cota</span>
              </button>
            </div>
          </form>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {gifts.map((g) => (
              <div
                key={g.id}
                className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-4 flex items-start justify-between gap-3"
              >
                <div>
                  <p className="text-xs text-stone-500">{g.category}</p>
                  <p className="text-sm font-semibold mt-0.5">{g.title}</p>
                  <p className="font-mono text-sm font-semibold tabular-nums mt-2" style={{ color: accentColor }}>
                    {formatBRL(g.price)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteGiftItem(wedding.id, g.id)}
                  className="p-1.5 text-stone-400 hover:text-red-600 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {contributions.length > 0 && (
            <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-5">
              <h3 className="text-sm font-semibold mb-3">Presentes Pix Recebidos pelo Site</h3>
              <div className="divide-y divide-stone-100 dark:divide-stone-800">
                {contributions.map((c) => (
                  <div key={c.id} className="py-3 flex items-center justify-between gap-4 text-sm">
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
    </div>
  );
};
