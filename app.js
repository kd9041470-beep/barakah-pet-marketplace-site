/**
 * Barakah App - Food map support
 * Features: Public Supabase marketplace, Leaflet Maps, WhatsApp
 */

// ==========================================
// 1. SUPABASE CONFIG
// ==========================================
const SUPABASE_URL = window.BARAKAH_SUPABASE_CONFIG?.url?.trim() || "https://ppuknuxgbdgufcbstiqq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwdWtudXhnYmRndWZjYnN0aXFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5ODY0NDUsImV4cCI6MjA3NTU2MjQ0NX0.9SD1v8S2klIAPFpNdMXTShxvQpcfcouE4iEK1O-olIY";
const supabaseConfig = window.BARAKAH_SUPABASE_CONFIG;
const db = window.supabase?.createClient && SUPABASE_URL && (supabaseConfig?.anonKey?.trim() || SUPABASE_ANON_KEY)
    ? window.supabase.createClient(SUPABASE_URL, supabaseConfig?.anonKey?.trim() || SUPABASE_ANON_KEY)
    : null;
window.BARAKAH_SUPABASE_CLIENT = db;

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function inlineJsArg(value) {
    return JSON.stringify(String(value)).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/"/g, '&quot;');
}

function whatsappPhone(value) {
    let digits = String(value || '').replace(/\D/g, '');
    if (String(value || '').trim().startsWith('00')) digits = String(value).trim().slice(2).replace(/\D/g, '');
    return digits;
}

// ==========================================
// 2. STATE
// ==========================================
let currentProfile = null;
let map = null;
let markers = {};
let activeSignals = [];
let ownedSignals = [];
let acceptedSignals = [];
let routingControl = null;
let userLatLng = null; // current user's GPS position
let userLocationMarker = null;

// DOM refs
const donorPanel     = document.getElementById('donorPanel');
const tasksPanel     = document.getElementById('tasksPanel');
const tasksList      = document.getElementById('tasksList');
const donorSignalsList = document.getElementById('donorSignalsList');
const acceptedSignalsList = document.getElementById('acceptedSignalsList');
const statActive     = document.getElementById('statActiveSignals');
const btnGetLocation = document.getElementById('btnGetLocation');

// ==========================================
// 5. MAP (Leaflet)
// ==========================================
function initMap() {
    const mapElement = document.getElementById('realMap');
    if (!mapElement) return;
    if (!window.L || typeof window.L.map !== 'function') {
        showMapFallback('تعذر تحميل مكتبة الخريطة. يمكنك استخدام خرائط Google مؤقتًا.');
        return;
    }
    if (map) {
        requestAnimationFrame(() => map.invalidateSize({ pan: false }));
        return;
    }

    try {
        map = L.map(mapElement, { zoomControl: true, scrollWheelZoom: false, preferCanvas: true })
            .setView([24.7136, 46.6753], 12);

        let tileErrors = 0;
        const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>',
            updateWhenIdle: true,
            keepBuffer: 2
        });
        tiles.on('tileerror', () => {
            tileErrors++;
            if (tileErrors >= 3) showMapFallback('تعذر الوصول إلى خريطة الطرق. افتح الموقع على خرائط Google.');
        });
        tiles.on('tileload', () => {
            tileErrors = 0;
            hideMapFallback();
        });
        tiles.addTo(map);
        L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);

        map.whenReady(() => {
            requestAnimationFrame(() => map && map.invalidateSize({ pan: false }));
            setTimeout(() => map && map.invalidateSize({ pan: false }), 180);
        });
        window.addEventListener('resize', () => map && map.invalidateSize({ pan: false }), { passive: true });
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && map) setTimeout(() => map.invalidateSize({ pan: false }), 100);
        });
    } catch (error) {
        console.error('Map initialization failed:', error);
        if (map) map.remove();
        map = null;
        showMapFallback('تعذر تهيئة الخريطة. افتح الموقع على خرائط Google.');
    }
}

function googleMapsDirectionsUrl(lat, lng) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lng}`)}`;
}

