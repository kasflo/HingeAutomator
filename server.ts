import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import path from "path";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import Anthropic from "@anthropic-ai/sdk";

const db = new Database("database.sqlite");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS emails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    email TEXT,
    password TEXT,
    url TEXT,
    status TEXT DEFAULT 'available',
    FOREIGN KEY(user_id) REFERENCES users(id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS user_data (
    user_id INTEGER PRIMARY KEY,
    proxy_config TEXT,
    daisy_config TEXT,
    results TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    proxy_ip TEXT,
    proxy_port INTEGER DEFAULT 5000,
    proxy_username TEXT,
    proxy_city TEXT,
    phone_number TEXT,
    order_id TEXT,
    sms_code TEXT,
    sms_status TEXT DEFAULT 'not_requested',
    fraud_score INTEGER,
    fraud_risk TEXT,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id)
  )
`);

// Migrations: add columns if they don't exist yet
const userCols = (db.prepare("PRAGMA table_info(users)").all() as any[]).map((c: any) => c.name);
if (!userCols.includes('status')) {
  db.exec(`ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'`);
}
if (!userCols.includes('created_at')) {
  db.exec(`ALTER TABLE users ADD COLUMN created_at TEXT`);
}
// Ensure flo is always active
db.prepare(`UPDATE users SET status = 'active' WHERE username = 'flo'`).run();

