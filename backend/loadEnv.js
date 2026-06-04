const fs = require('fs');
const path = require('path');

const ENV_FILES = ['.env.local', '.env'];

function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) continue;

    const key = line.slice(0, separatorIndex).trim();
    const value = stripQuotes(line.slice(separatorIndex + 1).trim());

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function loadLocalEnv() {
  for (const fileName of ENV_FILES) {
    loadEnvFile(path.join(__dirname, fileName));
  }
}

loadLocalEnv();

module.exports = {
  loadLocalEnv
};
