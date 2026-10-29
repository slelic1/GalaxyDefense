// Particle & Visual Effects Engine

class Starfield {
  constructor(width, height, count = 120) {
    this.width = width;
    this.height = height;
    this.stars = [];
    for (let i = 0; i < count; i++) {
      this.stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        speed: 0.3 + Math.random() * 1.8,
        size: Math.random() < 0.8 ? 1 : Math.random() < 0.95 ? 2 : 2.5,
        alpha: 0.2 + Math.random() * 0.8,
        color: Math.random() < 0.7 ? '#e0f2fe' : Math.random() < 0.85 ? '#38bdf8' : '#c084fc'
      });
    }
  }

  resize(w, h) {
    this.width = w;
    this.height = h;
  }

  update(speedMultiplier = 1) {
    for (let s of this.stars) {
      s.y += s.speed * speedMultiplier;
      if (s.y > this.height) {
        s.y = 0;
        s.x = Math.random() * this.width;
      }
    }
  }

  draw(ctx) {
    for (let s of this.stars) {
      ctx.fillStyle = s.color;
      ctx.globalAlpha = s.alpha;
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }
    ctx.globalAlpha = 1.0;
  }
}

class Particle {
  constructor(x, y, vx, vy, color, size, life, decay, type = 'normal') {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.size = size;
    this.life = life;
    this.maxLife = life;
    this.decay = decay;
    this.type = type;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life -= this.decay;
    if (this.type === 'smoke') {
      this.size += 0.15;
      this.vx *= 0.98;
      this.vy *= 0.98;
    }
    return this.life > 0;
  }

  draw(ctx) {
    const alpha = Math.max(0, this.life / this.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 8;
    ctx.shadowColor = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, Math.max(0.5, this.size), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

class Shockwave {
  constructor(x, y, maxRadius, color = '#00f0ff', duration = 30) {
    this.x = x;
    this.y = y;
    this.radius = 2;
    this.maxRadius = maxRadius;
    this.color = color;
    this.duration = duration;
    this.life = duration;
  }

  update() {
    this.life--;
    const progress = 1 - (this.life / this.duration);
    this.radius = this.maxRadius * Math.sin(progress * Math.PI / 2);
    return this.life > 0;
  }

  draw(ctx) {
    const alpha = Math.max(0, this.life / this.duration);
    ctx.save();
    ctx.globalAlpha = alpha * 0.8;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 3 * (1 - this.radius / this.maxRadius) + 1;
    ctx.shadowBlur = 12;
    ctx.shadowColor = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

class FloatingText {
  constructor(x, y, text, color = '#ffbe0b', size = 14) {
    this.x = x;
    this.y = y;
    this.text = text;
    this.color = color;
    this.size = size;
    this.life = 40;
    this.maxLife = 40;
  }

  update() {
    this.y -= 0.8;
    this.life--;
    return this.life > 0;
  }

  draw(ctx) {
    const alpha = Math.max(0, this.life / this.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `bold ${this.size}px 'Segoe UI', sans-serif`;
    ctx.fillStyle = this.color;
    ctx.textAlign = 'center';
    ctx.shadowBlur = 6;
    ctx.shadowColor = '#000';
    ctx.fillText(this.text, this.x, this.y);
    ctx.restore();
  }
}

class FXManager {
  constructor() {
    this.particles = [];
    this.shockwaves = [];
    this.floatingTexts = [];
    this.lightningArcs = [];
  }

  createExplosion(x, y, color = '#ff6b35', count = 25, intensity = 1) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (1 + Math.random() * 4) * intensity;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const size = 1.5 + Math.random() * 3 * intensity;
      const life = 20 + Math.random() * 25;
      const colors = [color, '#ffbe0b', '#fbbf24', '#ffffff', '#ef4444'];
      const c = colors[Math.floor(Math.random() * colors.length)];
      this.particles.push(new Particle(x, y, vx, vy, c, size, life, 1));
    }
    this.shockwaves.push(new Shockwave(x, y, 40 * intensity, color));
  }

  createHitSpark(x, y, color = '#00f0ff', count = 6) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 3;
      this.particles.push(new Particle(
        x, y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        color, 1.5, 12, 1
      ));
    }
  }

  addDamageText(x, y, damage, isCrit = false) {
    const text = Math.round(damage).toString();
    const color = isCrit ? '#ef4444' : '#ffbe0b';
    const size = isCrit ? 18 : 13;
    this.floatingTexts.push(new FloatingText(x + (Math.random() * 16 - 8), y, text, color, size));
  }

  addNotification(x, y, text, color = '#38bdf8') {
    this.floatingTexts.push(new FloatingText(x, y, text, color, 16));
  }

  update() {
    this.particles = this.particles.filter(p => p.update());
    this.shockwaves = this.shockwaves.filter(s => s.update());
    this.floatingTexts = this.floatingTexts.filter(t => t.update());
    if (this.lightningArcs && this.lightningArcs.length > 0) {
      this.lightningArcs = this.lightningArcs.filter(arc => {
        arc.life--;
        return arc.life > 0;
      });
    }
  }

  draw(ctx) {
    // Draw lightning arcs first
    if (this.lightningArcs && this.lightningArcs.length > 0) {
      ctx.save();
      for (let arc of this.lightningArcs) {
        const lvl = arc.level || 1;
        ctx.strokeStyle = arc.color || '#a78bfa';
        ctx.lineWidth = 1.8 + lvl * 0.8;
        ctx.shadowBlur = 10 + lvl * 4;
        ctx.shadowColor = arc.color || '#a78bfa';
        ctx.globalAlpha = Math.min(1, arc.life / 6);

        // Procedural jagged lightning bolt
        ctx.beginPath();
        ctx.moveTo(arc.x1, arc.y1);
        const steps = 6 + lvl;
        for (let s = 1; s < steps; s++) {
          const t = s / steps;
          const cx = arc.x1 + (arc.x2 - arc.x1) * t + (Math.random() - 0.5) * (14 + lvl * 4);
          const cy = arc.y1 + (arc.y2 - arc.y1) * t + (Math.random() - 0.5) * (14 + lvl * 4);
          ctx.lineTo(cx, cy);
        }
        ctx.lineTo(arc.x2, arc.y2);
        ctx.stroke();

        // White core for high levels
        if (lvl >= 3) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.globalAlpha = 0.8;
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    for (let s of this.shockwaves) s.draw(ctx);
    for (let p of this.particles) p.draw(ctx);
    for (let t of this.floatingTexts) t.draw(ctx);
  }

  clear() {
    this.particles = [];
    this.shockwaves = [];
    this.floatingTexts = [];
    this.lightningArcs = [];
  }
}