function isAdmin(username: string): boolean {
  return username?.toLowerCase() === 'flo';
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // User Data Endpoints
  app.get("/api/user/data", (req, res) => {
    const { username } = req.query;
    const trimmedUsername = (username as string)?.trim();
    const user = db.prepare("SELECT id FROM users WHERE username = ?").get(trimmedUsername) as any;
    if (!user) return res.status(404).json({ error: "User not found" });

    const data = db.prepare("SELECT * FROM user_data WHERE user_id = ?").get(user.id) as any;
    if (!data) {
      return res.json({ proxy_config: null, daisy_config: null, results: null });
    }
    res.json({
      proxy_config: data.proxy_config ? JSON.parse(data.proxy_config) : null,
      daisy_config: data.daisy_config ? JSON.parse(data.daisy_config) : null,
      results: data.results ? JSON.parse(data.results) : null
    });
  });

  app.post("/api/user/data", (req, res) => {
    const { username, proxy_config, daisy_config, results } = req.body;
    const trimmedUsername = username?.trim();
    const user = db.prepare("SELECT id FROM users WHERE username = ?").get(trimmedUsername) as any;
    if (!user) return res.status(404).json({ error: "User not found" });

    const existing = db.prepare("SELECT user_id FROM user_data WHERE user_id = ?").get(user.id);
    
    if (existing) {
      db.prepare(`
        UPDATE user_data 
        SET proxy_config = ?, daisy_config = ?, results = ? 
        WHERE user_id = ?
      `).run(
        proxy_config ? JSON.stringify(proxy_config) : null,
        daisy_config ? JSON.stringify(daisy_config) : null,
        results ? JSON.stringify(results) : null,
        user.id
      );
    } else {
      db.prepare(`
        INSERT INTO user_data (user_id, proxy_config, daisy_config, results) 
        VALUES (?, ?, ?, ?)
      `).run(
        user.id,
        proxy_config ? JSON.stringify(proxy_config) : null,
        daisy_config ? JSON.stringify(daisy_config) : null,
        results ? JSON.stringify(results) : null
      );
    }
    res.json({ success: true });
  });

  // Auth Endpoints
  app.post("/api/auth/register", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }

    const trimmedUsername = username.trim();

    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      // New users start as 'pending' — must be approved by flo
      const status = trimmedUsername === 'flo' ? 'active' : 'pending';
      db.prepare("INSERT INTO users (username, password, status, created_at) VALUES (?, ?, ?, datetime('now'))")
        .run(trimmedUsername, hashedPassword, status);
      res.json({ success: true, pending: status === 'pending' });
    } catch (error: any) {
      if (error.code === "SQLITE_CONSTRAINT") {
        res.status(400).json({ error: "Username already exists" });
      } else {
        res.status(500).json({ error: "Registration failed" });
      }
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;
    const trimmedUsername = username?.trim();
    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(trimmedUsername) as any;

    if (!user || !await bcrypt.compare(password, user.password)) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    if (user.status === 'pending') {
      return res.status(403).json({ error: "Your account is pending approval by the admin." });
    }
    if (user.status === 'blocked') {
      return res.status(403).json({ error: "Your account has been blocked. Contact the admin." });
    }
    res.json({ success: true, username: user.username, id: user.id });
  });

  // Admin Endpoints (flo only)
  app.get("/api/admin/users", (req, res) => {
    const { admin } = req.query;
    if (!isAdmin(admin as string)) return res.status(403).json({ error: "Forbidden" });

    const users = db.prepare(`
      SELECT u.id, u.username, u.status, u.created_at,
        (SELECT COUNT(*) FROM emails WHERE user_id = u.id) as email_count,
        (SELECT COUNT(*) FROM emails WHERE user_id = u.id AND status = 'available') as available_emails
      FROM users u
      ORDER BY CASE u.status WHEN 'pending' THEN 0 WHEN 'active' THEN 1 ELSE 2 END, u.created_at DESC
    `).all();
    res.json({ users });
  });

  app.post("/api/admin/users/:id/approve", (req, res) => {
    const { admin } = req.body;
    if (!isAdmin(admin)) return res.status(403).json({ error: "Forbidden" });
    db.prepare("UPDATE users SET status = 'active' WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.post("/api/admin/users/:id/reject", (req, res) => {
    const { admin } = req.body;
    if (!isAdmin(admin)) return res.status(403).json({ error: "Forbidden" });
    db.prepare("DELETE FROM user_data WHERE user_id = ?").run(req.params.id);
    db.prepare("DELETE FROM emails WHERE user_id = ?").run(req.params.id);
    db.prepare("DELETE FROM users WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.post("/api/admin/users/:id/block", (req, res) => {
    const { admin } = req.body;
    if (!isAdmin(admin)) return res.status(403).json({ error: "Forbidden" });
    db.prepare("UPDATE users SET status = 'blocked' WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.post("/api/admin/users/:id/unblock", (req, res) => {
    const { admin } = req.body;
    if (!isAdmin(admin)) return res.status(403).json({ error: "Forbidden" });
    db.prepare("UPDATE users SET status = 'active' WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/admin/users/:id", (req, res) => {
    const { admin } = req.query;
    if (!isAdmin(admin as string)) return res.status(403).json({ error: "Forbidden" });
    db.prepare("DELETE FROM user_data WHERE user_id = ?").run(req.params.id);
    db.prepare("DELETE FROM emails WHERE user_id = ?").run(req.params.id);
    db.prepare("DELETE FROM users WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Email Endpoints
  app.post("/api/emails/upload", (req, res) => {
    const { username, emails } = req.body;
    const trimmedUsername = username?.trim();
    console.log(`[Email Upload] Request for user: ${trimmedUsername}, Count: ${emails?.length}`);
    const user = db.prepare("SELECT id FROM users WHERE username = ?").get(trimmedUsername) as any;
    if (!user) return res.status(404).json({ error: "User not found" });

    const insert = db.prepare("INSERT INTO emails (user_id, email, password, url) VALUES (?, ?, ?, ?)");
    const insertMany = db.transaction((data) => {
      for (const item of data) {
        insert.run(user.id, item.email, item.password, item.url);
      }
    });

    insertMany(emails);
    console.log(`[Email Upload] Successfully uploaded ${emails.length} emails for user_id: ${user.id}`);
    res.json({ success: true, count: emails.length });
  });

  app.get("/api/emails/count", (req, res) => {
    const { username } = req.query;
    const trimmedUsername = (username as string)?.trim();
    console.log(`[Email Count] Request for username: "${trimmedUsername}"`);
    
    const user = db.prepare("SELECT id FROM users WHERE username = ?").get(trimmedUsername) as any;
    if (!user) {
      console.log(`[Email Count] Error: User "${trimmedUsername}" not found`);
      return res.status(404).json({ error: "User not found" });
    }

    const row = db.prepare("SELECT COUNT(*) as count FROM emails WHERE user_id = ? AND status = 'available'").get(user.id) as any;
    const totalRow = db.prepare("SELECT COUNT(*) as total FROM emails WHERE user_id = ?").get(user.id) as any;
    
    console.log(`[Email Count] User: "${trimmedUsername}" (ID: ${user.id}), Available: ${row.count}, Total: ${totalRow.total}`);
    res.json({ count: row.count, total: totalRow.total });
  });

  app.post("/api/emails/assign", (req, res) => {
    const { username } = req.body;
    const trimmedUsername = username?.trim();
    const user = db.prepare("SELECT id FROM users WHERE username = ?").get(trimmedUsername) as any;
    if (!user) return res.status(404).json({ error: "User not found" });

    // Finde die nächste verfügbare E-Mail
    const email = db.prepare("SELECT * FROM emails WHERE user_id = ? AND status = 'available' ORDER BY id ASC LIMIT 1").get(user.id) as any;
    if (!email) return res.status(404).json({ error: "No emails available" });

    // Status auf 'assigned' setzen - NICHT LÖSCHEN
    db.prepare("UPDATE emails SET status = 'assigned' WHERE id = ?").run(email.id);
    
    res.json({ 
      success: true, 
      email: email.email, 
      password: email.password, 
      url: email.url, 
      id: email.id 
    });
  });

  app.post("/api/emails/consume", (req, res) => {
    const { emailId } = req.body;
    // Erst beim Klick auf den Link wird die E-Mail gelöscht oder als 'consumed' markiert
    db.prepare("DELETE FROM emails WHERE id = ?").run(emailId);
    res.json({ success: true });
  });

  app.post("/api/emails/clear", (req, res) => {
    const { username } = req.body;
    const trimmedUsername = username?.trim();
    console.log(`[Email Clear] START: Request for username: "${trimmedUsername}"`);
    
    if (!trimmedUsername) {
      console.log(`[Email Clear] ERROR: No username provided`);
      return res.status(400).json({ error: "Username is required" });
    }

    const user = db.prepare("SELECT id FROM users WHERE username = ?").get(trimmedUsername) as any;
    if (!user) {
      console.log(`[Email Clear] ERROR: User "${trimmedUsername}" not found`);
      return res.status(404).json({ error: "User not found" });
    }

    console.log(`[Email Clear] Found user_id: ${user.id} for username: "${trimmedUsername}"`);
    
    // Count before delete
    const beforeCount = db.prepare("SELECT COUNT(*) as count FROM emails WHERE user_id = ?").get(user.id) as any;
    console.log(`[Email Clear] Emails before deletion for user_id ${user.id}: ${beforeCount.count}`);

    const result = db.prepare("DELETE FROM emails WHERE user_id = ?").run(user.id);
    console.log(`[Email Clear] DELETE executed. Changes: ${result.changes}`);
    
    // Count after delete
    const afterCount = db.prepare("SELECT COUNT(*) as count FROM emails WHERE user_id = ?").get(user.id) as any;
    console.log(`[Email Clear] Emails after deletion for user_id ${user.id}: ${afterCount.count}`);
    
    res.json({ success: true, deleted: result.changes, remaining: afterCount.count });
  });

  app.get("/api/emails/list", (req, res) => {
    const { username } = req.query;
    const trimmedUsername = (username as string)?.trim();
    const user = db.prepare("SELECT id FROM users WHERE username = ?").get(trimmedUsername) as any;
    if (!user) return res.status(404).json({ error: "User not found" });

    const emails = db.prepare("SELECT * FROM emails WHERE user_id = ? ORDER BY id DESC").all(user.id);
    res.json({ success: true, emails });
  });

  app.delete("/api/emails/:id", (req, res) => {
    const { id } = req.params;
    console.log(`[Email Delete] Request to delete email ID: ${id}`);
    try {
      const result = db.prepare("DELETE FROM emails WHERE id = ?").run(id);
      console.log(`[Email Delete] Result:`, result);
      res.json({ success: true });
    } catch (err: any) {
      console.error(`[Email Delete] Error:`, err.message);
      res.status(500).json({ error: "Failed to delete email" });
    }
  });

  // Proxy for DaisySMS to avoid CORS
  app.get("/api/daisysms", async (req, res) => {
    try {
      const { action, api_key, service, id, carriers, operator, max_price } = req.query;
      
      if (!api_key || !action) {
        return res.status(400).send("ERROR: Missing api_key or action");
      }

      const params = new URLSearchParams();
      params.append("api_key", api_key as string);
      params.append("action", action as string);
      if (service) params.append("service", service as string);
      if (id) params.append("id", id as string);
      if (max_price) params.append("max_price", max_price as string);
      
      const carrierVal = carriers || operator;
      if (carrierVal) params.append("carriers", carrierVal as string);

      const url = `https://daisysms.com/stubs/handler_api.php?${params.toString()}`;
      console.log(`[DaisySMS Request] Action: ${action}, Service: ${service || 'N/A'}`);
      
      const response = await axios.get(url);
      const responseData = String(response.data);
      
      console.log(`[DaisySMS Response] ${responseData}`);
      res.send(responseData);
    } catch (error: any) {
      const status = error.response?.status || 500;
      const errorData = error.response?.data || error.message;
      console.error(`[DaisySMS Proxy Error] Status ${status}:`, errorData);
      res.status(status).send(errorData);
    }
  });

  // Accounts Endpoints
  app.get("/api/accounts", (req, res) => {
    const { username } = req.query;
    const user = db.prepare("SELECT id FROM users WHERE username = ?").get((username as string)?.trim()) as any;
    if (!user) return res.status(404).json({ error: "User not found" });
    const accounts = db.prepare("SELECT * FROM accounts WHERE user_id = ? ORDER BY created_at DESC").all(user.id);
    res.json({ accounts });
  });

  app.post("/api/accounts", (req, res) => {
    const { username, proxy_ip, proxy_port, proxy_username, proxy_city, phone_number, order_id, sms_code, sms_status } = req.body;
    const user = db.prepare("SELECT id FROM users WHERE username = ?").get((username as string)?.trim()) as any;
    if (!user) return res.status(404).json({ error: "User not found" });
    const result = db.prepare(`
      INSERT INTO accounts (user_id, proxy_ip, proxy_port, proxy_username, proxy_city, phone_number, order_id, sms_code, sms_status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(user.id, proxy_ip, proxy_port || 5000, proxy_username, proxy_city, phone_number || null, order_id || null, sms_code || null, sms_status || 'not_requested');
    const account = db.prepare("SELECT * FROM accounts WHERE id = ?").get(result.lastInsertRowid);
    res.json({ success: true, account });
  });

  app.patch("/api/accounts/:id", (req, res) => {
    const { phone_number, order_id, sms_code, sms_status, fraud_score, fraud_risk, status } = req.body;
    const updates: string[] = ["updated_at = datetime('now')"];
    const values: any[] = [];
    if (phone_number !== undefined) { updates.push("phone_number = ?"); values.push(phone_number); }
    if (order_id !== undefined) { updates.push("order_id = ?"); values.push(order_id); }
    if (sms_code !== undefined) { updates.push("sms_code = ?"); values.push(sms_code); }
    if (sms_status !== undefined) { updates.push("sms_status = ?"); values.push(sms_status); }
    if (fraud_score !== undefined) { updates.push("fraud_score = ?"); values.push(fraud_score); }
    if (fraud_risk !== undefined) { updates.push("fraud_risk = ?"); values.push(fraud_risk); }
    if (status !== undefined) { updates.push("status = ?"); values.push(status); }
    values.push(req.params.id);
    db.prepare(`UPDATE accounts SET ${updates.join(", ")} WHERE id = ?`).run(...values);
    const account = db.prepare("SELECT * FROM accounts WHERE id = ?").get(req.params.id);
    res.json({ success: true, account });
  });

  app.delete("/api/accounts/:id", (req, res) => {
    db.prepare("DELETE FROM accounts WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Fraud Check Proxy (scamalytics.com)
  app.get("/api/fraud-check", async (req, res) => {
    const { ip } = req.query;
    if (!ip) return res.status(400).json({ error: "IP required" });
    try {
      const response = await axios.get(`https://scamalytics.com/ip/${ip}`, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        timeout: 10000,
      });
      const html = String(response.data);
      // Extract fraud score: <div class="score">Fraud Score: <b>12</b></div> or similar
      const scoreMatch = html.match(/fraud score[^<]*?(\d+)/i) || html.match(/"score"[^>]*>(\d+)/i) || html.match(/>\s*(\d+)\s*<\/div>[\s\S]*?out of 100/i);
      const score = scoreMatch ? parseInt(scoreMatch[1]) : null;
      // Extract risk level
      const riskMatch = html.match(/(very high|high|medium|low)\s*risk/i);
      const risk = riskMatch ? riskMatch[1].toLowerCase() : null;
      res.json({ score, risk });
    } catch (err: any) {
      console.error("[FraudCheck Error]", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // Claude AI endpoint for generating Hinge prompts
  app.post("/api/claude/generate-prompts", async (req, res) => {
    try {
      const { city, nearbyPlace, job, apiKey } = req.body;

      const resolvedKey = apiKey || process.env.ANTHROPIC_API_KEY;
      if (!resolvedKey) {
        return res.status(500).json({ error: "Anthropic API Key fehlt. Bitte in den Einstellungen eintragen (AI Settings)." });
      }

      const anthropic = new Anthropic({ apiKey: resolvedKey });

      const prompt = `du bist ich: 21–24, gen z, casual dating / hookup-coded (aber hinge-safe, nicht explizit).
schreibe so, als wäre es schnell auf dem handy getippt: natürlich, leicht messy, nicht zu glatt, nicht "werbetext".

context:
proxy_city: ${city}
nearby_place_within_25km: ${nearbyPlace}
random_job: ${job}

aufgabe:
gib mir für diese 3 hinge prompts jeweils genau 3 optionen (insgesamt 9 optionen):
- i go crazy for
- the way to win me over
- a life goal of mine

regeln:
- alles all lower case
- cute + edgy + flirty, casual/hookup vibe aber hinge-safe (keine expliziten sex-words)
- 6–18 wörter, manche bis 22
- emojis sparsam (0–2)
- keine anführungszeichen
- keine wiederholten strukturen / angles
- keine standardfloskeln ständig ("looking for…" etc)

city regel (wichtig):
- pro prompt genau 3 optionen
- davon genau 1 option city-bezogen (verwende proxy_city ODER nearby_place_within_25km)
- die anderen 2 optionen dürfen NICHT city-bezogen sein

great answer regel (wichtig):
- genau 1 der 9 optionen (insgesamt) bekommt am ende: " — great answer"
- nur diese eine option darf das tag haben

format (WICHTIG):
genau 9 zeilen, ohne nummerierung.
jede zeile startet exakt so:

i go crazy for: <option>
i go crazy for: <option>
i go crazy for: <option>

the way to win me over is: <option>
the way to win me over is: <option>
the way to win me over is: <option>

a life goal of mine: <option>
a life goal of mine: <option>
a life goal of mine: <option>`;

      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      });

      const text = message.content[0].type === "text" ? message.content[0].text : "";

      const buckets: Record<string, string[]> = {
        "i go crazy for": [],
        "the way to win me over is": [],
        "a life goal of mine": [],
      };

      text.split("\n").forEach(line => {
        const lower = line.toLowerCase().trim();
        if (lower.startsWith("i go crazy for:")) {
          buckets["i go crazy for"].push(line.split(":")[1].trim());
        } else if (lower.startsWith("the way to win me over is:")) {
          buckets["the way to win me over is"].push(line.split(":")[1].trim());
        } else if (lower.startsWith("a life goal of mine:")) {
          buckets["a life goal of mine"].push(line.split(":")[1].trim());
        }
      });

      console.log(`[Claude] Generated prompts for city: ${city}, job: ${job}`);
      res.json(buckets);
    } catch (error: any) {
      console.error("[Claude Error]", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Proxy for Overpass API to avoid CORS
  app.post("/api/overpass", async (req, res) => {
    try {
      const { query } = req.body;
      const response = await axios.post("https://overpass-api.de/api/interpreter", query);
      res.json(response.data);
    } catch (error: any) {
      console.error("Overpass Proxy Error:", error.message);
      res.status(500).send("Error communicating with Overpass");
    }
  });

  // Static pages (always served regardless of mode)
  app.get("/iplocation", (req, res) => {
    res.sendFile(path.join(process.cwd(), "public", "iplocation.html"));
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
