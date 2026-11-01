// Main Game Engine

const DIFFICULTY_CONFIGS = {
  EASY: {
    name: '쉬움',
    label: '도전자: 쉬움 🛡️',
    color: '#38bdf8',
    startGold: 350,
    upgradeCostMult: 1.0,
    stageRewardMult: 1.0,
    goldBountyMult: 1.0,
    slotCostMult: 1.0,
    enemyHpMult: 1.0,
    summary: '자원 350G | 강화비용 1.0x | 클리어보상 100%'
  },
  NORMAL: {
    name: '보통',
    label: '도전자: 보통 ⚔️',
    color: '#ffbe0b',
    startGold: 240,
    upgradeCostMult: 1.35,
    stageRewardMult: 0.70,
    goldBountyMult: 0.85,
    slotCostMult: 1.25,
    enemyHpMult: 1.15,
    summary: '자원 240G | 강화비용 1.35x | 클리어보상 70%'
  },
  HARD: {
    name: '어려움',
    label: '도전자: 어려움 💀',
    color: '#ef4444',
    startGold: 160,
    upgradeCostMult: 1.75,
    stageRewardMult: 0.50,
    goldBountyMult: 0.70,
    slotCostMult: 1.60,
    enemyHpMult: 1.30,
    summary: '자원 160G | 강화비용 1.75x | 클리어보상 50%'
  }
};

class GalaxyDefenseGame {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.resizeCanvas();
    // Keep mobile browser chrome changes from clipping layout by syncing CSS --app-height
    this.setAppHeight && this.setAppHeight();

    this.fx = new FXManager();
    this.starfield = new Starfield(this.canvas.width, this.canvas.height);
    this.skillManager = new SkillManager(this);

    // Game state
    this.gameMode = null; // 'ADMIN' or 'CHALLENGER'
    this.selectedDifficulty = 'NORMAL';
    this.difficultySettings = DIFFICULTY_CONFIGS.NORMAL;
    this.bossKills = 0;
    this.state = 'MENU'; // 'MENU', 'PLAYING', 'PAUSED', 'GAMEOVER'
    this.gameSpeed = 1;

    this.gold = 300;
    this.score = 0;
    this.wave = 1;
    this.waveState = 'PREPARE'; // 'PREPARE', 'SPAWNING', 'WAVE_ACTIVE'
    this.waveTimer = 300; // Countdown frames between waves
    this.enemiesToSpawn = [];
    this.spawnTimer = 0;

    // Base fortress (dynamically sized to viewport)
    const isMobile = this.canvas.width < 600;
    const baseW = isMobile
      ? Math.min(360, Math.max(260, this.canvas.width * 0.88))
      : Math.min(680, Math.max(380, this.canvas.width * 0.52));
    this.base = new PlanetaryBase(this.canvas.width / 2, this.canvas.height - 22, baseW, 42);
    this.hardpoints = [];
    this.turrets = [];
    this.enemies = [];
    this.projectiles = [];

    this.selectedTurretType = 'laser';
    this.selectedTurretInstance = null;

    // Preview state used to show placement ranges before building
    this.preview = { active: false, multi: false, x: 0, y: 0, range: 0, slotId: null };
    this.turretInfoFor = null; // DOM card currently showing info for

    // Slot purchase costs and global research buffs
    this.slotPurchaseCosts = [800, 1200, 1800, 2600, 3500];
    this.selectedSlotForPurchase = null;
    this.globalBuffs = { damage: 0, cooldown: 0, range: 0, gold: 0, crit: false };
    if (typeof window !== 'undefined') window.game = this;

