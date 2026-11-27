import crypto from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';

interface VercelRequest extends IncomingMessage {
  body?: unknown;
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    sendJson(res, 200, { ok: true, webhook: 'mercadopago-ready' });
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Método não permitido.' });
    return;
  }

  const body = await readJsonBody(req);
  const webhookSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET?.trim();
  const urlObj = new URL(req.url || '/', 'http://localhost');
  const queryDataId =
    urlObj.searchParams.get('data.id') ||
    (typeof req.query?.['data.id'] === 'string' ? req.query['data.id'] : '');
  const bodyData = (body.data as Record<string, unknown> | undefined) || {};
  const dataId = String(queryDataId || bodyData.id || '');

  if (webhookSecret) {
    const signatureHeader = String(req.headers['x-signature'] || '');
    const requestId = String(req.headers['x-request-id'] || '');
    const parts = Object.fromEntries(
      signatureHeader
        .split(',')
        .map((item) => item.trim().split('='))
        .filter((pair) => pair.length === 2)
    );

    const ts = parts.ts || '';
    const v1 = parts.v1 || '';
    if (!ts || !v1) {
      sendJson(res, 401, { error: 'Assinatura Mercado Pago ausente.' });
      return;
    }

    const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
    const computed = crypto.createHmac('sha256', webhookSecret).update(manifest).digest('hex');

    const expectedBuf = Buffer.from(computed, 'utf8');
    const actualBuf = Buffer.from(v1, 'utf8');
    if (expectedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(expectedBuf, actualBuf)) {
      sendJson(res, 401, { error: 'Assinatura Mercado Pago inválida.' });
      return;
    }
  }

  sendJson(res, 200, {
    received: true,
    topic: String(body.type || body.topic || 'payment'),
    dataId,
  });
}
