import React, { useState } from 'react';
import {
  Bell,
  Camera,
  Check,
  Fingerprint,
  Palette,
  RotateCcw,
  Send,
  Upload,
  Webhook,
  Wind,
} from 'lucide-react';
import {
  GENERATED_ASSETS,
  WEDDING_THEMES,
  type PhotoPosition,
  type SupportMessage,
  type ThemeKey,
  type UserProfile,
  type Wedding,
} from '../../types/wedding';
import { sendSupportMessage, updateUserProfile, updateWedding } from '../../lib/weddingService';
import { compressImageToDataUrl, getObjectPositionClass, hashPin } from '../../lib/utils';
import { SafeImage } from '../SafeImage';

interface SettingsAndSupportModuleProps {
  profile: UserProfile;
  wedding: Wedding;
  messages: SupportMessage[];
  accentColor: string;
}

const PANIC_SWATCHES = ['#4A5D4E', '#9A5461', '#3B5978', '#8A6B3F', '#64567A', '#1C1917'];

const PHOTO_POSITIONS: { value: PhotoPosition; label: string }[] = [
  { value: 'top', label: 'Topo' },
  { value: 'center', label: 'Centro' },
  { value: 'bottom', label: 'Base' },
];

export const SettingsAndSupportModule: React.FC<SettingsAndSupportModuleProps> = ({
  profile,
  wedding,
  messages,
  accentColor,
}) => {
  // Wedding customization
  const [brideName, setBrideName] = useState(wedding.brideName);
  const [groomName, setGroomName] = useState(wedding.groomName);
  const [weddingDate, setWeddingDate] = useState(wedding.weddingDate);
  const [weddingTime, setWeddingTime] = useState(wedding.weddingTime);
  const [venueName, setVenueName] = useState(wedding.venueName || '');
  const [venueAddress, setVenueAddress] = useState(wedding.venueAddress || '');
  const [dressCode, setDressCode] = useState(wedding.dressCode || '');
  const [pixKey, setPixKey] = useState(wedding.pixKey || '');
  const [welcomeMessage, setWelcomeMessage] = useState(wedding.welcomeMessage || '');
  const [coupleStory, setCoupleStory] = useState(wedding.coupleStory || '');
  const [themeKey, setThemeKey] = useState<ThemeKey>(wedding.themeKey);
  const [customAccentColor, setCustomAccentColor] = useState(wedding.customAccentColor || '');

  // Entrance & Couple Photos + Framing
  const [coverPhotoUrl, setCoverPhotoUrl] = useState(wedding.coverPhotoUrl || GENERATED_ASSETS.heroCouple);
  const [couplePhotoUrl, setCouplePhotoUrl] = useState(wedding.couplePhotoUrl || GENERATED_ASSETS.storyCouple);
  const [coverPhotoPosition, setCoverPhotoPosition] = useState<PhotoPosition>(wedding.coverPhotoPosition || 'center');
  const [couplePhotoPosition, setCouplePhotoPosition] = useState<PhotoPosition>(wedding.couplePhotoPosition || 'center');
  const [uploadingPhoto, setUploadingPhoto] = useState<'cover' | 'couple' | null>(null);
  const [photoError, setPhotoError] = useState('');

  // Panic button customization
  const [panicLabel, setPanicLabel] = useState(profile.panicButtonLabel || 'Botão do Surtando');
  const [panicColor, setPanicColor] = useState(profile.panicButtonColor || accentColor);
  const [panicPosition, setPanicPosition] = useState<'bottom-right' | 'bottom-left'>(
    profile.panicButtonPosition || 'bottom-right'
  );
  const [breathingSeconds, setBreathingSeconds] = useState(profile.breathingSeconds || 4);

  // Notifications & Biometrics & Webhook
  const [notifyPayments, setNotifyPayments] = useState(profile.notifyPayments ?? true);
  const [notifyRsvp, setNotifyRsvp] = useState(profile.notifyRsvp ?? true);
  const [notifyDaysBefore, setNotifyDaysBefore] = useState(profile.notifyDaysBefore ?? 5);
  const [biometricEnabled, setBiometricEnabled] = useState(profile.biometricEnabled ?? false);
  const [newPin, setNewPin] = useState('');
  const [webhookUrl, setWebhookUrl] = useState(profile.webhookUrl || '');
  const [webhookResult, setWebhookResult] = useState('');
  const [notifResult, setNotifResult] = useState('');
  const [savedNotice, setSavedNotice] = useState(false);

  // Support chat
  const [chatText, setChatText] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);

  const previewAccent = customAccentColor || WEDDING_THEMES[themeKey].primary;

  const handlePhotoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'cover' | 'couple'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError('');
    setUploadingPhoto(target);
    try {
      const dataUrl = await compressImageToDataUrl(file, target === 'cover' ? 1120 : 900);
      if (target === 'cover') {
        setCoverPhotoUrl(dataUrl);
      } else {
        setCouplePhotoUrl(dataUrl);
      }
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Erro ao processar imagem.');
    } finally {
      setUploadingPhoto(null);
      e.target.value = '';
    }
  };

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateWedding(wedding.id, {
      brideName,
      groomName,
      weddingDate,
      weddingTime,
      venueName,
      venueAddress,
      venueMapsUrl: `https://maps.google.com/?q=${encodeURIComponent(venueAddress || venueName)}`,
      dressCode,
      pixKey,
      welcomeMessage,
      coupleStory,
      themeKey,
      customAccentColor,
      coverPhotoUrl,
      couplePhotoUrl,
      coverPhotoPosition,
      couplePhotoPosition,
    });

    const userUpdates: Parameters<typeof updateUserProfile>[1] = {
      panicButtonLabel: panicLabel,
      panicButtonColor: panicColor,
      panicButtonPosition: panicPosition,
      breathingSeconds,
      notifyPayments,
      notifyRsvp,
      notifyDaysBefore,
      biometricEnabled,
      webhookUrl,
    };

    if (newPin.trim().length >= 4) {
      userUpdates.pinHash = await hashPin(newPin.trim());
      setNewPin('');
    }

    await updateUserProfile(profile.uid, userUpdates);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  const handleRequestNotifications = async () => {
    if (!('Notification' in window)) {
      setNotifResult('Este navegador não suporta notificações push nativas.');
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      new Notification('Casamento Pleno', {
        body: `Lembretes ativados! Avisaremos com ${notifyDaysBefore} dias de antecedência sobre seus pagamentos.`,
        icon: '/pwa-192x192.png',
      });
      setNotifResult('Notificações push ativadas com sucesso neste aparelho.');
    } else {
      setNotifResult('Permissão negada no navegador. Você pode reativar nas configurações do site.');
    }
  };

  const handleTestWebhook = async () => {
    if (!webhookUrl.trim()) return;
    setWebhookResult('Enviando evento de teste...');
    try {
      const res = await fetch('/api/webhooks/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: webhookUrl.trim(),
          event: 'wedding.rsvp.test',
          payload: { weddingId: wedding.id, couple: `${brideName} & ${groomName}` },
        }),
      });
      const data = await res.json();
      setWebhookResult(
        data.delivered
          ? `Webhook entregue com sucesso (HTTP ${data.statusCode}).`
          : data.error || 'Endpoint não respondeu 2xx.'
      );
    } catch {
      setWebhookResult('Erro ao disparar webhook.');
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatText.trim()) return;
    setSendingMsg(true);
    try {
      await sendSupportMessage(
        wedding.id,
        wedding.ownerId,
        'bride',
        `${brideName} & ${groomName}`,
        chatText
      );
      setChatText('');
    } finally {
      setSendingMsg(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
      {/* Left: Photos, Colors, Identity, Panic Button, Notifications, Biometrics, Webhooks */}
      <form onSubmit={handleSaveAll} className="lg:col-span-7 space-y-5 sm:space-y-6">
        {/* Estúdio de Fotos de Entrada & Enquadramento */}
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-4 sm:p-6 space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4" style={{ color: previewAccent }} />
              <h3 className="font-editorial text-2xl font-semibold">Fotos de Entrada & Enquadramento</h3>
            </div>
            {savedNotice && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                <Check className="w-3.5 h-3.5" /> Alterações salvas
              </span>
            )}
          </div>
          <p className="text-xs text-stone-500">
            Envie suas próprias fotos direto do celular ou computador e ajuste o enquadramento. Elas aparecem no topo do seu painel e no Site dos Convidados.
          </p>

          {photoError && <p className="text-xs text-red-600">{photoError}</p>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Cover / Entrance Photo */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-stone-800 dark:text-stone-200">Foto de Capa / Entrada</span>
                <span className="text-stone-400">Painel + Hero do Site</span>
              </div>
              <div className="relative aspect-[16/10] rounded-xl overflow-hidden border border-stone-200 dark:border-stone-800 bg-stone-100 dark:bg-stone-900">
                <SafeImage
                  src={coverPhotoUrl}
                  alt="Prévia da foto de capa"
                  className={`w-full h-full object-cover transition-all ${getObjectPositionClass(coverPhotoPosition)}`}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent flex items-end p-3">
                  <span className="font-editorial text-lg text-white font-semibold">
                    {brideName} & {groomName}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label
                  style={{ backgroundColor: previewAccent }}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white cursor-pointer hover:brightness-110"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploadingPhoto === 'cover' ? 'Enviando...' : 'Subir foto'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handlePhotoUpload(e, 'cover')}
                    className="hidden"
                  />
                </label>

                <div className="inline-flex items-center rounded-lg bg-stone-100 dark:bg-stone-800 p-0.5">
                  {PHOTO_POSITIONS.map((pos) => (
                    <button
                      key={pos.value}
                      type="button"
                      onClick={() => setCoverPhotoPosition(pos.value)}
                      className={`px-2 py-1 text-[11px] font-medium rounded-md cursor-pointer ${
                        coverPhotoPosition === pos.value
                          ? 'bg-white dark:bg-[#1C2029] text-stone-900 dark:text-stone-100 shadow-xs'
                          : 'text-stone-500'
                      }`}
                    >
                      {pos.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-1.5">
                {[
                  { label: 'Editorial 1', url: GENERATED_ASSETS.heroCouple },
                  { label: 'Jardim', url: GENERATED_ASSETS.venueGarden },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setCoverPhotoUrl(preset.url)}
                    className="text-[11px] text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 underline cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Couple Story Photo */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-stone-800 dark:text-stone-200">Foto do Casal</span>
                <span className="text-stone-400">Seção Nossa História</span>
              </div>
              <div className="relative aspect-[16/10] rounded-xl overflow-hidden border border-stone-200 dark:border-stone-800 bg-stone-100 dark:bg-stone-900">
                <SafeImage
                  src={couplePhotoUrl}
                  alt="Prévia da foto do casal"
                  className={`w-full h-full object-cover transition-all ${getObjectPositionClass(couplePhotoPosition)}`}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label
                  style={{ backgroundColor: previewAccent }}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white cursor-pointer hover:brightness-110"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploadingPhoto === 'couple' ? 'Enviando...' : 'Subir foto'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handlePhotoUpload(e, 'couple')}
                    className="hidden"
                  />
                </label>

                <div className="inline-flex items-center rounded-lg bg-stone-100 dark:bg-stone-800 p-0.5">
                  {PHOTO_POSITIONS.map((pos) => (
                    <button
                      key={pos.value}
                      type="button"
                      onClick={() => setCouplePhotoPosition(pos.value)}
                      className={`px-2 py-1 text-[11px] font-medium rounded-md cursor-pointer ${
                        couplePhotoPosition === pos.value
                          ? 'bg-white dark:bg-[#1C2029] text-stone-900 dark:text-stone-100 shadow-xs'
                          : 'text-stone-500'
                      }`}
                    >
                      {pos.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-1.5">
                {[
                  { label: 'Editorial 2', url: GENERATED_ASSETS.storyCouple },
                  { label: 'Capa', url: GENERATED_ASSETS.heroCouple },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setCouplePhotoUrl(preset.url)}
                    className="text-[11px] text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 underline cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Paleta de Cores & Cor Personalizada + Identidade */}
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-4 sm:p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4" style={{ color: previewAccent }} />
            <h3 className="font-editorial text-2xl font-semibold">Paleta de Cores & Dados do Casamento</h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.values(WEDDING_THEMES).map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setThemeKey(t.key);
                  setCustomAccentColor('');
                }}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left cursor-pointer transition-colors ${
                  themeKey === t.key && !customAccentColor
                    ? 'border-stone-900 dark:border-stone-100 bg-stone-50 dark:bg-stone-800'
                    : 'border-stone-200 dark:border-stone-800 hover:bg-stone-50/70 dark:hover:bg-stone-800/40'
                }`}
              >
                <span className="h-4 w-4 rounded-full shrink-0" style={{ backgroundColor: t.primary }} />
                <span className="text-xs font-medium truncate">{t.name}</span>
              </button>
            ))}
          </div>

          {/* Custom Accent Color Picker */}
          <div className="rounded-xl bg-[#FAF8F4] dark:bg-stone-900/50 border border-stone-200/80 dark:border-stone-800 p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-stone-800 dark:text-stone-200">
                Cor Temática Personalizada (opcional)
              </p>
              <p className="text-[11px] text-stone-500">
                Escolha o tom exato da decoração para aplicar no painel e no site dos convidados.
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <input
                type="color"
                value={customAccentColor || WEDDING_THEMES[themeKey].primary}
                onChange={(e) => setCustomAccentColor(e.target.value)}
                className="h-9 w-11 rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent cursor-pointer"
                aria-label="Selecionar cor personalizada"
              />
              <span className="font-mono text-xs text-stone-600 dark:text-stone-300 uppercase">
                {previewAccent}
              </span>
              {customAccentColor && (
                <button
                  type="button"
                  onClick={() => setCustomAccentColor('')}
                  className="inline-flex items-center gap-1 text-[11px] text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Usar paleta</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-stone-500 mb-1">Noiva</label>
              <input value={brideName} onChange={(e) => setBrideName(e.target.value)} className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Noivo</label>
              <input value={groomName} onChange={(e) => setGroomName(e.target.value)} className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Data</label>
              <input type="date" value={weddingDate} onChange={(e) => setWeddingDate(e.target.value)} className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-sm font-mono" />
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Horário</label>
              <input type="time" value={weddingTime} onChange={(e) => setWeddingTime(e.target.value)} className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-sm font-mono" />
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Local</label>
              <input value={venueName} onChange={(e) => setVenueName(e.target.value)} className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Chave Pix (Presentes)</label>
              <input value={pixKey} onChange={(e) => setPixKey(e.target.value)} className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Endereço</label>
              <input value={venueAddress} onChange={(e) => setVenueAddress(e.target.value)} className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Dress Code</label>
              <input value={dressCode} onChange={(e) => setDressCode(e.target.value)} className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-xs text-stone-500 mb-1">Mensagem de Boas-Vindas</label>
            <textarea rows={2} value={welcomeMessage} onChange={(e) => setWelcomeMessage(e.target.value)} className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-1">História do Casal</label>
            <textarea rows={3} value={coupleStory} onChange={(e) => setCoupleStory(e.target.value)} className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-sm" />
          </div>
        </div>

        {/* Botão do Surtando Customization */}
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-4 sm:p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Wind className="w-4 h-4" style={{ color: previewAccent }} />
            <h3 className="font-editorial text-2xl font-semibold">Design do Botão do Surtando</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-stone-500 mb-1">Texto do Botão</label>
              <input
                maxLength={40}
                value={panicLabel}
                onChange={(e) => setPanicLabel(e.target.value)}
                className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Posição na Tela</label>
              <select
                value={panicPosition}
                onChange={(e) => setPanicPosition(e.target.value as 'bottom-right' | 'bottom-left')}
                className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#171A21] px-2.5 py-2 text-sm"
              >
                <option value="bottom-right">Inferior Direito</option>
                <option value="bottom-left">Inferior Esquerdo</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Ritmo Respiração (seg)</label>
              <input
                type="number"
                min={2}
                max={10}
                value={breathingSeconds}
                onChange={(e) => setBreathingSeconds(Number(e.target.value))}
                className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-stone-500 mb-2">Cor do Botão Flutuante</label>
            <div className="flex items-center gap-2.5">
              {PANIC_SWATCHES.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => setPanicColor(hex)}
                  style={{ backgroundColor: hex }}
                  className={`h-7 w-7 rounded-full cursor-pointer transition-transform ${
                    panicColor === hex ? 'ring-2 ring-offset-2 ring-stone-900 dark:ring-stone-100 scale-110' : ''
                  }`}
                  aria-label={`Selecionar cor ${hex}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Notifications, Biometric Vault & Webhooks */}
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-4 sm:p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4" style={{ color: previewAccent }} />
            <h3 className="font-editorial text-2xl font-semibold">Notificações, Biometria & Webhooks</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={notifyPayments} onChange={(e) => setNotifyPayments(e.target.checked)} />
              <span>Alertas de vencimento</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={notifyRsvp} onChange={(e) => setNotifyRsvp(e.target.checked)} />
              <span>Novos RSVPs</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-stone-500 whitespace-nowrap">Antecedência (dias):</span>
              <input
                type="number"
                min={1}
                max={30}
                value={notifyDaysBefore}
                onChange={(e) => setNotifyDaysBefore(Number(e.target.value))}
                className="w-16 rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-2 py-1 text-xs font-mono"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleRequestNotifications}
              className="rounded-lg border border-stone-300 dark:border-stone-700 px-3.5 py-2 text-xs font-medium hover:bg-stone-50 dark:hover:bg-stone-800 cursor-pointer"
            >
              Ativar Notificações Push no Aparelho
            </button>
            {notifResult && <span className="text-xs text-stone-500">{notifResult}</span>}
          </div>

          <div className="pt-4 border-t border-stone-200 dark:border-stone-800 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Fingerprint className="w-4 h-4 text-stone-500" />
                <div>
                  <p className="text-sm font-medium">Bloqueio Biométrico / PIN no Financeiro</p>
                  <p className="text-xs text-stone-500">Exige validação antes de exibir valores e extratos.</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={biometricEnabled}
                onChange={(e) => setBiometricEnabled(e.target.checked)}
                className="h-4 w-4"
              />
            </div>
            {biometricEnabled && (
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                placeholder="Definir novo PIN de 4 dígitos (opcional se já configurado)"
                className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-xs font-mono"
              />
            )}
          </div>

          <div className="pt-4 border-t border-stone-200 dark:border-stone-800 space-y-2.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-stone-600 dark:text-stone-400">
              <Webhook className="w-3.5 h-3.5 shrink-0" />
              <span>Webhook RESTful configurável (HTTPS)</span>
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="url"
                maxLength={500}
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://seu-fluxo.n8n.cloud/webhook/casamento"
                className="flex-1 min-w-0 rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-xs font-mono"
              />
              <button
                type="button"
                onClick={handleTestWebhook}
                className="min-h-[40px] rounded-lg border border-stone-300 dark:border-stone-700 px-3.5 py-2 text-xs font-medium hover:bg-stone-50 dark:hover:bg-stone-800 cursor-pointer whitespace-nowrap"
              >
                Testar Webhook
              </button>
            </div>
            {webhookResult && <p className="text-xs text-stone-500">{webhookResult}</p>}
          </div>

          <button
            type="submit"
            style={{ backgroundColor: previewAccent }}
            className="w-full min-h-[46px] py-3 text-sm font-semibold text-white rounded-xl hover:brightness-110 transition-all cursor-pointer"
          >
            Salvar fotos, cores e configurações
          </button>
        </div>
      </form>

      {/* Right: Real-Time Customer Support Chat */}
      <div className="lg:col-span-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] flex flex-col h-[440px] lg:h-[580px] lg:sticky lg:top-20">
        <div className="p-4 sm:p-5 border-b border-stone-200 dark:border-stone-800">
          <h3 className="font-editorial text-2xl font-semibold">Suporte em Tempo Real</h3>
          <p className="text-xs text-stone-500">
            Converse diretamente com a equipe Casamento Pleno pelo chat interno.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-center text-xs text-stone-400 px-4 sm:px-6">
              Envie sua dúvida sobre o site dos convidados, Pix ou planejamento. Responderemos aqui em tempo real.
            </div>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.senderRole === 'bride' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm break-words ${
                    m.senderRole === 'bride'
                      ? 'text-white'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100'
                  }`}
                  style={m.senderRole === 'bride' ? { backgroundColor: previewAccent } : undefined}
                >
                  <p className="text-[11px] opacity-80 mb-0.5">{m.senderName}</p>
                  <p>{m.text}</p>
                </div>
              </div>
            ))
          )}
        </div>

        <form onSubmit={handleSendChat} className="p-3.5 sm:p-4 border-t border-stone-200 dark:border-stone-800 flex gap-2">
          <input
            maxLength={1000}
            value={chatText}
            onChange={(e) => setChatText(e.target.value)}
            placeholder="Escreva sua mensagem..."
            className="flex-1 min-w-0 rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={sendingMsg}
            style={{ backgroundColor: previewAccent }}
            className="min-h-[42px] min-w-[44px] inline-flex items-center justify-center rounded-lg px-4 py-2 text-white cursor-pointer disabled:opacity-60 shrink-0"
            aria-label="Enviar mensagem"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
