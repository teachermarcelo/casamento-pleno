import type { Timestamp } from 'firebase/firestore';

export type ThemeKey = 'olive' | 'rose' | 'serenity' | 'champagne' | 'lavender' | 'emerald';

export interface ThemePalette {
  key: ThemeKey;
  name: string;
  subtitle: string;
  primary: string;
  primaryHover: string;
  softLight: string;
  softDark: string;
  ink: string;
}

export const WEDDING_THEMES: Record<ThemeKey, ThemePalette> = {
  olive: {
    key: 'olive',
    name: 'Oliva & Marfim',
    subtitle: 'Botânico contemporâneo',
    primary: '#4A5D4E',
    primaryHover: '#3A4A3E',
    softLight: '#EEF2EE',
    softDark: 'rgba(74, 93, 78, 0.24)',
    ink: '#2C3A30',
  },
  rose: {
    key: 'rose',
    name: 'Rosa Antigo',
    subtitle: 'Romântico atemporal',
    primary: '#9A5461',
    primaryHover: '#7E424D',
    softLight: '#F7EEF0',
    softDark: 'rgba(154, 84, 97, 0.24)',
    ink: '#5E2F38',
  },
  serenity: {
    key: 'serenity',
    name: 'Azul Sereno',
    subtitle: 'Clássico ao ar livre',
    primary: '#3B5978',
    primaryHover: '#2E4660',
    softLight: '#ECF1F7',
    softDark: 'rgba(59, 89, 120, 0.24)',
    ink: '#23364A',
  },
  champagne: {
    key: 'champagne',
    name: 'Dourado Champanhe',
    subtitle: 'Elegância noturna',
    primary: '#8A6B3F',
    primaryHover: '#6F5530',
    softLight: '#F6F1E8',
    softDark: 'rgba(138, 107, 63, 0.24)',
    ink: '#523E22',
  },
  lavender: {
    key: 'lavender',
    name: 'Lavanda Botânica',
    subtitle: 'Leveza e serenidade',
    primary: '#64567A',
    primaryHover: '#504463',
    softLight: '#F2EFF6',
    softDark: 'rgba(100, 86, 122, 0.24)',
    ink: '#3C324B',
  },
  emerald: {
    key: 'emerald',
    name: 'Esmeralda Clássica',
    subtitle: 'Sofisticação editorial',
    primary: '#2A5B4C',
    primaryHover: '#1F463A',
    softLight: '#EAF2EF',
    softDark: 'rgba(42, 91, 76, 0.24)',
    ink: '#1A3A30',
  },
};

export const GENERATED_ASSETS = {
  heroCouple: '/src/assets/images/hero_wedding_couple_1795726353662.jpg',
  storyCouple: '/src/assets/images/story_couple_engagement_1795726354745.jpg',
  venueGarden: '/src/assets/images/venue_ceremony_garden_1795726354548.jpg',
  padrinho1: '/src/assets/images/portrait_padrinho_1_1795726356689.jpg',
  padrinho2: '/src/assets/images/portrait_padrinho_2_1795726356632.jpg',
} as const;

export const ADMIN_EMAIL = 'marcellospropaganda@gmail.com';
export const SUBSCRIPTION_PRICE = 39.9;

export interface PlatformConfig {
  vendorCategories: string[];
  expenseCategories: string[];
  defaultPlanPrice: number;
  supportWhatsApp?: string;
  announcementBanner?: string;
  updatedAt?: Timestamp;
}

