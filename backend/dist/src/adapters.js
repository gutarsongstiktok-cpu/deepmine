"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SteamTradeAdapter = exports.TonPaymentAdapter = void 0;
/** External integrations are intentionally disabled until their compliance and operational design is approved. */
class TonPaymentAdapter {
    async createPaymentIntent() {
        return { enabled: false, code: 'NOT_ENABLED', message: 'Real TON payments are disabled in this MVP.' };
    }
}
exports.TonPaymentAdapter = TonPaymentAdapter;
class SteamTradeAdapter {
    async createTrade() {
        return { enabled: false, code: 'NOT_ENABLED', message: 'Real Steam trades are disabled in this MVP.' };
    }
}
exports.SteamTradeAdapter = SteamTradeAdapter;
