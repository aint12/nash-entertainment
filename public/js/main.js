// Loading screen
(function () {
    var loader = document.getElementById('loader');
    window.addEventListener('load', function () {
        setTimeout(function () {
            loader.classList.add('hidden');
        }, 2000);
    });
    setTimeout(function () {
        loader.classList.add('hidden');
    }, 4000);
})();

// Scroll reveal
(function () {
    var reveals = document.querySelectorAll('.reveal');
    if (!reveals.length) return;
    var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: 0.15 });
    reveals.forEach(function (el) { observer.observe(el); });
})();

// Showreel crossfade
(function () {
    var slides = document.querySelectorAll('.reel-slide');
    if (slides.length === 0) return;
    var current = 0;
    slides[0].classList.add('active');

    // Auto-play videos when they become active
    function activateSlide(index) {
        slides[current].classList.remove('active');
        var oldVideo = slides[current].querySelector('video');
        if (oldVideo) { oldVideo.pause(); oldVideo.currentTime = 0; }

        current = index % slides.length;
        slides[current].classList.add('active');
        var newVideo = slides[current].querySelector('video');
        if (newVideo) { newVideo.currentTime = 0; newVideo.play(); }
    }

    setInterval(function () {
        activateSlide(current + 1);
    }, 4000);
})();

document.querySelector('.mobile-menu').addEventListener('click', function () {
    document.querySelector('.nav-links').classList.toggle('active');
});

document.querySelectorAll('.nav-links a').forEach(function (link) {
    link.addEventListener('click', function () {
        document.querySelector('.nav-links').classList.remove('active');
    });
});

// Work section: slow-mo by default, real-time + sound on hover
(function () {
    var globalMuted = true;
    var muteBtn = document.getElementById('muteBtn');
    var muteIcon = document.getElementById('muteIcon');
    var muteLabel = document.getElementById('muteLabel');
    var cards = document.querySelectorAll('.work-card');

    if (muteBtn) {
        muteBtn.addEventListener('click', function () {
            globalMuted = !globalMuted;
            muteBtn.classList.toggle('unmuted', !globalMuted);
            muteIcon.innerHTML = globalMuted ? '&#128264;' : '&#128266;';
            muteLabel.textContent = globalMuted ? 'Sound Off' : 'Sound On';
            cards.forEach(function (card) {
                var video = card.querySelector('video');
                if (video) { video.muted = true; video.volume = 0; }
            });
        });
    }

    var isMobile = window.matchMedia('(max-width: 768px)').matches;

    cards.forEach(function (card) {
        var video = card.querySelector('video');
        if (!video) return;
        var src = video.getAttribute('src');
        if (!src || src === '') return;

        if (isMobile) return;

        video.addEventListener('loadeddata', function () {
            video.classList.add('loaded');
            video.playbackRate = 0.4;
            video.muted = true;
            video.volume = 0;
            video.play().catch(function () {});
        });

        video.addEventListener('error', function () {
            console.warn('Video failed to load: ' + src + ' — try converting to .mp4 for cross-browser support.');
        });

        video.load();

        card.addEventListener('mouseenter', function () {
            video.playbackRate = 1.0;
            video.muted = globalMuted;
            video.volume = globalMuted ? 0 : 1;
        });

        card.addEventListener('mouseleave', function () {
            video.playbackRate = 0.4;
            video.muted = true;
            video.volume = 0;
        });
    });
})();

// Lightbox player
(function () {
    var lightbox = document.getElementById('lightbox');
    var lbVideo = document.getElementById('lightboxVideo');
    var lbClose = document.getElementById('lightboxClose');

    document.querySelectorAll('.work-card').forEach(function (card) {
        card.addEventListener('click', function () {
            var video = card.querySelector('video');
            if (!video) return;
            var src = video.getAttribute('src');
            if (!src || src === '') return;

            video.pause();
            lbVideo.src = src;
            lbVideo.currentTime = 0;
            lbVideo.muted = false;
            lightbox.classList.add('active');
            lbVideo.play().catch(function () {});
        });
    });

    function closeLightbox() {
        lightbox.classList.remove('active');
        lbVideo.pause();
        lbVideo.removeAttribute('src');
        document.querySelectorAll('.work-card video').forEach(function (v) {
            v.playbackRate = 0.4;
            v.muted = true;
            v.play().catch(function () {});
        });
    }

    lbClose.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', function (e) {
        if (e.target === lightbox) closeLightbox();
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && lightbox.classList.contains('active')) closeLightbox();
    });
})();

// Package select buttons -> scroll to form with package pre-selected
document.querySelectorAll('[data-package]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
        e.preventDefault();
        var pkg = this.dataset.package;
        var select = document.getElementById('service');
        for (var i = 0; i < select.options.length; i++) {
            if (select.options[i].value === pkg) {
                select.selectedIndex = i;
                select.dispatchEvent(new Event('change'));
                break;
            }
        }
        document.getElementById('quote').scrollIntoView({ behavior: 'smooth' });
    });
});

// Show/hide player intake fields based on service selection
var serviceSelect = document.getElementById('service');
var playerFields = document.getElementById('playerFields');
var playerPackages = ['spotlight', 'two-game', 'recruiting'];

serviceSelect.addEventListener('change', function () {
    var isPlayer = playerPackages.indexOf(this.value) !== -1;
    playerFields.style.display = isPlayer ? 'block' : 'none';
});

document.getElementById('quoteForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var form = this;
    var name = document.getElementById('name').value;
    var email = document.getElementById('email').value;
    var phone = document.getElementById('phone').value;
    var service = document.getElementById('service').value;
    var budget = document.getElementById('budget').value;
    var details = document.getElementById('details').value;

    var subject = 'Quote Request from ' + name;
    var body = 'Name: ' + name + '\n'
        + 'Email: ' + email + '\n'
        + 'Phone: ' + (phone || 'N/A') + '\n'
        + 'Service: ' + service + '\n'
        + 'Budget: ' + (budget || 'N/A') + '\n';

    if (playerPackages.indexOf(service) !== -1) {
        body += '\n--- PLAYER INFO ---\n'
            + 'Player: ' + (document.getElementById('playerName').value || 'N/A') + '\n'
            + 'Jersey #: ' + (document.getElementById('jerseyNumber').value || 'N/A') + '\n'
            + 'Position: ' + (document.getElementById('position').value || 'N/A') + '\n'
            + 'School: ' + (document.getElementById('school').value || 'N/A') + '\n'
            + 'Class Year: ' + (document.getElementById('classYear').value || 'N/A') + '\n'
            + 'Height/Weight: ' + (document.getElementById('heightWeight').value || 'N/A') + '\n'
            + 'GPA: ' + (document.getElementById('gpa').value || 'N/A') + '\n'
            + 'Focus Areas: ' + (document.getElementById('highlights').value || 'N/A') + '\n';
    }

    body += '\nProject Details:\n' + details;

    window.location.href = 'mailto:info@nashentertainment.com?subject='
        + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);

    form.reset();
    document.getElementById('formSuccess').style.display = 'block';
    setTimeout(function () {
        document.getElementById('formSuccess').style.display = 'none';
    }, 5000);
});
