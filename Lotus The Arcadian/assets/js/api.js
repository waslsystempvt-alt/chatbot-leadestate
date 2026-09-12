/**
 * Blox Marketing Leads API Integration for Lotus The Arcadian
 * Ported from Adani Airica
 */

const MARKETING_LEADS_WEBHOOK_URL = 'https://admin.blox.xyz/ba/webhooks/marketingleads';
const BLOX_BEARER_TOKEN = '40|RVDStNmH4O7A2BIpGGeasavhv9EttSdrQZvOjhMD';
const BLOX_PROJECT_ID = 14419;
const BLOX_PROJECT_NAME = 'Lotus The Arcadian';
const WHATSAPP_PHONE = '919262104496';

let RegNo = '', city = 'Mumbai', magnet_id = null, magnet_number = '', IVR_phone_no = '+919262104496', whatsappNumber = WHATSAPP_PHONE, projectId = BLOX_PROJECT_ID, is_loan = 0, is_magnet = 0;

function getSourceAttribution() {
    const urlParams = new URLSearchParams(window.location.search);
    const utmSource = urlParams.get('utm_source');
    const utmMedium = urlParams.get('utm_medium');
    const referrer = document.referrer.toLowerCase();
    if (utmSource) return `${utmSource} / ${utmMedium || 'Ad'}`;
    if (referrer.includes('google')) return 'Google Organic Search';
    if (referrer.includes('facebook') || referrer.includes('fb')) return 'Facebook / Social';
    if (!referrer) return 'Direct / None';
    try {
        return `Referral: ${new URL(referrer).hostname}`;
    } catch (e) {
        return 'Referral';
    }
}

let isSubmittingBloxLead = false;

