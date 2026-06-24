const COLORS = {
  bg: { light: "#FFFFFF", dark: "#1C1C1E" },
  title: { light: "#1A1A1A", dark: "#FFD60A" },
  text: { light: "#1C1C1E", dark: "#FFFFFF" },
  sub: { light: "#6E6E73", dark: "#AEAEB2" },
  blue: { light: "#007AFF", dark: "#0A84FF" },
  green: { light: "#34C759", dark: "#32D74B" },
  yellow: { light: "#FFCC00", dark: "#FFD60A" },
  orange: { light: "#FF9500", dark: "#FF9F0A" },
  red: { light: "#FF3B30", dark: "#FF453A" },
};

const USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1";

function parseChoice(value, allowed, fallback) {
  const parsed = Number.parseInt(value || "", 10);
  return allowed.includes(parsed) ? parsed : fallback;
}

function text(value, options = {}) {
  return {
    type: "text",
    text: String(value || ""),
    textColor: options.color || COLORS.text,
    font: options.font || { size: 10 },
    textAlign: options.align || "left",
    maxLines: options.maxLines || 1,
    minScale: options.minScale || 0.55,
  };
}

function icon(name, color = COLORS.blue, size = 11) {
  return {
    type: "image",
    src: `sf-symbol:${name}`,
    color,
    width: size,
    height: size,
  };
}

function stack(direction, children, options = {}) {
  return {
    type: "stack",
    direction,
    alignItems: options.alignItems || "center",
    gap: options.gap === undefined ? 4 : options.gap,
    ...(options.flex ? { flex: options.flex } : {}),
    ...(options.height ? { height: options.height } : {}),
    ...(options.backgroundColor ? { backgroundColor: options.backgroundColor } : {}),
    children,
  };
}

function row(iconName, label, value, valueColor = COLORS.text) {
  return stack("row", [
    icon(iconName, COLORS.blue, 10.5),
    text(label, { color: COLORS.sub, font: { size: 9.5 } }),
    { type: "spacer" },
    text(value, { color: valueColor, font: { size: 9.5, weight: "bold" }, align: "right" }),
  ]);
}

function statusRow(label, status, color, symbol) {
  return stack("row", [
    icon(symbol || (color === COLORS.red ? "xmark.circle.fill" : "checkmark.circle.fill"), color, 10.5),
    text(label, { color: COLORS.text, font: { size: 9.5, weight: "medium" } }),
    { type: "spacer" },
    text(status, { color, font: { size: 9.5, weight: "bold" }, align: "right" }),
  ]);
}

function withPolicy(policy, timeout, extra = {}) {
  const options = {
    timeout,
    credentials: "omit",
    ...extra,
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/json,text/plain,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.6",
      ...(extra.headers || {}),
    },
  };
  if (policy) options.policy = policy;
  return options;
}

async function getText(ctx, url, options) {
  const response = await ctx.http.get(url, options);
  return {
    status: response.status,
    text: await response.text(),
  };
}

async function postText(ctx, url, body, options) {
  const response = await ctx.http.post(url, { ...options, body });
  return {
    status: response.status,
    text: await response.text(),
  };
}

