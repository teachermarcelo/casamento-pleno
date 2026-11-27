import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Heart, Moon, Pause, Play, Volume2, Wind, X } from 'lucide-react';

interface PanicButtonModalProps {
  label?: string;
  color?: string;
  position?: 'bottom-right' | 'bottom-left';
  breathingSeconds?: number;
}

interface AudioTrack {
  id: string;
  title: string;
  duration: string;
  subtitle: string;
  frequencies: number[];
  affirmations: string[];
}

const CALMING_TRACKS: AudioTrack[] = [
  {
    id: 'crisis',
    title: 'Acolhimento Imediato para Crise',
    duration: '03:00',
    subtitle: 'Frequência harmônica suave para desacelerar batimentos',
    frequencies: [220, 277.18, 329.63],
    affirmations: [
      'Você não precisa resolver todo o casamento hoje.',
      'Solte os ombros, descruze a mandíbula e apenas respire.',
      'O que importa de verdade no grande dia já está garantido: o amor de vocês.',
    ],
  },
  {
    id: 'pause',
    title: 'Pausa entre Orçamentos e Fornecedores',
    duration: '02:30',
    subtitle: 'Recentramento rápido quando a lista parece grande demais',
    frequencies: [196, 246.94, 293.66],
    affirmations: [
      'Escolha apenas uma decisão simples para hoje e delegue o restante.',
      'Perfeição não existe; presença e leveza tornam o dia inesquecível.',
      'Você está fazendo um trabalho extraordinário cuidando de cada detalhe.',
    ],
  },
  {
    id: 'sleep',
    title: 'Desacelerar Antes de Dormir',
    duration: '05:00',
    subtitle: 'Higiene do sono para acalmar pensamentos acelerados à noite',
    frequencies: [174, 220, 261.63],
    affirmations: [
      'Deixe as planilhas e mensagens para amanhã às 9h.',
      'Sua mente merece descanso profundo para sonhar com serenidade.',
      'Inspire calma, expire todas as expectativas externas.',
    ],
  },
];

const WELLNESS_TIPS = [
  {
    title: 'Regra das 21h sem fornecedores',
    body: 'Silencie grupos e mensagens de casamento após as 21h para proteger a melatonina e evitar insônia pré-evento.',
  },
  {
    title: 'Delegue 1 decisão por semana',
    body: 'Compartilhe tarefas operacionais com seu noivo, madrinhas ou assessoria. Pedir ajuda é sinal de clareza, não de fraqueza.',
  },
  {
    title: 'Noite do casal sem falar de festa',
    body: 'Reserve pelo menos um jantar por semana onde o assunto casamento seja proibido — reconecte-se ao motivo da celebração.',
  },
];

type BreathPhase = 'inspire' | 'segure' | 'expire';

