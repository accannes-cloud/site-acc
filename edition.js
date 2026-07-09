// ============================================================
//  edition.js — Éditeur unifié "sur le site" pour l'ACC
//  Un bouton "Modifier" sur chaque page. Une fois connecté,
//  la page devient modifiable directement. La connexion reste
//  active quand on navigue d'une page à l'autre.
// ============================================================

(function () {
  const REPO = 'accannes-cloud/site-acc';
  const OAUTH = 'https://decap-oauth.accannes.workers.dev';

  // Quelle page correspond à quel fichier de contenu
  const PAGES = {
    'index.html': { file: 'contenu/pages/accueil.json', type: 'accueil' },
    '':           { file: 'contenu/pages/accueil.json', type: 'accueil' },
    'le-club.html': { file: 'contenu/pages/histoire.json', type: 'histoire' }
  };

  const pageNom = window.location.pathname.split('/').pop() || 'index.html';
  const config = PAGES[pageNom];

  // État
  let token = sessionStorage.getItem('acc_edit_token') || null;
  let actif = sessionStorage.getItem('acc_edit_actif') === '1';
  let data = null, sha = null, modif = false, champActuel = null;

  // ---------- OUTILS ----------
  function el(html) { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }
  function imgUrl(chemin) {
    if (!chemin) return '';
    if (chemin.startsWith('http')) return chemin;
    return `https://raw.githubusercontent.com/${REPO}/main/${chemin}?t=${Date.now()}`;
  }
  function toast(msg, err) {
    let t = document.getElementById('acc-toast');
    if (!t) { t = el('<div id="acc-toast" class="acc-toast"></div>'); document.body.appendChild(t); }
    t.textContent = msg;
    t.className = 'acc-toast show' + (err ? ' error' : '');
    setTimeout(() => { t.className = 'acc-toast' + (err ? ' error' : ''); }, 4000);
  }

  // ---------- CONNEXION ----------
  function login() {
    const p = window.open(OAUTH + '/auth', 'github-login', 'width=600,height=700');
    let hs = false;
    function handler(e) {
      if (typeof e.data !== 'string') return;
      if (!hs && e.data.indexOf('authorizing:github') !== -1) { hs = true; if (p) p.postMessage('authorizing:github', '*'); return; }
      if (e.data.indexOf('authorization:github:success:') !== -1) {
        try {
          token = JSON.parse(e.data.split('authorization:github:success:')[1]).token;
          sessionStorage.setItem('acc_edit_token', token);
          sessionStorage.setItem('acc_edit_actif', '1');
          actif = true;
          window.removeEventListener('message', handler);
          if (p) p.close();
          demarrer();
        } catch (err) { toast('Erreur de connexion', true); }
      }
    }
    window.addEventListener('message', handler);
  }

  function quitter() {
    if (modif && !confirm('Des modifications ne sont pas enregistrées. Quitter quand même ?')) return;
    sessionStorage.removeItem('acc_edit_actif');
    sessionStorage.removeItem('acc_edit_token');
    location.reload();
  }

  // ---------- CHARGEMENT DES DONNÉES ----------
  async function charger() {
    try {
      const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${config.file}`, {
        headers: { 'Authorization': 'token ' + token }
      });
      if (res.status === 401) { // token expiré
        sessionStorage.removeItem('acc_edit_token'); sessionStorage.removeItem('acc_edit_actif');
        toast('Session expirée, reconnecte-toi', true);
        setTimeout(() => location.reload(), 1500);
        return;
      }
      const json = await res.json();
      sha = json.sha;
      data = JSON.parse(decodeURIComponent(escape(atob(json.content))));
      rendre();
    } catch (e) { toast('Impossible de charger le contenu', true); }
  }

  // ---------- BARRE D'OUTILS ----------
  function afficherToolbar() {
    const bar = el(`
      <div id="acc-toolbar">
        <span class="acc-brand">✏️ Mode édition</span>
        <span class="acc-info">Clique sur un élément surligné pour le modifier</span>
        <span style="margin-left:auto;"></span>
        <button id="acc-save" disabled>💾 Enregistrer</button>
        <button id="acc-quit">✕ Quitter</button>
      </div>`);
    document.body.appendChild(bar);
    document.body.classList.add('acc-edit-mode');
    document.getElementById('acc-save').onclick = sauvegarder;
    document.getElementById('acc-quit').onclick = quitter;
    // Garder le mode édition en naviguant : on ajoute #edit aux liens internes
    document.querySelectorAll('a[href]').forEach(a => {
      const href = a.getAttribute('href');
      if (href && href.endsWith('.html') && !href.startsWith('http')) {
        a.addEventListener('click', () => sessionStorage.setItem('acc_edit_actif', '1'));
      }
    });
  }

  function marquerModifie() {
    modif = true;
    const b = document.getElementById('acc-save');
    if (b) b.disabled = false;
  }

  // ---------- BOUTON "MODIFIER" (visiteur non connecté) ----------
  function afficherBoutonModifier() {
    if (!config) return; // page non éditable
    const btn = el('<button id="acc-modif-btn">✏️ Modifier</button>');
    btn.onclick = login;
    document.body.appendChild(btn);
  }

  // ---------- MODALE ----------
  function modale(valeur, callback, multiligne) {
    let bg = document.getElementById('acc-modal');
    if (!bg) {
      bg = el(`
        <div id="acc-modal" class="acc-modal-bg">
          <div class="acc-modal">
            <h3>Modifier le texte</h3>
            <textarea id="acc-modal-input"></textarea>
            <div class="acc-modal-actions">
              <button class="acc-cancel">Annuler</button>
              <button class="acc-ok">Valider</button>
            </div>
          </div>
        </div>`);
      document.body.appendChild(bg);
    }
    const input = bg.querySelector('#acc-modal-input');
    input.value = valeur || '';
    bg.classList.add('open');
    input.focus();
    bg.querySelector('.acc-cancel').onclick = () => bg.classList.remove('open');
    bg.querySelector('.acc-ok').onclick = () => { callback(input.value); bg.classList.remove('open'); };
  }

  function rendreEditable(element, onClick) {
    element.classList.add('acc-editable');
    element.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); onClick(); });
  }

  // ---------- UPLOAD IMAGE ----------
  function choisirImage(callback, maxPx) {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        const img = new Image();
        img.onload = () => {
          const MAX = maxPx || 1000;
          let { width, height } = img;
          if (width > MAX || height > MAX) { if (width > height) { height = height*MAX/width; width = MAX; } else { width = width*MAX/height; height = MAX; } }
          const cv = document.createElement('canvas'); cv.width = width; cv.height = height;
          cv.getContext('2d').drawImage(img, 0, 0, width, height);
          envoyerFichier(cv.toDataURL('image/jpeg', 0.85).split(',')[1], 'jpg', callback);
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  function choisirVideo(callback) {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'video/mp4,video/*';
    input.onchange = () => {
      const file = input.files[0]; if (!file) return;
      if (file.size > 25 * 1024 * 1024) { toast('Vidéo trop lourde (max 25 Mo)', true); return; }
      toast('⏳ Envoi de la vidéo...');
      const reader = new FileReader();
      reader.onload = ev => envoyerFichier(ev.target.result.split(',')[1], 'mp4', callback);
      reader.readAsDataURL(file);
    };
    input.click();
  }

  async function envoyerFichier(base64, ext, callback) {
    if (ext !== 'mp4') toast('⏳ Envoi de la photo...');
    const chemin = 'images/uploads/f-' + Date.now() + '.' + ext;
    try {
      const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${chemin}`, {
        method: 'PUT',
        headers: { 'Authorization': 'token ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Ajout média via éditeur', content: base64 })
      });
      if (!res.ok) throw new Error();
      callback(chemin);
      toast('✓ Média ajouté');
    } catch (e) { toast('Erreur d\'envoi (fichier trop lourd ?)', true); }
  }

  // ---------- SAUVEGARDE ----------
  async function sauvegarder() {
    const b = document.getElementById('acc-save');
    b.disabled = true; b.textContent = '⏳ Enregistrement...';
    try {
      const contenu = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));
      const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${config.file}`, {
        method: 'PUT',
        headers: { 'Authorization': 'token ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Modification via éditeur', content: contenu, sha: sha })
      });
      if (!res.ok) throw new Error();
      sha = (await res.json()).content.sha;
      modif = false;
      b.textContent = '💾 Enregistrer';
      toast('✓ Enregistré ! Le site se met à jour dans 1 minute.');
    } catch (e) {
      b.disabled = false; b.textContent = '💾 Enregistrer';
      toast('Erreur lors de l\'enregistrement', true);
    }
  }

  // ---------- RENDU SELON LE TYPE DE PAGE ----------
  function rendre() {
    if (config.type === 'accueil') rendreAccueil();
    else if (config.type === 'histoire') rendreHistoire();
  }

  // ===== PAGE ACCUEIL =====
  function rendreAccueil() {
    // Textes simples
    document.querySelectorAll('[data-accueil]').forEach(node => {
      const key = node.getAttribute('data-accueil');
      if (data[key] !== undefined) node.textContent = data[key];
      rendreEditable(node, () => modale(data[key], v => { data[key] = v; node.textContent = v; marquerModifie(); }));
    });

    // Stats
    const statsBox = document.querySelector('[data-accueil-stats]');
    if (statsBox && Array.isArray(data.stats)) {
      statsBox.innerHTML = data.stats.map((s, i) => `
        <div class="stat-item">
          <div class="stat-number acc-editable" data-e="stat-num-${i}">${s.nombre}</div>
          <div class="stat-label acc-editable" data-e="stat-lab-${i}">${s.label}</div>
        </div>`).join('');
      statsBox.querySelectorAll('[data-e]').forEach(node => {
        const [, type, i] = node.getAttribute('data-e').split('-');
        const prop = type === 'num' ? 'nombre' : 'label';
        node.addEventListener('click', () => modale(data.stats[i][prop], v => { data.stats[i][prop] = v; node.textContent = v; marquerModifie(); }));
      });
    }

    // Valeurs (avec photo)
    const valBox = document.querySelector('[data-accueil-valeurs]');
    if (valBox && Array.isArray(data.valeurs)) {
      valBox.innerHTML = data.valeurs.map((v, i) => {
        const visuel = v.photo ? `<div class="value-photo" data-vphoto="${i}"><img src="${imgUrl(v.photo)}" alt=""></div>` : `<div class="value-icon acc-editable" data-vicone="${i}">${v.icone || '📷'}</div>`;
        return `<div class="value-card">
          ${visuel}
          <div class="value-title acc-editable" data-vt="${i}">${v.titre || ''}</div>
          <div class="value-text acc-editable" data-vx="${i}">${v.texte || ''}</div>
          <div class="acc-mini-actions">
            <button data-vup="${i}">📷 Photo</button>
            ${v.photo ? `<button data-vdel="${i}">🗑️</button>` : ''}
          </div>
        </div>`;
      }).join('');
      valBox.querySelectorAll('[data-vt]').forEach(n => { const i=n.dataset.vt; n.addEventListener('click',()=>modale(data.valeurs[i].titre,v=>{data.valeurs[i].titre=v;n.textContent=v;marquerModifie();})); });
      valBox.querySelectorAll('[data-vx]').forEach(n => { const i=n.dataset.vx; n.addEventListener('click',()=>modale(data.valeurs[i].texte,v=>{data.valeurs[i].texte=v;n.textContent=v;marquerModifie();})); });
      valBox.querySelectorAll('[data-vicone]').forEach(n => { const i=n.dataset.vicone; n.addEventListener('click',()=>modale(data.valeurs[i].icone,v=>{data.valeurs[i].icone=v;n.textContent=v;marquerModifie();})); });
      valBox.querySelectorAll('[data-vup]').forEach(n => { const i=n.dataset.vup; n.addEventListener('click',()=>choisirImage(c=>{data.valeurs[i].photo=c;marquerModifie();rendreAccueil();})); });
      valBox.querySelectorAll('[data-vphoto]').forEach(n => { const i=n.dataset.vphoto; n.addEventListener('click',()=>choisirImage(c=>{data.valeurs[i].photo=c;marquerModifie();rendreAccueil();})); });
      valBox.querySelectorAll('[data-vdel]').forEach(n => { const i=n.dataset.vdel; n.addEventListener('click',()=>{data.valeurs[i].photo='';marquerModifie();rendreAccueil();}); });
    }

    // Disciplines (cartes avec fond photo)
    const discGrid = document.querySelector('.disc-grid');
    if (discGrid && Array.isArray(data.disciplines)) {
      const couleurs = ['bleu','bleu2','bleu3','navy','bleu'];
      discGrid.innerHTML = data.disciplines.map((d, i) => {
        const fond = d.photo ? `style="background-image:url('${imgUrl(d.photo)}');background-size:cover;background-position:center;font-size:0;"` : '';
        return `<div class="disc-card" data-color="${couleurs[i%5]}" style="cursor:default;">
          <div class="disc-bg" ${fond}>${d.photo ? '' : (d.emoji||'')}</div>
          <div class="disc-overlay"></div>
          <div class="disc-content">
            <span class="disc-tag acc-editable" data-dt="${i}">${d.tag||''}</span>
            <div class="disc-name acc-editable" data-dn="${i}">${d.nom||''}</div>
            <p class="disc-desc acc-editable" data-dd="${i}">${d.desc||''}</p>
            <div class="acc-mini-actions">
              <button data-dup="${i}">📷 Fond</button>
              ${d.photo ? `<button data-ddel="${i}">🗑️</button>` : ''}
            </div>
          </div>
        </div>`;
      }).join('');
      discGrid.querySelectorAll('[data-dt]').forEach(n=>{const i=n.dataset.dt;n.addEventListener('click',()=>modale(data.disciplines[i].tag,v=>{data.disciplines[i].tag=v;n.textContent=v;marquerModifie();}));});
      discGrid.querySelectorAll('[data-dn]').forEach(n=>{const i=n.dataset.dn;n.addEventListener('click',()=>modale(data.disciplines[i].nom,v=>{data.disciplines[i].nom=v;n.textContent=v;marquerModifie();}));});
      discGrid.querySelectorAll('[data-dd]').forEach(n=>{const i=n.dataset.dd;n.addEventListener('click',()=>modale(data.disciplines[i].desc,v=>{data.disciplines[i].desc=v;n.textContent=v;marquerModifie();}));});
      discGrid.querySelectorAll('[data-dup]').forEach(n=>{const i=n.dataset.dup;n.addEventListener('click',()=>choisirImage(c=>{data.disciplines[i].photo=c;marquerModifie();rendreAccueil();}));});
      discGrid.querySelectorAll('[data-ddel]').forEach(n=>{const i=n.dataset.ddel;n.addEventListener('click',()=>{data.disciplines[i].photo='';marquerModifie();rendreAccueil();});});
    }

    // Sponsors
    const sponsBox = document.querySelector('[data-accueil-sponsors]');
    if (sponsBox && Array.isArray(data.sponsors)) {
      sponsBox.innerHTML = data.sponsors.map((s, i) => {
        const logo = s.logo ? `<div class="part-logo" data-slogo="${i}"><img src="${imgUrl(s.logo)}" style="max-height:44px;max-width:120px;object-fit:contain;"></div>` : `<div class="part-logo acc-editable" data-snom="${i}">${s.nom||''}</div>`;
        return `<div style="position:relative;text-align:center;">
          <button class="acc-suppr-badge" data-sdel="${i}">✕</button>
          ${logo}
          <div class="acc-mini-actions"><button data-sup="${i}">📷 Logo</button></div>
        </div>`;
      }).join('') + `<button class="acc-ajout" data-sadd>➕ Sponsor</button>`;
      sponsBox.querySelectorAll('[data-snom]').forEach(n=>{const i=n.dataset.snom;n.addEventListener('click',()=>modale(data.sponsors[i].nom,v=>{data.sponsors[i].nom=v;n.textContent=v;marquerModifie();}));});
      sponsBox.querySelectorAll('[data-slogo]').forEach(n=>{const i=n.dataset.slogo;n.addEventListener('click',()=>choisirImage(c=>{data.sponsors[i].logo=c;marquerModifie();rendreAccueil();}));});
      sponsBox.querySelectorAll('[data-sup]').forEach(n=>{const i=n.dataset.sup;n.addEventListener('click',()=>choisirImage(c=>{data.sponsors[i].logo=c;marquerModifie();rendreAccueil();}));});
      sponsBox.querySelectorAll('[data-sdel]').forEach(n=>{const i=n.dataset.sdel;n.addEventListener('click',()=>{if(confirm('Supprimer ce sponsor ?')){data.sponsors.splice(i,1);marquerModifie();rendreAccueil();}});});
      const add = sponsBox.querySelector('[data-sadd]');
      if (add) add.addEventListener('click',()=>{data.sponsors.push({nom:'Nouveau',logo:''});marquerModifie();rendreAccueil();});
    }

    // Fond du hero
    const heroFond = document.querySelector('[data-accueil-herofond]');
    if (heroFond) {
      if (data.hero_fond_video) heroFond.innerHTML = `<video autoplay muted loop playsinline style="width:100%;height:100%;object-fit:cover;opacity:0.55;"><source src="${imgUrl(data.hero_fond_video)}" type="video/mp4"></video>`;
      else if (data.hero_fond_image) heroFond.innerHTML = `<img src="${imgUrl(data.hero_fond_image)}" style="width:100%;height:100%;object-fit:cover;opacity:0.5;">`;
      // Boutons de changement de fond (ajoutés une seule fois)
      if (!document.getElementById('acc-herofond-ctrl')) {
        const ctrl = el(`<div id="acc-herofond-ctrl"><button id="acc-hero-img">📷 Image de fond</button><button id="acc-hero-vid">🎬 Vidéo de fond</button></div>`);
        heroFond.parentElement.appendChild(ctrl);
        ctrl.querySelector('#acc-hero-img').onclick = () => choisirImage(c => { data.hero_fond_image = c; data.hero_fond_video = ''; marquerModifie(); rendreAccueil(); }, 1600);
        ctrl.querySelector('#acc-hero-vid').onclick = () => choisirVideo(c => { data.hero_fond_video = c; data.hero_fond_image = ''; marquerModifie(); rendreAccueil(); });
      }
    }
  }

  // ===== PAGE HISTOIRE =====
  function rendreHistoire() {
    document.querySelectorAll('[data-histoire]').forEach(node => {
      const key = node.getAttribute('data-histoire');
      if (data[key] !== undefined) node.textContent = data[key];
      rendreEditable(node, () => modale(data[key], v => { data[key] = v; node.textContent = v; marquerModifie(); }, true));
    });

    // Corps (paragraphes + photos + citation)
    const body = document.querySelector('[data-histoire-body]');
    if (body) {
      let html = '';
      (data.paragraphes || []).forEach((p, i) => {
        html += `<div class="acc-hist-para"><p class="acc-editable" data-hp="${i}">${p.texte}</p><button class="acc-suppr-mini" data-hpdel="${i}">🗑️ Supprimer</button></div>`;
        if (i === 2 && data.photos && data.photos[0]) html += photoBlock(0);
        if (i === 2 && data.citation) html += `<div class="pull-quote acc-editable" data-hcit><p>${data.citation}</p></div>`;
        if (i === 3 && data.photos && data.photos[1]) html += photoBlock(1);
      });
      html += `<button class="acc-ajout" data-hpadd>➕ Ajouter un paragraphe</button>`;
      body.innerHTML = html;

      body.querySelectorAll('[data-hp]').forEach(n=>{const i=n.dataset.hp;n.addEventListener('click',()=>modale(data.paragraphes[i].texte,v=>{data.paragraphes[i].texte=v;n.textContent=v;marquerModifie();},true));});
      body.querySelectorAll('[data-hpdel]').forEach(n=>{const i=n.dataset.hpdel;n.addEventListener('click',()=>{data.paragraphes.splice(i,1);marquerModifie();rendreHistoire();});});
      const cit = body.querySelector('[data-hcit]');
      if (cit) cit.addEventListener('click',()=>modale(data.citation,v=>{data.citation=v;marquerModifie();rendreHistoire();},true));
      body.querySelectorAll('[data-hphoto]').forEach(n=>{const i=n.dataset.hphoto;n.addEventListener('click',()=>choisirImage(c=>{data.photos[i].image=c;marquerModifie();rendreHistoire();},1200));});
      body.querySelectorAll('[data-hpcap]').forEach(n=>{const i=n.dataset.hpcap;n.addEventListener('click',()=>modale(data.photos[i].legende,v=>{data.photos[i].legende=v;marquerModifie();rendreHistoire();}));});
      body.querySelectorAll('[data-hphdel]').forEach(n=>{const i=n.dataset.hphdel;n.addEventListener('click',()=>{data.photos.splice(i,1);marquerModifie();rendreHistoire();});});
      const padd = body.querySelector('[data-hpadd]');
      if (padd) padd.addEventListener('click',()=>{if(!data.paragraphes)data.paragraphes=[];data.paragraphes.push({texte:'Nouveau paragraphe.'});marquerModifie();rendreHistoire();});
    }

    // Chronologie
    const tl = document.querySelector('[data-histoire-timeline]');
    if (tl) {
      tl.innerHTML = (data.chronologie || []).map((c, i) => `
        <div class="tl-item">
          <div class="tl-year acc-editable" data-hcy="${i}">${c.annee}</div>
          <div class="tl-text"><span class="acc-editable" data-hct="${i}">${c.texte}</span>
          <button class="acc-suppr-mini" data-hcdel="${i}">🗑️</button></div>
        </div>`).join('') + `<button class="acc-ajout" data-hcadd>➕ Ajouter une date</button>`;
      tl.querySelectorAll('[data-hcy]').forEach(n=>{const i=n.dataset.hcy;n.addEventListener('click',()=>modale(data.chronologie[i].annee,v=>{data.chronologie[i].annee=v;n.textContent=v;marquerModifie();}));});
      tl.querySelectorAll('[data-hct]').forEach(n=>{const i=n.dataset.hct;n.addEventListener('click',()=>modale(data.chronologie[i].texte,v=>{data.chronologie[i].texte=v;n.textContent=v;marquerModifie();},true));});
      tl.querySelectorAll('[data-hcdel]').forEach(n=>{const i=n.dataset.hcdel;n.addEventListener('click',()=>{data.chronologie.splice(i,1);marquerModifie();rendreHistoire();});});
      const cadd = tl.querySelector('[data-hcadd]');
      if (cadd) cadd.addEventListener('click',()=>{if(!data.chronologie)data.chronologie=[];data.chronologie.push({annee:'ANNÉE',texte:'Nouvel événement.'});marquerModifie();rendreHistoire();});
    }
  }

  function photoBlock(i) {
    const p = (data.photos || [])[i]; if (!p) return '';
    const img = p.image ? `<div class="archive-photo-edit" data-hphoto="${i}"><img src="${imgUrl(p.image)}" alt=""><span class="acc-photo-badge">📷 Changer</span></div>` : `<div class="archive-photo-edit vide" data-hphoto="${i}">📷 Ajouter une photo</div>`;
    return `<div class="archive-photo">${img}<div class="archive-caption acc-editable" data-hpcap="${i}">${p.legende||''}</div><button class="acc-suppr-mini" data-hphdel="${i}">🗑️ Supprimer la photo</button></div>`;
  }

  // ---------- STYLES DE L'ÉDITEUR ----------
  function injecterStyles() {
    const css = `
      #acc-modif-btn { position: fixed; bottom: 20px; right: 20px; z-index: 9000; background: #001F5C; color: #FFD600; border: none; border-radius: 100px; padding: 12px 22px; font-family: 'DM Sans',sans-serif; font-weight: 600; font-size: 14px; cursor: pointer; box-shadow: 0 6px 24px rgba(0,31,92,0.35); }
      #acc-modif-btn:hover { transform: translateY(-2px); }
      #acc-toolbar { position: sticky; top: 0; z-index: 9500; display: flex; align-items: center; gap: 14px; background: #001F5C; padding: 10px 18px; box-shadow: 0 2px 14px rgba(0,0,0,0.25); flex-wrap: wrap; }
      #acc-toolbar .acc-brand { color: #FFD600; font-weight: 600; font-size: 14px; }
      #acc-toolbar .acc-info { color: #B5D4F4; font-size: 12px; }
      #acc-toolbar button { border: none; border-radius: 8px; padding: 8px 16px; font-family: inherit; font-weight: 600; font-size: 13px; cursor: pointer; }
      #acc-save { background: #FFD600; color: #001F5C; }
      #acc-save:disabled { opacity: 0.5; cursor: not-allowed; }
      #acc-quit { background: rgba(255,255,255,0.14); color: #fff; }
      body.acc-edit-mode .acc-editable { outline: 2px dashed rgba(255,214,0,0.85); outline-offset: 3px; cursor: pointer; border-radius: 4px; transition: background 0.15s; }
      body.acc-edit-mode .acc-editable:hover { background: rgba(255,214,0,0.25); }
      .acc-mini-actions { display: flex; gap: 6px; justify-content: center; margin-top: 8px; }
      .acc-mini-actions button { background: #EEF2F9; border: 1px solid #C9D6EA; color: #003DA5; border-radius: 6px; padding: 4px 10px; font-size: 11px; font-weight: 600; cursor: pointer; font-family: inherit; }
      .acc-suppr-badge { position: absolute; top: -8px; right: -8px; width: 22px; height: 22px; border-radius: 50%; background: #A32D2D; color: #fff; border: none; font-size: 11px; cursor: pointer; z-index: 5; }
      .acc-ajout { display: inline-block; background: #003DA5; color: #fff; border: none; border-radius: 10px; padding: 10px 18px; font-family: inherit; font-weight: 600; font-size: 13px; cursor: pointer; margin: 12px auto 0; }
      .acc-suppr-mini { background: #FBEAEA; border: 1px solid #E5B5B5; color: #A32D2D; border-radius: 6px; padding: 3px 10px; font-size: 11px; font-weight: 600; cursor: pointer; font-family: inherit; margin-top: 6px; }
      #acc-herofond-ctrl { position: absolute; top: 12px; left: 12px; z-index: 20; display: flex; gap: 8px; }
      #acc-herofond-ctrl button { background: rgba(0,20,60,0.8); color: #fff; border: none; border-radius: 8px; padding: 8px 14px; font-size: 12px; font-weight: 600; cursor: pointer; font-family: 'DM Sans',sans-serif; }
      .archive-photo-edit { position: relative; height: 220px; background: linear-gradient(135deg,#001F5C,#003DA5); display: flex; align-items: center; justify-content: center; cursor: pointer; overflow: hidden; color: #fff; }
      .archive-photo-edit img { width: 100%; height: 100%; object-fit: cover; }
      .archive-photo-edit .acc-photo-badge { position: absolute; bottom: 10px; right: 10px; background: rgba(0,20,60,0.75); color: #fff; font-size: 11px; padding: 5px 12px; border-radius: 8px; }
      .value-photo { width: 64px; height: 64px; border-radius: 14px; overflow: hidden; margin-bottom: 12px; cursor: pointer; }
      .value-photo img { width: 100%; height: 100%; object-fit: cover; }
      .acc-toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%) translateY(120px); background: #0F6E56; color: #fff; padding: 14px 24px; border-radius: 12px; font-size: 14px; font-weight: 600; z-index: 9999; transition: transform 0.35s; box-shadow: 0 8px 30px rgba(0,0,0,0.3); }
      .acc-toast.show { transform: translateX(-50%) translateY(0); }
      .acc-toast.error { background: #A32D2D; }
      .acc-modal-bg { display: none; position: fixed; inset: 0; background: rgba(0,20,60,0.55); z-index: 9800; align-items: center; justify-content: center; padding: 20px; }
      .acc-modal-bg.open { display: flex; }
      .acc-modal { background: #fff; border-radius: 16px; padding: 24px; max-width: 520px; width: 100%; font-family: 'DM Sans',sans-serif; }
      .acc-modal h3 { font-size: 16px; margin-bottom: 12px; color: #0D1B3E; }
      .acc-modal textarea { width: 100%; min-height: 110px; font-family: inherit; font-size: 15px; padding: 12px; border: 1.5px solid #E0E5F0; border-radius: 10px; margin-bottom: 14px; resize: vertical; }
      .acc-modal-actions { display: flex; gap: 10px; }
      .acc-modal-actions button { flex: 1; border: none; border-radius: 10px; padding: 12px; font-family: inherit; font-weight: 600; font-size: 14px; cursor: pointer; }
      .acc-modal-actions .acc-ok { background: #003DA5; color: #fff; }
      .acc-modal-actions .acc-cancel { background: #F4F6FB; color: #455A7A; }
    `;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ---------- DÉMARRAGE ----------
  function demarrer() {
    afficherToolbar();
    charger();
  }

  function init() {
    if (!config) return; // page non éditable, on ne fait rien
    injecterStyles();
    if (actif && token) {
      // On était déjà en mode édition (navigation entre pages)
      demarrer();
    } else {
      afficherBoutonModifier();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
