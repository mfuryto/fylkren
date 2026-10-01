import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";

const endpoint = process.env.FYLKREN_BROWSER_CDP_URL ?? "http://127.0.0.1:19224";
const targetUrl = process.env.FYLKREN_BROWSER_TARGET_URL ?? "http://web:8080/";
const evidenceDirectory = process.env.FYLKREN_LOCALIZATION_EVIDENCE ?? "output/localization-visual";
const languages = [
  "en-US", "en-GB", "nb-NO", "sv-SE", "da-DK", "fi-FI", "de-DE", "fr-FR", "pl-PL",
  "es-ES", "it-IT", "uk-UA", "nl-NL", "pt-PT", "cs-CZ", "ro-RO", "et-EE", "lv-LV", "lt-LT",
];
const screenshotLanguages = new Set(["en-US", "de-DE", "fi-FI", "uk-UA", "lt-LT"]);

const target = await (await fetch(`${endpoint}/json/new?${encodeURIComponent(targetUrl)}`, { method: "PUT" })).json();
const socket = new WebSocket(target.webSocketDebuggerUrl.replace("127.0.0.1:9222", new URL(endpoint).host));
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve);
  socket.addEventListener("error", reject);
});

let sequence = 0;
const pending = new Map();
const browserErrors = [];
socket.addEventListener("message", event => {
  const value = JSON.parse(event.data);
  if (!value.id) {
    if (value.method === "Runtime.exceptionThrown") browserErrors.push(value.params.exceptionDetails?.text ?? "Runtime exception");
    if (value.method === "Log.entryAdded" && value.params.entry?.level === "error") browserErrors.push(value.params.entry.text);
    return;
  }
  const waiter = pending.get(value.id);
  if (!waiter) return;
  pending.delete(value.id);
  if (value.error) waiter.reject(new Error(JSON.stringify(value.error)));
  else waiter.resolve(value.result);
});

