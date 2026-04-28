const http = require("http");
const https = require("https");
const { URL } = require("url");
const { randomUUID } = require("crypto");
const { readDb, updateDb, resetDb } = require("./lib/store");

const PORT = Number(process.env.PORT || 8787);
const WECHAT_APPID = process.env.WECHAT_APPID || "";
const WECHAT_APP_SECRET = process.env.WECHAT_APP_SECRET || "";

function getDaysLeft(dateLike, now = new Date()) {
  if (!dateLike) return Number.POSITIVE_INFINITY;
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return Number.POSITIVE_INFINITY;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  return Math.ceil((end - start) / 86400000);
}

function getRecordDate(record) {
  if (record.type === "vaccine") return record.vaccinatedAt;
  if (record.type === "deworm") return record.executedAt;
  return record.recordedAt;
}

function sortRecords(records) {
  return [...records].sort((a, b) => getRecordDate(b).localeCompare(getRecordDate(a)));
}

function getCurrentPet(db) {
  return db.pets.find((item) => item.id === db.auth.currentPetId) || db.pets[0];
}

function getLatestWeight(records) {
  return records
    .filter((item) => item.type === "weight")
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0];
}

function getLatestRecord(records) {
  return sortRecords(records)[0];
}

function getUpcomingReminder(pet, records) {
  return records
    .filter((item) => item.type === "vaccine" || item.type === "deworm")
    .map((item) => ({
      id: item.id,
      petId: pet.id,
      title:
        item.type === "vaccine"
          ? `${pet.name} 的${item.vaccineName}提醒`
          : `${pet.name} 的${item.mode === "internal" ? "体内" : "体外"}驱虫提醒`,
      dueDate: item.nextDueAt || "",
      daysLeft: getDaysLeft(item.nextDueAt)
    }))
    .filter((item) => Number.isFinite(item.daysLeft))
    .sort((a, b) => a.daysLeft - b.daysLeft)[0];
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
  });
  res.end(JSON.stringify(payload));
}

function sendError(res, statusCode, message) {
  sendJson(res, statusCode, { message });
}

function shouldUseRealWechatLogin() {
  return Boolean(WECHAT_APPID && WECHAT_APP_SECRET);
}