async function submitLeadToBlox({ name, phone, comment, countryCode = '+91' }) {
    if (isSubmittingBloxLead) {
        console.warn('[Blox] Lead submission already in progress. Ignoring duplicate call.');
        return Promise.resolve({ ok: true, status: 200 });
    }
    isSubmittingBloxLead = true;

    try {
        const urlParams = new URLSearchParams(window.location.search);
        const utmCampaign = urlParams.get('utm_campaign') || '';

        let cleanPhone = String(phone || '').trim();
        let finalContact = cleanPhone;
        if (countryCode && !cleanPhone.startsWith('+')) {
            const digits = cleanPhone.replace(/\D/g, '');
            if (digits.length === 10) {
                finalContact = `${countryCode}${digits}`;
            } else if (digits.length === 12 && digits.startsWith('91')) {
                finalContact = `+${digits}`;
            } else {
                finalContact = `${countryCode}${digits}`;
            }
        }

        const payload = {
            first_name: name || '',
            request_url: window.location.href || '',
            source: getSourceAttribution() || '',
            utm_campaign: utmCampaign || '',
            comment: comment || 'Enquiry',
            project: BLOX_PROJECT_ID || '',
            project_name: BLOX_PROJECT_NAME,
            ip: '',
            city: '',
            screen: `${window.screen.width || ''}x${window.screen.height || ''}`,
            contact: finalContact
        };

        const res = await fetch(MARKETING_LEADS_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${BLOX_BEARER_TOKEN}`
            },
            body: JSON.stringify(payload)
        });

        return res;
    } finally {
        setTimeout(() => {
            isSubmittingBloxLead = false;
        }, 3000);
    }
}

// Backward compatibility SendLead wrapper
async function SendLead(leadData, redirectUrl = 'thankyou.html') {
    try {
        const name = leadData.name || leadData.first_name || '';
        const phone = leadData.number || leadData.phone || leadData.contact || '';
        const countryCode = leadData.country_code || '+91';
        const comment = leadData.comment || (leadData.Digital && leadData.Digital.client_pref) || 'Enquiry';

        const res = await submitLeadToBlox({ name, phone, comment, countryCode });
        if (res.ok) {
            if (redirectUrl) {
                window.location.href = redirectUrl;
            }
            return 1;
        }
        throw new Error('Failed to send lead data to Blox');
    } catch (err) {
        console.error('Error sending lead data:', err);
        throw err;
    }
}

function updateContactElements(t, e, r) {
    const phoneNo = t || '+919262104496';
    const rawDigits = phoneNo.replace(/\D/g, '');
    const propertyName = r || BLOX_PROJECT_NAME;

    const a = document.getElementsByClassName('IVR_Phone_No_Text');
    for (let i = 0; i < a.length; i++) a[i].innerText = phoneNo.startsWith('+') ? phoneNo : '+' + phoneNo;

    const p = document.getElementsByClassName('phone_no');
    for (let i = 0; i < p.length; i++) p[i].innerText = phoneNo.startsWith('+') ? phoneNo : '+' + phoneNo;

    const n = document.getElementsByClassName('IVR_Phone_No_Url');
    for (let i = 0; i < n.length; i++) n[i].href = `tel:+${rawDigits}`;

    const pu = document.getElementsByClassName('phone_url');
    for (let i = 0; i < pu.length; i++) pu[i].href = `tel:+${rawDigits}`;

    const o = document.getElementsByClassName('whatsapp_url');
    for (let i = 0; i < o.length; i++) {
        o[i].href = `https://api.whatsapp.com/send?phone=${rawDigits}&text=I want to know more about ${encodeURIComponent(propertyName)}`;
    }
}

async function apiDataGet(t) {
    updateContactElements('+919262104496', '919262104496', BLOX_PROJECT_NAME);
}

function changeProjectId(t) {
    projectId = t;
}

async function getIpAddress() {
    try {
        const t = await fetch('https://api.ipify.org/?format=json', { mode: 'cors' });
        if (!t.ok) return '0.0.0.0';
        const e = await t.json();
        return e.ip || '0.0.0.0';
    } catch (t) {
        return '0.0.0.0';
    }
}

function deviceData() {
    return navigator.userAgent.match(/Android/i) || navigator.userAgent.match(/webOS/i) || navigator.userAgent.match(/iPhone/i) || navigator.userAgent.match(/Windows Phone/i) ? 'Mobile' : navigator.userAgent.match(/iPad/i) || navigator.userAgent.match(/iPod/i) ? 'Tablet' : navigator.userAgent.match(/BlackBerry/i) ? 'Blackberry' : 'Desktop';
}

function browserData() {
    let t;
    return -1 != (navigator.userAgent.indexOf('Opera') || navigator.userAgent.indexOf('OPR')) ? t = 'Opera' : 94 != navigator.userAgent.indexOf('Chrome') ? t = 'Chrome' : -1 != navigator.userAgent.indexOf('Mozilla') ? t = 'Mozilla' : -1 != navigator.userAgent.indexOf('Safari') ? t = 'Safari' : -1 != navigator.userAgent.indexOf('Firefox') ? t = 'Firefox' : (-1 != navigator.userAgent.indexOf('MSIE') || 1 == !document.documentMode) && (t = 'MSIE'), t;
}

function queryForm(t = null) {
    var e = {}, r = !!t && !!t.reset && t.reset, a = window.location.toString().split('?');
    if (a.length > 1) {
        var n = a[1].split('&');
        for (let t in n) {
            var o = n[t].split('=');
            (r || null === sessionStorage.getItem(o[0])) && sessionStorage.setItem(o[0], o[1]),
            'utm_source' == o[0] && (e.utmsource = o[1]),
            'utm_medium' == o[0] && (e.utmmedium = o[1]),
            'utm_campaign' == o[0] && (e.utmcampaign = o[1]),
            'utm_content' == o[0] && (e.utmcontent = o[1]),
            'utm_term' == o[0] && (e.utmterm = o[1]),
            'p_nationality' == o[0] && (e.param_nationality = o[1]),
            'p_regionid' == o[0] && (e.param_region_id = o[1]);
        }
        return e;
    }
    return null;
}

// Auto-initialize contact elements on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        apiDataGet(BLOX_PROJECT_ID);
    });
} else {
    apiDataGet(BLOX_PROJECT_ID);
}

// Make available globally
window.submitLeadToBlox = submitLeadToBlox;
window.getSourceAttribution = getSourceAttribution;
window.SendLead = SendLead;
window.updateContactElements = updateContactElements;
window.apiDataGet = apiDataGet;
