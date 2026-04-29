const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const DATA_DIR = path.join(__dirname, "..", "data");
const RUNTIME_DIR = path.join(DATA_DIR, "runtime");
const DB_FILE = path.join(RUNTIME_DIR, "app.db");
const SEED_FILE = path.join(DATA_DIR, "seed.json");

let db;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function ensureRuntimeDir() {
  if (!fs.existsSync(RUNTIME_DIR)) {
    fs.mkdirSync(RUNTIME_DIR, { recursive: true });
  }
}

function hasColumn(database, tableName, columnName) {
  const rows = database.prepare(`PRAGMA table_info(${tableName})`).all();
  return rows.some((row) => row.name === columnName);
}

function ensureLegacyCompatibility(database) {
  if (!hasColumn(database, "members", "user_id")) {
    database.exec("ALTER TABLE members ADD COLUMN user_id TEXT");
  }
}

function getDb() {
  if (db) {
    return db;
  }

  ensureRuntimeDir();
  db = new DatabaseSync(DB_FILE);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = OFF;");
  initializeSchema(db);
  ensureLegacyCompatibility(db);

  const hasSeed = db.prepare("SELECT COUNT(1) AS count FROM auth_state").get().count > 0;
  if (!hasSeed) {
    seedDatabase(db);
  } else {
    migrateLegacySnapshotIfNeeded(db);
  }

  return db;
}

function initializeSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS auth_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      is_logged_in INTEGER NOT NULL,
      current_pet_id TEXT NOT NULL,
      has_completed_onboarding INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      user_nickname TEXT NOT NULL,
      user_avatar_text TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      identity_hint TEXT,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      identity_hint TEXT NOT NULL UNIQUE,
      nickname TEXT NOT NULL,
      avatar_text TEXT NOT NULL,
      family_id TEXT NOT NULL,
      current_pet_id TEXT NOT NULL,
      has_completed_onboarding INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS families (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      invite_code TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pets (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL,
      name TEXT NOT NULL,
      birthday TEXT NOT NULL,
      breed TEXT NOT NULL,
      gender TEXT NOT NULL,
      is_neutered INTEGER NOT NULL,
      avatar_text TEXT NOT NULL,
      photo_url TEXT,
      note TEXT
    );

    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      family_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL,
      joined_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS records (
      id TEXT PRIMARY KEY,
      pet_id TEXT NOT NULL,
      type TEXT NOT NULL,
      vaccine_name TEXT,
      vaccinated_at TEXT,
      next_due_at TEXT,
      mode TEXT,
      brand TEXT,
      executed_at TEXT,
      weight_kg REAL,
      recorded_at TEXT,
      note TEXT
    );

    CREATE TABLE IF NOT EXISTS family_reminder_settings (
      family_id TEXT PRIMARY KEY,
      vaccine_enabled INTEGER NOT NULL,
      deworm_enabled INTEGER NOT NULL,
      lead_days INTEGER NOT NULL
    );
  `);
}

function buildLegacyFamilyName(pets, fallbackName = "我的猫咪家庭") {
  const firstPet = pets[0];
  return firstPet ? `${firstPet.name} 的家庭` : fallbackName;
}

function normalizeSnapshot(rawSnapshot, options = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const auth = rawSnapshot.auth || {
    isLoggedIn: false,
    currentPetId: "",
    hasCompletedOnboarding: false,
    user: { id: "", nickname: "", avatarText: "" }
  };
  const pets = Array.isArray(rawSnapshot.pets) ? rawSnapshot.pets : [];
  const hasExplicitFamilies = Array.isArray(rawSnapshot.families);
  const hasExplicitUsers = Array.isArray(rawSnapshot.users);
  const hasExplicitFamilyReminderSettings = Array.isArray(rawSnapshot.familyReminderSettings);
  const legacyFamilyId = pets[0]?.familyId || "family_1";
  const legacyInviteCode = "CAT-2026";
  const families =
    hasExplicitFamilies
      ? rawSnapshot.families
      : [
          {
            id: legacyFamilyId,
            name: buildLegacyFamilyName(pets),
            inviteCode: legacyInviteCode,
            createdAt: rawSnapshot.members?.[0]?.joinedAt || today
          }
        ];

  const users =
    hasExplicitUsers
      ? rawSnapshot.users
      : [
          {
            id: auth.user.id || "user_1",
            identityHint: `legacy-${auth.user.id || "user_1"}`,
            nickname: auth.user.nickname || "Jeremy",
            avatarText: auth.user.avatarText || "J",
            familyId: legacyFamilyId,
            currentPetId: auth.currentPetId || pets[0]?.id || "",
            hasCompletedOnboarding: Boolean(auth.hasCompletedOnboarding)
          }
        ];

  const ownerUserId = users[0]?.id || "";
  const members = (Array.isArray(rawSnapshot.members) ? rawSnapshot.members : []).map((item, index) => ({
    ...item,
    userId: item.userId || (index === 0 && item.role === "owner" ? ownerUserId : "")
  }));

  const familyReminderSettings =
    hasExplicitFamilyReminderSettings
      ? rawSnapshot.familyReminderSettings
      : families.map((family) => ({
          familyId: family.id,
          vaccineEnabled: rawSnapshot.reminderSettings?.vaccineEnabled ?? true,
          dewormEnabled: rawSnapshot.reminderSettings?.dewormEnabled ?? true,
          leadDays: rawSnapshot.reminderSettings?.leadDays ?? 3
        }));

  return {
    auth,
    sessions: options.clearSessions ? [] : Array.isArray(rawSnapshot.sessions) ? rawSnapshot.sessions : [],
    users,
    families,
    pets,
    members,
    records: Array.isArray(rawSnapshot.records) ? rawSnapshot.records : [],
    familyReminderSettings
  };
}

function seedDatabase(database) {
  const seed = JSON.parse(fs.readFileSync(SEED_FILE, "utf8"));
  writeSnapshot(database, normalizeSnapshot(seed));
}

function readLegacySnapshot(database) {
  const authRow = database.prepare("SELECT * FROM auth_state WHERE id = 1").get();
  const sessions = database
    .prepare("SELECT token, user_id AS userId, identity_hint AS identityHint, created_at AS createdAt, expires_at AS expiresAt FROM sessions")
    .all();
  const pets = database
    .prepare(
      "SELECT id, family_id AS familyId, name, birthday, breed, gender, is_neutered AS isNeutered, avatar_text AS avatarText, photo_url AS photoUrl, note FROM pets"
    )
    .all()
    .map((item) => ({
      ...item,
      isNeutered: Boolean(item.isNeutered)
    }));
  const members = database
    .prepare("SELECT id, family_id AS familyId, display_name AS displayName, role, joined_at AS joinedAt FROM members")
    .all();
  const records = database
    .prepare(
      `SELECT
        id,
        pet_id AS petId,
        type,
        vaccine_name AS vaccineName,
        vaccinated_at AS vaccinatedAt,
        next_due_at AS nextDueAt,
        mode,
        brand,
        executed_at AS executedAt,
        weight_kg AS weightKg,
        recorded_at AS recordedAt,
        note
      FROM records`
    )
    .all()
    .map((item) => {
      if (item.type === "vaccine") {
        return {
          id: item.id,
          petId: item.petId,
          type: item.type,
          vaccineName: item.vaccineName,
          vaccinatedAt: item.vaccinatedAt,
          nextDueAt: item.nextDueAt || undefined,
          note: item.note || undefined
        };
      }
      if (item.type === "deworm") {
        return {
          id: item.id,
          petId: item.petId,
          type: item.type,
          mode: item.mode,
          brand: item.brand,
          executedAt: item.executedAt,
          nextDueAt: item.nextDueAt || undefined,
          note: item.note || undefined
        };
      }
      return {
        id: item.id,
        petId: item.petId,
        type: item.type,
        weightKg: Number(item.weightKg || 0),
        recordedAt: item.recordedAt,
        note: item.note || undefined
      };
    });

  let reminderSettings = { vaccineEnabled: true, dewormEnabled: true, leadDays: 3 };
  try {
    const reminderRow = database.prepare("SELECT * FROM reminder_settings WHERE id = 1").get();
    if (reminderRow) {
      reminderSettings = {
        vaccineEnabled: Boolean(reminderRow.vaccine_enabled),
        dewormEnabled: Boolean(reminderRow.deworm_enabled),
        leadDays: Number(reminderRow.lead_days || 0)
      };
    }
  } catch {
    // ignore legacy reminder table absence
  }

  return {
    auth: authRow
      ? {
          isLoggedIn: Boolean(authRow.is_logged_in),
          currentPetId: authRow.current_pet_id,
          hasCompletedOnboarding: Boolean(authRow.has_completed_onboarding),
          user: {
            id: authRow.user_id,
            nickname: authRow.user_nickname,
            avatarText: authRow.user_avatar_text
          }
        }
      : {
          isLoggedIn: false,
          currentPetId: "",
          hasCompletedOnboarding: false,
          user: {
            id: "",
            nickname: "",
            avatarText: ""
          }
        },
    sessions,
    pets,
    members,
    records,
    reminderSettings
  };
}

function migrateLegacySnapshotIfNeeded(database) {
  const hasUsers = database.prepare("SELECT COUNT(1) AS count FROM users").get().count > 0;
  if (hasUsers) {
    return;
  }

  const legacy = readLegacySnapshot(database);
  const normalized = normalizeSnapshot(legacy, { clearSessions: true });
  writeSnapshot(database, normalized);
}

function readSnapshot(database) {
  const authRow = database.prepare("SELECT * FROM auth_state WHERE id = 1").get();
  const sessions = database
    .prepare("SELECT token, user_id AS userId, identity_hint AS identityHint, created_at AS createdAt, expires_at AS expiresAt FROM sessions")
    .all();
  const users = database
    .prepare(
      `SELECT
        id,
        identity_hint AS identityHint,
        nickname,
        avatar_text AS avatarText,
        family_id AS familyId,
        current_pet_id AS currentPetId,
        has_completed_onboarding AS hasCompletedOnboarding
      FROM users`
    )
    .all()
    .map((item) => ({
      ...item,
      hasCompletedOnboarding: Boolean(item.hasCompletedOnboarding)
    }));
  const families = database
    .prepare("SELECT id, name, invite_code AS inviteCode, created_at AS createdAt FROM families")
    .all();
  const pets = database
    .prepare(
      "SELECT id, family_id AS familyId, name, birthday, breed, gender, is_neutered AS isNeutered, avatar_text AS avatarText, photo_url AS photoUrl, note FROM pets"
    )
    .all()
    .map((item) => ({
      ...item,
      isNeutered: Boolean(item.isNeutered)
    }));
  const members = database
    .prepare(
      "SELECT id, user_id AS userId, family_id AS familyId, display_name AS displayName, role, joined_at AS joinedAt FROM members"
    )
    .all();
  const records = database
    .prepare(
      `SELECT
        id,
        pet_id AS petId,
        type,
        vaccine_name AS vaccineName,
        vaccinated_at AS vaccinatedAt,
        next_due_at AS nextDueAt,
        mode,
        brand,
        executed_at AS executedAt,
        weight_kg AS weightKg,
        recorded_at AS recordedAt,
        note
      FROM records`
    )
    .all()
    .map((item) => {
      if (item.type === "vaccine") {
        return {
          id: item.id,
          petId: item.petId,
          type: item.type,
          vaccineName: item.vaccineName,
          vaccinatedAt: item.vaccinatedAt,
          nextDueAt: item.nextDueAt || undefined,
          note: item.note || undefined
        };
      }
      if (item.type === "deworm") {
        return {
          id: item.id,
          petId: item.petId,
          type: item.type,
          mode: item.mode,
          brand: item.brand,
          executedAt: item.executedAt,
          nextDueAt: item.nextDueAt || undefined,
          note: item.note || undefined
        };
      }
      return {
        id: item.id,
        petId: item.petId,
        type: item.type,
        weightKg: Number(item.weightKg || 0),
        recordedAt: item.recordedAt,
        note: item.note || undefined
      };
    });
  const familyReminderSettings = database
    .prepare(
      "SELECT family_id AS familyId, vaccine_enabled AS vaccineEnabled, deworm_enabled AS dewormEnabled, lead_days AS leadDays FROM family_reminder_settings"
    )
    .all()
    .map((item) => ({
      ...item,
      vaccineEnabled: Boolean(item.vaccineEnabled),
      dewormEnabled: Boolean(item.dewormEnabled),
      leadDays: Number(item.leadDays || 0)
    }));

  return {
    auth: authRow
      ? {
          isLoggedIn: Boolean(authRow.is_logged_in),
          currentPetId: authRow.current_pet_id,
          hasCompletedOnboarding: Boolean(authRow.has_completed_onboarding),
          user: {
            id: authRow.user_id,
            nickname: authRow.user_nickname,
            avatarText: authRow.user_avatar_text
          }
        }
      : {
          isLoggedIn: false,
          currentPetId: "",
          hasCompletedOnboarding: false,
          user: {
            id: "",
            nickname: "",
            avatarText: ""
          }
        },
    sessions,
    users,
    families,
    pets,
    members,
    records,
    familyReminderSettings
  };
}

function clearTables(database) {
  database.exec(`
    DELETE FROM auth_state;
    DELETE FROM sessions;
    DELETE FROM users;
    DELETE FROM families;
    DELETE FROM pets;
    DELETE FROM members;
    DELETE FROM records;
    DELETE FROM family_reminder_settings;
  `);
}

function writeSnapshot(database, rawSnapshot) {
  const snapshot = normalizeSnapshot(rawSnapshot);
  database.exec("BEGIN");
  try {
    clearTables(database);

    database
      .prepare(
        `INSERT INTO auth_state
        (id, is_logged_in, current_pet_id, has_completed_onboarding, user_id, user_nickname, user_avatar_text)
        VALUES (1, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        snapshot.auth.isLoggedIn ? 1 : 0,
        snapshot.auth.currentPetId || "",
        snapshot.auth.hasCompletedOnboarding ? 1 : 0,
        snapshot.auth.user.id || "",
        snapshot.auth.user.nickname || "",
        snapshot.auth.user.avatarText || ""
      );

    const insertSession = database.prepare(
      `INSERT INTO sessions (token, user_id, identity_hint, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?)`
    );
    for (const item of snapshot.sessions || []) {
      insertSession.run(item.token, item.userId, item.identityHint || "", item.createdAt, item.expiresAt);
    }

    const insertUser = database.prepare(
      `INSERT INTO users
      (id, identity_hint, nickname, avatar_text, family_id, current_pet_id, has_completed_onboarding)
      VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    for (const item of snapshot.users || []) {
      insertUser.run(
        item.id,
        item.identityHint,
        item.nickname,
        item.avatarText,
        item.familyId,
        item.currentPetId || "",
        item.hasCompletedOnboarding ? 1 : 0
      );
    }

    const insertFamily = database.prepare(
      `INSERT INTO families (id, name, invite_code, created_at)
       VALUES (?, ?, ?, ?)`
    );
    for (const item of snapshot.families || []) {
      insertFamily.run(item.id, item.name, item.inviteCode, item.createdAt);
    }

    const insertPet = database.prepare(
      `INSERT INTO pets
      (id, family_id, name, birthday, breed, gender, is_neutered, avatar_text, photo_url, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const item of snapshot.pets || []) {
      insertPet.run(
        item.id,
        item.familyId,
        item.name,
        item.birthday,
        item.breed,
        item.gender,
        item.isNeutered ? 1 : 0,
        item.avatarText,
        item.photoUrl || null,
        item.note || null
      );
    }

    const insertMember = database.prepare(
      `INSERT INTO members (id, user_id, family_id, display_name, role, joined_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    for (const item of snapshot.members || []) {
      insertMember.run(item.id, item.userId || null, item.familyId, item.displayName, item.role, item.joinedAt);
    }

    const insertRecord = database.prepare(
      `INSERT INTO records
      (id, pet_id, type, vaccine_name, vaccinated_at, next_due_at, mode, brand, executed_at, weight_kg, recorded_at, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const item of snapshot.records || []) {
      insertRecord.run(
        item.id,
        item.petId,
        item.type,
        item.type === "vaccine" ? item.vaccineName : null,
        item.type === "vaccine" ? item.vaccinatedAt : null,
        "nextDueAt" in item ? item.nextDueAt || null : null,
        item.type === "deworm" ? item.mode : null,
        item.type === "deworm" ? item.brand : null,
        item.type === "deworm" ? item.executedAt : null,
        item.type === "weight" ? item.weightKg : null,
        item.type === "weight" ? item.recordedAt : null,
        item.note || null
      );
    }

    const insertFamilyReminderSetting = database.prepare(
      `INSERT INTO family_reminder_settings
      (family_id, vaccine_enabled, deworm_enabled, lead_days)
      VALUES (?, ?, ?, ?)`
    );
    for (const item of snapshot.familyReminderSettings || []) {
      insertFamilyReminderSetting.run(
        item.familyId,
        item.vaccineEnabled ? 1 : 0,
        item.dewormEnabled ? 1 : 0,
        item.leadDays
      );
    }

    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function readDb() {
  const database = getDb();
  return clone(readSnapshot(database));
}

function writeDb(next) {
  const database = getDb();
  writeSnapshot(database, next);
}

function updateDb(mutator) {
  const current = readDb();
  const result = mutator(current) || current;
  writeDb(result);
  return clone(result);
}

function resetDb() {
  const database = getDb();
  const seed = JSON.parse(fs.readFileSync(SEED_FILE, "utf8"));
  writeSnapshot(database, normalizeSnapshot(seed));
  return readDb();
}

module.exports = {
  readDb,
  writeDb,
  updateDb,
  resetDb
};