function fetchWechatSession(code) {
  return new Promise((resolve, reject) => {
    const query = new URLSearchParams({
      appid: WECHAT_APPID,
      secret: WECHAT_APP_SECRET,
      js_code: code,
      grant_type: "authorization_code"
    }).toString();

    https
      .get(`https://api.weixin.qq.com/sns/jscode2session?${query}`, (response) => {
        let raw = "";
        response.on("data", (chunk) => {
          raw += chunk;
        });
        response.on("end", () => {
          try {
            const parsed = JSON.parse(raw || "{}");
            if (!parsed.openid || parsed.errcode) {
              reject(new Error(parsed.errmsg || "微信登录校验失败"));
              return;
            }
            resolve(parsed);
          } catch (error) {
            reject(error);
          }
        });
      })
      .on("error", reject);
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

async function handleRequest(req, res) {
  if (!req.url || !req.method) {
    sendError(res, 400, "无效请求");
    return;
  }

  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);
  const pathname = url.pathname;

  if (pathname === "/health" && req.method === "GET") {
    sendJson(res, 200, { ok: true, service: "xiaomaolaile-backend" });
    return;
  }

  if (pathname === "/api/debug/reset" && req.method === "POST") {
    const db = resetDb();
    sendJson(res, 200, db);
    return;
  }

  if (pathname === "/api/auth/state" && req.method === "GET") {
    sendJson(res, 200, readDb().auth);
    return;
  }

  if (pathname === "/api/auth/login/wechat" && req.method === "POST") {
    const body = await readBody(req);
    if (shouldUseRealWechatLogin()) {
      if (!body.code) {
        sendError(res, 400, "缺少微信登录 code");
        return;
      }
      await fetchWechatSession(String(body.code));
    }

    const db = updateDb((draft) => {
      draft.auth.isLoggedIn = true;
      draft.auth.user.nickname = draft.auth.user.nickname || "微信用户";
      draft.auth.user.avatarText = draft.auth.user.avatarText || "微";
      return draft;
    });
    sendJson(res, 200, db.auth);
    return;
  }

  if (pathname === "/api/auth/logout" && req.method === "POST") {
    const db = updateDb((draft) => {
      draft.auth.isLoggedIn = false;
      draft.auth.hasCompletedOnboarding = false;
      return draft;
    });
    sendJson(res, 200, db.auth);
    return;
  }

  if (pathname === "/api/auth/complete-onboarding" && req.method === "POST") {
    const db = updateDb((draft) => {
      draft.auth.hasCompletedOnboarding = true;
      return draft;
    });
    sendJson(res, 200, db.auth);
    return;
  }

  if (pathname === "/api/home" && req.method === "GET") {
    const db = readDb();
    const currentPet = getCurrentPet(db);
    const records = db.records.filter((item) => item.petId === currentPet.id);
    sendJson(res, 200, {
      currentPet,
      reminder: getUpcomingReminder(currentPet, records),
      latestWeight: getLatestWeight(records),
      latestRecord: getLatestRecord(records),
      petCount: db.pets.length,
      familyMemberCount: db.members.length
    });
    return;
  }

  if (pathname === "/api/pets" && req.method === "GET") {
    sendJson(res, 200, readDb().pets);
    return;
  }

  if (pathname === "/api/pets/current" && req.method === "POST") {
    const body = await readBody(req);
    if (!body.petId) {
      sendError(res, 400, "缺少 petId");
      return;
    }
    updateDb((draft) => {
      if (draft.pets.some((item) => item.id === body.petId)) {
        draft.auth.currentPetId = body.petId;
      }
      return draft;
    });
    sendJson(res, 200, { ok: true });
    return;
  }

  if (pathname === "/api/pets" && req.method === "POST") {
    const body = await readBody(req);
    const db = updateDb((draft) => {
      if (body.id) {
        draft.pets = draft.pets.map((item) => (item.id === body.id ? { ...item, ...body } : item));
        return draft;
      }
      const pet = {
        id: `pet_${randomUUID().slice(0, 8)}`,
        familyId: "family_1",
        ...body
      };
      draft.pets.unshift(pet);
      draft.auth.currentPetId = pet.id;
      return draft;
    });
    const pet = body.id
      ? db.pets.find((item) => item.id === body.id)
      : db.pets[0];
    sendJson(res, 200, pet);
    return;
  }

  if (pathname.startsWith("/api/pets/") && req.method === "GET") {
    const petId = pathname.split("/").pop();
    const db = readDb();
    const pet = db.pets.find((item) => item.id === petId) || getCurrentPet(db);
    const petRecords = sortRecords(db.records.filter((item) => item.petId === pet.id));
    sendJson(res, 200, {
      pet,
      latestWeight: getLatestWeight(petRecords),
      vaccines: petRecords.filter((item) => item.type === "vaccine"),
      deworms: petRecords.filter((item) => item.type === "deworm"),
      weights: petRecords.filter((item) => item.type === "weight")
    });
    return;
  }

  if (pathname === "/api/records" && req.method === "GET") {
    const petId = url.searchParams.get("petId");
    const type = url.searchParams.get("type");
    const records = sortRecords(
      readDb().records.filter((item) => {
        const petMatch = petId ? item.petId === petId : true;
        const typeMatch = type && type !== "all" ? item.type === type : true;
        return petMatch && typeMatch;
      })
    );
    sendJson(res, 200, records);
    return;
  }

  if (pathname === "/api/records" && req.method === "POST") {
    const body = await readBody(req);
    if (!body.petId || !body.type) {
      sendError(res, 400, "缺少记录必要字段");
      return;
    }

    let savedRecord = null;
    updateDb((draft) => {
      const baseId = `rec_${randomUUID().slice(0, 8)}`;
      if (body.type === "vaccine") {
        savedRecord = {
          id: baseId,
          petId: body.petId,
          type: "vaccine",
          vaccineName: body.vaccineName || "疫苗",
          vaccinatedAt: body.vaccinatedAt || "",
          nextDueAt: body.nextDueAt,
          note: body.note
        };
      } else if (body.type === "deworm") {
        savedRecord = {
          id: baseId,
          petId: body.petId,
          type: "deworm",
          mode: body.mode || "internal",
          brand: body.brand || "",
          executedAt: body.executedAt || "",
          nextDueAt: body.nextDueAt,
          note: body.note
        };
      } else {
        savedRecord = {
          id: baseId,
          petId: body.petId,
          type: "weight",
          weightKg: Number(body.weightKg || 0),
          recordedAt: body.recordedAt || "",
          note: body.note
        };
      }

      draft.records.unshift(savedRecord);
      return draft;
    });

    sendJson(res, 200, savedRecord);
    return;
  }

  if (pathname.startsWith("/api/records/") && req.method === "GET") {
    const recordId = pathname.split("/").pop();
    const record = readDb().records.find((item) => item.id === recordId);
    if (!record) {
      sendError(res, 404, "记录不存在");
      return;
    }
    sendJson(res, 200, record);
    return;
  }

  if (pathname.startsWith("/api/records/") && pathname.endsWith("/delete") && req.method === "POST") {
    const recordId = pathname.split("/")[3];
    updateDb((draft) => {
      draft.records = draft.records.filter((item) => item.id !== recordId);
      return draft;
    });
    sendJson(res, 200, { ok: true });
    return;
  }

  if (pathname.startsWith("/api/records/") && req.method === "POST") {
    const recordId = pathname.split("/").pop();
    const body = await readBody(req);
    let updatedRecord = null;

    const db = updateDb((draft) => {
      const existing = draft.records.find((item) => item.id === recordId);
      if (!existing) {
        throw new Error("记录不存在");
      }

      if (body.type === "vaccine") {
        updatedRecord = {
          ...existing,
          id: recordId,
          petId: body.petId,
          type: "vaccine",
          vaccineName: body.vaccineName || "疫苗",
          vaccinatedAt: body.vaccinatedAt || "",
          nextDueAt: body.nextDueAt,
          note: body.note
        };
      } else if (body.type === "deworm") {
        updatedRecord = {
          ...existing,
          id: recordId,
          petId: body.petId,
          type: "deworm",
          mode: body.mode || "internal",
          brand: body.brand || "",
          executedAt: body.executedAt || "",
          nextDueAt: body.nextDueAt,
          note: body.note
        };
      } else {
        updatedRecord = {
          ...existing,
          id: recordId,
          petId: body.petId,
          type: "weight",
          weightKg: Number(body.weightKg || 0),
          recordedAt: body.recordedAt || "",
          note: body.note
        };
      }

      draft.records = draft.records.map((item) => (item.id === recordId ? updatedRecord : item));
      return draft;
    });

    const record = updatedRecord || db.records.find((item) => item.id === recordId);
    sendJson(res, 200, record);
    return;
  }

  if (pathname === "/api/family-members" && req.method === "GET") {
    sendJson(res, 200, readDb().members);
    return;
  }

  if (pathname === "/api/reminder-settings" && req.method === "GET") {
    sendJson(res, 200, readDb().reminderSettings);
    return;
  }

  if (pathname === "/api/reminder-settings" && req.method === "POST") {
    const body = await readBody(req);
    const db = updateDb((draft) => {
      draft.reminderSettings = {
        vaccineEnabled: Boolean(body.vaccineEnabled),
        dewormEnabled: Boolean(body.dewormEnabled),
        leadDays: Number(body.leadDays || 0)
      };
      return draft;
    });
    sendJson(res, 200, db.reminderSettings);
    return;
  }

  if (pathname === "/api/invite" && req.method === "GET") {
    const db = readDb();
    const pet = getCurrentPet(db);
    sendJson(res, 200, {
      familyName: `${pet.name} 的家庭`,
      inviteCode: "CAT-2026",
      expiresHint: "24 小时内有效",
      memberCount: db.members.length
    });
    return;
  }

  if (pathname === "/api/invite/join" && req.method === "POST") {
    const body = await readBody(req);
    if (!body.code) {
      sendError(res, 400, "缺少邀请码");
      return;
    }
    if (String(body.code).trim().toUpperCase() !== "CAT-2026") {
      sendError(res, 400, "邀请码无效");
      return;
    }

    const db = updateDb((draft) => {
      const nextIndex = draft.members.length + 1;
      const member = {
        id: `member_${randomUUID().slice(0, 8)}`,
        familyId: "family_1",
        displayName: String(body.displayName || "").trim() || `家人${nextIndex}`,
        role: "member",
        joinedAt: new Date().toISOString().slice(0, 10)
      };
      draft.members.push(member);
      return draft;
    });

    const member = db.members[db.members.length - 1];
    sendJson(res, 200, {
      ok: true,
      memberId: member.id,
      memberCount: db.members.length
    });
    return;
  }

  sendError(res, 404, `未找到接口: ${pathname}`);
}

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    console.error(error);
    sendError(res, 500, error.message || "服务器异常");
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`xiaomaolaile backend listening on http://127.0.0.1:${PORT}`);
});
