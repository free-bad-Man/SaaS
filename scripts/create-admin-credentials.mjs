import { createPasswordHash } from "../platform/auth.mjs";

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
const random = (size) => crypto.getRandomValues(new Uint8Array(size));
const password = Array.from(random(22), (byte) => alphabet[byte % alphabet.length]).join("");
const secret = Array.from(random(48), (byte) => byte.toString(16).padStart(2, "0")).join("");
const hash = await createPasswordHash(password);

console.log("ADMIN_USERNAME=admin");
console.log("ADMIN_EMAIL=owner@local.verdict");
console.log(`ADMIN_PASSWORD_HASH=${hash}`);
console.log(`ADMIN_SESSION_SECRET=${secret}`);
console.log(`ADMIN_INITIAL_PASSWORD=${password}`);

