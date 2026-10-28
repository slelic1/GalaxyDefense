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
    const multiplier = 1 + (this.level - 1) * 0.45;
    this.name = config.name;
    this.range = config.range * (1 + (this.level - 1) * 0.1);
    this.damage = config.damage * multiplier;
    this.cooldown = Math.max(6, Math.floor(config.cooldown / (1 + (this.level - 1) * 0.15)));
    this.splashRadius = config.splashRadius ? config.splashRadius * (1 + (this.level - 1) * 0.12) : 0;
    this.slowDuration = config.slowDuration || 0;
    this.healAmount = config.healAmount ? config.healAmount * multiplier : 0;
    this.color = config.color;
    this.upgradeCost = Math.round(config.cost * Math.pow(1.6, this.level));
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

    if (this.type === 'laser') {
      sounds.playLaser();
      projectiles.push(new Projectile(
        this.x, this.y, this.target.x, this.target.y,
        15, this.damage, this.color, 'laser'
      ));
    } else if (this.type === 'plasma') {
      sounds.playPlasma();
      projectiles.push(new Projectile(
        this.x, this.y, this.target.x, this.target.y,
        9, this.damage, this.color, 'plasma', this.splashRadius
      ));
    } else if (this.type === 'missile') {
      sounds.playMissile();
      projectiles.push(new HomingMissile(
        this.x, this.y, this.target,
        7, this.damage, this.color, this.splashRadius
      ));
    } else if (this.type === 'emp') {
      sounds.playEMP();
      if (fx) fx.shockwaves.push(new Shockwave(this.x, this.y, this.range, this.color, 25));
      // Immediate radial burst
      projectiles.push(new EMPBurst(this.x, this.y, this.range, this.damage, this.slowDuration));
    }
  }

  draw(ctx, isSelected = false) {
    ctx.save();
    ctx.translate(this.x, this.y);

    // Hardpoint Base platform
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = isSelected ? '#ffbe0b' : this.color;
    ctx.lineWidth = isSelected ? 3 : 1.5;
    ctx.stroke();

    if (this.type === 'repair') {
      // Rotating repair drone animation
      const t = Date.now() / 300;
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(Math.cos(t) * 8, Math.sin(t) * 8, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(Math.cos(t + Math.PI) * 8, Math.sin(t + Math.PI) * 8, 4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Rotating Turret Barrel
      ctx.rotate(this.angle);

      // Barrel
      ctx.fillStyle = '#334155';
      ctx.fillRect(0, -4, 18, 8);
      ctx.fillStyle = this.color;
      ctx.fillRect(10, -2, 10, 4);

      // Turret Head Core
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Level indicator badge
    ctx.restore();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Lv.${this.level}`, this.x, this.y + 26);
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
        this.maxHp = 60 * mult;
        this.speed = 2.4;
        this.size = 12;
        this.damage = 25;
        this.bounty = 15;
        this.color = '#38bdf8';
        break;
      case 'fighter':
        this.maxHp = 140 * mult;
        this.speed = 1.6;
        this.size = 16;
        this.damage = 50;
        this.bounty = 28;
        this.color = '#a855f7';
        break;
      case 'cruiser':
        this.maxHp = 420 * mult;
        this.speed = 0.9;
        this.size = 24;
        this.damage = 120;
        this.bounty = 65;
        this.color = '#f59e0b';
        break;
      case 'stealth':
        this.maxHp = 90 * mult;
        this.speed = 2.8;
        this.size = 13;
        this.damage = 40;
        this.bounty = 35;
        this.color = '#06b6d4';
        this.stealthTimer = 0;
        break;
      case 'boss':
        this.maxHp = 3000 * mult;
        this.speed = 0.5;
        this.size = 48;
        this.damage = 300;
        this.bounty = 500;
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

    const currentSpeed = this.speed * this.slowFactor;

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

    // Boss attacking logic
    if (this.type === 'boss' && !this.isDead) {
      this.shootTimer++;
      if (this.shootTimer >= 90) {
        this.shootTimer = 0;
        // Boss shoots plasma volley toward base
        projectiles.push(new EnemyProjectile(this.x - 20, this.y + 20, base.x - 30, base.y, 4, 35));
        projectiles.push(new EnemyProjectile(this.x + 20, this.y + 20, base.x + 30, base.y, 4, 35));
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
  constructor(x, y, targetX, targetY, speed, damage, color, type = 'laser', splashRadius = 0) {
    this.x = x;
    this.y = y;
    this.speed = speed;
    this.damage = damage;
    this.color = color;
    this.type = type;
    this.splashRadius = splashRadius;
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

    // Check bounds
    if (this.x < 0 || this.x > 1300 || this.y < -50 || this.y > 950) {
      this.isDead = true;
      return;
    }

    // Check hit with enemies
    for (let enemy of enemies) {
      if (enemy.isDead) continue;
      const dist = Math.hypot(enemy.x - this.x, enemy.y - this.y);
      if (dist <= enemy.size + 6) {
        this.hit(enemy, enemies, fx);
        break;
      }
    }
  }

  hit(enemy, enemies, fx) {
    this.isDead = true;
    if (this.splashRadius > 0) {
      // Area of effect damage
      fx.createExplosion(this.x, this.y, this.color, 16, 1.2);
      for (let e of enemies) {
        if (e.isDead) continue;
        const d = Math.hypot(e.x - this.x, e.y - this.y);
        if (d <= this.splashRadius) {
          const falloff = 1 - (d / this.splashRadius) * 0.4;
          e.takeDamage(this.damage * falloff, fx);
          fx.addDamageText(e.x, e.y, this.damage * falloff);
        }
      }
    } else {
      enemy.takeDamage(this.damage, fx);
      fx.createHitSpark(this.x, this.y, this.color, 6);
      fx.addDamageText(enemy.x, enemy.y, this.damage);
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 8;
    ctx.shadowColor = this.color;

    if (this.type === 'laser') {
      ctx.beginPath();
      ctx.arc(this.x, this.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'plasma') {
      ctx.beginPath();
      ctx.arc(this.x, this.y, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

class HomingMissile {
  constructor(x, y, target, speed, damage, color, splashRadius) {
    this.x = x;
    this.y = y;
    this.target = target;
    this.speed = speed;
    this.damage = damage;
    this.color = color;
    this.splashRadius = splashRadius;
    this.isDead = false;
    this.angle = -Math.PI / 2;
    this.turnSpeed = 0.12;
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

    // Smoke trail
    if (Math.random() < 0.6) {
      fx.particles.push(new Particle(
        this.x - Math.cos(this.angle) * 8,
        this.y - Math.sin(this.angle) * 8,
        (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 0.5,
        '#64748b', 2.5, 15, 1, 'smoke'
      ));
    }

    // Hit test
    for (let e of enemies) {
      if (e.isDead) continue;
      if (Math.hypot(e.x - this.x, e.y - this.y) <= e.size + 8) {
        this.isDead = true;
        fx.createExplosion(this.x, this.y, '#ffbe0b', 22, 1.4);
        sounds.playExplosion(1.1);
        for (let target of enemies) {
          if (target.isDead) continue;
          const d = Math.hypot(target.x - this.x, target.y - this.y);
          if (d <= this.splashRadius) {
            target.takeDamage(this.damage, fx);
            fx.addDamageText(target.x, target.y, this.damage);
          }
        }
        break;
      }
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(-6, -2, 12, 4);
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(2, -3);
    ctx.lineTo(2, 3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

class EMPBurst {
  constructor(x, y, radius, damage, slowDuration) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.damage = damage;
    this.slowDuration = slowDuration;
    this.isDead = false;
  }

  update(enemies, fx) {
    for (let e of enemies) {
      if (e.isDead) continue;
      const d = Math.hypot(e.x - this.x, e.y - this.y);
      if (d <= this.radius) {
        e.takeDamage(this.damage, fx);
        e.applySlow(this.slowDuration, 0.35);
        fx.addDamageText(e.x, e.y, this.damage);
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
