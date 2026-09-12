  (function () {
    'use strict';

    /* ---- Country codes ---- */

    function setPageScrollLock(locked) {
      var siteScroll = document.getElementById('siteScroll');
      var isMobile = window.matchMedia('(max-width: 767px)').matches;
      if (isMobile && siteScroll) {
        siteScroll.style.overflow = locked ? 'hidden' : '';
      } else {
        document.body.style.overflow = locked ? 'hidden' : '';
      }
    }

    /* ---- Burger menu ---- */
    function initBurgerMenu() {
      var burger = document.getElementById('burgerMenu');
      var nav    = document.getElementById('headerNav');
      if (!burger || !nav) return;

      function toggle() {
        var open = burger.classList.toggle('open');
        nav.classList.toggle('open', open);
        burger.setAttribute('aria-expanded', open);
        setPageScrollLock(open);
      }

      burger.addEventListener('click', toggle);
      burger.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
      });

      /* Close when a nav link is clicked */
      nav.querySelectorAll('.headerLink').forEach(function (link) {
        link.addEventListener('click', function () {
          burger.classList.remove('open');
          nav.classList.remove('open');
          burger.setAttribute('aria-expanded', 'false');
          setPageScrollLock(false);
        });
      });
    }

    /* ---- Generic carousel factory ---- */
    function makeCarousel(opts) {
      /*
        opts: {
          trackId, prevId, nextId,
          getSlidesPerView: fn() -> number,
          indicatorsId (optional),
          onSlideChange (optional),
          autoplayMs (optional)
        }
      */
      var track = document.getElementById(opts.trackId);
      if (!track) return null;

      var slides   = track.children;
      var current  = 0;
      var total    = slides.length;
      var timer    = null;
      var touchStartX = 0;
      var touchStartY = 0;
      var touchDeltaX = 0;
      var isTouching = false;

      function spv() {
        return opts.getSlidesPerView();
      }

      function maxIdx() {
        return Math.max(0, total - Math.floor(spv()));
      }

      function go(idx) {
        current = Math.max(0, Math.min(idx, maxIdx()));
        var slideWidth = slides[0] ? slides[0].offsetWidth : 0;
        track.style.transform = 'translateX(-' + (current * slideWidth) + 'px)';
        updateIndicators();
        if (opts.onSlideChange) opts.onSlideChange(current);
      }

      function stopAutoplay() {
        if (timer) clearInterval(timer);
        timer = null;
      }

      function startAutoplay() {
        if (!opts.autoplayMs || total <= 1) return;
        stopAutoplay();
        timer = setInterval(function () {
          var next = current + 1;
          if (next > maxIdx()) next = 0;
          go(next);
        }, opts.autoplayMs);
      }

      function bindTouchEvents() {
        if (!('ontouchstart' in window) && !(navigator.maxTouchPoints > 0)) return;

        track.addEventListener('touchstart', function (e) {
          if (!e.touches || e.touches.length !== 1) return;
          isTouching = true;
          touchStartX = e.touches[0].clientX;
          touchStartY = e.touches[0].clientY;
          touchDeltaX = 0;
          stopAutoplay();
        }, { passive: true });

        track.addEventListener('touchmove', function (e) {
          if (!isTouching || !e.touches || e.touches.length !== 1) return;
          touchDeltaX = e.touches[0].clientX - touchStartX;
          var deltaY = e.touches[0].clientY - touchStartY;
          if (Math.abs(touchDeltaX) > Math.abs(deltaY)) {
            e.preventDefault();
          }
        }, { passive: false });

        function finishTouch() {
          if (!isTouching) return;
          isTouching = false;

          if (Math.abs(touchDeltaX) > 50) {
            if (touchDeltaX < 0) go(current + 1);
            else go(current - 1);
          }

          startAutoplay();
          touchDeltaX = 0;
        }

        track.addEventListener('touchend', finishTouch);
        track.addEventListener('touchcancel', finishTouch);
      }

      function updateIndicators() {
        if (!opts.indicatorsId) return;
        var container = document.getElementById(opts.indicatorsId);
        if (!container) return;
        var dots = container.querySelectorAll('button');
        dots.forEach(function (d, i) { d.classList.toggle('active', i === current); });
      }

      function buildIndicators() {
        if (!opts.indicatorsId) return;
        var container = document.getElementById(opts.indicatorsId);
        if (!container) return;
        container.innerHTML = '';
        var count = maxIdx() + 1;
        container.classList.toggle('is-hidden', count <= 1);
        for (var i = 0; i < count; i++) {
          var btn = document.createElement('button');
          btn.className = 'carouselDot' + (i === 0 ? ' active' : '');
          btn.setAttribute('role', 'tab');
          btn.setAttribute('aria-label', 'Go to slide ' + (i + 1));
          btn.dataset.idx = i;
          btn.addEventListener('click', function () { go(parseInt(this.dataset.idx, 10)); });
          container.appendChild(btn);
        }
      }

      var prevBtn = document.getElementById(opts.prevId);
      var nextBtn = document.getElementById(opts.nextId);
      if (prevBtn) prevBtn.addEventListener('click', function () { stopAutoplay();go(current - 1);startAutoplay(); });
      if (nextBtn) nextBtn.addEventListener('click', function () { stopAutoplay();go(current + 1);startAutoplay(); });

      window.addEventListener('resize', function () {
        current = 0;
        buildIndicators();
        go(0);
        startAutoplay();
      });

      buildIndicators();
      go(0);
      startAutoplay();
      bindTouchEvents();

      return {
        go: go,
        getCurrent: function () { return current; },
        getTotal: function () { return total; },
        startAutoplay: startAutoplay,
        stopAutoplay: stopAutoplay
      };
    }

    /* ---- Slides per view helpers ---- */
    function spvFromCss(sectionSelector, varName, fallback) {
      var section = document.querySelector(sectionSelector);
      if (!section) return fallback;
      var val = getComputedStyle(section).getPropertyValue(varName).trim();
      return val ? parseFloat(val) : fallback;
    }
    function spvAmenities() {
      return spvFromCss('.amenitiesSection', '--spv', 3);
    }
    function spvGallery() {
      return spvFromCss('.gallerySection', '--gal-spv', 3);
    }
    function spvFloorPlan() {
      return spvFromCss('.floorPlanSection', '--fp-spv', 3);
    }

    /* ---- Banner carousel (local images) ---- */
    function initBannerCarousel() {
      var dotsContainer = document.getElementById('bannerDots');
      var slidesWrap    = document.getElementById('bannerSlides');
      var container     = document.querySelector('.bannerImageContainer');
      if (!slidesWrap) return;

      var slideEls = slidesWrap.querySelectorAll('.bannerSlide');
      var total    = slideEls.length;
      if (!total) return;

      var current  = 0;
      var timer    = null;
      var interval = 5000;

      function buildDots() {
        if (!dotsContainer) return;
        dotsContainer.innerHTML = '';
        if (total <= 1) {
          dotsContainer.classList.add('is-hidden');
          return;
        }
        dotsContainer.classList.remove('is-hidden');
        for (var i = 0; i < total; i++) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'bannerDot' + (i === 0 ? ' active' : '');
          btn.setAttribute('role', 'tab');
          btn.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
          btn.setAttribute('aria-label', 'Banner slide ' + (i + 1));
          btn.dataset.idx = String(i);
          btn.addEventListener('click', function () {
            go(parseInt(this.dataset.idx, 10), true);
          });
          dotsContainer.appendChild(btn);
        }
      }

      function go(idx, userTriggered) {
        slideEls[current].classList.remove('is-active');
        current = (idx + total) % total;
        slideEls[current].classList.add('is-active');
        if (dotsContainer) {
          dotsContainer.querySelectorAll('.bannerDot').forEach(function (d, i) {
            d.classList.toggle('active', i === current);
            d.setAttribute('aria-selected', i === current ? 'true' : 'false');
          });
        }
        if (userTriggered) restartAutoplay();
      }

      function stopAutoplay() {
        if (timer) clearInterval(timer);
        timer = null;
      }

      function startAutoplay() {
        if (total <= 1) return;
        stopAutoplay();
        timer = setInterval(function () {
          go(current + 1);
        }, interval);
      }

      function restartAutoplay() {
        stopAutoplay();
        startAutoplay();
      }

      var prev = document.getElementById('bannerPrev');
      var next = document.getElementById('bannerNext');
      if (total <= 1) {
        if (prev) prev.style.display = 'none';
        if (next) next.style.display = 'none';
      } else {
        if (prev) {
          prev.style.display = '';
          prev.addEventListener('click', function () { go(current - 1, true); });
        }
        if (next) {
          next.style.display = '';
          next.addEventListener('click', function () { go(current + 1, true); });
        }
      }

      if (container) {
        container.addEventListener('mouseenter', stopAutoplay);
        container.addEventListener('mouseleave', startAutoplay);
      }

      buildDots();
      go(0);
      startAutoplay();
    }

    /* ---- Instagram-style story viewer ---- */
    function makeStoryViewer(config) {
      var STORY_MS = config.duration || 5000;
      var box      = document.getElementById(config.viewerId);
      var progress = document.getElementById(config.progressId);
      var img      = document.getElementById(config.imageId);
      var caption  = document.getElementById(config.captionId);
      var frame    = document.getElementById(config.frameId);
      var closeBtn = document.getElementById(config.closeId);
      if (!box || !img || !progress) return;

      var tapPrev = box.querySelector('.storyTapZone--prev');
      var tapNext = box.querySelector('.storyTapZone--next');
      var stories = [];
      var progressBars = [];
      var current = 0;
      var advanceTimer = null;
      var paused = false;

      config.slides.forEach(function (slide) {
        var imageEl = slide.querySelector('img');
        if (imageEl) {
          var src = imageEl.currentSrc || imageEl.src;
          stories.push({
            src: src.replace('/400/400', '/800/800'),
            alt: imageEl.alt || ''
          });
        }
      });

      function clearAdvanceTimer() {
        if (advanceTimer) {
          clearTimeout(advanceTimer);
          advanceTimer = null;
        }
      }

      function buildProgress() {
        progress.innerHTML = '';
        progressBars = [];
        stories.forEach(function () {
          var bar = document.createElement('div');
          bar.className = 'storyProgressBar';
          var fill = document.createElement('span');
          fill.className = 'storyProgressFill';
          bar.appendChild(fill);
          progress.appendChild(bar);
          progressBars.push({ bar: bar, fill: fill });
        });
      }

      function resetFill(fill) {
        fill.style.animation = 'none';
        fill.offsetHeight;
        fill.style.width = '0%';
      }

      function updateProgressBars() {
        progressBars.forEach(function (pb, i) {
          pb.bar.classList.remove('active', 'completed', 'paused');
          resetFill(pb.fill);
          if (i < current) {
            pb.bar.classList.add('completed');
            pb.fill.style.width = '100%';
          } else if (i === current) {
            pb.bar.classList.add('active');
            if (paused) pb.bar.classList.add('paused');
          }
        });
      }

      function scheduleAdvance() {
        clearAdvanceTimer();
        if (paused || !box.classList.contains('open')) return;
        advanceTimer = setTimeout(function () {
          if (current < stories.length - 1) {
            show(current + 1);
          } else {
            close();
          }
        }, STORY_MS);
      }

      function show(idx) {
        if (!stories.length) return;
        current = (idx + stories.length) % stories.length;
        paused = false;
        img.classList.remove('is-visible');
        img.src = stories[current].src;
        img.alt = stories[current].alt;
        if (caption) caption.textContent = stories[current].alt;
        requestAnimationFrame(function () {
          img.classList.add('is-visible');
        });
        updateProgressBars();
        scheduleAdvance();
      }

      function goPrev(e) {
        if (e) e.stopPropagation();
        show(current - 1);
      }

      function goNext(e) {
        if (e) e.stopPropagation();
        if (current >= stories.length - 1) {
          close();
        } else {
          show(current + 1);
        }
      }

      function pauseStories() {
        if (!box.classList.contains('open')) return;
        paused = true;
        clearAdvanceTimer();
        var active = progressBars[current];
        if (active) active.bar.classList.add('paused');
      }

      function resumeStories() {
        if (!box.classList.contains('open') || !paused) return;
        paused = false;
        var active = progressBars[current];
        if (active) active.bar.classList.remove('paused');
        scheduleAdvance();
      }

      function open(idx) {
        buildProgress();
        box.classList.add('open');
        box.removeAttribute('hidden');
        setPageScrollLock(true);
        show(idx);
      }

      function close() {
        clearAdvanceTimer();
        paused = false;
        box.classList.remove('open');
        box.setAttribute('hidden', '');
        setPageScrollLock(false);
        img.classList.remove('is-visible');
      }

      config.slides.forEach(function (slide, idx) {
        var target = slide.querySelector(config.imageContainerSelector);
        if (!target) return;
        target.addEventListener('click', function (e) {
          e.stopPropagation();
          open(idx);
        });
        target.style.cursor = 'pointer';
      });

      if (closeBtn) closeBtn.addEventListener('click', function (e) { e.stopPropagation(); close(); });
      if (tapPrev) tapPrev.addEventListener('click', goPrev);
      if (tapNext) tapNext.addEventListener('click', goNext);

      if (frame) {
        frame.addEventListener('mousedown', pauseStories);
        frame.addEventListener('mouseup', resumeStories);
        frame.addEventListener('mouseleave', resumeStories);
        frame.addEventListener('touchstart', pauseStories, { passive: true });
        frame.addEventListener('touchend', resumeStories);
        frame.addEventListener('touchcancel', resumeStories);
      }

      box.querySelectorAll('[data-story-cta]').forEach(function (cta) {
        cta.addEventListener('click', function (e) {
          e.stopPropagation();
          clearAdvanceTimer();
          paused = false;
          close();
          var action = cta.dataset.storyCta;
          if (action === 'visit') {
            var tourSection = document.getElementById('virtualTourSite');
            if (tourSection) tourSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            if (typeof openQuotePopup === 'function') {
              openQuotePopup('Schedule a Site Visit');
            }
          } else if (action === 'download' && typeof openQuotePopup === 'function') {
            openQuotePopup(cta.dataset.heading || 'Download Brochure');
          }
        });
      });

      document.addEventListener('keydown', function (e) {
        if (!box.classList.contains('open')) return;
        if (e.key === 'Escape')     { e.preventDefault(); close(); }
        if (e.key === 'ArrowLeft')  { e.preventDefault(); goPrev(); }
        if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
      });

    }

      setTimeout(()=>{
        openQuotePopup('Enquire Now');
      },9e3)

    /* ---- Floor Plan carousel (exposed globally for onclick handlers) ---- */
    function initFloorPlanCarousel() {
      var carousel = makeCarousel({
        trackId:         'floorPlanSlides',
        prevId:          'floorPlanPrev',
        nextId:          'floorPlanNext',
        indicatorsId:    'floorPlanIndicators',
        getSlidesPerView: spvFloorPlan,
        autoplayMs:      3500
      });

      window.floorPlanCarousel = {
        changeSlide: function (dir) {
          if (carousel) carousel.go(carousel.getCurrent() + dir);
        }
      };

      if (!carousel) return;

      var mobileQuery = window.matchMedia('(max-width: 767px)');

      function syncAutoplay() {
        if (mobileQuery.matches) carousel.startAutoplay();
        else carousel.stopAutoplay();
      }

      syncAutoplay();

      if (typeof mobileQuery.addEventListener === 'function') {
        mobileQuery.addEventListener('change', syncAutoplay);
      } else if (typeof mobileQuery.addListener === 'function') {
        mobileQuery.addListener(syncAutoplay);
      }
    }

    /* ---- Read More toggle ---- */
    function initReadMore() {
      document.querySelectorAll('.readMoreLink').forEach(function (link) {
        link.addEventListener('click', function (e) {
          e.preventDefault();
          var target  = link.dataset.target;
          var clamp   = link.previousElementSibling;
          if (!clamp || !clamp.classList.contains('clampText')) return;
          var isClamped = clamp.classList.toggle('clamped');
          link.textContent = isClamped ? ' Read More' : ' Read Less';
        });
      });
      /* Initialise all clampText elements */
      document.querySelectorAll('.clampText').forEach(function (el) {
        el.classList.add('clamped');
      });
    }

    /* ---- Quote Popup ---- */
    var QUOTE_SUBMIT_DEFAULT = '<span class="quoteIcon"></span><span class="quoteSubmitText">Submit</span>';
    var QUOTE_SUBMIT_WHATSAPP = '<i class="ri-whatsapp-fill" aria-hidden="true"></i><span class="quoteSubmitText">WhatsApp</span>';

    function getProjectName() {
      var title = document.querySelector('.price-title');
      if (title && title.textContent) {
        return title.textContent.replace(/^Price Of\s+/i, '').trim();
      }
      return 'Neelam Senroofs';
    }


    function setQuotePopupMode(mode) {
      var popup = document.getElementById('quotePopup');
      var submitBtn = document.getElementById('quotePopupSubmit');
      if (!popup || !submitBtn) return;
      popup.dataset.popupMode = mode || 'default';
      if (mode === 'whatsapp') {
        submitBtn.classList.add('quoteSubmit--whatsapp');
        submitBtn.innerHTML = QUOTE_SUBMIT_WHATSAPP;
      } else {
        submitBtn.classList.remove('quoteSubmit--whatsapp');
        submitBtn.innerHTML = QUOTE_SUBMIT_DEFAULT;
      }
    }

    window.openQuotePopup = function (heading, mode) {
      var popup = document.getElementById('quotePopup');
      if (!popup) return;
      var titleEl = document.getElementById('quoteTitle');
      if (titleEl) titleEl.textContent = heading || 'Enquire Now';
      setQuotePopupMode(mode);
      popup.classList.add('open');
      setPageScrollLock(true);
      var nameInput = popup.querySelector('.form-name');
      if (nameInput) setTimeout(function () { nameInput.focus(); }, 120);
    };

    window.closeQuotePopup = function () {
      var popup = document.getElementById('quotePopup');
      if (!popup) return;
      popup.classList.remove('open');
      setPageScrollLock(false);
      setQuotePopupMode('default');
    };

    function initCrmIntegration() {
      if (!window.LeadCRM) return;
      window.LeadCRM.init({
        getWhatsappUrl: function (name, phone) {
          return buildWhatsappPriceUrl(name, phone);
        },
        isWhatsappMode: function (form) {
          var popup = document.getElementById('quotePopup');
          return (
            (form.dataset.formType === 'popup' || form.id === 'popupLeadForm') &&
            popup &&
            popup.dataset.popupMode === 'whatsapp'
          );
        },
        getEnquiryTitle: function (form) {
          if (form.dataset.formType === 'hero' || form.id === 'heroLeadForm') {
            return 'Schedule a Site Visit';
          }
          var titleEl = document.getElementById('quoteTitle');
          return titleEl ? titleEl.textContent.trim() : 'Request Information';
        },
        onSuccess: function (form, payload, meta) {
          form.reset();
          var countrySel = form.querySelector('.form-country');
          if (countrySel) countrySel.value = '+91';
          if (form.dataset.formType === 'popup' || form.id === 'popupLeadForm') {
            closeQuotePopup();
          }
          if (meta && meta.whatsappMode) {
            form.style.opacity = '1';
          }
        }
      });
    }

    function initPopupTriggers() {
      document.querySelectorAll('.popup-trigger').forEach(function (el) {
        el.addEventListener('click', function (e) {
          if (el.tagName === 'A') e.preventDefault();
          var heading = el.dataset.heading || 'Request Information';
          var mode = el.dataset.popupMode || 'default';
          openQuotePopup(heading, mode);
        });
        if (el.classList.contains('videoThumbnail')) {
          el.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              el.click();
            }
          });
        }
      });

      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeQuotePopup();
      });
    }

    /* ---- In-page anchors (mobile scrolls .siteScroll, not window) ---- */
    function initAnchorScroll() {
      document.querySelectorAll('a[href^="#"]').forEach(function (link) {
        if (
          link.classList.contains('popup-trigger') ||
          link.classList.contains('legal-link')
        ) {
          return;
        }
        link.addEventListener('click', function (e) {
          var hash = link.getAttribute('href');
          if (!hash || hash === '#') return;
          var target = document.querySelector(hash);
          if (!target) return;
          if (!window.matchMedia('(max-width: 767px)').matches) return;
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });
    }

    /* ---- Active nav on scroll ---- */
    function initScrollSpy() {
      var sections = document.querySelectorAll('section[id], header[id]');
      var navLinks = document.querySelectorAll('.headerLink[href^="#"]');

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            navLinks.forEach(function (link) {
              link.classList.toggle(
                'active',
                link.getAttribute('href') === '#' + entry.target.id
              );
            });
          }
        });
      }, { rootMargin: '-40% 0px -55% 0px', threshold: 0 });

      sections.forEach(function (sec) { observer.observe(sec); });
    }

    function initBannerHeroVideo() {
      var video = document.querySelector('video.bannerPropertyImage');
      if (!video) return;
      function play() {
        video.play().catch(function () {});
      }
      if (document.readyState === 'complete') play();
      else window.addEventListener('load', play, { once: true });
    }

    /* ---- Init all ---- */
    document.addEventListener('DOMContentLoaded', function () {
      initBurgerMenu();
      initBannerCarousel();
      initBannerHeroVideo();

      makeCarousel({
        trackId:          'amenitiesTrack',
        prevId:           'amenitiesPrev',
        nextId:           'amenitiesNext',
        indicatorsId:     'amenitiesIndicators',
        getSlidesPerView:  spvAmenities,
        autoplayMs:       4000
      });

      makeCarousel({
        trackId:          'galleryTrack',
        prevId:           'galleryPrev',
        nextId:           'galleryNext',
        indicatorsId:     'galleryIndicators',
        getSlidesPerView:  spvGallery,
        autoplayMs:       4000
      });

      initFloorPlanCarousel();

      makeStoryViewer({
        viewerId:               'amenitiesStoryViewer',
        progressId:             'amenitiesStoryProgress',
        imageId:                'amenitiesStoryImage',
        captionId:              'amenitiesStoryCaption',
        frameId:                'amenitiesStoryFrame',
        closeId:                'amenitiesStoryClose',
        imageContainerSelector: '.amenitiesImageContainer',
        slides:                 document.querySelectorAll('#amenitiesTrack .amenitiesSlide')
      });

      makeStoryViewer({
        viewerId:               'galleryStoryViewer',
        progressId:             'galleryStoryProgress',
        imageId:                'galleryStoryImage',
        captionId:              'galleryStoryCaption',
        frameId:                'galleryStoryFrame',
        closeId:                'galleryStoryClose',
        imageContainerSelector: '.galleryImageContainer',
        slides:                 document.querySelectorAll('#galleryTrack .gallerySlide')
      });

      initReadMore();
      initCrmIntegration();
      initPopupTriggers();
      initAnchorScroll();
      initScrollSpy();
    });

  })();


  
document.addEventListener("DOMContentLoaded",()=>{
            document.querySelectorAll(".form-name").forEach(element =>{
                element.addEventListener("keydown",keyNameEventListener);
            })
        })
function keyNameEventListener(e) {
    if (!/^[A-Za-z ]$/.test(e.key) && e.key.length == 1 ){
        e.preventDefault();
    }
}

document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".form-number").forEach(element => {
        element.addEventListener("input", function () {
            this.value = this.value.replace(/\D/g, "");
        });
    });
});