    this.setupHardpoints();
    this.setupEventListeners();
  }

  resizeCanvas() {
    const viewport = document.getElementById('canvas-viewport') || this.canvas.parentElement;
    const rect = viewport.getBoundingClientRect();
    const oldW = this.canvas.width;
    const oldH = this.canvas.height;
    const newW = rect.width;
    const newH = rect.height;

    this.canvas.width = newW;
    this.canvas.height = newH;
    if (this.starfield) this.starfield.resize(newW, newH);

    // Synchronize relative positions of active enemies, projectiles, and FX on resize
    if (oldW > 0 && oldH > 0 && (oldW !== newW || oldH !== newH)) {
      const scaleX = newW / oldW;
      const scaleY = newH / oldH;

      // Rescale active enemies to keep relative positions on canvas
      if (this.enemies) {
        for (let e of this.enemies) {
          e.x *= scaleX;
          e.y *= scaleY;
        }
      }

      // Rescale projectiles
      if (this.projectiles) {
        for (let p of this.projectiles) {
          p.x *= scaleX;
          p.y *= scaleY;
          if (p.vx !== undefined) p.vx *= scaleX;
          if (p.vy !== undefined) p.vy *= scaleY;
        }
      }

      // Rescale visual particles and effects
      if (this.fx) {
        for (let pt of this.fx.particles) {
          pt.x *= scaleX;
          pt.y *= scaleY;
        }
        for (let sw of this.fx.shockwaves) {
          sw.x *= scaleX;
          sw.y *= scaleY;
          sw.radius *= scaleX;
          sw.maxRadius *= scaleX;
        }
        for (let ft of this.fx.floatingTexts) {
          ft.x *= scaleX;
          ft.y *= scaleY;
        }
        if (this.fx.lightningArcs) {
          for (let arc of this.fx.lightningArcs) {
            arc.x1 *= scaleX;
            arc.y1 *= scaleY;
            arc.x2 *= scaleX;
            arc.y2 *= scaleY;
          }
        }
      }
    }

    if (this.base) {
      const isMobile = this.canvas.width < 600;
      const baseW = isMobile
        ? Math.min(350, Math.max(260, this.canvas.width * 0.86))
        : Math.min(680, Math.max(380, this.canvas.width * 0.52));
      this.base.width = baseW;
      this.base.x = this.canvas.width / 2;
      this.base.y = this.canvas.height - 20;
      this.setupHardpoints();
    }
  }

  // Set CSS variable --app-height to window.innerHeight to prevent mobile chrome from clipping
  setAppHeight() {
    try {
      document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
    } catch (e) {
      // ignore on older browsers
    }
  }

  // Show small info panel for a turret card (card element and turret type)
  showTurretInfo(card, type) {
    try {
      const info = document.getElementById('turret-info');
      const title = document.getElementById('turret-info-title');
      const desc = document.getElementById('turret-info-desc');
      const stats = document.getElementById('turret-info-stats');
      const cfg = TURRET_TYPES[type];
      if (!info || !cfg) return;
      title.textContent = cfg.name || type;
      desc.textContent = cfg.desc || '';
      // Build simple stats string
      let s = `비용: ${cfg.cost}G \u2022 사거리: ${cfg.range}px \u2022 쿨다운: ${cfg.cooldown}`;
      if (cfg.damage) s += ` \u2022 공격력: ${cfg.damage}`;
      if (cfg.splashRadius) s += ` \u2022 범위: ${cfg.splashRadius}`;
      stats.textContent = s;

      // Position near the card (keep onscreen)
      const rect = card.getBoundingClientRect();
      const parentRect = (document.getElementById('game-container')||document.body).getBoundingClientRect();
      // Prefer above the card, else below
      const left = Math.min(parentRect.width - 260, Math.max(8, rect.left - parentRect.left));
      let top = rect.top - parentRect.top - 96;
      if (top < 64) top = rect.bottom - parentRect.top + 8;
      info.style.left = `${left}px`;
      info.style.top = `${top}px`;
      info.style.display = 'block';
      info.setAttribute('aria-hidden','false');
      this.turretInfoFor = card;
      this.turretInfoVisible = true;
    } catch (e) {
      // ignore
    }
  }

  hideTurretInfo() {
    const info = document.getElementById('turret-info');
    if (!info) return;
    info.style.display = 'none';
    info.setAttribute('aria-hidden','true');
    this.turretInfoFor = null;
    this.turretInfoVisible = false;
  }

  // Update preview to the nearest empty hardpoint to pointer (x,y in canvas coordinates)
  updatePreviewAtPointer(x, y) {
    if (!this.selectedTurretType) return this.clearPreview();
    let closest = null; let minD = 99999; let idx = null;
    for (let hp of this.hardpoints) {
      if (!hp.unlocked || hp.turret) continue; // only show for unlocked and empty slots
      const hpX = this.base.x + hp.relX;
      const hpY = this.base.y + hp.relY;
      const d = Math.hypot(x - hpX, y - hpY);
      if (d < minD) { minD = d; closest = hp; idx = hp.id; }
    }
    if (closest && minD <= 160) {
      this.preview.active = true;
      this.preview.multi = false;
      this.preview.slotId = idx;
      this.preview.x = this.base.x + closest.relX;
      this.preview.y = this.base.y + closest.relY;
      this.preview.range = (TURRET_TYPES[this.selectedTurretType] || {range:0}).range || 0;
    } else {
      // if pointer is far, clear single preview
      this.preview.active = false;
      this.preview.slotId = null;
    }
  }

  // Show preview for all empty hardpoints (useful for mobile)
  showAllPreviews() {
    if (!this.selectedTurretType) return;
    this.preview.multi = true;
    this.preview.active = true;
    this.preview.list = this.hardpoints.filter(hp => hp.unlocked && !hp.turret).map(hp => ({
      x: this.base.x + hp.relX,
      y: this.base.y + hp.relY,
      range: (TURRET_TYPES[this.selectedTurretType] || {range:0}).range || 0
    }));
  }

  clearPreview() {
    this.preview.active = false;
    this.preview.multi = false;
    this.preview.slotId = null;
    this.preview.list = null;
  }

  setupHardpoints() {
    // Dynamic span calculation ensuring all 10 slots fit comfortably within viewport bounds
    const maxHalfSpan = (this.canvas.width / 2) - 34; // 34px safe margin from viewport edge (radius 22 + 12px)
    const baseSpan = this.base.width * 0.40;
    const span = Math.max(100, Math.min(maxHalfSpan, baseSpan));

    // Preserve unlocked state during resize
    const prevUnlocked = {};
    if (this.hardpoints && this.hardpoints.length > 0) {
      for (let hp of this.hardpoints) {
        prevUnlocked[hp.id] = hp.unlocked;
      }
    }

    // 10 Turret Slots:
    // Row 1 (Elevated Arc, 5 default frontline slots): ID 0 ~ 4
    // Row 2 (Citadel Deck, 5 expansion slots unlocked sequentially): ID 5 ~ 9
    // Placed in an alternating/centralized pattern so earliest boss unlock slots (5 & 6) are prominent and 100% visible
    this.hardpoints = [
      // Row 1: Primary 5 Frontline Battery Slots (Default Unlocked)
      { id: 0, relX: -span * 0.90, relY: -24, radius: 22, turret: null, unlocked: prevUnlocked[0] ?? true },
      { id: 1, relX: -span * 0.45, relY: -40, radius: 22, turret: null, unlocked: prevUnlocked[1] ?? true },
      { id: 2, relX: 0,            relY: -48, radius: 22, turret: null, unlocked: prevUnlocked[2] ?? true },
      { id: 3, relX: span * 0.45,  relY: -40, radius: 22, turret: null, unlocked: prevUnlocked[3] ?? true },
      { id: 4, relX: span * 0.90,  relY: -24, radius: 22, turret: null, unlocked: prevUnlocked[4] ?? true },

      // Row 2: Secondary 5 Expandable Wing & Citadel Slots (Unlocked with Boss kills & gold)
      // Slot 5 (Boss 1 Kill): Center-Left Citadel Deck (relX: -span * 0.58)
      { id: 5, relX: -span * 0.58, relY: -10, radius: 22, turret: null, unlocked: prevUnlocked[5] ?? false, cost: this.slotPurchaseCosts[0] },
      // Slot 6 (Boss 2 Kills): Center-Right Citadel Deck (relX: +span * 0.58)
      { id: 6, relX: span * 0.58,  relY: -10, radius: 22, turret: null, unlocked: prevUnlocked[6] ?? false, cost: this.slotPurchaseCosts[1] },
      // Slot 7 (Boss 3 Kills): Inner Wing Left (relX: -span * 0.26)
      { id: 7, relX: -span * 0.26, relY: -20, radius: 22, turret: null, unlocked: prevUnlocked[7] ?? false, cost: this.slotPurchaseCosts[2] },
      // Slot 8 (Boss 4 Kills): Inner Wing Right (relX: +span * 0.26)
      { id: 8, relX: span * 0.26,  relY: -20, radius: 22, turret: null, unlocked: prevUnlocked[8] ?? false, cost: this.slotPurchaseCosts[3] },
      // Slot 9 (Boss 5 Kills): Core Command Apex (relX: 0)
      { id: 9, relX: 0,            relY: -6,  radius: 22, turret: null, unlocked: prevUnlocked[9] ?? false, cost: this.slotPurchaseCosts[4] }
    ];

    // Re-link existing turrets if resizing
    for (let t of this.turrets) {
      const hp = this.hardpoints[t.slotIndex];
      if (hp) {
        t.x = this.base.x + hp.relX;
        t.y = this.base.y + hp.relY;
        hp.turret = t;
      }
    }
  }

  startGame(mode, difficultyKey = 'NORMAL') {
    sounds.init();
    this.gameMode = mode;
    this.state = 'PLAYING';
    this.bossKills = 0;
    document.getElementById('mode-modal').style.display = 'none';
    const pauseModal = document.getElementById('pause-modal');
    if (pauseModal) pauseModal.style.display = 'none';
    const pauseBtn = document.getElementById('btn-pause-toggle');
    if (pauseBtn) pauseBtn.textContent = '⏸️ 일시정지';

    const modeBadge = document.getElementById('stat-mode-badge');
    const adminBtn = document.getElementById('btn-admin-toggle');
    const adminPanel = document.getElementById('admin-panel');
    const baseStatus = document.getElementById('top-base-status');
    const baseBtn = document.getElementById('btn-base-toggle');

    if (baseStatus) baseStatus.classList.remove('open');
    if (baseBtn) baseBtn.classList.remove('active');

    if (mode === 'ADMIN') {
      this.difficulty = 'EASY';
      this.difficultySettings = DIFFICULTY_CONFIGS.EASY;
      modeBadge.textContent = '관리자 모드 (ADMIN)';
      modeBadge.style.borderColor = '#b537f2';
      modeBadge.style.color = '#f0abfc';
      this.gold = 999999;
      if (adminBtn) {
        adminBtn.style.display = 'inline-flex';
        adminBtn.classList.remove('active');
      }
      if (adminPanel) adminPanel.classList.remove('active');
    } else {
      this.difficulty = (difficultyKey in DIFFICULTY_CONFIGS) ? difficultyKey : 'NORMAL';
      this.difficultySettings = DIFFICULTY_CONFIGS[this.difficulty];
      modeBadge.textContent = this.difficultySettings.label;
      modeBadge.style.borderColor = this.difficultySettings.color;
      modeBadge.style.color = this.difficultySettings.color;
      this.gold = this.difficultySettings.startGold;
      if (adminBtn) {
        adminBtn.style.display = 'none';
        adminBtn.classList.remove('active');
      }
      if (adminPanel) adminPanel.classList.remove('active');
    }

    // Recalculate slot purchase costs with difficulty multiplier
    const baseCosts = [800, 1200, 1800, 2600, 3500];
    const slotMult = this.difficultySettings?.slotCostMult || 1.0;
    this.slotPurchaseCosts = baseCosts.map(c => Math.round(c * slotMult));

    this.wave = 1;
    this.score = 0;
    this.turrets = [];
    this.globalBuffs = { damage: 0, cooldown: 0, range: 0, gold: 0, crit: false };
    this.setupHardpoints();
    for (let hp of this.hardpoints) {
      hp.turret = null;
      hp.unlocked = (mode === 'ADMIN' ? true : hp.id < 5);
      if (hp.id >= 5) {
        hp.cost = this.slotPurchaseCosts[hp.id - 5];
      }
    }
    this.enemies = [];
    this.projectiles = [];
    this.fx.clear();
    this.skillManager.resetAllCooldowns();

    // In Admin Mode, start with pre-equipped max level turrets
    if (mode === 'ADMIN') {
      this.buildTurret(0, 'laser');
      this.buildTurret(1, 'plasma');
      this.buildTurret(2, 'missile');
      this.buildTurret(3, 'emp');
      this.buildTurret(4, 'repair');
      for (let t of this.turrets) {
        t.level = 10;
        t.applyStats();
      }
    }

    this.startPrepareWave();
    this.updateHUD();
  }

  startPrepareWave() {
    this.waveState = 'PREPARE';
    this.waveTimer = this.gameMode === 'ADMIN' ? 60 : 300; // 5 seconds or 1 second in admin
  }

  beginWaveSpawning() {
    this.waveState = 'SPAWNING';
    this.enemiesToSpawn = this.generateWaveEnemies(this.wave);
    this.spawnTimer = 0;

    const isBoss = (this.wave % 5 === 0);
    if (isBoss) {
      sounds.playBossAlarm();
      this.fx.addNotification(this.canvas.width / 2, 200, `⚠️ 경고: 거대 보스 모선 출현! (Wave ${this.wave})`, '#ef4444');
    } else {
      this.fx.addNotification(this.canvas.width / 2, 200, `제 ${this.wave} 웨이브 침공 개시!`, '#38bdf8');
    }
  }

  generateWaveEnemies(waveNum) {
    const list = [];
    // Dynamic difficulty curve tailored for up to 10-level upgraded 9 turrets
    const mult = waveNum <= 3
      ? (1 + (waveNum - 1) * 0.25)
      : (1.5 * Math.pow(1.17, waveNum - 3));
    const isBossWave = (waveNum % 5 === 0);

    // Scout drones
    const scoutCount = 7 + waveNum * 2;
    for (let i = 0; i < scoutCount; i++) {
      list.push({ type: 'scout', mult });
    }

    // Fighters (from wave 2+)
    if (waveNum >= 2) {
      const fighterCount = 4 + Math.floor(waveNum * 1.5);
      for (let i = 0; i < fighterCount; i++) {
        list.push({ type: 'fighter', mult });
      }
    }

    // Stealth Infiltrators (from wave 3+)
    if (waveNum >= 3) {
      const stealthCount = 3 + Math.floor(waveNum * 0.9);
      for (let i = 0; i < stealthCount; i++) {
        list.push({ type: 'stealth', mult });
      }
    }

    // Heavy Cruisers (from wave 4+)
    if (waveNum >= 4) {
      const cruiserCount = 2 + Math.floor(waveNum * 0.7);
      for (let i = 0; i < cruiserCount; i++) {
        list.push({ type: 'cruiser', mult });
      }
    }

    // Void Destroyers (from wave 5+)
    if (waveNum >= 5) {
      const destroyerCount = 1 + Math.floor((waveNum - 4) * 0.8);
      for (let i = 0; i < destroyerCount; i++) {
        list.push({ type: 'destroyer', mult });
      }
    }

    // Boss Battles
    if (isBossWave) {
      const isSuperBoss = waveNum >= 10;
      const bossMult = isSuperBoss ? mult * 2.2 : mult * 1.5;
      list.push({ type: 'boss', mult: bossMult });
      if (isSuperBoss) {
        // Escort destroyers for super boss
        list.push({ type: 'destroyer', mult: mult * 1.3 });
        list.push({ type: 'destroyer', mult: mult * 1.3 });
      }
    }

    // Shuffle spawns (except boss arrives at back)
    const boss = list.find(e => e.type === 'boss');
    const normal = list.filter(e => e.type !== 'boss');
    normal.sort(() => Math.random() - 0.5);
    if (boss) normal.push(boss);

    return normal;
  }

  spawnEnemy(config) {
    const margin = 40;
    const x = margin + Math.random() * (this.canvas.width - margin * 2);
    const y = -30 - Math.random() * 40;
    this.enemies.push(new Enemy(x, y, config.type, config.mult));
  }

  buildTurret(slotId, type) {
    const hp = this.hardpoints[slotId];
    if (!hp || hp.turret) return false;

    const cost = TURRET_TYPES[type].cost;
    if (this.gameMode !== 'ADMIN' && this.gold < cost) {
      this.fx.addNotification(this.canvas.width / 2, this.canvas.height - 180, '자원(골드)이 부족합니다!', '#ef4444');
      return false;
    }

    if (this.gameMode !== 'ADMIN') {
      this.gold -= cost;
    }

    const t = new Turret(slotId, this.base.x + hp.relX, this.base.y + hp.relY, type);
    hp.turret = t;
    this.turrets.push(t);
    sounds.playClick();
    this.updateHUD();
    return true;
  }

  upgradeTurret(turret) {
    if (this.gameMode !== 'ADMIN' && this.gold < turret.upgradeCost) {
      this.fx.addNotification(turret.x, turret.y - 40, '업그레이드 골드 부족!', '#ef4444');
      return;
    }

    if (this.gameMode !== 'ADMIN') {
      this.gold -= turret.upgradeCost;
    }
    turret.upgrade();

    // Immediate upgrade spark
    this.fx.createHitSpark(turret.x, turret.y, turret.color, 16);

    // Celebratory effects based on normal vs transcendence
    if (turret.level > 10) {
      // Transcendence (초월 강화): Huge impact, orbital cue, crimson shockwave
      this.fx.createExplosion(turret.x, turret.y - 6, '#f43f5e', 45, 2.5);
      this.fx.shockwaves.push(new Shockwave(turret.x, turret.y, 90, '#f43f5e', 40));
      try { sounds.playOrbitalStrike(); } catch (e) { }
      this.fx.addNotification(this.canvas.width / 2, 180, `${turret.name} 초월 강화 돌파! (EX-Lv.${turret.level})`, '#f43f5e');
    } else if (turret.level === 10) {
      // Ultimate tier Lv.10
      this.fx.createExplosion(turret.x, turret.y - 6, turret.color, 56, 3.0);
      this.fx.shockwaves.push(new Shockwave(turret.x, turret.y, 120, turret.color, 48));
      try { sounds.playOrbitalStrike(); } catch (e) { }
      this.fx.addNotification(this.canvas.width / 2, 180, `${turret.name} 궁극 각성 완료! (Lv.10)`, '#f0abfc');
    } else if (turret.level >= 5) {
      this.fx.createExplosion(turret.x, turret.y - 6, turret.color, 22 + turret.level * 2, 1.4 + turret.level * 0.12);
      this.fx.shockwaves.push(new Shockwave(turret.x, turret.y, 48 + turret.level * 6, turret.color, 26 + turret.level * 2));
      try { sounds.playExplosion(1 + turret.level * 0.08); } catch (e) { }
      this.fx.addNotification(turret.x, turret.y - 60, `Lv.${turret.level} 대규모 강화!`, '#ffbe0b');
    } else {
      try { sounds.playClick(); } catch (e) { }
      this.fx.addNotification(turret.x, turret.y - 40, `Lv.${turret.level} 강화 완료!`, '#10b981');
    }

    this.closePopup();
    this.updateHUD();
  }

  sellTurret(turret) {
    const refund = Math.round(TURRET_TYPES[turret.type].cost * 0.7);
    this.gold += refund;
    this.hardpoints[turret.slotIndex].turret = null;
    this.turrets = this.turrets.filter(t => t !== turret);
    sounds.playClick();
    this.fx.createExplosion(turret.x, turret.y, '#94a3b8', 8, 0.6);
    this.closePopup();
    this.updateHUD();
  }

  // Admin Controls
  adminKillAll() {
    sounds.playOrbitalStrike();
    for (let e of this.enemies) {
      e.takeDamage(99999, this.fx);
    }
    this.enemiesToSpawn = [];
    this.fx.addNotification(this.canvas.width / 2, 250, '전체 적 즉시 섬멸 완료', '#f0abfc');
  }

  adminSkipWave() {
    if (this.wave % 5 === 0) {
      this.bossKills++;
    }
    this.enemies = [];
    this.enemiesToSpawn = [];
    this.wave++;
    this.startPrepareWave();
    this.updateHUD();
    this.fx.addNotification(this.canvas.width / 2, 250, `Wave ${this.wave} 스킵 진행`, '#f0abfc');
  }

  adminSpawnBoss() {
    sounds.playBossAlarm();
    this.enemies.push(new Enemy(this.canvas.width / 2, -40, 'boss', 1 + this.wave * 0.3));
    this.fx.addNotification(this.canvas.width / 2, 250, '보스 강제 출현!', '#ef4444');
  }

  adminToggleGodmode() {
    this.base.invincible = !this.base.invincible;
    const btn = document.getElementById('btn-admin-god');
    if (btn) btn.classList.toggle('toggle-active', this.base.invincible);
    this.fx.addNotification(this.canvas.width / 2, 250, `무적 모드: ${this.base.invincible ? 'ON' : 'OFF'}`, '#f0abfc');
  }

  adminSpeedToggle() {
    if (this.gameSpeed === 1) this.gameSpeed = 2;
    else if (this.gameSpeed === 2) this.gameSpeed = 3;
    else this.gameSpeed = 1;

    const btn = document.getElementById('btn-admin-speed');
    if (btn) btn.textContent = `배속 (${this.gameSpeed}x)`;
  }

  updateHUD() {
    document.getElementById('stat-gold').textContent = this.gold.toLocaleString();
    document.getElementById('stat-wave').textContent = `Wave ${this.wave}`;
    document.getElementById('stat-score').textContent = this.score.toLocaleString();
    this.updateConsoleStatus();
  }

  updateConsoleStatus() {
    const hpBar = document.getElementById('console-hp-bar');
    const hpVal = document.getElementById('console-hp-val');
    const shieldBar = document.getElementById('console-shield-bar');
    const shieldVal = document.getElementById('console-shield-val');
    const hpPctBadge = document.getElementById('stat-base-hp-pct');
    const baseBtn = document.getElementById('btn-base-toggle');

    if (hpBar && this.base) {
      const hpPct = Math.max(0, Math.min(100, (this.base.hp / this.base.maxHp) * 100));
      hpBar.style.width = `${hpPct}%`;
      hpVal.textContent = `${Math.round(this.base.hp)}/${this.base.maxHp}`;

      if (hpPctBadge) {
        const roundedPct = Math.round(hpPct);
        hpPctBadge.textContent = `${roundedPct}%`;
        if (roundedPct > 60) {
          hpPctBadge.style.color = '#10b981'; // emerald green
        } else if (roundedPct > 30) {
          hpPctBadge.style.color = '#ffbe0b'; // amber yellow
        } else {
          hpPctBadge.style.color = '#ef4444'; // danger red
        }
      }

      // Detect recent damage and trigger flash pulse on the base toggle button
      if (this.lastBaseHp !== undefined && this.base.hp < this.lastBaseHp) {
        if (baseBtn) {
          baseBtn.classList.add('damage-flash');
          clearTimeout(this.baseDamageFlashTimeout);
          this.baseDamageFlashTimeout = setTimeout(() => {
            baseBtn.classList.remove('damage-flash');
          }, 600);
        }
      }
      this.lastBaseHp = this.base.hp;
    }
    if (shieldBar && this.base) {
      const sPct = Math.max(0, Math.min(100, (this.base.shield / this.base.maxShield) * 100));
      shieldBar.style.width = `${sPct}%`;
      shieldVal.textContent = `${Math.round(this.base.shield)}/${this.base.maxShield}`;
    }
  }

  openPopup(turret) {
    this.selectedTurretInstance = turret;
    const popup = document.getElementById('turret-popup');
    const viewport = document.getElementById('canvas-viewport') || this.canvas.parentElement;
    const container = viewport.getBoundingClientRect();

    const tX = turret.x;
    const tY = turret.y - 120;

    popup.style.left = `${Math.max(10, Math.min(container.width - 200, tX - 95))}px`;
    popup.style.top = `${Math.max(70, tY)}px`;
    popup.style.display = 'block';

    const isTranscend = turret.level > 10;
    const levelLabel = isTranscend ? `EX-Lv.${turret.level}` : `Lv.${turret.level}`;
    document.getElementById('popup-title').textContent = `${turret.name} (${levelLabel})`;
    document.getElementById('popup-damage').textContent = `공격력: ${Math.round(turret.damage)}`;
    document.getElementById('popup-range').textContent = `사거리: ${Math.round(turret.range)}`;

    // Show active and upcoming passives
    const passiveElem = document.getElementById('popup-passive');
    if (passiveElem) {
      const passives = (typeof TURRET_PASSIVES !== 'undefined' && TURRET_PASSIVES[turret.type]) ? TURRET_PASSIVES[turret.type] : [];
      let activePassive = passives.filter(p => turret.level >= p.level).pop();
      let nextPassive = passives.find(p => turret.level < p.level);
      let descText = '';
      if (activePassive) {
        descText += `⚡ 현재 특성: [${activePassive.name}]<br>`;
      }
      if (nextPassive) {
        descText += `🔒 Lv.${nextPassive.level} 해금: ${nextPassive.name}`;
      } else if (isTranscend) {
        descText += `✨ 초월 특성 활성화 중`;
      }
      passiveElem.innerHTML = descText;
      passiveElem.style.display = descText ? 'block' : 'none';
    }

    const upBtn = document.getElementById('popup-btn-upgrade');
    if (turret.level >= 10) {
      upBtn.textContent = this.gameMode === 'ADMIN' ? '초월 무료강화' : `초월 강화 (${turret.upgradeCost.toLocaleString()}G)`;
      upBtn.disabled = false;
    } else {
      upBtn.textContent = this.gameMode === 'ADMIN' ? '무료 강화' : `강화 (${turret.upgradeCost.toLocaleString()}G)`;
      upBtn.disabled = false;
    }
  }

  closePopup() {
    this.selectedTurretInstance = null;
    const popup = document.getElementById('turret-popup');
    if (popup) popup.style.display = 'none';
  }

  canUnlockSlot(slot) {
    if (!slot) return { allowed: false, requiredKills: 0, currentKills: this.bossKills };
    if (slot.id < 5) return { allowed: true, requiredKills: 0, currentKills: this.bossKills };
    if (this.gameMode === 'ADMIN') return { allowed: true, requiredKills: 0, currentKills: this.bossKills };
    const requiredKills = slot.id - 4; // Slot 5 -> 1 boss, Slot 6 -> 2 bosses, etc.
    return {
      allowed: this.bossKills >= requiredKills,
      requiredKills,
      currentKills: this.bossKills
    };
  }

  openSlotPopup(slot) {
    this.selectedSlotForPurchase = slot;
    const popup = document.getElementById('slot-popup');
    if (!popup) return;
    const viewport = document.getElementById('canvas-viewport') || this.canvas.parentElement;
    const container = viewport.getBoundingClientRect();

    const sX = this.base.x + slot.relX;
    const sY = this.base.y + slot.relY - 120;

    popup.style.left = `${Math.max(10, Math.min(container.width - 210, sX - 100))}px`;
    popup.style.top = `${Math.max(70, sY)}px`;
    popup.style.display = 'block';

    const slotNum = slot.id + 1;
    const perm = this.canUnlockSlot(slot);
    const titleEl = document.getElementById('slot-popup-title');
    const descEl = document.getElementById('slot-popup-desc');
    const reqEl = document.getElementById('slot-popup-req');
    const costEl = document.getElementById('slot-popup-cost');
    const buyBtn = document.getElementById('slot-btn-buy');

    if (!perm.allowed) {
      if (titleEl) titleEl.textContent = `🔒 ${slotNum}번 슬롯 (보스 잠금)`;
      if (descEl) descEl.textContent = '새로운 포탑을 배치할 수 있는 추가 슬롯입니다.';
      if (reqEl) {
        reqEl.style.display = 'block';
        reqEl.textContent = `⚠️ 스테이지 보스를 ${perm.requiredKills}회 처치해야 해금 권한이 부여됩니다. (현재 처치: ${perm.currentKills}회)`;
      }
      if (costEl) costEl.textContent = `해금 비용: ${(slot.cost || 800).toLocaleString()} G`;
      if (buyBtn) {
        buyBtn.disabled = true;
        buyBtn.classList.add('disabled');
        buyBtn.textContent = '보스 처치 필요';
      }
    } else {
      if (titleEl) titleEl.textContent = `🔓 ${slotNum}번 포탑 슬롯 확장`;
      if (descEl) descEl.textContent = '새로운 포탑을 배치할 수 있는 슬롯을 잠금 해제합니다.';
      if (reqEl) reqEl.style.display = 'none';
      if (costEl) costEl.textContent = this.gameMode === 'ADMIN' ? '비용: 무료 (관리자)' : `비용: ${(slot.cost || 800).toLocaleString()} G`;
      if (buyBtn) {
        buyBtn.disabled = false;
        buyBtn.classList.remove('disabled');
        buyBtn.textContent = '해금하기';
      }
    }
  }

  closeSlotPopup() {
    this.selectedSlotForPurchase = null;
    const popup = document.getElementById('slot-popup');
    if (popup) popup.style.display = 'none';
  }

  purchaseSlot(slot) {
    if (!slot || slot.unlocked) return;
    const perm = this.canUnlockSlot(slot);
    if (!perm.allowed) {
      this.fx.addNotification(this.base.x + slot.relX, this.base.y + slot.relY - 30, `보스를 ${perm.requiredKills}회 처치해야 합니다!`, '#ef4444');
      sounds.playClick();
      return;
    }
    const cost = slot.cost || 800;
    if (this.gameMode !== 'ADMIN' && this.gold < cost) {
      this.fx.addNotification(this.base.x + slot.relX, this.base.y + slot.relY - 30, '골드가 부족합니다!', '#ef4444');
      sounds.playClick();
      return;
    }

    if (this.gameMode !== 'ADMIN') {
      this.gold -= cost;
    }
    slot.unlocked = true;
    sounds.playClick();
    this.fx.createExplosion(this.base.x + slot.relX, this.base.y + slot.relY, '#ffbe0b', 24, 1.5);
    this.fx.addNotification(this.base.x + slot.relX, this.base.y + slot.relY - 40, `슬롯 ${slot.id + 1} 잠금 해제!`, '#ffbe0b');
    this.closeSlotPopup();
    this.updateHUD();
  }

  unlockAllSlots() {
    this.bossKills = 99;
    for (let hp of this.hardpoints) {
      hp.unlocked = true;
    }
    sounds.playClick();
    this.fx.addNotification(this.canvas.width / 2, 200, '모든 포탑 슬롯 해금 완료!', '#10b981');
    this.updateHUD();
  }

  showWaveRewardModal() {
    const modal = document.getElementById('reward-modal');
    const container = document.getElementById('reward-options-container');
    if (!modal || !container) return;

    // List of 6 research options
    const researchPool = [
      {
        id: 'damage',
        icon: '⚡',
        title: '입자 가속 연구',
        desc: '모든 포탑 공격력 +10% 영구 강화',
        badge: `현재 누적: +${Math.round((this.globalBuffs.damage || 0) * 100)}%`,
        apply: () => {
          this.globalBuffs.damage = (this.globalBuffs.damage || 0) + 0.10;
        }
      },
      {
        id: 'cooldown',
        icon: '🌀',
        title: '시간 왜곡 캐패시터',
        desc: '모든 포탑 재장전 쿨다운 -6% 단축',
        badge: `현재 누적: -${Math.round((this.globalBuffs.cooldown || 0) * 100)}%`,
        apply: () => {
          this.globalBuffs.cooldown = Math.min(0.5, (this.globalBuffs.cooldown || 0) + 0.06);
        }
      },
      {
        id: 'range',
        icon: '🛰️',
        title: '타키온 센서 렌즈',
        desc: '모든 포탑 사거리 +8% 확장',
        badge: `현재 누적: +${Math.round((this.globalBuffs.range || 0) * 100)}%`,
        apply: () => {
          this.globalBuffs.range = (this.globalBuffs.range || 0) + 0.08;
        }
      },
      {
        id: 'gold',
        icon: '💰',
        title: '나노 물질 채굴기',
        desc: '적 처치 시 골드 획득량 +15% 증액',
        badge: `현재 누적: +${Math.round((this.globalBuffs.gold || 0) * 100)}%`,
        apply: () => {
          this.globalBuffs.gold = (this.globalBuffs.gold || 0) + 0.15;
        }
      },
      {
        id: 'shield',
        icon: '🛡️',
        title: '플라즈마 실드 증폭기',
        desc: '기지 보호막 +150 및 재생속도 +25%',
        badge: `현재 실드: ${this.base.maxShield}`,
        apply: () => {
          this.base.maxShield += 150;
          this.base.shield = this.base.maxShield;
          this.base.shieldRegen += 0.2;
        }
      },
      {
        id: 'crit',
        icon: '💥',
        title: '임계 융합 반응로',
        desc: '모든 공격 시 12% 확률로 2배 치명타',
        badge: this.globalBuffs.crit ? '활성화됨 (+공격력 5%)' : '미보유',
        apply: () => {
          this.globalBuffs.crit = true;
          this.globalBuffs.damage = (this.globalBuffs.damage || 0) + 0.05;
        }
      }
    ];

    // Pick 3 random distinct options
    const shuffled = [...researchPool].sort(() => Math.random() - 0.5);
    const chosen = shuffled.slice(0, 3);

    container.innerHTML = '';
    for (let opt of chosen) {
      const card = document.createElement('div');
      card.className = 'reward-card';
      card.innerHTML = `
        <div class="reward-icon">${opt.icon}</div>
        <div class="reward-body">
          <div class="reward-title">${opt.title}</div>
          <div class="reward-desc">${opt.desc}</div>
        </div>
        <div class="reward-badge">${opt.badge}</div>
      `;
      card.addEventListener('click', () => {
        opt.apply();
        // Re-apply stats to all active turrets
        for (let t of this.turrets) t.applyStats();
        sounds.playClick();
        this.fx.addNotification(this.canvas.width / 2, 220, `[${opt.title}] 연구 완료!`, '#ffbe0b');
        modal.style.display = 'none';
        this.updateHUD();
      });
      container.appendChild(card);
    }

    modal.style.display = 'flex';
  }

  updatePauseButton(isPaused) {
    const pauseBtn = document.getElementById('btn-pause-toggle');
    if (!pauseBtn) return;
    const icon = pauseBtn.querySelector('.btn-icon');
    const text = pauseBtn.querySelector('.btn-text');
    if (icon) icon.textContent = isPaused ? '▶' : '⏸️';
    if (text) text.textContent = isPaused ? ' 계속하기' : ' 일시정지';
    pauseBtn.title = isPaused ? '게임 재개' : '일시정지';
  }

  updateSoundButton(isMuted) {
    const soundBtn = document.getElementById('btn-sound-toggle');
    if (!soundBtn) return;
    const icon = soundBtn.querySelector('.btn-icon');
    const text = soundBtn.querySelector('.btn-text');
    if (icon) icon.textContent = isMuted ? '🔇' : '🔊';
    if (text) text.textContent = isMuted ? ' 사운드 OFF' : ' 사운드 ON';
    soundBtn.title = isMuted ? '사운드 켜기' : '사운드 끄기';
  }

  pauseGame() {
    if (this.state !== 'PLAYING') return;
    this.state = 'PAUSED';
    const pauseModal = document.getElementById('pause-modal');
    if (pauseModal) pauseModal.style.display = 'flex';
    this.updatePauseButton(true);
    sounds.suspend();
  }

  resumeGame() {
    if (this.state !== 'PAUSED') return;
    this.state = 'PLAYING';
    const pauseModal = document.getElementById('pause-modal');
    if (pauseModal) pauseModal.style.display = 'none';
    this.updatePauseButton(false);
    sounds.resume();
  }

  togglePause() {
    if (this.state === 'PLAYING') {
      this.pauseGame();
    } else if (this.state === 'PAUSED') {
      this.resumeGame();
    }
  }

  setupEventListeners() {
    window.addEventListener('resize', () => { this.setAppHeight(); this.resizeCanvas(); });

    // Orientation changes on mobile can alter innerHeight; sync app height shortly after orientation change
    window.addEventListener('orientationchange', () => { setTimeout(() => { this.setAppHeight(); this.resizeCanvas(); }, 120); });

    // Horizontal wheel scroll on turret selector deck when window is narrow
    const turretSelector = document.querySelector('.turret-selector');
    if (turretSelector) {
      turretSelector.addEventListener('wheel', (e) => {
        if (e.deltaY !== 0) {
          e.preventDefault();
          turretSelector.scrollLeft += e.deltaY * 0.9;
        }
      }, { passive: false });
    }

    // Auto-pause when user leaves tab, switches apps, minimizes, or screen locks (Desktop & Mobile)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.state === 'PLAYING') this.pauseGame();
      }
    });

    window.addEventListener('blur', () => {
      if (this.state === 'PLAYING') this.pauseGame();
    });

    window.addEventListener('pagehide', () => {
      if (this.state === 'PLAYING') this.pauseGame();
    });

    // Pause button and modal controls
    const pauseBtn = document.getElementById('btn-pause-toggle');
    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => {
        this.togglePause();
      });
    }

    const resumeBtn = document.getElementById('btn-resume');
    if (resumeBtn) {
      resumeBtn.addEventListener('click', () => {
        this.resumeGame();
      });
    }

    const pauseRestartBtn = document.getElementById('btn-pause-restart');
    if (pauseRestartBtn) {
      pauseRestartBtn.addEventListener('click', () => {
        document.getElementById('pause-modal').style.display = 'none';
        document.getElementById('mode-modal').style.display = 'flex';
        this.state = 'MENU';
      });
    }

    // Turret selector interactions (click/select + hover info + touch behavior)
    const isTouchCapable = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    document.querySelectorAll('.turret-card').forEach(card => {
      // Click / tap selects turret type
      card.addEventListener('click', (e) => {
        sounds.playClick();
        document.querySelectorAll('.turret-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        this.selectedTurretType = card.dataset.type;

        // For touch devices, toggle info panel on tap (tap once to preview info)
        if (isTouchCapable) {
          // toggle info visibility
          const info = document.getElementById('turret-info');
          if (this.turretInfoFor === card && this.turretInfoVisible) {
            this.hideTurretInfo();
          } else {
            this.showTurretInfo(card, card.dataset.type);
          }
          // show multi previews on mobile
          this.showAllPreviews();
        }
      });

      // Pointer hover for desktop: show info on hover
      card.addEventListener('pointerenter', (ev) => {
        if (ev.pointerType === 'mouse') {
          this.showTurretInfo(card, card.dataset.type);
        }
      });
      card.addEventListener('pointerleave', (ev) => {
        if (ev.pointerType === 'mouse') {
          this.hideTurretInfo();
        }
      });
    });

    // Skill card clicks
    document.querySelectorAll('.skill-card').forEach(card => {
      card.addEventListener('click', () => {
        this.skillManager.triggerSkill(card.dataset.skill);
      });
    });

    // Canvas pointer handling: track pointer for placement preview
    this.canvas.addEventListener('mousemove', (ev) => {
      if (this.state !== 'PLAYING') return;
      // only update preview for non-touch/mouse
      const rect = this.canvas.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;
      this.updatePreviewAtPointer(x, y);
    });
    this.canvas.addEventListener('mouseleave', () => { this.clearPreview(); });

    // Touch events: position-based preview and multi preview while selecting
    this.canvas.addEventListener('touchstart', (ev) => {
      if (this.state !== 'PLAYING') return;
      if (!this.selectedTurretType) return;
      // show multi previews by default on touch
      this.showAllPreviews();
    }, {passive:true});
    this.canvas.addEventListener('touchend', () => { this.clearPreview(); });
    this.canvas.addEventListener('touchmove', (ev) => {
      if (this.state !== 'PLAYING') return;
      const t = ev.touches[0];
      if (!t) return;
      const rect = this.canvas.getBoundingClientRect();
      const x = t.clientX - rect.left;
      const y = t.clientY - rect.top;
      this.updatePreviewAtPointer(x, y);
    }, {passive:true});

    // Canvas click handling
    this.canvas.addEventListener('click', (e) => {
      if (this.state !== 'PLAYING') return;
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Orbital strike targeting
      if (this.skillManager.orbitalTargeting) {
        this.skillManager.executeOrbital(x, y);
        this.clearPreview();
        return;
      }

      // Check click on hardpoints / turrets
      let clickedSlot = null;
      for (let hp of this.hardpoints) {
        const hpX = this.base.x + hp.relX;
        const hpY = this.base.y + hp.relY;
        const dist = Math.hypot(x - hpX, y - hpY);
        if (dist <= hp.radius + 14) {
          clickedSlot = hp;
          break;
        }
      }

      if (clickedSlot) {
        if (!clickedSlot.unlocked) {
          // Locked slot -> open slot purchase popup
          this.closePopup();
          this.openSlotPopup(clickedSlot);
          this.clearPreview();
        } else if (clickedSlot.turret) {
          // Open Upgrade/Sell popup
          this.closeSlotPopup();
          this.openPopup(clickedSlot.turret);
          this.clearPreview();
        } else {
          // Build selected turret
          this.closeSlotPopup();
          this.buildTurret(clickedSlot.id, this.selectedTurretType);
          this.closePopup();
          this.clearPreview();
        }
      } else {
        this.closePopup();
        this.closeSlotPopup();
        this.clearPreview();
      }
    });

    // Popup action buttons
    const upgradeBtn = document.getElementById('popup-btn-upgrade');
    if (upgradeBtn) {
      upgradeBtn.addEventListener('click', () => {
        if (this.selectedTurretInstance) this.upgradeTurret(this.selectedTurretInstance);
      });
    }

    const sellBtn = document.getElementById('popup-btn-sell');
    if (sellBtn) {
      sellBtn.addEventListener('click', () => {
        if (this.selectedTurretInstance) this.sellTurret(this.selectedTurretInstance);
      });
    }

    // Slot Purchase Popup buttons
    const slotBuyBtn = document.getElementById('slot-btn-buy');
    if (slotBuyBtn) {
      slotBuyBtn.addEventListener('click', () => {
        if (this.selectedSlotForPurchase) this.purchaseSlot(this.selectedSlotForPurchase);
      });
    }

    const slotCancelBtn = document.getElementById('slot-btn-cancel');
    if (slotCancelBtn) {
      slotCancelBtn.addEventListener('click', () => {
        this.closeSlotPopup();
      });
    }

    // Wave Reward Skip button
    const rewardSkipBtn = document.getElementById('btn-reward-skip');
    if (rewardSkipBtn) {
      rewardSkipBtn.addEventListener('click', () => {
        const modal = document.getElementById('reward-modal');
        if (modal) modal.style.display = 'none';
        sounds.playClick();
      });
    }

    // Admin buttons
    document.getElementById('btn-admin-kill').addEventListener('click', () => this.adminKillAll());
    document.getElementById('btn-admin-skip').addEventListener('click', () => this.adminSkipWave());
    document.getElementById('btn-admin-boss').addEventListener('click', () => this.adminSpawnBoss());
    document.getElementById('btn-admin-god').addEventListener('click', () => this.adminToggleGodmode());
    document.getElementById('btn-admin-speed').addEventListener('click', () => this.adminSpeedToggle());
    document.getElementById('btn-admin-heal').addEventListener('click', () => {
      this.base.hp = this.base.maxHp;
      this.base.shield = this.base.maxShield;
      sounds.playClick();
      this.fx.addNotification(this.canvas.width / 2, 250, '기지 내구도 100% 완전 수리 완료', '#10b981');
    });

    const adminSlotsBtn = document.getElementById('btn-admin-slots');
    if (adminSlotsBtn) {
      adminSlotsBtn.addEventListener('click', () => this.unlockAllSlots());
    }

    // Keybindings
    window.addEventListener('keydown', (e) => {
      // Toggle Pause with P or Spacebar
      if (e.key === 'p' || e.key === 'P' || e.code === 'Space') {
        if (this.state === 'PLAYING' || this.state === 'PAUSED') {
          e.preventDefault();
          this.togglePause();
          return;
        }
      }

      if (this.state !== 'PLAYING') return;

      if (e.key >= '1' && e.key <= '9') {
        const types = ['laser', 'plasma', 'missile', 'emp', 'repair', 'sniper', 'tesla', 'flamethrower', 'freezer'];
        const selected = types[parseInt(e.key) - 1];
        if (selected) {
          this.selectedTurretType = selected;
          document.querySelectorAll('.turret-card').forEach(c => {
            c.classList.toggle('selected', c.dataset.type === selected);
          });
          sounds.playClick();
        }
      } else if (e.key === 'q' || e.key === 'Q') {
        this.skillManager.triggerSkill('orbital');
      } else if (e.key === 'w' || e.key === 'W') {
        this.skillManager.triggerSkill('shield');
      } else if (e.key === 'e' || e.key === 'E') {
        this.skillManager.triggerSkill('stasis');
      } else if (e.key === 'Escape') {
        this.skillManager.orbitalTargeting = false;
        this.closePopup();
        const baseStatus = document.getElementById('top-base-status');
        const baseBtn = document.getElementById('btn-base-toggle');
        if (baseStatus) baseStatus.classList.remove('open');
        if (baseBtn) baseBtn.classList.remove('active');
        const adminPanel = document.getElementById('admin-panel');
        const adminBtn = document.getElementById('btn-admin-toggle');
        if (adminPanel) adminPanel.classList.remove('active');
        if (adminBtn) adminBtn.classList.remove('active');
      }
    });

    // Mode Switcher Tabs (Challenger vs Admin)
    const tabChallenger = document.getElementById('tab-mode-challenger');
    const tabAdmin = document.getElementById('tab-mode-admin');
    const panelChallenger = document.getElementById('panel-challenger');
    const panelAdmin = document.getElementById('panel-admin');

    if (tabChallenger && tabAdmin && panelChallenger && panelAdmin) {
      tabChallenger.addEventListener('click', () => {
        tabChallenger.classList.add('active');
        tabAdmin.classList.remove('active');
        panelChallenger.style.display = 'block';
        panelAdmin.style.display = 'none';
        sounds.playClick();
      });

      tabAdmin.addEventListener('click', () => {
        tabAdmin.classList.add('active');
        tabChallenger.classList.remove('active');
        panelAdmin.style.display = 'block';
        panelChallenger.style.display = 'none';
        sounds.playClick();
      });
    }

    // Difficulty Selection Pills
    const diffPills = document.querySelectorAll('.diff-pill');
    const goldValEl = document.getElementById('stat-val-gold');
    const upgradeValEl = document.getElementById('stat-val-upgrade');
    const rewardValEl = document.getElementById('stat-val-reward');

    const updateDifficultyUI = (diffKey) => {
      const cfg = DIFFICULTY_CONFIGS[diffKey];
      if (!cfg) return;
      diffPills.forEach(p => p.classList.toggle('active', p.getAttribute('data-diff') === diffKey));
      if (goldValEl) goldValEl.textContent = `${cfg.startGold} G`;
      if (upgradeValEl) upgradeValEl.textContent = `${cfg.upgradeCostMult}x`;
      if (rewardValEl) rewardValEl.textContent = `${Math.round(cfg.stageRewardMult * 100)}%`;
    };

    diffPills.forEach(pill => {
      pill.addEventListener('click', (e) => {
        e.stopPropagation();
        const diff = pill.getAttribute('data-diff');
        if (diff && DIFFICULTY_CONFIGS[diff]) {
          this.selectedDifficulty = diff;
          updateDifficultyUI(diff);
          sounds.playClick();
        }
      });
    });

    // Start Game Buttons
    const startChallengerBtn = document.getElementById('btn-start-challenger') || document.getElementById('btn-choose-challenger');
    if (startChallengerBtn) {
      startChallengerBtn.addEventListener('click', () => {
        this.startGame('CHALLENGER', this.selectedDifficulty);
      });
    }

    const startAdminBtn = document.getElementById('btn-start-admin') || document.getElementById('btn-choose-admin');
    if (startAdminBtn) {
      startAdminBtn.addEventListener('click', () => {
        this.startGame('ADMIN');
      });
    }

    // Restart Button
    document.getElementById('btn-restart').addEventListener('click', () => {
      document.getElementById('gameover-modal').style.display = 'none';
      document.getElementById('mode-modal').style.display = 'flex';
    });

    // Audio Mute Button
    document.getElementById('btn-sound-toggle').addEventListener('click', () => {
      const isMuted = sounds.toggleMute();
      this.updateSoundButton(isMuted);
    });

    // Base Defense Status Toggle Button and Popover Panel
    const baseBtn = document.getElementById('btn-base-toggle');
    const baseStatus = document.getElementById('top-base-status');
    const baseCloseBtn = document.getElementById('btn-base-status-close');

    if (baseBtn && baseStatus) {
      baseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sounds.playClick();
        const isOpen = baseStatus.classList.contains('open');
        if (isOpen) {
          baseStatus.classList.remove('open');
          baseBtn.classList.remove('active');
        } else {
          baseStatus.classList.add('open');
          baseBtn.classList.add('active');
          // Close admin panel if open
          const adminPanel = document.getElementById('admin-panel');
          const adminBtn = document.getElementById('btn-admin-toggle');
          if (adminPanel) adminPanel.classList.remove('active');
          if (adminBtn) adminBtn.classList.remove('active');
        }
      });
    }

    if (baseCloseBtn && baseStatus && baseBtn) {
      baseCloseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sounds.playClick();
        baseStatus.classList.remove('open');
        baseBtn.classList.remove('active');
      });
    }

    // Admin Cheat Panel Toggle Button and Close
    const adminBtn = document.getElementById('btn-admin-toggle');
    const adminPanel = document.getElementById('admin-panel');
    const adminCloseBtn = document.getElementById('btn-admin-close');

    if (adminBtn && adminPanel) {
      adminBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sounds.playClick();
        const isActive = adminPanel.classList.contains('active');
        if (isActive) {
          adminPanel.classList.remove('active');
          adminBtn.classList.remove('active');
        } else {
          adminPanel.classList.add('active');
          adminBtn.classList.add('active');
          // Close base status if open
          if (baseStatus) baseStatus.classList.remove('open');
          if (baseBtn) baseBtn.classList.remove('active');
        }
      });
    }

    if (adminCloseBtn && adminPanel && adminBtn) {
      adminCloseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sounds.playClick();
        adminPanel.classList.remove('active');
        adminBtn.classList.remove('active');
      });
    }

    // Canvas click closes open popovers
    this.canvas.addEventListener('click', () => {
      if (baseStatus && baseStatus.classList.contains('open')) {
        baseStatus.classList.remove('open');
        if (baseBtn) baseBtn.classList.remove('active');
      }
    });
  }

  update() {
    if (this.state !== 'PLAYING') return;

    this.starfield.update(this.gameSpeed);
    this.base.update();
    this.skillManager.update();
    this.updateConsoleStatus();

    // Wave Progression
    if (this.waveState === 'PREPARE') {
      this.waveTimer -= this.gameSpeed;
      if (this.waveTimer <= 0) {
        this.beginWaveSpawning();
      }
    } else if (this.waveState === 'SPAWNING') {
      this.spawnTimer += this.gameSpeed;
      const spawnCadence = Math.max(16, Math.floor(40 - this.wave * 1.4));
      if (this.spawnTimer >= spawnCadence) {
        this.spawnTimer = 0;
        if (this.enemiesToSpawn.length > 0) {
          const enemyConf = this.enemiesToSpawn.shift();
          this.spawnEnemy(enemyConf);
        } else {
          this.waveState = 'WAVE_ACTIVE';
        }
      }
    } else if (this.waveState === 'WAVE_ACTIVE') {
      // Check if all enemies defeated
      if (this.enemies.length === 0 && this.enemiesToSpawn.length === 0) {
        const rewardMult = this.difficultySettings?.stageRewardMult || 1.0;
        const bonusGold = Math.round((130 + this.wave * 35) * rewardMult * (1 + (this.globalBuffs.gold || 0)));
        this.gold += bonusGold;
        this.score += 250 * this.wave;
        this.fx.addNotification(this.canvas.width / 2, 220, `Wave ${this.wave} 클리어! 보너스 +${bonusGold}G 지급`, '#ffbe0b');
        this.wave++;
        this.updateHUD();
        this.startPrepareWave();
        // Show wave research choices
        this.showWaveRewardModal();
      }
    }

    // Update Turrets
    for (let t of this.turrets) {
      t.update(this.enemies, this.projectiles, this.base, this.fx);
    }

    // Update Enemies
    for (let e of this.enemies) {
      e.update(this.base, this.projectiles, this.fx);
      if (e.isDead && e.hp <= 0) {
        // Defeated enemy
        const isBoss = (e.type === 'boss');
        this.fx.createExplosion(e.x, e.y, e.color, isBoss ? 50 : 20, isBoss ? 2.5 : 1);
        sounds.playExplosion(isBoss ? 1.6 : 0.9);
        const bounty = Math.round(e.bounty * (1 + (this.globalBuffs.gold || 0)));
        this.gold += bounty;
        this.score += bounty * 10;

        if (isBoss) {
          this.bossKills++;
          const nextSlotNum = 5 + Math.min(5, this.bossKills);
          sounds.playClick();
          this.fx.addNotification(this.canvas.width / 2, 170, `👑 거대 보스 모선 격파! 포탑 슬롯 #${nextSlotNum} 해금 가능!`, '#ffbe0b');
        }

        this.updateHUD();
      }
    }
    this.enemies = this.enemies.filter(e => !e.isDead);

    // Update Projectiles
    for (let p of this.projectiles) {
      if (p instanceof EnemyProjectile) {
        p.update(this.base, this.fx);
      } else {
        p.update(this.enemies, this.fx);
      }
    }
    this.projectiles = this.projectiles.filter(p => !p.isDead);

    // Update Effects
    this.fx.update();

    // Check Base Destroyed
    if (this.base.hp <= 0) {
      this.gameOver();
    }
  }

  gameOver() {
    this.state = 'GAMEOVER';
    sounds.playExplosion(2.0);
    const finalDiffEl = document.getElementById('final-diff');
    if (finalDiffEl) {
      finalDiffEl.textContent = this.gameMode === 'ADMIN' ? '관리자' : (this.difficultySettings?.name || '보통');
      finalDiffEl.style.color = this.gameMode === 'ADMIN' ? '#f0abfc' : (this.difficultySettings?.color || '#ffbe0b');
    }
    const finalBossEl = document.getElementById('final-boss');
    if (finalBossEl) finalBossEl.textContent = `${this.bossKills}회`;
    document.getElementById('final-wave').textContent = this.wave;
    document.getElementById('final-score').textContent = this.score.toLocaleString();
    document.getElementById('gameover-modal').style.display = 'flex';
  }

  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 1. Space stars background
    this.starfield.draw(this.ctx);

    // 2. Base fortress structure (drawn FIRST so mounting pads and turrets sit cleanly ON TOP)
    this.base.draw(this.ctx);

    // 3. Structural mounting pylons connecting citadel to elevated hardpoints
    this.ctx.save();
    this.ctx.lineWidth = 10;
    this.ctx.lineCap = 'round';
    for (let hp of this.hardpoints) {
      const hpX = this.base.x + hp.relX;
      const hpY = this.base.y + hp.relY;
      this.ctx.strokeStyle = hp.unlocked ? '#1e293b' : 'rgba(30, 41, 59, 0.45)';
      this.ctx.beginPath();
      this.ctx.moveTo(hpX, this.base.y - 8);
      this.ctx.lineTo(hpX, hpY);
      this.ctx.stroke();
    }
    // Conduit lines inside pylons
    this.ctx.lineWidth = 2;
    for (let hp of this.hardpoints) {
      const hpX = this.base.x + hp.relX;
      const hpY = this.base.y + hp.relY;
      this.ctx.strokeStyle = hp.unlocked ? 'rgba(0, 240, 255, 0.6)' : 'rgba(255, 190, 11, 0.25)';
      this.ctx.beginPath();
      this.ctx.moveTo(hpX, this.base.y - 8);
      this.ctx.lineTo(hpX, hpY);
      this.ctx.stroke();
    }
    this.ctx.restore();

    // 4. Hardpoint Placement Mounts
    for (let hp of this.hardpoints) {
      const hpX = this.base.x + hp.relX;
      const hpY = this.base.y + hp.relY;

      this.ctx.save();
      // Metallic turret base socket
      this.ctx.fillStyle = '#0f172a';
      this.ctx.beginPath();
      this.ctx.arc(hpX, hpY, hp.radius, 0, Math.PI * 2);
      this.ctx.fill();

      if (!hp.unlocked) {
        const perm = this.canUnlockSlot(hp);
        if (perm.allowed) {
          // Boss requirement satisfied: Ready for purchase with gold! Glowing gold dashed border
          this.ctx.strokeStyle = '#ffbe0b';
          this.ctx.lineWidth = 2.2;
          this.ctx.setLineDash([4, 4]);
          this.ctx.beginPath();
          this.ctx.arc(hpX, hpY, hp.radius, 0, Math.PI * 2);
          this.ctx.stroke();

          this.ctx.fillStyle = 'rgba(255, 190, 11, 0.14)';
          this.ctx.fill();

          this.ctx.fillStyle = '#ffbe0b';
          this.ctx.font = '11px "Segoe UI", sans-serif';
          this.ctx.textAlign = 'center';
          this.ctx.fillText('🔓', hpX, hpY - 2);

          this.ctx.font = 'bold 9px "Segoe UI", sans-serif';
          this.ctx.fillStyle = '#fde047';
          this.ctx.fillText(`${hp.cost || 800}G`, hpX, hpY + 11);
        } else {
          // Boss requirement NOT satisfied: Crimson dashed border indicating boss lock
          this.ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
          this.ctx.lineWidth = 1.6;
          this.ctx.setLineDash([2, 4]);
          this.ctx.beginPath();
          this.ctx.arc(hpX, hpY, hp.radius, 0, Math.PI * 2);
          this.ctx.stroke();

          this.ctx.fillStyle = 'rgba(239, 68, 68, 0.06)';
          this.ctx.fill();

          this.ctx.fillStyle = '#f87171';
          this.ctx.font = '11px "Segoe UI", sans-serif';
          this.ctx.textAlign = 'center';
          this.ctx.fillText('🔒', hpX, hpY - 2);

          this.ctx.font = 'bold 8px "Segoe UI", sans-serif';
          this.ctx.fillStyle = '#fca5a5';
          this.ctx.fillText(`보스 ${perm.requiredKills}회`, hpX, hpY + 11);
        }
      } else {
        // Unlocked slot representation
        this.ctx.strokeStyle = hp.turret ? 'rgba(0, 240, 255, 0.45)' : '#00f0ff';
        this.ctx.lineWidth = hp.turret ? 1.5 : 2;
        this.ctx.setLineDash(hp.turret ? [] : [4, 4]);
        this.ctx.beginPath();
        this.ctx.arc(hpX, hpY, hp.radius, 0, Math.PI * 2);
        this.ctx.stroke();

        if (!hp.turret) {
          this.ctx.fillStyle = 'rgba(0, 240, 255, 0.12)';
          this.ctx.fill();
          this.ctx.fillStyle = '#38bdf8';
          this.ctx.font = 'bold 11px "Segoe UI", sans-serif';
          this.ctx.textAlign = 'center';
          this.ctx.fillText('+ 배치', hpX, hpY + 4);
        }
      }
      this.ctx.restore();
    }

    // 5. Range preview for selected turret instance
    if (this.selectedTurretInstance) {
      this.selectedTurretInstance.drawRange(this.ctx);
    }

    // 6. Turrets (rendered atop the clean sockets)
    for (let t of this.turrets) {
      t.draw(this.ctx, t === this.selectedTurretInstance);
    }

    // 7. Enemies
    for (let e of this.enemies) {
      e.draw(this.ctx);
    }

    // Draw Projectiles
    for (let p of this.projectiles) {
      p.draw(this.ctx);
    }

    // Draw Particle & Floating FX
    this.fx.draw(this.ctx);

    // --- Placement preview rendering (before selected turret range) ---
    if (this.preview && this.preview.active) {
      this.ctx.save();
      const alpha = 0.18;
      this.ctx.globalAlpha = alpha;
      this.ctx.lineWidth = 2;
      const cfg = TURRET_TYPES[this.selectedTurretType] || { color: 'rgba(0,240,255,0.3)' };
      this.ctx.strokeStyle = cfg.color || '#00f0ff';
      this.ctx.fillStyle = (cfg.color || '#00f0ff');

      if (this.preview.multi && Array.isArray(this.preview.list)) {
        for (let item of this.preview.list) {
          this.ctx.beginPath();
          this.ctx.arc(item.x, item.y, item.range, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.globalAlpha = 0.6;
          this.ctx.stroke();
          this.ctx.globalAlpha = alpha;
        }
      } else if (this.preview.slotId !== null) {
        this.ctx.beginPath();
        this.ctx.arc(this.preview.x, this.preview.y, this.preview.range, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.globalAlpha = 0.6;
        this.ctx.stroke();
      }
      this.ctx.restore();
    }

    // 5. Range preview for selected turret instance
    if (this.selectedTurretInstance) {
      this.selectedTurretInstance.drawRange(this.ctx);
    }

    // Orbital targeting reticle
    if (this.skillManager.orbitalTargeting) {
      this.ctx.save();
      this.ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.restore();
    }

    // Inter-wave Countdown Overlay
    if (this.waveState === 'PREPARE') {
      const secs = Math.ceil(this.waveTimer / 60);
      this.ctx.save();
      this.ctx.fillStyle = 'rgba(56, 189, 248, 0.85)';
      this.ctx.font = 'bold 20px "Segoe UI", sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(`다음 웨이브(${this.wave})까지: ${secs}초`, this.canvas.width / 2, 85);
      this.ctx.restore();
    }
  }

  loop() {
    for (let i = 0; i < this.gameSpeed; i++) {
      this.update();
    }
    this.draw();
    requestAnimationFrame(() => this.loop());
  }
}

// Instantiate and start game loop when window loads
window.addEventListener('DOMContentLoaded', () => {
  window.game = new GalaxyDefenseGame();
  window.game.loop();
});
