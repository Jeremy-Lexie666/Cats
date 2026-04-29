const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const { randomUUID } = require("crypto");
const { readDb, updateDb, resetDb } = require("./lib/store");

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "127.0.0.1";
const WECHAT_APPID = process.env.WECHAT_APPID || "";
const WECHAT_APP_SECRET = process.env.WECHAT_APP_SECRET || "";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ADMIN_DIR = path.join(__dirname, "admin");

const EMPTY_AUTH_STATE = {
  isLoggedIn: false,
  currentPetId: "",
  hasCompletedOnboarding: false,
  user: {
    id: "",
    nickname: "",
    avatarText: ""
  }
};

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

function getUserById(db, userId) {
  return (db.users || []).find((item) => item.id === userId);
}

function getUserByIdentityHint(db, identityHint) {
  return (db.users || []).find((item) => item.identityHint === identityHint);
}

function getFamilyById(db, familyId) {
  return (db.families || []).find((item) => item.id === familyId);
}

function getFamilyPets(db, familyId) {
  return (db.pets || []).filter((item) => item.familyId === familyId);
}

function getFamilyMembers(db, familyId) {
  return (db.members || []).filter((item) => item.familyId === familyId);
}

function getFamilyRecords(db, familyId) {
  const petIds = new Set(getFamilyPets(db, familyId).map((item) => item.id));
  return (db.records || []).filter((item) => petIds.has(item.petId));
}

function getCurrentPetForUser(db, user) {
  if (!user) return undefined;
  const pets = getFamilyPets(db, user.familyId);
  return pets.find((item) => item.id === user.currentPetId) || pets[0];
}

function getReminderSettingsForFamily(db, familyId) {
  return (
    (db.familyReminderSettings || []).find((item) => item.familyId === familyId) || {
      familyId,
      vaccineEnabled: true,
      dewormEnabled: true,
      leadDays: 3
    }
  );
}

function getLatestWeight(records) {
  return records.filter((item) => item.type === "weight").sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0];
}

function getLatestRecord(records) {
  return sortRecords(records)[0];
}

function getUpcomingReminder(pet, records) {
  if (!pet) return undefined;
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
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
  });
  res.end(JSON.stringify(payload));
}

function sendError(res, statusCode, message) {
  sendJson(res, statusCode, { message });
}

function sendText(res, statusCode, contentType, body) {
  res.writeHead(statusCode, {
    "Content-Type": contentType,
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function isAdminAuthEnabled() {
  return Boolean(ADMIN_USERNAME && ADMIN_PASSWORD);
}

function getBasicAuthCredentials(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || typeof authHeader !== "string") return null;
  const matched = authHeader.match(/^Basic\s+(.+)$/i);
  if (!matched) return null;
  try {
    const decoded = Buffer.from(matched[1], "base64").toString("utf8");
    const separatorIndex = decoded.indexOf(":");
    if (separatorIndex < 0) return null;
    return {
      username: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1)
    };
  } catch {
    return null;
  }
}

function requireAdmin(req, res) {
  if (!isAdminAuthEnabled()) {
    return true;
  }
  const credentials = getBasicAuthCredentials(req);
  if (credentials && credentials.username === ADMIN_USERNAME && credentials.password === ADMIN_PASSWORD) {
    return true;
  }
  res.writeHead(401, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    "WWW-Authenticate": 'Basic realm="xiaomaolaile-admin"'
  });
  res.end("需要管理员认证");
  return false;
}

function serveStaticFile(res, filePath) {
  if (!fs.existsSync(filePath)) {
    sendError(res, 404, "文件不存在");
    return;
  }
  const ext = path.extname(filePath);
  const contentType =
    ext === ".html"
      ? "text/html; charset=utf-8"
      : ext === ".js"
        ? "text/javascript; charset=utf-8"
        : "text/css; charset=utf-8";
  sendText(res, 200, contentType, fs.readFileSync(filePath));
}

function buildAdminSnapshot() {
  const db = readDb();
  return {
    generatedAt: new Date().toISOString(),
    counts: {
      sessions: db.sessions.length,
      users: (db.users || []).length,
      families: (db.families || []).length,
      pets: db.pets.length,
      members: db.members.length,
      records: db.records.length
    },
    auth: db.auth,
    sessions: db.sessions,
    users: db.users || [],
    families: db.families || [],
    pets: db.pets,
    members: db.members,
    records: db.records,
    familyReminderSettings: db.familyReminderSettings || []
  };
}

function createSession(token, userId, identityHint, now = new Date()) {
  return {
    token,
    userId,
    identityHint,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS).toISOString()
  };
}

