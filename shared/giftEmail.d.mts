export function escapeGiftHtml(value: unknown): string;
export function giftClaimUrl(appUrl: string | undefined, code: string, recipientEmail: string): string;
export function renderGiftEmail(options: { senderEmail: string; senderName?: string; recipientEmail: string; amountUsd: number; giftMessage?: string; claimUrl: string; preview?: boolean }): { subject: string; text: string; html: string };
