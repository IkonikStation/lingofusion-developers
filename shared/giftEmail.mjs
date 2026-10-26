export function escapeGiftHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
}

export function giftClaimUrl(appUrl, code, recipientEmail) {
  const url = new URL(String(appUrl || "https://ikonikstation.github.io/lingofusion-developers/playground"));
  if (!url.pathname.replace(/\/$/, "").endsWith("/playground")) url.pathname = `${url.pathname.replace(/\/$/, "")}/playground/`;
  url.search = new URLSearchParams({ claim_gift: code, gift_email: recipientEmail }).toString();
  url.hash = "";
  return url.toString();
}

export function renderGiftEmail({ senderEmail, senderName, recipientEmail, amountUsd, giftMessage, claimUrl, preview = false }) {
  const amount = Number(amountUsd).toFixed(2);
  const sender = senderName || senderEmail;
  const escape = escapeGiftHtml;
  const subject = `${senderEmail} sent you $${amount} in LingoFusion credits`;
  const text = `${sender} (${senderEmail}) sent you $${amount} USD in LingoFusion credits.\nTo: ${recipientEmail}\n${giftMessage ? `\n${giftMessage}\n` : ""}\nClaim your gift: ${claimUrl}\nSign in with ${recipientEmail} to claim it. Your gift does not expire.\nSent from ${senderEmail} using LingoFusion.`;
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><meta charset="utf-8"></head><body style="margin:0;background:#f5f3f8;color:#241a3d;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif"><div style="max-width:560px;margin:0 auto;padding:32px 20px">${preview ? '<p style="margin:0 0 20px;text-align:center;font-size:11px;color:#7c3aed">PREVIEW · No email sent · No purchase required</p>' : ""}<p style="font-size:14px;font-weight:700;margin:0 0 28px">LingoFusion <span style="font-weight:400;color:#91879c">/ Gifts</span></p><div style="padding:28px;background:#fff;border:1px solid #e9e4ef;border-radius:20px"><p style="font-size:12px;color:#87788f;margin:0 0 12px">A GIFT FOR YOU</p><h1 style="font-size:26px;line-height:1.25;margin:0 0 14px;letter-spacing:-.7px">Your next idea has a head start.</h1><p style="font-size:14px;line-height:1.7;color:#73677d;margin:0 0 24px"><strong>${escape(sender)}</strong> sent you LingoFusion credits.</p><div style="border-radius:16px;padding:24px;background:#35204f;color:white"><p style="font-size:12px;margin:0 0 20px;color:#d7c3ee">LingoFusion gift credits</p><p style="font-size:40px;font-weight:600;margin:0 0 20px;letter-spacing:-1px">$${amount} <span style="font-size:13px;font-weight:400;color:#c9b2e1">USD</span></p><p style="font-size:12px;line-height:1.7;margin:0;overflow-wrap:anywhere;color:#d7c3ee">From ${escape(senderEmail)}<br>To ${escape(recipientEmail)}</p>${giftMessage ? `<div style="margin-top:20px;padding-top:18px;border-top:1px solid #ffffff30;font-size:14px;line-height:1.7;white-space:pre-wrap;overflow-wrap:anywhere">${escape(giftMessage)}</div>` : ""}</div><p style="text-align:center;margin:28px 0 14px"><a href="${preview ? "#preview" : escape(claimUrl)}" style="display:inline-block;padding:15px 32px;border-radius:12px;background:#7c3aed;color:white;text-decoration:none;font-size:14px;font-weight:600">Claim your gift</a></p><p style="text-align:center;font-size:12px;line-height:1.7;color:#87788f;margin:0">Sign in with <strong>${escape(recipientEmail)}</strong>.<br>No rush—your gift does not expire.</p></div><p style="font-size:11px;line-height:1.7;color:#91879c;text-align:center;margin:22px 0 0">Sent from ${escape(senderEmail)} using LingoFusion.<br>Replies go to the sender.</p></div></body></html>`;
  return { subject, text, html };
}
