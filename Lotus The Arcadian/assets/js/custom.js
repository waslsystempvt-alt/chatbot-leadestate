/**
 * Custom Lead Submission & Form Handling for Lotus The Arcadian
 * Blox Marketing Leads integration ported from Adani Airica
 */

async function saveLead(name, email, countryCode, phone, trackingId, pref) {
    return handleLeadFormSubmit(null, { name, countryCode, phone, trackingId });
}

let isSubmitting = false;

async function handleLeadFormSubmit(e, manualData = null, explicitForm = null) {
    if (isSubmitting) {
        return false;
    }

    let form = explicitForm || null;
    let name = '';
    let phone = '';
    let countryCode = '+91';
    let btn = null;
    let consentCheck = null;

    if (!form && e && e.target) {
        form = e.target.tagName === 'FORM' ? e.target : e.target.closest('form, .quoteForm');
    }

    if (manualData) {
        name = manualData.name;
        phone = manualData.phone;
        countryCode = manualData.countryCode || '+91';
    }

    if (form) {
        btn = form.querySelector('button[type="submit"], .quoteSubmit, #submitBtn, #quotePopupSubmit');
        const nameInput = form.querySelector('.form-name, input[name="fname"], input[placeholder*="Name"], input[type="text"]');
        const phoneInput = form.querySelector('.form-number, input[name="number"], input[type="tel"]');
        const countrySelect = form.querySelector('.form-country, select[name="country_code"], select');
        consentCheck = form.querySelector('input[type="checkbox"]');

        if (!name && nameInput) name = nameInput.value;
        if (!phone && phoneInput) phone = phoneInput.value;
        if (countrySelect && countrySelect.value) countryCode = countrySelect.value;
    }

    name = String(name || '').trim();
    phone = String(phone || '').trim();

    // 1. Validation Logic
    if (!name || name.length < 3) {
        alert('Please enter your full name.');
        form?.querySelector('.form-name, input[placeholder*="Name"]')?.focus();
        return false;
    }

    // Indian Number Validation (+91)
    if (countryCode === '+91') {
        const cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.length !== 10 || /^[0-5]/.test(cleanPhone)) {
            alert('Invalid phone number. For Indian numbers, enter a valid 10-digit number starting with 6-9.');
            form?.querySelector('.form-number, input[type="tel"]')?.focus();
            return false;
        }
    } else if (!phone || !/^\d{7,14}$/.test(phone.replace(/\D/g, ''))) {
        alert('Please enter a valid mobile number.');
        form?.querySelector('.form-number, input[type="tel"]')?.focus();
        return false;
    }

    if (consentCheck && !consentCheck.checked) {
        alert('Please agree to the privacy policy to continue.');
        return false;
    }

    // Determine comment / CTA context
    let comment = 'Enquiry';
    if (form) {
        if (form.id === 'ModalFormSlug4') {
            comment = 'Hero Banner Form - Schedule Visit';
        } else if (form.id === 'ModalFormSlug2' || form.closest('#quotePopup')) {
            const popupTitle = document.getElementById('quoteTitle');
            const titleText = popupTitle ? popupTitle.textContent.trim() : 'Enquire Now';
            comment = `Popup Modal - ${titleText}`;
        } else {
            comment = form.dataset.trackingId || 'Enquiry Form';
        }
    }

    isSubmitting = true;

    // 2. UI Loading State
    let originalText = '';
    if (btn) {
        originalText = btn.innerHTML;
        btn.innerHTML = '<span style="display:flex;align-items:center;justify-content:center;gap:10px;"><svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" fill="none" class="spin"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" stroke-width="2" stroke-linecap="round"/></svg> Sending...</span>';
        btn.style.pointerEvents = 'none';
        btn.style.opacity = '0.8';
    }

    // Animation Styling
    if (!document.getElementById('form-spin-style')) {
        const style = document.createElement('style');
        style.id = 'form-spin-style';
        style.innerHTML = '@keyframes spin { 100% { transform: rotate(360deg); } } .spin { animation: spin 1s linear infinite; }';
        document.head.appendChild(style);
    }

    const cleanPhoneDigits = phone.replace(/\D/g, '');

    // 3. Submit to Blox Webhook
    try {
        if (typeof submitLeadToBlox === 'function') {
            await submitLeadToBlox({
                name: name,
                phone: phone,
                countryCode: countryCode,
                comment: comment
            });
        }

        // Store submitted info for Thank You page & GTM
        localStorage.setItem('submittedCountryCode', countryCode);
        localStorage.setItem('submittedPhone', cleanPhoneDigits);
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
            event: 'formSubmitted',
            phone_number: `${countryCode}${cleanPhoneDigits}`
        });

        // Redirect to Thank You page
        window.location.href = 'thankyou.html';
        return true;

    } catch (error) {
        console.error('Lead submission error:', error);
        isSubmitting = false;
        if (btn) {
            btn.innerHTML = originalText;
            btn.style.pointerEvents = 'auto';
            btn.style.opacity = '1';
        }
        alert('Submission failed. Please try again.');
        return false;
    }
}

function validateAndSubmit(formElement) {
    return handleLeadFormSubmit(null, null, formElement);
}

function setupToggleButton(e, t, n) {
    let o = document.getElementById(e);
    o && o.addEventListener('click', function () {
        toggleVisibility(t, 'block'), toggleVisibility(n, 'none');
    });
}

function toggleVisibility(e, t) {
    document.querySelectorAll(`.${e}`).forEach(el => {
        el.style.display = t;
    });
}

document.addEventListener('DOMContentLoaded', function () {
    if (typeof apiDataGet === 'function') {
        apiDataGet(typeof projectId !== 'undefined' ? projectId : 14419);
    }

    // Attach listeners to all forms (guaranteeing each form is bound exactly once)
    document.querySelectorAll('form').forEach(form => {
        if (form.dataset.submitBound === 'true') return;
        form.dataset.submitBound = 'true';
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            handleLeadFormSubmit(e);
        });
    });

    setupToggleButton('dropbtn', 'showdrop', 'hidedrop');
    setupToggleButton('mbutton', 'mfieldshow', 'mfieldhide');
    setupToggleButton('popbutton', 'popfieldshow', 'popfieldhide');

    // Lazy load videos observer
    var lazyVideos = document.querySelectorAll("video.lazyVideo");
    if (lazyVideos.length) {
        if (!("IntersectionObserver" in window)) {
            lazyVideos.forEach(function (v) {
                var src = v.dataset.src;
                if (src) { v.src = src; v.setAttribute("autoplay", ""); v.load(); }
            });
        } else {
            var videoObserver = new IntersectionObserver(function (entries, observer) {
                entries.forEach(function (entry) {
                    if (!entry.isIntersecting) return;
                    var video = entry.target;
                    var src = video.dataset.src;
                    if (src) {
                        video.src = src;
                        video.removeAttribute("data-src");
                        video.load();
                        video.play().catch(function () {});
                    }
                    observer.unobserve(video);
                });
            }, { rootMargin: "200px 0px" });
            lazyVideos.forEach(function (v) { videoObserver.observe(v) });
        }
    }
});

window.saveLead = saveLead;
window.handleLeadFormSubmit = handleLeadFormSubmit;
window.validateAndSubmit = validateAndSubmit;