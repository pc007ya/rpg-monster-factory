(() => {
  "use strict";

  const state = {
    monsters: [],
    current: null,
    lastPrompt: "",
  };

  let els = {};

  function boot() {
    els = {
      jsonFiles: document.getElementById("jsonFiles"),
      loadSamplesBtn: document.getElementById("loadSamplesBtn"),
      backendBase: document.getElementById("backendBase"),
      statusBox: document.getElementById("statusBox"),
      monsterGrid: document.getElementById("monsterGrid"),
      detail: document.getElementById("detail"),
      backBtn: document.getElementById("backBtn"),
      deepResearchBtn: document.getElementById("deepResearchBtn"),
      copyPromptBtn: document.getElementById("copyPromptBtn"),
      monsterName: document.getElementById("monsterName"),
      appearance: document.getElementById("appearance"),
      monsterMeta: document.getElementById("monsterMeta"),
      promptOutput: document.getElementById("promptOutput"),
      referencePreview: document.getElementById("referencePreview"),
      referenceFile: document.getElementById("referenceFile"),
      actionEditor: document.getElementById("actionEditor"),
      jsonView: document.getElementById("jsonView"),
    };

    const required = [
      "jsonFiles", "loadSamplesBtn", "statusBox", "monsterGrid", "detail",
      "backBtn", "deepResearchBtn", "copyPromptBtn", "monsterName",
      "appearance", "monsterMeta", "promptOutput", "referencePreview",
      "referenceFile", "actionEditor", "jsonView"
    ];

    for (const key of required) {
      if (!els[key]) {
        throw new Error(`缺少必要 DOM 元素：${key}`);
      }
    }

    bindEvents();
    renderGrid();

    window.__RPGMF = {
      state,
      renderGrid,
      loadSamples,
      openMonster,
      buildCreationPrompt,
      debug: {
        resolveUrl,
        showStatus,
      },
    };

    console.info("[RPGMF] boot ok", {
      href: location.href,
      baseURI: document.baseURI,
    });

    showStatus("info", "頁面已載入。可先按「載入倉庫範例」驗證離線功能。");
  }

  function bindEvents() {
    els.jsonFiles.addEventListener("change", onJsonFilesChange);
    els.loadSamplesBtn.addEventListener("click", loadSamples);
    els.referenceFile.addEventListener("change", onReferenceFileChange);
    els.backBtn.addEventListener("click", renderGrid);
    els.deepResearchBtn.addEventListener("click", onDeepResearchClick);
    els.copyPromptBtn.addEventListener("click", copyPromptToClipboard);

    window.addEventListener("error", (event) => {
      console.error("[RPGMF] window error", event.error || event.message);
      showStatus("error", `JavaScript 錯誤：${event.message || "未知錯誤"}`);
    });

    window.addEventListener("unhandledrejection", (event) => {
      console.error("[RPGMF] unhandled rejection", event.reason);
      showStatus("error", `Promise 失敗：${String(event.reason)}`);
    });
  }

  function resolveUrl(relativePath) {
    return new URL(relativePath, document.baseURI).href;
  }

  function showStatus(level, message) {
    els.statusBox.className = `status show ${level}`;
    els.statusBox.textContent = message;
  }

  function clearStatus() {
    els.statusBox.className = "status";
    els.statusBox.textContent = "";
  }

  function validateMonster(data) {
    if (!data || typeof data !== "object") throw new Error("JSON 格式錯誤");
    if (!data.name) throw new Error("缺少 name");
    if (!data.sprite_request || !Array.isArray(data.sprite_request.actions) || !data.sprite_request.actions.length) {
      throw new Error("缺少 sprite_request.actions");
    }
    return data;
  }

  function addMonster(data) {
    const monster = validateMonster(data);
    const existingIndex = state.monsters.findIndex((x) => x.name === monster.name);
    if (existingIndex >= 0) {
      state.monsters[existingIndex] = monster;
    } else {
      state.monsters.push(monster);
    }
  }

  async function onJsonFilesChange() {
    clearStatus();
    const files = Array.from(els.jsonFiles.files || []);
    if (!files.length) {
      showStatus("warn", "尚未選擇任何 JSON 檔案。");
      return;
    }

    let loaded = 0;
    for (const file of files) {
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        addMonster(parsed);
        loaded += 1;
      } catch (error) {
        console.error("[RPGMF] JSON parse failed", file.name, error);
        showStatus("error", `${file.name} 讀取失敗：${error.message}`);
      }
    }

    renderGrid();
    if (loaded > 0) {
      showStatus("success", `已匯入 ${loaded} 個 JSON。`);
    }
  }

  async function loadSamples() {
    clearStatus();
    const samplePaths = [
      "data/inbox/ai-art-草靈.json",
      "data/inbox/ai-art-雲鶴.json",
      "data/inbox/ai-art-幻蝶.json",
    ];

    let loaded = 0;
    const errors = [];

    for (const rel of samplePaths) {
      const url = resolveUrl(rel);
      try {
        console.info("[RPGMF] fetch sample", url);
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }
        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("application/json") && !contentType.includes("text/plain")) {
          console.warn("[RPGMF] unexpected content-type", contentType, url);
        }
        const json = await response.json();
        addMonster(json);
        loaded += 1;
      } catch (error) {
        console.error("[RPGMF] sample fetch failed", url, error);
        errors.push(`${rel}: ${error.message}`);
      }
    }

    renderGrid();

    if (loaded > 0) {
      const msg = [`已載入 ${loaded} 份範例 JSON。`];
      if (errors.length) {
        msg.push("", "部分失敗：", ...errors);
      }
      showStatus(errors.length ? "warn" : "success", msg.join("\n"));
      return;
    }

    showStatus(
      "error",
      [
        "找不到任何範例 JSON。",
        "請檢查：",
        "1) data/inbox 是否已提交到 repo",
        "2) 你是不是在 file:// 而不是 http://localhost 或 GitHub Pages 上測試",
        "3) 路徑是否正確",
        "",
        ...errors,
      ].join("\n")
    );
  }

  function renderGrid() {
    state.current = null;
    els.detail.classList.add("hidden");
    els.monsterGrid.classList.remove("hidden");
    els.monsterGrid.innerHTML = "";
    els.promptOutput.value = "";
    state.lastPrompt = "";

    if (!state.monsters.length) {
      els.monsterGrid.innerHTML = `
        <div class="card">
          <h2>尚未匯入怪物</h2>
          <p>可選擇一個或多個 JSON，或按「載入倉庫範例」。</p>
        </div>
      `;
      return;
    }

    for (const monster of state.monsters) {
      const card = document.createElement("article");
      card.className = "card";

      const actionTags = monster.sprite_request.actions
        .map((a) => `<span class="tag">${escapeHtml(a.slot)}: ${Number(a.frames) || 0} frames</span>`)
        .join("");

      card.innerHTML = `
        <h2>${escapeHtml(monster.name)}</h2>
        <p>${escapeHtml(monster.appearance || "")}</p>
        <div class="meta">
          <span>Lv.${monster.level ?? "-"}</span>
          <span>${escapeHtml(monster.element || "")}</span>
          <span>弱點 ${escapeHtml(monster.weakness || "-")}</span>
        </div>
        <div class="actions">${actionTags}</div>
        <p><button type="button">開啟製作</button></p>
      `;

      card.querySelector("button").addEventListener("click", () => openMonster(monster));
      els.monsterGrid.appendChild(card);
    }
  }

  function openMonster(monster) {
    state.current = monster;

    els.monsterGrid.classList.add("hidden");
    els.detail.classList.remove("hidden");

    els.monsterName.textContent = monster.name;
    els.appearance.textContent = monster.appearance || "";
    els.monsterMeta.innerHTML = `
      <span>等級 ${monster.level ?? "-"}</span>
      <span>元素 ${escapeHtml(monster.element || "-")}</span>
      <span>弱點 ${escapeHtml(monster.weakness || "-")}</span>
    `;
    els.jsonView.textContent = JSON.stringify(monster, null, 2);
    els.referencePreview.innerHTML = "尚未選擇圖片";
    els.promptOutput.value = "";
    state.lastPrompt = "";

    renderActions(monster);
    showStatus("info", `已開啟 ${monster.name}。可先產生 prompt，再上傳圖像做預覽 / 拆幀。`);
  }

  async function onReferenceFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) {
      showStatus("warn", "尚未選擇角色圖片。");
      return;
    }

    try {
      const img = await loadImageFromFile(file);
      els.referencePreview.innerHTML = "";
      els.referencePreview.appendChild(img);
      showStatus("success", `已載入角色圖片：${file.name}`);
    } catch (error) {
      console.error("[RPGMF] reference preview failed", error);
      showStatus("error", `角色圖片載入失敗：${error.message}`);
    }
  }

  function renderActions(monster) {
    els.actionEditor.innerHTML = "";

    for (const action of monster.sprite_request.actions) {
      const section = document.createElement("section");
      section.className = "card";
      section.style.marginBottom = "14px";

      section.innerHTML = `
        <h3>${escapeHtml(action.slot)} · ${Number(action.frames) || 0} frames</h3>
        <input class="sheetInput" type="file" accept="image/png,image/jpeg,image/webp">
        <p>
          <button class="splitBtn" type="button" disabled>切割 Frames</button>
        </p>
        <img class="sheet hidden" alt="sprite sheet preview">
        <div class="frames"></div>
        <p class="error-text"></p>
      `;

      const input = section.querySelector(".sheetInput");
      const splitBtn = section.querySelector(".splitBtn");
      const sheetImg = section.querySelector(".sheet");
      const framesEl = section.querySelector(".frames");
      const errorEl = section.querySelector(".error-text");

      let loadedImage = null;

      input.addEventListener("change", async () => {
        errorEl.textContent = "";
        framesEl.innerHTML = "";

        const file = input.files?.[0];
        if (!file) {
          splitBtn.disabled = true;
          return;
        }

        try {
          loadedImage = await loadImageFromFile(file);
          sheetImg.src = loadedImage.src;
          sheetImg.classList.remove("hidden");
          splitBtn.disabled = false;
          showStatus("success", `已載入 ${action.slot} 的 Sprite Sheet：${file.name}`);
        } catch (error) {
          console.error("[RPGMF] sheet load failed", error);
          loadedImage = null;
          splitBtn.disabled = true;
          errorEl.textContent = `圖片載入失敗：${error.message}`;
          showStatus("error", `Sprite Sheet 載入失敗：${error.message}`);
        }
      });

      splitBtn.addEventListener("click", () => {
        errorEl.textContent = "";
        framesEl.innerHTML = "";

        try {
          if (!loadedImage) {
            throw new Error("請先選擇 Sprite Sheet 圖片");
          }

          const frameCount = Number(action.frames) || 0;
          if (frameCount <= 0) {
            throw new Error("frames 必須大於 0");
          }

          if (loadedImage.naturalWidth % frameCount !== 0) {
            throw new Error(
              `圖片寬度 ${loadedImage.naturalWidth}px 無法整除 ${frameCount} 幀`
            );
          }

          const frameWidth = loadedImage.naturalWidth / frameCount;
          const frameHeight = loadedImage.naturalHeight;

          for (let i = 0; i < frameCount; i++) {
            const canvas = document.createElement("canvas");
            canvas.width = frameWidth;
            canvas.height = frameHeight;

            const ctx = canvas.getContext("2d");
            ctx.drawImage(
              loadedImage,
              i * frameWidth, 0, frameWidth, frameHeight,
              0, 0, frameWidth, frameHeight
            );

            const img = document.createElement("img");
            const filename = `${action.slot}_${String(i).padStart(2, "0")}.png`;
            img.src = canvas.toDataURL("image/png");
            img.title = filename;
            img.alt = filename;
            img.addEventListener("click", () => downloadDataUrl(img.src, filename));
            framesEl.appendChild(img);
          }

          showStatus("success", `${action.slot} 已成功切割為 ${frameCount} 幀。`);
        } catch (error) {
          console.error("[RPGMF] split failed", error);
          errorEl.textContent = error.message;
          showStatus("error", `切幀失敗：${error.message}`);
        }
      });

      els.actionEditor.appendChild(section);
    }
  }

  function buildCreationPrompt(monster) {
    const actions = (monster.sprite_request?.actions || [])
      .map((a) => `${a.slot} ${a.frames} frames`)
      .join(", ");

    return [
      `請為 RPG 怪物生成角色概念圖與後續 sprite 動畫參考。`,
      ``,
      `名稱：${monster.name}`,
      `類型：${monster.type || "unknown"}`,
      `等級：${monster.level ?? "-"}`,
      `元素：${monster.element || "-"}`,
      `弱點：${monster.weakness || "-"}`,
      `外觀：${monster.appearance || "-"}`,
      `風格：${monster.style || "-"}`,
      ``,
      `Sprite 規格：`,
      `- 畫布：${monster.sprite_request?.canvas || "-"}`,
      `- 版面：${monster.sprite_request?.layout || "-"}`,
      `- 動作：${actions || "-"}`,
      ``,
      `要求：`,
      `- 保持角色造型一致`,
      `- 可先輸出角色定稿，再延伸各動作`,
      `- 避免主體使用綠幕近似色`,
      `- 以單一角色、清楚輪廓、利於後續切幀為優先`,
    ].join("\n");
  }

  async function onDeepResearchClick(event) {
    event.preventDefault();

    if (!state.current) {
      showStatus("warn", "請先開啟一隻怪物。");
      return;
    }

    const prompt = buildCreationPrompt(state.current);
    state.lastPrompt = prompt;
    els.promptOutput.value = prompt;

    const backendBase = (els.backendBase.value || "").trim();
    if (!backendBase) {
      showStatus(
        "warn",
        [
          "目前未設定後端。",
          "GitHub Pages 不應放 API key；因此這裡改為離線 fallback：只產生 prompt，不直接呼叫 AI。",
          "如要真正生圖，請填入安全後端位址，或把此 prompt 複製到你自己的後端服務。",
        ].join("\n")
      );
      return;
    }

    let endpoint;
    try {
      endpoint = new URL("/api/generate-image", backendBase).href;
    } catch (error) {
      showStatus("error", `後端網址格式錯誤：${error.message}`);
      return;
    }

    showStatus("info", `正在嘗試呼叫後端：${endpoint}`);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          monster: state.current,
          prompt,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get("content-type") || "";
      let payload;

      if (contentType.includes("application/json")) {
        payload = await response.json();
      } else {
        payload = { raw: await response.text() };
      }

      els.promptOutput.value = JSON.stringify(payload, null, 2);
      showStatus("success", "後端請求成功。已顯示回應內容。");
    } catch (error) {
      console.error("[RPGMF] backend fetch failed", endpoint, error);
      showStatus(
        "warn",
        [
          `後端不可達或請求失敗：${error.message}`,
          "已保留 prompt，你仍可手動複製並交給安全後端。",
          "若這是在 GitHub Pages 上發生，請優先檢查 CORS、HTTPS、API 路徑與後端存活狀態。",
        ].join("\n")
      );
    }
  }

  async function copyPromptToClipboard() {
    const value = els.promptOutput.value || state.lastPrompt || "";
    if (!value) {
      showStatus("warn", "目前沒有可複製的提示詞。");
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      showStatus("success", "已複製提示詞到剪貼簿。");
    } catch (error) {
      console.error("[RPGMF] clipboard failed", error);
      showStatus("warn", "無法自動複製，請手動選取文字複製。");
    }
  }

  function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();

      img.onload = () => {
        resolve(img);
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error(`圖片無法載入：${file.name}`));
      };

      img.src = objectUrl;
    });
  }

  function downloadDataUrl(url, filename) {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (s) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[s]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
