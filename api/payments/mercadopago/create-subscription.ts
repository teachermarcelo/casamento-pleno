import crypto from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';

const PLAN_PRICE_BRL = 39.9;

interface VercelRequest extends IncomingMessage {
  body?: unknown;
}

interface VercelResponse extends ServerResponse {
  status?: (code: number) => VercelResponse;
  json?: (body: unknown) => void;
}

function sendJson(res: VercelResponse, statusCode: number, payload: Record<string, unknown>) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req: VercelRequest): Promise<Record<string, unknown>> {
  if (req.body && typeof req.body === 'object') {
    return req.body as Record<string, unknown>;
  }
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function generatePixEmvPayload(pixKey: string, merchantName: string, amount: number, txid: string): string {
  const cleanName =
    merchantName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9 ]/g, '')
      .slice(0, 25) || 'CASAMENTO PLENO';
  const cleanCity = 'SAO PAULO';
  const amtStr = amount.toFixed(2);
  const f = (id: string, val: string) => `${id}${String(val.length).padStart(2, '0')}${val}`;
  const gui = f('00', 'br.gov.bcb.pix');
  const keyField = f('01', pixKey.slice(0, 77));
  const merchantAccount = f('26', `${gui}${keyField}`);
  const additional = f('62', f('05', txid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 25) || 'CP3990'));
  const body =
    f('00', '01') +
    merchantAccount +
    f('52', '0000') +
    f('53', '986') +
    f('54', amtStr) +
    f('58', 'BR') +
    f('59', cleanName.toUpperCase()) +
    f('60', cleanCity) +
    additional +
    '6304';

  let crc = 0xffff;
  for (let i = 0; i < body.length; i++) {
    crc ^= body.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return `${body}${crc.toString(16).toUpperCase().padStart(4, '0')}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Método não permitido.' });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const { payerEmail, payerName, payerPhone, weddingId, paymentMethod } = body;

    const normalizedEmail = typeof payerEmail === 'string' ? payerEmail.trim().toLowerCase() : '';
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailPattern.test(normalizedEmail) || normalizedEmail.length > 200) {
      sendJson(res, 400, { error: 'Informe um e-mail válido para continuar com o pagamento.' });
      return;
    }
    if (paymentMethod !== 'pix' && paymentMethod !== 'card') {
      sendJson(res, 400, { error: 'Método de pagamento inválido. Use pix ou card.' });
      return;
    }

    const safeWeddingId =
      typeof weddingId === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(weddingId)
        ? weddingId
        : 'onboarding';
    const rawName = typeof payerName === 'string' ? payerName.trim() : '';
    const safeName = rawName.length >= 2 ? rawName.slice(0, 100) : 'Assinante Casamento Pleno';
    const nameParts = safeName.split(/\s+/);
    const firstName = nameParts[0] || 'Cliente';
    const lastName = nameParts.slice(1).join(' ') || 'Casamento Pleno';
    const safePhone =
      typeof payerPhone === 'string' ? payerPhone.replace(/[^\d+()\s-]/g, '').slice(0, 24) : '';
    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim();

    const host = req.headers['x-forwarded-host'] || req.headers.host || '';
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const inferredOrigin = host ? `${proto}://${host}` : 'https://casamento-pleno.vercel.app';
    const appUrl = (process.env.APP_URL || inferredOrigin).replace(/\/$/, '');

    if (accessToken) {
      if (paymentMethod === 'card') {
        const mpResponse = await fetch('https://api.mercadopago.com/preapproval', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            reason: 'Assinatura Mensal Casamento Pleno',
            external_reference: safeWeddingId,
            payer_email: normalizedEmail,
            auto_recurring: {
              frequency: 1,
              frequency_type: 'months',
              transaction_amount: PLAN_PRICE_BRL,
              currency_id: 'BRL',
            },
            back_url: `${appUrl}/?pagamento=sucesso`,
            status: 'pending',
          }),
        });

        const mpData = (await mpResponse.json()) as Record<string, unknown>;
        if (!mpResponse.ok) {
          sendJson(res, 502, {
            error: 'Mercado Pago recusou a criação da assinatura. Verifique seu MERCADO_PAGO_ACCESS_TOKEN.',
            details: typeof mpData.message === 'string' ? mpData.message : 'Erro na API Mercado Pago',
          });
          return;
        }

        sendJson(res, 200, {
          mode: 'live',
          provider: 'mercadopago',
          paymentMethod: 'card',
          referenceId: String(mpData.id || ''),
          initPoint: String(mpData.init_point || ''),
          amount: PLAN_PRICE_BRL,
          status: 'pending',
        });
        return;
      }

      const idempotencyKey = crypto.randomUUID();
      const mpPixResponse = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'X-Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          transaction_amount: PLAN_PRICE_BRL,
          description: 'Assinatura Mensal Casamento Pleno (Pix)',
          payment_method_id: 'pix',
          external_reference: safeWeddingId,
          notification_url: `${appUrl}/api/payments/mercadopago/webhook`,
          metadata: safePhone ? { payer_phone: safePhone } : undefined,
          payer: {
            email: normalizedEmail,
            first_name: firstName,
            last_name: lastName,
          },
        }),
      });

      const mpPixData = (await mpPixResponse.json()) as Record<string, unknown>;
      if (!mpPixResponse.ok) {
        sendJson(res, 502, {
          error: 'Mercado Pago recusou a cobrança Pix. Verifique seu MERCADO_PAGO_ACCESS_TOKEN.',
          details: typeof mpPixData.message === 'string' ? mpPixData.message : 'Erro na API Mercado Pago',
        });
        return;
      }

      const txData = (mpPixData.point_of_interaction as Record<string, unknown> | undefined)
        ?.transaction_data as Record<string, unknown> | undefined;

      sendJson(res, 200, {
        mode: 'live',
        provider: 'mercadopago',
        paymentMethod: 'pix',
        referenceId: String(mpPixData.id || ''),
        pixCopyPaste: String(txData?.qr_code || ''),
        pixQrBase64: String(txData?.qr_code_base64 || ''),
        amount: PLAN_PRICE_BRL,
        status: 'pending',
      });
      return;
    }

    const referenceId = `MP_PRE_${Date.now().toString(36).toUpperCase()}`;
    const pixCopyPaste =
      paymentMethod === 'pix'
        ? generatePixEmvPayload('pagamentos@casamentopleno.com.br', 'CASAMENTO PLENO', PLAN_PRICE_BRL, referenceId)
        : undefined;

    sendJson(res, 200, {
      mode: 'ready_to_configure',
      provider: 'mercadopago',
      paymentMethod,
      referenceId,
      pixCopyPaste,
      amount: PLAN_PRICE_BRL,
      status: 'sandbox_approved',
      message:
        'Estrutura Mercado Pago pronta. Adicione MERCADO_PAGO_ACCESS_TOKEN nas Environment Variables da Vercel (ou Secrets) para gerar Pix e assinaturas reais.',
    });
  } catch (error) {
    console.error('Mercado Pago serverless error:', error);
    sendJson(res, 500, { error: 'Erro interno ao preparar assinatura no Mercado Pago.' });
  }
}
