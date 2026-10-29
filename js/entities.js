// Game Entities: Base, Turrets, Enemies, Projectiles

class PlanetaryBase {
  constructor(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.maxHp = 1000;
    this.hp = 1000;
    this.maxShield = 500;
    this.shield = 500;
    this.shieldRegen = 0.5; // per frame
    this.shieldDelay = 0;
    this.invincible = false;
    this.overchargeActive = false;
    this.overchargeTimer = 0;
  }

  takeDamage(amount, fx) {
    if (this.invincible || this.overchargeActive) {
      if (fx) fx.createHitSpark(this.x, this.y - 20, '#38bdf8', 8);
      sounds.playShieldHit();
      return 0;
    }

    this.shieldDelay = 120; // 2 seconds before regen resumes
    let remainingDamage = amount;

    if (this.shield > 0) {
      sounds.playShieldHit();
      if (this.shield >= remainingDamage) {
        this.shield -= remainingDamage;
        remainingDamage = 0;
        if (fx) fx.createHitSpark(this.x, this.y - 20, '#00f0ff', 5);
      } else {
        remainingDamage -= this.shield;
        this.shield = 0;
        if (fx) fx.createExplosion(this.x, this.y - 10, '#00f0ff', 12, 0.8);
      }
    }

    if (remainingDamage > 0) {
      this.hp = Math.max(0, this.hp - remainingDamage);
      sounds.playExplosion(0.8);
      if (fx) {
        fx.createExplosion(this.x + (Math.random() * 80 - 40), this.y, '#ef4444', 15, 1);
        fx.addDamageText(this.x, this.y - 40, remainingDamage, true);
      }
    }

    return remainingDamage;
  }

  repair(hpAmount, shieldAmount = 0) {
    this.hp = Math.min(this.maxHp, this.hp + hpAmount);
    this.shield = Math.min(this.maxShield, this.shield + shieldAmount);
  }

  update() {
    if (this.overchargeActive) {
      this.overchargeTimer--;
      if (this.overchargeTimer <= 0) {
        this.overchargeActive = false;
      }
    }

    if (this.shieldDelay > 0) {
      this.shieldDelay--;
    } else if (this.shield < this.maxShield) {
      this.shield = Math.min(this.maxShield, this.shield + this.shieldRegen);
    }
  }

  draw(ctx) {
    const left = this.x - this.width / 2;
    const top = this.y - this.height / 2;

    // Outer glow
    ctx.save();
    ctx.shadowBlur = 20;
    ctx.shadowColor = this.overchargeActive ? '#b537f2' : (this.shield > 0 ? '#00f0ff' : '#ef4444');

    // Base fortress structure (Sci-fi command citadel)
    const gradient = ctx.createLinearGradient(0, top, 0, top + this.height);
    gradient.addColorStop(0, '#1e293b');
    gradient.addColorStop(0.5, '#0f172a');
    gradient.addColorStop(1, '#020617');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(left + 20, top);
    ctx.lineTo(left + this.width - 20, top);
    ctx.lineTo(left + this.width, top + this.height);
    ctx.lineTo(left, top + this.height);
    ctx.closePath();
    ctx.fill();

    // Cyber border
    ctx.strokeStyle = this.overchargeActive ? '#f0abfc' : '#38bdf8';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Energy Shield Dome (envelopes the fortress and elevated defense battery)
    if (this.shield > 0 || this.overchargeActive) {
      const shieldRatio = this.overchargeActive ? 1 : (this.shield / this.maxShield);
      ctx.beginPath();
      ctx.ellipse(this.x, top, this.width / 2 + 25, 75, 0, Math.PI, 0);
      ctx.strokeStyle = this.overchargeActive ? `rgba(240, 171, 252, ${0.4 + Math.sin(Date.now() / 80) * 0.3})` : `rgba(0, 240, 255, ${0.3 * shieldRatio})`;
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = this.overchargeActive ? 'rgba(181, 55, 242, 0.12)' : `rgba(56, 189, 248, ${0.07 * shieldRatio})`;
      ctx.fill();
    }

    ctx.restore();

    // Sci-fi citadel armor panel lines (Clean, zero hardpoint overlap)
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(left + 35, top + 10);
    ctx.lineTo(left + this.width - 35, top + 10);
    ctx.stroke();

    // Subtle bottom neon integrity line (at the very bottom baseline)
    const hpRatio = this.hp / this.maxHp;
    ctx.fillStyle = hpRatio > 0.4 ? '#10b981' : hpRatio > 0.2 ? '#f59e0b' : '#ef4444';
    ctx.fillRect(left + 4, top + this.height - 2, (this.width - 8) * hpRatio, 2);
    ctx.restore();
  }
}

