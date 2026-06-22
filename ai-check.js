export default async function (ctx) {
  const results = {
    chatgpt: { name: "ChatGPT", status: "检测中", region: "--", color: "#8E8E93" },
    gemini: { name: "Gemini", status: "检测中", region: "--", color: "#8E8E93" },
  };

  // 获取 IP 区域信息
  async function getRegion() {
    try {
      const resp = await ctx.http.get("https://ipinfo.io/json", { timeout: 5000 });
      const data = await resp.json();
      return data.country || "未知";
    } catch {
      return "未知";
    }
  }

  // 测试 ChatGPT 连通性
  async function checkChatGPT() {
    try {
      const resp = await ctx.http.get("https://ios.chat.openai.com/public-api/mobile/server_status/v1", {
        timeout: 10000,
        redirect: "manual",
      });
      if (resp.status === 200) {
        results.chatgpt.status = "已解锁";
        results.chatgpt.color = "#34C759";
      } else if (resp.status === 403) {
        results.chatgpt.status = "未解锁";
        results.chatgpt.color = "#FF3B30";
      } else {
        results.chatgpt.status = "异常";
        results.chatgpt.color = "#FF9500";
      }
    } catch {
      results.chatgpt.status = "失败";
      results.chatgpt.color = "#FF3B30";
    }
  }

  // 测试 Gemini 连通性
  async function checkGemini() {
    try {
      const resp = await ctx.http.get("https://generativelanguage.googleapis.com/v1/models", {
        timeout: 10000,
        redirect: "manual",
      });
      if (resp.status === 200 || resp.status === 401) {
        results.gemini.status = "已解锁";
        results.gemini.color = "#34C759";
      } else if (resp.status === 403) {
        results.gemini.status = "未解锁";
        results.gemini.color = "#FF3B30";
      } else {
        results.gemini.status = "异常";
        results.gemini.color = "#FF9500";
      }
    } catch {
      results.gemini.status = "失败";
      results.gemini.color = "#FF3B30";
    }
  }

  // 并行执行检测
  const [region] = await Promise.all([
    getRegion(),
    checkChatGPT(),
    checkGemini(),
  ]);

  results.chatgpt.region = region;
  results.gemini.region = region;

  // 根据小组件尺寸返回不同布局
  if (ctx.widgetFamily === "accessoryCircular") {
    const allOk = results.chatgpt.status === "已解锁" && results.gemini.status === "已解锁";
    return {
      type: "widget",
      children: [
        {
          type: "text",
          text: "AI",
          font: { size: "headline", weight: "bold" },
          textColor: "#FFFFFF",
        },
        {
          type: "text",
          text: allOk ? "OK" : "FAIL",
          font: { size: "caption2" },
          textColor: allOk ? "#34C759" : "#FF3B30",
        },
      ],
    };
  }

  if (ctx.widgetFamily === "accessoryRectangular") {
    return {
      type: "widget",
      children: [
        {
          type: "stack",
          direction: "row",
          alignItems: "center",
          gap: 6,
          children: [
            { type: "text", text: "ChatGPT", font: { size: "footnote", weight: "medium" } },
            { type: "spacer" },
            { type: "text", text: `${results.chatgpt.status},${results.chatgpt.region}`, font: { size: "caption2" }, textColor: results.chatgpt.color },
          ],
        },
        {
          type: "stack",
          direction: "row",
          alignItems: "center",
          gap: 6,
          children: [
            { type: "text", text: "Gemini", font: { size: "footnote", weight: "medium" } },
            { type: "spacer" },
            { type: "text", text: `${results.gemini.status},${results.gemini.region}`, font: { size: "caption2" }, textColor: results.gemini.color },
          ],
        },
      ],
    };
  }

  // 默认主屏幕小组件布局
  return {
    type: "widget",
    backgroundGradient: {
      type: "linear",
      colors: ["#1a1a2e", "#16213e"],
      startPoint: { x: 0, y: 0 },
      endPoint: { x: 1, y: 1 },
    },
    padding: 16,
    gap: 12,
    children: [
      {
        type: "stack",
        direction: "row",
        alignItems: "center",
        gap: 8,
        children: [
          {
            type: "image",
            src: "sf-symbol:brain.head.profile",
            color: "#007AFF",
            width: 20,
            height: 20,
          },
          {
            type: "text",
            text: "AI 解锁检测",
            font: { size: "headline", weight: "bold" },
            textColor: "#FFFFFF",
          },
        ],
      },
      {
        type: "stack",
        direction: "column",
        gap: 8,
        children: [
          {
            type: "stack",
            direction: "row",
            alignItems: "center",
            gap: 8,
            children: [
              {
                type: "image",
                src: "sf-symbol:sparkles",
                color: "#000000",
                width: 16,
                height: 16,
              },
              {
                type: "text",
                text: "ChatGPT",
                font: { size: "subheadline", weight: "medium" },
                textColor: "#FFFFFF",
              },
              {
                type: "text",
                text: `${results.chatgpt.status},区域:${results.chatgpt.region}`,
                font: { size: "subheadline", weight: "semibold" },
                textColor: results.chatgpt.color,
              },
            ],
          },
          {
            type: "stack",
            direction: "row",
            alignItems: "center",
            gap: 8,
            children: [
              {
                type: "image",
                src: "sf-symbol:stars",
                color: "#4285F4",
                width: 16,
                height: 16,
              },
              {
                type: "text",
                text: "Gemini",
                font: { size: "subheadline", weight: "medium" },
                textColor: "#FFFFFF",
              },
              {
                type: "text",
                text: `${results.gemini.status},区域:${results.gemini.region}`,
                font: { size: "subheadline", weight: "semibold" },
                textColor: results.gemini.color,
              },
            ],
          },
        ],
      },
      {
        type: "date",
        format: "relative",
        font: { size: "caption2" },
        textColor: "#888888",
      },
    ],
  };
}
