(function () {
  const STORAGE_KEY = "pin-pong.projects.v1";
  const scoreApi = window.PinScore;
  const { CRITERIA_TEMPLATE, clampScore, clampWeight, weightedScore, gradeFor, formatTime, parseTime } = scoreApi;

  const $ = (id) => document.getElementById(id);
  const fields = ["title", "editor", "reviewer", "summary"];
  let state = { projects: [], activeId: null };
  let objectUrl = null;

  function uid() {
    return crypto.randomUUID();
  }

  function stamp() {
    return new Date().toISOString();
  }

  function blankCriteria() {
    return CRITERIA_TEMPLATE.map((item) => ({
      key: item.key,
      name: item.name,
      hint: item.hint,
      weight: item.weight,
      score: 0,
      note: "",
    }));
  }

  function sampleProject() {
    const criteria = blankCriteria();
    const preset = { rhythm: 8.5, transition: 7, story: 8, visual: 9, color: 8, audio: 7.5, gfx: 6.5 };
    const notes = {
      rhythm: "前三段剪点贴着鼓点，结尾略拖。",
      gfx: "片尾字幕字号偏小。",
    };
    for (const item of criteria) {
      item.score = preset[item.key];
      item.note = notes[item.key] || "";
    }
    return {
      id: uid(),
      title: "示例 · 城市夜骑",
      editor: "林可",
      reviewer: "你",
      summary: "节奏干净，夜景调色统一。片尾字幕和最后一次转场还可以再收一收。",
      videoName: "",
      sample: true,
      createdAt: stamp(),
      updatedAt: stamp(),
      criteria,
      marks: [
        { id: uid(), time: 12.4, text: "切到车灯特写稍早，前一个镜头的信息还没给完。" },
        { id: uid(), time: 46, text: "音乐抽掉之后环境声太干，可以留一点房间声。" },
      ],
    };
  }

  function text(value, max) {
    return String(value ?? "").slice(0, max);
  }

  function normalize(project) {
    if (!project || typeof project !== "object") return null;
    const previous = new Map((Array.isArray(project.criteria) ? project.criteria : []).map((item) => [item && item.key, item]));
    const criteria = CRITERIA_TEMPLATE.map((template) => {
      const item = previous.get(template.key) || {};
      return {
        key: template.key,
        name: template.name,
        hint: template.hint,
        weight: clampWeight(item.weight === undefined ? template.weight : item.weight),
        score: clampScore(item.score),
        note: text(item.note, 240),
      };
    });
    const marks = (Array.isArray(project.marks) ? project.marks : [])
      .filter((mark) => mark && typeof mark.text === "string" && mark.text.trim())
      .map((mark) => ({
        id: text(mark.id, 80) || uid(),
        time: Math.max(0, Number(mark.time) || 0),
        text: text(mark.text.trim(), 240),
      }))
      .sort((a, b) => a.time - b.time);
    return {
      id: text(project.id, 80) || uid(),
      title: text(project.title, 80) || "未命名成片",
      editor: text(project.editor, 40),
      reviewer: text(project.reviewer, 40),
      summary: text(project.summary, 1000),
      videoName: text(project.videoName, 180),
      sample: Boolean(project.sample),
      createdAt: text(project.createdAt, 40) || stamp(),
      updatedAt: text(project.updatedAt, 40) || stamp(),
      criteria,
      marks,
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || !Array.isArray(data.projects)) return null;
      return data;
    } catch {
      return null;
    }
  }

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ projects: state.projects, activeId: state.activeId }));
  }

  function active() {
    return state.projects.find((project) => project.id === state.activeId) || null;
  }

  function touch(project) {
    project.updatedAt = stamp();
    project.sample = false;
  }

  function relativeTime(iso) {
    const delta = Date.now() - new Date(iso).getTime();
    if (!Number.isFinite(delta) || delta < 60000) return "刚刚";
    const minutes = Math.round(delta / 60000);
    if (minutes < 60) return minutes + " 分钟前";
    const hours = Math.round(minutes / 60);
    if (hours < 24) return hours + " 小时前";
    return Math.round(hours / 24) + " 天前";
  }

  function setBusy(enabled) {
    for (const id of ["export-json", "print-sheet", "delete-project", "reset-scores", "reset-weights"]) {
      $(id).disabled = !enabled;
    }
    $("stage").hidden = !enabled;
    $("score-panel").hidden = !enabled;
  }

  function renderList() {
    const list = $("project-list");
    list.replaceChildren();
    $("project-count").textContent = state.projects.length + " 条";
    if (!state.projects.length) {
      const item = document.createElement("li");
      item.className = "empty";
      item.textContent = "还没有成片。点右上角新建成片。";
      list.append(item);
      return;
    }
    for (const project of state.projects) {
      const score = weightedScore(project.criteria);
      const grade = gradeFor(score);
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "project" + (project.id === state.activeId ? " active" : "");
      button.dataset.projectId = project.id;

      const pip = document.createElement("span");
      pip.className = "grade-pip " + grade.letter;
      pip.textContent = grade.letter;

      const copy = document.createElement("span");
      const title = document.createElement("span");
      title.className = "project-title";
      title.textContent = project.title;
      if (project.sample) {
        const badge = document.createElement("span");
        badge.className = "badge";
        badge.textContent = "示例";
        title.append(badge);
      }
      const sub = document.createElement("span");
      sub.className = "project-sub";
      sub.textContent = (project.editor || "未署名") + " · " + relativeTime(project.updatedAt);
      copy.append(title, sub);

      const points = document.createElement("span");
      points.className = "project-score";
      points.textContent = score.toFixed(1);

      button.append(pip, copy, points);
      button.addEventListener("click", () => selectProject(project.id));
      item.append(button);
      list.append(item);
    }
  }

  function renderMarks(project) {
    const list = $("mark-list");
    list.replaceChildren();
    for (const mark of project.marks) {
      const item = document.createElement("li");
      item.className = "note";

      const jump = document.createElement("button");
      jump.type = "button";
      jump.className = "link";
      jump.textContent = formatTime(mark.time);
      jump.addEventListener("click", () => seek(mark.time));

      const text = document.createElement("p");
      text.textContent = mark.text;

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "icon-button";
      remove.textContent = "删除";
      remove.addEventListener("click", () => {
        project.marks = project.marks.filter((item) => item.id !== mark.id);
        touch(project);
        persist();
        renderMarks(project);
      });

      item.append(jump, text, remove);
      list.append(item);
    }
  }

  function renderCriteria(project) {
    const root = $("criteria");
    root.replaceChildren();
    for (const item of project.criteria) {
      const block = document.createElement("section");
      block.className = "criterion";
      block.dataset.criterion = item.key;

      const top = document.createElement("div");
      top.className = "criterion-top";
      const heading = document.createElement("h3");
      heading.textContent = item.name;
      const contrib = document.createElement("span");
      contrib.className = "contrib";
      contrib.dataset.contrib = item.key;
      top.append(heading, contrib);

      const hint = document.createElement("p");
      hint.textContent = item.hint;

      const scale = document.createElement("div");
      scale.className = "criterion-scale";
      const range = document.createElement("input");
      range.type = "range";
      range.min = "0";
      range.max = "10";
      range.step = "0.5";
      range.value = String(item.score);
      range.setAttribute("aria-label", item.name + "分数");
      const number = document.createElement("input");
      number.type = "number";
      number.className = "weight";
      number.min = "0";
      number.max = "10";
      number.step = "0.5";
      number.value = String(item.score);
      number.setAttribute("aria-label", item.name + "分数数字");

      const applyScore = (value) => {
        item.score = clampScore(value);
        range.value = String(item.score);
        number.value = String(item.score);
        touch(project);
        persist();
        paintTotal(project);
        renderList();
      };
      range.addEventListener("input", () => applyScore(range.value));
      number.addEventListener("input", () => applyScore(number.value));
      const slider = document.createElement("div");
      slider.className = "slider";
      slider.append(range);
      scale.append(slider, number);

      const weightLabel = document.createElement("label");
      weightLabel.className = "weight-field";
      weightLabel.append(document.createTextNode("权重"));
      const weight = document.createElement("input");
      weight.type = "number";
      weight.className = "weight";
      weight.min = "0";
      weight.max = "100";
      weight.step = "1";
      weight.value = String(item.weight);
      weight.setAttribute("aria-label", item.name + "权重");
      weight.addEventListener("input", () => {
        item.weight = clampWeight(weight.value);
        weight.value = String(item.weight);
        touch(project);
        persist();
        paintTotal(project);
        renderList();
      });
      weightLabel.append(weight);
      scale.append(weightLabel);

      const note = document.createElement("input");
      note.type = "text";
      note.maxLength = 240;
      note.placeholder = "这一项可以怎么改";
      note.value = item.note;
      note.setAttribute("aria-label", item.name + "批注");
      note.addEventListener("input", () => {
        item.note = text(note.value, 240);
        touch(project);
        persist();
      });

      block.append(top, hint, scale, note);
      root.append(block);
    }
    paintTotal(project);
  }

  function paintTotal(project) {
    const score = weightedScore(project.criteria);
    const grade = gradeFor(score);
    const weight = project.criteria.reduce((sum, item) => sum + item.weight, 0);
    $("total-score").textContent = score.toFixed(1);
    $("grade-letter").textContent = grade.letter;
    $("grade-label").textContent = grade.label;
    $("meter").style.setProperty("--p", Math.max(0, Math.min(100, score)) + "%");
    $("weight-caption").textContent = "权重合计 " + weight;
    for (const item of project.criteria) {
      const node = document.querySelector('[data-contrib="' + item.key + '"]');
      if (!node) continue;
      const share = weight > 0 ? (item.weight / weight) * 100 : 0;
      node.textContent = item.score.toFixed(1) + " / 10 · 权重 " + Math.round(share) + "%";
    }
  }

  function showVideoStatus(project) {
    const name = $("video-name");
    const frame = $("video-frame");
    if (objectUrl) {
      name.textContent = project.videoName ? "正在预览 " + project.videoName : "正在预览本地视频";
      frame.classList.add("has-video");
      return;
    }
    frame.classList.remove("has-video");
    name.textContent = project.videoName
      ? "上次的文件是「" + project.videoName + "」。重新选择后才能预览，笔记还在。"
      : "还没有选择视频。";
  }

  function clearVideo() {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null;
    const player = $("player");
    player.removeAttribute("src");
    player.load();
  }

  function fill(project) {
    for (const name of fields) $(name).value = project[name];
    $("mark-time").value = "";
    $("mark-text").value = "";
    $("mark-hint").hidden = true;
    showVideoStatus(project);
    renderMarks(project);
    renderCriteria(project);
    renderList();
    setBusy(true);
  }

  function selectProject(id) {
    if (id === state.activeId) return;
    state.activeId = id;
    clearVideo();
    persist();
    const project = active();
    if (project) fill(project);
  }

  function seek(time) {
    const player = $("player");
    $("mark-time").value = formatTime(time);
    if (!player.src) return;
    player.currentTime = time;
    player.play().catch(() => {});
  }

  function createProject() {
    const project = normalize({
      id: uid(),
      title: "未命名成片",
      editor: "",
      reviewer: "",
      summary: "",
      criteria: blankCriteria(),
      marks: [],
      createdAt: stamp(),
      updatedAt: stamp(),
    });
    state.projects.unshift(project);
    state.activeId = project.id;
    clearVideo();
    persist();
    fill(project);
    $("title").focus();
    $("title").select();
  }

  function removeProject() {
    const project = active();
    if (!project) return;
    if (!confirm("删除「" + project.title + "」？这只会清掉这台浏览器里的评分。")) return;
    state.projects = state.projects.filter((item) => item.id !== project.id);
    state.activeId = state.projects[0] ? state.projects[0].id : null;
    clearVideo();
    persist();
    render();
  }

  function exportJson() {
    const project = active();
    if (!project) return;
    const payload = {
      app: "pin-",
      exportedAt: stamp(),
      project,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    const safe = project.title.replace(/[\\/:*?"<>|]+/g, " ").trim() || "score";
    link.href = URL.createObjectURL(blob);
    link.download = safe.slice(0, 60) + ".json";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function importProjects(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        const incoming = Array.isArray(data) ? data : data.projects || data.project || data;
        const list = (Array.isArray(incoming) ? incoming : [incoming])
          .filter((item) => item && typeof item === "object" && (item.title || item.criteria || item.marks || item.summary))
          .map(normalize)
          .filter(Boolean);
        if (!list.length) throw new Error("empty");
        for (const project of list) {
          project.id = uid();
          project.sample = false;
          project.updatedAt = stamp();
          state.projects.unshift(project);
        }
        state.activeId = state.projects[0].id;
        clearVideo();
        persist();
        render();
      } catch {
        $("mark-hint").hidden = false;
        $("mark-hint").textContent = "这个 JSON 不是 pin- 的评分单。";
      }
    };
    reader.readAsText(file);
  }

  function bindFields() {
    for (const name of fields) {
      $(name).addEventListener("input", () => {
        const project = active();
        if (!project) return;
        project[name] = text($(name).value, name === "summary" ? 1000 : name === "title" ? 80 : 40);
        if (name === "title" && !project.title.trim()) project.title = "未命名成片";
        touch(project);
        persist();
        if (name === "title" || name === "editor") renderList();
      });
    }
  }

  function render() {
    renderList();
    const project = active();
    setBusy(Boolean(project));
    if (!project) {
      clearVideo();
      return;
    }
    fill(project);
  }

  function boot() {
    const saved = load();
    if (!saved) {
      const sample = normalize(sampleProject());
      state = { projects: [sample], activeId: sample.id };
      persist();
    } else {
      const projects = saved.projects.map(normalize).filter(Boolean);
      const activeId = projects.some((project) => project.id === saved.activeId) ? saved.activeId : projects[0] && projects[0].id;
      state = { projects, activeId: activeId || null };
    }

    bindFields();
    $("new-project").addEventListener("click", createProject);
    $("delete-project").addEventListener("click", removeProject);
    $("export-json").addEventListener("click", exportJson);
    $("print-sheet").addEventListener("click", () => window.print());
    $("import-json").addEventListener("change", (event) => {
      const file = event.target.files && event.target.files[0];
      event.target.value = "";
      if (file) importProjects(file);
    });
    $("video-file").addEventListener("change", (event) => {
      const project = active();
      const file = event.target.files && event.target.files[0];
      event.target.value = "";
      if (!project || !file) return;
      clearVideo();
      objectUrl = URL.createObjectURL(file);
      $("player").src = objectUrl;
      project.videoName = text(file.name, 180);
      touch(project);
      persist();
      showVideoStatus(project);
    });
    $("capture-time").addEventListener("click", () => {
      const player = $("player");
      const hint = $("mark-hint");
      if (!player.src || !Number.isFinite(player.currentTime)) {
        hint.hidden = false;
        hint.textContent = "还没有视频。可以直接把时间码打在左边，例如 1:02.5。";
        return;
      }
      hint.hidden = true;
      $("mark-time").value = formatTime(player.currentTime);
      $("mark-text").focus();
    });
    $("mark-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const project = active();
      if (!project) return;
      const time = parseTime($("mark-time").value);
      const hint = $("mark-hint");
      if (time === null) {
        hint.hidden = false;
        hint.textContent = "时间格式用秒，或分:秒，例如 75 或 1:15.0。";
        return;
      }
      hint.hidden = true;
      project.marks.push({ id: uid(), time, text: text($("mark-text").value.trim(), 240) });
      project.marks.sort((a, b) => a.time - b.time);
      $("mark-text").value = "";
      touch(project);
      persist();
      renderMarks(project);
    });
    $("reset-scores").addEventListener("click", () => {
      const project = active();
      if (!project) return;
      for (const item of project.criteria) item.score = 0;
      touch(project);
      persist();
      renderCriteria(project);
      renderList();
    });
    $("reset-weights").addEventListener("click", () => {
      const project = active();
      if (!project) return;
      for (const item of project.criteria) {
        const template = CRITERIA_TEMPLATE.find((entry) => entry.key === item.key);
        item.weight = template ? template.weight : item.weight;
      }
      touch(project);
      persist();
      renderCriteria(project);
      renderList();
    });

    render();
  }

  boot();
})();