// Turret Class
const TURRET_TYPES = {
  laser: {
    name: '펄스 레이저',
    cost: 100,
    range: 220,
    cooldown: 14,
    damage: 32,
    color: '#00f0ff',
    icon: '⚡',
    desc: '빠른 단일 대상 연사 레이저'
  },
  plasma: {
    name: '플라즈마 캐논',
    cost: 200,
    range: 200,
    cooldown: 45,
    damage: 90,
    splashRadius: 65,
    color: '#b537f2',
    icon: '🔮',
    desc: '강력한 범위 광역 피해'
  },
  missile: {
    name: '미사일 발사대',
    cost: 320,
    range: 340,
    cooldown: 55,
    damage: 150,
    splashRadius: 40,
    color: '#ffbe0b',
    icon: '🚀',
    desc: '초장거리 유도 미사일'
  },
  emp: {
    name: 'EMP 충격기',
    cost: 250,
    range: 170,
    cooldown: 70,
    damage: 25,
    slowDuration: 100,
    color: '#3b82f6',
    icon: '🌀',
    desc: '주변 적 이동속도 60% 감속'
  },
  repair: {
    name: '수리 드론 허브',
    cost: 220,
    range: 0,
    cooldown: 60,
    healAmount: 18,
    color: '#10b981',
    icon: '🛠',
    desc: '기지 내구도 및 실드 지속 수리'
  },
  sniper: {
    name: '레일건 스나이퍼',
    cost: 450,
    range: 520,
    cooldown: 90,
    damage: 380,
    color: '#f43f5e',
    icon: '🎯',
    desc: '극초장거리 단일 관통 고위력 저격'
  },
  tesla: {
    name: '테슬라 코일',
    cost: 380,
    range: 160,
    cooldown: 30,
    damage: 55,
    chainCount: 4,
    chainRange: 80,
    color: '#a78bfa',
    icon: '⚡',
    desc: '근접 전기 연쇄 공격 (최대 4체 전이)'
  },
  flamethrower: {
    name: '화염방사기',
    cost: 290,
    range: 120,
    cooldown: 8,
    damage: 18,
    burnDuration: 120,
    color: '#f97316',
    icon: '🔥',
    desc: '근거리 화염 지속 피해 + 번 상태이상'
  },
  freezer: {
    name: '냉동 포탑',
    cost: 330,
    range: 180,
    cooldown: 50,
    damage: 20,
    freezeDuration: 180,
    color: '#67e8f9',
    icon: '❄️',
    desc: '광역 냉동 - 적 완전 동결 3초'
  }
};

class Turret {
  constructor(slotIndex, x, y, type = 'laser') {
    this.slotIndex = slotIndex;
    this.x = x;
    this.y = y;
    this.type = type;
    this.level = 1;
    this.angle = -Math.PI / 2;
    this.cooldownTimer = 0;
    this.target = null;
    this.applyStats();
  }

  applyStats() {
    const config = TURRET_TYPES[this.type];
    const multiplier = 1 + (this.level - 1) * 0.40;
    this.name = config.name;
    this.range = config.range * (1 + (this.level - 1) * 0.08);
    this.damage = config.damage ? config.damage * multiplier : 0;
    this.cooldown = Math.max(4, Math.floor(config.cooldown / (1 + (this.level - 1) * 0.12)));
    this.splashRadius = config.splashRadius ? config.splashRadius * (1 + (this.level - 1) * 0.10) : 0;
    this.slowDuration = config.slowDuration ? config.slowDuration + (this.level - 1) * 10 : 0;
    this.healAmount = config.healAmount ? config.healAmount * multiplier : 0;
    this.chainCount = config.chainCount ? (config.chainCount + Math.floor((this.level - 1) * 0.7)) : 0;
    this.chainRange = config.chainRange ? (config.chainRange + (this.level - 1) * 12) : 0;
    this.burnDuration = config.burnDuration ? config.burnDuration + (this.level - 1) * 15 : 0;
    this.freezeDuration = config.freezeDuration ? config.freezeDuration + (this.level - 1) * 15 : 0;
    this.color = config.color;
    // Balanced exponential scaling to Lv 10
    this.upgradeCost = Math.round(config.cost * Math.pow(1.35, this.level - 1));
  }

  upgrade() {
    this.level++;
    this.applyStats();
    sounds.playClick();
  }

  findTarget(enemies) {
    if (this.type === 'repair') return null;
    let closest = null;
    let minDist = this.range;

    for (let enemy of enemies) {
      if (enemy.isDead) continue;
      const dist = Math.hypot(enemy.x - this.x, enemy.y - this.y);
      if (dist <= minDist) {
        minDist = dist;
        closest = enemy;
      }
    }
    return closest;
  }

  update(enemies, projectiles, base, fx) {
    if (this.cooldownTimer > 0) this.cooldownTimer--;

    // Repair Drone Type Logic
    if (this.type === 'repair') {
      if (this.cooldownTimer <= 0) {
        base.repair(this.healAmount, this.healAmount * 0.6);
        this.cooldownTimer = this.cooldown;
        if (fx) {
          fx.createHitSpark(this.x, this.y - 10, '#10b981', 4);
          fx.addDamageText(base.x, base.y - 20, `+${Math.round(this.healAmount)}`, false);
        }
      }
      return;
    }

    // Store enemy list for tesla chain
    this._lastEnemyList = enemies;

    this.target = this.findTarget(enemies);

    if (this.target) {
      const dx = this.target.x - this.x;
      const dy = this.target.y - this.y;
      this.angle = Math.atan2(dy, dx);

      if (this.cooldownTimer <= 0) {
        this.fire(projectiles, fx);
        this.cooldownTimer = this.cooldown;
      }
    }
  }