export const PanicButtonModal: React.FC<PanicButtonModalProps> = ({
  label = 'Botão do Surtando',
  color = '#4A5D4E',
  position = 'bottom-right',
  breathingSeconds = 4,
}) => {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'breath' | 'audio' | 'tips'>('breath');
  const [breathingActive, setBreathingActive] = useState(false);
  const [phase, setPhase] = useState<BreathPhase>('inspire');
  const [cycles, setCycles] = useState(0);

  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  const stopSoundscape = () => {
    if (gainNodeRef.current && audioCtxRef.current) {
      try {
        gainNodeRef.current.gain.exponentialRampToValueAtTime(0.0001, audioCtxRef.current.currentTime + 0.4);
      } catch {
        // Ignore ramp error if already closed
      }
    }
    const ctx = audioCtxRef.current;
    audioCtxRef.current = null;
    gainNodeRef.current = null;
    if (ctx) {
      setTimeout(() => {
        ctx.close().catch(() => {});
      }, 450);
    }
    setActiveTrackId(null);
  };

  const toggleTrack = (track: AudioTrack) => {
    if (activeTrackId === track.id) {
      stopSoundscape();
      return;
    }
    stopSoundscape();
    try {
      const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioContextCtor();
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.001, ctx.currentTime);
      masterGain.gain.exponentialRampToValueAtTime(0.09, ctx.currentTime + 1.5);
      masterGain.connect(ctx.destination);

      track.frequencies.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();
        osc.type = idx === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        oscGain.gain.setValueAtTime(idx === 0 ? 0.55 : 0.22, ctx.currentTime);
        osc.connect(oscGain);
        oscGain.connect(masterGain);
        osc.start();
      });

      audioCtxRef.current = ctx;
      gainNodeRef.current = masterGain;
      setElapsedSec(0);
      setActiveTrackId(track.id);
    } catch {
      setActiveTrackId(track.id);
      setElapsedSec(0);
    }
  };

  useEffect(() => {
    if (!open) {
      setBreathingActive(false);
      stopSoundscape();
    }
  }, [open]);

  useEffect(() => {
    return () => {
      stopSoundscape();
    };
  }, []);

  useEffect(() => {
    if (!activeTrackId) return;
    const timer = window.setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeTrackId]);

  useEffect(() => {
    if (!breathingActive) return;
    const tempoMs = Math.max(2, breathingSeconds) * 1000;
    const phases: BreathPhase[] = ['inspire', 'segure', 'expire'];
    let idx = 0;
    setPhase('inspire');

    const interval = window.setInterval(() => {
      idx = (idx + 1) % phases.length;
      setPhase(phases[idx]);
      if (idx === 0) {
        setCycles((c) => c + 1);
      }
    }, tempoMs);

    return () => window.clearInterval(interval);
  }, [breathingActive, breathingSeconds]);

  const phaseText: Record<BreathPhase, { title: string; hint: string; scale: number }> = {
    inspire: {
      title: 'Inspire profundamente',
      hint: `Puxe o ar pelo nariz por ${breathingSeconds} segundos`,
      scale: 1.24,
    },
    segure: {
      title: 'Sustente com suavidade',
      hint: `Mantenha o ar nos pulmões por ${breathingSeconds} segundos`,
      scale: 1.24,
    },
    expire: {
      title: 'Expire devagar',
      hint: `Solte todo o peso dos ombros por ${breathingSeconds} segundos`,
      scale: 0.88,
    },
  };

  const activeTrack = CALMING_TRACKS.find((t) => t.id === activeTrackId);
  const affirmationIndex = Math.floor(elapsedSec / 8) % 3;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ backgroundColor: color }}
        aria-label={label}
        title={label}
        className={`fixed bottom-[76px] lg:bottom-5 z-30 inline-flex items-center justify-center gap-2 rounded-full h-11 w-11 sm:h-auto sm:w-auto sm:px-5 sm:py-3 text-xs sm:text-sm font-semibold text-white shadow-lg ring-2 ring-white/25 hover:brightness-110 transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 whitespace-nowrap cursor-pointer ${
          position === 'bottom-left' ? 'left-3 sm:left-5' : 'right-3 sm:right-5'
        }`}
      >
        <Wind className="w-5 h-5 sm:w-4 sm:h-4 shrink-0" />
        <span className="hidden sm:inline">{label}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-950/65 p-0 sm:p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="panic-modal-title"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-xl max-h-[88vh] flex flex-col overflow-hidden rounded-t-3xl sm:rounded-2xl bg-[#FAF9F6] dark:bg-[#14171D] border border-stone-200 dark:border-stone-800 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-3 border-b border-stone-200 dark:border-stone-800 px-4 sm:px-6 py-4 sm:py-5 shrink-0">
                <div className="min-w-0">
                  <p className="text-[11px] sm:text-xs font-medium text-stone-500 dark:text-stone-400">
                    Espaço de Acolhimento · Saúde Mental da Noiva
                  </p>
                  <h2 id="panic-modal-title" className="mt-1 font-editorial text-2xl sm:text-3xl font-semibold text-stone-900 dark:text-stone-100 leading-tight">
                    Respire. Tudo vai ficar bem.
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-10 w-10 shrink-0 flex items-center justify-center rounded-lg text-stone-500 hover:bg-stone-200/70 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                  aria-label="Fechar espaço de acolhimento"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="px-4 sm:px-6 pt-3.5 sm:pt-4 shrink-0">
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar max-w-full rounded-lg bg-stone-200/70 dark:bg-stone-800/80 p-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab('breath')}
                    className={`shrink-0 min-h-[36px] px-3 sm:px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      activeTab === 'breath'
                        ? 'bg-white dark:bg-[#1C2029] text-stone-900 dark:text-stone-100 shadow-xs'
                        : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                    }`}
                  >
                    Respiração Guiada
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('audio')}
                    className={`shrink-0 min-h-[36px] px-3 sm:px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      activeTab === 'audio'
                        ? 'bg-white dark:bg-[#1C2029] text-stone-900 dark:text-stone-100 shadow-xs'
                        : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                    }`}
                  >
                    Áudios de Acolhimento
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('tips')}
                    className={`shrink-0 min-h-[36px] px-3 sm:px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      activeTab === 'tips'
                        ? 'bg-white dark:bg-[#1C2029] text-stone-900 dark:text-stone-100 shadow-xs'
                        : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                    }`}
                  >
                    Sono & Bem-Estar
                  </button>
                </div>
              </div>

              <div className="p-4 sm:p-6 overflow-y-auto pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                {activeTab === 'breath' && (
                  <div className="flex flex-col items-center text-center py-2 sm:py-4">
                    <div className="relative flex h-52 w-52 items-center justify-center">
                      <motion.div
                        animate={{
                          scale: breathingActive ? phaseText[phase].scale : 1,
                          opacity: breathingActive ? 0.22 : 0.12,
                        }}
                        transition={{ duration: breathingSeconds, ease: 'easeInOut' }}
                        style={{ backgroundColor: color }}
                        className="absolute inset-4 rounded-full"
                      />
                      <motion.div
                        animate={{
                          scale: breathingActive ? phaseText[phase].scale * 0.85 : 0.85,
                          opacity: breathingActive ? 0.35 : 0.2,
                        }}
                        transition={{ duration: breathingSeconds, ease: 'easeInOut' }}
                        style={{ backgroundColor: color }}
                        className="absolute inset-8 rounded-full"
                      />
                      <div
                        style={{ borderColor: color }}
                        className="relative z-10 flex h-28 w-28 flex-col items-center justify-center rounded-full bg-white dark:bg-[#171A21] border-2 shadow-sm"
                      >
                        <span className="font-editorial text-xl font-semibold text-stone-900 dark:text-stone-100">
                          {breathingActive ? (phase === 'inspire' ? 'Inspire' : phase === 'segure' ? 'Segure' : 'Expire') : 'Pausa'}
                        </span>
                        <span className="mt-0.5 text-xs font-mono tabular-nums text-stone-500 dark:text-stone-400">
                          {breathingSeconds}s · {cycles} ciclos
                        </span>
                      </div>
                    </div>

                    <p className="mt-4 text-base font-medium text-stone-900 dark:text-stone-100">
                      {breathingActive ? phaseText[phase].title : 'Pronta para desacelerar por 1 minuto?'}
                    </p>
                    <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
                      {breathingActive
                        ? phaseText[phase].hint
                        : 'Acompanhe o movimento do círculo para reduzir o cortisol e recuperar a clareza.'}
                    </p>

                    <button
                      type="button"
                      onClick={() => setBreathingActive((v) => !v)}
                      style={{ backgroundColor: color }}
                      className="mt-6 px-6 py-2.5 text-sm font-medium text-white rounded-lg hover:brightness-110 transition-all"
                    >
                      {breathingActive ? 'Pausar exercício' : 'Iniciar respiração guiada'}
                    </button>
                  </div>
                )}

                {activeTab === 'audio' && (
                  <div className="space-y-3">
                    {CALMING_TRACKS.map((track) => {
                      const playing = activeTrackId === track.id;
                      return (
                        <div
                          key={track.id}
                          className={`rounded-xl border p-4 transition-colors ${
                            playing
                              ? 'border-stone-400 dark:border-stone-600 bg-white dark:bg-[#1C2029]'
                              : 'border-stone-200 dark:border-stone-800 bg-white/70 dark:bg-[#171A21]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-stone-900 dark:text-stone-100 truncate">
                                {track.title}
                              </p>
                              <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
                                {track.subtitle} · {track.duration}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleTrack(track)}
                              style={{ backgroundColor: playing ? color : undefined }}
                              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
                                playing
                                  ? 'text-white'
                                  : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-700'
                              }`}
                              aria-label={playing ? `Pausar ${track.title}` : `Ouvir ${track.title}`}
                            >
                              {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                            </button>
                          </div>

                          {playing && activeTrack && (
                            <div className="mt-3 pt-3 border-t border-stone-200 dark:border-stone-800 flex items-start gap-2.5">
                              <Volume2 className="w-4 h-4 shrink-0 mt-0.5 text-stone-500" />
                              <div className="flex-1">
                                <p className="text-sm italic font-editorial text-stone-800 dark:text-stone-200">
                                  “{activeTrack.affirmations[affirmationIndex]}”
                                </p>
                                <p className="mt-1 text-xs font-mono tabular-nums text-stone-500">
                                  {String(Math.floor(elapsedSec / 60)).padStart(2, '0')}:
                                  {String(elapsedSec % 60).padStart(2, '0')} · Som ambiente ativo
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {activeTab === 'tips' && (
                  <div className="space-y-4">
                    {WELLNESS_TIPS.map((tip, i) => (
                      <div
                        key={tip.title}
                        className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#171A21] p-4"
                      >
                        <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                          {i === 0 ? <Moon className="w-3.5 h-3.5" /> : <Heart className="w-3.5 h-3.5" />}
                          <span>Dica diária 0{i + 1}</span>
                        </div>
                        <h3 className="mt-1 text-sm font-semibold text-stone-900 dark:text-stone-100">
                          {tip.title}
                        </h3>
                        <p className="mt-1 text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
                          {tip.body}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
