import React, { useMemo, useState } from 'react';
import { BarChart3, Download, PieChart as PieChartIcon, TrendingDown, TrendingUp } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Expense, GiftContribution, Guest, Vendor, Wedding } from '../../types/wedding';
import { downloadCSV, formatBRL } from '../../lib/utils';

interface AnalyticsModuleProps {
  wedding: Wedding;
  expenses: Expense[];
  vendors: Vendor[];
  guests: Guest[];
  contributions: GiftContribution[];
  accentColor: string;
}

type PieScope = 'all' | 'paid' | 'pending';
type BarMode = 'budget_vs_spent' | 'by_category';

const CATEGORY_COLORS = [
  '#4A5D4E',
  '#B47B44',
  '#3B5978',
  '#9A5461',
  '#64567A',
  '#2A5B4C',
  '#D97706',
  '#0F766E',
  '#7C3AED',
  '#64748B',
];

function formatCompactBRL(value: number): string {
  if (Math.abs(value) >= 1000) {
    return `R$ ${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
  }
  return `R$ ${Math.round(value)}`;
}

export const AnalyticsModule: React.FC<AnalyticsModuleProps> = ({
  wedding,
  expenses,
  vendors,
  guests,
  contributions,
  accentColor,
}) => {
  const [pieScope, setPieScope] = useState<PieScope>('all');
  const [barMode, setBarMode] = useState<BarMode>('budget_vs_spent');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const metrics = useMemo(() => {
    const budgetLimit = wedding.budgetLimit || 0;
    const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
    const totalPaid = expenses.reduce((sum, e) => sum + e.paidAmount, 0);
    const totalPending = Math.max(0, totalSpent - totalPaid);
    const budgetRemaining = budgetLimit - totalSpent;
    const budgetUsagePct = budgetLimit > 0 ? Math.round((totalSpent / budgetLimit) * 100) : 0;
    const paidPct = totalSpent > 0 ? Math.round((totalPaid / totalSpent) * 100) : 0;

    const confirmedPeople = guests
      .filter((g) => g.status === 'confirmed')
      .reduce((sum, g) => sum + g.adults + g.children, 0);
    const costPerGuest = confirmedPeople > 0 ? totalSpent / confirmedPeople : 0;
    const giftsTotal = contributions.reduce((sum, c) => sum + c.amount, 0);

    return {
      budgetLimit,
      totalSpent,
      totalPaid,
      totalPending,
      budgetRemaining,
      budgetUsagePct,
      paidPct,
      confirmedPeople,
      costPerGuest,
      giftsTotal,
      isOverBudget: budgetLimit > 0 && totalSpent > budgetLimit,
    };
  }, [wedding.budgetLimit, expenses, guests, contributions]);

  const categoryBreakdown = useMemo(() => {
    const map = new Map<
      string,
      { category: string; shortLabel: string; count: number; total: number; paid: number; pending: number }
    >();

    expenses.forEach((e) => {
      const key = e.category || 'Outros';
      const existing = map.get(key) || {
        category: key,
        shortLabel: key.split(' ')[0].replace(/,$/, ''),
        count: 0,
        total: 0,
        paid: 0,
        pending: 0,
      };
      existing.count += 1;
      existing.total += e.amount;
      existing.paid += e.paidAmount;
      existing.pending += Math.max(0, e.amount - e.paidAmount);
      map.set(key, existing);
    });

    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .map((item, index) => ({
        ...item,
        color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
        sharePct: metrics.totalSpent > 0 ? Math.round((item.total / metrics.totalSpent) * 100) : 0,
        paidPct: item.total > 0 ? Math.round((item.paid / item.total) * 100) : 0,
      }));
  }, [expenses, metrics.totalSpent]);

  const pieData = useMemo(() => {
    const rows = categoryBreakdown
      .map((item) => {
        const value =
          pieScope === 'paid' ? item.paid : pieScope === 'pending' ? item.pending : item.total;
        return {
          name: item.category,
          value,
          color: item.color,
          count: item.count,
        };
      })
      .filter((row) => row.value > 0);

    const sum = rows.reduce((s, r) => s + r.value, 0);
    return rows.map((r) => ({
      ...r,
      pct: sum > 0 ? Math.round((r.value / sum) * 100) : 0,
    }));
  }, [categoryBreakdown, pieScope]);

  const budgetComparisonData = useMemo(() => {
    return [
      {
        name: 'Orçamento Definido',
        valor: metrics.budgetLimit,
        fill: accentColor,
      },
      {
        name: 'Total Gasto',
        valor: metrics.totalSpent,
        fill: metrics.isOverBudget ? '#DC2626' : '#3B5978',
      },
      {
        name: 'Valor Pago',
        valor: metrics.totalPaid,
        fill: '#15803D',
      },
      {
        name: 'Valor Pendente',
        valor: metrics.totalPending,
        fill: '#D97706',
      },
    ];
  }, [metrics, accentColor]);

  const topCategory = categoryBreakdown[0];

  const handleExportAnalyticsCSV = () => {
    downloadCSV(
      `analytics-${wedding.slug}.csv`,
      ['Categoria', 'Itens', 'Total Gasto (R$)', 'Valor Pago (R$)', 'Valor Pendente (R$)', '% do Total'],
      categoryBreakdown.map((c) => [
        c.category,
        c.count,
        c.total.toFixed(2),
        c.paid.toFixed(2),
        c.pending.toFixed(2),
        `${c.sharePct}%`,
      ])
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-editorial text-3xl font-semibold">Analytics do Casamento</h2>
          <p className="text-sm text-stone-600 dark:text-stone-400">
            Visualize a distribuição de gastos por categoria e compare o orçamento definido com o total gasto em tempo real.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportAnalyticsCSV}
          className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#171A21] px-4 py-2 text-xs font-medium hover:bg-stone-50 dark:hover:bg-stone-800 cursor-pointer shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Exportar Análise (CSV)</span>
        </button>
      </div>

      {/* 4 Semantic KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-5">
          <p className="text-xs font-medium text-stone-500">Orçamento Definido</p>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums" style={{ color: accentColor }}>
            {formatBRL(metrics.budgetLimit)}
          </p>
          <p className="mt-1.5 text-xs text-stone-500">
            {vendors.length} fornecedor(es) · {expenses.length} lançamento(s)
          </p>
        </div>

        <div
          className={`rounded-2xl border p-5 ${
            metrics.isOverBudget
              ? 'border-red-200 dark:border-red-900/60 bg-red-50/75 dark:bg-red-950/25'
              : 'border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21]'
          }`}
        >
          <p className="text-xs font-medium text-stone-500">Total Gasto (Contratado)</p>
          <p
            className={`mt-2 font-mono text-2xl font-semibold tabular-nums ${
              metrics.isOverBudget ? 'text-red-700 dark:text-red-400' : 'text-stone-900 dark:text-stone-100'
            }`}
          >
            {formatBRL(metrics.totalSpent)}
          </p>
          <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-mono tabular-nums text-stone-600 dark:text-stone-400">
            {metrics.isOverBudget ? (
              <TrendingUp className="w-3.5 h-3.5 text-red-600" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-emerald-600" />
            )}
            <span>{metrics.budgetUsagePct}% do orçamento definido</span>
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/75 dark:bg-emerald-950/25 p-5">
          <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">Total Pago</p>
          <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
            {formatBRL(metrics.totalPaid)}
          </p>
          <p className="mt-1.5 text-xs text-emerald-800/80 dark:text-emerald-300/80 tabular-nums">
            {metrics.paidPct}% quitado · Pendente: {formatBRL(metrics.totalPending)}
          </p>
        </div>

        <div
          className={`rounded-2xl border p-5 ${
            metrics.isOverBudget
              ? 'border-red-200 dark:border-red-900/60 bg-red-50/75 dark:bg-red-950/25'
              : 'border-amber-200/80 dark:border-amber-900/60 bg-amber-50/75 dark:bg-amber-950/25'
          }`}
        >
          <p className="text-xs font-medium text-stone-600 dark:text-stone-300">
            {metrics.isOverBudget ? 'Orçamento Excedido em' : 'Saldo Disponível do Orçamento'}
          </p>
          <p
            className={`mt-2 font-mono text-2xl font-semibold tabular-nums ${
              metrics.isOverBudget ? 'text-red-700 dark:text-red-400' : 'text-amber-800 dark:text-amber-300'
            }`}
          >
            {formatBRL(Math.abs(metrics.budgetRemaining))}
          </p>
          <p className="mt-1.5 text-xs text-stone-600 dark:text-stone-400 truncate">
            {topCategory
              ? `Maior peso: ${topCategory.category} (${topCategory.sharePct}%)`
              : 'Adicione despesas para analisar'}
          </p>
        </div>
      </div>

      {/* Main Charts Grid: Pie Chart + Comparative Bar Chart */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Pie Chart: Distribuição de Gastos por Categoria */}
        <div className="xl:col-span-6 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <PieChartIcon className="w-4 h-4" style={{ color: accentColor }} />
              <div>
                <h3 className="font-editorial text-2xl font-semibold leading-tight">
                  Distribuição por Categoria
                </h3>
                <p className="text-xs text-stone-500">Participação percentual de cada categoria no orçamento</p>
              </div>
            </div>

            <div className="inline-flex items-center gap-1 rounded-xl bg-stone-100 dark:bg-stone-800 p-1">
              {(
                [
                  ['all', 'Total'],
                  ['paid', 'Pago'],
                  ['pending', 'Pendente'],
                ] as const
              ).map(([scope, label]) => (
                <button
                  key={scope}
                  type="button"
                  onClick={() => setPieScope(scope)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                    pieScope === scope
                      ? 'bg-white dark:bg-[#1C2029] text-stone-900 dark:text-stone-100 shadow-xs'
                      : 'text-stone-600 dark:text-stone-400'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {pieData.length === 0 ? (
            <div className="h-72 flex items-center justify-center text-xs text-stone-400 text-center px-6">
              Nenhum valor encontrado para o filtro selecionado. Cadastre fornecedores ou despesas para visualizar o gráfico de pizza.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
              <div className="md:col-span-6 h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={56}
                      outerRadius={96}
                      paddingAngle={2}
                      onMouseEnter={(_, idx) => setActiveCategory(pieData[idx]?.name || null)}
                      onMouseLeave={() => setActiveCategory(null)}
                    >
                      {pieData.map((entry) => (
                        <Cell
                          key={entry.name}
                          fill={entry.color}
                          opacity={activeCategory && activeCategory !== entry.name ? 0.45 : 1}
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val) => formatBRL(Number(val) || 0)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="md:col-span-6 space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {pieData.map((item) => (
                  <div
                    key={item.name}
                    onMouseEnter={() => setActiveCategory(item.name)}
                    onMouseLeave={() => setActiveCategory(null)}
                    className={`rounded-xl px-3 py-2 transition-colors ${
                      activeCategory === item.name
                        ? 'bg-stone-100 dark:bg-stone-800/80'
                        : 'bg-stone-50/70 dark:bg-stone-900/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="inline-flex items-center gap-2 font-medium truncate">
                        <span
                          className="h-2.5 w-2.5 rounded-sm shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="truncate">{item.name}</span>
                      </span>
                      <span className="font-mono font-semibold tabular-nums shrink-0">
                        {item.pct}%
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-stone-500 font-mono tabular-nums">
                      <span>{item.count} item(ns)</span>
                      <span>{formatBRL(item.value)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bar Chart: Comparativo Orçamento Definido vs. Total Gasto */}
        <div className="xl:col-span-6 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" style={{ color: accentColor }} />
              <div>
                <h3 className="font-editorial text-2xl font-semibold leading-tight">
                  Orçamento vs. Total Gasto
                </h3>
                <p className="text-xs text-stone-500">
                  {barMode === 'budget_vs_spent'
                    ? 'Comparativo direto entre teto planejado, gasto contratado, pago e pendente'
                    : 'Comparativo de valor pago vs. pendente em cada categoria'}
                </p>
              </div>
            </div>

            <div className="inline-flex items-center gap-1 rounded-xl bg-stone-100 dark:bg-stone-800 p-1">
              <button
                type="button"
                onClick={() => setBarMode('budget_vs_spent')}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                  barMode === 'budget_vs_spent'
                    ? 'bg-white dark:bg-[#1C2029] text-stone-900 dark:text-stone-100 shadow-xs'
                    : 'text-stone-600 dark:text-stone-400'
                }`}
              >
                Orçamento vs Gasto
              </button>
              <button
                type="button"
                onClick={() => setBarMode('by_category')}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                  barMode === 'by_category'
                    ? 'bg-white dark:bg-[#1C2029] text-stone-900 dark:text-stone-100 shadow-xs'
                    : 'text-stone-600 dark:text-stone-400'
                }`}
              >
                Por Categoria
              </button>
            </div>
          </div>

          <div className="h-72 w-full">
            {barMode === 'budget_vs_spent' ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={budgetComparisonData}
                  margin={{ top: 10, right: 16, left: 4, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E7E5E4" opacity={0.5} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#78716C' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={formatCompactBRL}
                    tick={{ fontSize: 11, fill: '#78716C' }}
                    axisLine={false}
                    tickLine={false}
                    width={64}
                  />
                  <Tooltip formatter={(val) => formatBRL(Number(val) || 0)} />
                  <Bar dataKey="valor" name="Valor" radius={[8, 8, 0, 0]} maxBarSize={56}>
                    {budgetComparisonData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : categoryBreakdown.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-stone-400">
                Cadastre despesas para visualizar o comparativo por categoria.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={categoryBreakdown}
                  margin={{ top: 10, right: 16, left: 4, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E7E5E4" opacity={0.5} />
                  <XAxis
                    dataKey="shortLabel"
                    tick={{ fontSize: 11, fill: '#78716C' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={formatCompactBRL}
                    tick={{ fontSize: 11, fill: '#78716C' }}
                    axisLine={false}
                    tickLine={false}
                    width={64}
                  />
                  <Tooltip formatter={(val) => formatBRL(Number(val) || 0)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="paid" name="Pago" stackId="cat" fill="#15803D" radius={[0, 0, 4, 4]} maxBarSize={42} />
                  <Bar dataKey="pending" name="Pendente" stackId="cat" fill="#D97706" radius={[6, 6, 0, 0]} maxBarSize={42} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Secondary Insights + Category Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-6 space-y-4">
          <h3 className="font-editorial text-2xl font-semibold">Indicadores Complementares</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between py-2.5 border-b border-stone-100 dark:border-stone-800">
              <span className="text-stone-600 dark:text-stone-400">Custo médio por convidado confirmado</span>
              <span className="font-mono font-semibold tabular-nums">
                {metrics.confirmedPeople > 0 ? formatBRL(metrics.costPerGuest) : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between py-2.5 border-b border-stone-100 dark:border-stone-800">
              <span className="text-stone-600 dark:text-stone-400">Convidados confirmados</span>
              <span className="font-mono font-semibold tabular-nums">{metrics.confirmedPeople}</span>
            </div>
            <div className="flex items-center justify-between py-2.5 border-b border-stone-100 dark:border-stone-800">
              <span className="text-stone-600 dark:text-stone-400">Presentes Pix arrecadados</span>
              <span className="font-mono font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                {formatBRL(metrics.giftsTotal)}
              </span>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <span className="text-stone-600 dark:text-stone-400">Reserva acumulada pelo casal</span>
              <span className="font-mono font-semibold tabular-nums">
                {formatBRL(wedding.savingsCurrent || 0)}
              </span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-8 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] overflow-hidden">
          <div className="px-6 py-4 border-b border-stone-200 dark:border-stone-800">
            <h3 className="font-editorial text-2xl font-semibold">Detalhamento por Categoria</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-stone-200 dark:border-stone-800 text-xs text-stone-500">
                  <th className="py-3 px-5 font-medium">Categoria</th>
                  <th className="py-3 px-4 font-medium text-right">Total Gasto</th>
                  <th className="py-3 px-4 font-medium text-right">Pago</th>
                  <th className="py-3 px-4 font-medium text-right">Pendente</th>
                  <th className="py-3 px-4 font-medium text-right">Peso</th>
                  <th className="py-3 px-5 font-medium w-32">Quitação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800/80">
                {categoryBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-stone-400">
                      Nenhuma categoria com gastos registrados ainda.
                    </td>
                  </tr>
                ) : (
                  categoryBreakdown.map((row) => (
                    <tr key={row.category} className="hover:bg-stone-50/70 dark:hover:bg-stone-800/30">
                      <td className="py-3 px-5">
                        <span className="inline-flex items-center gap-2 font-medium">
                          <span
                            className="h-2.5 w-2.5 rounded-sm shrink-0"
                            style={{ backgroundColor: row.color }}
                          />
                          <span>{row.category}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-medium">
                        {formatBRL(row.total)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                        {formatBRL(row.paid)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-amber-700 dark:text-amber-400">
                        {formatBRL(row.pending)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-stone-500">
                        {row.sharePct}%
                      </td>
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-emerald-600"
                              style={{ width: `${row.paidPct}%` }}
                            />
                          </div>
                          <span className="font-mono text-[11px] tabular-nums text-stone-500 w-8 text-right">
                            {row.paidPct}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
