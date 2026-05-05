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

export function buildVerifierMessage(chatId: string, onboardUrl: string): string {
  const safeChatId = escapeHtml(chatId);
  const safeUrl = escapeHtml(onboardUrl);
  return [
    '👋 Välkommen till KAMMAREN Watcher!',
    '',
    'Ditt Telegram-ID är:',
    `<code>${safeChatId}</code>`,
    '',
    '📋 Kopiera siffran och gå tillbaka till',
    `<a href="${safeUrl}">kammaren.nu/watcher/start</a>`,
    'för att slutföra registreringen.',
  ].join('\n');
}