function showMapFallback(message, lat = 24.7136, lng = 46.6753) {
    const fallback = document.getElementById('mapFallback');
    const messageEl = document.getElementById('mapFallbackMessage');
    const link = document.getElementById('mapFallbackLink');
    if (!fallback) return;
    if (messageEl) messageEl.textContent = message;
    if (link) link.href = googleMapsDirectionsUrl(lat, lng);
    fallback.hidden = false;
}

function hideMapFallback() {
    const fallback = document.getElementById('mapFallback');
    if (fallback) fallback.hidden = true;
}

const retryMapButton = document.getElementById('retryMapButton');
if (retryMapButton) {
    retryMapButton.addEventListener('click', () => {
        if (map) map.remove();
        map = null;
        markers = {};
        routingControl = null;
        userLocationMarker = null;
        initMap();
        updateMapMarkers();
    });
}

// If a CDN fallback finishes after the saved session starts, initialize the map then.
window.addEventListener('load', () => {
    if (currentProfile && !map && window.L) initMap();
}, { once: true });

function makeIcon(color, icon) {
    if (!window.L || typeof window.L.divIcon !== 'function') return null;
    return L.divIcon({
        className: '',
        html: `<div style="background:${color};width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(0,0,0,0.25);border:3px solid white;">
                 <i class="fa-solid ${icon}" style="color:white;font-size:15px;"></i>
               </div>`,
        iconSize: [38, 38], iconAnchor: [19, 19], popupAnchor: [0, -22]
    });
}

const ICONS = {
    donor:   makeIcon('#10b981', 'fa-shop'),
    breeder: makeIcon('#8b5cf6', 'fa-paw'),
};

// ==========================================
// 6. ROUTING — Draw path on map
// ==========================================
function routeTo(destLat, destLng, donorPhone, donorName) {
    const lat = Number(destLat);
    const lng = Number(destLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        showToast('موقع التبرع غير متاح على الخريطة.', 'warning');
        return;
    }
    const externalRoute = googleMapsDirectionsUrl(lat, lng);
    if (!map || !window.L) {
        window.open(externalRoute, '_blank', 'noopener,noreferrer');
        showToast('تم فتح المسار في خرائط Google.', 'info');
        return;
    }

    // Remove previous route
    if (routingControl) {
        map.removeControl(routingControl);
        routingControl = null;
    }

    const dest = L.latLng(lat, lng);

    if (userLatLng && L.Routing && typeof L.Routing.control === 'function') {
        // Draw route from user to donor
        routingControl = L.Routing.control({
            waypoints: [userLatLng, dest],
            routeWhileDragging: false,
            addWaypoints: false,
            show: false,        // hide turn-by-turn panel (only show line on map)
            lineOptions: {
                styles: [{ color: '#10b981', weight: 5, opacity: 0.85 }]
            },
            createMarker: () => null // don't add extra markers
        });
        routingControl.on('routingerror', () => {
            showMapFallback('تعذر حساب المسار داخل التطبيق. افتحه في خرائط Google.', lat, lng);
            showToast('تعذر رسم المسار؛ يمكنك فتحه في خرائط Google.', 'warning');
        });
        routingControl.addTo(map);

        map.flyTo(dest, 14, { animate: true, duration: 1.2 });
        showToast('📍 تم رسم المسار على الخريطة!', 'info');
    } else {
        // No location permission or routing service — open Google Maps instead.
        window.open(externalRoute, '_blank', 'noopener,noreferrer');
        showToast('تم فتح المسار في خرائط Google', 'info');
    }
}

