// ============================================================================
// BOT-MANAGER.JS - KillAura Edition - No native modules
// ============================================================================

const mineflayer = require('mineflayer');

function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

const FOOD_DATABASE = {
    golden_carrot:          { foodPoints: 6,  saturation: 14.4 },
    cooked_porkchop:        { foodPoints: 8,  saturation: 12.8 },
    cooked_beef:            { foodPoints: 8,  saturation: 12.8 },
    cooked_mutton:          { foodPoints: 6,  saturation: 9.6  },
    cooked_chicken:         { foodPoints: 6,  saturation: 7.2  },
    cooked_rabbit:          { foodPoints: 5,  saturation: 6.0  },
    cooked_salmon:          { foodPoints: 6,  saturation: 9.6  },
    cooked_cod:             { foodPoints: 5,  saturation: 6.0  },
    mushroom_stew:          { foodPoints: 6,  saturation: 7.2  },
    rabbit_stew:            { foodPoints: 10, saturation: 12.0 },
    beetroot_soup:          { foodPoints: 6,  saturation: 7.2  },
    bread:                  { foodPoints: 5,  saturation: 6.0  },
    baked_potato:           { foodPoints: 5,  saturation: 6.0  },
    pumpkin_pie:            { foodPoints: 8,  saturation: 4.8  },
    apple:                  { foodPoints: 4,  saturation: 2.4  },
    golden_apple:           { foodPoints: 4,  saturation: 9.6  },
    enchanted_golden_apple: { foodPoints: 4,  saturation: 9.6  },
    melon_slice:            { foodPoints: 2,  saturation: 1.2  },
    sweet_berries:          { foodPoints: 2,  saturation: 0.4  },
    glow_berries:           { foodPoints: 2,  saturation: 0.4  },
    carrot:                 { foodPoints: 3,  saturation: 3.6  },
    potato:                 { foodPoints: 1,  saturation: 0.6  },
    beetroot:               { foodPoints: 1,  saturation: 1.2  },
    dried_kelp:             { foodPoints: 1,  saturation: 0.6  },
    cookie:                 { foodPoints: 2,  saturation: 0.4  },
    honey_bottle:           { foodPoints: 6,  saturation: 1.2  },
    chorus_fruit:           { foodPoints: 4,  saturation: 2.4  },
    beef:                   { foodPoints: 3,  saturation: 1.8  },
    porkchop:               { foodPoints: 3,  saturation: 1.8  },
    mutton:                 { foodPoints: 2,  saturation: 1.2  },
    chicken:                { foodPoints: 2,  saturation: 1.2  },
    rabbit:                 { foodPoints: 3,  saturation: 1.8  },
    salmon:                 { foodPoints: 2,  saturation: 0.4  },
    cod:                    { foodPoints: 2,  saturation: 0.4  },
    rotten_flesh:           { foodPoints: 4,  saturation: 0.8  },
    spider_eye:             { foodPoints: 2,  saturation: 3.2  },
    poisonous_potato:       { foodPoints: 2,  saturation: 1.2  },
    pufferfish:             { foodPoints: 1,  saturation: 0.2  }
};

function getAttackCooldown(version) {
    if (!version) return 625;
    const v = parseFloat(String(version).replace(/[^0-9.]/g, ''));
    return v <= 1.8 ? 125 : 625;
}

const MathUtils = {
    getRotationTo(from, to) {
        const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
        const d2D = Math.sqrt(dx * dx + dz * dz);
        return {
            yaw:   -Math.atan2(dx, dz) * (180 / Math.PI),
            pitch: -Math.atan2(dy, d2D) * (180 / Math.PI)
        };
    },
    angleBetween(y1, p1, y2, p2) {
        const r = Math.PI / 180;
        const v1 = { x: -Math.sin(y1*r)*Math.cos(p1*r), y: -Math.sin(p1*r), z: Math.cos(y1*r)*Math.cos(p1*r) };
        const v2 = { x: -Math.sin(y2*r)*Math.cos(p2*r), y: -Math.sin(p2*r), z: Math.cos(y2*r)*Math.cos(p2*r) };
        const dot = v1.x*v2.x + v1.y*v2.y + v1.z*v2.z;
        return Math.acos(Math.max(-1, Math.min(1, dot))) * (180 / Math.PI);
    },
    distance3D(a, b) {
        return Math.sqrt((a.x-b.x)**2 + (a.y-b.y)**2 + (a.z-b.z)**2);
    }
};

class BotWrapper {
    constructor(id, options, logger, statsTracker, io) {
        this.id           = id;
        this.options      = options;
        this.logger       = logger;
        this.statsTracker = statsTracker;
        this.io           = io;
        this.bot          = null;
        this.status       = 'created';
        this.error        = null;
        this.createdAt    = Date.now();
        this.connectedAt  = null;
        this.destroyed    = false;

        this.autoReconnect        = true;
        this.reconnectTimer       = null;
        this.reconnectAttempts    = 0;
        this.maxReconnectAttempts = 15;
        this.isReconnecting       = false;
        this.lastDisconnectTime   = 0;
        this.lastKickReason       = '';

        this.chatHistory    = [];
        this.maxChatHistory = 200;

        this.autoEatState = {
            enabled: false, eating: false, startAt: 14,
            bannedFood: ['rotten_flesh', 'spider_eye', 'poisonous_potato', 'pufferfish'],
            lastEat: 0, cooldown: 5000
        };

        this.killaura = {
            enabled: false, range: 4.5, speed: 0, priority: 'angle',
            fov: 360, cooldownMs: 625, targetTypes: ['hostile'],
            currentTarget: null, lastAttack: 0, totalClicks: 0,
            containerOpen: false, pauseOnContainers: true,
            filterAnimals: true, filterPlayers: false,
            serverYaw: 0, serverPitch: 0
        };

        this.autoFeatures = { eat: false, killaura: false };
        this.intervals    = {};
        this.timers       = {};
        this.currentTask  = null;

        this.statsTracker.initBot(this.id);
    }

