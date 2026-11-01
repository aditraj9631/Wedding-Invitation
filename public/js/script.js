(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var portraitMQ = window.matchMedia('(orientation: portrait)');

  // ---------- Background music (one <audio>, rendered only if the file exists) ----------
  var bgm = document.getElementById('bgm');
  var music = {
    userPaused: false,   // visitor pressed pause
    userMuted: false,    // visitor pressed mute
    videoHold: false,    // opening video is playing with its own sound; the song waits
    gestureArmed: false
  };
  var musicWrap = document.getElementById('music');
  var musicToggle = document.getElementById('musicToggle');
  var musicMute = document.getElementById('musicMute');

  function updateMusicUI() {
    if (!bgm || !musicWrap) return;
    var playing = !bgm.paused;
    musicWrap.classList.toggle('is-playing', playing);
    musicToggle.setAttribute('aria-pressed', String(playing));
    musicToggle.setAttribute('aria-label', playing ? 'Pause background music' : 'Play background music');
    musicMute.setAttribute('aria-pressed', String(music.userMuted));
    musicMute.setAttribute('aria-label', music.userMuted ? 'Unmute background music' : 'Mute background music');
    musicMute.classList.toggle('is-muted', music.userMuted);
  }

  // Single place that decides whether the song should be playing right now.
  function applyMusic() {
    if (!bgm) return;
    bgm.muted = music.userMuted;
    if (music.userPaused || music.videoHold) {
      if (!bgm.paused) bgm.pause();
      updateMusicUI();
      return;
    }
    if (bgm.paused) {
      var p = bgm.play();
      if (p && typeof p.catch === 'function') p.catch(armGesture); // autoplay blocked
    }
  }

  // Browsers block audible autoplay: retry on the first click/key press instead.
  function armGesture() {
    if (music.gestureArmed) return;
    music.gestureArmed = true;
    var handler = function () {
      document.removeEventListener('click', handler);
      document.removeEventListener('keydown', handler);
      music.gestureArmed = false;
      if (music.userPaused) return;
      if (music.videoHold) unlockAudio(); else applyMusic();
    };
    document.addEventListener('click', handler);
    document.addEventListener('keydown', handler);
  }

  // The first tap also starts the video. Briefly "unlock" the song silently so it can
  // resume by itself (for example on iOS) once the video has finished.
  function unlockAudio() {
    var p;
    bgm.muted = true;
    p = bgm.play();
    var restore = function () { bgm.muted = music.userMuted; };
    if (p && typeof p.then === 'function') {
      p.then(function () { if (music.videoHold || music.userPaused) bgm.pause(); restore(); updateMusicUI(); }, restore);
    } else { restore(); }
  }

  if (bgm) {
    bgm.addEventListener('play', updateMusicUI);
    bgm.addEventListener('pause', updateMusicUI);
    bgm.addEventListener('error', function () { if (musicWrap) musicWrap.hidden = true; });

    musicToggle.addEventListener('click', function () {
      if (bgm.paused) { music.userPaused = false; } else { music.userPaused = true; }
      applyMusic();
    });
    musicMute.addEventListener('click', function () {
      music.userMuted = !music.userMuted;
      bgm.muted = music.userMuted;
      updateMusicUI();
    });

    updateMusicUI();
    applyMusic(); // attempt autoplay on load
  }

  // ---------- Opening sequence ----------
  var stage = document.getElementById('stage');
  var gateBtn = document.getElementById('gateBtn');
  var video = document.getElementById('invVideo');
  var videoWrap = document.getElementById('videoWrap');
  var finalWrap = document.getElementById('finalWrap');
  var soundBtn = document.getElementById('soundBtn');
  var skipBtn = document.getElementById('skipBtn');
  var retryBtn = document.getElementById('retryBtn');
  var errSkipBtn = document.getElementById('errSkipBtn');
  var replayBtn = document.getElementById('replayBtn');
  var errorBox = document.getElementById('videoError');

  var started = false;      // guards against repeated clicks restarting the video
  var sources = [];         // candidate video files, best match first
  var srcIndex = 0;

  function setState(state) {
    stage.setAttribute('data-state', state);
    videoWrap.setAttribute('aria-hidden', state === 'video' ? 'false' : 'true');
    finalWrap.setAttribute('aria-hidden', state === 'final' ? 'false' : 'true');
    gateBtn.tabIndex = state === 'gate' ? 0 : -1;
  }

  function updateSoundBtn() {
    soundBtn.textContent = video.muted ? 'Sound off' : 'Sound on';
    soundBtn.setAttribute('aria-pressed', String(!video.muted));
  }

  // The song waits only while the video is actually playing with sound.
  function syncMusicHold() {
    music.videoHold = !video.paused && !video.muted && !video.ended;
    applyMusic();
  }

  function showError() {
    music.videoHold = false;
    applyMusic();
    errorBox.hidden = false;
    retryBtn.focus();
  }

  // Portrait screens prefer the mobile file; landscape prefers desktop. The other is a fallback.
  function chooseSources() {
    var d = video.getAttribute('data-src-desktop');
    var m = video.getAttribute('data-src-mobile');
    var list = (portraitMQ.matches && m) ? [m, d] : [d, m];
    return list.filter(function (s, i) { return s && list.indexOf(s) === i; });
  }

  function loadCurrentSource() {
    video.src = sources[srcIndex];
    video.load();
  }

  function play() {
    errorBox.hidden = true;
    var p = video.play();
    if (p && typeof p.catch === 'function') {
      p.catch(function (err) {
        if (err && err.name === 'AbortError') return; // a source swap interrupted it; the new load plays instead
        // Autoplay with sound refused: retry muted, visitor can unmute via the button.
        if (!video.muted) {
          video.muted = true;
          updateSoundBtn();
          syncMusicHold();
          var p2 = video.play();
          if (p2 && typeof p2.catch === 'function') p2.catch(showError);
        } else {
          showError();
        }
      });
    }
  }

  function startVideo() {
    if (started) return;
    started = true;
    setState('video');
    if (!video.getAttribute('src')) {            // choose once; orientation changes never restart playback
      sources = chooseSources();
      srcIndex = 0;
      var poster = (portraitMQ.matches && video.getAttribute('data-poster-mobile')) || video.getAttribute('data-poster-desktop');
      if (poster) video.poster = poster;
      loadCurrentSource();
    }
    video.muted = false;                          // the click is a user gesture, so try with sound first
    music.videoHold = true;                       // keep the song quiet while the video's own audio plays
    applyMusic();
    updateSoundBtn();
    play();
  }

  function showFinal() {
    try { video.pause(); } catch (e) {}
    music.videoHold = false;
    applyMusic();
    setState('final');
    started = false; // allow replay
    replayBtn.focus({ preventScroll: true });
  }

  gateBtn.addEventListener('click', startVideo);

  video.addEventListener('ended', showFinal);          // only advance when playback truly ends
  video.addEventListener('error', function () {
    if (video.getAttribute('src') && srcIndex + 1 < sources.length) {   // try the other asset before giving up
      srcIndex += 1;
      loadCurrentSource();
      play();
    } else {
      showError();
    }
  });
  ['playing', 'pause', 'volumechange'].forEach(function (evt) { video.addEventListener(evt, syncMusicHold); });

  soundBtn.addEventListener('click', function () {
    video.muted = !video.muted;
    updateSoundBtn();
  });
  skipBtn.addEventListener('click', showFinal);
  errSkipBtn.addEventListener('click', showFinal);
  retryBtn.addEventListener('click', function () {
    errorBox.hidden = true;
    sources = chooseSources();
    srcIndex = 0;
    loadCurrentSource();
    video.muted = true; updateSoundBtn();
    play();
  });
  replayBtn.addEventListener('click', function () {
    started = true;
    video.currentTime = 0;
    setState('video');
    video.muted = false; updateSoundBtn();
    music.videoHold = true; applyMusic();
    play();
  });

  setState('gate');

  // ---------- Scroll reveal (single animation system for every section) ----------
  var revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var el = entry.target;
          el.classList.add('is-visible');
          // drop the stagger delay afterwards so hover effects respond immediately
          el.addEventListener('transitionend', function clear(e) {
            if (e.propertyName !== 'transform') return;
            el.style.transitionDelay = '';
            el.removeEventListener('transitionend', clear);
          });
          io.unobserve(el);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });

    document.querySelectorAll('.reveal-group').forEach(function (group) {
      group.querySelectorAll('.reveal').forEach(function (el, i) {
        el.style.transitionDelay = Math.min(i * 0.14, 0.7) + 's';
      });
    });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('is-visible'); });
  }

  // ---------- Gold particles ----------
  if (!reduceMotion) {
    document.querySelectorAll('.particles').forEach(function (box) {
      for (var i = 0; i < 22; i++) {
        var s = document.createElement('span');
        var size = 3 + Math.random() * 6;
        s.style.width = s.style.height = size + 'px';
        s.style.left = Math.random() * 100 + '%';
        s.style.animationDuration = 9 + Math.random() * 12 + 's';
        s.style.animationDelay = -Math.random() * 20 + 's';
        box.appendChild(s);
      }
    });
  }

  // ---------- Heart scratch card (replaces the old countdown) ----------
  (function initScratchCard() {
    var heart = document.getElementById('heart');
    var canvas = document.getElementById('scratchCanvas');
    var revealBtn = document.getElementById('revealBtn');
    var hint = document.getElementById('scratchHint');
    var dateEl = document.getElementById('heartDate');
    var live = document.getElementById('dateLive');
    if (!heart || !canvas || !dateEl) return;

    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    var heartPath = (typeof Path2D === 'function') ? new Path2D(canvas.getAttribute('data-path')) : null;
    var w = 0, h = 0, dpr = 1;
    var revealed = false, drawing = false, scratched = false;
    var last = null, baseline = 1, lastCheck = 0;

    function paintFoil() {
      var rect = heart.getBoundingClientRect();
      var nw = Math.round(rect.width), nh = Math.round(rect.height);
      if (!nw || !nh) return;
      w = nw; h = nh;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, w, h);

      ctx.save();
      if (heartPath) { ctx.scale(w, h); ctx.clip(heartPath); ctx.scale(1 / w, 1 / h); }

      var g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#a9802f');
      g.addColorStop(0.28, '#f0d58c');
      g.addColorStop(0.5, '#d9b45b');
      g.addColorStop(0.72, '#f6e3a8');
      g.addColorStop(1, '#a9802f');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // fine foil grain
      for (var i = 0; i < 700; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,.16)' : 'rgba(90,50,10,.12)';
        ctx.fillRect(Math.random() * w, Math.random() * h, 1.4, 1.4);
      }
      // diagonal sheen
      var sheen = ctx.createLinearGradient(w * 0.1, 0, w * 0.5, h);
      sheen.addColorStop(0, 'rgba(255,255,255,0)');
      sheen.addColorStop(0.5, 'rgba(255,255,255,.22)');
      sheen.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sheen;
      ctx.fillRect(0, 0, w, h);

      // message
      ctx.fillStyle = '#4a0f1c';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(255,240,190,.7)';
      ctx.shadowBlur = 2;
      ctx.font = '500 ' + Math.round(w * 0.062) + 'px Cinzel, Georgia, serif';
      ctx.fillText('SCRATCH TO', w / 2, h * 0.34);
      ctx.fillText('REVEAL OUR', w / 2, h * 0.34 + w * 0.085);
      ctx.fillText('WEDDING DATE', w / 2, h * 0.34 + w * 0.17);
      ctx.font = Math.round(w * 0.07) + 'px Georgia, serif';
      ctx.fillText('✦', w / 2, h * 0.34 + w * 0.27);
      ctx.restore();

      baseline = Math.max(1, coverage());
    }

    // number of still-opaque sample points (sampled every 6th device pixel)
    function coverage() {
      try {
        var d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        var c = 0, W = canvas.width, H = canvas.height;
        for (var y = 0; y < H; y += 6) {
          for (var x = 0; x < W; x += 6) { if (d[(y * W + x) * 4 + 3] > 128) c++; }
        }
        return c;
      } catch (e) { return baseline; }
    }

    function pos(e) {
      var r = canvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) * (w / r.width), y: (e.clientY - r.top) * (h / r.height) };
    }

    function scratchTo(p) {
      var r = Math.max(14, w * 0.065);
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.lineWidth = r * 2;
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(p.x + 0.01, p.y + 0.01);
      ctx.stroke();
      last = p;
      scratched = true;
    }

    function maybeAutoReveal(force) {
      var now = Date.now();
      if (!force && now - lastCheck < 220) return;
      lastCheck = now;
      if (1 - coverage() / baseline >= 0.5) reveal();
    }

    function reveal() {
      if (revealed) return;
      revealed = true;
      drawing = false;
      heart.classList.add('is-revealed');
      dateEl.setAttribute('aria-hidden', 'false');
      if (revealBtn) revealBtn.hidden = true;
      if (hint) hint.hidden = true;
      if (live) live.textContent = 'Wedding date revealed: ' + dateEl.textContent.replace(/\s+/g, ' ').trim();
      var done = function () { canvas.style.display = 'none'; };
      if (reduceMotion) { done(); } else { setTimeout(done, 1300); }
      dateEl.focus({ preventScroll: true });
    }

    canvas.addEventListener('pointerdown', function (e) {
      if (revealed) return;
      drawing = true;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
      last = pos(e);
      scratchTo(last);
      e.preventDefault();
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!drawing || revealed) return;
      scratchTo(pos(e));
      maybeAutoReveal(false);
    });
    function stop() { if (drawing) { drawing = false; maybeAutoReveal(true); } }
    canvas.addEventListener('pointerup', stop);
    canvas.addEventListener('pointercancel', stop);
    canvas.addEventListener('lostpointercapture', stop);

    if (revealBtn) revealBtn.addEventListener('click', reveal);

    paintFoil();
    // Re-draw if the card changes width (rotation / resize) before anyone has scratched it
    if ('ResizeObserver' in window) {
      new ResizeObserver(function () {
        if (revealed || scratched) return;
        var r = heart.getBoundingClientRect();
        if (Math.abs(Math.round(r.width) - w) > 2) paintFoil();
      }).observe(heart);
    }
    // Re-draw once the display font has loaded so the message uses it
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { if (!revealed && !scratched) paintFoil(); });
    }
  })();

  // ---------- Gallery lightbox ----------
  (function initLightbox() {
    var dlg = document.getElementById('lightbox');
    var triggers = Array.prototype.slice.call(document.querySelectorAll('[data-lightbox]'));
    if (!dlg || !triggers.length) return;
    var img = document.getElementById('lbImg');
    var cap = document.getElementById('lbCap');
    var prev = document.getElementById('lbPrev');
    var next = document.getElementById('lbNext');
    var closeBtn = document.getElementById('lbClose');
    var index = 0, opener = null;

    function show(i) {
      index = (i + triggers.length) % triggers.length;
      var t = triggers[index];
      img.src = t.getAttribute('data-full');
      img.alt = t.getAttribute('data-alt') || '';
      cap.textContent = t.getAttribute('data-caption') || '';
      cap.hidden = !cap.textContent;
      var single = triggers.length < 2;
      prev.hidden = next.hidden = single;
    }
    function open(i) {
      opener = triggers[i];
      show(i);
      if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
      closeBtn.focus();
    }
    function close() {
      if (typeof dlg.close === 'function') dlg.close(); else dlg.removeAttribute('open');
    }

    triggers.forEach(function (t, i) { t.addEventListener('click', function () { open(i); }); });
    prev.addEventListener('click', function () { show(index - 1); });
    next.addEventListener('click', function () { show(index + 1); });
    closeBtn.addEventListener('click', close);
    dlg.addEventListener('click', function (e) { if (e.target === dlg) close(); });   // click on the backdrop
    dlg.addEventListener('close', function () { if (opener) opener.focus({ preventScroll: true }); });
    dlg.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') show(index - 1);
      else if (e.key === 'ArrowRight') show(index + 1);
    });
  })();

  // ---------- RSVP thank-you ----------
  if (/[?&]rsvp=thanks/.test(location.search)) {
    var t = document.getElementById('rsvpThanks');
    if (t) t.hidden = false;
  }
})();