function parseJSON(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function compactISP(value) {
  const textValue = String(value || "未知运营商");
  const lower = textValue.toLowerCase();
  if (lower.includes("mobile") || textValue.includes("移动") || lower.includes("cmcc")) return "中国移动";
  if (lower.includes("telecom") || textValue.includes("电信") || lower.includes("chinanet")) return "中国电信";
  if (lower.includes("unicom") || textValue.includes("联通")) return "中国联通";
  if (textValue.length > 18) return `${textValue.slice(0, 17)}.`;
  return textValue;
}

function flagFromCode(code) {
  const normalized = String(code || "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return "";
  return String.fromCodePoint(...normalized.split("").map((char) => 127397 + char.charCodeAt(0)));
}

function colorByRisk(score) {
  if (score <= 0) return COLORS.green;
  if (score > 30) return COLORS.red;
  return COLORS.orange;
}

function unlockText(value) {
  if (!value || value === "Cross") return { text: "不可用", color: COLORS.red, icon: "xmark.circle.fill" };
  if (value === "CN") return { text: "送中", color: COLORS.red, icon: "xmark.circle.fill" };
  if (value === "Popcorn") return { text: "仅自制", color: COLORS.orange, icon: "exclamationmark.circle.fill" };
  return { text: value === "OK" ? "OK" : value, color: COLORS.green, icon: "checkmark.circle.fill" };
}

async function probeLocal(ctx, timeout) {
  try {
    const response = await getText(
      ctx,
      "https://myip.ipip.net/json",
      withPolicy("DIRECT", timeout, { headers: { "User-Agent": "Mozilla/5.0" } }),
    );
    const data = parseJSON(response.text);
    const body = data && data.data;
    const location = body && Array.isArray(body.location) ? body.location : [];
    return {
      ip: body && body.ip ? body.ip : "获取失败",
      location: `${location[1] || ""} ${location[2] || ""}`.trim() || "未知位置",
      isp: compactISP(location[4] || location[3]),
    };
  } catch {
    return { ip: "获取失败", location: "未知位置", isp: "未知运营商" };
  }
}

async function probeLanding(ctx, policy, timeout) {
  try {
    const response = await getText(ctx, "https://my.ippure.com/v1/info", withPolicy(policy, timeout));
    const data = parseJSON(response.text) || {};
    const countryCode = String(data.countryCode || "").toUpperCase();
    const flag = flagFromCode(countryCode === "TW" ? "CN" : countryCode);
    const residential =
      data.isResidential === true ? "住宅宽带" : data.isResidential === false ? "商业机房" : "未知属性";
    const fraudScore = data.fraudScore === undefined ? null : Math.round(safeNumber(data.fraudScore, 0));
    return {
      ip: data.ip || "获取失败",
      location: `${flag} ${data.country || ""} ${data.city || ""}`.trim() || "未知位置",
      nativeText: residential,
      ippure: {
        status: fraudScore === null ? "未知" : fraudScore === 0 ? "纯净" : `风险 ${fraudScore}`,
        color: fraudScore === null ? COLORS.sub : colorByRisk(fraudScore),
        riskScore: fraudScore || 0,
      },
    };
  } catch {
    return {
      ip: "获取失败",
      location: "未知位置",
      nativeText: "未知属性",
      ippure: { status: "获取失败", color: COLORS.sub, riskScore: 0 },
    };
  }
}

async function checkChatGPT(ctx, policy, timeout) {
  try {
    const api = await getText(ctx, "https://api.openai.com/v1/models", withPolicy(policy, timeout));
    if (api.status === 401 || (api.status >= 200 && api.status < 300)) {
      const trace = await getText(ctx, "https://chatgpt.com/cdn-cgi/trace", withPolicy(policy, timeout));
      const match = trace.text.match(/(?:^|\n)loc=([A-Z]{2})/);
      return match ? match[1] : "OK";
    }
    if (/unsupported_country|country.+not supported/i.test(api.text)) return "Cross";
    return "Cross";
  } catch {
    return "Cross";
  }
}

async function checkGemini(ctx, policy, timeout) {
  try {
    const body = 'f.req=[["K4WWud","[[0],[\\"en-US\\"]]",null,"generic"]]';
    const response = await postText(
      ctx,
      "https://gemini.google.com/_/BardChatUi/data/batchexecute",
      body,
      withPolicy(policy, timeout, {
        headers: {
          "Accept-Language": "en-US,en;q=0.9",
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }),
    );
    if (!response.text) return "Cross";
    const match = response.text.match(/"countryCode"\s*:\s*"([A-Z]{2})"/);
    return match ? match[1].toUpperCase() : "OK";
  } catch {
    return "Cross";
  }
}

async function checkClaude(ctx, policy, timeout) {
  try {
    const response = await getText(ctx, "https://claude.ai/login", withPolicy(policy, timeout));
    if (response.status === 403 || /app unavailable|unsupported_country/i.test(response.text)) return "Cross";
    return "OK";
  } catch {
    return "Cross";
  }
}

async function checkYouTube(ctx, policy, timeout) {
  try {
    const response = await getText(
      ctx,
      "https://www.youtube.com/premium",
      withPolicy(policy, timeout, { headers: { "Accept-Language": "en-US,en;q=0.9" } }),
    );
    if (/www\.google\.cn/i.test(response.text)) return "CN";
    if (/premium is not available/i.test(response.text)) return "Cross";
    const match = response.text.match(/"contentRegion"\s*:\s*"?([A-Z]{2})"?/);
    if (match) return match[1].toUpperCase();
    return /ad-free/i.test(response.text) ? "OK" : "Cross";
  } catch {
    return "Cross";
  }
}

async function checkNetflix(ctx, policy, timeout) {
  try {
    const urls = ["https://www.netflix.com/title/81280792", "https://www.netflix.com/title/70143836"];
    const bodies = await Promise.all(
      urls.map(async (url) => {
        try {
          return (await getText(ctx, url, withPolicy(policy, timeout))).text;
        } catch {
          return "";
        }
      }),
    );
    if (!bodies[0] && !bodies[1]) return "Cross";
    if (bodies.every((body) => body.includes("oh no!"))) return "Popcorn";
    for (const body of bodies) {
      const match = body.match(/"countryCode"\s*:\s*"?([A-Z]{2})"?/);
      if (match) return match[1].toUpperCase();
    }
    return "OK";
  } catch {
    return "Cross";
  }
}

async function checkTikTok(ctx, policy, timeout) {
  try {
    const response = await getText(ctx, "https://www.tiktok.com/", withPolicy(policy, timeout));
    const match = response.text.match(/"region"\s*:\s*"([A-Z]{2})"/);
    return match ? match[1].toUpperCase() : response.text ? "OK" : "Cross";
  } catch {
    return "Cross";
  }
}

async function checkTelegram(ctx, policy, timeout) {
  try {
    const response = await getText(ctx, "https://core.telegram.org", withPolicy(policy, Math.min(timeout, 4000)));
    return response.status === 200
      ? { status: "大概率正常", color: COLORS.green, riskScore: 0 }
      : { status: "可能受限", color: COLORS.orange, riskScore: 10 };
  } catch {
    return { status: "大概率正常", color: COLORS.green, riskScore: 0 };
  }
}

async function checkProxyCheck(ctx, policy, timeout, ip) {
  if (!ip || ip === "获取失败") return { status: "未知", color: COLORS.sub, riskScore: 0 };
  try {
    const response = await getText(
      ctx,
      `http://proxycheck.io/v2/${encodeURIComponent(ip)}?vpn=1&asn=1`,
      withPolicy(policy, Math.min(timeout, 4000)),
    );
    const data = parseJSON(response.text) || {};
    const node = data[ip];
    if (!node) return { status: "正常", color: COLORS.green, riskScore: 0 };
    const risk = Math.round(safeNumber(node.risk, 0));
    const type = String(node.type || "Unknown").slice(0, 8);
    return { status: `${type}/${risk}`, color: colorByRisk(risk), riskScore: risk };
  } catch {
    return { status: "获取失败", color: COLORS.sub, riskScore: 0 };
  }
}

async function checkBlackbox(ctx, policy, timeout, ip) {
  if (!ip || ip === "获取失败") return { status: "未知", color: COLORS.sub, riskScore: 0 };
  try {
    const response = await getText(
      ctx,
      `https://blackbox.ipinfo.app/lookup/${encodeURIComponent(ip)}`,
      withPolicy(policy, Math.min(timeout, 4000)),
    );
    const value = response.text.trim();
    if (value === "N") return { status: "正常", color: COLORS.green, riskScore: 0 };
    if (value === "Y") return { status: "异常", color: COLORS.red, riskScore: 30 };
    return { status: "未知", color: COLORS.sub, riskScore: 0 };
  } catch {
    return { status: "获取失败", color: COLORS.sub, riskScore: 0 };
  }
}

async function checkIpapi(ctx, policy, timeout, ip) {
  if (!ip || ip === "获取失败") return { status: "未知", color: COLORS.sub, riskScore: 0 };
  try {
    const response = await getText(
      ctx,
      `https://api.ipapi.is/?q=${encodeURIComponent(ip)}`,
      withPolicy(policy, Math.min(timeout, 5000)),
    );
    const data = parseJSON(response.text) || {};
    const match = String(data.company && data.company.abuser_score ? data.company.abuser_score : "").match(/([0-9.]+)/);
    const score = match ? safeNumber(match[1], 0) * 100 : 0;
    const shown = score === 0 ? "0.01%" : `${score.toFixed(2)}%`;
    return { status: shown, color: score > 5 ? COLORS.red : score > 1 ? COLORS.orange : COLORS.green, riskScore: score };
  } catch {
    return { status: "获取失败", color: COLORS.sub, riskScore: 0 };
  }
}

async function checkNetCoffee(ctx, policy, timeout) {
  try {
    const response = await getText(ctx, "https://ip.net.coffee/api/ip/", withPolicy(policy, Math.min(timeout, 4000)));
    const data = parseJSON(response.text) || {};
    const trust = data.trust === undefined ? 100 : Math.round(safeNumber(data.trust, 100));
    return { status: `信任 ${trust}`, color: trust >= 80 ? COLORS.green : COLORS.orange, riskScore: trust >= 80 ? 0 : 20 };
  } catch {
    return { status: "信任 100", color: COLORS.green, riskScore: 0 };
  }
}

function unsupportedWidget(refreshAfter) {
  return {
    type: "widget",
    refreshAfter,
    padding: 16,
    backgroundColor: COLORS.bg,
    children: [text("请使用中号或大号组件", { color: COLORS.text, font: { size: "callout" }, align: "center" })],
  };
}

export default async function (ctx) {
  const env = ctx.env || {};
  const policy = String(env.POLICY || "").trim();
  const timeout = parseChoice(env.REQUEST_TIMEOUT, [5000, 8000, 12000], 8000);
  const refreshInterval = parseChoice(env.REFRESH_INTERVAL, [300, 900, 1800, 3600], 900);
  const refreshAfter = new Date(Date.now() + refreshInterval * 1000).toISOString();
  const family = ctx.widgetFamily || "systemMedium";

  if (family === "systemSmall" || family.startsWith("accessory")) return unsupportedWidget(refreshAfter);

  const [localInfo, landingInfo] = await Promise.all([
    probeLocal(ctx, timeout),
    probeLanding(ctx, policy, timeout),
  ]);
  const landingReady = landingInfo.ip !== "获取失败";

  let unlocks = {
    gpt: "Cross",
    gemini: "Cross",
    claude: "Cross",
    youtube: "Cross",
    netflix: "Cross",
    tiktok: "Cross",
  };
  let risks = {
    telegram: { status: "未知", color: COLORS.sub, riskScore: 0 },
    ipapi: { status: "未知", color: COLORS.sub, riskScore: 0 },
    proxy: { status: "未知", color: COLORS.sub, riskScore: 0 },
    blackbox: { status: "未知", color: COLORS.sub, riskScore: 0 },
    netCoffee: { status: "未知", color: COLORS.sub, riskScore: 0 },
  };

  if (landingReady) {
    const results = await Promise.all([
      checkChatGPT(ctx, policy, timeout),
      checkGemini(ctx, policy, timeout),
      checkClaude(ctx, policy, timeout),
      checkYouTube(ctx, policy, timeout),
      checkNetflix(ctx, policy, timeout),
      checkTikTok(ctx, policy, timeout),
      checkTelegram(ctx, policy, timeout),
      checkIpapi(ctx, policy, timeout, landingInfo.ip),
      checkProxyCheck(ctx, policy, timeout, landingInfo.ip),
      checkBlackbox(ctx, policy, timeout, landingInfo.ip),
      checkNetCoffee(ctx, policy, timeout),
    ]);
    unlocks = {
      gpt: results[0],
      gemini: results[1],
      claude: results[2],
      youtube: results[3],
      netflix: results[4],
      tiktok: results[5],
    };
    risks = {
      telegram: results[6],
      ipapi: results[7],
      proxy: results[8],
      blackbox: results[9],
      netCoffee: results[10],
    };
  }

  const totalRisk = Math.round(
    landingInfo.ippure.riskScore +
      risks.ipapi.riskScore +
      risks.proxy.riskScore +
      risks.blackbox.riskScore +
      risks.netCoffee.riskScore,
  );
  const riskColor = colorByRisk(totalRisk);
  const riskIcon = totalRisk === 0 ? "checkmark.shield.fill" : "exclamationmark.shield.fill";
  const currentTime = new Date();
  const timeText = `${String(currentTime.getHours()).padStart(2, "0")}:${String(currentTime.getMinutes()).padStart(2, "0")}`;
  const isLarge = family === "systemLarge" || family === "systemExtraLarge";

  const unlockRows = [
    ["GPT", unlocks.gpt],
    ["Claude", unlocks.claude],
    ["Gemini", unlocks.gemini],
    ["YouTube", unlocks.youtube],
    ["奈飞", unlocks.netflix],
    ["TikTok", unlocks.tiktok],
  ].map(([label, value]) => {
    const item = unlockText(value);
    return statusRow(label, item.text, item.color, item.icon);
  });

  const riskRows = [
    ["TG 预测", risks.telegram],
    ["IPPure", landingInfo.ippure],
    ["ipapi", risks.ipapi],
    ["NetCoffee", risks.netCoffee],
    ["Proxy", risks.proxy],
    ["Blackbox", risks.blackbox],
  ].map(([label, value]) => {
    const symbol =
      value.color === COLORS.red
        ? "xmark.circle.fill"
        : value.color === COLORS.orange || value.color === COLORS.yellow
          ? "exclamationmark.circle.fill"
          : value.color === COLORS.sub
            ? "questionmark.circle.fill"
            : "checkmark.circle.fill";
    return statusRow(label, value.status, value.color, symbol);
  });

  return {
    type: "widget",
    refreshAfter,
    padding: isLarge ? [10, 12] : [8, 10],
    gap: 4,
    backgroundColor: COLORS.bg,
    children: [
      stack("row", [
        text("数据中心 (DCH)", { color: COLORS.title, font: { size: 13, weight: "heavy" } }),
        stack("row", [icon(riskIcon, riskColor, 12), text(`风险 ${totalRisk}`, { color: riskColor, font: { size: 11, weight: "bold" } })], {
          gap: 2,
        }),
        { type: "spacer" },
        stack(
          "row",
          [
            icon("exclamationmark.circle.fill", COLORS.orange, 12),
            text(policy || "默认节点", { color: COLORS.orange, font: { size: 11, weight: "bold" }, maxLines: 1 }),
          ],
          { gap: 2 },
        ),
        { type: "spacer" },
        stack("row", [icon("arrow.clockwise", COLORS.sub, 11), text(timeText, { color: COLORS.sub, font: { size: 11 } })], {
          gap: 2,
        }),
      ]),
      stack("row", [
        stack(
          "column",
          [
            row("house.fill", "本地IP:", localInfo.ip, localInfo.ip === "获取失败" ? COLORS.red : COLORS.green),
            row("person.fill", "本地位置:", localInfo.location),
            row("simcard.fill", "本地运营商:", localInfo.isp),
          ],
          { flex: 1, alignItems: "stretch", gap: 2.5 },
        ),
        stack(
          "column",
          [
            row("globe", "落地IP:", landingInfo.ip, landingReady ? COLORS.green : COLORS.red),
            row("map.fill", "落地位置:", landingInfo.location, landingReady ? COLORS.text : COLORS.red),
            row("building.2.fill", "原生属性:", landingInfo.nativeText, landingReady ? COLORS.text : COLORS.red),
          ],
          { flex: 1, alignItems: "stretch", gap: 2.5 },
        ),
      ], { gap: 12 }),
      stack("row", [], {
        height: 0.5,
        backgroundColor: { light: "rgba(0,0,0,0.08)", dark: "rgba(255,255,255,0.12)" },
      }),
      stack("row", [
        stack("column", unlockRows, { flex: 1, alignItems: "stretch", gap: isLarge ? 2.5 : 2 }),
        stack("column", riskRows, { flex: 1, alignItems: "stretch", gap: isLarge ? 2.5 : 2 }),
      ], { gap: 12 }),
    ],
  };
}