  fire(projectiles, fx) {
    if (!this.target) return;
    const lvl = this.level;

    // Muzzle flash particle effect at turret tip
    if (fx && this.type !== 'repair') {
      const tipDist = 20 + lvl * 2;
      const muzzleX = this.x + Math.cos(this.angle) * tipDist;
      const muzzleY = this.y + Math.sin(this.angle) * tipDist;
      fx.createHitSpark(muzzleX, muzzleY, this.color, 2 + lvl);
    }

    if (this.type === 'laser') {
      sounds.playLaser();
      projectiles.push(new Projectile(
        this.x, this.y, this.target.x, this.target.y,
        15 + lvl * 1.5, this.damage, this.color, 'laser', 0, lvl
      ));
    } else if (this.type === 'plasma') {
      sounds.playPlasma();
      projectiles.push(new Projectile(
        this.x, this.y, this.target.x, this.target.y,
        9 + lvl * 0.8, this.damage, this.color, 'plasma', this.splashRadius, lvl
      ));
    } else if (this.type === 'missile') {
      sounds.playMissile();
      projectiles.push(new HomingMissile(
        this.x, this.y, this.target,
        7 + lvl * 0.8, this.damage, this.color, this.splashRadius, lvl
      ));
    } else if (this.type === 'emp') {
      sounds.playEMP();
      // Level scaling shockwave
      const waveCount = lvl >= 4 ? 3 : (lvl >= 2 ? 2 : 1);
      if (fx) {
        for (let w = 0; w < waveCount; w++) {
          setTimeout(() => {
            if (fx) fx.shockwaves.push(new Shockwave(this.x, this.y, this.range * (1 + w * 0.15), this.color, 24 + lvl * 3));
          }, w * 120);
        }
      }
      projectiles.push(new EMPBurst(this.x, this.y, this.range, this.damage, this.slowDuration, lvl));
    } else if (this.type === 'sniper') {
      sounds.playSniper();
      const p = new Projectile(
        this.x, this.y, this.target.x, this.target.y,
        30 + lvl * 2, this.damage, this.color, 'sniper', 0, lvl
      );
      projectiles.push(p);
    } else if (this.type === 'tesla') {
      sounds.playTesla();
      const nearbyEnemies = this._lastEnemyList || [];
      const totalChains = this.chainCount + Math.floor((lvl - 1) * 0.8);
      projectiles.push(new TeslaChain(
        this.x, this.y, nearbyEnemies,
        this.damage, totalChains, this.chainRange + lvl * 15, fx, lvl
      ));
    } else if (this.type === 'flamethrower') {
      sounds.playFlame();
      const flameCount = 3 + Math.floor(lvl / 2);
      const baseAngle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
      for (let i = 0; i < flameCount; i++) {
        const spread = (Math.random() - 0.5) * (0.35 + lvl * 0.05);
        const angle = baseAngle + spread;
        const tx = this.x + Math.cos(angle) * this.range;
        const ty = this.y + Math.sin(angle) * this.range;
        projectiles.push(new FlameProjectile(
          this.x, this.y, tx, ty,
          this.damage, this.burnDuration, lvl
        ));
      }
    } else if (this.type === 'freezer') {
      sounds.playFreeze();
      const waveCount = lvl >= 3 ? 2 : 1;
      if (fx) {
        for (let w = 0; w < waveCount; w++) {
          setTimeout(() => {
            if (fx) fx.shockwaves.push(new Shockwave(this.x, this.y, this.range * (1 + w * 0.2), this.color, 28 + lvl * 4));
          }, w * 150);
        }
      }
      projectiles.push(new FreezerBurst(this.x, this.y, this.range, this.damage, this.freezeDuration, lvl));
    }
  }

