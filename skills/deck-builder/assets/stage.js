/* ============================================================
   DECK-BUILDER — the ONE stage controller.
   There is exactly one scaler in a deck. Do not add a second
   inline one (the source repo shipped a 619-line deck-stage.js
   competing with an inline scaler; that is the bug this file
   replaces). Paste this file's full contents into every deck.
   ============================================================ */
(function () {
  'use strict';

  const STAGE_W = 1920, STAGE_H = 1080;

  class Deck {
    constructor() {
      this.stage = document.querySelector('.deck-stage');
      this.slides = Array.from(document.querySelectorAll('.slide'));
      this.i = 0;
      this.counter = document.querySelector('.deck-chrome--counter');
      if (!this.stage || !this.slides.length) return;
      this._fit();
      addEventListener('resize', () => this._fit(), { passive: true });
      this._bindKeys();
      this._bindWheel();
      this._bindTouch();
      addEventListener('hashchange', () => this._fromHash());
      this._fromHash();
    }

    /* one transform, whole stage, centred; letterbox/pillarbox */
    _fit() {
      const k = Math.min(innerWidth / STAGE_W, innerHeight / STAGE_H);
      const x = (innerWidth - STAGE_W * k) / 2;
      const y = (innerHeight - STAGE_H * k) / 2;
      this.stage.style.transform = `translate(${x}px, ${y}px) scale(${k})`;
      this.scale = k;
    }

    go(n) {
      this.i = Math.max(0, Math.min(n, this.slides.length - 1));
      this.slides.forEach((s, j) => s.classList.toggle('active', j === this.i));
      if (this.counter) this.counter.textContent = `${this.i + 1} / ${this.slides.length}`;
      const h = `#s${this.i + 1}`;
      if (location.hash !== h) history.replaceState(null, '', h);
    }
    next() { this.go(this.i + 1); }
    prev() { this.go(this.i - 1); }

    /* Accepte `#7` ET `#s7`. La forme `#s7` est là pour le PDF : un sommaire
       cliquable qui survit à l'export doit viser un id RÉEL de la page (mets
       id="s7" sur la section), sinon Chrome n'écrit aucun lien interne. La
       forme nue `#7` reste comprise — le gate et les captures s'en servent. */
    _fromHash() {
      const n = parseInt(location.hash.slice(1).replace(/^s/i, ''), 10);
      this.go((Number.isFinite(n) ? n : 1) - 1);
    }

    _bindKeys() {
      addEventListener('keydown', (e) => {
        if (e.target.isContentEditable) return;
        const k = e.key;
        if (k === 'ArrowRight' || k === 'ArrowDown' || k === ' ' || k === 'PageDown') { e.preventDefault(); this.next(); }
        else if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'PageUp') { e.preventDefault(); this.prev(); }
        else if (k === 'Home') { e.preventDefault(); this.go(0); }
        else if (k === 'End') { e.preventDefault(); this.go(this.slides.length - 1); }
      });
    }

    /* wheel: one notch = one slide, with a cooldown so a trackpad
       inertia flick doesn't skip five slides */
    _bindWheel() {
      let lock = 0;
      addEventListener('wheel', (e) => {
        const t = performance.now();
        if (t - lock < 450) return;
        if (Math.abs(e.deltaY) < 12 && Math.abs(e.deltaX) < 12) return;
        lock = t;
        (e.deltaY > 0 || e.deltaX > 0) ? this.next() : this.prev();
      }, { passive: true });
    }

    _bindTouch() {
      let x0 = 0, y0 = 0;
      addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
      addEventListener('touchend', (e) => {
        const dx = e.changedTouches[0].clientX - x0;
        const dy = e.changedTouches[0].clientY - y0;
        if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy)) return;
        dx < 0 ? this.next() : this.prev();
      }, { passive: true });
    }

    /* ---- gate API: used by bin/gate.mjs, harmless in normal use.
       Un-scales the stage so every getBoundingClientRect() is read
       directly in STAGE pixels, and freezes all motion. */
    gateOn() {
      document.body.setAttribute('data-gate', '');
      this.stage.style.transform = 'none';
    }
    gateOff() {
      document.body.removeAttribute('data-gate');
      this._fit();
    }
  }

  const boot = () => { window.__deck = new Deck(); };
  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', boot)
    : boot();
})();
