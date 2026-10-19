(() => {
    const config = window.BARAKAH_SUPABASE_CONFIG || {};
    const url = config.url?.trim() || 'https://ppuknuxgbdgufcbstiqq.supabase.co';
    const key = config.anonKey?.trim();
    const db = window.BARAKAH_SUPABASE_CLIENT || (window.supabase?.createClient && key ? window.supabase.createClient(url, key) : null);
    const demoItems = [
        { id:'demo-cat', item_type:'cat', title:'سمسم', age:'صغير', gender:'male', city:'الجزائر العاصمة', description:'قط شيرازي صغير ولطيف جدًا، محب للأطفال ومطعّم بالكامل.', image_url:'https://images.unsplash.com/photo-1573865526739-10659fec78a5?auto=format&fit=crop&w=900&q=85' },
        { id:'demo-dog', item_type:'dog', title:'لوكي', age:'بالغ', gender:'male', city:'تيارت', description:'كلب هاسكي صغير وودود يبحث عن عائلة محبة ترعاه.', image_url:'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=900&q=85' },
        { id:'demo-supply', item_type:'supply', title:'تبرع بمستلزمات', age:'', gender:'unknown', city:'فلسطين', description:'مستلزمات وأدوات للحيوانات الأليفة تبحث عن مستفيد جديد.', image_url:'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?auto=format&fit=crop&w=900&q=85' }
    ];
    let rows = [];
    let category = 'all';

    const phoneDigits = value => String(value || '').replace(/^00/, '').replace(/\D/g, '');
    const safe = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
    const toast = message => {
        const host = document.getElementById('toastContainer');
        if (!host) return;
        const node = document.createElement('div'); node.className = 'toast'; node.textContent = message; host.appendChild(node);
        setTimeout(() => node.remove(), 4200);
    };
    const modal = document.getElementById('listingModal');
    const openModal = () => { modal.hidden = false; document.body.classList.add('modal-open'); setTimeout(() => document.getElementById('listingTitle')?.focus(), 0); };
    const closeModal = () => { modal.hidden = true; document.body.classList.remove('modal-open'); };
    document.querySelectorAll('[data-open-listing]').forEach(button => button.addEventListener('click', openModal));
    document.querySelectorAll('[data-close-listing]').forEach(button => button.addEventListener('click', closeModal));
    document.addEventListener('keydown', event => { if (event.key === 'Escape') closeModal(); });

    function draw() {
        const host = document.getElementById('marketListings');
        const count = document.getElementById('marketCount');
        if (!host) return;
        const query = (document.getElementById('marketSearch')?.value || '').trim().toLocaleLowerCase('ar');
        const demo = rows.length > 0 && String(rows[0].id).startsWith('demo-');
        const visible = rows.filter(row => {
            const matchesCategory = category === 'all' || row.item_type === category;
            const haystack = `${row.title} ${row.description} ${row.city}`.toLocaleLowerCase('ar');
            return matchesCategory && (!query || haystack.includes(query));
        });
        if (!visible.length) {
            host.innerHTML = '<div class="market-empty"><i class="fa-solid fa-paw"></i><strong>ما لقينا إعلانات بهذا الوصف</strong><small>جرّب كلمة بحث ثانية أو اختر تصنيفًا مختلفًا.</small></div>';
            count.textContent = '';
            return;
        }
        host.innerHTML = visible.map(row => {
            const itemIcon = row.item_type === 'cat' ? 'fa-cat' : row.item_type === 'dog' ? 'fa-dog' : 'fa-box-open';
            const itemLabel = row.item_type === 'cat' ? '🐱 قطة' : row.item_type === 'dog' ? '🐶 كلب' : '📦 مستلزمات';
            const gender = row.item_type === 'supply' ? 'تبرع' : ({male:'ذكر',female:'أنثى'}[row.gender] || 'غير محدد');
            const age = row.age || (row.item_type === 'supply' ? 'بحالة جيدة' : 'العمر غير محدد');
            const phone = phoneDigits(row.contact_phone);
            const action = phone && !demo
                ? `<a class="market-card-contact" href="https://wa.me/${phone}?text=${encodeURIComponent(`السلام عليكم، تواصلت معك بخصوص إعلان «${row.title}» في بركة.`)}" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-whatsapp"></i> تواصل عبر الواتساب</a>`
                : '<button class="market-card-contact demo-button" type="button" disabled><i class="fa-solid fa-eye"></i> مثال للعرض فقط</button>';
            const image = row.image_url && /^https:\/\//i.test(row.image_url)
                ? `<img src="${safe(row.image_url)}" alt="${safe(row.title)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span class="market-card-fallback" hidden><i class="fa-solid ${itemIcon}"></i></span>`
                : `<span class="market-card-fallback"><i class="fa-solid ${itemIcon}"></i></span>`;
            return `<article class="market-card"><div class="market-card-media">${image}<span class="market-card-badge${demo?' demo':''}">${demo?'عرض توضيحي · ':''}${itemLabel}</span></div><div class="market-card-content"><div class="market-card-title-row"><h3>${safe(row.title)}</h3><span class="market-card-price">${row.item_type==='supply'?'مجاني':'للتبني'}</span></div><div class="market-card-tags"><span class="market-tag">${safe(age)}</span><span class="market-tag gender">${safe(gender)}</span><span class="market-tag"><i class="fa-solid fa-location-dot"></i> ${safe(row.city)}</span></div><p class="market-card-description">${safe(row.description)}</p>${action}</div></article>`;
        }).join('');
        count.textContent = demo ? 'أمثلة توضيحية للتصميم — ستظهر إعلانات المجتمع بعد مراجعتها ونشرها.' : `${visible.length} إعلان متاح`;
    }

    async function load() {
        const host = document.getElementById('marketListings');
        if (!db) { host.innerHTML = '<div class="market-empty"><i class="fa-solid fa-cloud-arrow-down"></i><strong>تعذر الاتصال بالخدمة</strong><small>تحقق من اتصال الإنترنت ثم أعد المحاولة.</small></div>'; return; }
        const { data, error } = await db.from('market_listings').select('id,item_type,title,description,city,age,gender,contact_phone,image_url,created_at').eq('status','active').order('created_at',{ascending:false}).limit(60);
        if (error) { console.error('Marketplace load failed:',error); host.innerHTML = '<div class="market-empty"><i class="fa-solid fa-cloud-arrow-down"></i><strong>تعذر تحميل الإعلانات</strong><small>أعد المحاولة بعد قليل.</small></div>'; return; }
        rows = data?.length ? data : demoItems;
        draw();
    }

    function setCategory(value) {
        category = value;
        document.querySelectorAll('[data-category]').forEach(button => button.classList.toggle('is-active',button.dataset.category===value));
        document.querySelectorAll('.mobile-market-nav [data-nav]').forEach(button => button.classList.toggle('is-active',button.dataset.nav===value));
        draw();
    }
    function showFoodMap(button) {
        document.getElementById('marketView').hidden=true;
        document.getElementById('foodView').hidden=false;
        document.querySelectorAll('.mobile-market-nav button').forEach(item=>item.classList.toggle('is-active',item.dataset.nav==='food'));
        document.querySelectorAll('[data-category]').forEach(item=>item.classList.toggle('is-active',item.dataset.category==='food'));
        window.dispatchEvent(new Event('barakah:food-view'));
        window.scrollTo({top:0,behavior:'smooth'});
    }
    document.querySelectorAll('[data-category]').forEach(button => button.addEventListener('click',()=>button.dataset.category==='food'?showFoodMap(button):setCategory(button.dataset.category)));
    document.querySelectorAll('.mobile-market-nav [data-nav]').forEach(button => button.addEventListener('click',()=>{
        if (button.dataset.nav === 'food') { showFoodMap(button); return; }
        else { document.getElementById('foodView').hidden=true; document.getElementById('marketView').hidden=false; setCategory(button.dataset.nav); }
        window.scrollTo({top:0,behavior:'smooth'});
    }));
    document.getElementById('marketSearch')?.addEventListener('input',draw);
    document.getElementById('marketSearchButton')?.addEventListener('click',draw);
    document.getElementById('listingType')?.addEventListener('change',event=>document.querySelectorAll('.pet-only-field').forEach(field=>field.hidden=event.target.value==='supply'));
    document.getElementById('listingForm')?.addEventListener('submit',async event=>{
        event.preventDefault();
        const button=document.getElementById('listingSubmit');
        const rawPhone=document.getElementById('listingPhone').value.trim().replace(/[\s()-]/g,'');
        const phone=rawPhone.startsWith('00')?`+${rawPhone.slice(2)}`:rawPhone;
        const imageUrl=document.getElementById('listingImageUrl').value.trim()||null;
        if(!/^\+[1-9]\d{7,14}$/.test(phone)){toast('أدخل رقم واتساب بصيغة دولية، مثل +213...');return;}
        if(imageUrl&&!/^https:\/\//i.test(imageUrl)){toast('يجب أن يبدأ رابط الصورة بـ https://');return;}
        const payload={item_type:document.getElementById('listingType').value,title:document.getElementById('listingTitle').value.trim(),description:document.getElementById('listingDescription').value.trim(),city:document.getElementById('listingCity').value.trim(),age:document.getElementById('listingAge').value.trim()||null,gender:document.getElementById('listingGender').value,contact_phone:phone,image_url:imageUrl};
        button.disabled=true;button.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> جارٍ إرسال الإعلان...';
        try { const {error}=await db.from('market_listings').insert(payload);if(error)throw error;document.getElementById('listingForm').reset();document.querySelectorAll('.pet-only-field').forEach(field=>field.hidden=false);closeModal();toast('تم نشر إعلانك وسيظهر الآن للجميع.'); }
        catch(error){console.error('Listing submission failed:',error);toast('تعذر إرسال الإعلان. تحقق من البيانات وحاول مرة أخرى.');}
        finally{button.disabled=false;button.innerHTML='<i class="fa-solid fa-paper-plane"></i> نشر الإعلان';}
    });
    load();
})();