function createInviteCode() {
  return `CAT-${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
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

function getBearerToken(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || typeof authHeader !== "string") return "";
  const matched = authHeader.match(/^Bearer\s+(.+)$/i);
  return matched ? matched[1].trim() : "";
}

function buildAuthStateFromUser(db, user, token) {
  const session = Array.isArray(db.sessions) ? db.sessions.find((item) => item.token === token) : undefined;
  if (!user) {
    return {
      ...EMPTY_AUTH_STATE,
      sessionToken: token || undefined,
      sessionExpiresAt: session?.expiresAt
    };
  }
  return {
    isLoggedIn: true,
    currentPetId: user.currentPetId || "",
    hasCompletedOnboarding: Boolean(user.hasCompletedOnboarding),
    user: {
      id: user.id,
      nickname: user.nickname,
      avatarText: user.avatarText
    },
    sessionToken: token || undefined,
    sessionExpiresAt: session?.expiresAt
  };
}

function syncLegacyAuthState(draft, user, isLoggedIn) {
  draft.auth = {
    isLoggedIn: Boolean(isLoggedIn && user),
    currentPetId: user?.currentPetId || "",
    hasCompletedOnboarding: Boolean(user?.hasCompletedOnboarding),
    user: {
      id: user?.id || "",
      nickname: user?.nickname || "",
      avatarText: user?.avatarText || ""
    }
  };
}

function requireAuth(req, res) {
  const token = getBearerToken(req);
  if (!token) {
    sendError(res, 401, "未登录");
    return null;
  }

  const db = readDb();
  const sessions = Array.isArray(db.sessions) ? db.sessions : [];
  const session = sessions.find((item) => item.token === token);
  if (!session) {
    sendError(res, 401, "登录已失效");
    return null;
  }

  const expiresAtMs = new Date(session.expiresAt || "").getTime();
  if (!Number.isNaN(expiresAtMs) && expiresAtMs <= Date.now()) {
    updateDb((draft) => {
      draft.sessions = Array.isArray(draft.sessions) ? draft.sessions.filter((item) => item.token !== token) : [];
      syncLegacyAuthState(draft, undefined, false);
      return draft;
    });
    sendError(res, 401, "登录已过期");
    return null;
  }

  const user = getUserById(db, session.userId);
  if (!user) {
    sendError(res, 401, "账号不存在");
    return null;
  }

  return { db, token, session, user };
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

  if ((pathname === "/admin" || pathname === "/admin/") && req.method === "GET") {
    if (!requireAdmin(req, res)) return;
    serveStaticFile(res, path.join(ADMIN_DIR, "index.html"));
    return;
  }

  if (pathname === "/admin/app.js" && req.method === "GET") {
    if (!requireAdmin(req, res)) return;
    serveStaticFile(res, path.join(ADMIN_DIR, "app.js"));
    return;
  }

  if (pathname === "/admin/styles.css" && req.method === "GET") {
    if (!requireAdmin(req, res)) return;
    serveStaticFile(res, path.join(ADMIN_DIR, "styles.css"));
    return;
  }

  if (pathname === "/api/admin/snapshot" && req.method === "GET") {
    if (!requireAdmin(req, res)) return;
    sendJson(res, 200, buildAdminSnapshot());
    return;
  }

  if (pathname === "/api/admin/reset" && req.method === "POST") {
    if (!requireAdmin(req, res)) return;
    const db = resetDb();
    sendJson(res, 200, {
      ok: true,
      counts: {
        sessions: db.sessions.length,
        users: (db.users || []).length,
        families: (db.families || []).length,
        pets: db.pets.length,
        members: db.members.length,
        records: db.records.length
      }
    });
    return;
  }

  if (pathname === "/api/debug/reset" && req.method === "POST") {
    if (!requireAdmin(req, res)) return;
    const db = resetDb();
    sendJson(res, 200, db);
    return;
  }

  if (pathname === "/api/auth/state" && req.method === "GET") {
    const token = getBearerToken(req);
    if (!token) {
      sendJson(res, 200, { ...EMPTY_AUTH_STATE, sessionToken: undefined });
      return;
    }

    const authResult = requireAuth(req, res);
    if (!authResult) return;
    sendJson(res, 200, buildAuthStateFromUser(authResult.db, authResult.user, authResult.token));
    return;
  }

  if (pathname === "/api/auth/login/wechat" && req.method === "POST") {
    const body = await readBody(req);
    let identityHint = "wechat-dev-user";

    if (shouldUseRealWechatLogin()) {
      if (!body.code) {
        sendError(res, 400, "缺少微信登录 code");
        return;
      }
      const sessionInfo = await fetchWechatSession(String(body.code));
      identityHint = sessionInfo.openid;
    }

    const token = `sess_${randomUUID()}`;
    const today = new Date().toISOString().slice(0, 10);

    const db = updateDb((draft) => {
      draft.users = Array.isArray(draft.users) ? draft.users : [];
      draft.families = Array.isArray(draft.families) ? draft.families : [];
      draft.members = Array.isArray(draft.members) ? draft.members : [];
      draft.sessions = Array.isArray(draft.sessions) ? draft.sessions : [];
      draft.familyReminderSettings = Array.isArray(draft.familyReminderSettings) ? draft.familyReminderSettings : [];

      let user = draft.users.find((item) => item.identityHint === identityHint);
      if (!user) {
        const familyId = `family_${randomUUID().slice(0, 8)}`;
        const userId = `user_${randomUUID().slice(0, 8)}`;
        const inviteCode = createInviteCode();
        user = {
          id: userId,
          identityHint,
          nickname: "微信用户",
          avatarText: "微",
          familyId,
          currentPetId: "",
          hasCompletedOnboarding: false
        };
        draft.families.push({
          id: familyId,
          name: "我的猫咪家庭",
          inviteCode,
          createdAt: today
        });
        draft.users.push(user);
        draft.members.push({
          id: `member_${randomUUID().slice(0, 8)}`,
          userId,
          familyId,
          displayName: user.nickname,
          role: "owner",
          joinedAt: today
        });
        draft.familyReminderSettings.push({
          familyId,
          vaccineEnabled: true,
          dewormEnabled: true,
          leadDays: 3
        });
      }

      draft.sessions = draft.sessions
        .filter((item) => item.userId !== user.id)
        .concat([createSession(token, user.id, identityHint)]);
      syncLegacyAuthState(draft, user, true);
      return draft;
    });

    const user = getUserByIdentityHint(db, identityHint);
    sendJson(res, 200, buildAuthStateFromUser(db, user, token));
    return;
  }

  if (pathname === "/api/auth/logout" && req.method === "POST") {
    const authResult = requireAuth(req, res);
    if (!authResult) return;
    updateDb((draft) => {
      draft.sessions = Array.isArray(draft.sessions)
        ? draft.sessions.filter((item) => item.token !== authResult.token)
        : [];
      syncLegacyAuthState(draft, authResult.user, false);
      return draft;
    });
    sendJson(res, 200, { ...EMPTY_AUTH_STATE, sessionToken: undefined });
    return;
  }

  if (pathname === "/api/auth/complete-onboarding" && req.method === "POST") {
    const authResult = requireAuth(req, res);
    if (!authResult) return;
    const db = updateDb((draft) => {
      draft.users = draft.users.map((item) =>
        item.id === authResult.user.id
          ? {
              ...item,
              hasCompletedOnboarding: true
            }
          : item
      );
      const nextUser = draft.users.find((item) => item.id === authResult.user.id);
      syncLegacyAuthState(draft, nextUser, true);
      return draft;
    });
    const user = getUserById(db, authResult.user.id);
    sendJson(res, 200, buildAuthStateFromUser(db, user, authResult.token));
    return;
  }

  if (pathname === "/api/auth/refresh" && req.method === "POST") {
    const authResult = requireAuth(req, res);
    if (!authResult) return;
    const db = updateDb((draft) => {
      draft.sessions = Array.isArray(draft.sessions)
        ? draft.sessions.map((item) =>
            item.token === authResult.token
              ? {
                  ...item,
                  expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString()
                }
              : item
          )
        : [];
      syncLegacyAuthState(draft, authResult.user, true);
      return draft;
    });
    const user = getUserById(db, authResult.user.id);
    sendJson(res, 200, buildAuthStateFromUser(db, user, authResult.token));
    return;
  }

  if (pathname === "/api/invite/join" && req.method === "POST") {
    const authResult = requireAuth(req, res);
    if (!authResult) return;
    const body = await readBody(req);
    if (!body.code) {
      sendError(res, 400, "缺少邀请码");
      return;
    }

    const targetCode = String(body.code).trim().toUpperCase();
    const targetFamily = (authResult.db.families || []).find((item) => item.inviteCode === targetCode);
    if (!targetFamily) {
      sendError(res, 400, "邀请码无效");
      return;
    }

    if (targetFamily.id === authResult.user.familyId) {
      sendJson(res, 200, {
        ok: true,
        memberId: authResult.user.id,
        memberCount: getFamilyMembers(authResult.db, targetFamily.id).length
      });
      return;
    }

    const db = updateDb((draft) => {
      draft.users = draft.users.map((item) => {
        if (item.id !== authResult.user.id) return item;
        const firstPet = draft.pets.find((pet) => pet.familyId === targetFamily.id);
        return {
          ...item,
          familyId: targetFamily.id,
          currentPetId: firstPet?.id || "",
          hasCompletedOnboarding: Boolean(firstPet)
        };
      });

      draft.members = draft.members.filter((item) => item.userId !== authResult.user.id);
      const nextIndex = draft.members.filter((item) => item.familyId === targetFamily.id).length + 1;
      draft.members.push({
        id: `member_${randomUUID().slice(0, 8)}`,
        userId: authResult.user.id,
        familyId: targetFamily.id,
        displayName: String(body.displayName || "").trim() || `家人${nextIndex}`,
        role: "member",
        joinedAt: new Date().toISOString().slice(0, 10)
      });

      const nextUser = draft.users.find((item) => item.id === authResult.user.id);
      syncLegacyAuthState(draft, nextUser, true);
      return draft;
    });

    const user = getUserById(db, authResult.user.id);
    sendJson(res, 200, {
      ok: true,
      memberId: user.id,
      memberCount: getFamilyMembers(db, user.familyId).length
    });
    return;
  }

  const authResult = requireAuth(req, res);
  if (!authResult) return;

  if (pathname === "/api/home" && req.method === "GET") {
    const currentPet = getCurrentPetForUser(authResult.db, authResult.user);
    const currentPetRecords = currentPet
      ? authResult.db.records.filter((item) => item.petId === currentPet.id)
      : [];
    sendJson(res, 200, {
      currentPet,
      reminder: currentPet ? getUpcomingReminder(currentPet, currentPetRecords) : undefined,
      latestWeight: getLatestWeight(currentPetRecords),
      latestRecord: getLatestRecord(currentPetRecords),
      petCount: getFamilyPets(authResult.db, authResult.user.familyId).length,
      familyMemberCount: getFamilyMembers(authResult.db, authResult.user.familyId).length
    });
    return;
  }

  if (pathname === "/api/pets" && req.method === "GET") {
    sendJson(res, 200, getFamilyPets(authResult.db, authResult.user.familyId));
    return;
  }

  if (pathname === "/api/pets/current" && req.method === "POST") {
    const body = await readBody(req);
    if (!body.petId) {
      sendError(res, 400, "缺少 petId");
      return;
    }
    const targetPet = getFamilyPets(authResult.db, authResult.user.familyId).find((item) => item.id === body.petId);
    if (!targetPet) {
      sendError(res, 403, "无权切换该猫咪");
      return;
    }
    updateDb((draft) => {
      draft.users = draft.users.map((item) =>
        item.id === authResult.user.id
          ? {
              ...item,
              currentPetId: body.petId
            }
          : item
      );
      const nextUser = draft.users.find((item) => item.id === authResult.user.id);
      syncLegacyAuthState(draft, nextUser, true);
      return draft;
    });
    sendJson(res, 200, { ok: true });
    return;
  }

  if (pathname === "/api/pets" && req.method === "POST") {
    const body = await readBody(req);
    const db = updateDb((draft) => {
      if (body.id) {
        const existing = draft.pets.find((item) => item.id === body.id && item.familyId === authResult.user.familyId);
        if (!existing) {
          throw new Error("猫咪不存在");
        }
        draft.pets = draft.pets.map((item) => (item.id === body.id ? { ...item, ...body, familyId: item.familyId } : item));
      } else {
        const pet = {
          id: `pet_${randomUUID().slice(0, 8)}`,
          familyId: authResult.user.familyId,
          ...body
        };
        draft.pets.unshift(pet);
        draft.users = draft.users.map((item) =>
          item.id === authResult.user.id
            ? {
                ...item,
                currentPetId: pet.id
              }
            : item
        );
      }
      const nextUser = draft.users.find((item) => item.id === authResult.user.id);
      syncLegacyAuthState(draft, nextUser, true);
      return draft;
    });
    const pets = getFamilyPets(db, authResult.user.familyId);
    const pet = body.id ? pets.find((item) => item.id === body.id) : pets.find((item) => item.id === getUserById(db, authResult.user.id)?.currentPetId);
    sendJson(res, 200, pet);
    return;
  }

  if (pathname.startsWith("/api/pets/") && req.method === "GET") {
    const petId = pathname.split("/").pop();
    const pet = getFamilyPets(authResult.db, authResult.user.familyId).find((item) => item.id === petId) || getCurrentPetForUser(authResult.db, authResult.user);
    if (!pet) {
      sendError(res, 404, "猫咪不存在");
      return;
    }
    const petRecords = sortRecords(authResult.db.records.filter((item) => item.petId === pet.id));
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
    const familyPetIds = new Set(getFamilyPets(authResult.db, authResult.user.familyId).map((item) => item.id));
    const records = sortRecords(
      authResult.db.records.filter((item) => {
        const petMatch = petId ? item.petId === petId : true;
        const typeMatch = type && type !== "all" ? item.type === type : true;
        return familyPetIds.has(item.petId) && petMatch && typeMatch;
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
    const pet = getFamilyPets(authResult.db, authResult.user.familyId).find((item) => item.id === body.petId);
    if (!pet) {
      sendError(res, 403, "无权为该猫咪记录数据");
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
    const familyPetIds = new Set(getFamilyPets(authResult.db, authResult.user.familyId).map((item) => item.id));
    const record = authResult.db.records.find((item) => item.id === recordId && familyPetIds.has(item.petId));
    if (!record) {
      sendError(res, 404, "记录不存在");
      return;
    }
    sendJson(res, 200, record);
    return;
  }

  if (pathname.startsWith("/api/records/") && pathname.endsWith("/delete") && req.method === "POST") {
    const recordId = pathname.split("/")[3];
    const familyPetIds = new Set(getFamilyPets(authResult.db, authResult.user.familyId).map((item) => item.id));
    const exists = authResult.db.records.some((item) => item.id === recordId && familyPetIds.has(item.petId));
    if (!exists) {
      sendError(res, 404, "记录不存在");
      return;
    }
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
    const familyPetIds = new Set(getFamilyPets(authResult.db, authResult.user.familyId).map((item) => item.id));
    if (!familyPetIds.has(body.petId)) {
      sendError(res, 403, "无权编辑该记录");
      return;
    }

    let updatedRecord = null;
    updateDb((draft) => {
      const existing = draft.records.find((item) => item.id === recordId && familyPetIds.has(item.petId));
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

    sendJson(res, 200, updatedRecord);
    return;
  }

  if (pathname === "/api/family-members" && req.method === "GET") {
    sendJson(res, 200, getFamilyMembers(authResult.db, authResult.user.familyId));
    return;
  }

  if (pathname === "/api/reminder-settings" && req.method === "GET") {
    sendJson(res, 200, getReminderSettingsForFamily(authResult.db, authResult.user.familyId));
    return;
  }

  if (pathname === "/api/reminder-settings" && req.method === "POST") {
    const body = await readBody(req);
    const db = updateDb((draft) => {
      draft.familyReminderSettings = Array.isArray(draft.familyReminderSettings) ? draft.familyReminderSettings : [];
      const existing = draft.familyReminderSettings.find((item) => item.familyId === authResult.user.familyId);
      const nextValue = {
        familyId: authResult.user.familyId,
        vaccineEnabled: Boolean(body.vaccineEnabled),
        dewormEnabled: Boolean(body.dewormEnabled),
        leadDays: Number(body.leadDays || 0)
      };
      draft.familyReminderSettings = existing
        ? draft.familyReminderSettings.map((item) => (item.familyId === authResult.user.familyId ? nextValue : item))
        : draft.familyReminderSettings.concat(nextValue);
      return draft;
    });
    sendJson(res, 200, getReminderSettingsForFamily(db, authResult.user.familyId));
    return;
  }

  if (pathname === "/api/invite" && req.method === "GET") {
    const family = getFamilyById(authResult.db, authResult.user.familyId);
    const currentPet = getCurrentPetForUser(authResult.db, authResult.user);
    sendJson(res, 200, {
      familyName: family?.name || (currentPet ? `${currentPet.name} 的家庭` : "我的猫咪家庭"),
      inviteCode: family?.inviteCode || "",
      expiresHint: "长期有效",
      memberCount: getFamilyMembers(authResult.db, authResult.user.familyId).length
    });
    return;
  }

  sendError(res, 404, `未找到接口: ${pathname}`);
}

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    console.error(error);
    if (!res.headersSent) {
      const statusCode = error.message === "记录不存在" || error.message === "猫咪不存在" ? 404 : 500;
      sendError(res, statusCode, error.message || "服务器异常");
    }
  });
});

server.listen(PORT, HOST, () => {
  console.log(`xiaomaolaile backend listening on http://${HOST}:${PORT}`);
});
