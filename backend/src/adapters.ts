/** External integrations are intentionally disabled until their compliance and operational design is approved. */
export class TonPaymentAdapter {
  async createPaymentIntent() {
    return { enabled: false, code: 'NOT_ENABLED', message: 'Real TON payments are disabled in this MVP.' };
  }
}

export class SteamTradeAdapter {
  async createTrade() {
    return { enabled: false, code: 'NOT_ENABLED', message: 'Real Steam trades are disabled in this MVP.' };
  }
}
