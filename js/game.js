// Main Game Engine

class GalaxyDefenseGame {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.resizeCanvas();

    this.fx = new FXManager();
    this.starfield = new Starfield(this.canvas.width, this.canvas.height);
    this.skillManager = new SkillManager(this);

    // Game state
    this.gameMode = null; // 'ADMIN' or 'CHALLENGER'
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
    const baseW = Math.min(680, Math.max(380, this.canvas.width * 0.52));
    this.base = new PlanetaryBase(this.canvas.width / 2, this.canvas.height - 25, baseW, 42);
    this.hardpoints = [];
    this.turrets = [];
    this.enemies = [];
    this.projectiles = [];

    this.selectedTurretType = 'laser';
    this.selectedTurretInstance = null;

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

  setupHardpoints() {
    const span = this.base.width * 0.42;
    this.hardpoints = [
      { id: 0, relX: -span,        relY: -20, radius: 22, turret: null },
      { id: 1, relX: -span * 0.5,  relY: -38, radius: 22, turret: null },
      { id: 2, relX: 0,            relY: -48, radius: 22, turret: null },
      { id: 3, relX: span * 0.5,   relY: -38, radius: 22, turret: null },
      { id: 4, relX: span,         relY: -20, radius: 22, turret: null }
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

  startGame(mode) {
    sounds.init();
    this.gameMode = mode;
    this.state = 'PLAYING';
    document.getElementById('mode-modal').style.display = 'none';
    const pauseModal = document.getElementById('pause-modal');
    if (pauseModal) pauseModal.style.display = 'none';
    const pauseBtn = document.getElementById('btn-pause-toggle');
    if (pauseBtn) pauseBtn.textContent = '⏸️ 일시정지';

    const modeBadge = document.getElementById('stat-mode-badge');
    const adminPanel = document.getElementById('admin-panel');

    if (mode === 'ADMIN') {
      modeBadge.textContent = '관리자 모드 (ADMIN)';
      modeBadge.style.borderColor = '#b537f2';
      modeBadge.style.color = '#f0abfc';
      this.gold = 999999;
      adminPanel.classList.add('active');
    } else {
      modeBadge.textContent = '도전자 모드 (CHALLENGER)';
      modeBadge.style.borderColor = '#00f0ff';
      modeBadge.style.color = '#38bdf8';
      this.gold = 350;
      adminPanel.classList.remove('active');
    }

    this.wave = 1;
    this.score = 0;
    this.turrets = [];
    for (let hp of this.hardpoints) hp.turret = null;
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
    if (turret.level >= 10) {
      this.fx.addNotification(turret.x, turret.y - 40, '최고 레벨 (Lv.10 MAX) 달성!', '#ffbe0b');
      return;
    }

    if (this.gameMode !== 'ADMIN') {
      this.gold -= turret.upgradeCost;
    }
    turret.upgrade();
    this.fx.createHitSpark(turret.x, turret.y, turret.color, 16);
    const msg = turret.level >= 10 ? 'Lv.10 [MAX] 궁극 강화 달성!' : `Lv.${turret.level} 강화 완료!`;
    this.fx.addNotification(turret.x, turret.y - 40, msg, '#10b981');
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

    if (hpBar && this.base) {
      const hpPct = Math.max(0, Math.min(100, (this.base.hp / this.base.maxHp) * 100));
      hpBar.style.width = `${hpPct}%`;
      hpVal.textContent = `${Math.round(this.base.hp)}/${this.base.maxHp}`;
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

    popup.style.left = `${Math.max(10, Math.min(container.width - 190, tX - 90))}px`;
    popup.style.top = `${Math.max(70, tY)}px`;
    popup.style.display = 'block';

    document.getElementById('popup-title').textContent = `${turret.name} (Lv.${turret.level})`;
    document.getElementById('popup-damage').textContent = `공격력: ${Math.round(turret.damage)}`;
    document.getElementById('popup-range').textContent = `사거리: ${Math.round(turret.range)}`;

    const upBtn = document.getElementById('popup-btn-upgrade');
    if (turret.level >= 10) {
      upBtn.textContent = '최고 레벨 (MAX)';
      upBtn.disabled = true;
    } else {
      upBtn.textContent = this.gameMode === 'ADMIN' ? '무료 강화' : `강화 (${turret.upgradeCost.toLocaleString()}G)`;
      upBtn.disabled = false;
    }
  }

  closePopup() {
    this.selectedTurretInstance = null;
    document.getElementById('turret-popup').style.display = 'none';
  }

  pauseGame() {
    if (this.state !== 'PLAYING') return;
    this.state = 'PAUSED';
    const pauseModal = document.getElementById('pause-modal');
    if (pauseModal) pauseModal.style.display = 'flex';
    const pauseBtn = document.getElementById('btn-pause-toggle');
    if (pauseBtn) pauseBtn.textContent = '▶ 계속하기';
    sounds.suspend();
  }

  resumeGame() {
    if (this.state !== 'PAUSED') return;
    this.state = 'PLAYING';
    const pauseModal = document.getElementById('pause-modal');
    if (pauseModal) pauseModal.style.display = 'none';
    const pauseBtn = document.getElementById('btn-pause-toggle');
    if (pauseBtn) pauseBtn.textContent = '⏸️ 일시정지';
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
    window.addEventListener('resize', () => this.resizeCanvas());

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

    // Turret selector clicks
    document.querySelectorAll('.turret-card').forEach(card => {
      card.addEventListener('click', () => {
        sounds.playClick();
        document.querySelectorAll('.turret-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        this.selectedTurretType = card.dataset.type;
      });
    });

    // Skill card clicks
    document.querySelectorAll('.skill-card').forEach(card => {
      card.addEventListener('click', () => {
        this.skillManager.triggerSkill(card.dataset.skill);
      });
    });

    // Canvas click handling
    this.canvas.addEventListener('click', (e) => {
      if (this.state !== 'PLAYING') return;
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Orbital strike targeting
      if (this.skillManager.orbitalTargeting) {
        this.skillManager.executeOrbital(x, y);
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
        if (clickedSlot.turret) {
          // Open Upgrade/Sell popup
          this.openPopup(clickedSlot.turret);
        } else {
          // Build selected turret
          this.buildTurret(clickedSlot.id, this.selectedTurretType);
          this.closePopup();
        }
      } else {
        this.closePopup();
      }
    });

    // Popup action buttons
    document.getElementById('popup-btn-upgrade').addEventListener('click', () => {
      if (this.selectedTurretInstance) this.upgradeTurret(this.selectedTurretInstance);
    });

    document.getElementById('popup-btn-sell').addEventListener('click', () => {
      if (this.selectedTurretInstance) this.sellTurret(this.selectedTurretInstance);
    });

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
      }
    });

    // Mode Selection Buttons
    document.getElementById('btn-choose-challenger').addEventListener('click', () => {
      this.startGame('CHALLENGER');
    });

    document.getElementById('btn-choose-admin').addEventListener('click', () => {
      this.startGame('ADMIN');
    });

    // Restart Button
    document.getElementById('btn-restart').addEventListener('click', () => {
      document.getElementById('gameover-modal').style.display = 'none';
      document.getElementById('mode-modal').style.display = 'flex';
    });

    // Audio Mute Button
    document.getElementById('btn-sound-toggle').addEventListener('click', () => {
      const isMuted = sounds.toggleMute();
      document.getElementById('btn-sound-toggle').textContent = isMuted ? '🔇 사운드 OFF' : '🔊 사운드 ON';
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
        const bonusGold = 130 + this.wave * 35;
        this.gold += bonusGold;
        this.score += 250 * this.wave;
        this.fx.addNotification(this.canvas.width / 2, 220, `Wave ${this.wave} 클리어! 보너스 +${bonusGold}G 지급`, '#ffbe0b');
        this.wave++;
        this.updateHUD();
        this.startPrepareWave();
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
        this.fx.createExplosion(e.x, e.y, e.color, e.type === 'boss' ? 50 : 20, e.type === 'boss' ? 2.5 : 1);
        sounds.playExplosion(e.type === 'boss' ? 1.6 : 0.9);
        const bounty = e.bounty;
        this.gold += bounty;
        this.score += bounty * 10;
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
    this.ctx.strokeStyle = '#1e293b';
    this.ctx.lineWidth = 10;
    this.ctx.lineCap = 'round';
    for (let hp of this.hardpoints) {
      const hpX = this.base.x + hp.relX;
      const hpY = this.base.y + hp.relY;
      this.ctx.beginPath();
      this.ctx.moveTo(hpX, this.base.y - 8);
      this.ctx.lineTo(hpX, hpY);
      this.ctx.stroke();
    }
    // Cyan conduit lines inside pylons
    this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.6)';
    this.ctx.lineWidth = 2;
    for (let hp of this.hardpoints) {
      const hpX = this.base.x + hp.relX;
      const hpY = this.base.y + hp.relY;
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
