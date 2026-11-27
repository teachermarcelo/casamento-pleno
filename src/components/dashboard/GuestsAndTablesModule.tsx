import React, { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  GripVertical,
  MessageCircle,
  Plus,
  Search,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  GUEST_GROUPS,
  type Guest,
  type SeatingTable,
  type Wedding,
} from '../../types/wedding';
import {
  addGuest,
  addSeatingTable,
  deleteGuest,
  deleteSeatingTable,
  updateGuest,
} from '../../lib/weddingService';
import { downloadCSV, getGuestSiteUrl } from '../../lib/utils';

interface GuestsModuleProps {
  wedding: Wedding;
  guests: Guest[];
  accentColor: string;
}

export const GuestsModule: React.FC<GuestsModuleProps> = ({ wedding, guests, accentColor }) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Guest['status']>('all');
  const [copiedLink, setCopiedLink] = useState(false);

  const [name, setName] = useState('');
  const [group, setGroup] = useState<string>(GUEST_GROUPS[0]);
  const [phone, setPhone] = useState('');
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [status, setStatus] = useState<Guest['status']>('pending');
  const [saving, setSaving] = useState(false);

  const siteUrl = getGuestSiteUrl(wedding.slug);

  const stats = useMemo(() => {
    const confirmed = guests.filter((g) => g.status === 'confirmed');
    const pending = guests.filter((g) => g.status === 'pending');
    const declined = guests.filter((g) => g.status === 'declined');
    const totalAdults = guests.reduce((s, g) => s + g.adults, 0);
    const totalChildren = guests.reduce((s, g) => s + g.children, 0);
    const confirmedPeople = confirmed.reduce((s, g) => s + g.adults + g.children, 0);
    return {
      totalEntries: guests.length,
      totalPeople: totalAdults + totalChildren,
      confirmedCount: confirmed.length,
      confirmedPeople,
      pendingPeople: pending.reduce((s, g) => s + g.adults + g.children, 0),
      declinedPeople: declined.reduce((s, g) => s + g.adults + g.children, 0),
      totalAdults,
      totalChildren,
    };
  }, [guests]);

  const chartData = [
    { name: 'Confirmados', value: stats.confirmedPeople, color: '#16A34A' },
    { name: 'Pendentes', value: stats.pendingPeople, color: '#D97706' },
    { name: 'Recusados', value: stats.declinedPeople, color: '#DC2626' },
    { name: 'Adultos', value: stats.totalAdults, color: accentColor },
    { name: 'Crianças', value: stats.totalChildren, color: '#78716C' },
  ];

  const filtered = useMemo(() => {
    return guests.filter((g) => {
      if (statusFilter !== 'all' && g.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return g.name.toLowerCase().includes(q) || g.group.toLowerCase().includes(q);
      }
      return true;
    });
  }, [guests, statusFilter, search]);

  const handleAddGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await addGuest(wedding.id, wedding.ownerId, { name, group, phone, adults, children, status });
      setName('');
      setPhone('');
      setAdults(2);
      setChildren(0);
      setStatus('pending');
    } finally {
      setSaving(false);
    }
  };

  const buildWhatsAppLink = (guest?: Guest) => {
    const greeting = guest ? `Olá, ${guest.name}! ` : 'Olá! ';
    const msg = `${greeting}Você é muito especial para nós. Confirme sua presença no casamento de ${wedding.brideName} & ${wedding.groomName} pelo link: ${siteUrl}`;
    const digits = guest?.phone?.replace(/\D/g, '') || '';
    const phonePrefix = digits.length >= 10 ? `55${digits.replace(/^55/, '')}` : '';
    return `https://wa.me/${phonePrefix}?text=${encodeURIComponent(msg)}`;
  };

  const handleExportCSV = () => {
    downloadCSV(
      `convidados-${wedding.slug}.csv`,
      ['Nome', 'Grupo', 'Telefone', 'Adultos', 'Crianças', 'Status', 'Origem', 'Recado'],
      guests.map((g) => [
        g.name,
        g.group,
        g.phone || '',
        g.adults,
        g.children,
        g.status === 'confirmed' ? 'Confirmado' : g.status === 'declined' ? 'Recusado' : 'Pendente',
        g.source === 'public_rsvp' ? 'Site' : 'Painel',
        g.rsvpMessage || '',
      ])
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-editorial text-3xl font-semibold">Convidados & RSVP</h2>
          <p className="text-sm text-stone-600 dark:text-stone-400">
            Cada confirmação feita no site dos convidados aparece aqui em tempo real.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(siteUrl);
              setCopiedLink(true);
              setTimeout(() => setCopiedLink(false), 2000);
            }}
            className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#171A21] px-3 py-2 text-xs font-medium hover:bg-stone-50 dark:hover:bg-stone-800 cursor-pointer"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedLink ? 'Link copiado' : 'Copiar link RSVP'}</span>
          </button>
          <a
            href={buildWhatsAppLink()}
            target="_blank"
            rel="noreferrer"
            className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#171A21] px-3 py-2 text-xs font-medium hover:bg-stone-50 dark:hover:bg-stone-800"
          >
            <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
            <span>WhatsApp</span>
          </a>
          <button
            type="button"
            onClick={handleExportCSV}
            className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#171A21] px-3 py-2 text-xs font-medium hover:bg-stone-50 dark:hover:bg-stone-800 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* KPI & Chart Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
        <div className="lg:col-span-5 grid grid-cols-2 gap-3 sm:gap-4">
          <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-3.5 sm:p-5 min-w-0">
            <p className="text-[11px] sm:text-xs text-stone-500 dark:text-stone-400 truncate">Total de Pessoas</p>
            <p className="mt-1.5 sm:mt-2 font-mono text-2xl sm:text-3xl font-semibold tabular-nums">{stats.totalPeople}</p>
            <p className="mt-1 text-[11px] sm:text-xs text-stone-500 tabular-nums">
              {stats.totalAdults} ad. · {stats.totalChildren} cri.
            </p>
          </div>
          <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-3.5 sm:p-5 min-w-0">
            <p className="text-[11px] sm:text-xs text-stone-500 dark:text-stone-400 truncate">Confirmados</p>
            <p className="mt-1.5 sm:mt-2 font-mono text-2xl sm:text-3xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
              {stats.confirmedPeople}
            </p>
            <p className="mt-1 text-[11px] sm:text-xs text-stone-500 tabular-nums">
              {stats.confirmedCount} convite(s)
            </p>
          </div>
          <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-3.5 sm:p-5 min-w-0">
            <p className="text-[11px] sm:text-xs text-stone-500 dark:text-stone-400 truncate">Aguardando</p>
            <p className="mt-1.5 sm:mt-2 font-mono text-2xl sm:text-3xl font-semibold tabular-nums text-amber-700 dark:text-amber-400">
              {stats.pendingPeople}
            </p>
          </div>
          <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-3.5 sm:p-5 min-w-0">
            <p className="text-[11px] sm:text-xs text-stone-500 dark:text-stone-400 truncate">Recusados</p>
            <p className="mt-1.5 sm:mt-2 font-mono text-2xl sm:text-3xl font-semibold tabular-nums text-red-700 dark:text-red-400">
              {stats.declinedPeople}
            </p>
          </div>
        </div>

        <div className="lg:col-span-7 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-4 sm:p-5">
          <p className="text-xs font-medium text-stone-500 dark:text-stone-400 mb-3">
            Distribuição de Convidados (em número de pessoas)
          </p>
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#78716C' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#78716C' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #E7E5E4',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={40}>
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Add Guest Form */}
      <form
        onSubmit={handleAddGuest}
        className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-4 sm:p-5 grid grid-cols-2 md:grid-cols-12 gap-3 items-end"
      >
        <div className="col-span-2 md:col-span-3">
          <label className="block text-xs text-stone-500 mb-1">Nome / Família</label>
          <input
            required
            minLength={2}
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Família Oliveira"
            className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-sm"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs text-stone-500 mb-1">Grupo</label>
          <select
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#171A21] px-2.5 py-2 text-sm"
          >
            {GUEST_GROUPS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs text-stone-500 mb-1">WhatsApp</label>
          <input
            maxLength={30}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(11) 99999-0000"
            className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-sm"
          />
        </div>
        <div className="md:col-span-1">
          <label className="block text-xs text-stone-500 mb-1">Adultos</label>
          <input
            type="number"
            min={1}
            max={20}
            value={adults}
            onChange={(e) => setAdults(Number(e.target.value))}
            className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-2.5 py-2 text-sm font-mono"
          />
        </div>
        <div className="md:col-span-1">
          <label className="block text-xs text-stone-500 mb-1">Crianças</label>
          <input
            type="number"
            min={0}
            max={20}
            value={children}
            onChange={(e) => setChildren(Number(e.target.value))}
            className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-2.5 py-2 text-sm font-mono"
          />
        </div>
        <div className="col-span-2 md:col-span-1">
          <label className="block text-xs text-stone-500 mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as Guest['status'])}
            className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#171A21] px-2.5 py-2 text-sm md:text-xs"
          >
            <option value="pending">Pendente</option>
            <option value="confirmed">Confirmado</option>
            <option value="declined">Recusado</option>
          </select>
        </div>
        <div className="col-span-2 md:col-span-2">
          <button
            type="submit"
            disabled={saving}
            style={{ backgroundColor: accentColor }}
            className="w-full min-h-[42px] inline-flex items-center justify-center gap-1.5 py-2 px-3 text-sm font-medium text-white rounded-lg hover:brightness-110 cursor-pointer disabled:opacity-60"
          >
            <UserPlus className="w-4 h-4" />
            <span>Adicionar</span>
          </button>
        </div>
      </form>

      {/* Filter & Guest Table */}
      <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] overflow-hidden">
        <div className="p-3.5 sm:p-4 border-b border-stone-200 dark:border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar convidado ou grupo..."
              className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent pl-9 pr-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar max-w-full rounded-lg bg-stone-100 dark:bg-stone-800 p-1">
            {(
              [
                ['all', 'Todos'],
                ['confirmed', 'Confirmados'],
                ['pending', 'Pendentes'],
                ['declined', 'Recusados'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key)}
                className={`shrink-0 whitespace-nowrap min-h-[34px] px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  statusFilter === key
                    ? 'bg-white dark:bg-[#1C2029] text-stone-900 dark:text-stone-100 shadow-xs'
                    : 'text-stone-600 dark:text-stone-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden divide-y divide-stone-100 dark:divide-stone-800/80">
          {filtered.length === 0 ? (
            <div className="py-10 px-4 text-center text-sm text-stone-500">
              Nenhum convidado encontrado com os filtros atuais.
            </div>
          ) : (
            filtered.map((guest) => (
              <div key={guest.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-stone-900 dark:text-stone-100 break-words">
                      {guest.name}
                    </p>
                    <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
                      {guest.group} · {guest.source === 'public_rsvp' ? 'Via Site' : 'Painel'}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono tabular-nums text-xs text-stone-600 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 px-2 py-1 rounded-md">
                    {guest.adults} ad. / {guest.children} cri.
                  </span>
                </div>
                {(guest.dietaryNotes || guest.rsvpMessage) && (
                  <p className="text-xs text-stone-500 dark:text-stone-400 bg-stone-50 dark:bg-stone-900/50 rounded-lg px-2.5 py-1.5">
                    {guest.dietaryNotes || guest.rsvpMessage}
                  </p>
                )}
                <div className="flex items-center gap-2 pt-0.5">
                  <select
                    value={guest.status}
                    onChange={(e) =>
                      updateGuest(wedding.id, guest.id, { status: e.target.value as Guest['status'] })
                    }
                    className={`flex-1 min-h-[40px] rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#171A21] px-3 py-1.5 text-xs font-semibold ${
                      guest.status === 'confirmed'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : guest.status === 'declined'
                        ? 'text-red-700 dark:text-red-400'
                        : 'text-amber-700 dark:text-amber-400'
                    }`}
                  >
                    <option value="pending">Pendente</option>
                    <option value="confirmed">Confirmado</option>
                    <option value="declined">Recusado</option>
                  </select>
                  <a
                    href={buildWhatsAppLink(guest)}
                    target="_blank"
                    rel="noreferrer"
                    title="Enviar convite RSVP pelo WhatsApp"
                    className="h-10 w-10 shrink-0 flex items-center justify-center rounded-lg border border-emerald-200 dark:border-emerald-900/60 text-emerald-700 dark:text-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/30"
                  >
                    <MessageCircle className="w-4 h-4" />
                  </a>
                  <button
                    type="button"
                    onClick={() => deleteGuest(wedding.id, guest.id)}
                    title="Remover convidado"
                    className="h-10 w-10 shrink-0 flex items-center justify-center rounded-lg border border-stone-200 dark:border-stone-700 text-stone-500 hover:text-red-600 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-stone-200 dark:border-stone-800 text-xs text-stone-500 dark:text-stone-400">
                <th className="py-3 px-4 font-medium">Convidado</th>
                <th className="py-3 px-4 font-medium">Grupo</th>
                <th className="py-3 px-4 font-medium text-right">Adultos / Crianças</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800/80">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-sm text-stone-500">
                    Nenhum convidado encontrado com os filtros atuais.
                  </td>
                </tr>
              ) : (
                filtered.map((guest) => (
                  <tr key={guest.id} className="hover:bg-stone-50/80 dark:hover:bg-stone-800/30">
                    <td className="py-3 px-4">
                      <p className="font-medium text-stone-900 dark:text-stone-100">{guest.name}</p>
                      {(guest.dietaryNotes || guest.rsvpMessage) && (
                        <p className="text-xs text-stone-500 truncate max-w-xs">
                          {guest.dietaryNotes || guest.rsvpMessage}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-stone-600 dark:text-stone-400">
                      {guest.group} · {guest.source === 'public_rsvp' ? 'Via Site' : 'Painel'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-xs">
                      {guest.adults} ad. / {guest.children} cri.
                    </td>
                    <td className="py-3 px-4">
                      <select
                        value={guest.status}
                        onChange={(e) =>
                          updateGuest(wedding.id, guest.id, { status: e.target.value as Guest['status'] })
                        }
                        className={`rounded-md border border-stone-200 dark:border-stone-700 bg-transparent px-2 py-1 text-xs font-medium ${
                          guest.status === 'confirmed'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : guest.status === 'declined'
                            ? 'text-red-700 dark:text-red-400'
                            : 'text-amber-700 dark:text-amber-400'
                        }`}
                      >
                        <option value="pending">Pendente</option>
                        <option value="confirmed">Confirmado</option>
                        <option value="declined">Recusado</option>
                      </select>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <a
                          href={buildWhatsAppLink(guest)}
                          target="_blank"
                          rel="noreferrer"
                          title="Enviar convite RSVP pelo WhatsApp"
                          className="p-1.5 rounded-lg text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </a>
                        <button
                          type="button"
                          onClick={() => deleteGuest(wedding.id, guest.id)}
                          title="Remover convidado"
                          className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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
  );
};

// ============================================================================
// Módulo 2: Mapa de Mesas Interativo (Drag & Drop + Touch Assign)
// ============================================================================
interface TablesModuleProps {
  wedding: Wedding;
  guests: Guest[];
  tables: SeatingTable[];
  accentColor: string;
}

export const TablesModule: React.FC<TablesModuleProps> = ({
  wedding,
  guests,
  tables,
  accentColor,
}) => {
  const [tableName, setTableName] = useState('');
  const [capacity, setCapacity] = useState(8);
  const [shape, setShape] = useState<'round' | 'rectangular'>('round');
  const [zone, setZone] = useState('Salão Principal');
  const [draggingGuestId, setDraggingGuestId] = useState<string | null>(null);
  const [dragOverTableId, setDragOverTableId] = useState<string | null>(null);

  const confirmedGuests = useMemo(
    () => guests.filter((g) => g.status === 'confirmed'),
    [guests]
  );

  const unassignedGuests = useMemo(
    () => confirmedGuests.filter((g) => !g.tableId || !tables.some((t) => t.id === g.tableId)),
    [confirmedGuests, tables]
  );

  const handleAddTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableName.trim()) return;
    await addSeatingTable(wedding.id, wedding.ownerId, {
      name: tableName,
      capacity,
      shape,
      zone,
    });
    setTableName('');
    setCapacity(8);
  };

  const assignGuestToTable = async (guestId: string, tableId: string) => {
    await updateGuest(wedding.id, guestId, { tableId });
  };

  const handleDropOnTable = async (e: React.DragEvent, tableId: string) => {
    e.preventDefault();
    const guestId = e.dataTransfer.getData('text/plain') || draggingGuestId;
    setDragOverTableId(null);
    setDraggingGuestId(null);
    if (guestId) {
      await assignGuestToTable(guestId, tableId);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-editorial text-3xl font-semibold">Mapa de Mesas Interativo</h2>
        <p className="text-sm text-stone-600 dark:text-stone-400">
          Arraste e solte convidados confirmados diretamente para cada mesa, ou use o seletor rápido no celular.
        </p>
      </div>

      {/* Create Table Form */}
      <form
        onSubmit={handleAddTable}
        className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-4 sm:p-5 grid grid-cols-2 sm:grid-cols-12 gap-3 items-end"
      >
        <div className="col-span-2 sm:col-span-4">
          <label className="block text-xs text-stone-500 mb-1">Nome da Mesa</label>
          <input
            required
            maxLength={80}
            value={tableName}
            onChange={(e) => setTableName(e.target.value)}
            placeholder="Ex.: Mesa 03 — Amigos"
            className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-sm"
          />
        </div>
        <div className="col-span-1 sm:col-span-2">
          <label className="block text-xs text-stone-500 mb-1">Lugares</label>
          <input
            type="number"
            min={2}
            max={50}
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value))}
            className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-sm font-mono"
          />
        </div>
        <div className="col-span-1 sm:col-span-2">
          <label className="block text-xs text-stone-500 mb-1">Formato</label>
          <select
            value={shape}
            onChange={(e) => setShape(e.target.value as 'round' | 'rectangular')}
            className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#171A21] px-2.5 py-2 text-sm"
          >
            <option value="round">Redonda</option>
            <option value="rectangular">Retangular</option>
          </select>
        </div>
        <div className="col-span-2 sm:col-span-2">
          <label className="block text-xs text-stone-500 mb-1">Setor</label>
          <input
            maxLength={80}
            value={zone}
            onChange={(e) => setZone(e.target.value)}
            className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-sm"
          />
        </div>
        <div className="col-span-2 sm:col-span-2">
          <button
            type="submit"
            style={{ backgroundColor: accentColor }}
            className="w-full min-h-[42px] inline-flex items-center justify-center gap-1.5 py-2 px-3 text-sm font-medium text-white rounded-lg hover:brightness-110 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Criar Mesa</span>
          </button>
        </div>
      </form>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
        {/* Unassigned Confirmed Guests Sidebar */}
        <div className="lg:col-span-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Confirmados sem mesa</h3>
            <span className="font-mono text-xs tabular-nums text-stone-500">
              {unassignedGuests.length} convites
            </span>
          </div>

          {unassignedGuests.length === 0 ? (
            <p className="text-xs text-stone-500 py-6 text-center">
              Todos os convidados confirmados já estão acomodados.
            </p>
          ) : (
            <div className="space-y-2.5">
              {unassignedGuests.map((guest) => {
                const seats = guest.adults + guest.children;
                return (
                  <div
                    key={guest.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', guest.id);
                      setDraggingGuestId(guest.id);
                    }}
                    onDragEnd={() => {
                      setDraggingGuestId(null);
                      setDragOverTableId(null);
                    }}
                    className="rounded-lg border border-stone-200 dark:border-stone-700 bg-[#FAF9F6] dark:bg-[#14171D] p-3 cursor-grab active:cursor-grabbing"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <GripVertical className="w-4 h-4 text-stone-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{guest.name}</p>
                          <p className="text-xs text-stone-500 tabular-nums">
                            {seats} {seats === 1 ? 'lugar' : 'lugares'} · {guest.group}
                          </p>
                        </div>
                      </div>
                    </div>

                    {tables.length > 0 && (
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value) assignGuestToTable(guest.id, e.target.value);
                        }}
                        className="mt-2.5 w-full rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#171A21] px-2 py-1 text-xs text-stone-600 dark:text-stone-300"
                      >
                        <option value="">Alocar rapidamente em...</option>
                        {tables.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Visual Tables Canvas */}
        <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-5">
          {tables.length === 0 ? (
            <div className="md:col-span-2 rounded-xl border border-dashed border-stone-300 dark:border-stone-700 p-12 text-center text-sm text-stone-500">
              Crie sua primeira mesa acima para começar a distribuir os convidados.
            </div>
          ) : (
            tables.map((table) => {
              const seated = confirmedGuests.filter((g) => g.tableId === table.id);
              const occupiedSeats = seated.reduce((s, g) => s + g.adults + g.children, 0);
              const isOverCapacity = occupiedSeats > table.capacity;
              const pct = Math.min(100, Math.round((occupiedSeats / Math.max(1, table.capacity)) * 100));

              return (
                <div
                  key={table.id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverTableId(table.id);
                  }}
                  onDragLeave={() => setDragOverTableId(null)}
                  onDrop={(e) => handleDropOnTable(e, table.id)}
                  className={`rounded-2xl border p-5 transition-colors bg-white dark:bg-[#171A21] ${
                    dragOverTableId === table.id
                      ? 'border-stone-900 dark:border-stone-100 ring-2 ring-stone-400/30'
                      : 'border-stone-200 dark:border-stone-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-stone-500">
                        {table.shape === 'round' ? 'Mesa Redonda' : 'Mesa Retangular'} · {table.zone || 'Salão'}
                      </p>
                      <h3 className="mt-0.5 font-editorial text-2xl font-semibold">{table.name}</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteSeatingTable(wedding.id, table.id)}
                      className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 cursor-pointer"
                      aria-label={`Remover ${table.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Occupancy Bar */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="flex items-center gap-1 text-stone-500">
                        <Users className="w-3.5 h-3.5" />
                        <span>Ocupação</span>
                      </span>
                      <span
                        className={`font-mono font-semibold tabular-nums ${
                          isOverCapacity ? 'text-red-600' : 'text-stone-700 dark:text-stone-300'
                        }`}
                      >
                        {occupiedSeats} / {table.capacity} lugares
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: isOverCapacity ? '#DC2626' : accentColor,
                        }}
                      />
                    </div>
                  </div>

                  {/* Seated List */}
                  <div className="mt-4 space-y-2 min-h-[72px]">
                    {seated.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-stone-200 dark:border-stone-800 py-5 text-center text-xs text-stone-400">
                        Solte um convidado aqui
                      </div>
                    ) : (
                      seated.map((guest) => (
                        <div
                          key={guest.id}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', guest.id);
                            setDraggingGuestId(guest.id);
                          }}
                          className="flex items-center justify-between gap-2 rounded-lg bg-[#F8F7F4] dark:bg-[#0F1115] px-3 py-2 text-xs"
                        >
                          <div className="min-w-0">
                            <span className="font-medium text-stone-800 dark:text-stone-200 truncate block">
                              {guest.name}
                            </span>
                            <span className="text-stone-500 font-mono tabular-nums">
                              {guest.adults + guest.children} pessoas
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => assignGuestToTable(guest.id, '')}
                            className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer"
                            title="Remover da mesa"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
