const fs = require("fs");
const path = require("path");

process.env.NODE_ENV = process.env.NODE_ENV || "production";
process.env.PORT = process.env.PORT || "3000";
process.env.HOSTNAME = process.env.HOSTNAME || "0.0.0.0";

const standaloneServerPath = path.join(
  __dirname,
  ".next",
  "standalone",
  "server.js",
);

if (!fs.existsSync(standaloneServerPath)) {
  console.error(
    `Missing standalone server at ${standaloneServerPath}. Run "npm run build" before "npm run start".`,
  );
  process.exit(1);
}

require(standaloneServerPath);
