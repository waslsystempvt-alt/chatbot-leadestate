/**
 * Location category carousel (Connectivity, Shopping, Hospitals, Education)
 */
(function () {
  'use strict';

  function initLocationCarousel() {
    var root = document.getElementById('locCarousel');
    if (!root) return;

    var cards = Array.prototype.slice.call(root.querySelectorAll('.loc-card'));
    var dotsWrap = document.getElementById('locCarouselDots');
    var progressBar = document.getElementById('locCarouselProgress');
    var viewport = root.querySelector('.loc-carousel-viewport');
    var prevBtn = document.getElementById('locPrev');
    var nextBtn = document.getElementById('locNext');
    // Labels are read from each card's own title so the carousel works with
    // however many location categories the site was generated with, instead
    // of assuming a fixed set of six.
    var labels = cards.map(function (card, i) {
      var titleEl = card.querySelector('.loc-card-title');
      return titleEl ? titleEl.textContent.trim() : 'Location ' + (i + 1);
    });
    var index = 0;
    var timer = null;
    var progressRaf = null;
    var progressStart = 0;
    var intervalMs = 4200;

    if (!dotsWrap || !cards.length) return;

    var mobileMq = window.matchMedia('(max-width: 768px)');

    function syncViewportHeight() {
      if (!viewport) return;
      var setHeight = function () {
        if (mobileMq.matches) {
          var active = cards.find(function (c) {
            return c.classList.contains('is-active');
          }) || cards[0];
          if (active) {
            viewport.style.minHeight = active.offsetHeight + 'px';
          } else {
            viewport.style.minHeight = '';
          }
          return;
        }
        var maxH = 280;
        cards.forEach(function (card) {
          var probe = card.cloneNode(true);
          probe.classList.add('is-active');
          probe.style.cssText =
            'position:absolute;left:-9999px;top:0;visibility:visible;opacity:1;pointer-events:none;';
          viewport.appendChild(probe);
          maxH = Math.max(maxH, probe.offsetHeight);
          probe.remove();
        });
        viewport.style.minHeight = maxH + 'px';
      };
      requestAnimationFrame(setHeight);
    }

    labels.forEach(function (label, i) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'loc-dot' + (i === 0 ? ' is-active' : '');
      btn.textContent = label;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
      btn.addEventListener('click', function () {
        goTo(i, true);
      });
      dotsWrap.appendChild(btn);
    });

    var dots = Array.prototype.slice.call(dotsWrap.querySelectorAll('.loc-dot'));

    function resetProgress() {
      if (!progressBar) return;
      progressBar.style.width = '0%';
      progressStart = performance.now();
      if (progressRaf) cancelAnimationFrame(progressRaf);
      function tick(now) {
        var pct = Math.min(((now - progressStart) / intervalMs) * 100, 100);
        progressBar.style.width = pct + '%';
        if (pct < 100) progressRaf = requestAnimationFrame(tick);
      }
      progressRaf = requestAnimationFrame(tick);
    }

    function goTo(nextIndex, userTriggered) {
      cards[index].classList.remove('is-active');
      dots[index].classList.remove('is-active');
      dots[index].setAttribute('aria-selected', 'false');
      index = (nextIndex + cards.length) % cards.length;
      cards[index].classList.add('is-active');
      dots[index].classList.add('is-active');
      dots[index].setAttribute('aria-selected', 'true');
      resetProgress();
      if (userTriggered) restart();
      syncViewportHeight();
    }

    function next() {
      goTo(index + 1);
    }

    function prev() {
      goTo(index - 1);
    }

    function stop() {
      if (timer) clearInterval(timer);
      timer = null;
      if (progressRaf) cancelAnimationFrame(progressRaf);
    }

    function start() {
      stop();
      timer = setInterval(next, intervalMs);
      resetProgress();
    }

    function restart() {
      stop();
      start();
    }

    if (prevBtn) prevBtn.addEventListener('click', prev);
    if (nextBtn) nextBtn.addEventListener('click', next);
    root.addEventListener('mouseenter', stop);
    root.addEventListener('mouseleave', start);
    root.addEventListener('focusin', stop);
    root.addEventListener('focusout', function (e) {
      if (!root.contains(e.relatedTarget)) start();
    });

    mobileMq.addEventListener('change', syncViewportHeight);
    window.addEventListener('resize', syncViewportHeight);
    syncViewportHeight();
    start();
  }

  document.addEventListener('DOMContentLoaded', initLocationCarousel);
})();
