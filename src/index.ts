// Entry point: loads config, opens the database, and starts the server.
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { openDatabase } from "./db.js";

const config = loadConfig();
const db = openDatabase(config.databasePath);
const app = createApp({
  db,
  jwtSecret: config.jwtSecret,
  cookieSecure: config.cookieSecure,
  enableDocs: config.enableDocs,
});

app.listen(config.port, () => {
  console.log(`listening on http://localhost:${config.port}`);
  if (config.enableDocs) {
    console.log(`API docs at http://localhost:${config.port}/api/docs/`);
  }
});