    connect() {
        if (this.destroyed || this.isReconnecting) return;
        if (this.bot) this.cleanupBot();

        this.status = 'connecting';
        this.error  = null;
        this.emitUpdate();

        try {
            this.bot = mineflayer.createBot({
                host:                 this.options.host,
                port:                 parseInt(this.options.port) || 25565,
                username:             this.options.username,
                version:              this.options.version || false,
                auth:                 this.options.auth || 'offline',
                hideErrors:           false,
                checkTimeoutInterval: 60000,
                keepAlive:            true,
                physicsEnabled:       false,
            });

            this.setupEvents();
            this.logger.info('Bot', `[${this.options.username}] Kết nối ${this.options.host}:${this.options.port}...`);
        } catch (err) {
            this.status = 'error';
            this.error  = err.message;
            this.logger.error('Bot', `[${this.options.username}] Lỗi: ${err.message}`);
            this.emitUpdate();
        }
    }

    cleanupBot() {
        if (!this.bot) return;
        this.stopAllAuto();
        try { this.bot.removeAllListeners(); } catch (e) {}
        try { this.bot.quit('cleanup'); }     catch (e) {}
        this.bot = null;
    }

    setupEvents() {
        if (!this.bot) return;

        this.bot.on('login', () => {
            if (this.destroyed) return;
            this.status            = 'online';
            this.connectedAt       = Date.now();
            this.reconnectAttempts = 0;
            this.isReconnecting    = false;
            this.error             = null;
            this.lastKickReason    = '';
            this.killaura.cooldownMs = getAttackCooldown(this.bot.version);
            this.statsTracker.setStat(this.id, 'connected', Date.now());
            this.logger.info('Bot', `[${this.options.username}] ✅ Online! v${this.bot.version} cd:${this.killaura.cooldownMs}ms`);
            this.emitUpdate();
        });

        this.bot.on('spawn', () => {
            if (this.destroyed) return;
            this.status = 'online';
            this.logger.info('Bot', `[${this.options.username}] 🌍 Spawn`);
            this.statsTracker.trackEvent(this.id, 'spawn');
            this.emitUpdate();

            clearTimeout(this.timers.spawn);
            this.timers.spawn = setTimeout(() => {
                if (!this.destroyed && this.status === 'online') {
                    if (this.autoEatState.enabled)  this.startAutoEat();
                    if (this.killaura.enabled)       this.startKillaura({
                        range: this.killaura.range, speed: this.killaura.speed,
                        priority: this.killaura.priority, fov: this.killaura.fov,
                        targetTypes: this.killaura.targetTypes
                    });
                }
            }, 2000);
        });

        this.bot.on('health', () => {
            if (!this.bot || this.destroyed) return;
            const health = this.bot.health || 0, food = this.bot.food || 0;
            this.io.to(`bot:${this.id}`).emit('bot:health', {
                botId: this.id, health, food, saturation: this.bot.foodSaturation || 0
            });
            this.statsTracker.addToHistory(this.id, 'healthHistory', { health, food });
            if (this.autoEatState.enabled && !this.autoEatState.eating && food <= this.autoEatState.startAt) {
                this.tryAutoEat().catch(() => {});
            }
        });

        this.bot.on('death', () => {
            if (this.destroyed) return;
            this.autoEatState.eating    = false;
            this.killaura.currentTarget = null;
            this.statsTracker.updateStat(this.id, 'deaths');
            this.logger.warn('Bot', `[${this.options.username}] 💀 Chết`);
            this.addChat({ type: 'system', message: '💀 Bot đã chết!', timestamp: Date.now() });
            this.io.to(`bot:${this.id}`).emit('bot:death', { botId: this.id });
        });

        this.bot.on('respawn', () => {
            if (this.destroyed) return;
            this.killaura.currentTarget = null;
            this.killaura.containerOpen = false;
        });

        this.bot.on('windowOpen',  () => { if (this.killaura.pauseOnContainers) this.killaura.containerOpen = true; });
        this.bot.on('windowClose', () => { this.killaura.containerOpen = false; });

        this.bot.on('chat', (username, message) => {
            if (this.destroyed || !this.bot || username === this.bot.username) return;
            this.statsTracker.updateStat(this.id, 'messagesReceived');
            const entry = { type: 'chat', username, message, timestamp: Date.now() };
            this.addChat(entry);
            this.io.to(`bot:${this.id}`).emit('bot:chat', { botId: this.id, ...entry });
            this.handleChatCmd(username, message);
        });

        this.bot.on('whisper', (username, message) => {
            if (this.destroyed) return;
            const entry = { type: 'whisper', username, message, timestamp: Date.now() };
            this.addChat(entry);
            this.io.to(`bot:${this.id}`).emit('bot:chat', { botId: this.id, ...entry });
        });

        this.bot.on('message', (jsonMsg) => {
            if (this.destroyed) return;
            try {
                const text = jsonMsg.toString();
                if (text?.trim()) {
                    const entry = { type: 'system', message: text.trim(), timestamp: Date.now() };
                    this.addChat(entry);
                    this.io.to(`bot:${this.id}`).emit('bot:message', { botId: this.id, ...entry });
                }
            } catch (e) {}
        });

        this.bot.on('kicked', (reason) => {
            if (this.destroyed) return;
            this.killaura.currentTarget = null;
            let rs = typeof reason === 'string' ? reason : '';
            if (typeof reason === 'object') { try { rs = JSON.stringify(reason); } catch (e) { rs = String(reason); } }
            this.lastKickReason     = rs;
            this.lastDisconnectTime = Date.now();
            this.status             = 'kicked';
            this.error              = this.parseKickReason(rs);
            this.logger.warn('Bot', `[${this.options.username}] ⚠️ Kick: ${this.error}`);
            this.emitUpdate();
            this.handleKick(rs);
        });

        this.bot.on('error', (err) => {
            if (this.destroyed) return;
            const ignored = ['ECONNRESET','ETIMEDOUT','EPIPE','ECONNREFUSED','EHOSTUNREACH'];
            if (!ignored.some(e => err.message?.includes(e))) {
                this.logger.error('Bot', `[${this.options.username}] ❌ ${err.message}`);
            }
        });

        this.bot.on('end', (reason) => {
            if (this.destroyed) return;
            const now = Date.now(), justKicked = (now - this.lastDisconnectTime) < 2000 && this.lastKickReason;
            this.lastDisconnectTime = now;
            this.killaura.currentTarget = null;
            if (this.status !== 'kicked') this.status = 'offline';
            this.logger.info('Bot', `[${this.options.username}] 🔌 Disconnect: ${reason || 'unknown'}`);
            this.emitUpdate();
            if (!justKicked) this.scheduleReconnect(8000);
        });

        this.bot.on('playerJoined', (p) => {
            if (this.destroyed) return;
            this.io.to(`bot:${this.id}`).emit('bot:playerJoined', { botId: this.id, player: { username: p.username, uuid: p.uuid } });
        });

        this.bot.on('playerLeft', (p) => {
            if (this.destroyed) return;
            this.io.to(`bot:${this.id}`).emit('bot:playerLeft', { botId: this.id, player: { username: p.username, uuid: p.uuid } });
        });

        this.bot.on('entityDead', (entity) => {
            if (this.destroyed || !entity) return;
            if (entity.type === 'hostile' || entity.kind === 'Hostile mobs') this.statsTracker.updateStat(this.id, 'mobsKilled');
            if (this.killaura.currentTarget?.id === entity.id) this.killaura.currentTarget = null;
        });

        this.bot.on('entityHurt', (entity) => {
            if (this.destroyed || !this.bot?.entity) return;
            if (entity === this.bot.entity) this.io.to(`bot:${this.id}`).emit('bot:hurt', { botId: this.id, health: this.bot.health });
        });

        this.bot.on('playerCollect', (collector) => {
            if (this.destroyed || !this.bot?.entity) return;
            if (collector?.id === this.bot.entity?.id) this.statsTracker.updateStat(this.id, 'itemsCollected');
        });

        this.bot.on('time', () => {
            if (this.destroyed || !this.bot?.time) return;
            this.io.to(`bot:${this.id}`).emit('bot:time', { botId: this.id, timeOfDay: this.bot.time.timeOfDay, day: this.bot.time.day });
        });

        this.bot.on('rain', () => {
            if (this.destroyed || !this.bot) return;
            this.io.to(`bot:${this.id}`).emit('bot:weather', { botId: this.id, raining: this.bot.isRaining, thundering: this.bot.thunderState > 0 });
        });
    }

