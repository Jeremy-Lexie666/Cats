const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const RUNTIME_DIR = path.join(DATA_DIR, "runtime");
const RUNTIME_FILE = path.join(RUNTIME_DIR, "db.json");
const SEED_FILE = path.join(DATA_DIR, "seed.json");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function ensureRuntimeFile() {
  if (!fs.existsSync(RUNTIME_DIR)) {
    fs.mkdirSync(RUNTIME_DIR, { recursive: true });
  }
  if (!fs.existsSync(RUNTIME_FILE)) {
    fs.copyFileSync(SEED_FILE, RUNTIME_FILE);
  }
}

function readDb() {
  ensureRuntimeFile();
  return JSON.parse(fs.readFileSync(RUNTIME_FILE, "utf8"));
}

function writeDb(next) {
  ensureRuntimeFile();
  fs.writeFileSync(RUNTIME_FILE, JSON.stringify(next, null, 2));
}

function updateDb(mutator) {
  const db = readDb();
  const result = mutator(db) || db;
  writeDb(result);
  return clone(result);
}

function resetDb() {
  ensureRuntimeFile();
  fs.copyFileSync(SEED_FILE, RUNTIME_FILE);
  return readDb();
}

module.exports = {
  readDb,
  writeDb,
  updateDb,
  resetDb
};
