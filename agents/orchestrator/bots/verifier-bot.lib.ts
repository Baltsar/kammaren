/**
 * Verifier-bot message-byggare. Ren funktion, separat fil för att kunna
 * testa utan grammy-dependency. HTML parse mode (enklare escaping än MD2).
 */

const HTML_ESCAPE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
};

export function escapeHtml(input: string): string {
  return input.replace(/[&<>]/g, (ch) => HTML_ESCAPE[ch] ?? ch);
}

// onboardUrl-parametern bevaras för bakåtkomp men används inte i meddelandet
// längre. Användaren kommer hit via deep-link från onboarding-sidan och har
// fliken öppen — vi behöver inte (och vill inte) skicka tillbaka en URL.
export function buildVerifierMessage(chatId: string, _onboardUrl?: string): string {
  const safeChatId = escapeHtml(chatId);
  return [
    '👋 Välkommen till KAMMAREN Watcher!',
    '',
    'Ditt Telegram-ID:',
    `<code>${safeChatId}</code>`,
    '',
    '📋 Tryck på siffran för att kopiera den, gå sedan tillbaka till webbläsarfliken där du startade onboardingen och klistra in den.',
  ].join('\n');
}