    // ========================================================================
    // KILLAURA
    // ========================================================================

    startKillaura(options = {}) {
        if (options.range       !== undefined) this.killaura.range       = Math.min(parseFloat(options.range) || 4.5, 6);
        if (options.speed       !== undefined) this.killaura.speed       = Math.min(parseFloat(options.speed) || 0, 12);
        if (options.priority    !== undefined) this.killaura.priority    = options.priority;
        if (options.fov         !== undefined) this.killaura.fov         = Math.min(parseFloat(options.fov) || 360, 360);
        if (Array.isArray(options.targetTypes)) this.killaura.targetTypes = options.targetTypes;
        if (options.filterAnimals  !== undefined) this.killaura.filterAnimals  = !!options.filterAnimals;
        if (options.filterPlayers  !== undefined) this.killaura.filterPlayers  = !!options.filterPlayers;
        if (options.pauseOnContainers !== undefined) this.killaura.pauseOnContainers = !!options.pauseOnContainers;

        const v = parseFloat(String(this.bot?.version || '1.9').replace(/[^0-9.]/g, ''));
        this.killaura.cooldownMs = this.killaura.speed === 0
            ? (v <= 1.8 ? 125 : 625)
            : Math.floor(1000 / Math.min(this.killaura.speed, 12));

        this.killaura.enabled       = true;
        this.killaura.totalClicks   = 0;
        this.killaura.currentTarget = null;
        this.autoFeatures.killaura  = true;

        if (this.intervals.killaura) { clearInterval(this.intervals.killaura); delete this.intervals.killaura; }

        this.intervals.killaura = setInterval(() => this.doKillaura(), this.killaura.cooldownMs);
        this.logger.info('Bot', `[${this.options.username}] ⚔️ KillAura ON | ${this.killaura.cooldownMs}ms | ${this.killaura.priority} | range:${this.killaura.range}`);
    }

