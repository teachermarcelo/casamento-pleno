import { jsPDF } from 'jspdf';
import type { Expense, Guest, ScheduleItem, Wedding } from '../types/wedding';

export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number.isFinite(value) ? value : 0);
}

export function sanitizeString(val: string, maxLen: number): string {
  return val.trim().slice(0, maxLen);
}

export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72) || 'meu-casamento';
}

export function safeExternalUrl(url?: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

export function isValidImageUrl(url?: string): boolean {
  if (!url) return false;
  if (url.startsWith('/src/assets/images/') || url.startsWith('/')) return true;
  if (/^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(url)) return true;
  return safeExternalUrl(url) !== null;
}

export function formatDateBR(isoDate?: string): string {
  if (!isoDate) return '—';
  const parts = isoDate.slice(0, 10).split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function getObjectPositionClass(pos?: 'top' | 'center' | 'bottom'): string {
  if (pos === 'top') return 'object-top';
  if (pos === 'bottom') return 'object-bottom';
  return 'object-center';
}

/**
 * Compresses an uploaded image file to a lightweight JPEG data URL (< 160KB)
 * so couples can upload entrance/cover photos directly into Firestore safely.
 */
export function compressImageToDataUrl(file: File, maxWidth = 1080): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo de imagem.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Formato de imagem não suportado.'));
      img.onload = () => {
        const scale = Math.min(1, maxWidth / Math.max(1, img.width));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas indisponível.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        let quality = 0.78;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        while (dataUrl.length > 165000 && quality > 0.35) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        resolve(dataUrl);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Generates an official EMVCo / Banco Central Pix Copia e Cola payload.
 */
export function generatePixCode(params: {
  pixKey: string;
  beneficiary: string;
  amount: number;
  txid?: string;
}): string {
  const key = params.pixKey.trim().slice(0, 77) || 'presentes@casamentopleno.com.br';
  const name =
    params.beneficiary
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9 ]/g, '')
      .slice(0, 25)
      .toUpperCase() || 'CASAMENTO PLENO';
  const city = 'SAO PAULO';
  const amountStr = Math.max(1, params.amount).toFixed(2);
  const txid = (params.txid || 'PRESENTE').replace(/[^a-zA-Z0-9]/g, '').slice(0, 25) || 'PRESENTE';

  const f = (id: string, val: string) => `${id}${String(val.length).padStart(2, '0')}${val}`;
  const merchantAccount = f('26', `${f('00', 'br.gov.bcb.pix')}${f('01', key)}`);
  const additional = f('62', f('05', txid));
  const payload =
    f('00', '01') +
    merchantAccount +
    f('52', '0000') +
    f('53', '986') +
    f('54', amountStr) +
    f('58', 'BR') +
    f('59', name) +
    f('60', city) +
    additional +
    '6304';

  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return `${payload}${crc.toString(16).toUpperCase().padStart(4, '0')}`;
}

export function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]): void {
  const escapeCell = (cell: string | number) => {
    const str = String(cell ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const csvContent =
    '\uFEFF' + [headers.map(escapeCell).join(','), ...rows.map((r) => r.map(escapeCell).join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportWeddingReportPDF(params: {
  wedding: Wedding;
  guests: Guest[];
  expenses: Expense[];
}): void {
  const { wedding, guests, expenses } = params;
  const doc = new jsPDF();
  let y = 20;

  doc.setFontSize(18);
  doc.setTextColor(44, 58, 48);
  doc.text(`Casamento Pleno — ${wedding.brideName} & ${wedding.groomName}`, 14, y);
  y += 8;

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(
    `Data: ${wedding.weddingDate} às ${wedding.weddingTime}  |  Gerado em ${new Date().toLocaleDateString('pt-BR')}`,
    14,
    y
  );
  y += 12;

  const confirmedAdults = guests.filter((g) => g.status === 'confirmed').reduce((s, g) => s + g.adults, 0);
  const confirmedChildren = guests.filter((g) => g.status === 'confirmed').reduce((s, g) => s + g.children, 0);
  const totalBudget = wedding.budgetLimit || 0;
  const totalCommitted = expenses.reduce((s, e) => s + e.amount, 0);
  const totalPaid = expenses.reduce((s, e) => s + e.paidAmount, 0);

  doc.setFontSize(13);
  doc.setTextColor(28, 25, 23);
  doc.text('1. Resumo Executivo', 14, y);
  y += 7;
  doc.setFontSize(10);
  doc.text(`Convidados confirmados: ${confirmedAdults + confirmedChildren} (${confirmedAdults} adultos, ${confirmedChildren} crianças)`, 14, y);
  y += 6;
  doc.text(`Orçamento definido: ${formatBRL(totalBudget)}`, 14, y);
  y += 6;
  doc.text(`Total contratado: ${formatBRL(totalCommitted)}  |  Pago: ${formatBRL(totalPaid)}  |  A pagar: ${formatBRL(Math.max(0, totalCommitted - totalPaid))}`, 14, y);
  y += 12;

  doc.setFontSize(13);
  doc.text('2. Detalhamento Financeiro', 14, y);
  y += 7;
  doc.setFontSize(9);

  if (expenses.length === 0) {
    doc.text('Nenhuma despesa lançada até o momento.', 14, y);
    y += 8;
  } else {
    expenses.slice(0, 28).forEach((exp) => {
      if (y > 272) {
        doc.addPage();
        y = 20;
      }
      const line = `${exp.dueDate}  |  ${exp.category} — ${exp.title.slice(0, 32)}  |  Total: ${formatBRL(exp.amount)}  |  Pago: ${formatBRL(exp.paidAmount)}`;
      doc.text(line, 14, y);
      y += 6;
    });
  }

  y += 8;
  if (y > 250) {
    doc.addPage();
    y = 20;
  }
  doc.setFontSize(13);
  doc.text('3. Lista de Convidados', 14, y);
  y += 7;
  doc.setFontSize(9);

  if (guests.length === 0) {
    doc.text('Nenhum convidado cadastrado até o momento.', 14, y);
  } else {
    guests.slice(0, 45).forEach((g) => {
      if (y > 275) {
        doc.addPage();
        y = 20;
      }
      const statusLabel = g.status === 'confirmed' ? 'Confirmado' : g.status === 'declined' ? 'Recusado' : 'Pendente';
      doc.text(`${g.name} (${g.group}) — ${g.adults} ad. / ${g.children} cri. — ${statusLabel}`, 14, y);
      y += 6;
    });
  }

  doc.save(`relatorio-${wedding.slug || 'casamento-pleno'}.pdf`);
}

export function exportCalendarICS(params: {
  filename: string;
  events: { title: string; date: string; time?: string; description?: string; location?: string }[];
}): void {
  const formatIcsDate = (dateStr: string, timeStr = '10:00') => {
    const cleanDate = dateStr.replace(/-/g, '');
    const cleanTime = timeStr.replace(/:/g, '').padEnd(4, '0');
    return `${cleanDate}T${cleanTime}00`;
  };

  const escapeText = (txt: string) =>
    txt.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Casamento Pleno//Agenda Digital//PT',
    'CALSCALE:GREGORIAN',
  ];

  params.events.forEach((ev, idx) => {
    if (!ev.date || ev.date.length < 8) return;
    const dtStart = formatIcsDate(ev.date, ev.time || '10:00');
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:cp-${idx}-${Date.now()}@casamentopleno.app`);
    lines.push(`DTSTART:${dtStart}`);
    lines.push(`SUMMARY:${escapeText(ev.title)}`);
    if (ev.description) lines.push(`DESCRIPTION:${escapeText(ev.description)}`);
    if (ev.location) lines.push(`LOCATION:${escapeText(ev.location)}`);
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = params.filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function buildWeddingDayICS(wedding: Wedding, schedule: ScheduleItem[]) {
  const events =
    schedule.length > 0
      ? schedule.map((item) => ({
          title: `${wedding.brideName} & ${wedding.groomName}: ${item.title}`,
          date: wedding.weddingDate,
          time: item.time,
          description: item.description,
          location: item.location || wedding.venueName,
        }))
      : [
          {
            title: `Casamento de ${wedding.brideName} & ${wedding.groomName}`,
            date: wedding.weddingDate,
            time: wedding.weddingTime,
            description: wedding.welcomeMessage,
            location: `${wedding.venueName || ''} ${wedding.venueAddress || ''}`.trim(),
          },
        ];

  exportCalendarICS({
    filename: `casamento-${wedding.slug}.ics`,
    events,
  });
}

export async function hashPin(pin: string): Promise<string> {
  const enc = new TextEncoder().encode(`cp_vault_v1:${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function getGuestSiteUrl(slug: string): string {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}?convite=${encodeURIComponent(slug)}`;
}