// ==========================================
// 7. GEOLOCATION BUTTON (Donor)
// ==========================================
if (btnGetLocation) {
    btnGetLocation.addEventListener('click', () => {
        if (!navigator.geolocation) { showToast('المتصفح لا يدعم GPS', 'error'); return; }
        btnGetLocation.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري التحديد...';
        btnGetLocation.disabled = true;
        navigator.geolocation.getCurrentPosition((pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            document.getElementById('signalLat').value = lat;
            document.getElementById('signalLng').value = lng;
            document.getElementById('locationStatus').style.display = 'block';
            userLatLng = window.L ? L.latLng(lat, lng) : { lat, lng };
            btnGetLocation.innerHTML = '<i class="fa-solid fa-check"></i> تم تحديد الموقع';
            btnGetLocation.disabled = false;
            if (map) {
                map.setView([lat, lng], 15);
                if (userLocationMarker) map.removeLayer(userLocationMarker);
                userLocationMarker = L.circleMarker([lat, lng], {
                    radius: 9, color: '#fff', weight: 3, fillColor: '#4285f4', fillOpacity: 1
                }).addTo(map).bindPopup('<b>موقعك الحالي</b>');
            }
        }, () => {
            showToast('فشل تحديد الموقع. تأكد من تفعيل GPS.', 'error');
            btnGetLocation.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i> تحديد موقعي';
            btnGetLocation.disabled = false;
        }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
    });
}

// ==========================================
// 8. SIGNAL FORM (Donor sends donation)
// ==========================================
const signalForm = document.getElementById('signalForm');
if (signalForm) {
    signalForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btnSendSignal');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري الإرسال...';

        try {
            const title     = document.getElementById('signalTitle').value.trim();
            const food_type = document.getElementById('foodType').value;
            const weight    = parseFloat(document.getElementById('signalWeight').value);
            const hours     = parseInt(document.getElementById('signalExpiry').value);
            const lat       = parseFloat(document.getElementById('signalLat').value);
            const lng       = parseFloat(document.getElementById('signalLng').value);

            if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) throw new Error('يرجى تحديد الموقع الجغرافي أولاً.');
            if (!title.trim() || title.trim().length > 100) throw new Error('اكتب عنواناً للتبرع (حتى 100 حرف).');

            const expires_at = new Date();
            expires_at.setHours(expires_at.getHours() + hours);

            let image_url = null;
            const file = document.getElementById('signalImage').files[0];
            if (file) {
                // Validate file size (max 5MB)
                if (file.size > 5 * 1024 * 1024) {
                    throw new Error('حجم الصورة كبير جداً، الحد الأقصى 5MB');
                }
                const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }[file.type];
                if (!ext) throw new Error('نوع الصورة غير مدعوم. استخدم JPG أو PNG أو WEBP أو GIF.');
                const path = `${currentProfile.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
                
                const { data: upData, error: upErr } = await db.storage
                    .from('signal-images')
                    .upload(path, file, { cacheControl: '3600', upsert: false });
                
                if (upErr) {
                    console.warn('Image upload failed:', upErr.message);
                    showToast('تعذر رفع الصورة؛ ستُرسل الإشارة بدونها.', 'warning');
                } else {
                    // Build public URL manually (most reliable method)
                    image_url = `${SUPABASE_URL}/storage/v1/object/public/signal-images/${path}`;
                }
            }

            const { error } = await db.from('signals').insert([{
                donor_id:   currentProfile.id,
                donor_name: currentProfile.name,
                donor_phone: currentProfile.phone,
                title, food_type, weight, lat, lng,
                expires_at: expires_at.toISOString(),
                image_url
            }]);
            if (error) throw error;

            showToast('✅ تم إرسال الإشارة! سيتواصل معك الملجأ عبر الواتساب.', 'success');
            signalForm.reset();
            document.getElementById('locationStatus').style.display = 'none';
            btnGetLocation.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i> تحديد موقعي الحالي';

        } catch (err) {
            showToast('❌ ' + err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> إرسال إشارة بث للمناديب';
        }
    });
}

// ==========================================
// 9. LOAD & RENDER SIGNALS
// ==========================================
async function loadSignals() {
    const now = new Date().toISOString();
    if (currentProfile?.role === 'donor') {
        const { data, error } = await db.from('signals').select('*').eq('donor_id', currentProfile.id)
            .order('created_at', { ascending: false }).limit(50);
        if (error) { console.error(error); showToast('تعذر تحميل الإشارات. تحقق من اتصالك أو إعدادات Supabase.', 'error'); return; }
        ownedSignals = data || [];
        activeSignals = ownedSignals.filter(signal => signal.status === 'active' && signal.expires_at > now);
        acceptedSignals = [];
    } else {
        const [activeResult, acceptedResult] = await Promise.all([
            db.from('signals').select('*').eq('status', 'active').gt('expires_at', now).order('created_at', { ascending: false }),
            db.from('signals').select('*').eq('status', 'accepted').eq('collector_id', currentProfile.id).order('created_at', { ascending: false })
        ]);
        if (activeResult.error || acceptedResult.error) {
            console.error(activeResult.error || acceptedResult.error);
            showToast('تعذر تحميل الإشارات. تحقق من اتصالك أو إعدادات Supabase.', 'error');
            return;
        }
        activeSignals = activeResult.data || [];
        acceptedSignals = acceptedResult.data || [];
        ownedSignals = [];
    }
    renderSignals();
    updateMapMarkers();
}

function renderSignals() {
    statActive.textContent = activeSignals.length;
    if (currentProfile.role === 'donor') {
        donorSignalsList.innerHTML = ownedSignals.length ? ownedSignals.map(sig => {
            const expired = sig.status === 'active' && new Date(sig.expires_at) <= new Date();
            const statusText = ({ accepted: 'تم قبولها — بانتظار الاستلام', completed: 'تم الاستلام', cancelled: 'ملغاة', expired: 'منتهية' })[sig.status] || (expired ? 'انتهت المهلة' : 'نشطة');
            return `<div class="task-item">
                <div class="task-header"><div class="task-title">${escapeHtml(sig.title)}</div><strong>${statusText}</strong></div>
                <div class="task-meta"><span>${escapeHtml(sig.weight)} كجم</span><span>${escapeHtml(sig.food_type)}</span></div>
                ${sig.status === 'active' && !expired ? `<button class="btn-secondary" onclick="cancelSignal(${inlineJsArg(sig.id)})"><i class="fa-solid fa-xmark"></i> إلغاء الإشارة</button>` : ''}
            </div>`;
        }).join('') : '<div class="empty-state"><p>لم ترسل أي تبرعات بعد.</p></div>';
        return;
    }

    if (!activeSignals.length) {
        tasksList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon"><i class="fa-solid fa-box-open"></i></div>
                <p>لا توجد تبرعات نشطة حالياً.</p>
                <small>ستظهر هنا فور إرسال أي متبرع إشارة.</small>
            </div>`;
    } else tasksList.innerHTML = activeSignals.map(sig => {
        const mins    = Math.max(0, Math.floor((new Date(sig.expires_at) - new Date()) / 60000));
        const urgency = mins < 30 ? '#ef4444' : '#10b981';
        const phoneDigits = whatsappPhone(sig.donor_phone);
        const waLink  = phoneDigits
            ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent('السلام عليكم، أنا من تطبيق بركة، هل التبرع لا يزال متاحاً؟')}`
            : null;
        const foodLabel = { meat:'لحوم وأحشاء', bones:'عظام وشحوم', mixed:'مختلط' }[sig.food_type] || escapeHtml(sig.food_type);

        return `
        <div class="task-item" id="sig-${escapeHtml(sig.id)}">
            <div class="task-header">
            <div class="task-title">${escapeHtml(sig.title)}</div>
                <span style="background:${urgency}22;color:${urgency};padding:3px 10px;border-radius:12px;font-size:0.8rem;border:1px solid ${urgency}44;">
                    ⏱ ${mins} دقيقة
                </span>
            </div>
            <div class="task-meta">
                <span><i class="fa-solid fa-store" style="color:#10b981;"></i> ${escapeHtml(sig.donor_name || 'متبرع')}</span>
                <span><i class="fa-solid fa-weight-hanging" style="color:#3b82f6;"></i> ${escapeHtml(sig.weight)} كجم</span>
                <span><i class="fa-solid fa-utensils" style="color:#f59e0b;"></i> ${foodLabel}</span>
            </div>
            ${sig.image_url && /^https:\/\//i.test(sig.image_url) ? `<img src="${escapeHtml(sig.image_url)}" class="task-img" alt="صورة التبرع" loading="lazy">` : ''}
            <div style="display:grid;grid-template-columns:1fr 1fr ${waLink ? '1fr' : ''};gap:0.5rem;margin-top:0.75rem;">
                <button class="btn-primary" onclick="acceptSignal(${inlineJsArg(sig.id)})">
                    <i class="fa-solid fa-check"></i> قبول
                </button>
                <button class="btn-secondary" onclick="routeTo(${Number(sig.lat)}, ${Number(sig.lng)})">
                    <i class="fa-solid fa-route"></i> مسار
                </button>
                ${waLink ? `
                <a href="${waLink}" target="_blank" rel="noopener noreferrer" class="btn-primary" style="background:#25d366;text-decoration:none;text-align:center;padding:0.75rem;border-radius:8px;font-weight:bold;">
                    <i class="fa-brands fa-whatsapp"></i> واتساب
                </a>` : ''}
            </div>
        </div>`;
    }).join('');

    acceptedSignalsList.innerHTML = acceptedSignals.length ? acceptedSignals.map(sig => {
        const phoneDigits = whatsappPhone(sig.donor_phone);
        const waLink = phoneDigits ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent('السلام عليكم، أنا من تطبيق بركة، وصلت لاستلام التبرع.')}` : '';
        return `<div class="task-item">
            <div class="task-header"><div class="task-title">${escapeHtml(sig.title)}</div><strong>بانتظار الاستلام</strong></div>
            <div class="task-meta"><span>${escapeHtml(sig.donor_name || 'متبرع')}</span><span>${escapeHtml(sig.weight)} كجم</span></div>
            <div class="accepted-actions">
                <button class="btn-secondary" onclick="routeTo(${Number(sig.lat)}, ${Number(sig.lng)})"><i class="fa-solid fa-route"></i> المسار</button>
                ${waLink ? `<a class="btn-primary" href="${waLink}" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-whatsapp"></i> واتساب</a>` : ''}
                <button class="btn-primary" onclick="completeSignal(${inlineJsArg(sig.id)})"><i class="fa-solid fa-check-double"></i> تم الاستلام</button>
            </div>
        </div>`;
    }).join('') : '<div class="empty-state"><p>لا توجد تبرعات قبلتها بعد.</p></div>';
}

function updateMapMarkers() {
    if (!map) return;
    Object.values(markers).forEach(m => map.removeLayer(m));
    markers = {};

    activeSignals.forEach(sig => {
        const lat = Number(sig.lat), lng = Number(sig.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return;
        const phoneDigits = whatsappPhone(sig.donor_phone);
        const waLink = phoneDigits
            ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent('السلام عليكم، أنا من تطبيق بركة.')}`
            : '';
        const m = L.marker([lat, lng], { icon: ICONS.donor }).addTo(map)
            .bindPopup(`
                <div style="min-width:180px;direction:rtl;font-family:sans-serif;">
                    <b style="color:#10b981;font-size:1rem;">${escapeHtml(sig.title)}</b><br>
                    <span style="color:#555;">${escapeHtml(sig.donor_name)} — ${escapeHtml(sig.weight)} كجم</span><br>
                    <div style="display:flex;gap:6px;margin-top:8px;">
                        ${currentProfile?.role === 'breeder' ? `<button onclick="acceptSignal(${inlineJsArg(sig.id)})" style="flex:1;padding:5px;background:#10b981;border:none;color:white;border-radius:6px;cursor:pointer;font-size:0.85rem;">✔ قبول</button>` : ''}
                        <button onclick="routeTo(${lat},${lng})" style="flex:1;padding:5px;background:#3b82f6;border:none;color:white;border-radius:6px;cursor:pointer;font-size:0.85rem;">
                            📍 مسار
                        </button>
                        ${waLink ? `<a href="${waLink}" target="_blank" rel="noopener noreferrer" style="flex:1;padding:5px;background:#25d366;color:white;border-radius:6px;text-align:center;font-size:0.85rem;text-decoration:none;">
                            💬 واتساب
                        </a>` : ''}
                    </div>
                </div>
            `);
        markers[sig.id] = m;
    });
}

