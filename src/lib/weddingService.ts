import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from './firebase';
import { sanitizeString, slugify } from './utils';
import {
  ADMIN_EMAIL,
  EXPENSE_CATEGORIES,
  GENERATED_ASSETS,
  SUBSCRIPTION_PRICE,
  type Expense,
  type GiftContribution,
  type GiftItem,
  type Guest,
  type PartyMember,
  type PlatformConfig,
  type ScheduleItem,
  type SeatingTable,
  type SupportMessage,
  type ThemeKey,
  type UserProfile,
  type Vendor,
  type Wedding,
} from '../types/wedding';

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export const DEFAULT_PLATFORM_CONFIG: PlatformConfig = {
  vendorCategories: [...EXPENSE_CATEGORIES],
  expenseCategories: [...EXPENSE_CATEGORIES],
  defaultPlanPrice: SUBSCRIPTION_PRICE,
  supportWhatsApp: '',
  announcementBanner: '',
};

export function subscribePlatformConfig(cb: (config: PlatformConfig) => void): Unsubscribe {
  const path = 'platformConfig/global';
  return onSnapshot(
    doc(db, 'platformConfig', 'global'),
    (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Partial<PlatformConfig>;
        cb({
          vendorCategories:
            Array.isArray(data.vendorCategories) && data.vendorCategories.length > 0
              ? data.vendorCategories
              : [...EXPENSE_CATEGORIES],
          expenseCategories:
            Array.isArray(data.expenseCategories) && data.expenseCategories.length > 0
              ? data.expenseCategories
              : [...EXPENSE_CATEGORIES],
          defaultPlanPrice: typeof data.defaultPlanPrice === 'number' ? data.defaultPlanPrice : SUBSCRIPTION_PRICE,
          supportWhatsApp: data.supportWhatsApp || '',
          announcementBanner: data.announcementBanner || '',
          updatedAt: data.updatedAt,
        });
      } else {
        cb(DEFAULT_PLATFORM_CONFIG);
      }
    },
    () => {
      cb(DEFAULT_PLATFORM_CONFIG);
    }
  );
}