    stopKillaura() {
        this.killaura.enabled       = false;
        this.killaura.currentTarget = null;
        this.autoFeatures.killaura  = false;
        if (this.intervals.killaura) { clearInterval(this.intervals.killaura); delete this.intervals.killaura; }
        this.logger.info('Bot', `[${this.options.username}] ⚔️ KillAura OFF | Clicks: ${this.killaura.totalClicks}`);
    }

    doKillaura() {
        if (!this.killaura.enabled || !this.bot?.entity || this.destroyed) return;
        if (this.killaura.pauseOnContainers && this.killaura.containerOpen) return;

        const botPos  = this.bot.entity.position;
        const botEyeY = botPos.y + 1.62;

        let candidates = [];

        for (const entity of Object.values(this.bot.entities)) {
            if (!entity?.position || entity === this.bot.entity) continue;
            if (entity.username === this.bot.username) continue;

            const isHostile = entity.type === 'hostile' || entity.kind === 'Hostile mobs';
            const isPlayer  = entity.type === 'player';
            const isAnimal  = entity.kind === 'Passive mobs';

            const types = this.killaura.targetTypes;
            let ok = false;
            if (types.includes('all'))     ok = true;
            if (types.includes('hostile') && isHostile) ok = true;
            if (types.includes('player')  && isPlayer)  ok = true;
            if (types.includes('mob')     && entity.type === 'mob') ok = true;
            if (!ok) continue;

            if (this.killaura.filterAnimals && isAnimal)  continue;
            if (this.killaura.filterPlayers && isPlayer)  continue;

            const dist = MathUtils.distance3D(botPos, entity.position);
            if (dist > this.killaura.range) continue;

            const eyePos    = { x: botPos.x, y: botEyeY, z: botPos.z };
            const targetEyeY = entity.position.y + (entity.height || 1.8) * 0.9;
            const rot = MathUtils.getRotationTo(eyePos, { x: entity.position.x, y: targetEyeY, z: entity.position.z });

            const angle = MathUtils.angleBetween(this.killaura.serverYaw, this.killaura.serverPitch, rot.yaw, rot.pitch);
            if (this.killaura.fov < 360 && angle > this.killaura.fov / 2) continue;

            candidates.push({ entity, dist, angle, health: entity.health || 999, rot });
        }

        if (!candidates.length) { this.killaura.currentTarget = null; return; }

        switch (this.killaura.priority) {
            case 'distance': candidates.sort((a, b) => a.dist - b.dist); break;
            case 'health':   candidates.sort((a, b) => a.health - b.health); break;
            default:         candidates.sort((a, b) => a.angle - b.angle); break;
        }

        const { entity, dist, rot } = candidates[0];

        this.killaura.currentTarget = {
            id: entity.id, name: entity.name || entity.username || 'Unknown',
            type: entity.type, distance: Math.round(dist * 10) / 10, health: entity.health || null
        };

        this.killaura.serverYaw   = rot.yaw;
        this.killaura.serverPitch = rot.pitch;

        try { this.bot.look(rot.yaw, rot.pitch, false).catch(() => {}); } catch (e) {}

        try {
            this.bot.attack(entity);
            this.killaura.totalClicks++;
            if (this.killaura.totalClicks % 5 === 0) {
                this.io.to(`bot:${this.id}`).emit('bot:killaura', {
                    botId: this.id, target: this.killaura.currentTarget, totalClicks: this.killaura.totalClicks
                });
            }
        } catch (e) {}
    }

    // ========================================================================
    // LOOK
    // ========================================================================

    async lookAt(x, y, z) {
        if (!this.bot || this.status !== 'online') throw new Error('Bot chưa online');
        await this.bot.lookAt({ x: parseFloat(x), y: parseFloat(y), z: parseFloat(z) });
    }

    async lookAtEntity(entityId) {
        if (!this.bot || this.status !== 'online') throw new Error('Bot chưa online');
        const e = this.bot.entities[entityId];
        if (!e) throw new Error('Entity không tồn tại');
        await this.bot.lookAt(e.position.offset(0, (e.height || 1.8) * 0.8, 0));
    }

    async setLook(yaw, pitch) {
        if (!this.bot || this.status !== 'online') throw new Error('Bot chưa online');
        await this.bot.look(parseFloat(yaw), parseFloat(pitch));
        this.killaura.serverYaw   = parseFloat(yaw);
        this.killaura.serverPitch = parseFloat(pitch);
    }

    // ========================================================================
    // ATTACK MANUAL
    // ========================================================================

    async attackEntity(entityId) {
        if (!this.bot || this.status !== 'online') throw new Error('Bot chưa online');
        const entity = this.bot.entities[entityId];
        if (!entity) throw new Error('Entity không tồn tại');
        try { await this.bot.lookAt(entity.position.offset(0, (entity.height || 1.8) * 0.8, 0)); } catch (e) {}
        await this.bot.attack(entity);
    }

