import crypto from 'crypto';
import dotenv from 'dotenv';
import express from 'express';
import http from 'http';
import net from 'net';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = 3000;
const PLAN_PRICE_BRL = 39.9;

function isPrivateOrBlockedHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (
    lower === 'localhost' ||
    lower === '127.0.0.1' ||
    lower === '::1' ||
    lower === '0.0.0.0' ||
    lower === '169.254.169.254' ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal')
  ) {
    return true;
  }
  if (net.isIP(lower)) {
    const parts = lower.split('.').map(Number);
    if (parts.length === 4) {
      if (parts[0] === 10) return true;
      if (parts[0] === 127) return true;
      if (parts[0] === 169 && parts[1] === 254) return true;
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
      if (parts[0] === 192 && parts[1] === 168) return true;
      if (parts[0] === 0) return true;
    }
    if (lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80')) {
      return true;
    }
  }
  return false;
}

function generatePixEmvPayload(pixKey: string, merchantName: string, amount: number, txid: string): string {
  const cleanName = merchantName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 25) || 'CASAMENTO PLENO';
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

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'casamento-pleno' });
  });

  // Mercado Pago integration readiness status (never exposes secret values)
  app.get('/api/payments/mercadopago/status', async (req, res) => {
    const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim() || '';
    const hasAccessToken = Boolean(accessToken);
    const hasPublicKey = Boolean(process.env.MERCADO_PAGO_PUBLIC_KEY?.trim());
    const hasWebhookSecret = Boolean(process.env.MERCADO_PAGO_WEBHOOK_SECRET?.trim());
    const environment = !hasAccessToken
      ? 'unconfigured'
      : accessToken.startsWith('TEST-')
      ? 'sandbox'
      : 'production';
    const appUrl = process.env.APP_URL || '';

    let liveCheck: { ok: boolean; accountName?: string; siteId?: string; error?: string } | undefined;
    if (req.query.verify === '1') {
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

    res.json({
      configured: hasAccessToken,
      hasPublicKey,
      hasWebhookSecret,
      environment,
      planPrice: PLAN_PRICE_BRL,
      currency: 'BRL',
      billingCycle: 'monthly',
      webhookEndpoint: appUrl ? `${appUrl.replace(/\/$/, '')}/api/payments/mercadopago/webhook` : '/api/payments/mercadopago/webhook',
      checkoutEndpoint: '/api/payments/mercadopago/create-subscription',
      liveCheck,
    });
  });

  // Create Mercado Pago Recurring Subscription (Card) or Pix Payment
  app.post('/api/payments/mercadopago/create-subscription', async (req, res) => {
    try {
      const { payerEmail, payerName, weddingId, paymentMethod } = req.body ?? {};

      if (typeof payerEmail !== 'string' || !payerEmail.includes('@') || payerEmail.length > 200) {
        res.status(400).json({ error: 'E-mail do pagador inválido.' });
        return;
      }
      if (paymentMethod !== 'pix' && paymentMethod !== 'card') {
        res.status(400).json({ error: 'Método de pagamento inválido. Use pix ou card.' });
        return;
      }

      const safeWeddingId = typeof weddingId === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(weddingId) ? weddingId : 'onboarding';
      const safeName = typeof payerName === 'string' ? payerName.slice(0, 100) : 'Assinante Casamento Pleno';
      const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim();
      const appUrl = (process.env.APP_URL || 'https://casamentopleno.app').replace(/\/$/, '');

      // Live Mercado Pago API integration when token is present in Secrets
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
              payer_email: payerEmail,
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
            res.status(502).json({
              error: 'Mercado Pago recusou a criação da assinatura. Verifique seu MERCADO_PAGO_ACCESS_TOKEN.',
              details: typeof mpData.message === 'string' ? mpData.message : 'Erro na API Mercado Pago',
            });
            return;
          }

          res.json({
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

        // Live Pix Payment via Mercado Pago v1/payments
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
            payer: {
              email: payerEmail,
              first_name: safeName.split(' ')[0] || 'Cliente',
            },
          }),
        });

        const mpPixData = (await mpPixResponse.json()) as Record<string, unknown>;
        if (!mpPixResponse.ok) {
          res.status(502).json({
            error: 'Mercado Pago recusou a cobrança Pix. Verifique seu MERCADO_PAGO_ACCESS_TOKEN.',
            details: typeof mpPixData.message === 'string' ? mpPixData.message : 'Erro na API Mercado Pago',
          });
          return;
        }

        const txData = (mpPixData.point_of_interaction as Record<string, unknown> | undefined)?.transaction_data as Record<string, unknown> | undefined;
        res.json({
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

      // Structured Sandbox / Pre-Configuration Mode (ready for instant activation once credentials are added)
      const referenceId = `MP_PRE_${Date.now().toString(36).toUpperCase()}`;
      const pixCopyPaste =
        paymentMethod === 'pix'
          ? generatePixEmvPayload('pagamentos@casamentopleno.com.br', 'CASAMENTO PLENO', PLAN_PRICE_BRL, referenceId)
          : undefined;

      res.json({
        mode: 'ready_to_configure',
        provider: 'mercadopago',
        paymentMethod,
        referenceId,
        pixCopyPaste,
        amount: PLAN_PRICE_BRL,
        status: 'sandbox_approved',
        message:
          'Estrutura Mercado Pago pronta. Adicione MERCADO_PAGO_ACCESS_TOKEN nos Secrets do projeto para ativar cobranças reais.',
      });
    } catch (error) {
      console.error('Mercado Pago route error:', error);
      res.status(500).json({ error: 'Erro interno ao preparar assinatura no Mercado Pago.' });
    }
  });

  // Mercado Pago Webhook Receiver (verifies HMAC signature when MERCADO_PAGO_WEBHOOK_SECRET is configured)
  app.post('/api/payments/mercadopago/webhook', (req, res) => {
    const webhookSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET?.trim();
    if (webhookSecret) {
      const signatureHeader = String(req.headers['x-signature'] || '');
      const requestId = String(req.headers['x-request-id'] || '');
      const dataId = String(req.query['data.id'] || req.body?.data?.id || '');
      const parts = Object.fromEntries(
        signatureHeader
          .split(',')
          .map((item) => item.trim().split('='))
          .filter((pair) => pair.length === 2)
      );
      const ts = parts.ts || '';
      const v1 = parts.v1 || '';
      const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
      const expected = crypto.createHmac('sha256', webhookSecret).update(manifest).digest('hex');

      const v1Buf = Buffer.from(v1);
      const expectedBuf = Buffer.from(expected);
      if (!v1 || v1Buf.length !== expectedBuf.length || !crypto.timingSafeEqual(v1Buf, expectedBuf)) {
        res.status(401).json({ error: 'Assinatura de webhook Mercado Pago inválida.' });
        return;
      }
    }

    const eventType = typeof req.body?.type === 'string' ? req.body.type : 'unknown';
    res.status(200).json({ received: true, type: eventType });
  });

  // Outgoing Configurable Webhook Tester (with strict SSRF protection)
  app.post('/api/webhooks/dispatch', async (req, res) => {
    try {
      const { webhookUrl, event, payload } = req.body ?? {};
      if (typeof webhookUrl !== 'string' || webhookUrl.length > 500) {
        res.status(400).json({ error: 'URL de webhook inválida.' });
        return;
      }

      let parsed: URL;
      try {
        parsed = new URL(webhookUrl);
      } catch {
        res.status(400).json({ error: 'Formato de URL inválido.' });
        return;
      }

      if (parsed.protocol !== 'https:') {
        res.status(400).json({ error: 'Por segurança, apenas URLs HTTPS são permitidas para webhooks.' });
        return;
      }
      if (isPrivateOrBlockedHost(parsed.hostname)) {
        res.status(403).json({ error: 'Destino de webhook bloqueado pela política de segurança.' });
        return;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch(parsed.toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'CasamentoPleno-Webhook/1.0',
          },
          body: JSON.stringify({
            event: typeof event === 'string' ? event.slice(0, 80) : 'wedding.test',
            sentAt: new Date().toISOString(),
            data: payload && typeof payload === 'object' ? payload : {},
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        res.json({ delivered: response.ok, statusCode: response.status });
      } catch {
        clearTimeout(timeout);
        res.status(502).json({ delivered: false, error: 'Não foi possível alcançar o endpoint HTTPS informado.' });
      }
    } catch {
      res.status(500).json({ error: 'Erro ao testar webhook.' });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      appType: 'spa',
    });

    // Serve a WebSocket-free @vite/client module so CSS injection (updateStyle)
    // and HMR context calls work cleanly without triggering failing WebSocket connections.
    app.get('/@vite/client', (_req, res) => {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.send(`
const sheetsMap = new Map();

export function updateStyle(id, content) {
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.setAttribute('data-vite-dev-id', id);
    style.textContent = content;
    document.head.appendChild(style);
    sheetsMap.set(id, style);
  } else {
    style.textContent = content;
  }
}

export function removeStyle(id) {
  const style = sheetsMap.get(id);
  if (style) {
    document.head.removeChild(style);
    sheetsMap.delete(id);
  }
}

export function createHotContext() {
  const noop = () => {};
  return {
    data: {},
    accept: noop,
    acceptExports: noop,
    dispose: noop,
    prune: noop,
    decline: noop,
    invalidate: noop,
    on: noop,
    off: noop,
    send: noop,
  };
}

export function injectQuery(url, queryToInject) {
  if (!url || !queryToInject) return url;
  return url.includes('?') ? url + '&' + queryToInject : url + '?' + queryToInject;
}

export class ErrorOverlay extends HTMLElement {}
`);
    });

    app.use(vite.middlewares);
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Casamento Pleno server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
