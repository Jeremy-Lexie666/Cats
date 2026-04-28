const fs = require("fs");
const path = require("path");

const root = process.cwd();

function ok(message) {
  console.log(`OK  ${message}`);
}

function warn(message) {
  console.log(`WARN ${message}`);
}

function fail(message) {
  console.log(`ERR  ${message}`);
  process.exitCode = 1;
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

[
  "package.json",
  "project.config.json",
  "miniprogram/app.json",
  "miniprogram/app.ts"
].forEach((file) => {
  if (exists(file)) {
    ok(`found ${file}`);
  } else {
    fail(`missing ${file}`);
  }
});

const nodeModulesPath = path.join(root, "node_modules");
if (!fs.existsSync(nodeModulesPath)) {
  warn("node_modules is missing. Run `npm install` on this machine before building.");
} else {
  const stat = fs.lstatSync(nodeModulesPath);
  if (stat.isSymbolicLink()) {
    const target = fs.readlinkSync(nodeModulesPath);
    warn(`node_modules is a symlink -> ${target}`);
    warn("This project will not be portable as-is. On a new machine, delete the symlink and run `npm install`.");
  } else {
    ok("node_modules is local to this project");
  }
}

if (exists("dist/miniprogram/app.json")) {
  ok("build output exists at dist/miniprogram");
} else {
  warn("build output is missing. Run `npm run build:miniprogram` before opening in WeChat DevTools.");
}

ok("doctor finished");
