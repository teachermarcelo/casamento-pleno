import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Calendar, Check, Clock, Copy, Gift, Heart, MapPin, QrCode, Sparkles, X } from 'lucide-react';
import {
  GENERATED_ASSETS,
  WEDDING_THEMES,
  type GiftItem,
  type PartyMember,
  type ScheduleItem,
  type Wedding,
} from '../types/wedding';
import { submitPublicGiftContribution, submitPublicRsvp } from '../lib/weddingService';
import { buildWeddingDayICS, formatBRL, generatePixCode, getObjectPositionClass, safeExternalUrl } from '../lib/utils';
import { SafeImage } from './SafeImage';

interface GuestWeddingSiteProps {
  wedding: Wedding;
  schedule: ScheduleItem[];
  party: PartyMember[];
  gifts: GiftItem[];
  isDemo?: boolean;
  onExit?: () => void;
}

export const GuestWeddingSite: React.FC<GuestWeddingSiteProps> = ({
  wedding,
  schedule,
  party,
  gifts,
  isDemo = false,
  onExit,
}) => {
  const theme = WEDDING_THEMES[wedding.themeKey] || WEDDING_THEMES.olive;
  const accentColor = wedding.customAccentColor || theme.primary;
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [giftCategory, setGiftCategory] = useState<string>('Todos');
  const [selectedGift, setSelectedGift] = useState<GiftItem | null>(null);
  const [giverName, setGiverName] = useState('');
  const [giverMessage, setGiverMessage] = useState('');
  const [pixCopied, setPixCopied] = useState(false);
  const [giftSent, setGiftSent] = useState(false);
  const [submittingGift, setSubmittingGift] = useState(false);

  // RSVP state
  const [rsvpName, setRsvpName] = useState('');
  const [rsvpPhone, setRsvpPhone] = useState('');
  const [rsvpAdults, setRsvpAdults] = useState(2);
  const [rsvpChildren, setRsvpChildren] = useState(0);
  const [rsvpStatus, setRsvpStatus] = useState<'confirmed' | 'declined'>('confirmed');
  const [rsvpDietary, setRsvpDietary] = useState('');
  const [rsvpMessage, setRsvpMessage] = useState('');
  const [rsvpSubmitting, setRsvpSubmitting] = useState(false);
  const [rsvpDone, setRsvpDone] = useState(false);

  useEffect(() => {
    const compute = () => {
      const target = new Date(`${wedding.weddingDate}T${wedding.weddingTime || '16:30'}:00`);
      const diff = Math.max(0, target.getTime() - Date.now());
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const seconds = Math.floor((diff / 1000) % 60);
      setCountdown({ days, hours, minutes, seconds });
    };
    compute();
    const id = window.setInterval(compute, 1000);
    return () => window.clearInterval(id);
  }, [wedding.weddingDate, wedding.weddingTime]);

  const categories = useMemo(() => {
    const unique = Array.from(new Set(gifts.map((g) => g.category)));
    return ['Todos', ...unique];
  }, [gifts]);

  const filteredGifts = useMemo(
    () => (giftCategory === 'Todos' ? gifts : gifts.filter((g) => g.category === giftCategory)),
    [gifts, giftCategory]
  );

  const formattedDate = useMemo(() => {
    const d = new Date(`${wedding.weddingDate}T12:00:00`);
    if (Number.isNaN(d.getTime())) return wedding.weddingDate;
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  }, [wedding.weddingDate]);

  const pixPayload = useMemo(() => {
    if (!selectedGift) return '';
    return generatePixCode({
      pixKey: wedding.pixKey || 'presentes@casamentopleno.com.br',
      beneficiary: wedding.pixBeneficiary || `${wedding.brideName} e ${wedding.groomName}`,
      amount: selectedGift.price,
      txid: `CP${selectedGift.id.slice(-8)}`,
    });
  }, [selectedGift, wedding]);

  const handleGiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGift || !giverName.trim()) return;
    setSubmittingGift(true);
    try {
      if (!isDemo) {
        await submitPublicGiftContribution(wedding, selectedGift, {
          guestName: giverName,
          message: giverMessage,
        });
      }
      setGiftSent(true);
    } finally {
      setSubmittingGift(false);
    }
  };

  const handleRsvpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rsvpName.trim()) return;
    setRsvpSubmitting(true);
    try {
      if (!isDemo) {
        await submitPublicRsvp(wedding, {
          name: rsvpName,
          phone: rsvpPhone,
          adults: rsvpAdults,
          children: rsvpChildren,
          status: rsvpStatus,
          dietaryNotes: rsvpDietary,
          rsvpMessage,
        });
      }
      setRsvpDone(true);
    } finally {
      setRsvpSubmitting(false);
    }
  };

  const mapsLink = safeExternalUrl(wedding.venueMapsUrl) || `https://maps.google.com/?q=${encodeURIComponent(wedding.venueAddress || wedding.venueName || 'Brasil')}`;

  return (
    <div className="min-h-screen overflow-x-clip bg-[#FAF9F6] dark:bg-[#0F1115] text-stone-900 dark:text-stone-100">
      {/* Return Bar when previewing inside app */}
      {onExit && (
        <div className="bg-stone-900 text-stone-100 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 text-xs">
          <button
            type="button"
            onClick={onExit}
            className="inline-flex items-center gap-1.5 font-medium hover:underline cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
            <span>Voltar para o Casamento Pleno</span>
          </button>
          <span className="text-stone-400 hidden sm:inline truncate">
            {isDemo ? 'Site Modelo Interativo (Clara & Henrique)' : `Visualização ao vivo · /?convite=${wedding.slug}`}
          </span>
        </div>
      )}

      {/* Clean 3-Zone Editorial Top Bar */}
      <header className="sticky top-0 z-30 border-b border-stone-200/80 dark:border-stone-800/80 bg-[#FAF9F6]/95 dark:bg-[#0F1115]/95 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3 sm:gap-8">
          <a href="#topo" className="font-editorial text-xl sm:text-2xl font-semibold truncate min-w-0">
            {wedding.brideName} & {wedding.groomName}
          </a>
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-stone-600 dark:text-stone-400">
            <a href="#historia" className="hover:text-stone-900 dark:hover:text-stone-100 whitespace-nowrap shrink-0">
              História
            </a>
            <a href="#evento" className="hover:text-stone-900 dark:hover:text-stone-100 whitespace-nowrap shrink-0">
              Cerimônia
            </a>
            <a href="#padrinhos" className="hover:text-stone-900 dark:hover:text-stone-100 whitespace-nowrap shrink-0">
              Padrinhos
            </a>
            <a href="#presentes" className="hover:text-stone-900 dark:hover:text-stone-100 whitespace-nowrap shrink-0">
              Presentes
            </a>
          </nav>
          <a
            href="#rsvp"
            style={{ backgroundColor: accentColor }}
            className="inline-flex items-center justify-center min-h-[40px] px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white rounded-lg hover:brightness-110 transition-all whitespace-nowrap shrink-0"
          >
            <span className="sm:hidden">Confirmar</span>
            <span className="hidden sm:inline">Confirmar Presença</span>
          </a>
        </div>
      </header>

      {/* Hero with Editorial Photography & Live Countdown */}
      <section id="topo" className="relative min-h-[66vh] sm:min-h-[76vh] flex items-end overflow-hidden">
        <SafeImage
          src={wedding.coverPhotoUrl || GENERATED_ASSETS.heroCouple}
          alt={`Foto de capa de ${wedding.brideName} e ${wedding.groomName}`}
          className={`absolute inset-0 w-full h-full object-cover ${getObjectPositionClass(wedding.coverPhotoPosition)}`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/15" />

        <div className="relative z-10 mx-auto max-w-5xl w-full px-4 sm:px-6 py-10 sm:py-16 text-center text-white">
          <p className="text-[11px] sm:text-xs tracking-[0.18em] sm:tracking-[0.22em] uppercase opacity-90">
            Save the Date · {formattedDate}
          </p>
          <h1
            className="mt-2.5 sm:mt-3 font-editorial font-semibold tracking-tight leading-none"
            style={{ fontSize: 'clamp(2.25rem, 7vw, 5.75rem)', textWrap: 'balance' }}
          >
            {wedding.brideName} & {wedding.groomName}
          </h1>
          <p className="mt-4 sm:mt-5 mx-auto max-w-2xl text-sm sm:text-lg text-white/90 font-light leading-relaxed">
            {wedding.welcomeMessage}
          </p>

          {/* Live Countdown */}
          <div className="mt-7 sm:mt-10 mx-auto max-w-xl grid grid-cols-4 gap-2 sm:gap-5">
            {[
              { label: 'Dias', value: countdown.days },
              { label: 'Horas', value: countdown.hours },
              { label: 'Minutos', value: countdown.minutes },
              { label: 'Segundos', value: countdown.seconds },
            ].map((unit) => (
              <div
                key={unit.label}
                className="rounded-xl bg-white/12 backdrop-blur-md border border-white/20 py-3 sm:py-4 px-1.5 sm:px-2"
              >
                <p className="font-mono text-xl sm:text-4xl font-semibold tabular-nums">
                  {String(unit.value).padStart(2, '0')}
                </p>
                <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-white/80">{unit.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Nossa História */}
      <section id="historia" className="mx-auto max-w-6xl px-4 sm:px-6 py-12 sm:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-12 items-center">
          <div className="lg:col-span-6 overflow-hidden rounded-2xl border border-stone-200 dark:border-stone-800 aspect-[4/3]">
            <SafeImage
              src={wedding.couplePhotoUrl || GENERATED_ASSETS.storyCouple}
              alt={`História do casal ${wedding.brideName} e ${wedding.groomName}`}
              className={`w-full h-full object-cover ${getObjectPositionClass(wedding.couplePhotoPosition)}`}
            />
          </div>
          <div className="lg:col-span-6 space-y-4 sm:space-y-5">
            <p className="text-xs font-medium" style={{ color: accentColor }}>
              Nossa História
            </p>
            <h2 className="font-editorial text-3xl sm:text-4xl font-semibold text-stone-900 dark:text-stone-100">
              Um encontro que se transformou em lar
            </h2>
            <p className="text-[15px] sm:text-base text-stone-600 dark:text-stone-400 leading-relaxed whitespace-pre-line">
              {wedding.coupleStory || wedding.welcomeMessage}
            </p>
            <div className="pt-2 sm:pt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => buildWeddingDayICS(wedding, schedule)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 text-sm font-medium rounded-lg border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
              >
                <Calendar className="w-4 h-4" />
                <span>Salvar no Calendário (.ics)</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Cerimônia, Local & Cronograma */}
      <section id="evento" className="border-y border-stone-200 dark:border-stone-800 bg-white dark:bg-[#14171D] py-12 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto">
            <p className="text-xs font-medium" style={{ color: accentColor }}>
              Cerimônia & Recepção
            </p>
            <h2 className="mt-2 font-editorial text-3xl sm:text-4xl font-semibold">
              Detalhes do Grande Dia
            </h2>
          </div>

          <div className="mt-8 sm:mt-12 grid grid-cols-1 lg:grid-cols-12 gap-7 sm:gap-10 items-stretch">
            <div className="lg:col-span-6 rounded-2xl overflow-hidden border border-stone-200 dark:border-stone-800 min-h-[220px] sm:min-h-[300px]">
              <SafeImage
                src={GENERATED_ASSETS.venueGarden}
                alt={wedding.venueName || 'Local da cerimônia'}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="lg:col-span-6 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 shrink-0 mt-0.5" style={{ color: accentColor }} />
                  <div>
                    <p className="font-semibold text-stone-900 dark:text-stone-100">
                      {wedding.venueName || 'Local da Cerimônia'}
                    </p>
                    <p className="text-sm text-stone-600 dark:text-stone-400">
                      {wedding.venueAddress || 'Endereço informado no convite'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 shrink-0 mt-0.5" style={{ color: accentColor }} />
                  <div>
                    <p className="font-semibold text-stone-900 dark:text-stone-100">
                      {formattedDate} às {wedding.weddingTime}
                    </p>
                    <p className="text-sm text-stone-600 dark:text-stone-400">
                      Dress Code: {wedding.dressCode || 'Esporte Fino'}
                    </p>
                  </div>
                </div>
              </div>

              {schedule.length > 0 && (
                <div className="border-t border-stone-200 dark:border-stone-800 pt-5 space-y-3">
                  <p className="text-xs font-semibold text-stone-500 dark:text-stone-400">
                    Cronograma do Dia
                  </p>
                  {schedule.map((item) => (
                    <div key={item.id} className="flex items-baseline gap-3.5 sm:gap-4 text-sm">
                      <span className="font-mono font-semibold tabular-nums w-12 sm:w-14 shrink-0" style={{ color: accentColor }}>
                        {item.time}
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium text-stone-900 dark:text-stone-100">{item.title}</p>
                        {item.description && (
                          <p className="text-xs text-stone-500 dark:text-stone-400">{item.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-3 pt-2">
                <a
                  href={mapsLink}
                  target="_blank"
                  rel="noreferrer"
                  style={{ backgroundColor: accentColor }}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 text-sm font-medium text-white rounded-lg hover:brightness-110 transition-all"
                >
                  <MapPin className="w-4 h-4" />
                  <span>Abrir rota no Google Maps</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Área dos Padrinhos */}
      {party.length > 0 && (
        <section id="padrinhos" className="mx-auto max-w-6xl px-4 sm:px-6 py-12 sm:py-20">
          <div className="text-center max-w-2xl mx-auto">
            <p className="text-xs font-medium" style={{ color: accentColor }}>
              Pessoas Inesquecíveis
            </p>
            <h2 className="mt-2 font-editorial text-3xl sm:text-4xl font-semibold">
              Nossos Padrinhos e Madrinhas
            </h2>
          </div>

          <div className="mt-8 sm:mt-12 grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-6">
            {party.map((member) => (
              <div
                key={member.id}
                className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] overflow-hidden text-center"
              >
                <div className="aspect-square overflow-hidden">
                  <SafeImage
                    src={member.photoUrl}
                    alt={member.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-3.5 sm:p-5">
                  <p className="text-[11px] sm:text-xs font-medium" style={{ color: accentColor }}>
                    {member.role}
                  </p>
                  <h3 className="mt-1 font-editorial text-lg sm:text-2xl font-semibold text-stone-900 dark:text-stone-100 leading-tight">
                    {member.name}
                  </h3>
                  {member.description && (
                    <p className="mt-1.5 sm:mt-2 text-[11px] sm:text-xs text-stone-600 dark:text-stone-400 leading-relaxed line-clamp-3">
                      {member.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Lista de Presentes Inteligente (Pix) */}
      <section id="presentes" className="border-t border-stone-200 dark:border-stone-800 bg-white dark:bg-[#14171D] py-12 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 sm:gap-6">
            <div className="max-w-xl">
              <p className="text-xs font-medium" style={{ color: accentColor }}>
                Lista de Presentes Inteligente · Pix Direto
              </p>
              <h2 className="mt-2 font-editorial text-3xl sm:text-4xl font-semibold">
                Presenteie os noivos com praticidade
              </h2>
              <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
                Cada cota simbólica vai direto para a conta do casal via Pix, sem taxas intermediárias.
              </p>
            </div>

            {categories.length > 1 && (
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar max-w-full rounded-lg bg-stone-100 dark:bg-stone-800/80 p-1">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setGiftCategory(cat)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      giftCategory === cat
                        ? 'bg-white dark:bg-[#1C2029] text-stone-900 dark:text-stone-100 shadow-xs'
                        : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-8 sm:mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredGifts.map((gift) => (
              <div
                key={gift.id}
                className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-[#FAF9F6] dark:bg-[#171A21] p-5 sm:p-6 flex flex-col justify-between"
              >
                <div>
                  <p className="text-xs text-stone-500 dark:text-stone-400">{gift.category}</p>
                  <h3 className="mt-1.5 font-editorial text-2xl font-semibold text-stone-900 dark:text-stone-100">
                    {gift.title}
                  </h3>
                  {gift.description && (
                    <p className="mt-2 text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
                      {gift.description}
                    </p>
                  )}
                </div>

                <div className="mt-5 sm:mt-6 pt-4 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between gap-3">
                  <span className="font-mono text-lg sm:text-xl font-semibold tabular-nums text-stone-900 dark:text-stone-100">
                    {formatBRL(gift.price)}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedGift(gift);
                      setGiftSent(false);
                      setGiverName('');
                      setGiverMessage('');
                    }}
                    style={{ backgroundColor: accentColor }}
                    className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 sm:px-4 py-2 text-xs font-semibold text-white rounded-lg hover:brightness-110 transition-all cursor-pointer whitespace-nowrap"
                  >
                    <Gift className="w-3.5 h-3.5 shrink-0" />
                    <span>Presentear via Pix</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* RSVP Integrado */}
      <section id="rsvp" className="mx-auto max-w-3xl px-4 sm:px-6 py-12 sm:py-20">
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-5 sm:p-10">
          <div className="text-center">
            <p className="text-xs font-medium" style={{ color: accentColor }}>
              Confirmação de Presença (RSVP)
            </p>
            <h2 className="mt-2 font-editorial text-3xl sm:text-4xl font-semibold">
              Você vai celebrar conosco?
            </h2>
            <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
              Sua resposta atualiza automaticamente a lista dos noivos em tempo real.
            </p>
          </div>

          {rsvpDone ? (
            <div className="mt-8 rounded-xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 p-8 text-center">
              <Heart className="w-8 h-8 mx-auto mb-3" style={{ color: accentColor }} />
              <h3 className="font-editorial text-3xl font-semibold">Confirmação registrada</h3>
              <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
                Obrigado, {rsvpName}. {wedding.brideName} & {wedding.groomName} já receberam sua resposta!
              </p>
              <button
                type="button"
                onClick={() => {
                  setRsvpDone(false);
                  setRsvpName('');
                  setRsvpMessage('');
                }}
                className="mt-5 text-xs font-medium underline text-stone-600 dark:text-stone-400 cursor-pointer"
              >
                Confirmar outro convidado
              </button>
            </div>
          ) : (
            <form onSubmit={handleRsvpSubmit} className="mt-8 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5">
                    Nome Completo
                  </label>
                  <input
                    required
                    minLength={2}
                    maxLength={120}
                    value={rsvpName}
                    onChange={(e) => setRsvpName(e.target.value)}
                    placeholder="Seu nome e sobrenome"
                    className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3.5 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5">
                    WhatsApp (opcional)
                  </label>
                  <input
                    maxLength={30}
                    value={rsvpPhone}
                    onChange={(e) => setRsvpPhone(e.target.value)}
                    placeholder="(11) 99999-9999"
                    className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3.5 py-2.5 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5">
                    Confirmação
                  </label>
                  <select
                    value={rsvpStatus}
                    onChange={(e) => setRsvpStatus(e.target.value as 'confirmed' | 'declined')}
                    className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#171A21] px-3 py-2.5 text-sm"
                  >
                    <option value="confirmed">Sim, estarei presente</option>
                    <option value="declined">Não poderei comparecer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5">
                    Adultos
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={rsvpAdults}
                    onChange={(e) => setRsvpAdults(Number(e.target.value))}
                    className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3.5 py-2.5 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5">
                    Crianças
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={rsvpChildren}
                    onChange={(e) => setRsvpChildren(Number(e.target.value))}
                    className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3.5 py-2.5 text-sm font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5">
                  Restrições Alimentares (opcional)
                </label>
                <input
                  maxLength={250}
                  value={rsvpDietary}
                  onChange={(e) => setRsvpDietary(e.target.value)}
                  placeholder="Ex.: Vegetariano, sem glúten, alergia a lactose"
                  className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3.5 py-2.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1.5">
                  Recado carinhoso para os noivos
                </label>
                <textarea
                  rows={3}
                  maxLength={500}
                  value={rsvpMessage}
                  onChange={(e) => setRsvpMessage(e.target.value)}
                  placeholder="Deixe seus votos para este novo ciclo..."
                  className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3.5 py-2.5 text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={rsvpSubmitting}
                style={{ backgroundColor: accentColor }}
                className="w-full py-3.5 text-sm font-semibold text-white rounded-lg hover:brightness-110 transition-all cursor-pointer disabled:opacity-60"
              >
                {rsvpSubmitting ? 'Enviando confirmação...' : 'Confirmar minha resposta'}
              </button>
            </form>
          )}
        </div>
      </section>

      <footer className="border-t border-stone-200 dark:border-stone-800 py-10 text-center text-xs text-stone-500 dark:text-stone-400">
        <p className="font-editorial text-xl text-stone-800 dark:text-stone-200">
          {wedding.brideName} & {wedding.groomName}
        </p>
        <p className="mt-2">Site criado com Casamento Pleno</p>
      </footer>

      {/* Pix Gift Modal */}
      {selectedGift && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[#171A21] border border-stone-200 dark:border-stone-800 p-5 sm:p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-medium" style={{ color: accentColor }}>
                  Presente via Pix Direto
                </p>
                <h3 className="mt-1 font-editorial text-2xl font-semibold">{selectedGift.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedGift(null)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {giftSent ? (
              <div className="mt-6 text-center py-4 space-y-3">
                <Sparkles className="w-8 h-8 mx-auto" style={{ color: accentColor }} />
                <p className="font-editorial text-2xl font-semibold">Muito obrigado pelo carinho!</p>
                <p className="text-sm text-stone-600 dark:text-stone-400">
                  Seu recado foi enviado ao painel de {wedding.brideName} & {wedding.groomName}.
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedGift(null)}
                  style={{ backgroundColor: accentColor }}
                  className="mt-3 w-full sm:w-auto min-h-[44px] px-5 py-2.5 text-sm font-medium text-white rounded-lg cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            ) : (
              <form onSubmit={handleGiftSubmit} className="mt-5 space-y-4">
                <div className="rounded-xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-stone-500">Valor do presente</span>
                    <span className="font-mono text-lg font-semibold tabular-nums">
                      {formatBRL(selectedGift.price)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-stone-500">
                    Beneficiário: {wedding.pixBeneficiary || `${wedding.brideName} & ${wedding.groomName}`}
                  </p>
                  <div className="mt-3">
                    <label className="flex items-center gap-1.5 text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">
                      <QrCode className="w-3.5 h-3.5" />
                      <span>Código Pix Copia e Cola</span>
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        readOnly
                        value={pixPayload}
                        className="flex-1 min-w-0 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#171A21] px-2.5 py-2 font-mono text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(pixPayload);
                          setPixCopied(true);
                          setTimeout(() => setPixCopied(false), 2000);
                        }}
                        className="inline-flex items-center justify-center gap-1 min-h-[42px] rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#171A21] px-3 py-2 text-xs font-medium cursor-pointer shrink-0"
                      >
                        {pixCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{pixCopied ? 'Copiado' : 'Copiar'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">
                    Seu nome
                  </label>
                  <input
                    required
                    minLength={2}
                    maxLength={120}
                    value={giverName}
                    onChange={(e) => setGiverName(e.target.value)}
                    placeholder="Como quer assinar o cartão?"
                    className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">
                    Mensagem para os noivos
                  </label>
                  <textarea
                    rows={2}
                    maxLength={500}
                    value={giverMessage}
                    onChange={(e) => setGiverMessage(e.target.value)}
                    placeholder="Felicidades ao casal!"
                    className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-sm"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingGift}
                  style={{ backgroundColor: accentColor }}
                  className="w-full py-2.5 text-sm font-semibold text-white rounded-lg cursor-pointer disabled:opacity-60"
                >
                  {submittingGift ? 'Registrando...' : 'Já fiz o Pix · Enviar recado'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