    async attackNearest(type = 'hostile') {
        if (!this.bot?.entity) throw new Error('Bot chưa online');
        const entity = this.bot.nearestEntity(e => {
            if (!e?.position) return false;
            if (MathUtils.distance3D(this.bot.entity.position, e.position) > 5) return false;
            if (type === 'hostile') return e.type === 'hostile' || e.kind === 'Hostile mobs';
            if (type === 'mob')     return e.type === 'mob';
            if (type === 'player')  return e.type === 'player' && e.username !== this.bot.username;
            return e.name === type;
        });
        if (!entity) throw new Error(`Không có ${type}`);
        try { await this.bot.lookAt(entity.position.offset(0, (entity.height || 1.8) * 0.8, 0)); } catch (e) {}
        await this.bot.attack(entity);
    }

    // ========================================================================
    // AUTO EAT
    // ========================================================================

    startAutoEat(options = {}) {
        if (options.startAt !== undefined) this.autoEatState.startAt = options.startAt;
        this.autoEatState.enabled = true;
        this.autoFeatures.eat     = true;
        if (!this.intervals.eat) {
            this.intervals.eat = setInterval(() => {
                if (!this.bot || this.status !== 'online' || this.destroyed) return;
                if (!this.autoEatState.enabled || this.autoEatState.eating) return;
                if ((this.bot.food || 0) <= this.autoEatState.startAt) this.tryAutoEat().catch(() => {});
            }, 3000);
        }
        this.logger.info('Bot', `[${this.options.username}] 🍖 Auto-eat ON`);
    }

    stopAutoEat() {
        this.autoEatState.enabled = false;
        this.autoFeatures.eat     = false;
        if (this.intervals.eat) { clearInterval(this.intervals.eat); delete this.intervals.eat; }
        if (this.autoEatState.eating && this.bot) { try { this.bot.deactivateItem(); } catch (e) {} this.autoEatState.eating = false; }
    }

    async tryAutoEat() {
        if (!this.bot || this.status !== 'online' || this.destroyed || this.autoEatState.eating) return;
        if (Date.now() - this.autoEatState.lastEat < this.autoEatState.cooldown) return;
        const food = this.findBestFood();
        if (!food) return;
        this.autoEatState.eating  = true;
        this.autoEatState.lastEat = Date.now();
        try {
            let held = null;
            try { held = this.bot.inventory.slots[this.bot.getEquipmentDestSlot('hand')]; } catch (e) {}
            await this.bot.equip(food, 'hand');
            await this.sleep(150);
            this.bot.activateItem();
            await this.sleep(1700);
            try { this.bot.deactivateItem(); } catch (e) {}
            this.logger.info('Bot', `[${this.options.username}] 🍖 Ăn ${food.name} → ${this.bot.food}/20`);
            if (held && held.type !== food.type) { await this.sleep(200); try { await this.bot.equip(held, 'hand'); } catch (e) {} }
        } catch (err) {
            this.logger.warn('Bot', `Auto-eat: ${err.message}`);
        } finally {
            this.autoEatState.eating = false;
        }
    }

    findBestFood() {
        if (!this.bot) return null;
        const items = this.bot.inventory.items();
        if (!items.length) return null;
        const banned = new Set(this.autoEatState.bannedFood);
        let best = null, bestScore = -Infinity;
        for (const item of items) {
            if (!item?.name) continue;
            const fd = FOOD_DATABASE[item.name];
            if (!fd || banned.has(item.name)) continue;
            const score = fd.foodPoints + fd.saturation;
            if (score > bestScore) { bestScore = score; best = item; }
        }
        return best;
    }

    sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    // ========================================================================
    // INVENTORY
    // ========================================================================

    getInventory() {
        if (!this.bot || this.status !== 'online') return [];
        try {
            return this.bot.inventory.items().map(i => ({
                type: i.type, name: i.name, displayName: i.displayName,
                count: i.count, slot: i.slot,
                maxDurability: i.maxDurability || 0, durabilityUsed: i.durabilityUsed || 0,
                enchants: i.enchants || []
            }));
        } catch (e) { return []; }
    }

    getEquipment() {
        if (!this.bot || this.status !== 'online') return {};
        const eq = {};
        try {
            for (const slot of ['head','torso','legs','feet','hand','off-hand']) {
                const item = this.bot.inventory.slots[this.bot.getEquipmentDestSlot(slot)];
                eq[slot] = item ? { name: item.name, displayName: item.displayName, count: item.count } : null;
            }
        } catch (e) {}
        return eq;
    }

    setHotbarSlot(slot) {
        if (!this.bot || this.status !== 'online') throw new Error('Bot chưa online');
        this.bot.setQuickBarSlot(Math.max(0, Math.min(8, parseInt(slot))));
    }

    async equipItem(itemName, destination = 'hand') {
        if (!this.bot || this.status !== 'online') throw new Error('Bot chưa online');
        const item = this.bot.inventory.items().find(i => i.name === itemName || i.displayName === itemName);
        if (!item) throw new Error(`Không có ${itemName}`);
        await this.bot.equip(item, destination);
    }

    async unequipItem(destination) {
        if (!this.bot || this.status !== 'online') throw new Error('Bot chưa online');
        await this.bot.unequip(destination);
    }