// ==========================================
// 10. ACCEPT SIGNAL
// ==========================================
window.acceptSignal = async function(signalId) {
    try {
        if (currentProfile?.role !== 'breeder') throw new Error('قبول التبرعات متاح للمربين والملاجئ فقط.');
        const { data, error } = await db.rpc('accept_signal', { signal_id: signalId });
        if (error) throw error;
        if (!data) throw new Error('سبق أن قبل مستخدم آخر هذا التبرع أو انتهت صلاحيته.');
        showToast('✅ تم قبول الطلب! توجه للموقع عبر زر المسار.', 'success');
        await loadSignals();
    } catch (err) {
        showToast('❌ ' + err.message, 'error');
    }
};

window.cancelSignal = async function(signalId) {
    try {
        if (currentProfile?.role !== 'donor') throw new Error('إلغاء الإشارة متاح للمتبرع فقط.');
        const { data, error } = await db.rpc('cancel_signal', { signal_id: signalId });
        if (error) throw error;
        if (!data) throw new Error('تعذر الإلغاء؛ ربما قبلها مربي أو انتهت مهلتها.');
        showToast('تم إلغاء الإشارة.', 'success');
        await loadSignals();
    } catch (err) {
        showToast('❌ ' + err.message, 'error');
    }
};

window.completeSignal = async function(signalId) {
    try {
        if (currentProfile?.role !== 'breeder') throw new Error('تسجيل الاستلام متاح للمربي فقط.');
        const { data, error } = await db.rpc('complete_signal', { signal_id: signalId });
        if (error) throw error;
        if (!data) throw new Error('تعذر إكمال الإشارة؛ حدّث القائمة وحاول مرة أخرى.');
        showToast('تم تسجيل استلام التبرع. شكرًا لك!', 'success');
        await loadSignals();
    } catch (err) {
        showToast('❌ ' + err.message, 'error');
    }
};

