import type { IncomingMessage, ServerResponse } from 'http';

const PLAN_PRICE_BRL = 39.9;

interface VercelRequest extends IncomingMessage {
  query?: Record<string, string | string[]>;
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Método não permitido.' });
    return;
  }

  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim() || '';
  const hasAccessToken = Boolean(accessToken);
  const hasPublicKey = Boolean(process.env.MERCADO_PAGO_PUBLIC_KEY?.trim());
  const hasWebhookSecret = Boolean(process.env.MERCADO_PAGO_WEBHOOK_SECRET?.trim());
  const environment = !hasAccessToken
    ? 'unconfigured'
    : accessToken.startsWith('TEST-')
    ? 'sandbox'
    : 'production';

  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const inferredOrigin = host ? `${proto}://${host}` : '';
  const appUrl = (process.env.APP_URL || inferredOrigin || '').replace(/\/$/, '');

  const urlObj = new URL(req.url || '/', 'http://localhost');
  const shouldVerify = urlObj.searchParams.get('verify') === '1' || req.query?.verify === '1';

  let liveCheck: { ok: boolean; accountName?: string; siteId?: string; error?: string } | undefined;
  if (shouldVerify) {
    if (!hasAccessToken) {
      liveCheck = {
        ok: false,
        error: 'Variável MERCADO_PAGO_ACCESS_TOKEN ainda não configurada no servidor.',
      };
    } else {
      try {
        const mpRes = await fetch('https://api.mercadopago.com/users/me', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (mpRes.ok) {
          const data = (await mpRes.json()) as Record<string, unknown>;
          liveCheck = {
            ok: true,
            accountName: String(data.nickname || data.first_name || 'Conta Mercado Pago'),
            siteId: String(data.site_id || 'MLB'),
          };
        } else {
          liveCheck = {
            ok: false,
            error: `Mercado Pago retornou status ${mpRes.status}. Verifique se o Access Token está válido.`,
          };
        }
      } catch {
        liveCheck = {
          ok: false,
          error: 'Falha ao conectar na API do Mercado Pago.',
        };
      }
    }
  }

  sendJson(res, 200, {
    configured: hasAccessToken,
    hasPublicKey,
    hasWebhookSecret,
    environment,
    planPrice: PLAN_PRICE_BRL,
    currency: 'BRL',
    billingCycle: 'monthly',
    webhookEndpoint: appUrl
      ? `${appUrl}/api/payments/mercadopago/webhook`
      : '/api/payments/mercadopago/webhook',
    checkoutEndpoint: '/api/payments/mercadopago/create-subscription',
    liveCheck,
  });
}