    async dropItem(itemName, count = 1) {
        if (!this.bot || this.status !== 'online') throw new Error('Bot chưa online');
        const item = this.bot.inventory.items().find(i => i.name === itemName);
        if (!item) throw new Error(`Không có ${itemName}`);
        await this.bot.toss(item.type, null, count === 'all' ? item.count : parseInt(count));
    }

    async dropAllItems() {
        if (!this.bot || this.status !== 'online') throw new Error('Bot chưa online');
        for (const item of this.bot.inventory.items()) try { await this.bot.toss(item.type, null, item.count); } catch (e) {}
    }

    async useItem()     { if (!this.bot) throw new Error('Bot chưa online'); this.bot.activateItem(); }
    async stopUseItem() { if (!this.bot) throw new Error('Bot chưa online'); this.bot.deactivateItem(); }

    async eatFood(itemName) {
        if (!this.bot || this.status !== 'online') throw new Error('Bot chưa online');
        if (itemName) {
            const item = this.bot.inventory.items().find(i => i.name === itemName);
            if (!item) throw new Error(`Không có ${itemName}`);
            await this.bot.equip(item, 'hand');
        }
        this.bot.activateItem();
        await this.sleep(1700);
        try { this.bot.deactivateItem(); } catch (e) {}
    }

    async digBlock(x, y, z) {
        if (!this.bot || this.status !== 'online') throw new Error('Bot chưa online');
        const block = this.bot.blockAt({ x: parseInt(x), y: parseInt(y), z: parseInt(z) });
        if (!block || block.name === 'air') throw new Error('Không có block');
        if (!this.bot.canDigBlock(block)) throw new Error(`Không đào được`);
        await this.bot.lookAt(block.position.offset(0.5, 0.5, 0.5));
        await this.bot.dig(block);
        this.statsTracker.updateStat(this.id, 'blocksMined');
    }

    async placeBlock(x, y, z, direction = 'top') {
        if (!this.bot || this.status !== 'online') throw new Error('Bot chưa online');
        const ref = this.bot.blockAt({ x: parseInt(x), y: parseInt(y), z: parseInt(z) });
        if (!ref) throw new Error('Không có block');
        const faces = {
            top:{x:0,y:1,z:0}, bottom:{x:0,y:-1,z:0},
            north:{x:0,y:0,z:-1}, south:{x:0,y:0,z:1},
            east:{x:1,y:0,z:0}, west:{x:-1,y:0,z:0}
        };
        await this.bot.placeBlock(ref, faces[direction] || faces.top);
        this.statsTracker.updateStat(this.id, 'blocksPlaced');
    }

    getNearbyEntities(range = 32) {
        if (!this.bot?.entity) return [];
        const result = [];
        for (const e of Object.values(this.bot.entities)) {
            if (!e || e === this.bot.entity || !e.position) continue;
            const dist = MathUtils.distance3D(this.bot.entity.position, e.position);
            if (dist > range) continue;
            result.push({
                id: e.id, type: e.type || 'unknown',
                name: e.name || e.username || e.displayName || 'Unknown',
                username: e.username || null,
                position: { x: Math.round(e.position.x*10)/10, y: Math.round(e.position.y*10)/10, z: Math.round(e.position.z*10)/10 },
                distance: Math.round(dist*10)/10, health: e.health || null, kind: e.kind || null,
                isHostile: e.kind === 'Hostile mobs' || e.type === 'hostile',
                isTarget: this.killaura.currentTarget?.id === e.id
            });
        }
        return result.sort((a, b) => a.distance - b.distance).slice(0, 50);
    }

    getPlayers() {
        if (!this.bot || this.status !== 'online') return [];
        try {
            return Object.values(this.bot.players).map(p => ({
                username: p.username, uuid: p.uuid, ping: p.ping || 0, gamemode: p.gamemode,
                entity: p.entity && this.bot.entity ? {
                    position: { x: Math.round(p.entity.position.x*10)/10, y: Math.round(p.entity.position.y*10)/10, z: Math.round(p.entity.position.z*10)/10 },
                    distance: Math.round(MathUtils.distance3D(p.entity.position, this.bot.entity.position)*10)/10
                } : null
            }));
        } catch (e) { return []; }
    }

    addChat(entry) {
        this.chatHistory.push(entry);
        if (this.chatHistory.length > this.maxChatHistory) this.chatHistory = this.chatHistory.slice(-100);
    }

    sendChat(message) {
        if (!this.bot || this.status !== 'online') throw new Error('Bot chưa online');
        this.bot.chat(String(message));
        this.statsTracker.updateStat(this.id, 'messagesSent');
        this.addChat({ type: 'sent', username: this.bot.username, message: String(message), timestamp: Date.now() });
    }

