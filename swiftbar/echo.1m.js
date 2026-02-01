#!/usr/bin/env node

// 这里使用原生的 fetch (Node.js 18+ 内置) 避免安装依赖
const API_URL = "https://echo.nocoo.cloud/api/ip";

function flagEmoji(code) {
  if (!code || code.length !== 2) return "🏳️";
  const upper = code.toUpperCase();
  return String.fromCodePoint(upper.charCodeAt(0) + 127397) +
    String.fromCodePoint(upper.charCodeAt(1) + 127397);
}

function latencyColor(ms) {
  if (typeof ms !== "number") return "gray";
  if (ms <= 100) return "green";
  if (ms <= 300) return "orange";
  return "red";
}

function nowMs() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

async function run() {
  try {
    const started = nowMs();
    const response = await fetch(API_URL, { method: "GET" });
    const data = await response.json();
    const rttMs = Math.round(nowMs() - started);

    const latency = data.latencyMs;
    const location = data.location || {};
    const emoji = flagEmoji(location.iso2 || "");
    const color = latencyColor(rttMs);

    const title = typeof rttMs === "number" ? `${emoji} ${rttMs}ms` : `${emoji} --`;
    console.log(`${title} | color=${color}`);

    console.log("---");
    console.log(`IP: ${data.ip || "-"}`);
    console.log(`Country: ${location.country || "-"}`);
    const parts = [location.province || "-", location.city || "-"].join(" | ");
    console.log(`Location: ${parts}`);
    console.log(`ISP: ${location.isp || "-"}`);
    console.log(`RTT: ${rttMs}ms`);
    console.log(`Server: ${typeof latency === "number" ? `${latency}ms` : "-"}`);
    console.log(`刷新时间: ${new Date().toLocaleTimeString()}`);
  } catch (error) {
    console.log("⚠️ -- | color=red");
    console.log("---");
    console.log("错误信息: " + error.message);
  }
}

run();
