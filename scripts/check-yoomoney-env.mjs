#!/usr/bin/env node
/**
 * Проверка секрета ЮMoney на VPS (без вывода самого секрета).
 * node scripts/check-yoomoney-env.mjs
 */
import crypto from "crypto";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function cleanEnv(value) {
  if (!value) return "";
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/\r$/g, "")
    .replace(/^['"]|['"]$/g, "");
}

function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1);
  }
  return out;
}

const envPath = resolve(process.cwd(), ".env");
const file = loadEnvFile(envPath);
const secret = cleanEnv(file.YOOMONEY_SECRET || process.env.YOOMONEY_SECRET);
const wallet = cleanEnv(file.YOOMONEY_WALLET || process.env.YOOMONEY_WALLET);

if (!secret) {
  console.error("YOOMONEY_SECRET не задан в .env");
  process.exit(1);
}

const params = {
  notification_type: "p2p-incoming",
  operation_id: "441361714955017004",
  amount: "98.00",
  withdraw_amount: "100.00",
  currency: "643",
  datetime: "2013-12-26T08:28:34Z",
  sender: "41000000000",
  codepro: "false",
  label: "ML23045",
  unaccepted: "false",
  sha1_hash: "ac13833bd6ba9eff1fa9e4bed76f3d6ebb57f6c0",
  sign: "a452af731650e2c5b39abcdc7c28dd27db7b3b654c2230ad2c386e64afb98605",
};

const stringToSign = Object.entries(params)
  .filter(([k]) => k !== "sign")
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
  .join("&");

const expectedSign = crypto.createHmac("sha256", secret).update(stringToSign).digest("hex");
const signOk = expectedSign === params.sign;

const sha1Base = [
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
const expectedSha1 = crypto.createHash("sha1").update(sha1Base).digest("hex");
const sha1Ok = expectedSha1 === params.sha1_hash;

console.log("wallet suffix:", wallet ? wallet.slice(-4) : "(нет)");
console.log("secret length:", secret.length);
console.log(
  "test vector (secret123 from YooMoney docs): sign",
  signOk ? "OK" : "FAIL",
  "sha1",
  sha1Ok ? "OK" : "FAIL",
);
if (!signOk && !sha1Ok) {
  console.log(
    "\nСекрет в .env НЕ совпадает с тестовым secret123 — это нормально для боевого ключа.",
    "\nСкопируйте секрет из: https://yoomoney.ru/transfer/myservices/http-notification",
    "\nВ .env: YOOMONEY_SECRET=ключ (без кавычек и пробелов)",
    "\nПосле правки: pm2 restart rave-casino --update-env",
  );
} else {
  console.log(
    "\nВ .env стоит тестовый secret123 из документации — замените на секрет из кошелька.",
  );
}

if (secret.length < 8) {
  console.warn("Подозрительно короткий секрет — проверьте, что скопировали полностью.");
}