    handleChatCmd(username, message) {
        if (!message.startsWith('!')) return;
        const parts = message.slice(1).toLowerCase().split(' '), cmd = parts[0];
        try {
            switch (cmd) {
                case 'help':   this.bot.chat('!pos !health !eat !click !stop !inv !target'); break;
                case 'pos':    { const p = this.bot.entity?.position; if (p) this.bot.chat(`📍 ${Math.round(p.x)}, ${Math.round(p.y)}, ${Math.round(p.z)}`); break; }
                case 'health': this.bot.chat(`❤️ ${Math.round(this.bot.health||0)}/20 🍖 ${this.bot.food||0}/20`); break;
                case 'eat':    this.tryAutoEat().catch(() => {}); break;
                case 'click':
                    if (this.killaura.enabled) { this.stopKillaura(); this.bot.chat('⚔️ KillAura OFF'); }
                    else { this.startKillaura(); this.bot.chat(`⚔️ KillAura ON (${this.killaura.cooldownMs}ms)`); }
                    break;
                case 'target': this.bot.chat(this.killaura.currentTarget ? `🎯 ${this.killaura.currentTarget.name} (${this.killaura.currentTarget.distance}m)` : 'No target'); break;
                case 'stop':   this.stopAllAuto(); this.bot.chat('Stopped!'); break;
                case 'inv':    { const items = this.getInventory().slice(0, 5); this.bot.chat(`Túi: ${items.map(i=>`${i.name}x${i.count}`).join(', ')||'trống'}`); break; }
            }
        } catch (e) {}
    }

    parseKickReason(reason) {
        if (!reason) return 'Unknown';
        const known = {
            'multiplayer.disconnect.invalid_player_movement': '❌ Movement',
            'multiplayer.disconnect.flying': '❌ Flying',
            'disconnect.timeout': '⏱️ Timeout',
            'multiplayer.disconnect.server_full': '🚫 Full',
            'multiplayer.disconnect.banned': '🔨 Banned',
            'You must wait': '⏳ Wait',
            'Connection throttled': '⏳ Throttled',
            'You are already connected': '🔁 Already connected'
        };
        for (const [k, v] of Object.entries(known)) if (reason.includes(k)) return v;
        try {
            const p = JSON.parse(reason);
            if (p?.value?.translate?.value) return known[p.value.translate.value] || p.value.translate.value;
            if (p?.translate) return known[p.translate] || p.translate;
        } catch (e) {}
        return reason.substring(0, 100);
    }

    handleKick(reason) {
        this.stopAllAuto();
        const wm = reason.match(/wait\s+(\d+)\s+second/i);
        if (wm)                                            { this.scheduleReconnect((parseInt(wm[1]) + 5) * 1000); return; }
        if (reason.includes('throttled'))                  { this.scheduleReconnect(35000); return; }
        if (reason.includes('invalid_player_movement') || reason.includes('flying')) { this.scheduleReconnect(20000); return; }
        if (reason.includes('banned') || reason.includes('not_whitelisted')) { this.autoReconnect = false; return; }
        if (reason.includes('server_full'))                { this.scheduleReconnect(30000); return; }
        if (reason.includes('already connected'))          { this.scheduleReconnect(20000); return; }
        this.scheduleReconnect(10000);
    }

