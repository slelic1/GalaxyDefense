// Player Active Skills Manager

class SkillManager {
  constructor(game) {
    this.game = game;
    this.skills = {
      orbital: {
        id: 'orbital',
        name: '궤도 폭격',
        hotkey: 'Q',
        icon: '🛰️',
        cooldownMax: 35 * 60, // frames (~35s)
        cooldown: 0,
        desc: '지정 구역에 강력한 궤도 레이저 폭격 (대규모 광역 피해)'
      },
      shield: {
        id: 'shield',
        name: '실드 과충전',
        hotkey: 'W',
        icon: '🛡️',
        cooldownMax: 45 * 60, // frames (~45s)
        cooldown: 0,
        desc: '8초간 기지 완전 무적 및 실드 100% 즉시 복구'
      },
      stasis: {
        id: 'stasis',
        name: '시공간 왜곡',
        hotkey: 'E',
        icon: '⏳',
        cooldownMax: 40 * 60, // frames (~40s)
        cooldown: 0,
        desc: '6초간 화면의 모든 적 이동 속도 80% 감속'
      }
    };
    this.orbitalTargeting = false;
  }

  resetAllCooldowns() {
    for (let k in this.skills) {
      this.skills[k].cooldown = 0;
    }
    this.updateUI();
  }

  triggerSkill(id) {
    const skill = this.skills[id];
    if (!skill) return;

    // In Admin mode or when cooldown ready
    if (skill.cooldown > 0 && this.game.gameMode !== 'ADMIN') {
      return;
    }

    if (id === 'orbital') {
      // Enter targeting mode
      this.orbitalTargeting = true;
      this.game.fx.addNotification(this.game.base.x, this.game.base.y - 120, '폭격 지점을 클릭하세요!', '#ffbe0b');
    } else if (id === 'shield') {
      this.executeShield();
      if (this.game.gameMode !== 'ADMIN') skill.cooldown = skill.cooldownMax;
      this.updateUI();
    } else if (id === 'stasis') {
      this.executeStasis();
      if (this.game.gameMode !== 'ADMIN') skill.cooldown = skill.cooldownMax;
      this.updateUI();
    }
  }

  executeOrbital(targetX, targetY) {
    this.orbitalTargeting = false;
    const skill = this.skills.orbital;
    if (this.game.gameMode !== 'ADMIN') skill.cooldown = skill.cooldownMax;

    sounds.playOrbitalStrike();
    this.game.fx.shockwaves.push(new Shockwave(targetX, targetY, 140, '#00f0ff', 40));
    this.game.fx.createExplosion(targetX, targetY, '#00f0ff', 40, 2.2);

    // Damage all enemies in orbital beam radius
    const radius = 130;
    for (let e of this.game.enemies) {
      if (e.isDead) continue;
      const d = Math.hypot(e.x - targetX, e.y - targetY);
      if (d <= radius) {
        e.takeDamage(600, this.game.fx);
        this.game.fx.addDamageText(e.x, e.y, 600, true);
      }
    }

    this.updateUI();
  }

  executeShield() {
    sounds.playClick();
    this.game.base.overchargeActive = true;
    this.game.base.overchargeTimer = 8 * 60; // 8 seconds
    this.game.base.shield = this.game.base.maxShield;
    this.game.fx.shockwaves.push(new Shockwave(this.game.base.x, this.game.base.y - 20, 160, '#f0abfc', 35));
    this.game.fx.addNotification(this.game.base.x, this.game.base.y - 80, '방어막 과충전 가동! [무적]', '#f0abfc');
  }

  executeStasis() {
    sounds.playEMP();
    this.game.fx.shockwaves.push(new Shockwave(this.game.base.x, this.game.base.y - 200, 450, '#38bdf8', 45));
    for (let e of this.game.enemies) {
      if (!e.isDead) {
        e.applySlow(6 * 60, 0.2); // 80% slow for 6 seconds
      }
    }
    this.game.fx.addNotification(this.game.base.x, this.game.base.y - 80, '시공간 왜곡 필드 전개!', '#38bdf8');
  }

  update() {
    for (let k in this.skills) {
      const s = this.skills[k];
      if (s.cooldown > 0) {
        s.cooldown--;
        this.updateCardUI(k, s);
      }
    }
  }

  updateCardUI(key, skill) {
    const card = document.getElementById(`skill-${key}`);
    if (!card) return;
    const overlay = card.querySelector('.cooldown-overlay');
    if (skill.cooldown > 0) {
      card.classList.add('cooldown');
      const pct = (skill.cooldown / skill.cooldownMax) * 100;
      if (overlay) {
        overlay.style.height = `${pct}%`;
        overlay.textContent = Math.ceil(skill.cooldown / 60);
      }
    } else {
      card.classList.remove('cooldown');
      if (overlay) {
        overlay.style.height = '0%';
        overlay.textContent = '';
      }
    }
  }

  updateUI() {
    for (let k in this.skills) {
      this.updateCardUI(k, this.skills[k]);
    }
  }
}