export async function savePlatformConfig(config: {
  vendorCategories: string[];
  expenseCategories: string[];
  defaultPlanPrice: number;
  supportWhatsApp?: string;
  announcementBanner?: string;
}): Promise<void> {
  const path = 'platformConfig/global';
  try {
    const cleanVendors = config.vendorCategories
      .map((c) => sanitizeString(c, 80))
      .filter(Boolean)
      .slice(0, 40);
    const cleanExpenses = config.expenseCategories
      .map((c) => sanitizeString(c, 80))
      .filter(Boolean)
      .slice(0, 40);

    await setDoc(doc(db, 'platformConfig', 'global'), {
      vendorCategories: cleanVendors.length > 0 ? cleanVendors : [...EXPENSE_CATEGORIES],
      expenseCategories: cleanExpenses.length > 0 ? cleanExpenses : [...EXPENSE_CATEGORIES],
      defaultPlanPrice: Math.max(0, Math.min(10000, Number(config.defaultPlanPrice) || SUBSCRIPTION_PRICE)),
      supportWhatsApp: sanitizeString(config.supportWhatsApp || '', 40),
      announcementBanner: sanitizeString(config.announcementBanner || '', 300),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function ensureUserProfile(user: User): Promise<UserProfile> {
  const path = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);
  const isOwnerAdmin = user.email?.toLowerCase() === ADMIN_EMAIL && user.emailVerified;

  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const existing = snap.data() as UserProfile;
      if (isOwnerAdmin) {
        try {
          await setDoc(
            doc(db, 'admins', user.uid),
            {
              uid: user.uid,
              email: existing.email || user.email || ADMIN_EMAIL,
              createdAt: serverTimestamp(),
            },
            { merge: true }
          );
        } catch {
          // Non-blocking if admin doc already exists
        }
        if (existing.role !== 'admin') {
          await updateDoc(ref, {
            role: 'admin',
            subscriptionStatus: 'active',
            updatedAt: serverTimestamp(),
          });
          const upgraded = await getDoc(ref);
          return upgraded.data() as UserProfile;
        }
      }
      return existing;
    }

    const todayIso = new Date().toISOString().slice(0, 10);
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const nextIso = nextMonth.toISOString().slice(0, 10);

    const fallbackName =
      user.displayName?.trim() ||
      user.email?.split('@')[0]?.trim() ||
      'Noiva Casamento Pleno';

    const profilePayload = {
      uid: user.uid,
      email: sanitizeString(user.email || 'usuario@casamentopleno.com.br', 200),
      displayName: sanitizeString(fallbackName, 120),
      role: isOwnerAdmin ? ('admin' as const) : ('bride' as const),
      subscriptionStatus: isOwnerAdmin ? ('active' as const) : ('trial' as const),
      planPrice: SUBSCRIPTION_PRICE,
      paymentMethod: isOwnerAdmin ? ('pix' as const) : ('pending' as const),
      mercadoPagoRef: '',
      lastPaymentDate: isOwnerAdmin ? todayIso : '',
      nextBillingDate: nextIso,
      totalPaidSubscription: isOwnerAdmin ? SUBSCRIPTION_PRICE : 0,
      supportStatus: 'new' as const,
      adminNotes: '',
      leadSource: 'Plataforma Web',
      weddingId: '',
      biometricEnabled: false,
      pinHash: '',
      darkMode: false,
      webhookUrl: '',
      panicButtonLabel: 'Botão do Surtando',
      panicButtonColor: '#4A5D4E',
      panicButtonPosition: 'bottom-right' as const,
      breathingSeconds: 4,
      notifyPayments: true,
      notifyRsvp: true,
      notifyDaysBefore: 5,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(ref, profilePayload);

    if (isOwnerAdmin) {
      try {
        await setDoc(doc(db, 'admins', user.uid), {
          uid: user.uid,
          email: profilePayload.email,
          createdAt: serverTimestamp(),
        });
      } catch {
        // Non-blocking if admin doc already exists
      }
    }

    const fresh = await getDoc(ref);
    return fresh.data() as UserProfile;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function createLeadClientByAdmin(params: {
  id?: string;
  email: string;
  displayName: string;
  leadSource?: string;
  adminNotes?: string;
}): Promise<UserProfile> {
  const cleanEmail = sanitizeString(params.email.toLowerCase(), 200);
  const uid = params.id ? sanitizeString(params.id, 128) : newId('lead');
  const path = `users/${uid}`;
  const ref = doc(db, 'users', uid);

  try {
    const existing = await getDoc(ref);
    if (existing.exists()) {
      return existing.data() as UserProfile;
    }

    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const nextIso = nextMonth.toISOString().slice(0, 10);

    const payload = {
      uid,
      email: cleanEmail,
      displayName: sanitizeString(params.displayName || cleanEmail.split('@')[0] || 'Lead Noivo', 120),
      role: 'bride' as const,
      subscriptionStatus: 'trial' as const,
      planPrice: SUBSCRIPTION_PRICE,
      paymentMethod: 'pending' as const,
      mercadoPagoRef: '',
      lastPaymentDate: '',
      nextBillingDate: nextIso,
      totalPaidSubscription: 0,
      supportStatus: 'onboarding' as const,
      adminNotes: sanitizeString(
        params.adminNotes || 'Lead cadastrado para testar jornada completa (Checkout -> Setup -> Painel).',
        600
      ),
      leadSource: sanitizeString(params.leadSource || 'Lead de Teste (Admin)', 80),
      weddingId: '',
      biometricEnabled: false,
      pinHash: '',
      darkMode: false,
      webhookUrl: '',
      panicButtonLabel: 'Botão do Surtando',
      panicButtonColor: '#173526',
      panicButtonPosition: 'bottom-right' as const,
      breathingSeconds: 4,
      notifyPayments: true,
      notifyRsvp: true,
      notifyDaysBefore: 5,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(ref, payload);
    const fresh = await getDoc(ref);
    return fresh.data() as UserProfile;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateUserProfile(
  uid: string,
  updates: Partial<
    Pick<
      UserProfile,
      | 'displayName'
      | 'subscriptionStatus'
      | 'planPrice'
      | 'paymentMethod'
      | 'mercadoPagoRef'
      | 'lastPaymentDate'
      | 'nextBillingDate'
      | 'totalPaidSubscription'
      | 'supportStatus'
      | 'adminNotes'
      | 'leadSource'
      | 'weddingId'
      | 'biometricEnabled'
      | 'pinHash'
      | 'darkMode'
      | 'webhookUrl'
      | 'panicButtonLabel'
      | 'panicButtonColor'
      | 'panicButtonPosition'
      | 'breathingSeconds'
      | 'notifyPayments'
      | 'notifyRsvp'
      | 'notifyDaysBefore'
    >
  >
): Promise<void> {
  const path = `users/${uid}`;
  try {
    const clean: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (updates.displayName !== undefined) clean.displayName = sanitizeString(updates.displayName, 120);
    if (updates.subscriptionStatus !== undefined) clean.subscriptionStatus = updates.subscriptionStatus;
    if (updates.planPrice !== undefined) clean.planPrice = Math.max(0, Math.min(10000, Number(updates.planPrice) || SUBSCRIPTION_PRICE));
    if (updates.paymentMethod !== undefined) clean.paymentMethod = updates.paymentMethod;
    if (updates.mercadoPagoRef !== undefined) clean.mercadoPagoRef = sanitizeString(updates.mercadoPagoRef, 120);
    if (updates.lastPaymentDate !== undefined) clean.lastPaymentDate = sanitizeString(updates.lastPaymentDate, 30);
    if (updates.nextBillingDate !== undefined) clean.nextBillingDate = sanitizeString(updates.nextBillingDate, 30);
    if (updates.totalPaidSubscription !== undefined) {
      clean.totalPaidSubscription = Math.max(0, Math.min(1000000, Number(updates.totalPaidSubscription) || 0));
    }
    if (updates.supportStatus !== undefined) clean.supportStatus = updates.supportStatus;
    if (updates.adminNotes !== undefined) clean.adminNotes = sanitizeString(updates.adminNotes, 600);
    if (updates.leadSource !== undefined) clean.leadSource = sanitizeString(updates.leadSource, 80);
    if (updates.weddingId !== undefined) clean.weddingId = sanitizeString(updates.weddingId, 128);
    if (updates.biometricEnabled !== undefined) clean.biometricEnabled = Boolean(updates.biometricEnabled);
    if (updates.pinHash !== undefined) clean.pinHash = sanitizeString(updates.pinHash, 128);
    if (updates.darkMode !== undefined) clean.darkMode = Boolean(updates.darkMode);
    if (updates.webhookUrl !== undefined) clean.webhookUrl = sanitizeString(updates.webhookUrl, 500);
    if (updates.panicButtonLabel !== undefined) clean.panicButtonLabel = sanitizeString(updates.panicButtonLabel, 40);
    if (updates.panicButtonColor !== undefined) clean.panicButtonColor = sanitizeString(updates.panicButtonColor, 20);
    if (updates.panicButtonPosition !== undefined) clean.panicButtonPosition = updates.panicButtonPosition;
    if (updates.breathingSeconds !== undefined) {
      clean.breathingSeconds = Math.min(12, Math.max(2, Number(updates.breathingSeconds) || 4));
    }
    if (updates.notifyPayments !== undefined) clean.notifyPayments = Boolean(updates.notifyPayments);
    if (updates.notifyRsvp !== undefined) clean.notifyRsvp = Boolean(updates.notifyRsvp);
    if (updates.notifyDaysBefore !== undefined) {
      clean.notifyDaysBefore = Math.min(60, Math.max(0, Number(updates.notifyDaysBefore) || 5));
    }

    await updateDoc(doc(db, 'users', uid), clean);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function createWeddingWithStarterData(params: {
  ownerId: string;
  brideName: string;
  groomName: string;
  weddingDate: string;
  weddingTime: string;
  themeKey: ThemeKey;
  customAccentColor?: string;
  venueName: string;
  venueAddress: string;
  dressCode: string;
  welcomeMessage: string;
  coverPhotoUrl: string;
  couplePhotoUrl: string;
  pixKey: string;
  budgetLimit: number;
}): Promise<Wedding> {
  const weddingId = newId('wed');
  const baseSlug = slugify(`${params.brideName}-e-${params.groomName}`);
  const uniqueSlug = `${baseSlug}-${weddingId.slice(-4)}`.slice(0, 78);

  const weddingPath = `weddings/${weddingId}`;
  try {
    const weddingPayload = {
      id: weddingId,
      ownerId: params.ownerId,
      slug: uniqueSlug,
      brideName: sanitizeString(params.brideName || 'Noiva', 80),
      groomName: sanitizeString(params.groomName || 'Noivo', 80),
      weddingDate: sanitizeString(params.weddingDate || '2027-06-19', 20),
      weddingTime: sanitizeString(params.weddingTime || '16:30', 10),
      venueName: sanitizeString(params.venueName || 'Espaço Jardim das Oliveiras', 160),
      venueAddress: sanitizeString(params.venueAddress || 'São Paulo, SP', 300),
      venueMapsUrl: `https://maps.google.com/?q=${encodeURIComponent(params.venueAddress || params.venueName || 'São Paulo SP')}`,
      dressCode: sanitizeString(params.dressCode || 'Esporte Fino', 120),
      welcomeMessage: sanitizeString(
        params.welcomeMessage ||
          'Estamos muito felizes em compartilhar este momento especial com você. Confirme sua presença e celebre conosco.',
        600
      ),
      coupleStory:
        'Cada encontro, viagem e conversa nos trouxe até aqui. Preparamos este dia com muito carinho para celebrar o amor ao lado da nossa família e amigos mais próximos.',
      coverPhotoUrl: sanitizeString(params.coverPhotoUrl || GENERATED_ASSETS.heroCouple, 180000),
      couplePhotoUrl: sanitizeString(params.couplePhotoUrl || GENERATED_ASSETS.storyCouple, 180000),
      coverPhotoPosition: 'center' as const,
      couplePhotoPosition: 'center' as const,
      themeKey: params.themeKey,
      customAccentColor: sanitizeString(params.customAccentColor || '', 20),
      pixKey: sanitizeString(params.pixKey || '', 140),
      pixBeneficiary: sanitizeString(`${params.brideName} e ${params.groomName}`, 120),
      budgetLimit: Math.max(0, Number(params.budgetLimit) || 50000),
      savingsGoal: Math.max(0, Number(params.budgetLimit) || 50000),
      savingsCurrent: Math.round((Number(params.budgetLimit) || 50000) * 0.35),
      status: 'published' as const,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(doc(db, 'weddings', weddingId), weddingPayload);

    await setDoc(doc(db, 'slugs', uniqueSlug), {
      slug: uniqueSlug,
      weddingId,
      ownerId: params.ownerId,
      updatedAt: serverTimestamp(),
    });

    await updateUserProfile(params.ownerId, { weddingId });

    // Starter tables
    const starterTables = [
      { id: newId('tbl'), name: 'Mesa 01 — Família da Noiva', capacity: 8, shape: 'round' as const, zone: 'Salão Principal' },
      { id: newId('tbl'), name: 'Mesa 02 — Padrinhos', capacity: 10, shape: 'rectangular' as const, zone: 'Próximo ao Altar' },
    ];
    for (const t of starterTables) {
      await setDoc(doc(db, `weddings/${weddingId}/tables`, t.id), {
        weddingId,
        ownerId: params.ownerId,
        name: t.name,
        capacity: t.capacity,
        shape: t.shape,
        zone: t.zone,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    // Starter guests
    const starterGuests = [
      { name: 'Mariana Silva', group: 'Padrinhos & Madrinhas', adults: 2, children: 0, status: 'confirmed' as const, tableId: starterTables[1].id },
      { name: 'Carlos e Helena Mendes', group: 'Família da Noiva', adults: 2, children: 1, status: 'confirmed' as const, tableId: starterTables[0].id },
      { name: 'Fernanda Oliveira', group: 'Amigos Íntimos', adults: 1, children: 0, status: 'pending' as const, tableId: '' },
    ];
    for (const g of starterGuests) {
      await setDoc(doc(db, `weddings/${weddingId}/guests`, newId('gst')), {
        weddingId,
        ownerId: params.ownerId,
        name: g.name,
        group: g.group,
        phone: '',
        adults: g.adults,
        children: g.children,
        status: g.status,
        tableId: g.tableId,
        dietaryNotes: '',
        rsvpMessage: '',
        source: 'bride',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    // Starter Vendors linked seamlessly to Expenses (Payments)
    const today = new Date().toISOString().slice(0, 10);
    const starterVendors = [
      {
        id: newId('vnd'),
        name: 'Espaço Villa das Oliveiras',
        service: 'Espaço & Cerimônia',
        contact: '(11) 99123-4567',
        contractValue: 14000,
        paidAmount: 7000,
        lastPaymentDate: today,
        nextDueDate: '2027-01-15',
        paymentMethod: 'Pix',
        installmentsTotal: 4,
        installmentsPaid: 2,
        paymentStatus: 'deposit_paid' as const,
        checklistDone: true,
      },
      {
        id: newId('vnd'),
        name: 'Buffet Sabor & Arte',
        service: 'Buffet & Gastronomia',
        contact: '(11) 98234-5678',
        contractValue: 18500,
        paidAmount: 5500,
        lastPaymentDate: today,
        nextDueDate: '2027-02-20',
        paymentMethod: 'Transferência',
        installmentsTotal: 6,
        installmentsPaid: 2,
        paymentStatus: 'deposit_paid' as const,
        checklistDone: true,
      },
      {
        id: newId('vnd'),
        name: 'Studio Luz Editorial',
        service: 'Foto & Filme',
        contact: '(11) 97345-6789',
        contractValue: 6800,
        paidAmount: 6800,
        lastPaymentDate: today,
        nextDueDate: '2027-01-10',
        paymentMethod: 'Pix',
        installmentsTotal: 2,
        installmentsPaid: 2,
        paymentStatus: 'paid' as const,
        checklistDone: true,
      },
      {
        id: newId('vnd'),
        name: 'Quarteto Lumina',
        service: 'Som, Luz & Música',
        contact: '(11) 98888-2020',
        contractValue: 3200,
        paidAmount: 0,
        lastPaymentDate: '',
        nextDueDate: '2027-03-10',
        paymentMethod: 'Pix',
        installmentsTotal: 2,
        installmentsPaid: 0,
        paymentStatus: 'pending' as const,
        checklistDone: false,
      },
    ];

    for (const v of starterVendors) {
      await setDoc(doc(db, `weddings/${weddingId}/vendors`, v.id), {
        weddingId,
        ownerId: params.ownerId,
        name: v.name,
        service: v.service,
        contact: v.contact,
        contractValue: v.contractValue,
        paidAmount: v.paidAmount,
        lastPaymentDate: v.lastPaymentDate,
        nextDueDate: v.nextDueDate,
        paymentMethod: v.paymentMethod,
        installmentsTotal: v.installmentsTotal,
        installmentsPaid: v.installmentsPaid,
        paymentStatus: v.paymentStatus,
        checklistDone: v.checklistDone,
        notes: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const expStatus: Expense['status'] =
        v.paidAmount >= v.contractValue && v.contractValue > 0
          ? 'paid'
          : v.paidAmount > 0
          ? 'partial'
          : 'pending';

      await setDoc(doc(db, `weddings/${weddingId}/expenses`, newId('exp')), {
        weddingId,
        ownerId: params.ownerId,
        vendorId: v.id,
        title: `${v.name} (${v.service})`,
        category: v.service,
        amount: v.contractValue,
        paidAmount: v.paidAmount,
        dueDate: v.nextDueDate,
        lastPaymentDate: v.lastPaymentDate,
        paymentMethod: v.paymentMethod,
        status: expStatus,
        bankSynced: false,
        notes: 'Conectado ao cadastro de fornecedores',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    // Schedule, Party, Gifts
    const starterSchedule = [
      { time: '14:00', title: 'Making Of', description: 'Preparação dos noivos com equipe de beleza e fotografia.', location: 'Suíte dos Noivos', order: 1 },
      { time: params.weddingTime || '16:30', title: 'Cerimônia', description: 'Celebração principal com entrada dos padrinhos e votos.', location: params.venueName || 'Jardim Central', order: 2 },
      { time: '18:00', title: 'Fotos & Coquetel', description: 'Sessão do casal e recepção dos convidados.', location: 'Terraço', order: 3 },
      { time: '19:30', title: 'Jantar & Festa', description: 'Jantar servido seguido de brinde e pista de dança.', location: 'Salão Principal', order: 4 },
    ];
    for (const s of starterSchedule) {
      await setDoc(doc(db, `weddings/${weddingId}/schedule`, newId('sch')), {
        weddingId,
        ownerId: params.ownerId,
        ...s,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const starterParty = [
      { name: 'Marina Mendes', role: 'Madrinha' as const, description: 'Presença essencial em cada passo até o altar.', photoUrl: GENERATED_ASSETS.padrinho1, order: 1 },
      { name: 'Rafael Souza', role: 'Padrinho' as const, description: 'Amigo de todas as jornadas e testemunha do nosso amor.', photoUrl: GENERATED_ASSETS.padrinho2, order: 2 },
    ];
    for (const p of starterParty) {
      await setDoc(doc(db, `weddings/${weddingId}/party`, newId('prt')), {
        weddingId,
        ownerId: params.ownerId,
        ...p,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const starterGifts = [
      { title: 'Cota da Lua de Mel', category: 'Lua de Mel', price: 200, description: 'Contribuição especial para nossa viagem de recém-casados.', purchasedCount: 0, active: true },
      { title: 'Jogo de Panelas Cerâmica', category: 'Cozinha', price: 150, description: 'Para nossas receitas na casa nova.', purchasedCount: 0, active: true },
      { title: 'Jantar Romântico na Lua de Mel', category: 'Lua de Mel', price: 300, description: 'Um brinde inesquecível em nossa primeira semana casados.', purchasedCount: 0, active: true },
    ];
    for (const gift of starterGifts) {
      await setDoc(doc(db, `weddings/${weddingId}/gifts`, newId('gft')), {
        weddingId,
        ownerId: params.ownerId,
        ...gift,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const createdSnap = await getDoc(doc(db, 'weddings', weddingId));
    return createdSnap.data() as Wedding;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, weddingPath);
  }
}

export async function updateWedding(
  weddingId: string,
  updates: Partial<Omit<Wedding, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
  const path = `weddings/${weddingId}`;
  try {
    const clean: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (updates.brideName !== undefined) clean.brideName = sanitizeString(updates.brideName, 80);
    if (updates.groomName !== undefined) clean.groomName = sanitizeString(updates.groomName, 80);
    if (updates.weddingDate !== undefined) clean.weddingDate = sanitizeString(updates.weddingDate, 20);
    if (updates.weddingTime !== undefined) clean.weddingTime = sanitizeString(updates.weddingTime, 10);
    if (updates.venueName !== undefined) clean.venueName = sanitizeString(updates.venueName, 160);
    if (updates.venueAddress !== undefined) clean.venueAddress = sanitizeString(updates.venueAddress, 300);
    if (updates.venueMapsUrl !== undefined) clean.venueMapsUrl = sanitizeString(updates.venueMapsUrl, 500);
    if (updates.dressCode !== undefined) clean.dressCode = sanitizeString(updates.dressCode, 120);
    if (updates.welcomeMessage !== undefined) clean.welcomeMessage = sanitizeString(updates.welcomeMessage, 600);
    if (updates.coupleStory !== undefined) clean.coupleStory = sanitizeString(updates.coupleStory, 2500);
    if (updates.coverPhotoUrl !== undefined) clean.coverPhotoUrl = sanitizeString(updates.coverPhotoUrl, 180000);
    if (updates.couplePhotoUrl !== undefined) clean.couplePhotoUrl = sanitizeString(updates.couplePhotoUrl, 180000);
    if (updates.coverPhotoPosition !== undefined) clean.coverPhotoPosition = updates.coverPhotoPosition;
    if (updates.couplePhotoPosition !== undefined) clean.couplePhotoPosition = updates.couplePhotoPosition;
    if (updates.themeKey !== undefined) clean.themeKey = updates.themeKey;
    if (updates.customAccentColor !== undefined) clean.customAccentColor = sanitizeString(updates.customAccentColor, 20);
    if (updates.pixKey !== undefined) clean.pixKey = sanitizeString(updates.pixKey, 140);
    if (updates.pixBeneficiary !== undefined) clean.pixBeneficiary = sanitizeString(updates.pixBeneficiary, 120);
    if (updates.budgetLimit !== undefined) clean.budgetLimit = Math.max(0, Number(updates.budgetLimit) || 0);
    if (updates.savingsGoal !== undefined) clean.savingsGoal = Math.max(0, Number(updates.savingsGoal) || 0);
    if (updates.savingsCurrent !== undefined) clean.savingsCurrent = Math.max(0, Number(updates.savingsCurrent) || 0);
    if (updates.status !== undefined) clean.status = updates.status;

    await updateDoc(doc(db, 'weddings', weddingId), clean);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// ============================================================================
// Subcollection CRUD Helpers
// ============================================================================
export async function addGuest(
  weddingId: string,
  ownerId: string,
  data: { name: string; group: string; phone?: string; adults: number; children: number; status: Guest['status']; dietaryNotes?: string }
): Promise<void> {
  const id = newId('gst');
  const path = `weddings/${weddingId}/guests/${id}`;
  try {
    await setDoc(doc(db, `weddings/${weddingId}/guests`, id), {
      weddingId,
      ownerId,
      name: sanitizeString(data.name, 120),
      group: sanitizeString(data.group || 'Convidados', 60),
      phone: sanitizeString(data.phone || '', 30),
      adults: Math.min(20, Math.max(0, Number(data.adults) || 1)),
      children: Math.min(20, Math.max(0, Number(data.children) || 0)),
      status: data.status,
      tableId: '',
      dietaryNotes: sanitizeString(data.dietaryNotes || '', 250),
      rsvpMessage: '',
      source: 'bride',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateGuest(
  weddingId: string,
  guestId: string,
  updates: Partial<Pick<Guest, 'name' | 'group' | 'phone' | 'adults' | 'children' | 'status' | 'tableId' | 'dietaryNotes' | 'rsvpMessage'>>
): Promise<void> {
  const path = `weddings/${weddingId}/guests/${guestId}`;
  try {
    const clean: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (updates.name !== undefined) clean.name = sanitizeString(updates.name, 120);
    if (updates.group !== undefined) clean.group = sanitizeString(updates.group, 60);
    if (updates.phone !== undefined) clean.phone = sanitizeString(updates.phone, 30);
    if (updates.adults !== undefined) clean.adults = Math.min(20, Math.max(0, Number(updates.adults) || 0));
    if (updates.children !== undefined) clean.children = Math.min(20, Math.max(0, Number(updates.children) || 0));
    if (updates.status !== undefined) clean.status = updates.status;
    if (updates.tableId !== undefined) clean.tableId = sanitizeString(updates.tableId, 128);
    if (updates.dietaryNotes !== undefined) clean.dietaryNotes = sanitizeString(updates.dietaryNotes, 250);
    if (updates.rsvpMessage !== undefined) clean.rsvpMessage = sanitizeString(updates.rsvpMessage, 500);
    await updateDoc(doc(db, `weddings/${weddingId}/guests`, guestId), clean);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteGuest(weddingId: string, guestId: string): Promise<void> {
  const path = `weddings/${weddingId}/guests/${guestId}`;
  try {
    await deleteDoc(doc(db, `weddings/${weddingId}/guests`, guestId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function addSeatingTable(
  weddingId: string,
  ownerId: string,
  data: { name: string; capacity: number; shape: 'round' | 'rectangular'; zone?: string }
): Promise<void> {
  const id = newId('tbl');
  const path = `weddings/${weddingId}/tables/${id}`;
  try {
    await setDoc(doc(db, `weddings/${weddingId}/tables`, id), {
      weddingId,
      ownerId,
      name: sanitizeString(data.name, 80),
      capacity: Math.min(50, Math.max(1, Number(data.capacity) || 8)),
      shape: data.shape,
      zone: sanitizeString(data.zone || 'Salão Principal', 80),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteSeatingTable(weddingId: string, tableId: string): Promise<void> {
  const path = `weddings/${weddingId}/tables/${tableId}`;
  try {
    await deleteDoc(doc(db, `weddings/${weddingId}/tables`, tableId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function addExpense(
  weddingId: string,
  ownerId: string,
  data: {
    vendorId?: string;
    title: string;
    category: string;
    amount: number;
    paidAmount: number;
    dueDate: string;
    lastPaymentDate?: string;
    paymentMethod?: string;
    bankSynced?: boolean;
    notes?: string;
  }
): Promise<void> {
  const id = newId('exp');
  const path = `weddings/${weddingId}/expenses/${id}`;
  const amount = Math.max(0, Number(data.amount) || 0);
  const paidAmount = Math.min(amount, Math.max(0, Number(data.paidAmount) || 0));
  const status: Expense['status'] = paidAmount >= amount && amount > 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'pending';
  try {
    await setDoc(doc(db, `weddings/${weddingId}/expenses`, id), {
      weddingId,
      ownerId,
      vendorId: sanitizeString(data.vendorId || '', 128),
      title: sanitizeString(data.title, 140),
      category: sanitizeString(data.category, 60),
      amount,
      paidAmount,
      dueDate: sanitizeString(data.dueDate || '2027-01-15', 20),
      lastPaymentDate: sanitizeString(data.lastPaymentDate || (paidAmount > 0 ? new Date().toISOString().slice(0, 10) : ''), 30),
      paymentMethod: sanitizeString(data.paymentMethod || 'Pix', 40),
      status,
      bankSynced: Boolean(data.bankSynced),
      notes: sanitizeString(data.notes || '', 300),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateExpense(
  weddingId: string,
  expenseId: string,
  updates: Partial<Pick<Expense, 'vendorId' | 'title' | 'category' | 'amount' | 'paidAmount' | 'dueDate' | 'lastPaymentDate' | 'paymentMethod' | 'status' | 'notes'>>
): Promise<void> {
  const path = `weddings/${weddingId}/expenses/${expenseId}`;
  try {
    const clean: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (updates.vendorId !== undefined) clean.vendorId = sanitizeString(updates.vendorId, 128);
    if (updates.title !== undefined) clean.title = sanitizeString(updates.title, 140);
    if (updates.category !== undefined) clean.category = sanitizeString(updates.category, 60);
    if (updates.amount !== undefined) clean.amount = Math.max(0, Number(updates.amount) || 0);
    if (updates.paidAmount !== undefined) clean.paidAmount = Math.max(0, Number(updates.paidAmount) || 0);
    if (updates.dueDate !== undefined) clean.dueDate = sanitizeString(updates.dueDate, 20);
    if (updates.lastPaymentDate !== undefined) clean.lastPaymentDate = sanitizeString(updates.lastPaymentDate, 30);
    if (updates.paymentMethod !== undefined) clean.paymentMethod = sanitizeString(updates.paymentMethod, 40);
    if (updates.status !== undefined) clean.status = updates.status;
    if (updates.notes !== undefined) clean.notes = sanitizeString(updates.notes, 300);
    await updateDoc(doc(db, `weddings/${weddingId}/expenses`, expenseId), clean);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteExpense(weddingId: string, expenseId: string): Promise<void> {
  const path = `weddings/${weddingId}/expenses/${expenseId}`;
  try {
    await deleteDoc(doc(db, `weddings/${weddingId}/expenses`, expenseId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function addVendor(
  weddingId: string,
  ownerId: string,
  data: {
    name: string;
    service: string;
    contact?: string;
    contractValue: number;
    paidAmount?: number;
    lastPaymentDate?: string;
    nextDueDate?: string;
    paymentMethod?: string;
    installmentsTotal?: number;
    installmentsPaid?: number;
    paymentStatus?: Vendor['paymentStatus'];
    checklistDone: boolean;
    notes?: string;
    syncToPayments?: boolean;
  }
): Promise<string> {
  const id = newId('vnd');
  const path = `weddings/${weddingId}/vendors/${id}`;
  const contractValue = Math.max(0, Number(data.contractValue) || 0);
  const paidAmount = Math.min(contractValue, Math.max(0, Number(data.paidAmount) || 0));
  const computedStatus: Vendor['paymentStatus'] =
    paidAmount >= contractValue && contractValue > 0
      ? 'paid'
      : paidAmount > 0
      ? 'deposit_paid'
      : data.paymentStatus || 'pending';
  const lastPaymentDate = data.lastPaymentDate || (paidAmount > 0 ? new Date().toISOString().slice(0, 10) : '');
  const nextDueDate = data.nextDueDate || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  try {
    await setDoc(doc(db, `weddings/${weddingId}/vendors`, id), {
      weddingId,
      ownerId,
      name: sanitizeString(data.name, 140),
      service: sanitizeString(data.service, 80),
      contact: sanitizeString(data.contact || '', 100),
      contractValue,
      paidAmount,
      lastPaymentDate: sanitizeString(lastPaymentDate, 30),
      nextDueDate: sanitizeString(nextDueDate, 30),
      paymentMethod: sanitizeString(data.paymentMethod || 'Pix', 40),
      installmentsTotal: Math.min(60, Math.max(1, Number(data.installmentsTotal) || 1)),
      installmentsPaid: Math.min(60, Math.max(0, Number(data.installmentsPaid) || (paidAmount > 0 ? 1 : 0))),
      paymentStatus: computedStatus,
      checklistDone: Boolean(data.checklistDone),
      notes: sanitizeString(data.notes || '', 300),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Automatically connect this service to the Payments/Finance area
    if (data.syncToPayments !== false && contractValue > 0) {
      await addExpense(weddingId, ownerId, {
        vendorId: id,
        title: `${data.name} (${data.service})`,
        category: data.service,
        amount: contractValue,
        paidAmount,
        dueDate: nextDueDate,
        lastPaymentDate,
        paymentMethod: data.paymentMethod || 'Pix',
        notes: data.notes || 'Conectado ao fornecedor',
      });
    }

    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateVendor(
  weddingId: string,
  vendorId: string,
  updates: Partial<
    Pick<
      Vendor,
      | 'name'
      | 'service'
      | 'contact'
      | 'contractValue'
      | 'paidAmount'
      | 'lastPaymentDate'
      | 'nextDueDate'
      | 'paymentMethod'
      | 'installmentsTotal'
      | 'installmentsPaid'
      | 'paymentStatus'
      | 'checklistDone'
      | 'notes'
    >
  >
): Promise<void> {
  const path = `weddings/${weddingId}/vendors/${vendorId}`;
  try {
    const clean: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (updates.name !== undefined) clean.name = sanitizeString(updates.name, 140);
    if (updates.service !== undefined) clean.service = sanitizeString(updates.service, 80);
    if (updates.contact !== undefined) clean.contact = sanitizeString(updates.contact, 100);
    if (updates.contractValue !== undefined) clean.contractValue = Math.max(0, Number(updates.contractValue) || 0);
    if (updates.paidAmount !== undefined) clean.paidAmount = Math.max(0, Number(updates.paidAmount) || 0);
    if (updates.lastPaymentDate !== undefined) clean.lastPaymentDate = sanitizeString(updates.lastPaymentDate, 30);
    if (updates.nextDueDate !== undefined) clean.nextDueDate = sanitizeString(updates.nextDueDate, 30);
    if (updates.paymentMethod !== undefined) clean.paymentMethod = sanitizeString(updates.paymentMethod, 40);
    if (updates.installmentsTotal !== undefined) clean.installmentsTotal = Math.min(60, Math.max(1, Number(updates.installmentsTotal) || 1));
    if (updates.installmentsPaid !== undefined) clean.installmentsPaid = Math.min(60, Math.max(0, Number(updates.installmentsPaid) || 0));
    if (updates.paymentStatus !== undefined) clean.paymentStatus = updates.paymentStatus;
    if (updates.checklistDone !== undefined) clean.checklistDone = Boolean(updates.checklistDone);
    if (updates.notes !== undefined) clean.notes = sanitizeString(updates.notes, 300);
    await updateDoc(doc(db, `weddings/${weddingId}/vendors`, vendorId), clean);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Abates a partial or full payment on a Vendor and synchronizes the linked Expense in Payments.
 */
export async function abateVendorPayment(params: {
  weddingId: string;
  vendor: Vendor;
  linkedExpense?: Expense;
  amountToAbate: number;
  paymentDate: string;
  paymentMethod: string;
  nextDueDate?: string;
}): Promise<void> {
  const { weddingId, vendor, linkedExpense, amountToAbate, paymentDate, paymentMethod, nextDueDate } = params;
  const currentPaid = vendor.paidAmount ?? (vendor.paymentStatus === 'paid' ? vendor.contractValue : 0);
  const newPaid = Math.min(vendor.contractValue, Math.max(0, currentPaid + Math.max(0, amountToAbate)));
  const isFullyPaid = newPaid >= vendor.contractValue && vendor.contractValue > 0;
  const newVendorStatus: Vendor['paymentStatus'] = isFullyPaid ? 'paid' : newPaid > 0 ? 'deposit_paid' : 'pending';
  const newExpStatus: Expense['status'] = isFullyPaid ? 'paid' : newPaid > 0 ? 'partial' : 'pending';
  const totalInst = vendor.installmentsTotal || 1;
  const nextInstPaid = isFullyPaid ? totalInst : Math.min(totalInst, (vendor.installmentsPaid || 0) + 1);

  await updateVendor(weddingId, vendor.id, {
    paidAmount: newPaid,
    lastPaymentDate: paymentDate,
    paymentMethod,
    nextDueDate: nextDueDate || vendor.nextDueDate || '',
    installmentsPaid: nextInstPaid,
    paymentStatus: newVendorStatus,
  });

  if (linkedExpense) {
    await updateExpense(weddingId, linkedExpense.id, {
      paidAmount: newPaid,
      lastPaymentDate: paymentDate,
      paymentMethod,
      dueDate: nextDueDate || linkedExpense.dueDate,
      status: newExpStatus,
    });
  } else {
    // Ensure it also appears in Payments if created earlier
    await addExpense(weddingId, vendor.ownerId, {
      vendorId: vendor.id,
      title: `${vendor.name} (${vendor.service})`,
      category: vendor.service,
      amount: vendor.contractValue,
      paidAmount: newPaid,
      dueDate: nextDueDate || vendor.nextDueDate || paymentDate,
      lastPaymentDate: paymentDate,
      paymentMethod,
      notes: 'Sincronizado via abatimento de fornecedor',
    });
  }
}

/**
 * Abates a partial or full payment on an Expense and synchronizes the linked Vendor (if any).
 */
export async function abateExpensePayment(params: {
  weddingId: string;
  expense: Expense;
  linkedVendor?: Vendor;
  amountToAbate: number;
  paymentDate: string;
  paymentMethod: string;
}): Promise<void> {
  const { weddingId, expense, linkedVendor, amountToAbate, paymentDate, paymentMethod } = params;
  const newPaid = Math.min(expense.amount, Math.max(0, expense.paidAmount + Math.max(0, amountToAbate)));
  const isFullyPaid = newPaid >= expense.amount && expense.amount > 0;
  const newExpStatus: Expense['status'] = isFullyPaid ? 'paid' : newPaid > 0 ? 'partial' : 'pending';

  await updateExpense(weddingId, expense.id, {
    paidAmount: newPaid,
    lastPaymentDate: paymentDate,
    paymentMethod,
    status: newExpStatus,
  });

  if (linkedVendor) {
    const newVendorStatus: Vendor['paymentStatus'] = isFullyPaid ? 'paid' : newPaid > 0 ? 'deposit_paid' : 'pending';
    const totalInst = linkedVendor.installmentsTotal || 1;
    const nextInstPaid = isFullyPaid ? totalInst : Math.min(totalInst, (linkedVendor.installmentsPaid || 0) + 1);
    await updateVendor(weddingId, linkedVendor.id, {
      paidAmount: newPaid,
      lastPaymentDate: paymentDate,
      paymentMethod,
      installmentsPaid: nextInstPaid,
      paymentStatus: newVendorStatus,
    });
  }
}

export async function deleteVendor(weddingId: string, vendorId: string, linkedExpenseId?: string): Promise<void> {
  const path = `weddings/${weddingId}/vendors/${vendorId}`;
  try {
    await deleteDoc(doc(db, `weddings/${weddingId}/vendors`, vendorId));
    if (linkedExpenseId) {
      await deleteDoc(doc(db, `weddings/${weddingId}/expenses`, linkedExpenseId));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function addScheduleItem(
  weddingId: string,
  ownerId: string,
  data: { time: string; title: string; description?: string; location?: string; order: number }
): Promise<void> {
  const id = newId('sch');
  const path = `weddings/${weddingId}/schedule/${id}`;
  try {
    await setDoc(doc(db, `weddings/${weddingId}/schedule`, id), {
      weddingId,
      ownerId,
      time: sanitizeString(data.time, 10),
      title: sanitizeString(data.title, 120),
      description: sanitizeString(data.description || '', 300),
      location: sanitizeString(data.location || '', 120),
      order: Math.min(200, Math.max(0, Number(data.order) || 0)),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteScheduleItem(weddingId: string, itemId: string): Promise<void> {
  const path = `weddings/${weddingId}/schedule/${itemId}`;
  try {
    await deleteDoc(doc(db, `weddings/${weddingId}/schedule`, itemId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function addPartyMember(
  weddingId: string,
  ownerId: string,
  data: { name: string; role: PartyMember['role']; description?: string; photoUrl?: string; order: number }
): Promise<void> {
  const id = newId('prt');
  const path = `weddings/${weddingId}/party/${id}`;
  try {
    await setDoc(doc(db, `weddings/${weddingId}/party`, id), {
      weddingId,
      ownerId,
      name: sanitizeString(data.name, 100),
      role: data.role,
      description: sanitizeString(data.description || '', 300),
      photoUrl: sanitizeString(
        data.photoUrl || (data.role === 'Madrinha' || data.role === 'Dama de Honra' ? GENERATED_ASSETS.padrinho1 : GENERATED_ASSETS.padrinho2),
        180000
      ),
      order: Math.min(100, Math.max(0, Number(data.order) || 0)),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deletePartyMember(weddingId: string, memberId: string): Promise<void> {
  const path = `weddings/${weddingId}/party/${memberId}`;
  try {
    await deleteDoc(doc(db, `weddings/${weddingId}/party`, memberId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function addGiftItem(
  weddingId: string,
  ownerId: string,
  data: { title: string; category: string; price: number; description?: string }
): Promise<void> {
  const id = newId('gft');
  const path = `weddings/${weddingId}/gifts/${id}`;
  try {
    await setDoc(doc(db, `weddings/${weddingId}/gifts`, id), {
      weddingId,
      ownerId,
      title: sanitizeString(data.title, 120),
      category: sanitizeString(data.category || 'Lua de Mel', 60),
      price: Math.min(500000, Math.max(1, Number(data.price) || 100)),
      description: sanitizeString(data.description || '', 300),
      purchasedCount: 0,
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteGiftItem(weddingId: string, giftId: string): Promise<void> {
  const path = `weddings/${weddingId}/gifts/${giftId}`;
  try {
    await deleteDoc(doc(db, `weddings/${weddingId}/gifts`, giftId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function confirmGiftContribution(weddingId: string, contributionId: string): Promise<void> {
  const path = `weddings/${weddingId}/giftContributions/${contributionId}`;
  try {
    await updateDoc(doc(db, `weddings/${weddingId}/giftContributions`, contributionId), {
      status: 'confirmed',
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function sendSupportMessage(
  weddingId: string,
  ownerId: string,
  senderRole: 'bride' | 'admin',
  senderName: string,
  text: string
): Promise<void> {
  const id = newId('msg');
  const path = `weddings/${weddingId}/supportMessages/${id}`;
  try {
    await setDoc(doc(db, `weddings/${weddingId}/supportMessages`, id), {
      weddingId,
      ownerId,
      senderRole,
      senderName: sanitizeString(senderName, 100),
      text: sanitizeString(text, 1000),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

// ============================================================================
// Public Guest Site Reads & Submissions
// ============================================================================
export async function loadPublicWeddingBySlug(slug: string): Promise<{
  wedding: Wedding;
  schedule: ScheduleItem[];
  party: PartyMember[];
  gifts: GiftItem[];
} | null> {
  const cleanSlug = slugify(slug);
  try {
    const slugSnap = await getDoc(doc(db, 'slugs', cleanSlug));
    if (!slugSnap.exists()) return null;
    const { weddingId } = slugSnap.data() as { weddingId: string };
    const wedSnap = await getDoc(doc(db, 'weddings', weddingId));
    if (!wedSnap.exists()) return null;
    const wedding = wedSnap.data() as Wedding;

    const [schSnap, partySnap, giftsSnap] = await Promise.all([
      getDocs(query(collection(db, `weddings/${weddingId}/schedule`), where('weddingId', '==', weddingId))),
      getDocs(query(collection(db, `weddings/${weddingId}/party`), where('weddingId', '==', weddingId))),
      getDocs(query(collection(db, `weddings/${weddingId}/gifts`), where('weddingId', '==', weddingId))),
    ]);

    const schedule = schSnap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<ScheduleItem, 'id'>) }))
      .sort((a, b) => a.order - b.order);
    const party = partySnap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<PartyMember, 'id'>) }))
      .sort((a, b) => a.order - b.order);
    const gifts = giftsSnap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<GiftItem, 'id'>) }))
      .filter((g) => g.active);

    return { wedding, schedule, party, gifts };
  } catch (error) {
    console.error('Public wedding load error:', error);
    return null;
  }
}

export async function submitPublicRsvp(
  wedding: Wedding,
  data: { name: string; phone?: string; adults: number; children: number; status: 'confirmed' | 'declined'; dietaryNotes?: string; rsvpMessage?: string }
): Promise<void> {
  const id = newId('rsvp');
  const path = `weddings/${wedding.id}/guests/${id}`;
  try {
    await setDoc(doc(db, `weddings/${wedding.id}/guests`, id), {
      weddingId: wedding.id,
      ownerId: wedding.ownerId,
      name: sanitizeString(data.name, 120),
      group: 'Site dos Convidados',
      phone: sanitizeString(data.phone || '', 30),
      adults: Math.min(20, Math.max(0, Number(data.adults) || 1)),
      children: Math.min(20, Math.max(0, Number(data.children) || 0)),
      status: data.status,
      tableId: '',
      dietaryNotes: sanitizeString(data.dietaryNotes || '', 250),
      rsvpMessage: sanitizeString(data.rsvpMessage || '', 500),
      source: 'public_rsvp',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function submitPublicGiftContribution(
  wedding: Wedding,
  gift: GiftItem,
  data: { guestName: string; message?: string }
): Promise<void> {
  const id = newId('contrib');
  const path = `weddings/${wedding.id}/giftContributions/${id}`;
  try {
    await setDoc(doc(db, `weddings/${wedding.id}/giftContributions`, id), {
      weddingId: wedding.id,
      ownerId: wedding.ownerId,
      giftId: gift.id,
      giftTitle: sanitizeString(gift.title, 120),
      guestName: sanitizeString(data.guestName, 120),
      amount: gift.price,
      message: sanitizeString(data.message || '', 500),
      status: 'pending_pix',
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

// ============================================================================
// Real-Time Firestore Listeners (Authenticated Owner / Admin)
// ============================================================================
export function subscribeWeddingSubcollections(
  weddingId: string,
  ownerId: string,
  callbacks: {
    onGuests: (items: Guest[]) => void;
    onTables: (items: SeatingTable[]) => void;
    onExpenses: (items: Expense[]) => void;
    onVendors: (items: Vendor[]) => void;
    onSchedule: (items: ScheduleItem[]) => void;
    onParty: (items: PartyMember[]) => void;
    onGifts: (items: GiftItem[]) => void;
    onContributions: (items: GiftContribution[]) => void;
    onMessages: (items: SupportMessage[]) => void;
  }
): Unsubscribe {
  const unsubs: Unsubscribe[] = [];

  const listenOwned = <T extends { id: string }>(
    sub: string,
    cb: (items: T[]) => void,
    sortFn?: (a: T, b: T) => number
  ) => {
    const path = `weddings/${weddingId}/${sub}`;
    const q = query(collection(db, path), where('ownerId', '==', ownerId));
    const u = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }) as T);
        cb(sortFn ? list.sort(sortFn) : list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, path)
    );
    unsubs.push(u);
  };

  listenOwned<Guest>('guests', callbacks.onGuests);
  listenOwned<SeatingTable>('tables', callbacks.onTables);
  listenOwned<Expense>('expenses', callbacks.onExpenses, (a, b) => a.dueDate.localeCompare(b.dueDate));
  listenOwned<Vendor>('vendors', callbacks.onVendors);

  const listenPublicSub = <T extends { id: string }>(
    sub: string,
    cb: (items: T[]) => void,
    sortFn?: (a: T, b: T) => number
  ) => {
    const path = `weddings/${weddingId}/${sub}`;
    const q = query(collection(db, path), where('weddingId', '==', weddingId));
    const u = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }) as T);
        cb(sortFn ? list.sort(sortFn) : list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, path)
    );
    unsubs.push(u);
  };

  listenPublicSub<ScheduleItem>('schedule', callbacks.onSchedule, (a, b) => a.order - b.order);
  listenPublicSub<PartyMember>('party', callbacks.onParty, (a, b) => a.order - b.order);
  listenPublicSub<GiftItem>('gifts', callbacks.onGifts);
  listenOwned<GiftContribution>('giftContributions', callbacks.onContributions);

  const msgPath = `weddings/${weddingId}/supportMessages`;
  const msgQ = query(collection(db, msgPath), where('ownerId', '==', ownerId), orderBy('createdAt', 'asc'));
  unsubs.push(
    onSnapshot(
      msgQ,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SupportMessage, 'id'>) }));
        callbacks.onMessages(list);
      },
      () => {
        const fallbackQ = query(collection(db, msgPath), where('ownerId', '==', ownerId));
        onSnapshot(
          fallbackQ,
          (snap) => {
            const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SupportMessage, 'id'>) }));
            callbacks.onMessages(list);
          },
          (err) => handleFirestoreError(err, OperationType.LIST, msgPath)
        );
      }
    )
  );

  return () => {
    unsubs.forEach((u) => u());
  };
}

export function subscribeAdminData(callbacks: {
  onUsers: (users: UserProfile[]) => void;
  onWeddings: (weddings: Wedding[]) => void;
}): Unsubscribe {
  const u1 = onSnapshot(
    collection(db, 'users'),
    (snap) => {
      callbacks.onUsers(snap.docs.map((d) => d.data() as UserProfile));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'users')
  );
  const u2 = onSnapshot(
    collection(db, 'weddings'),
    (snap) => {
      callbacks.onWeddings(snap.docs.map((d) => d.data() as Wedding));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'weddings')
  );
  return () => {
    u1();
    u2();
  };
}
