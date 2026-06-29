// ============================================================================
// SERVER.JS - Minecraft Bot Dashboard v4.0
// ============================================================================

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs");
const BotManager = require("./bot-manager");

// ============================================================================
// UUID - tự viết không cần package
// ============================================================================

function uuidv4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ============================================================================
// LOGGER
// ============================================================================

class Logger {
  constructor() {
    this.logs = [];
    this.maxLogs = 3000;
    this.listeners = new Set();
  }

  addListener(cb) {
    this.listeners.add(cb);
  }
  removeListener(cb) {
    this.listeners.delete(cb);
  }

  notify(entry) {
    for (const cb of this.listeners) {
      try {
        cb(entry);
      } catch (e) {}
    }
  }

  fmt() {
    return new Date().toISOString().replace("T", " ").substring(0, 19);
  }

  log(level, category, message) {
    const entry = {
      id: uuidv4(),
      timestamp: Date.now(),
      time: this.fmt(),
      level,
      category,
      message,
    };

    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-Math.floor(this.maxLogs / 2));
    }

    const colors = {
      debug: "\x1b[36m",
      info: "\x1b[32m",
      warn: "\x1b[33m",
      error: "\x1b[31m",
    };
    const reset = "\x1b[0m";
    console.log(
      `${colors[level] || ""}[${entry.time}] [${level.toUpperCase()}] [${category}]${reset} ${message}`,
    );

    this.notify(entry);
    return entry;
  }

  debug(cat, msg) {
    return this.log("debug", cat, msg);
  }
  info(cat, msg) {
    return this.log("info", cat, msg);
  }
  warn(cat, msg) {
    return this.log("warn", cat, msg);
  }
  error(cat, msg) {
    return this.log("error", cat, msg);
  }

  getLogs(opts = {}) {
    let list = [...this.logs];
    if (opts.level) list = list.filter((l) => l.level === opts.level);
    if (opts.category) list = list.filter((l) => l.category === opts.category);
    if (opts.search)
      list = list.filter((l) =>
        l.message.toLowerCase().includes(opts.search.toLowerCase()),
      );
    return list.slice(-(opts.limit || 200));
  }

  clear() {
    this.logs = [];
  }
}

// ============================================================================
// STATS TRACKER
// ============================================================================

class StatsTracker {
  constructor() {
    this.stats = new Map();
    this.global = {
      totalBotsCreated: 0,
      totalMessagesReceived: 0,
      totalMessagesSent: 0,
      totalBlocksMined: 0,
      totalBlocksPlaced: 0,
      totalMobsKilled: 0,
      totalDeaths: 0,
      totalItemsCollected: 0,
      serverUptime: Date.now(),
    };
  }

  initBot(botId) {
    this.stats.set(botId, {
      created: Date.now(),
      connected: null,
      disconnected: null,
      messagesReceived: 0,
      messagesSent: 0,
      blocksMined: 0,
      blocksPlaced: 0,
      mobsKilled: 0,
      deaths: 0,
      itemsCollected: 0,
      connections: 0,
      healthHistory: [],
      chatHistory: [],
      positionHistory: [],
      eventCounts: {},
    });
    this.global.totalBotsCreated++;
  }

  updateStat(botId, stat, val = 1) {
    const s = this.stats.get(botId);
    if (s && typeof s[stat] === "number") s[stat] += val;
    const gk = `total${stat.charAt(0).toUpperCase() + stat.slice(1)}`;
    if (gk in this.global && typeof this.global[gk] === "number") {
      this.global[gk] += val;
    }
  }

  setStat(botId, stat, val) {
    const s = this.stats.get(botId);
    if (s) s[stat] = val;
  }

  addToHistory(botId, type, entry) {
    const s = this.stats.get(botId);
    if (s && Array.isArray(s[type])) {
      s[type].push({ timestamp: Date.now(), ...entry });
      if (s[type].length > 300) s[type] = s[type].slice(-150);
    }
  }

  trackEvent(botId, name) {
    const s = this.stats.get(botId);
    if (s) s.eventCounts[name] = (s.eventCounts[name] || 0) + 1;
  }

  updatePosition(botId, pos) {
    const s = this.stats.get(botId);
    if (s && pos) {
      s.positionHistory.push({
        timestamp: Date.now(),
        x: Math.round(pos.x * 10) / 10,
        y: Math.round(pos.y * 10) / 10,
        z: Math.round(pos.z * 10) / 10,
      });
      if (s.positionHistory.length > 100) {
        s.positionHistory = s.positionHistory.slice(-50);
      }
    }
  }