    scheduleReconnect(delay) {
        if (this.destroyed || !this.autoReconnect) return;
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.logger.error('Bot', `[${this.options.username}] Hết lần thử`);
            this.status = 'error'; this.error = 'Max reconnect'; this.emitUpdate(); return;
        }
        if (this.reconnectTimer) return;
        const d = Math.min(delay * Math.pow(1.3, Math.min(this.reconnectAttempts, 8)), 120000);
        this.reconnectAttempts++; this.isReconnecting = true;
        this.logger.info('Bot', `[${this.options.username}] 🔄 Reconnect ${Math.round(d/1000)}s (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            if (!this.destroyed && this.autoReconnect) this.connect();
            else this.isReconnecting = false;
        }, d);
    }

    reconnect() {
        if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
        this.reconnectAttempts = 0; this.isReconnecting = false;
        this.lastKickReason = ''; this.autoReconnect = true;
        this.cleanupBot(); setTimeout(() => this.connect(), 3000);
    }

    disconnect() {
        this.autoReconnect = false; this.isReconnecting = false;
        if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
        this.stopAllAuto(); this.cleanupBot();
        this.status = 'offline'; this.emitUpdate();
    }

    destroy() {
        this.destroyed = true; this.disconnect();
        try { this.statsTracker.removeBot(this.id); } catch (e) {}
    }

    stopAllAuto() {
        this.stopAutoEat(); this.stopKillaura();
        for (const v of Object.values(this.intervals)) try { clearInterval(v); } catch (e) {}
        this.intervals = {};
        for (const v of Object.values(this.timers)) try { clearTimeout(v); } catch (e) {}
        this.timers = {}; this.currentTask = null;
    }

    getInfo() {
        const info = {
            id: this.id, username: this.options.username, host: this.options.host,
            port: this.options.port, version: this.options.version, status: this.status, error: this.error,
            createdAt: this.createdAt, connectedAt: this.connectedAt, currentTask: this.currentTask,
            autoFeatures: { ...this.autoFeatures },
            killaura: {
                enabled: this.killaura.enabled, range: this.killaura.range, speed: this.killaura.speed,
                priority: this.killaura.priority, fov: this.killaura.fov, cooldownMs: this.killaura.cooldownMs,
                totalClicks: this.killaura.totalClicks, currentTarget: this.killaura.currentTarget,
                targetTypes: this.killaura.targetTypes, containerOpen: this.killaura.containerOpen,
                pauseOnContainers: this.killaura.pauseOnContainers
            },
            reconnectAttempts: this.reconnectAttempts
        };
        if (this.bot && this.status === 'online') {
            try {
                info.health     = this.bot.health         || 0;
                info.food       = this.bot.food           || 0;
                info.saturation = this.bot.foodSaturation || 0;
                info.experience = { level: this.bot.experience?.level || 0, points: this.bot.experience?.points || 0, progress: this.bot.experience?.progress || 0 };
                info.position   = this.bot.entity ? { x: Math.round(this.bot.entity.position.x*10)/10, y: Math.round(this.bot.entity.position.y*10)/10, z: Math.round(this.bot.entity.position.z*10)/10 } : null;
                info.gameMode   = this.bot.game?.gameMode   || null;
                info.difficulty = this.bot.game?.difficulty  || null;
                info.dimension  = this.bot.game?.dimension   || null;
                info.isRaining  = this.bot.isRaining         || false;
                info.playerCount = Object.keys(this.bot.players || {}).length;
                info.time        = this.bot.time ? { timeOfDay: this.bot.time.timeOfDay, day: this.bot.time.day } : null;
                info.hotbarSlot  = this.bot.quickBarSlot || 0;
                const held = this.bot.inventory.slots[this.bot.getEquipmentDestSlot('hand')];
                info.heldItem = held ? { name: held.name, displayName: held.displayName, count: held.count } : null;
            } catch (e) {}
        }
        return info;
    }

    getDetailedInfo() {
        const info = this.getInfo();
        info.inventory      = this.getInventory();
        info.equipment      = this.getEquipment();
        info.chatHistory    = this.chatHistory.slice(-30);
        info.nearbyEntities = this.getNearbyEntities(32);
        info.players        = this.getPlayers();
        return info;
    }

    emitUpdate() { try { this.io.emit('bot:update', this.getInfo()); } catch (e) {} }
}

class BotManager {
    constructor(logger, statsTracker, io) {
        this.logger = logger; this.statsTracker = statsTracker; this.io = io;
        this.bots = new Map();
    }
    createBot(options) {
        const botId = uuidv4();
        const bot = new BotWrapper(botId, options, this.logger, this.statsTracker, this.io);
        this.bots.set(botId, bot); bot.connect();
        this.logger.info('BotManager', `✅ Bot: ${options.username}`);
        return botId;
    }
    removeBot(botId)      { const b = this.bots.get(botId); if (!b) throw new Error('Not found'); b.destroy(); this.bots.delete(botId); }
    removeAllBots()       { for (const b of this.bots.values()) try { b.destroy(); } catch(e){} this.bots.clear(); }
    reconnectBot(botId)   { const b = this.bots.get(botId); if (!b) throw new Error('Not found'); b.reconnect(); }
    getBot(botId)         { return this.bots.get(botId); }
    getBotCount()         { return this.bots.size; }
    getBotInfo(botId)     { const b = this.bots.get(botId); return b ? b.getInfo() : null; }
    getAllBotsInfo()       { const r=[]; for(const b of this.bots.values()) try{r.push(b.getInfo())}catch(e){} return r; }
    getAllBotsDetailed()   { const r=[]; for(const b of this.bots.values()) try{r.push(b.getDetailedInfo())}catch(e){} return r; }
    sendChat(id,msg)      { const b=this.getBot(id); if(!b) throw new Error('Not found'); b.sendChat(msg); }
    getInventory(id)      { const b=this.getBot(id); if(!b) throw new Error('Not found'); return b.getInventory(); }
    getNearbyEntities(id) { const b=this.getBot(id); if(!b) throw new Error('Not found'); return b.getNearbyEntities(); }
    getNearbyBlocks()     { return []; }
    getPlayers(id)        { const b=this.getBot(id); if(!b) throw new Error('Not found'); return b.getPlayers(); }

    async executeAction(botId, action, params = {}) {
        const bot = this.bots.get(botId);
        if (!bot) throw new Error('Bot không tồn tại');
        switch (action) {
            case 'chat':          bot.sendChat(params.message); break;
            case 'look':          await bot.lookAt(params.x, params.y, params.z); break;
            case 'lookAtEntity':  await bot.lookAtEntity(params.entityId); break;
            case 'setLook':       await bot.setLook(params.yaw, params.pitch); break;
            case 'attack':        params.entityId ? await bot.attackEntity(params.entityId) : await bot.attackNearest(params.type||'hostile'); break;
            case 'killaura': case 'autoClick': case 'autoFight':
                params.enabled !== false ? bot.startKillaura(params) : bot.stopKillaura(); break;
            case 'dig': case 'mine': await bot.digBlock(params.x, params.y, params.z); break;
            case 'place':         await bot.placeBlock(params.x, params.y, params.z, params.direction); break;
            case 'equip':         await bot.equipItem(params.itemName||params.item, params.destination||'hand'); break;
            case 'unequip':       await bot.unequipItem(params.destination); break;
            case 'drop':          params.all ? await bot.dropAllItems() : await bot.dropItem(params.itemName||params.item, params.count); break;
            case 'useItem':       await bot.useItem(); break;
            case 'stopUseItem':   await bot.stopUseItem(); break;
            case 'eat':           await bot.eatFood(params.itemName||params.item); break;
            case 'hotbar':        bot.setHotbarSlot(params.slot); break;
            case 'autoEat':       params.enabled !== false ? bot.startAutoEat(params) : bot.stopAutoEat(); break;
            case 'stop':          bot.stopAllAuto(); break;
            case 'disconnect':    bot.disconnect(); break;
            case 'reconnect':     bot.reconnect(); break;
            default: throw new Error(`Không hợp lệ: ${action}`);
        }
        return true;
    }
}

module.exports = BotManager;