export type SupportStatus = 'new' | 'onboarding' | 'active_support' | 'resolved' | 'priority';
export type PhotoPosition = 'top' | 'center' | 'bottom';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'bride' | 'admin';
  subscriptionStatus: 'trial' | 'active' | 'past_due' | 'canceled';
  planPrice: number;
  paymentMethod?: 'pix' | 'card' | 'pending';
  mercadoPagoRef?: string;
  lastPaymentDate?: string;
  nextBillingDate?: string;
  totalPaidSubscription?: number;
  supportStatus?: SupportStatus;
  adminNotes?: string;
  leadSource?: string;
  weddingId?: string;
  biometricEnabled?: boolean;
  pinHash?: string;
  darkMode?: boolean;
  webhookUrl?: string;
  panicButtonLabel?: string;
  panicButtonColor?: string;
  panicButtonPosition?: 'bottom-right' | 'bottom-left';
  breathingSeconds?: number;
  notifyPayments?: boolean;
  notifyRsvp?: boolean;
  notifyDaysBefore?: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Wedding {
  id: string;
  ownerId: string;
  slug: string;
  brideName: string;
  groomName: string;
  weddingDate: string; // YYYY-MM-DD
  weddingTime: string; // HH:mm
  venueName?: string;
  venueAddress?: string;
  venueMapsUrl?: string;
  dressCode?: string;
  welcomeMessage?: string;
  coupleStory?: string;
  coverPhotoUrl?: string;
  couplePhotoUrl?: string;
  coverPhotoPosition?: PhotoPosition;
  couplePhotoPosition?: PhotoPosition;
  themeKey: ThemeKey;
  customAccentColor?: string;
  pixKey?: string;
  pixBeneficiary?: string;
  budgetLimit?: number;
  savingsGoal?: number;
  savingsCurrent?: number;
  status: 'draft' | 'published';
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Guest {
  id: string;
  weddingId: string;
  ownerId: string;
  name: string;
  group: string;
  phone?: string;
  adults: number;
  children: number;
  status: 'pending' | 'confirmed' | 'declined';
  tableId?: string;
  dietaryNotes?: string;
  rsvpMessage?: string;
  source: 'bride' | 'public_rsvp';
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface SeatingTable {
  id: string;
  weddingId: string;
  ownerId: string;
  name: string;
  capacity: number;
  shape: 'round' | 'rectangular';
  zone?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Expense {
  id: string;
  weddingId: string;
  ownerId: string;
  vendorId?: string;
  title: string;
  category: string;
  amount: number;
  paidAmount: number;
  dueDate: string;
  lastPaymentDate?: string;
  paymentMethod?: string;
  status: 'pending' | 'partial' | 'paid';
  bankSynced?: boolean;
  notes?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Vendor {
  id: string;
  weddingId: string;
  ownerId: string;
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
  paymentStatus: 'pending' | 'deposit_paid' | 'paid';
  checklistDone: boolean;
  notes?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface ScheduleItem {
  id: string;
  weddingId: string;
  ownerId: string;
  time: string;
  title: string;
  description?: string;
  location?: string;
  order: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface PartyMember {
  id: string;
  weddingId: string;
  ownerId: string;
  name: string;
  role: 'Madrinha' | 'Padrinho' | 'Dama de Honra' | 'Pajem';
  description?: string;
  photoUrl?: string;
  order: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface GiftItem {
  id: string;
  weddingId: string;
  ownerId: string;
  title: string;
  category: string;
  price: number;
  description?: string;
  purchasedCount: number;
  active: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface GiftContribution {
  id: string;
  weddingId: string;
  ownerId: string;
  giftId: string;
  giftTitle: string;
  guestName: string;
  amount: number;
  message?: string;
  status: 'pending_pix' | 'confirmed';
  createdAt?: Timestamp;
}

export interface SupportMessage {
  id: string;
  weddingId: string;
  ownerId: string;
  senderRole: 'bride' | 'admin';
  senderName: string;
  text: string;
  createdAt?: Timestamp;
}

export const EXPENSE_CATEGORIES = [
  'Buffet & Gastronomia',
  'Espaço & Cerimônia',
  'Vestido & Traje',
  'Decoração & Flores',
  'Foto & Filme',
  'Som, Luz & Música',
  'Assessoria & Cerimonial',
  'Convites & Papelaria',
  'Doces & Bolo',
  'Lua de Mel',
  'Outros',
] as const;

export const GUEST_GROUPS = [
  'Família da Noiva',
  'Família do Noivo',
  'Padrinhos & Madrinhas',
  'Amigos da Faculdade',
  'Trabalho',
  'Amigos Íntimos',
] as const;

export const DEMO_WEDDING: Wedding = {
  id: 'demo-clara-henrique',
  ownerId: 'demo',
  slug: 'clara-e-henrique',
  brideName: 'Clara',
  groomName: 'Henrique',
  weddingDate: '2027-06-19',
  weddingTime: '16:30',
  venueName: 'Villa das Oliveiras — Fazenda Boa Vista',
  venueAddress: 'Estrada das Oliveiras, km 14 — Campinas, SP',
  venueMapsUrl: 'https://maps.google.com/?q=Campinas+SP',
  dressCode: 'Esporte Fino — Tons neutros e terrosos',
  welcomeMessage:
    'Que alegria dividir com você o início deste capítulo tão sonhado. Preparamos cada detalhe com calma, carinho e afeto para celebrarmos juntos um dia leve e inesquecível.',
  coupleStory:
    'Nos conhecemos em uma tarde chuvosa de abril, em uma livraria no centro, disputando o último exemplar de um livro de crônicas. O café que deveria durar vinte minutos atravessou a noite inteira. Cinco anos, dezenas de viagens e incontáveis risadas depois, decidimos oficializar a parceria mais bonita das nossas vidas diante das pessoas que mais amamos.',
  coverPhotoUrl: GENERATED_ASSETS.heroCouple,
  couplePhotoUrl: GENERATED_ASSETS.storyCouple,
  themeKey: 'olive',
  pixKey: 'clara.henrique@casamentopleno.com.br',
  pixBeneficiary: 'Clara Mendes e Henrique Souza',
  budgetLimit: 75000,
  savingsGoal: 80000,
  savingsCurrent: 58400,
  status: 'published',
};

export const DEMO_SCHEDULE: ScheduleItem[] = [
  { id: 's1', weddingId: 'demo-clara-henrique', ownerId: 'demo', time: '14:00', title: 'Making Of dos Noivos', description: 'Preparação no casarão principal com madrinhas e padrinhos.', location: 'Suíte Jardim', order: 1 },
  { id: 's2', weddingId: 'demo-clara-henrique', ownerId: 'demo', time: '16:30', title: 'Cerimônia ao Pôr do Sol', description: 'Recepção dos convidados a partir das 16h no jardim das oliveiras.', location: 'Alameda Central', order: 2 },
  { id: 's3', weddingId: 'demo-clara-henrique', ownerId: 'demo', time: '17:45', title: 'Brinde & Sessão de Fotos', description: 'Coquetel de boas-vindas ao som de quarteto acústico.', location: 'Varanda de Pedra', order: 3 },
  { id: 's4', weddingId: 'demo-clara-henrique', ownerId: 'demo', time: '19:30', title: 'Jantar & Celebração', description: 'Menu autoral servido à mesa seguido de abertura da pista.', location: 'Salão de Vidro', order: 4 },
];

export const DEMO_PARTY: PartyMember[] = [
  { id: 'p1', weddingId: 'demo-clara-henrique', ownerId: 'demo', name: 'Marina Mendes', role: 'Madrinha', description: 'Irmã da noiva, confidente de todas as horas e melhor conselheira.', photoUrl: GENERATED_ASSETS.padrinho1, order: 1 },
  { id: 'p2', weddingId: 'demo-clara-henrique', ownerId: 'demo', name: 'Rafael Souza', role: 'Padrinho', description: 'Amigo de infância do noivo e parceiro das melhores histórias.', photoUrl: GENERATED_ASSETS.padrinho2, order: 2 },
  { id: 'p3', weddingId: 'demo-clara-henrique', ownerId: 'demo', name: 'Beatriz Alencar', role: 'Madrinha', description: 'Amiga desde a faculdade, presente desde o primeiro encontro do casal.', photoUrl: GENERATED_ASSETS.padrinho1, order: 3 },
  { id: 'p4', weddingId: 'demo-clara-henrique', ownerId: 'demo', name: 'Daniel Castro', role: 'Padrinho', description: 'Padrinho escolhido com o coração por sempre torcer pela nossa felicidade.', photoUrl: GENERATED_ASSETS.padrinho2, order: 4 },
];

export const DEMO_GIFTS: GiftItem[] = [
  { id: 'g1', weddingId: 'demo-clara-henrique', ownerId: 'demo', title: 'Cota da Lua de Mel — Toscana', category: 'Lua de Mel', price: 250, description: 'Ajude-nos a viver um jantar inesquecível entre os vinhedos.', purchasedCount: 6, active: true },
  { id: 'g2', weddingId: 'demo-clara-henrique', ownerId: 'demo', title: 'Jogo de Panelas Cerâmica Premium', category: 'Cozinha', price: 180, description: 'Para nossas primeiras receitas de domingo na casa nova.', purchasedCount: 3, active: true },
  { id: 'g3', weddingId: 'demo-clara-henrique', ownerId: 'demo', title: 'Cafeteira Espresso Italiana', category: 'Cozinha', price: 320, description: 'Porque nossa história começou justamente com um café.', purchasedCount: 2, active: true },
  { id: 'g4', weddingId: 'demo-clara-henrique', ownerId: 'demo', title: 'Passeio de Barco ao Pôr do Sol', category: 'Lua de Mel', price: 150, description: 'Um brinde especial durante a nossa viagem de recém-casados.', purchasedCount: 4, active: true },
  { id: 'g5', weddingId: 'demo-clara-henrique', ownerId: 'demo', title: 'Enxoval de Linho Egípcio', category: 'Casa Nova', price: 400, description: 'Conforto e carinho para o nosso novo lar.', purchasedCount: 1, active: true },
  { id: 'g6', weddingId: 'demo-clara-henrique', ownerId: 'demo', title: 'Cota Café da Manhã na Cama', category: 'Lua de Mel', price: 100, description: 'Um gesto carinhoso para começar o dia com leveza.', purchasedCount: 8, active: true },
];