  getBotStats(botId) {
    return this.stats.get(botId) || null;
  }
  removeBot(botId) {
    this.stats.delete(botId);
  }

  getGlobalStats() {
    return {
      ...this.global,
      uptimeSeconds: Math.floor((Date.now() - this.global.serverUptime) / 1000),
      activeBots: this.stats.size,
    };
  }

  getAllStats() {
    const bots = {};
    for (const [id, s] of this.stats) bots[id] = { ...s };
    return { global: this.getGlobalStats(), bots };
  }
}

// ============================================================================
// DASHBOARD SERVER
// ============================================================================

class DashboardServer {
  constructor() {
    this.logger = new Logger();
    this.statsTracker = new StatsTracker();
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = new Server(this.server, {
      cors: { origin: "*", methods: ["GET", "POST"] },
      pingTimeout: 60000,
      pingInterval: 25000,
      maxHttpBufferSize: 1e8,
    });
    this.botManager = new BotManager(this.logger, this.statsTracker, this.io);
    this.connectedClients = new Map();
    this.config = this.loadConfig();

    this.setupMiddleware();
    this.setupStatic();
    this.setupAPI();
    this.setupSocket();
    this.setupPeriodic();
  }

  // ========================================================================
  // CONFIG
  // ========================================================================

  loadConfig() {
    const def = {
      webPort: 3000,
      maxBots: 10,
      defaultServer: { host: "localhost", port: 25565, version: "1.20.1" },
    };
    try {
      const p = path.join(__dirname, "config.json");
      if (fs.existsSync(p)) {
        return { ...def, ...JSON.parse(fs.readFileSync(p, "utf8")) };
      }
    } catch (e) {}
    return def;
  }

  // ========================================================================
  // MIDDLEWARE
  // ========================================================================

