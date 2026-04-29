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

function getDb() {
  if (db) {
    return db;
  }

  ensureRuntimeDir();
  db = new DatabaseSync(DB_FILE);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = OFF;");
  initializeSchema(db);

  const hasSeed = db.prepare("SELECT COUNT(1) AS count FROM auth_state").get().count > 0;
  if (!hasSeed) {
    seedDatabase(db);
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

    CREATE TABLE IF NOT EXISTS reminder_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      vaccine_enabled INTEGER NOT NULL,
      deworm_enabled INTEGER NOT NULL,
      lead_days INTEGER NOT NULL
    );
  `);
}

function seedDatabase(database) {
  const seed = JSON.parse(fs.readFileSync(SEED_FILE, "utf8"));
  writeSnapshot(database, seed);
}

function readSnapshot(database) {
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
  const reminderRow = database.prepare("SELECT * FROM reminder_settings WHERE id = 1").get();

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
    reminderSettings: reminderRow
      ? {
          vaccineEnabled: Boolean(reminderRow.vaccine_enabled),
          dewormEnabled: Boolean(reminderRow.deworm_enabled),
          leadDays: Number(reminderRow.lead_days || 0)
        }
      : {
          vaccineEnabled: true,
          dewormEnabled: true,
          leadDays: 3
        }
  };
}

function clearTables(database) {
  database.exec(`
    DELETE FROM auth_state;
    DELETE FROM sessions;
    DELETE FROM pets;
    DELETE FROM members;
    DELETE FROM records;
    DELETE FROM reminder_settings;
  `);
}

function writeSnapshot(database, snapshot) {
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
        snapshot.auth.currentPetId,
        snapshot.auth.hasCompletedOnboarding ? 1 : 0,
        snapshot.auth.user.id,
        snapshot.auth.user.nickname,
        snapshot.auth.user.avatarText
      );

    const insertSession = database.prepare(
      `INSERT INTO sessions (token, user_id, identity_hint, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?)`
    );
    for (const item of snapshot.sessions || []) {
      insertSession.run(item.token, item.userId, item.identityHint || "", item.createdAt, item.expiresAt);
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
      `INSERT INTO members (id, family_id, display_name, role, joined_at)
       VALUES (?, ?, ?, ?, ?)`
    );
    for (const item of snapshot.members || []) {
      insertMember.run(item.id, item.familyId, item.displayName, item.role, item.joinedAt);
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

    database
      .prepare(
        `INSERT INTO reminder_settings
        (id, vaccine_enabled, deworm_enabled, lead_days)
        VALUES (1, ?, ?, ?)`
      )
      .run(
        snapshot.reminderSettings.vaccineEnabled ? 1 : 0,
        snapshot.reminderSettings.dewormEnabled ? 1 : 0,
        snapshot.reminderSettings.leadDays
      );

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
  writeSnapshot(database, seed);
  return readDb();
}

module.exports = {
  readDb,
  writeDb,
  updateDb,
  resetDb
};
