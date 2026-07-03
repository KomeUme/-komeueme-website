#!/usr/bin/env node
const { execFileSync } = require("child_process");
const path = require("path");

const root = path.resolve(__dirname, "..");
execFileSync("git", ["config", "core.hooksPath", ".githooks"], { cwd: root, stdio: "inherit" });
console.log("Git hooks enabled from .githooks");
