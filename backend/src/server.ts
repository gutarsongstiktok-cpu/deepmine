import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Prisma, PrismaClient } from '@prisma/client';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { TonPaymentAdapter, SteamTradeAdapter } from './adapters';

const prisma = new PrismaClient();
const app = Fastify({ logger: true });
const ton = new TonPaymentAdapter();
const steam = new SteamTradeAdapter();
const demoMode = process.env.DEMO_MODE !== 'false';

async function main() {
await app.register(cors, { origin: true });

function verifyTelegramInitData(initData: string, botToken: string): Record<string, string> | null {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');
  const dataCheckString = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = createHmac('sha256', secret).update(dataCheckString).digest('hex');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(hash, 'hex');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const authDate = Number(params.get('auth_date') || 0);
  if (!authDate || Math.abs(Date.now() / 1000 - authDate) > 86400) return null;
  return Object.fromEntries(params.entries());
}

async function getUser(request: any) {
  const initData = String(request.headers['x-telegram-init-data'] || '');
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (token && initData) {
    const verified = verifyTelegramInitData(initData, token);
    if (!verified) throw Object.assign(new Error('Invalid Telegram initData'), { statusCode: 401 });
    const rawUser = verified.user;
    if (!rawUser) throw Object.assign(new Error('Missing Telegram user'), { statusCode: 401 });
    const tg = JSON.parse(rawUser);
    return prisma.user.upsert({
      where: { telegramId: String(tg.id) },
      update: { username: tg.username || null, firstName: tg.first_name || null },
      create: { telegramId: String(tg.id), username: tg.username || null, firstName: tg.first_name || null }
    });
  }
  if (!demoMode) throw Object.assign(new Error('Telegram authentication is required'), { statusCode: 401 });
  // A single clearly marked local demo account; never use this fallback in production.
  return prisma.user.upsert({
    where: { telegramId: 'demo-user-1' },
    update: {},
    create: { telegramId: 'demo-user-1', username: 'demo_player', firstName: 'Demo', demoBalance: 1000 }
  });
}

app.addHook('preHandler', async (request, reply) => {
  if (request.url === '/health') return;
  try { (request as any).user = await getUser(request); }
  catch (e: any) { reply.code(e.statusCode || 401).send({ error: e.message || 'Unauthorized' }); }
});

app.get('/health', async () => ({ ok: true, service: 'cs2-upgrader-api', demoMode }));
app.get('/api/v1/me', async (request) => {
  const user = (request as any).user;
  const [itemsCount, openingsCount, upgradesCount] = await Promise.all([
    prisma.skinInstance.count({ where: { ownerId: user.id, status: 'AVAILABLE' } }),
    prisma.caseOpening.count({ where: { userId: user.id } }),
    prisma.upgrade.count({ where: { userId: user.id } })
  ]);
  return { id: user.id, username: user.username, firstName: user.firstName, balance: user.demoBalance, demoMode, stats: { itemsCount, openingsCount, upgradesCount } };
});

app.get('/api/v1/cases', async () => prisma.case.findMany({ where: { enabled: true }, include: { items: { include: { catalog: true } } }, orderBy: { price: 'asc' } }));
app.get('/api/v1/catalog/skins', async () => prisma.skinCatalog.findMany({ orderBy: { referencePrice: 'asc' } }));
app.get('/api/v1/inventory', async (request) => {
  const user = (request as any).user;
  return prisma.skinInstance.findMany({ where: { ownerId: user.id, status: 'AVAILABLE' }, include: { catalog: true }, orderBy: { createdAt: 'desc' } });
});
app.get('/api/v1/history', async (request) => {
  const user = (request as any).user;
  const [openings, upgrades] = await Promise.all([
    prisma.caseOpening.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 50, include: { case: true } }),
    prisma.upgrade.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 50 })
  ]);
  return { openings, upgrades };
});