// expose routeTo globally (called from popup buttons)
window.routeTo = routeTo;

// ==========================================
// 11. REAL-TIME
// ==========================================
function setupRealtime() {
    db.channel('signals-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'signals' }, () => {
            loadSignals();
            if (currentProfile.role !== 'donor') showToast('🔔 تحديث جديد في الإشارات!', 'info');
        })
        .subscribe();
}

// ==========================================
// 12. TOASTS
// ==========================================
function showToast(msg, type = 'info') {
    const c = document.getElementById('toastContainer');
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    const ic = { success:'fa-circle-check', error:'fa-circle-xmark', info:'fa-circle-info', warning:'fa-triangle-exclamation' };
    const icon = document.createElement('i');
    icon.className = `fa-solid ${ic[type]||'fa-circle-info'}`;
    icon.style.fontSize = '1.1rem';
    const text = document.createElement('span');
    text.textContent = msg;
    t.append(icon, text);
    c.appendChild(t);
    setTimeout(() => { t.style.opacity='0'; t.style.transition='opacity 0.4s'; setTimeout(()=>t.remove(),400); }, 4000);
}

// ==========================================
// START
// ==========================================
if (window.location.protocol === 'file:') {
    const fileModeNotice = document.getElementById('fileModeNotice');
    if (fileModeNotice) fileModeNotice.hidden = false;
}
window.addEventListener('barakah:food-view', () => {
    if (!db) return;
    initMap();
    if (currentProfile) loadSignals();
    else {
        const notice = document.getElementById('publicFoodMapNotice');
        if (notice) notice.hidden = false;
    }
});


if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js').catch(error => console.warn('Offline shell registration failed:', error));
    }, { once: true });
}
