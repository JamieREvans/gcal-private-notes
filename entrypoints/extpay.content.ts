import { defineContentScript } from 'wxt/utils/define-content-script';

// ExtensionPay's success page posts a message that this relays to the
// background, so Pro unlocks the moment payment completes.
export default defineContentScript({
  matches: ['https://extensionpay.com/*'],
  runAt: 'document_start',
  async main() {
    await import('extpay');
  },
});
