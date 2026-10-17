"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const skins = [
        { marketHashName: 'AK-47 | Neon Revolution', weapon: 'AK-47', exterior: 'Field-Tested', rarity: 'Classified', imageUrl: 'https://community.cloudflare.steamstatic.com/economy/image/placeholder', referencePrice: 96.42 },
        { marketHashName: 'M4A1-S | Player Two', weapon: 'M4A1-S', exterior: 'Minimal Wear', rarity: 'Classified', imageUrl: null, referencePrice: 82.17 },
        { marketHashName: 'AWP | Chromatic Aberration', weapon: 'AWP', exterior: 'Field-Tested', rarity: 'Classified', imageUrl: null, referencePrice: 64.23 },
        { marketHashName: 'Desert Eagle | Printstream', weapon: 'Desert Eagle', exterior: 'Field-Tested', rarity: 'Covert', imageUrl: null, referencePrice: 58.90 },
        { marketHashName: 'USP-S | The Traitor', weapon: 'USP-S', exterior: 'Field-Tested', rarity: 'Classified', imageUrl: null, referencePrice: 45.12 },
        { marketHashName: 'P90 | Asiimov', weapon: 'P90', exterior: 'Minimal Wear', rarity: 'Classified', imageUrl: null, referencePrice: 32.76 },
        { marketHashName: '★ Butterfly Knife | Doppler', weapon: 'Butterfly Knife', exterior: 'Factory New', rarity: 'Extraordinary', imageUrl: null, referencePrice: 300.00 },
        { marketHashName: '★ Karambit | Fade', weapon: 'Karambit', exterior: 'Factory New', rarity: 'Extraordinary', imageUrl: null, referencePrice: 450.00 }
    ];
    for (const skin of skins)
        await prisma.skinCatalog.upsert({ where: { marketHashName: skin.marketHashName }, update: skin, create: skin });
    const all = await prisma.skinCatalog.findMany();
    const caseDefs = [
        { name: 'Starter Case', description: 'Набор для старта', price: 10, weights: [30, 25, 20, 15, 8, 2] },
        { name: 'Neon Case', description: 'Яркие скины и редкие предметы', price: 35, weights: [10, 15, 20, 20, 20, 10, 5] },
        { name: 'Knife Case', description: 'Демо-кейс с шансом на нож', price: 100, weights: [15, 15, 15, 15, 15, 15, 8, 2] }
    ];
    for (const def of caseDefs) {
        const c = await prisma.case.upsert({ where: { id: def.name.toLowerCase().replaceAll(' ', '-') }, update: {}, create: { id: def.name.toLowerCase().replaceAll(' ', '-'), name: def.name, description: def.description, price: def.price, imageUrl: null, enabled: true, configVersion: 1 } });
        const catalogIds = all.slice(0, def.weights.length).map(s => s.id);
        for (let i = 0; i < catalogIds.length; i++)
            await prisma.caseItem.upsert({ where: { caseId_catalogId: { caseId: c.id, catalogId: catalogIds[i] } }, update: { weight: def.weights[i] }, create: { caseId: c.id, catalogId: catalogIds[i], weight: def.weights[i] } });
    }
    const user = await prisma.user.upsert({ where: { telegramId: 'demo-user-1' }, update: {}, create: { telegramId: 'demo-user-1', username: 'demo_player', firstName: 'Demo', demoBalance: 1000 } });
    for (const skin of all.slice(0, 3)) {
        const exists = await prisma.skinInstance.findFirst({ where: { ownerId: user.id, catalogId: skin.id, source: 'DEMO' } });
        if (!exists)
            await prisma.skinInstance.create({ data: { ownerId: user.id, catalogId: skin.id, source: 'DEMO', status: 'AVAILABLE' } });
    }
    console.log('Seed complete');
}
main().finally(() => prisma.$disconnect());
