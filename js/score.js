(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) root.PinScore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const CRITERIA_TEMPLATE = [
    { key: "rhythm", name: "节奏与剪点", weight: 20, hint: "剪点有没有落在节拍和信息点上" },
    { key: "transition", name: "转场", weight: 10, hint: "转场是在帮忙，还是在抢戏" },
    { key: "story", name: "叙事与结构", weight: 20, hint: "起承转合能不能看懂" },
    { key: "visual", name: "画面与构图", weight: 15, hint: "镜头选择、构图和运动" },
    { key: "color", name: "调色与风格", weight: 10, hint: "色彩是否统一、有意图" },
    { key: "audio", name: "声音与配乐", weight: 15, hint: "对白、环境声和音乐的平衡" },
    { key: "gfx", name: "字幕与图形", weight: 10, hint: "字幕可读性，包装干不干净" },
  ];

  function clampScore(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.min(10, Math.max(0, number));
  }

  function clampWeight(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.min(100, Math.max(0, number));
  }

  function weightedScore(criteria) {
    let weight = 0;
    let points = 0;
    for (const item of criteria || []) {
      const itemWeight = clampWeight(item.weight);
      weight += itemWeight;
      points += (clampScore(item.score) / 10) * itemWeight;
    }
    if (weight <= 0) return 0;
    return Math.round((points / weight) * 1000) / 10;
  }

  function gradeFor(score) {
    if (score >= 90) return { letter: "S", label: "出色" };
    if (score >= 80) return { letter: "A", label: "优秀" };
    if (score >= 70) return { letter: "B", label: "良好" };
    if (score >= 60) return { letter: "C", label: "及格" };
    return { letter: "D", label: "待改" };
  }

  function formatTime(seconds) {
    let value = Number(seconds);
    if (!Number.isFinite(value) || value < 0) value = 0;
    const centiseconds = Math.round(value * 100);
    const minutes = Math.floor(centiseconds / 6000);
    const remain = Math.floor(centiseconds / 100) % 60;
    const fraction = centiseconds % 100;
    return (
      String(minutes).padStart(2, "0") +
      ":" +
      String(remain).padStart(2, "0") +
      "." +
      String(fraction).padStart(2, "0")
    );
  }

  function parseTime(input) {
    const text = String(input ?? "").trim();
    if (!text) return 0;
    if (/^\d+(\.\d+)?$/.test(text)) return Number(text);
    const match = text.match(/^(\d+):(\d{1,2})(?:\.(\d{1,3}))?$/);
    if (!match) return null;
    const minutes = Number(match[1]);
    const seconds = Number(match[2]);
    if (seconds >= 60) return null;
    const digits = match[3] || "";
    const fraction = digits ? Number(digits) / 10 ** digits.length : 0;
    return minutes * 60 + seconds + fraction;
  }

  return {
    CRITERIA_TEMPLATE,
    clampScore,
    clampWeight,
    weightedScore,
    gradeFor,
    formatTime,
    parseTime,
  };
});
