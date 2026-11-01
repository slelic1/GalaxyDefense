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
    cooldown: 100,
    damage: 20,
    freezeDuration: 100,
    color: '#67e8f9',
    icon: '❄️',
    desc: '광역 냉동: 적을 강력히 감속시키지만 고티어 적은 완전 정지가 아닌 감속만 적용'
  }
};

// Turret Level Passives and Combo Synergies
const TURRET_PASSIVES = {
  laser: [
    { level: 3, name: '관통 사격', desc: '발사체가 첫 번째 적을 관통하여 2체 연속 타격' },
    { level: 5, name: '과열 증폭', desc: '화염/EMP 상태이상 적 타격 시 피해 +60% 증폭' },
    { level: 7, name: '초고속 연사', desc: '재장전 쿨다운 25% 추가 감소' },
    { level: 10, name: '궁극: 트윈 빔', desc: '동시에 2줄기의 고출력 관통 레이저 일제 사격' }
  ],
  plasma: [
    { level: 3, name: '플라즈마 잔류장', desc: '폭발 위치에 플라즈마 잔류장이 남아 지속 피해' },
    { level: 5, name: '마그네틱 흡인', desc: '폭발 시 반경 내 적들을 폭심지로 순간 견인' },
    { level: 7, name: '연쇄 파편', desc: '폭발 직후 주변으로 미니 플라즈마 파편 분출' },
    { level: 10, name: '궁극: 초신성 폭격', desc: '폭발 반경 2배 확장 및 적 1초 기절' }
  ],
  missile: [
    { level: 3, name: '집속 자탄', desc: '폭발 시 2개의 추적 소형 자탄 방출' },
    { level: 5, name: '취약 표식', desc: '피격된 적은 3.5초간 모든 받는 피해 +35%' },
    { level: 7, name: '스마트 유도', desc: '타겟 사망 시 주변 적을 향해 탄두 즉시 궤도 전환' },
    { level: 10, name: '궁극: 더블 살보', desc: '한 번에 2발의 유도 미사일 동시 발사' }
  ],
  emp: [
    { level: 3, name: '방어막 분쇄', desc: 'EMP에 맞은 적 방어력 35% 약화 (피해 증폭)' },
    { level: 5, name: '전자기 구속', desc: '감속 효과가 80%로 대폭 강화' },
    { level: 7, name: '충격파 스턴', desc: '명중 시 0.8초간 적을 완전 정지' },
    { level: 10, name: '궁극: 전자기 폭풍', desc: '충격 반경 1.5배 및 화면 전체 적 2초간 감속' }
  ],
  repair: [
    { level: 3, name: '증폭 나노봇', desc: '인접 포탑들의 공격력 +15% 증가 오라' },
    { level: 5, name: '실드 리차저', desc: '수리 시 기지 방어막을 추가로 +35 충전' },
    { level: 7, name: '수호 드론 요격', desc: '수리 주기마다 전투 드론 1기가 적을 요격' },
    { level: 10, name: '궁극: 요새 과충전', desc: '기지 실드 활성 시 전 포탑 사격 속도 +25%' }
  ],
  sniper: [
    { level: 3, name: '초전도 관통탄', desc: '탄도 상의 모든 적을 일직선 완전 관통' },
    { level: 5, name: '약점 조준', desc: '체력 40% 이하인 적에게 2배 치명타' },
    { level: 7, name: '헤드샷 크리티컬', desc: '35% 확률로 3배 파괴 피해' },
    { level: 10, name: '궁극: 오비탈 레일', desc: '초광역 충격파를 동반하는 초대형 탄도 사격' }
  ],
  tesla: [
    { level: 3, name: '전도성 과부하', desc: '전기 연쇄 횟수 +3회 추가 전이' },
    { level: 5, name: '정전기 쇼크', desc: '연쇄 피격 적 0.5초 마비' },
    { level: 7, name: '연쇄 증폭', desc: '전기 전이 시마다 피해가 감소하지 않고 +15% 증폭' },
    { level: 10, name: '궁극: 플라즈마 아크', desc: '지속 아크 방전으로 화면 내 다수 적 타격' }
  ],
  flamethrower: [
    { level: 3, name: '화염 확산', desc: '불타는 적 주변으로 화염 지속 전파' },
    { level: 5, name: '열역학 반응', desc: '냉동/EMP 상태이상 적에게 화염 피해 2.2배' },
    { level: 7, name: '융해 지옥불', desc: '화염 지속 피해에 적 최대 체력 2% 비례 피해 추가' },
    { level: 10, name: '궁극: 소이탄 투척', desc: '사거리 1.5배 증가 및 지면 화염 장벽 형성' }
  ],
  freezer: [
    { level: 3, name: '빙결 파열', desc: '냉동 상태인 적 피격 시 주변에 얼음 파편 비산' },
    { level: 5, name: '절대영도', desc: '냉동 지속 시간 +1.5초 및 고티어 적도 강력 감속' },
    { level: 7, name: '영구 동토', desc: '파동 중심에 3초간 지속되는 냉각 필드 잔류' },
    { level: 10, name: '궁극: 빙하기 도래', desc: '화면 전체 적 1.5초간 동결' }
  ]
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
    const isTranscend = this.level > 10;
    const baseMultiplier = isTranscend 
      ? (1 + 9 * 0.40 + (this.level - 10) * 0.45) 
      : (1 + (this.level - 1) * 0.40);

    this.name = config.name;

    // Range scaling
    let r = config.range * (1 + (Math.min(10, this.level) - 1) * 0.08);
    if (isTranscend) r *= (1 + (this.level - 10) * 0.03);
    this.range = r;

    // Damage scaling
    this.damage = config.damage ? config.damage * baseMultiplier : 0;

    // Cooldown scaling: Freezer scales conservatively
    if (this.type === 'freezer') {
      this.cooldown = Math.max(25, Math.floor(config.cooldown / (1 + (Math.min(10, this.level) - 1) * 0.08)));
    } else {
      this.cooldown = Math.max(3, Math.floor(config.cooldown / (1 + (Math.min(10, this.level) - 1) * 0.12)));
    }

    // Laser Lv.7 passive
    if (this.type === 'laser' && this.level >= 7) {
      this.cooldown = Math.max(3, Math.floor(this.cooldown * 0.75));
    }

    this.splashRadius = config.splashRadius ? config.splashRadius * (1 + (Math.min(10, this.level) - 1) * 0.10) : 0;
    if (this.type === 'plasma' && this.level >= 10) {
      this.splashRadius *= 1.8;
    }

    this.slowDuration = config.slowDuration ? config.slowDuration + (Math.min(10, this.level) - 1) * 10 : 0;
    this.healAmount = config.healAmount ? config.healAmount * baseMultiplier : 0;
    this.chainCount = config.chainCount ? (config.chainCount + Math.floor((this.level - 1) * 0.8)) : 0;
    if (this.type === 'tesla' && this.level >= 3) this.chainCount += 3;

    this.chainRange = config.chainRange ? (config.chainRange + (this.level - 1) * 12) : 0;
    this.burnDuration = config.burnDuration ? config.burnDuration + (this.level - 1) * 12 : 0;

    if (config.freezeDuration) {
      let fd = config.freezeDuration + (this.level - 1) * 8;
      if (this.type === 'freezer' && this.level >= 5) fd += 60;
      this.freezeDuration = Math.min(fd, 220);
    } else {
      this.freezeDuration = 0;
    }

    // Global research buffs
    if (typeof window !== 'undefined' && window.game && window.game.globalBuffs) {
      const gb = window.game.globalBuffs;
      if (gb.damage) this.damage *= (1 + gb.damage);
      if (gb.range) this.range *= (1 + gb.range);
      if (gb.cooldown) this.cooldown = Math.max(3, Math.floor(this.cooldown * (1 - gb.cooldown)));
    }

    this.color = config.color;

    // Upgrade Cost scaling:
    // Lv 1~9: cost * 1.35^(level - 1)
    // Lv 10+ (초월): 1.35^9 * 1.45^(level - 10)
    const diffUpgradeMult = window.game?.difficultySettings?.upgradeCostMult || 1.0;
    if (this.level < 10) {
      this.upgradeCost = Math.round(config.cost * Math.pow(1.35, this.level - 1) * diffUpgradeMult);
    } else {
      const base10 = config.cost * Math.pow(1.35, 9);
      this.upgradeCost = Math.round(base10 * Math.pow(1.45, this.level - 10) * diffUpgradeMult);
    }
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
        const bonusShield = this.level >= 5 ? 35 : 0;
        base.repair(this.healAmount, this.healAmount * 0.6 + bonusShield);
        this.cooldownTimer = this.cooldown;
        if (fx) {
          fx.createHitSpark(this.x, this.y - 10, '#10b981', 4);
          fx.addDamageText(base.x, base.y - 20, `+${Math.round(this.healAmount)}`, false);
        }

        // Lv.7 Passive: Guardian Attack Drone sortie
        if (this.level >= 7 && enemies.length > 0) {
          const nearest = enemies.find(e => !e.isDead);
          if (nearest) {
            projectiles.push(new Projectile(
              this.x, this.y - 15, nearest.x, nearest.y,
              18, 70 * (1 + (this.level - 7) * 0.3), '#10b981', 'laser', 0, this.level
            ));
          }
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
      const tipDist = 20 + Math.min(10, lvl) * 2;
      const muzzleX = this.x + Math.cos(this.angle) * tipDist;
      const muzzleY = this.y + Math.sin(this.angle) * tipDist;
      fx.createHitSpark(muzzleX, muzzleY, this.color, 2 + Math.min(10, lvl));
    }

    if (this.type === 'laser') {
      sounds.playLaser();
      // Lv.10+ Ultimate: Twin Beam (Dual simultaneous piercing lasers)
      if (lvl >= 10) {
        const offsetDist = 6;
        const perpX = -Math.sin(this.angle) * offsetDist;
        const perpY = Math.cos(this.angle) * offsetDist;
        projectiles.push(new Projectile(
          this.x + perpX, this.y + perpY, this.target.x + perpX, this.target.y + perpY,
          18 + lvl * 1.5, this.damage * 0.8, this.color, 'laser', 0, lvl
        ));
        projectiles.push(new Projectile(
          this.x - perpX, this.y - perpY, this.target.x - perpX, this.target.y - perpY,
          18 + lvl * 1.5, this.damage * 0.8, this.color, 'laser', 0, lvl
        ));
      } else {
        projectiles.push(new Projectile(
          this.x, this.y, this.target.x, this.target.y,
          15 + lvl * 1.5, this.damage, this.color, 'laser', 0, lvl
        ));
      }
    } else if (this.type === 'plasma') {
      sounds.playPlasma();
      projectiles.push(new Projectile(
        this.x, this.y, this.target.x, this.target.y,
        9 + lvl * 0.8, this.damage, this.color, 'plasma', this.splashRadius, lvl
      ));
    } else if (this.type === 'missile') {
      sounds.playMissile();
      // Lv.10+ Ultimate: Double Salvo
      if (lvl >= 10) {
        projectiles.push(new HomingMissile(
          this.x - 10, this.y, this.target,
          8 + lvl * 0.8, this.damage * 0.85, this.color, this.splashRadius, lvl
        ));
        setTimeout(() => {
          if (this.target && !this.target.isDead) {
            projectiles.push(new HomingMissile(
              this.x + 10, this.y, this.target,
              8 + lvl * 0.8, this.damage * 0.85, this.color, this.splashRadius, lvl
            ));
          }
        }, 100);
      } else {
        projectiles.push(new HomingMissile(
          this.x, this.y, this.target,
          7 + lvl * 0.8, this.damage, this.color, this.splashRadius, lvl
        ));
      }
    } else if (this.type === 'emp') {
      sounds.playEMP();
      // Level scaling shockwave
      const waveCount = lvl >= 4 ? 3 : (lvl >= 2 ? 2 : 1);
      if (fx) {
        for (let w = 0; w < waveCount; w++) {
          setTimeout(() => {
            if (fx) fx.shockwaves.push(new Shockwave(this.x, this.y, this.range * (1 + w * 0.15), this.color, 24 + Math.min(10, lvl) * 3));
          }, w * 120);
        }
      }
      projectiles.push(new EMPBurst(this.x, this.y, this.range, this.damage, this.slowDuration, lvl));
    } else if (this.type === 'sniper') {
      sounds.playSniper();
      const p = new Projectile(
        this.x, this.y, this.target.x, this.target.y,
        32 + lvl * 2, this.damage, this.color, 'sniper', 0, lvl
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
            if (fx) fx.shockwaves.push(new Shockwave(this.x, this.y, this.range * (1 + w * 0.2), this.color, 28 + Math.min(10, lvl) * 4));
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
    const isTranscend = lvl > 10;
    const badgeColor = isTranscend ? '#f43f5e' : (badgeColors[lvl] || '#fff');
    ctx.fillStyle = badgeColor;
    ctx.font = `bold ${Math.min(14, 8 + Math.min(10, lvl) * 0.7)}px "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    if (lvl >= 8) {
      ctx.shadowBlur = isTranscend ? 14 : 10;
      ctx.shadowColor = isTranscend ? '#f43f5e' : (badgeColors[lvl] || '#ffbe0b');
    }
    const labelText = isTranscend ? `EX-Lv.${lvl}` : (lvl === 10 ? 'Lv.10 [MAX]' : `Lv.${lvl}`);
    ctx.fillText(labelText, this.x, this.y + 25 + Math.min(10, lvl) * 1.3);
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
    this.vulnTimer = 0;
    this.vulnFactor = 1;
    this.stunTimer = 0;
    this.burnTimer = 0;
    this.burnDamage = 0;
    this.setupType(type, waveMultiplier);
  }

  setupType(type, mult) {
    const diffHpMult = window.game?.difficultySettings?.enemyHpMult || 1.0;
    const diffBountyMult = window.game?.difficultySettings?.goldBountyMult || 1.0;
    const finalHpMult = mult * diffHpMult;

    switch (type) {
      case 'scout':
        this.maxHp = 65 * finalHpMult;
        this.speed = 2.4;
        this.size = 12;
        this.damage = 25;
        this.bounty = Math.round(15 * (1 + (mult - 1) * 0.3) * diffBountyMult);
        this.color = '#38bdf8';
        break;
      case 'fighter':
        this.maxHp = 160 * finalHpMult;
        this.speed = 1.6;
        this.size = 16;
        this.damage = 50;
        this.bounty = Math.round(28 * (1 + (mult - 1) * 0.3) * diffBountyMult);
        this.color = '#a855f7';
        break;
      case 'cruiser':
        this.maxHp = 520 * finalHpMult;
        this.speed = 0.95;
        this.size = 24;
        this.damage = 120;
        this.bounty = Math.round(75 * (1 + (mult - 1) * 0.3) * diffBountyMult);
        this.color = '#f59e0b';
        break;
      case 'stealth':
        this.maxHp = 110 * finalHpMult;
        this.speed = 2.9;
        this.size = 13;
        this.damage = 40;
        this.bounty = Math.round(38 * (1 + (mult - 1) * 0.3) * diffBountyMult);
        this.color = '#06b6d4';
        this.stealthTimer = 0;
        break;
      case 'destroyer':
        // High tier Void Destroyer (Wave 5+)
        this.maxHp = 1350 * finalHpMult;
        this.speed = 0.8;
        this.size = 30;
        this.damage = 220;
        this.bounty = Math.round(140 * (1 + (mult - 1) * 0.3) * diffBountyMult);
        this.color = '#ec4899';
        this.shootTimer = 0;
        break;
      case 'boss':
        this.maxHp = 4500 * finalHpMult;
        this.speed = 0.45;
        this.size = 50;
        this.damage = 400;
        this.bounty = Math.round(600 * (1 + (mult - 1) * 0.3) * diffBountyMult);
        this.color = '#ef4444';
        this.shootTimer = 0;
        break;
    }
    this.hp = this.maxHp;
  }

  applySlow(duration, factor = 0.4) {
    this.slowTimer = Math.max(this.slowTimer, duration);
    this.slowFactor = factor;
  }

  applyVuln(duration, factor = 1.35) {
    this.vulnTimer = Math.max(this.vulnTimer, duration);
    this.vulnFactor = factor;
  }

  applyStun(duration) {
    this.stunTimer = Math.max(this.stunTimer, duration);
  }

  takeDamage(amount, fx, sourceTurretType = '') {
    let finalDamage = amount;

    // Vulnerability mark (Missile Lv.5, EMP Lv.3)
    if (this.vulnTimer > 0) {
      finalDamage *= this.vulnFactor;
    }

    // Global research crit check
    if (typeof window !== 'undefined' && window.game && window.game.globalBuffs && window.game.globalBuffs.crit) {
      if (Math.random() < 0.12) {
        finalDamage *= 2.0;
        if (fx) fx.addDamageText(this.x, this.y - 14, '치명타!', true);
      }
    }

    // Combo / Synergy Interactions:
    // 1. Thermodynamic Clash: Burning enemy hit by Ice/EMP -> Steam explosion
    if (this.burnTimer > 0 && (sourceTurretType === 'freezer' || sourceTurretType === 'emp')) {
      finalDamage *= 1.8;
      if (fx) {
        fx.createExplosion(this.x, this.y, '#e0f2fe', 16, 1.2);
        fx.addDamageText(this.x, this.y - 20, '💥 열역학 충돌!', true);
      }
      this.burnTimer = 0; // consumed
    }

    // 2. Shatter Ice: Frozen/Slowed enemy hit by Sniper / Laser -> Critical shatter
    if (this.slowTimer > 0 && this.slowFactor < 0.5 && (sourceTurretType === 'sniper' || sourceTurretType === 'laser')) {
      finalDamage *= 1.5;
      if (fx) {
        fx.createHitSpark(this.x, this.y, '#67e8f9', 8);
        fx.addDamageText(this.x, this.y - 16, '❄️ 빙결 분쇄!', true);
      }
    }

    // 3. Overload Induction: EMP-debuffed enemy hit by Laser or Flamethrower
    if (this.vulnTimer > 0 && (sourceTurretType === 'laser' || sourceTurretType === 'flamethrower')) {
      finalDamage *= 1.4;
      if (fx && Math.random() < 0.4) {
        fx.createHitSpark(this.x, this.y, '#00f0ff', 6);
        fx.addDamageText(this.x, this.y - 12, '⚡ 과부하!', true);
      }
    }

    this.hp -= finalDamage;
    if (this.hp <= 0) {
      this.isDead = true;
    }
    return finalDamage;
  }

  update(base, projectiles, fx) {
    if (this.stunTimer > 0) {
      this.stunTimer--;
      // completely halted while stunned
      return;
    }

    if (this.vulnTimer > 0) {
      this.vulnTimer--;
      if (this.vulnTimer === 0) this.vulnFactor = 1;
    }

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
    this.piercingCount = (type === 'sniper' && level >= 3) ? 999 : (type === 'laser' && level >= 3 ? 1 : 0);

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
    const lvl = this.level;

    if (this.splashRadius > 0) {
      this.isDead = true;
      // Area of effect damage - scales impact with level
      const explosionCount = 14 + Math.min(10, lvl) * 6;
      const explosionIntensity = 1 + Math.min(10, lvl) * 0.25;
      fx.createExplosion(this.x, this.y, this.color, explosionCount, explosionIntensity);

      // Shockwave for high level plasma
      if (lvl >= 3) {
        fx.shockwaves.push(new Shockwave(this.x, this.y, this.splashRadius * 1.1, this.color, 18 + Math.min(10, lvl) * 3));
      }

      for (let e of enemies) {
        if (e.isDead) continue;
        const d = Math.hypot(e.x - this.x, e.y - this.y);
        if (d <= this.splashRadius) {
          const falloff = 1 - (d / this.splashRadius) * 0.4;
          
          // Plasma Lv.5+: Magnetic Pull towards epicenter
          if (this.type === 'plasma' && lvl >= 5 && d > 8) {
            e.x += ((this.x - e.x) / d) * 12;
            e.y += ((this.y - e.y) / d) * 12;
          }

          // Plasma Lv.10+: Ultimate Supernova Stun
          if (this.type === 'plasma' && lvl >= 10) {
            e.applyStun(60);
          }

          const appliedDmg = e.takeDamage(this.damage * falloff, fx, this.type);
          fx.addDamageText(e.x, e.y, appliedDmg, lvl >= 4);
        }
      }
    } else {
      // Single target / Piercing hit
      let hitDamage = this.damage;

      // Sniper Lv.5+: Execute low health target
      if (this.type === 'sniper' && lvl >= 5 && enemy.hp < enemy.maxHp * 0.4) {
        hitDamage *= 2.0;
        if (fx) fx.addDamageText(enemy.x, enemy.y - 12, '약점 저격!', true);
      }
      // Sniper Lv.7+: Headshot Critical
      if (this.type === 'sniper' && lvl >= 7 && Math.random() < 0.35) {
        hitDamage *= 3.0;
        if (fx) fx.addDamageText(enemy.x, enemy.y - 20, '헤드샷 3X!', true);
      }

      const appliedDmg = enemy.takeDamage(hitDamage, fx, this.type);
      const sparkCount = 4 + Math.min(10, lvl) * 3;
      fx.createHitSpark(this.x, this.y, this.color, sparkCount);
      fx.addDamageText(enemy.x, enemy.y, appliedDmg, lvl >= 4);

      if (this.piercingCount > 0) {
        this.piercingCount--;
        this.damage *= 0.75; // slight falloff for next target
        this.x += this.vx * 1.5;
        this.y += this.vy * 1.5;
        this.isDead = false;
      } else {
        this.isDead = true;
      }

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
    const lvl = this.level;
    // Smart retargeting for Lv.7+
    if (!this.target || this.target.isDead) {
      if (lvl >= 7) {
        let best = null; let minD = 500;
        for (let e of enemies) {
          if (e.isDead) continue;
          const d = Math.hypot(e.x - this.x, e.y - this.y);
          if (d < minD) { minD = d; best = e; }
        }
        if (best) this.target = best;
      }
    }

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
    if (Math.random() < (0.5 + Math.min(10, lvl) * 0.1)) {
      // Fire spark
      fx.particles.push(new Particle(
        this.x - Math.cos(this.angle) * 10,
        this.y - Math.sin(this.angle) * 10,
        -Math.cos(this.angle) * 1.5 + (Math.random() - 0.5) * 0.8,
        -Math.sin(this.angle) * 1.5 + (Math.random() - 0.5) * 0.8,
        lvl >= 4 ? '#38bdf8' : (Math.random() < 0.5 ? '#f59e0b' : '#ef4444'),
        1.8 + Math.min(10, lvl) * 0.4, 10 + Math.min(10, lvl) * 2, 1
      ));
      // Smoke
      fx.particles.push(new Particle(
        this.x - Math.cos(this.angle) * 12,
        this.y - Math.sin(this.angle) * 12,
        (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 0.5,
        '#64748b', 2.5 + Math.min(10, lvl) * 0.5, 16 + Math.min(10, lvl) * 2, 1, 'smoke'
      ));
    }

    // Hit test
    for (let e of enemies) {
      if (e.isDead) continue;
      if (Math.hypot(e.x - this.x, e.y - this.y) <= e.size + 8 + Math.min(10, lvl) * 1.5) {
        this.isDead = true;
        const explosionCount = 20 + Math.min(10, lvl) * 8;
        const explosionIntensity = 1.2 + Math.min(10, lvl) * 0.3;
        fx.createExplosion(this.x, this.y, '#ffbe0b', explosionCount, explosionIntensity);
        sounds.playExplosion(1 + Math.min(10, lvl) * 0.2);

        // High level multiple shockwaves
        if (lvl >= 3) {
          fx.shockwaves.push(new Shockwave(this.x, this.y, this.splashRadius * 1.15, '#f59e0b', 22 + Math.min(10, lvl) * 3));
        }

        for (let target of enemies) {
          if (target.isDead) continue;
          const d = Math.hypot(target.x - this.x, target.y - this.y);
          if (d <= this.splashRadius) {
            // Missile Lv.5+: Vulnerability debuff
            if (lvl >= 5) {
              target.applyVuln(210, 1.35);
            }
            const appliedDmg = target.takeDamage(this.damage, fx, 'missile');
            fx.addDamageText(target.x, target.y, appliedDmg, lvl >= 4);
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
        // EMP Lv.3+: Armor shatter (Vulnerability)
        if (this.level >= 3) {
          e.applyVuln(180, 1.35);
        }
        // EMP Lv.7+: Pulse Stun
        if (this.level >= 7) {
          e.applyStun(48);
        }

        const slowFactor = this.level >= 5 ? 0.2 : 0.35;
        e.applySlow(this.slowDuration, slowFactor);
        const appliedDmg = e.takeDamage(this.damage, fx, 'emp');

        if (fx) {
          fx.createHitSpark(e.x, e.y, '#3b82f6', 4 + Math.min(10, this.level) * 2);
          fx.addDamageText(e.x, e.y, appliedDmg, this.level >= 4);
        }
      }
    }

    // EMP Lv.10+: Screen-wide electromagnetic storm
    if (this.level >= 10) {
      for (let all of enemies) {
        if (!all.isDead) all.applySlow(120, 0.6);
      }
    }

    this.isDead = true;
  }

  draw() { }
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

      // Tesla Lv.7+: Chain amplification instead of decay
      let decayFactor = [1, 0.8, 0.65, 0.5, 0.4][i] || 0.35;
      if (level >= 7) {
        decayFactor = Math.pow(1.15, i);
      }
      const chainDamage = damage * decayFactor;

      // Tesla Lv.5+: Electro-shock stun
      if (level >= 5) {
        nearest.applyStun(30);
      }

      const appliedDmg = nearest.takeDamage(chainDamage, fx, 'tesla');
      if (fx) {
        const sparkColor = level >= 4 ? '#f0abfc' : '#a78bfa';
        fx.createHitSpark(nearest.x, nearest.y, sparkColor, 6 + Math.min(10, level) * 2);
        fx.addDamageText(nearest.x, nearest.y, appliedDmg, level >= 4);
        if (!fx.lightningArcs) fx.lightningArcs = [];
        fx.lightningArcs.push({
          x1: lastX, y1: lastY,
          x2: nearest.x, y2: nearest.y,
          life: 8 + Math.min(10, level) * 2,
          level: level,
          color: level >= 4 ? '#c084fc' : '#a78bfa'
        });
      }
      lastX = nearest.x; lastY = nearest.y;
      remaining = remaining.filter(e => e !== nearest);
    }
  }
  update() { }
  draw() { }
}

class FlameProjectile {
  constructor(x, y, targetX, targetY, damage, burnDuration, level = 1) {
    this.x = x;
    this.y = y;
    this.damage = damage;
    this.burnDuration = burnDuration;
    this.level = level;
    this.isDead = false;
    this.life = 18 + Math.floor(Math.random() * 8) + Math.min(10, level) * 2;

    const dx = targetX - x;
    const dy = targetY - y;
    const dist = Math.hypot(dx, dy);
    const speed = 5 + Math.random() * 2 + Math.min(10, level) * 0.4;
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

    const hitRadius = 7 + Math.min(10, this.level) * 1.5;
    for (let enemy of enemies) {
      if (enemy.isDead) continue;
      const dist = Math.hypot(enemy.x - this.x, enemy.y - this.y);
      if (dist <= enemy.size + hitRadius) {
        this.isDead = true;
        let finalFlameDamage = this.damage;

        // Flamethrower Lv.5+: Thermodynamic reaction (2.2x to slowed/vuln enemies)
        if (this.level >= 5 && (enemy.slowTimer > 0 || enemy.vulnTimer > 0)) {
          finalFlameDamage *= 2.2;
          if (fx) fx.addDamageText(enemy.x, enemy.y - 14, '열역학 작열!', true);
        }

        const appliedDmg = enemy.takeDamage(finalFlameDamage, fx, 'flamethrower');
        // Apply burn with level scaling
        enemy.burnTimer = this.burnDuration + Math.min(10, this.level) * 15;
        let baseBurnDmg = 3 + Math.floor(Math.min(10, this.level) * 1.2);
        // Flamethrower Lv.7+: Meltdown (2% max HP burn)
        if (this.level >= 7 && enemy.maxHp) {
          baseBurnDmg += Math.round(enemy.maxHp * 0.02);
        }
        enemy.burnDamage = baseBurnDmg;

        if (fx) {
          const flameColor = this.level >= 4 ? '#38bdf8' : '#f97316';
          fx.createHitSpark(this.x, this.y, flameColor, 4 + Math.min(10, this.level) * 2);
          fx.addDamageText(enemy.x, enemy.y, appliedDmg, this.level >= 4);
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
    ctx.shadowBlur = 8 + Math.min(10, lvl) * 3;
    ctx.shadowColor = color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 3 + Math.min(10, lvl) * 1 + Math.random() * 2, 0, Math.PI * 2);
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
        const appliedDmg = e.takeDamage(this.damage, fx, 'freezer');
        // Apply freeze for small/medium enemies; for large / boss-class enemies apply heavy slow instead
        if (e.type === 'boss' || e.type === 'destroyer' || e.type === 'cruiser') {
          e.slowTimer = Math.max(30, Math.floor(this.freezeDuration * 0.45));
          e.slowFactor = 0.25; // 75% slow
        } else {
          e.slowTimer = this.freezeDuration;
          e.slowFactor = 0; // fully halted
        }
        if (fx) {
          fx.createHitSpark(e.x, e.y, '#67e8f9', 6 + Math.min(10, this.level) * 3);
          fx.addDamageText(e.x, e.y, appliedDmg, this.level >= 4);
        }
      }
    }

    // Freezer Lv.10+: Screen-wide Ice Age (freeze all enemies for 1.5s)
    if (this.level >= 10) {
      for (let all of enemies) {
        if (!all.isDead) {
          all.applyStun(90);
          if (fx) fx.createHitSpark(all.x, all.y, '#67e8f9', 5);
        }
      }
    }

    this.isDead = true;
  }

  draw() { }
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
