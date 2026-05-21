import crypto from "crypto";

/** Убирает кавычки, BOM и \\r из значений .env (частая ошибка на VPS). */
export function cleanEnv(value?: string) {
  if (!value) return "";
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/\r$/g, "")
    .replace(/^['"]|['"]$/g, "");
}

/** Строка для HMAC-SHA256 (параметр sign). */
export function buildYooMoneySignString(
  allParams: Record<string, string>,
  excludeKeys: string[] = [],
) {
  const skip = new Set(["sign", ...excludeKeys]);
  return Object.entries(allParams)
    .filter(([key]) => !skip.has(key))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join("&");
}

export function computeYooMoneySign(
  allParams: Record<string, string>,
  secret: string,
  excludeKeys: string[] = [],
) {
  return crypto
    .createHmac("sha256", secret)
    .update(buildYooMoneySignString(allParams, excludeKeys))
    .digest("hex");
}

export function getYooMoneyConfig() {
  const wallet = cleanEnv(process.env.YOOMONEY_WALLET);
  const secret = cleanEnv(process.env.YOOMONEY_SECRET);
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "")
    .trim()
    .replace(/\/$/, "");

  return { wallet, secret, siteUrl };
}

export function isYooMoneyConfigured() {
  const { wallet, secret } = getYooMoneyConfig();
  return Boolean(wallet && secret);
}

function timingSafeEqualHex(a: string, b: string) {
  const aa = a.toLowerCase();
  const bb = b.toLowerCase();
  if (aa.length !== bb.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(aa, "utf8"), Buffer.from(bb, "utf8"));
  } catch {
    return false;
  }
}

/** HMAC-SHA256 подпись (параметр sign, актуально с 2026). */
export function verifyYooMoneySign(
  allParams: Record<string, string>,
  excludeKeys: string[] = [],
) {
  const { secret } = getYooMoneyConfig();
  const sign = allParams.sign?.trim();
  if (!secret || !sign) return false;

  const expected = computeYooMoneySign(allParams, secret, excludeKeys);
  return timingSafeEqualHex(expected, sign);
}

/** Проверка sign: все поля, без bill_id/operation_label, только sha1-набор. */
export function verifyYooMoneySignFlexible(allParams: Record<string, string>) {
  if (verifyYooMoneySign(allParams)) return "all";
  if (verifyYooMoneySign(allParams, ["bill_id", "operation_label"])) {
    return "no-bill";
  }
  const minimal: Record<string, string> = {
    notification_type: allParams.notification_type ?? "",
    operation_id: allParams.operation_id ?? "",
    amount: allParams.amount ?? "",
    currency: allParams.currency ?? "",
    datetime: allParams.datetime ?? "",
    sender: allParams.sender ?? "",
    codepro: allParams.codepro ?? "false",
    label: allParams.label ?? "",
    sign: allParams.sign ?? "",
  };
  if (allParams.withdraw_amount) minimal.withdraw_amount = allParams.withdraw_amount;
  if (allParams.unaccepted) minimal.unaccepted = allParams.unaccepted;
  if (allParams.sha1_hash) minimal.sha1_hash = allParams.sha1_hash;
  if (allParams.test_notification) minimal.test_notification = allParams.test_notification;
  if (verifyYooMoneySign(minimal)) return "minimal";
  return null;
}

/** SHA-1 hash (sha1_hash, устарел с 18.05.2026). */
export function verifyYooMoneySha1(params: {
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
  if (!secret || !params.sha1_hash?.trim()) return false;

  const base = [
    params.notification_type,
    params.operation_id,
    params.amount,
    params.currency,
    params.datetime,
    params.sender,
    params.codepro || "false",
    secret,
    params.label,
  ].join("&");

  const hash = crypto.createHash("sha1").update(base).digest("hex");
  return timingSafeEqualHex(hash, params.sha1_hash);
}

function sha1ParamsFromRecord(allParams: Record<string, string>) {
  return {
    notification_type: allParams.notification_type ?? "",
    operation_id: allParams.operation_id ?? "",
    amount: allParams.amount ?? "",
    currency: allParams.currency ?? "",
    datetime: allParams.datetime ?? "",
    sender: allParams.sender ?? "",
    codepro: allParams.codepro ?? "false",
    label: allParams.label ?? "",
    sha1_hash: allParams.sha1_hash ?? "",
  };
}

/** Проверка HTTP-уведомления: sign, при неудаче — sha1_hash (если пришёл). */
export function verifyYooMoneyNotification(allParams: Record<string, string>) {
  const sha1Params = sha1ParamsFromRecord(allParams);

  if (allParams.sign?.trim()) {
    if (verifyYooMoneySignFlexible(allParams)) return true;
    if (sha1Params.sha1_hash.trim() && verifyYooMoneySha1(sha1Params)) {
      return true;
    }
    return false;
  }

  return verifyYooMoneySha1(sha1Params);
}

export function describeYooMoneyVerification(allParams: Record<string, string>) {
  const { secret } = getYooMoneyConfig();
  const hasSign = Boolean(allParams.sign?.trim());
  const hasSha1 = Boolean(allParams.sha1_hash?.trim());
  const signMode = hasSign ? verifyYooMoneySignFlexible(allParams) : null;
  const signOk = Boolean(signMode);
  const sha1Ok = hasSha1 ? verifyYooMoneySha1(sha1ParamsFromRecord(allParams)) : false;
  const received = allParams.sign?.trim() ?? "";
  const expected = secret && hasSign ? computeYooMoneySign(allParams, secret) : "";
  return {
    hasSign,
    hasSha1,
    signOk,
    sha1Ok,
    signMode,
    secretLen: secret?.length ?? 0,
    signPreview: received
      ? `${expected.slice(0, 8)}… vs ${received.slice(0, 8)}…`
      : "",
  };
}

/** Парсинг тела POST application/x-www-form-urlencoded. */
export function parseYooMoneyFormBody(rawBody: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of new URLSearchParams(rawBody)) {
    out[key] = value;
  }
  return out;
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