  setupMiddleware() {
    this.app.use(express.json({ limit: "10mb" }));
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use((req, res, next) => {
      res.header("Access-Control-Allow-Origin", "*");
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS",
      );
      res.header("Access-Control-Allow-Headers", "Content-Type");
      if (req.method === "OPTIONS") return res.sendStatus(200);
      next();
    });
  }

  setupStatic() {
    this.app.use(express.static(path.join(__dirname, "public")));
  }

  // ========================================================================
  // REST API
  // ========================================================================

  setupAPI() {
    // Health check
    this.app.get("/api/health", (req, res) => {
      res.json({
        status: "ok",
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: Date.now(),
        version: "4.0.0",
        activeBots: this.botManager.getBotCount(),
        clients: this.connectedClients.size,
      });
    });

    // Get all bots
    this.app.get("/api/bots", (req, res) => {
      try {
        res.json({ success: true, bots: this.botManager.getAllBotsInfo() });
      } catch (e) {
        res.status(500).json({ success: false, error: e.message });
      }
    });

    // Get bot
    this.app.get("/api/bots/:id", (req, res) => {
      try {
        const bot = this.botManager.getBotInfo(req.params.id);
        if (!bot)
          return res
            .status(404)
            .json({ success: false, error: "Bot not found" });
        res.json({ success: true, bot });
      } catch (e) {
        res.status(500).json({ success: false, error: e.message });
      }
    });

    // Create bot
    this.app.post("/api/bots", (req, res) => {
      try {
        const { username, host, port, version, auth } = req.body;
        if (!username) {
          return res
            .status(400)
            .json({ success: false, error: "Username required" });
        }
        if (this.botManager.getBotCount() >= (this.config.maxBots || 10)) {
          return res
            .status(400)
            .json({ success: false, error: "Max bot limit reached" });
        }
        const botId = this.botManager.createBot({
          username,
          host: host || this.config.defaultServer.host,
          port: port || this.config.defaultServer.port,
          version: version || this.config.defaultServer.version,
          auth: auth || "offline",
        });
        res.json({ success: true, botId });
      } catch (e) {
        res.status(500).json({ success: false, error: e.message });
      }
    });

    // Delete bot
    this.app.delete("/api/bots/:id", (req, res) => {
      try {
        this.botManager.removeBot(req.params.id);
        res.json({ success: true });
      } catch (e) {
        res.status(500).json({ success: false, error: e.message });
      }
    });

    // Bot action
    this.app.post("/api/bots/:id/action", async (req, res) => {
      try {
        const { action, params } = req.body;
        await this.botManager.executeAction(
          req.params.id,
          action,
          params || {},
        );
        res.json({ success: true });
      } catch (e) {
        res.status(500).json({ success: false, error: e.message });
      }
    });

    // Inventory
    this.app.get("/api/bots/:id/inventory", (req, res) => {
      try {
        res.json({
          success: true,
          inventory: this.botManager.getInventory(req.params.id),
        });
      } catch (e) {
        res.status(500).json({ success: false, error: e.message });
      }
    });

    // Entities
    this.app.get("/api/bots/:id/entities", (req, res) => {
      try {
        res.json({
          success: true,
          entities: this.botManager.getNearbyEntities(req.params.id),
        });
      } catch (e) {
        res.status(500).json({ success: false, error: e.message });
      }
    });

    // Players
    this.app.get("/api/bots/:id/players", (req, res) => {
      try {
        res.json({
          success: true,
          players: this.botManager.getPlayers(req.params.id),
        });
      } catch (e) {
        res.status(500).json({ success: false, error: e.message });
      }
    });

    // Stats
    this.app.get("/api/stats", (req, res) => {
      res.json({ success: true, stats: this.statsTracker.getAllStats() });
    });

    this.app.get("/api/stats/:id", (req, res) => {
      const stats = this.statsTracker.getBotStats(req.params.id);
      if (!stats)
        return res.status(404).json({ success: false, error: "Not found" });
      res.json({ success: true, stats });
    });

    // Logs
    this.app.get("/api/logs", (req, res) => {
      res.json({
        success: true,
        logs: this.logger.getLogs({
          level: req.query.level,
          category: req.query.category,
          search: req.query.search,
          limit: parseInt(req.query.limit) || 200,
        }),
      });
    });

    this.app.delete("/api/logs", (req, res) => {
      this.logger.clear();
      res.json({ success: true });
    });

    // Config
    this.app.get("/api/config", (req, res) => {
      res.json({ success: true, config: this.config });
    });

    // Catch-all → index.html
    this.app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "public", "index.html"));
    });
  }

  // ========================================================================
  // SOCKET.IO
  // ========================================================================

  setupSocket() {
    this.io.on("connection", (socket) => {
      const clientId = socket.id;
      this.connectedClients.set(clientId, {
        id: clientId,
        connectedAt: Date.now(),
        subscribedBots: new Set(),
      });

      this.logger.info("Socket", `Client connected: ${clientId}`);

      // Gửi dữ liệu khởi đầu
      socket.emit("init", {
        bots: this.botManager.getAllBotsInfo(),
        stats: this.statsTracker.getGlobalStats(),
        config: this.config,
      });

      // ---- TẠO BOT ----
      socket.on("bot:create", (data, cb) => {
        try {
          if (this.botManager.getBotCount() >= (this.config.maxBots || 10)) {
            if (cb) cb({ success: false, error: "Max bot limit reached" });
            return;
          }
          const botId = this.botManager.createBot({
            username: data.username,
            host: data.host || this.config.defaultServer.host,
            port: data.port || this.config.defaultServer.port,
            version: data.version || this.config.defaultServer.version,
            auth: data.auth || "offline",
          });
          if (cb) cb({ success: true, botId });
          this.io.emit("bot:created", this.botManager.getBotInfo(botId));
        } catch (e) {
          this.logger.error("Socket", `Create bot failed: ${e.message}`);
          if (cb) cb({ success: false, error: e.message });
        }
      });

      // ---- XÓA BOT ----
      socket.on("bot:remove", (data, cb) => {
        try {
          this.botManager.removeBot(data.botId);
          if (cb) cb({ success: true });
          this.io.emit("bot:removed", { botId: data.botId });
        } catch (e) {
          if (cb) cb({ success: false, error: e.message });
        }
      });

      // ---- RECONNECT ----
      socket.on("bot:reconnect", (data, cb) => {
        try {
          this.botManager.reconnectBot(data.botId);
          if (cb) cb({ success: true });
        } catch (e) {
          if (cb) cb({ success: false, error: e.message });
        }
      });

      // ---- ACTION ----
      socket.on("bot:action", async (data, cb) => {
        try {
          await this.botManager.executeAction(
            data.botId,
            data.action,
            data.params || {},
          );
          if (cb) cb({ success: true });
        } catch (e) {
          this.logger.error(
            "Socket",
            `Action ${data.action} failed: ${e.message}`,
          );
          if (cb) cb({ success: false, error: e.message });
        }
      });

      // ---- CHAT ----
      socket.on("bot:chat", (data, cb) => {
        try {
          this.botManager.sendChat(data.botId, data.message);
          if (cb) cb({ success: true });
        } catch (e) {
          if (cb) cb({ success: false, error: e.message });
        }
      });

      // ---- INVENTORY ----
      socket.on("bot:inventory", (data, cb) => {
        try {
          const inventory = this.botManager.getInventory(data.botId);
          if (cb) cb({ success: true, inventory });
        } catch (e) {
          if (cb) cb({ success: false, error: e.message });
        }
      });

      // ---- SUBSCRIBE ----
      socket.on("bot:subscribe", (data) => {
        const client = this.connectedClients.get(clientId);
        if (client) {
          client.subscribedBots.add(data.botId);
          socket.join(`bot:${data.botId}`);
        }
      });

      socket.on("bot:unsubscribe", (data) => {
        const client = this.connectedClients.get(clientId);
        if (client) {
          client.subscribedBots.delete(data.botId);
          socket.leave(`bot:${data.botId}`);
        }
      });

      // ---- REQUEST STATUS ----
      socket.on("request:status", (data, cb) => {
        try {
          if (cb)
            cb({
              success: true,
              bots: this.botManager.getAllBotsInfo(),
              stats: this.statsTracker.getAllStats(),
            });
        } catch (e) {
          if (cb) cb({ success: false, error: e.message });
        }
      });

      // ---- REQUEST LOGS ----
      socket.on("request:logs", (data, cb) => {
        try {
          if (cb) cb({ success: true, logs: this.logger.getLogs(data || {}) });
        } catch (e) {
          if (cb) cb({ success: false, error: e.message });
        }
      });

      // ---- DISCONNECT ----
      socket.on("disconnect", (reason) => {
        this.connectedClients.delete(clientId);
        this.logger.info(
          "Socket",
          `Client disconnected: ${clientId} (${reason})`,
        );
      });
    });

    // Forward logs → clients
    this.logger.addListener((entry) => {
      this.io.emit("log", entry);
    });
  }

  // ========================================================================
  // PERIODIC TASKS
  // ========================================================================

  setupPeriodic() {
    // Status update mỗi 1 giây
    setInterval(() => {
      try {
        this.io.emit("status:update", {
          bots: this.botManager.getAllBotsInfo(),
          stats: this.statsTracker.getGlobalStats(),
          timestamp: Date.now(),
        });
      } catch (e) {}
    }, 1000);

    // Detailed update mỗi 2 giây
    setInterval(() => {
      try {
        const detailed = this.botManager.getAllBotsDetailed();
        for (const bot of detailed) {
          this.io.to(`bot:${bot.id}`).emit("bot:detail", bot);
        }
      } catch (e) {}
    }, 2000);
  }

  // ========================================================================
  // START - Railway fix
  // ========================================================================

  start() {
    const port = process.env.PORT || this.config.webPort || 3000;

    this.server.listen(port, "0.0.0.0", () => {
      this.logger.info("Server", "========================================");
      this.logger.info("Server", "  Minecraft Bot Dashboard v4.0.0");
      this.logger.info("Server", `  Port: ${port}`);
      this.logger.info("Server", `  Max bots: ${this.config.maxBots || 10}`);
      this.logger.info("Server", "========================================");
    });

    process.on("SIGINT", () => this.shutdown());
    process.on("SIGTERM", () => this.shutdown());

    process.on("uncaughtException", (err) => {
      this.logger.error("System", `Uncaught: ${err.message}`);
    });

    process.on("unhandledRejection", (reason) => {
      this.logger.error("System", `Unhandled rejection: ${reason}`);
    });
  }

  shutdown() {
    this.logger.info("Server", "Shutting down...");
    this.botManager.removeAllBots();
    this.server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000);
  }
}

// ============================================================================
// ENTRY POINT
// ============================================================================

const server = new DashboardServer();
server.start();

module.exports = DashboardServer;