  draw(ctx, isSelected = false) {
    const lvl = this.level;
    ctx.save();
    ctx.translate(this.x, this.y);

    // === Level-based glow intensity (1 to 10) ===
    const glowIntensity = [0, 4, 8, 12, 16, 20, 24, 28, 34, 42, 52][lvl] || 6;
    ctx.shadowBlur = isSelected ? 22 : glowIntensity;
    ctx.shadowColor = isSelected ? '#ffbe0b' : this.color;

    // === Base Platform - scales with level ===
    const baseRadius = 14 + lvl * 1.3;
    const basePalette = [
      '#1e293b', '#1e293b', '#162032', '#0f1728', '#0a1020',
      '#080c18', '#050810', '#03050c', '#020308', '#000000', '#000000'
    ];
    ctx.fillStyle = basePalette[lvl] || '#1e293b';
    ctx.beginPath();
    ctx.arc(0, 0, baseRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = isSelected ? '#ffbe0b' : this.color;
    ctx.lineWidth = isSelected ? 3.5 : (1 + lvl * 0.35);
    ctx.stroke();

    // === Level 2+: Pulsing outer energy ring ===
    if (lvl >= 2) {
      const pulseSpeed = 250 - lvl * 15;
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() / Math.max(100, pulseSpeed));
      ctx.strokeStyle = this.color;
      ctx.globalAlpha = 0.25 + 0.35 * pulse;
      ctx.lineWidth = 1.5 + lvl * 0.2;
      ctx.beginPath();
      ctx.arc(0, 0, baseRadius + 3 + pulse * (2 + lvl * 0.5), 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // === Level 3+: Orbiting satellite dots (Scales up to 8 satellites at Lv 9-10) ===
    if (lvl >= 3) {
      const orbitCountMap = [0, 0, 0, 2, 2, 4, 4, 6, 6, 8, 8];
      const orbitCount = orbitCountMap[lvl] || 8;
      const orbitRadius = baseRadius + 7 + (lvl >= 7 ? 3 : 0);
      const rotSpeed = 450 - lvl * 25;
      const t = Date.now() / Math.max(120, rotSpeed);
      for (let i = 0; i < orbitCount; i++) {
        const angle = t + (i / orbitCount) * Math.PI * 2;
        const ox = Math.cos(angle) * orbitRadius;
        const oy = Math.sin(angle) * orbitRadius;
        ctx.fillStyle = lvl >= 8 ? (i % 2 === 0 ? '#ffbe0b' : this.color) : this.color;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(ox, oy, 2.2 + lvl * 0.15, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    if (this.type === 'repair') {
      const t = Date.now() / Math.max(80, (260 - lvl * 20));
      const droneCount = Math.min(lvl + 1, 8);
      ctx.fillStyle = this.color;
      for (let i = 0; i < droneCount; i++) {
        const angle = t + (i / droneCount) * Math.PI * 2;
        const r = 8 + lvl * 0.9;
        ctx.beginPath();
        ctx.arc(Math.cos(angle) * r, Math.sin(angle) * r, 2.8 + lvl * 0.25, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.rotate(this.angle);

      // === Barrel - scaled by level (Single -> Double -> Heavy Twin -> Triple Hyper Barrel) ===
      const barrelLength = 16 + lvl * 1.8;
      const barrelWidth = 2.8 + lvl * 0.4;

      if (lvl >= 9) {
        // Triple Hyper Cannon (Lv 9-10)
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, -barrelWidth * 1.5 - 2, barrelLength, barrelWidth * 0.9);
        ctx.fillRect(0, -barrelWidth * 0.45, barrelLength + 3, barrelWidth * 0.9);
        ctx.fillRect(0, barrelWidth * 0.6 + 2, barrelLength, barrelWidth * 0.9);

        ctx.fillStyle = this.color;
        ctx.fillRect(barrelLength - 7, -barrelWidth * 1.5 - 2, 7, barrelWidth * 0.9);
        ctx.fillRect(barrelLength - 4, -barrelWidth * 0.45, 7, barrelWidth * 0.9);
        ctx.fillRect(barrelLength - 7, barrelWidth * 0.6 + 2, 7, barrelWidth * 0.9);
      } else if (lvl >= 4) {
        // Double Barrel (Lv 4-8)
        ctx.fillStyle = '#334155';
        ctx.fillRect(0, -barrelWidth - 2, barrelLength, barrelWidth);
        ctx.fillRect(0, 2, barrelLength, barrelWidth);
        ctx.fillStyle = this.color;
        ctx.fillRect(barrelLength - 8, -barrelWidth - 2, 8, barrelWidth);
        ctx.fillRect(barrelLength - 8, 2, 8, barrelWidth);
      } else {
        // Single Barrel (Lv 1-3)
        ctx.fillStyle = '#334155';
        ctx.fillRect(0, -barrelWidth / 2, barrelLength, barrelWidth);
        ctx.fillStyle = this.color;
        ctx.fillRect(barrelLength - 8, -barrelWidth / 2, 8, barrelWidth);
      }

      // Reactor Core
      const coreSize = 7.5 + lvl * 0.9;
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(0, 0, coreSize, 0, Math.PI * 2);
      ctx.fill();

      // Core glow / pulsing
      if (lvl >= 8) {
        // Level 8-10: Mythic / Transcendent dual pulsating core
        const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 100);
        ctx.fillStyle = `rgba(255, 190, 11, ${0.7 + 0.3 * pulse})`;
        ctx.beginPath();
        ctx.arc(0, 0, coreSize * 0.75, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, coreSize * 0.35, 0, Math.PI * 2);
        ctx.fill();
      } else if (lvl >= 5) {
        const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 150);
        ctx.fillStyle = `rgba(255, 190, 11, ${0.6 + 0.4 * pulse})`;
        ctx.beginPath();
        ctx.arc(0, 0, coreSize * 0.7, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(0, 0, 3.5 + lvl * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();

    // Level badge
    const badgeColors = [
      '', '#94a3b8', '#38bdf8', '#38bdf8', '#a78bfa',
      '#a78bfa', '#f97316', '#f97316', '#ffbe0b', '#ffbe0b', '#f43f5e'
    ];
    ctx.fillStyle = badgeColors[lvl] || '#fff';
    ctx.font = `bold ${Math.min(14, 8 + lvl * 0.7)}px "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    if (lvl >= 8) {
      ctx.shadowBlur = 10;
      ctx.shadowColor = badgeColors[lvl] || '#ffbe0b';
    }
    const labelText = lvl >= 10 ? 'Lv.10 [MAX]' : `Lv.${lvl}`;
    ctx.fillText(labelText, this.x, this.y + 25 + lvl * 1.3);
    ctx.shadowBlur = 0;
  }

  drawRange(ctx) {
    if (this.range <= 0) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.25)';
    ctx.fillStyle = 'rgba(0, 240, 255, 0.04)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.range, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fill();
    ctx.restore();
  }
}

// Enemy Classes
class Enemy {
  constructor(x, y, type = 'scout', waveMultiplier = 1) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.isDead = false;
    this.slowTimer = 0;
    this.slowFactor = 1;
    this.setupType(type, waveMultiplier);
  }

  setupType(type, mult) {
    switch (type) {
      case 'scout':
        this.maxHp = 65 * mult;
        this.speed = 2.4;
        this.size = 12;
        this.damage = 25;
        this.bounty = Math.round(15 * (1 + (mult - 1) * 0.3));
        this.color = '#38bdf8';
        break;
      case 'fighter':
        this.maxHp = 160 * mult;
        this.speed = 1.6;
        this.size = 16;
        this.damage = 50;
        this.bounty = Math.round(28 * (1 + (mult - 1) * 0.3));
        this.color = '#a855f7';
        break;
      case 'cruiser':
        this.maxHp = 520 * mult;
        this.speed = 0.95;
        this.size = 24;
        this.damage = 120;
        this.bounty = Math.round(75 * (1 + (mult - 1) * 0.3));
        this.color = '#f59e0b';
        break;
      case 'stealth':
        this.maxHp = 110 * mult;
        this.speed = 2.9;
        this.size = 13;
        this.damage = 40;
        this.bounty = Math.round(38 * (1 + (mult - 1) * 0.3));
        this.color = '#06b6d4';
        this.stealthTimer = 0;
        break;
      case 'destroyer':
        // High tier Void Destroyer (Wave 5+)
        this.maxHp = 1350 * mult;
        this.speed = 0.8;
        this.size = 30;
        this.damage = 220;
        this.bounty = Math.round(140 * (1 + (mult - 1) * 0.3));
        this.color = '#ec4899';
        this.shootTimer = 0;
        break;
      case 'boss':
        this.maxHp = 4500 * mult;
        this.speed = 0.45;
        this.size = 50;
        this.damage = 400;
        this.bounty = Math.round(600 * (1 + (mult - 1) * 0.3));
        this.color = '#ef4444';
        this.shootTimer = 0;
        break;
    }
    this.hp = this.maxHp;
  }

  applySlow(duration, factor = 0.4) {
    this.slowTimer = duration;
    this.slowFactor = factor;
  }

  takeDamage(amount, fx) {
    this.hp -= amount;
    if (this.hp <= 0) {
      this.isDead = true;
    }
  }

  update(base, projectiles, fx) {
    if (this.slowTimer > 0) {
      this.slowTimer--;
      if (this.slowTimer === 0) this.slowFactor = 1;
    }

    // Burn damage
    if (this.burnTimer > 0) {
      this.burnTimer--;
      this.hp -= this.burnDamage || 3;
      if (this.hp <= 0) this.isDead = true;
    }

    const currentSpeed = this.isDead ? 0 : this.speed * this.slowFactor;

    // Movement: Move towards Base (downwards and slightly angled towards center)
    const targetX = base.x;
    const targetY = base.y - 20;
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 5) {
      this.x += (dx / dist) * currentSpeed;
      this.y += (dy / dist) * currentSpeed;
    }

    // Stealth Infiltrator effect
    if (this.type === 'stealth') {
      this.stealthTimer++;
    }

    // Boss & Destroyer attacking logic
    if (this.type === 'boss' && !this.isDead) {
      this.shootTimer++;
      if (this.shootTimer >= 85) {
        this.shootTimer = 0;
        // Boss shoots 2 heavy plasma bolts toward base
        projectiles.push(new EnemyProjectile(this.x - 22, this.y + 20, base.x - 30, base.y, 4, 38));
        projectiles.push(new EnemyProjectile(this.x + 22, this.y + 20, base.x + 30, base.y, 4, 38));
      }
    } else if (this.type === 'destroyer' && !this.isDead) {
      this.shootTimer = (this.shootTimer || 0) + 1;
      if (this.shootTimer >= 130) {
        this.shootTimer = 0;
        // Destroyer shoots single high-speed energy blast
        projectiles.push(new EnemyProjectile(this.x, this.y + 15, base.x, base.y, 4.5, 30));
      }
    }

    // Check collision with base
    if (dist < this.size + 20) {
      this.isDead = true;
      base.takeDamage(this.damage, fx);
      fx.createExplosion(this.x, this.y, this.color, 15, 1);
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    // Slow frost aura
    if (this.slowTimer > 0) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, this.size + 5, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (this.type === 'boss') {
      // Epic Mothership Boss Visual
      ctx.shadowBlur = 18;
      ctx.shadowColor = '#ef4444';

      ctx.fillStyle = '#1e1b4b';
      ctx.beginPath();
      ctx.moveTo(0, this.size);
      ctx.lineTo(this.size * 1.2, -this.size * 0.4);
      ctx.lineTo(this.size * 0.6, -this.size);
      ctx.lineTo(-this.size * 0.6, -this.size);
      ctx.lineTo(-this.size * 1.2, -this.size * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Glowing Reactor Core
      ctx.fillStyle = '#ffbe0b';
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'destroyer') {
      // Heavy Void Destroyer Visual
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#ec4899';
      ctx.fillStyle = '#31103f';
      ctx.beginPath();
      ctx.moveTo(0, this.size);
      ctx.lineTo(this.size * 0.9, -this.size * 0.5);
      ctx.lineTo(this.size * 0.4, -this.size * 0.9);
      ctx.lineTo(-this.size * 0.4, -this.size * 0.9);
      ctx.lineTo(-this.size * 0.9, -this.size * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#ec4899';
      ctx.lineWidth = 2.2;
      ctx.stroke();

      // Energy engine core
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.arc(0, -this.size * 0.2, 7, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Normal alien ships
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.moveTo(0, this.size);
      ctx.lineTo(this.size * 0.8, -this.size * 0.7);
      ctx.lineTo(0, -this.size * 0.4);
      ctx.lineTo(-this.size * 0.8, -this.size * 0.7);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();

    // HP Bar over enemy
    const barW = this.size * 1.8;
    const barH = 3;
    const barX = this.x - barW / 2;
    const barY = this.y - this.size - 8;

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = this.type === 'boss' ? '#ef4444' : '#10b981';
    ctx.fillRect(barX, barY, barW * Math.max(0, this.hp / this.maxHp), barH);
  }
}

// Projectile Classes
class Projectile {
  constructor(x, y, targetX, targetY, speed, damage, color, type = 'laser', splashRadius = 0, level = 1) {
    this.x = x;
    this.y = y;
    this.speed = speed;
    this.damage = damage;
    this.color = color;
    this.type = type;
    this.splashRadius = splashRadius;
    this.level = level;
    this.isDead = false;

    const dx = targetX - x;
    const dy = targetY - y;
    const dist = Math.hypot(dx, dy);
    this.vx = (dx / dist) * speed;
    this.vy = (dy / dist) * speed;
  }

  update(enemies, fx) {
    this.x += this.vx;
    this.y += this.vy;

    // Flight trail effect based on weapon type and level
    if (fx && Math.random() < (0.3 + this.level * 0.12)) {
      if (this.type === 'laser' && this.level >= 2) {
        fx.particles.push(new Particle(
          this.x - this.vx * 0.5, this.y - this.vy * 0.5,
          (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4,
          this.color, 1.2 + this.level * 0.4, 8 + this.level * 2, 1
        ));
      } else if (this.type === 'plasma') {
        fx.particles.push(new Particle(
          this.x, this.y,
          (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5,
          Math.random() < 0.5 ? this.color : '#e0f2fe',
          1.5 + this.level * 0.6, 12, 1
        ));
      }
    }

    // Check bounds
    if (this.x < 0 || this.x > 1400 || this.y < -50 || this.y > 1000) {
      this.isDead = true;
      return;
    }

    // Check hit with enemies
    for (let enemy of enemies) {
      if (enemy.isDead) continue;
      const hitDist = enemy.size + (this.type === 'plasma' ? (6 + this.level * 1.5) : 6);
      const dist = Math.hypot(enemy.x - this.x, enemy.y - this.y);
      if (dist <= hitDist) {
        this.hit(enemy, enemies, fx);
        break;
      }
    }
  }

  hit(enemy, enemies, fx) {
    this.isDead = true;
    const lvl = this.level;

    if (this.splashRadius > 0) {
      // Area of effect damage - scales impact with level
      const explosionCount = 14 + lvl * 6;
      const explosionIntensity = 1 + lvl * 0.25;
      fx.createExplosion(this.x, this.y, this.color, explosionCount, explosionIntensity);
      
      // Shockwave for high level plasma
      if (lvl >= 3) {
        fx.shockwaves.push(new Shockwave(this.x, this.y, this.splashRadius * 1.1, this.color, 18 + lvl * 3));
      }

      for (let e of enemies) {
        if (e.isDead) continue;
        const d = Math.hypot(e.x - this.x, e.y - this.y);
        if (d <= this.splashRadius) {
          const falloff = 1 - (d / this.splashRadius) * 0.4;
          e.takeDamage(this.damage * falloff, fx);
          fx.addDamageText(e.x, e.y, this.damage * falloff, lvl >= 4);
        }
      }
    } else {
      // Single target hit
      enemy.takeDamage(this.damage, fx);
      const sparkCount = 4 + lvl * 3;
      fx.createHitSpark(this.x, this.y, this.color, sparkCount);
      fx.addDamageText(enemy.x, enemy.y, this.damage, lvl >= 4);

      // Level 5 Critical Flash Shockwave
      if (lvl >= 5) {
        fx.shockwaves.push(new Shockwave(this.x, this.y, 45, this.color, 12));
      }
    }
  }

  draw(ctx) {
    const lvl = this.level;
    ctx.save();
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 6 + lvl * 4;
    ctx.shadowColor = this.color;

    if (this.type === 'laser') {
      const radius = 3 + lvl * 0.8;
      ctx.beginPath();
      ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
      ctx.fill();

      // Tail beam line
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 1.5 + lvl * 0.5;
      ctx.globalAlpha = 0.6 + lvl * 0.08;
      ctx.beginPath();
      ctx.moveTo(this.x - this.vx * (1.5 + lvl * 0.5), this.y - this.vy * (1.5 + lvl * 0.5));
      ctx.lineTo(this.x, this.y);
      ctx.stroke();

      // Core white bullet for high level
      if (lvl >= 3) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(this.x, this.y, radius * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (this.type === 'plasma') {
      const radius = 5 + lvl * 2;
      // Outer aura
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(this.x, this.y, radius + 2 + Math.sin(Date.now() / 80) * 2, 0, Math.PI * 2);
      ctx.fill();

      // Main core
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
      ctx.fill();

      // Hot center
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(this.x, this.y, radius * 0.45, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'sniper') {
      ctx.shadowBlur = 14 + lvl * 5;
      const headRadius = 4 + lvl * 1;
      ctx.beginPath();
      ctx.arc(this.x, this.y, headRadius, 0, Math.PI * 2);
      ctx.fill();

      // Penetrating long laser trail
      const trailLength = 5 + lvl * 2;
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 2 + lvl * 0.8;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(this.x - this.vx * trailLength, this.y - this.vy * trailLength);
      ctx.lineTo(this.x, this.y);
      ctx.stroke();

      if (lvl >= 4) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}

class HomingMissile {
  constructor(x, y, target, speed, damage, color, splashRadius, level = 1) {
    this.x = x;
    this.y = y;
    this.target = target;
    this.speed = speed;
    this.damage = damage;
    this.color = color;
    this.splashRadius = splashRadius;
    this.level = level;
    this.isDead = false;
    this.angle = -Math.PI / 2;
    this.turnSpeed = 0.12 + level * 0.02;
  }

  update(enemies, fx) {
    if (this.target && !this.target.isDead) {
      const targetAngle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
      let diff = targetAngle - this.angle;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      this.angle += Math.sign(diff) * Math.min(Math.abs(diff), this.turnSpeed);
    }

    this.x += Math.cos(this.angle) * this.speed;
    this.y += Math.sin(this.angle) * this.speed;

    // Thruster smoke and fire trail
    const lvl = this.level;
    if (Math.random() < (0.5 + lvl * 0.1)) {
      // Fire spark
      fx.particles.push(new Particle(
        this.x - Math.cos(this.angle) * 10,
        this.y - Math.sin(this.angle) * 10,
        -Math.cos(this.angle) * 1.5 + (Math.random() - 0.5) * 0.8,
        -Math.sin(this.angle) * 1.5 + (Math.random() - 0.5) * 0.8,
        lvl >= 4 ? '#38bdf8' : (Math.random() < 0.5 ? '#f59e0b' : '#ef4444'),
        1.8 + lvl * 0.4, 10 + lvl * 2, 1
      ));
      // Smoke
      fx.particles.push(new Particle(
        this.x - Math.cos(this.angle) * 12,
        this.y - Math.sin(this.angle) * 12,
        (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 0.5,
        '#64748b', 2.5 + lvl * 0.5, 16 + lvl * 2, 1, 'smoke'
      ));
    }

    // Hit test
    for (let e of enemies) {
      if (e.isDead) continue;
      if (Math.hypot(e.x - this.x, e.y - this.y) <= e.size + 8 + lvl * 1.5) {
        this.isDead = true;
        const explosionCount = 20 + lvl * 8;
        const explosionIntensity = 1.2 + lvl * 0.3;
        fx.createExplosion(this.x, this.y, '#ffbe0b', explosionCount, explosionIntensity);
        sounds.playExplosion(1 + lvl * 0.2);

        // High level multiple shockwaves
        if (lvl >= 3) {
          fx.shockwaves.push(new Shockwave(this.x, this.y, this.splashRadius * 1.15, '#f59e0b', 22 + lvl * 3));
        }

        for (let target of enemies) {
          if (target.isDead) continue;
          const d = Math.hypot(target.x - this.x, target.y - this.y);
          if (d <= this.splashRadius) {
            target.takeDamage(this.damage, fx);
            fx.addDamageText(target.x, target.y, this.damage, lvl >= 4);
          }
        }
        break;
      }
    }
  }

  draw(ctx) {
    const lvl = this.level;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    const mLen = 12 + lvl * 2;
    const mWidth = 4 + lvl * 0.8;

    // Missile body
    ctx.fillStyle = lvl >= 5 ? '#f59e0b' : '#cbd5e1';
    ctx.fillRect(-mLen / 2, -mWidth / 2, mLen, mWidth);

    // Warhead tip
    ctx.fillStyle = lvl >= 4 ? '#b537f2' : '#ef4444';
    ctx.beginPath();
    ctx.moveTo(mLen / 2 + 4, 0);
    ctx.lineTo(mLen / 2 - 2, -mWidth / 2 - 1);
    ctx.lineTo(mLen / 2 - 2, mWidth / 2 + 1);
    ctx.closePath();
    ctx.fill();

    // Wings
    ctx.fillStyle = '#475569';
    ctx.fillRect(-mLen / 2, -mWidth / 2 - 3, 3, mWidth + 6);

    ctx.restore();
  }
}

class EMPBurst {
  constructor(x, y, radius, damage, slowDuration, level = 1) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.damage = damage;
    this.slowDuration = slowDuration;
    this.level = level;
    this.isDead = false;
  }

  update(enemies, fx) {
    for (let e of enemies) {
      if (e.isDead) continue;
      const d = Math.hypot(e.x - this.x, e.y - this.y);
      if (d <= this.radius) {
        e.takeDamage(this.damage, fx);
        e.applySlow(this.slowDuration, 0.35);
        if (fx) {
          fx.createHitSpark(e.x, e.y, '#3b82f6', 4 + this.level * 2);
          fx.addDamageText(e.x, e.y, this.damage, this.level >= 4);
        }
      }
    }
    this.isDead = true;
  }

  draw() {}
}

class TeslaChain {
  constructor(x, y, enemies, damage, chainCount, chainRange, fx, level = 1) {
    this.isDead = true; // executes immediately
    this.level = level;
    // Find nearest enemy, then chain
    let remaining = [...enemies.filter(e => !e.isDead)];
    let lastX = x, lastY = y;
    for (let i = 0; i < chainCount && remaining.length > 0; i++) {
      let nearest = null, nearestDist = chainRange * (i === 0 ? 999 : 1);
      for (let e of remaining) {
        const d = Math.hypot(e.x - lastX, e.y - lastY);
        if (d < nearestDist) { nearestDist = d; nearest = e; }
      }
      if (!nearest) break;
      const chainDamage = damage * ([1, 0.8, 0.65, 0.5, 0.4][i] || 0.35);
      nearest.takeDamage(chainDamage, fx);
      if (fx) {
        const sparkColor = level >= 4 ? '#f0abfc' : '#a78bfa';
        fx.createHitSpark(nearest.x, nearest.y, sparkColor, 6 + level * 2);
        fx.addDamageText(nearest.x, nearest.y, chainDamage, level >= 4);
        if (!fx.lightningArcs) fx.lightningArcs = [];
        fx.lightningArcs.push({
          x1: lastX, y1: lastY,
          x2: nearest.x, y2: nearest.y,
          life: 8 + level * 2,
          level: level,
          color: level >= 4 ? '#c084fc' : '#a78bfa'
        });
      }
      lastX = nearest.x; lastY = nearest.y;
      remaining = remaining.filter(e => e !== nearest);
    }
  }
  update() {}
  draw() {}
}

class FlameProjectile {
  constructor(x, y, targetX, targetY, damage, burnDuration, level = 1) {
    this.x = x;
    this.y = y;
    this.damage = damage;
    this.burnDuration = burnDuration;
    this.level = level;
    this.isDead = false;
    this.life = 18 + Math.floor(Math.random() * 8) + level * 2;

    const dx = targetX - x;
    const dy = targetY - y;
    const dist = Math.hypot(dx, dy);
    const speed = 5 + Math.random() * 2 + level * 0.4;
    this.vx = (dx / dist) * speed;
    this.vy = (dy / dist) * speed;
  }

  update(enemies, fx) {
    this.x += this.vx;
    this.y += this.vy;
    this.life--;
    if (this.life <= 0) { this.isDead = true; return; }

    if (this.x < 0 || this.x > 1400 || this.y < -50 || this.y > 1000) {
      this.isDead = true;
      return;
    }

    const hitRadius = 7 + this.level * 1.5;
    for (let enemy of enemies) {
      if (enemy.isDead) continue;
      const dist = Math.hypot(enemy.x - this.x, enemy.y - this.y);
      if (dist <= enemy.size + hitRadius) {
        this.isDead = true;
        enemy.takeDamage(this.damage, fx);
        // Apply burn with level scaling
        enemy.burnTimer = this.burnDuration + this.level * 15;
        enemy.burnDamage = 3 + Math.floor(this.level * 1.2);
        if (fx) {
          const flameColor = this.level >= 4 ? '#38bdf8' : '#f97316';
          fx.createHitSpark(this.x, this.y, flameColor, 4 + this.level * 2);
          fx.addDamageText(enemy.x, enemy.y, this.damage, this.level >= 4);
        }
        break;
      }
    }
  }

  draw(ctx) {
    if (this.isDead) return;
    const alpha = this.life / 26;
    const lvl = this.level;
    ctx.save();
    ctx.globalAlpha = Math.min(1, alpha);

    // Color shift with level (Level 4+ turns into intense blue-white plasma flame)
    let color = '#f97316';
    if (lvl >= 4) {
      color = Math.random() < 0.6 ? '#38bdf8' : '#e0f2fe';
    } else if (lvl >= 2) {
      color = Math.random() < 0.5 ? '#f97316' : '#ffbe0b';
    }

    ctx.fillStyle = color;
    ctx.shadowBlur = 8 + lvl * 3;
    ctx.shadowColor = color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 3 + lvl * 1 + Math.random() * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

class FreezerBurst {
  constructor(x, y, radius, damage, freezeDuration, level = 1) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.damage = damage;
    this.freezeDuration = freezeDuration;
    this.level = level;
    this.isDead = false;
  }

  update(enemies, fx) {
    for (let e of enemies) {
      if (e.isDead) continue;
      const d = Math.hypot(e.x - this.x, e.y - this.y);
      if (d <= this.radius) {
        e.takeDamage(this.damage, fx);
        // Completely freeze
        e.slowTimer = this.freezeDuration;
        e.slowFactor = 0;
        if (fx) {
          fx.createHitSpark(e.x, e.y, '#67e8f9', 6 + this.level * 3);
          fx.addDamageText(e.x, e.y, this.damage, this.level >= 4);
        }
      }
    }
    this.isDead = true;
  }

  draw() {}
}

class EnemyProjectile {
  constructor(x, y, targetX, targetY, speed, damage) {
    this.x = x;
    this.y = y;
    this.speed = speed;
    this.damage = damage;
    this.isDead = false;

    const dx = targetX - x;
    const dy = targetY - y;
    const dist = Math.hypot(dx, dy);
    this.vx = (dx / dist) * speed;
    this.vy = (dy / dist) * speed;
  }

  update(base, fx) {
    this.x += this.vx;
    this.y += this.vy;

    // Base collision
    if (Math.hypot(this.x - base.x, this.y - base.y) <= 45) {
      this.isDead = true;
      base.takeDamage(this.damage, fx);
    }

    if (this.y > 900) this.isDead = true;
  }

  draw(ctx) {
    ctx.save();
    ctx.fillStyle = '#ef4444';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ef4444';
    ctx.beginPath();
    ctx.arc(this.x, this.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
