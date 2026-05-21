import crypto from "crypto";

export function getYooMoneyConfig() {
  const wallet = process.env.YOOMONEY_WALLET?.trim();
  const secret = process.env.YOOMONEY_SECRET?.trim();
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "")
    .trim()
    .replace(/\/$/, "");

  return { wallet, secret, siteUrl };
}

export function isYooMoneyConfigured() {
  const { wallet, secret } = getYooMoneyConfig();
  return Boolean(wallet && secret);
}

/** Проверка sha1_hash из HTTP-уведомления ЮMoney */
export function verifyYooMoneyNotification(params: {
  notification_type: string;
  operation_id: string;
  amount: string;
  currency: string;
  datetime: string;
  sender: string;
  codepro: string;
  label: string;
  sha1_hash: string;
}) {
  const { secret } = getYooMoneyConfig();
  if (!secret) return false;

  const base = [
    params.notification_type,
    params.operation_id,
    params.amount,
    params.currency,
    params.datetime,
    params.sender,
    params.codepro,
    secret,
    params.label,
  ].join("&");

  const hash = crypto.createHash("sha1").update(base).digest("hex");
  return hash === params.sha1_hash;
}

/** Ссылка на оплату через форму QuickPay */
export function buildYooMoneyPaymentUrl(amountRub: number, label: string) {
  const { wallet, siteUrl } = getYooMoneyConfig();
  if (!wallet) throw new Error("YOOMONEY_NOT_CONFIGURED");

  const url = new URL("https://yoomoney.ru/quickpay/confirm");
  url.searchParams.set("receiver", wallet);
  url.searchParams.set("quickpay-form", "shop");
  url.searchParams.set("targets", "Пополнение Rave Casino");
  url.searchParams.set("paymentType", "AC");
  url.searchParams.set("sum", amountRub.toFixed(2));
  url.searchParams.set("label", label);
  if (siteUrl) {
    url.searchParams.set("successURL", `${siteUrl}/?deposit=success`);
  }
  return url.toString();
}