function call(method, params = {}) {
  const id = ++sequence;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
async function evaluate(expression) {
  const result = await call("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}
async function waitFor(expression, label) {
  for (let attempt = 0; attempt < 80; attempt++) {
    if (await evaluate(expression)) return;
    await pause(250);
  }
  throw new Error(`Timed out waiting for ${label}`);
}
async function navigate(hash) {
  await call("Page.navigate", { url: new URL(hash, targetUrl).href });
  await waitFor('document.readyState === "complete"', `${hash} document`);
  if (hash.includes("#/")) await waitFor('document.querySelector(".page") !== null', `${hash} page`);
  await evaluate("scrollTo(0, 0)");
  await pause(500);
}
async function setInput(selector, value) {
  await evaluate(`(() => {
    const input = document.querySelector(${JSON.stringify(selector)});
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event("input", { bubbles: true }));
  })()`);
}
async function request(path, method = "GET", body) {
  return evaluate(`(async () => {
    const method = ${JSON.stringify(method)};
    const headers = {};
    if (method !== "GET") {
      const token = await (await fetch("/api/security/antiforgery")).json();
      headers["X-Fylkren-CSRF"] = token.token;
      headers["Content-Type"] = "application/json";
    }
    const response = await fetch(${JSON.stringify(path)}, {
      method, headers, credentials: "same-origin",
      body: ${body === undefined ? "undefined" : JSON.stringify(JSON.stringify(body))},
    });
    return { status: response.status, text: await response.text() };
  })()`);
}
async function viewport(width, height, mobile = false) {
  await call("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });
  await evaluate("scrollTo(0, 0)");
  await pause(100);
}
async function assertLayout(label, minimumPageWidth = 0) {
  const result = await evaluate(`(() => {
    const page = document.querySelector(".page");
    const clipped = [...document.querySelectorAll("button, a.navigation-item, .field label, .status-message, h1, h2, h3")]
      .filter(element => element.clientWidth > 0 && element.scrollWidth > element.clientWidth + 1)
      .map(element => ({ tag: element.tagName, text: element.textContent.trim().slice(0, 100), clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }));
    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      scrollX: window.scrollX,
      pageWidth: page ? Math.round(page.getBoundingClientRect().width) : 0,
      clipped,
    };
  })()`);
  assert.ok(result.documentWidth <= result.viewportWidth, `${label} document overflow: ${JSON.stringify(result)}`);
  assert.equal(result.scrollX, 0, `${label} retained a horizontal scroll offset`);
  assert.deepEqual(result.clipped, [], `${label} clipped interface text: ${JSON.stringify(result.clipped)}`);
  if (minimumPageWidth) assert.ok(result.pageWidth >= minimumPageWidth, `${label} page width ${result.pageWidth} < ${minimumPageWidth}`);
  return result;
}
async function screenshot(name) {
  const image = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await writeFile(`${evidenceDirectory}/${name}.png`, Buffer.from(image.data, "base64"));
}

try {
  await mkdir(evidenceDirectory, { recursive: true });
  await call("Page.enable");
  await call("Runtime.enable");
  await call("Log.enable");
  await viewport(1440, 1000);
  await navigate("/");
  await waitFor(`document.querySelector("#setup-display-name") !== null ||
    document.querySelector("#username") !== null ||
    document.querySelector(".product-shell .side-navigation") !== null`, "initial application state");
  let setupCredentials = null;
  if (await evaluate('document.querySelector("#setup-display-name") !== null')) {
    const suffix = randomBytes(6).toString("hex");
    const password = `V9!${randomBytes(24).toString("base64url")}#q`;
    const username = `localization-${suffix}`;
    setupCredentials = { username, password };
    await setInput("#setup-display-name", "Localization Layout Manager");
    await setInput("#setup-email", `localization-${suffix}@example.invalid`);
    await setInput("#setup-username", username);
    await setInput("#setup-password", password);
    await setInput("#setup-confirm-password", password);
    await evaluate('document.querySelector("#setup-password").closest("form").requestSubmit()');
  }
  await waitFor(`document.querySelector(".product-shell .side-navigation") !== null ||
    document.querySelector("#username") !== null`, "authenticated shell or sign-in page");
  if (await evaluate('document.querySelector("#username") !== null')) {
    assert.ok(setupCredentials, "The localization fixture is initialized but its test credentials are unavailable");
    await setInput("#username", setupCredentials.username);
    await setInput("#password", setupCredentials.password);
    await evaluate('document.querySelector("#password").closest("form").requestSubmit()');
  }
  await waitFor('document.querySelector(".product-shell .side-navigation") !== null', "authenticated shell");

  const results = [];
  for (const language of languages) {
    const update = await request("/api/platform/regional-settings/", "PUT", {
      defaultLanguage: language, timeZone: "Europe/Stockholm", clockFormat: "24-hour", measurementSystem: "metric",
    });
    assert.equal(update.status, 200, `${language}: ${update.text}`);
    await call("Page.reload", { ignoreCache: true });
    await waitFor('document.readyState === "complete"', `${language} reload`);
    await pause(500);

    await viewport(1920, 1080);
    await navigate("/#/appearance");
    await waitFor(`document.documentElement.lang === ${JSON.stringify(language)}`, `${language} document language`);
    const wide = await assertLayout(`${language} appearance wide`, 1500);

    await viewport(1280, 800);
    await navigate("/#/identity");
    const compact = await assertLayout(`${language} identity 13-inch`, 1050);
    await navigate("/#/federation");
    await evaluate('document.querySelector(".help-button")?.click()');
    await waitFor('document.querySelector("[role=dialog]") !== null', `${language} help dialog`);
    await assertLayout(`${language} help dialog 13-inch`, 1050);
    await evaluate('document.querySelector("[role=dialog] .icon-button")?.click()');

    if (screenshotLanguages.has(language)) {
      await navigate("/#/appearance");
      await screenshot(`${language}-appearance-1280x800`);
      await viewport(390, 844, true);
      await navigate("/#/appearance");
      await assertLayout(`${language} appearance mobile`);
      await screenshot(`${language}-appearance-390x844`);
    }
    results.push({ language, wide: wide.pageWidth, compact: compact.pageWidth });
  }

  assert.deepEqual(browserErrors, [], `Browser errors: ${JSON.stringify(browserErrors)}`);
  process.stdout.write(`${JSON.stringify({ localizationLayoutBrowser: "passed", languages: results, screenshots: screenshotLanguages.size * 2, browserErrors: 0 })}\n`);
} finally {
  socket.close();
}