const openSchema = z.object({ idempotencyKey: z.string().min(8).max(100) });
app.post('/api/v1/cases/:id/open', async (request, reply) => {
  const user = (request as any).user;
  const { id } = request.params as { id: string };
  const parsed = openSchema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: 'A valid idempotencyKey is required' });
  const existing = await prisma.caseOpening.findUnique({ where: { idempotencyKey: parsed.data.idempotencyKey }, include: { case: true } });
  if (existing) return { operation: existing, replayed: true };
  const caseData = await prisma.case.findUnique({ where: { id }, include: { items: { include: { catalog: true } } } });
  if (!caseData?.enabled || !caseData.items.length) return reply.code(404).send({ error: 'Case unavailable' });
  const totalWeight = caseData.items.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0 || caseData.items.some(i => i.weight < 0)) return reply.code(500).send({ error: 'Invalid case configuration' });
  let roll = randomInt(totalWeight);
  let chosen = caseData.items[0];
  for (const item of caseData.items) { if (roll < item.weight) { chosen = item; break; } roll -= item.weight; }
  try {
    const result = await prisma.$transaction(async tx => {
      const freshUser = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
      if (Number(freshUser.demoBalance) < Number(caseData.price)) throw new Error('INSUFFICIENT_DEMO_BALANCE');
      await tx.user.update({ where: { id: user.id }, data: { demoBalance: { decrement: caseData.price } } });
      const instance = await tx.skinInstance.create({ data: { catalogId: chosen.catalogId, ownerId: user.id, status: 'AVAILABLE', source: 'DEMO' } });
      const opening = await tx.caseOpening.create({ data: { userId: user.id, caseId: id, resultInstanceId: instance.id, resultName: chosen.catalog.marketHashName, pricePaid: caseData.price, configVersion: caseData.configVersion, status: 'SUCCEEDED', idempotencyKey: parsed.data.idempotencyKey } });
      await tx.ledgerEntry.create({ data: { userId: user.id, operationId: opening.id, entryType: 'DEMO_CASE_OPEN', amount: caseData.price.negated(), currency: 'DEMO' } });
      return { operation: opening, item: { ...instance, catalog: chosen.catalog }, balance: Number(freshUser.demoBalance) - Number(caseData.price) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return result;
  } catch (e: any) {
    if (e.message === 'INSUFFICIENT_DEMO_BALANCE') return reply.code(400).send({ error: 'Insufficient demo balance' });
    if (e.code === 'P2002') {
      const replay = await prisma.caseOpening.findUnique({ where: { idempotencyKey: parsed.data.idempotencyKey } });
      if (replay) return { operation: replay, replayed: true };
    }
    request.log.error(e);
    return reply.code(500).send({ error: 'Case opening failed safely; check history before retrying' });
  }
});

const upgradeSchema = z.object({ inputInstanceId: z.string(), targetCatalogId: z.string(), idempotencyKey: z.string().min(8).max(100) });
app.post('/api/v1/upgrades', async (request, reply) => {
  const user = (request as any).user;
  const parsed = upgradeSchema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: 'Invalid upgrade request' });
  const existing = await prisma.upgrade.findUnique({ where: { idempotencyKey: parsed.data.idempotencyKey } });
  if (existing) return { operation: existing, replayed: true };
  try {
    const outcome = await prisma.$transaction(async tx => {
      const input = await tx.skinInstance.findFirst({ where: { id: parsed.data.inputInstanceId, ownerId: user.id, status: 'AVAILABLE' }, include: { catalog: true } });
      const target = await tx.skinCatalog.findUnique({ where: { id: parsed.data.targetCatalogId } });
      if (!input || !target) throw new Error('INVALID_ITEMS');
      const inputValue = Number(input.catalog.referencePrice);
      const targetValue = Number(target.referencePrice);
      if (targetValue <= inputValue) throw new Error('TARGET_MUST_BE_MORE_EXPENSIVE');
      // Demo rule: 75% multiplier; max chance 50%. Price values are illustrative catalog estimates.
      const chanceBps = Math.max(1, Math.min(5000, Math.floor((inputValue / targetValue) * 7500)));
      const rollBps = randomInt(10000);
      const won = rollBps < chanceBps;
      await tx.skinInstance.update({ where: { id: input.id }, data: { status: 'CONSUMED', ownerId: null } });
      let reward = null;
      if (won) reward = await tx.skinInstance.create({ data: { catalogId: target.id, ownerId: user.id, status: 'AVAILABLE', source: 'DEMO' } });
      const operation = await tx.upgrade.create({ data: { userId: user.id, inputInstanceId: input.id, targetCatalogId: target.id, inputValue, targetValue, chanceBps, rollBps, result: won ? 'SUCCESS' : 'FAILED', status: 'SUCCEEDED', idempotencyKey: parsed.data.idempotencyKey } });
      await tx.ledgerEntry.create({ data: { userId: user.id, operationId: operation.id, entryType: won ? 'DEMO_UPGRADE_SUCCESS' : 'DEMO_UPGRADE_FAILED', amount: 0, currency: 'DEMO' } });
      return { operation, reward, chancePercent: chanceBps / 100 };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return outcome;
  } catch (e: any) {
    if (e.message === 'INVALID_ITEMS') return reply.code(400).send({ error: 'Input item unavailable or target missing' });
    if (e.message === 'TARGET_MUST_BE_MORE_EXPENSIVE') return reply.code(400).send({ error: 'Target skin must be more expensive' });
    if (e.code === 'P2002') {
      const replay = await prisma.upgrade.findUnique({ where: { idempotencyKey: parsed.data.idempotencyKey } });
      if (replay) return { operation: replay, replayed: true };
    }
    request.log.error(e);
    return reply.code(500).send({ error: 'Upgrade failed safely; check history before retrying' });
  }
});

app.post('/api/v1/payments/intent', async () => ton.createPaymentIntent());
app.post('/api/v1/steam/trades', async () => steam.createTrade());

app.setErrorHandler((error, _request, reply) => {
  app.log.error(error);
  reply.code((error as any).statusCode || 500).send({ error: error.message || 'Internal server error' });
});

const port = Number(process.env.PORT || 10000);
try {
  await app.listen({ port, host: '0.0.0.0' });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
}
main().catch(err => { console.error(err); process.exit(1); });
