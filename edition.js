// ============================================================
//  edition.js — Éditeur unifié "sur le site" pour l'ACC
//  On garde le VRAI design ; on ajoute juste un contour léger
//  sur le modifiable. Le mode édition reste actif en naviguant.
// ============================================================

(function () {
  const REPO = 'accannes-cloud/site-acc';
  const OAUTH = 'https://decap-oauth.accannes.workers.dev';

  const PAGES = {
    'index.html':   { file: 'contenu/pages/accueil.json', type: 'accueil' },
    '':             { file: 'contenu/pages/accueil.json', type: 'accueil' },
    'le-club.html': { file: 'contenu/pages/histoire.json', type: 'histoire' }
  };

  const pageNom = window.location.pathname.split('/').pop() || 'index.html';
  const config = PAGES[pageNom] || null;

  let token = sessionStorage.getItem('acc_edit_token') || null;
  let actif = sessionStorage.getItem('acc_edit_actif') === '1';
  let data = null, sha = null, modif = false;

  function el(html) { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }
  function imgUrl(c) { if (!c) return ''; if (c.startsWith('http')) return c; return `https://raw.githubusercontent.com/${REPO}/main/${c}?t=${Date.now()}`; }
  function toast(msg, err) {
    let t = document.getElementById('acc-toast');
    if (!t) { t = el('<div id="acc-toast" class="acc-toast"></div>'); document.body.appendChild(t); }
    t.textContent = msg; t.className = 'acc-toast show' + (err ? ' error' : '');
    setTimeout(() => { t.className = 'acc-toast' + (err ? ' error' : ''); }, 4000);
  }
  function marquerModifie() { modif = true; const b = document.getElementById('acc-save'); if (b) b.disabled = false; }

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
          window.removeEventListener('message', handler);
          if (p) p.close();
          location.reload();
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

  async function charger() {
    try {
      const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${config.file}`, { headers: { 'Authorization': 'token ' + token } });
      if (res.status === 401) {
        sessionStorage.removeItem('acc_edit_token'); sessionStorage.removeItem('acc_edit_actif');
        toast('Session expirée, reconnecte-toi', true);
        setTimeout(() => location.reload(), 1500); return;
      }
      const json = await res.json();
      sha = json.sha;
      data = JSON.parse(decodeURIComponent(escape(atob(json.content))));
      rendre();
    } catch (e) { toast('Impossible de charger le contenu', true); }
  }

  function afficherToolbar(editable) {
    const bar = el(`
      <div id="acc-toolbar">
        <span class="acc-brand">✏️ Mode édition</span>
        <span class="acc-info">${editable ? 'Clique sur un élément surligné pour le modifier' : 'Cette page n\'est pas encore modifiable — va sur l\'Accueil ou l\'Histoire'}</span>
        <span style="margin-left:auto;"></span>
        ${editable ? '<button id="acc-save" disabled>💾 Enregistrer</button>' : ''}
        <button id="acc-quit">✕ Quitter le mode édition</button>
      </div>`);
    document.body.appendChild(bar);
    document.body.classList.add('acc-edit-mode');
    if (editable) document.getElementById('acc-save').onclick = sauvegarder;
    document.getElementById('acc-quit').onclick = quitter;
  }

  function afficherBoutonModifier() {
    const btn = el('<button id="acc-modif-btn">✏️ Modifier le site</button>');
    btn.onclick = login;
    document.body.appendChild(btn);
  }

  function modale(valeur, callback) {
    let bg = document.getElementById('acc-modal');
    if (!bg) {
      bg = el(`<div id="acc-modal" class="acc-modal-bg"><div class="acc-modal"><h3>Modifier le texte</h3><textarea id="acc-modal-input"></textarea><div class="acc-modal-actions"><button class="acc-cancel">Annuler</button><button class="acc-ok">Valider</button></div></div></div>`);
      document.body.appendChild(bg);
    }
    const input = bg.querySelector('#acc-modal-input');
    input.value = valeur || '';
    bg.classList.add('open'); input.focus();
    bg.querySelector('.acc-cancel').onclick = () => bg.classList.remove('open');
    bg.querySelector('.acc-ok').onclick = () => { callback(input.value); bg.classList.remove('open'); };
  }

  function editable(node, onClick) {
    if (!node) return;
    node.classList.add('acc-editable');
    node.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); onClick(); });
  }

  function choisirImage(callback, maxPx) {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        const img = new Image();
        img.onload = () => {
          const MAX = maxPx || 1000; let { width, height } = img;
          if (width > MAX || height > MAX) { if (width > height) { height = height*MAX/width; width = MAX; } else { width = width*MAX/height; height = MAX; } }
          const cv = document.createElement('canvas'); cv.width = width; cv.height = height;
          cv.getContext('2d').drawImage(img, 0, 0, width, height);
          envoyer(cv.toDataURL('image/jpeg', 0.85).split(',')[1], 'jpg', callback);
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
      if (file.size > 25*1024*1024) { toast('Vidéo trop lourde (max 25 Mo)', true); return; }
      toast('⏳ Envoi de la vidéo...');
      const reader = new FileReader();
      reader.onload = ev => envoyer(ev.target.result.split(',')[1], 'mp4', callback);
      reader.readAsDataURL(file);
    };
    input.click();
  }
  async function envoyer(base64, ext, callback) {
    if (ext !== 'mp4') toast('⏳ Envoi de la photo...');
    const chemin = 'images/uploads/f-' + Date.now() + '.' + ext;
    try {
      const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${chemin}`, {
        method: 'PUT', headers: { 'Authorization': 'token ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Ajout média via éditeur', content: base64 })
      });
      if (!res.ok) throw new Error();
      callback(chemin); toast('✓ Média ajouté');
    } catch (e) { toast('Erreur d\'envoi (fichier trop lourd ?)', true); }
  }

  async function sauvegarder() {
    const b = document.getElementById('acc-save');
    b.disabled = true; b.textContent = '⏳ Enregistrement...';
    try {
      const contenu = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));
      const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${config.file}`, {
        method: 'PUT', headers: { 'Authorization': 'token ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Modification via éditeur', content: contenu, sha: sha })
      });
      if (!res.ok) throw new Error();
      sha = (await res.json()).content.sha;
      modif = false; b.textContent = '💾 Enregistrer';
      toast('✓ Enregistré ! Le site se met à jour dans 1 minute.');
    } catch (e) { b.disabled = false; b.textContent = '💾 Enregistrer'; toast('Erreur lors de l\'enregistrement', true); }
  }

  function boutonPhoto(cible, onClick, label) {
    if (!cible) return;
    const b = el(`<button class="acc-photo-fab">${label || '📷'}</button>`);
    b.onclick = (e) => { e.preventDefault(); e.stopPropagation(); onClick(); };
    if (getComputedStyle(cible).position === 'static') cible.style.position = 'relative';
    cible.appendChild(b);
  }
  function badgeSuppr(cible, onClick) {
    if (!cible) return;
    const b = el('<button class="acc-suppr-badge">✕</button>');
    b.onclick = (e) => { e.preventDefault(); e.stopPropagation(); onClick(); };
    if (getComputedStyle(cible).position === 'static') cible.style.position = 'relative';
    cible.appendChild(b);
  }
  function boutonAjout(apres, label, onClick) {
    const b = el(`<button class="acc-ajout">${label}</button>`);
    b.onclick = onClick;
    apres.parentElement.insertBefore(b, apres.nextSibling);
  }

  function rendre() {
    if (config.type === 'accueil') rendreAccueil();
    else if (config.type === 'histoire') rendreHistoire();
  }

  function rendreAccueil() {
    document.querySelectorAll('[data-accueil]').forEach(node => {
      const key = node.getAttribute('data-accueil');
      if (data[key] !== undefined) node.textContent = data[key];
      editable(node, () => modale(data[key], v => { data[key] = v; node.textContent = v; marquerModifie(); }));
    });

    const statsBox = document.querySelector('[data-accueil-stats]');
    if (statsBox && Array.isArray(data.stats)) {
      statsBox.innerHTML = data.stats.map(s => `<div class="stat-item"><div class="stat-number" data-target="${s.nombre}">${s.nombre}</div><div class="stat-label">${s.label}</div></div>`).join('');
      statsBox.querySelectorAll('.stat-item').forEach((item, i) => {
        editable(item.querySelector('.stat-number'), () => modale(data.stats[i].nombre, v => { data.stats[i].nombre = v; item.querySelector('.stat-number').textContent = v; marquerModifie(); }));
        editable(item.querySelector('.stat-label'), () => modale(data.stats[i].label, v => { data.stats[i].label = v; item.querySelector('.stat-label').textContent = v; marquerModifie(); }));
      });
    }

    const valBox = document.querySelector('[data-accueil-valeurs]');
    if (valBox && Array.isArray(data.valeurs)) {
      valBox.innerHTML = data.valeurs.map(v => {
        const visuel = v.photo ? `<div class="value-photo"><img src="${imgUrl(v.photo)}" alt=""></div>` : `<div class="value-icon">${v.icone || '📷'}</div>`;
        return `<div class="value-card visible">${visuel}<div class="value-title">${v.titre||''}</div><div class="value-text">${v.texte||''}</div></div>`;
      }).join('');
      valBox.querySelectorAll('.value-card').forEach((card, i) => {
        editable(card.querySelector('.value-title'), () => modale(data.valeurs[i].titre, v => { data.valeurs[i].titre = v; card.querySelector('.value-title').textContent = v; marquerModifie(); }));
        editable(card.querySelector('.value-text'), () => modale(data.valeurs[i].texte, v => { data.valeurs[i].texte = v; card.querySelector('.value-text').textContent = v; marquerModifie(); }));
        const vis = card.querySelector('.value-photo, .value-icon');
        boutonPhoto(vis, () => choisirImage(c => { data.valeurs[i].photo = c; marquerModifie(); rendreAccueil(); }));
        if (data.valeurs[i].photo) badgeSuppr(vis, () => { data.valeurs[i].photo = ''; marquerModifie(); rendreAccueil(); });
      });
    }

    const discGrid = document.querySelector('.disc-grid');
    if (discGrid && Array.isArray(data.disciplines)) {
      const couleurs = ['bleu','bleu2','bleu3','navy','bleu'];
      discGrid.innerHTML = data.disciplines.map((d, i) => {
        const fond = d.photo ? `style="background-image:url('${imgUrl(d.photo)}');background-size:cover;background-position:center;font-size:0;"` : '';
        return `<a href="${d.lien||'#'}" class="disc-card visible" data-color="${couleurs[i%5]}">
          <div class="disc-bg" ${fond}>${d.photo?'':(d.emoji||'')}</div>
          <div class="disc-overlay"></div>
          <div class="disc-content"><span class="disc-tag">${d.tag||''}</span><div class="disc-name">${d.nom||''}</div><p class="disc-desc">${d.desc||''}</p><span class="disc-arrow">Découvrir →</span></div>
        </a>`;
      }).join('');
      discGrid.querySelectorAll('.disc-card').forEach((card, i) => {
        card.addEventListener('click', e => e.preventDefault());
        editable(card.querySelector('.disc-tag'), () => modale(data.disciplines[i].tag, v => { data.disciplines[i].tag = v; card.querySelector('.disc-tag').textContent = v; marquerModifie(); }));
        editable(card.querySelector('.disc-name'), () => modale(data.disciplines[i].nom, v => { data.disciplines[i].nom = v; card.querySelector('.disc-name').textContent = v; marquerModifie(); }));
        editable(card.querySelector('.disc-desc'), () => modale(data.disciplines[i].desc, v => { data.disciplines[i].desc = v; card.querySelector('.disc-desc').textContent = v; marquerModifie(); }));
        const bg = card.querySelector('.disc-bg');
        boutonPhoto(bg, () => choisirImage(c => { data.disciplines[i].photo = c; marquerModifie(); rendreAccueil(); }, 1000), '📷 Fond');
        if (data.disciplines[i].photo) badgeSuppr(bg, () => { data.disciplines[i].photo = ''; marquerModifie(); rendreAccueil(); });
      });
    }

    const sponsBox = document.querySelector('[data-accueil-sponsors]');
    if (sponsBox && Array.isArray(data.sponsors)) {
      sponsBox.innerHTML = data.sponsors.map(s => s.logo
        ? `<div class="part-logo"><img src="${imgUrl(s.logo)}" style="max-height:44px;max-width:120px;object-fit:contain;"></div>`
        : `<div class="part-logo">${s.nom||''}</div>`).join('');
      sponsBox.querySelectorAll('.part-logo').forEach((logo, i) => {
        if (!data.sponsors[i].logo) editable(logo, () => modale(data.sponsors[i].nom, v => { data.sponsors[i].nom = v; logo.textContent = v; marquerModifie(); }));
        boutonPhoto(logo, () => choisirImage(c => { data.sponsors[i].logo = c; marquerModifie(); rendreAccueil(); }, 400), '📷');
        badgeSuppr(logo, () => { if (confirm('Supprimer ce sponsor ?')) { data.sponsors.splice(i,1); marquerModifie(); rendreAccueil(); } });
      });
      if (!sponsBox.parentElement.querySelector('.acc-ajout')) {
        boutonAjout(sponsBox, '➕ Ajouter un sponsor', () => { data.sponsors.push({ nom:'Nouveau', logo:'' }); marquerModifie(); rendreAccueil(); });
      }
    }

    const heroFond = document.querySelector('[data-accueil-herofond]');
    if (heroFond) {
      const lignes = heroFond.querySelector('.track-lines');
      const lignesHtml = lignes ? lignes.outerHTML : '';
      if (data.hero_fond_video) heroFond.innerHTML = `<video autoplay muted loop playsinline style="width:100%;height:100%;object-fit:cover;opacity:0.5;"><source src="${imgUrl(data.hero_fond_video)}" type="video/mp4"></video>` + lignesHtml;
      else if (data.hero_fond_image) heroFond.innerHTML = `<img src="${imgUrl(data.hero_fond_image)}" style="width:100%;height:100%;object-fit:cover;opacity:0.5;">` + lignesHtml;
      if (!document.getElementById('acc-herofond-ctrl')) {
        const ctrl = el(`<div id="acc-herofond-ctrl"><button id="acc-hero-img">📷 Image de fond</button><button id="acc-hero-vid">🎬 Vidéo de fond</button></div>`);
        (heroFond.parentElement || heroFond).appendChild(ctrl);
        ctrl.querySelector('#acc-hero-img').onclick = () => choisirImage(c => { data.hero_fond_image = c; data.hero_fond_video = ''; marquerModifie(); rendreAccueil(); }, 1600);
        ctrl.querySelector('#acc-hero-vid').onclick = () => choisirVideo(c => { data.hero_fond_video = c; data.hero_fond_image = ''; marquerModifie(); rendreAccueil(); });
      }
    }
  }

  function rendreHistoire() {
    document.querySelectorAll('[data-histoire]').forEach(node => {
      const key = node.getAttribute('data-histoire');
      if (data[key] !== undefined) node.textContent = data[key];
      editable(node, () => modale(data[key], v => { data[key] = v; node.textContent = v; marquerModifie(); }));
    });

    const body = document.querySelector('[data-histoire-body]');
    if (body) {
      let html = '';
      const paras = data.paragraphes || [], photos = data.photos || [];
      if (paras[0]) html += `<p data-hp="0">${paras[0].texte}</p>`;
      if (paras[1]) html += `<p data-hp="1">${paras[1].texte}</p>`;
      if (paras[2]) html += `<p data-hp="2">${paras[2].texte}</p>`;
      if (photos[0]) html += photoBloc(0);
      if (data.citation) html += `<div class="pull-quote" data-hcit><p>${data.citation}</p></div>`;
      if (paras[3]) html += `<p data-hp="3">${paras[3].texte}</p>`;
      if (photos[1]) html += photoBloc(1);
      for (let i = 4; i < paras.length; i++) html += `<p data-hp="${i}">${paras[i].texte}</p>`;
      body.innerHTML = html;

      body.querySelectorAll('[data-hp]').forEach(node => {
        const i = node.getAttribute('data-hp');
        editable(node, () => modale(data.paragraphes[i].texte, v => { data.paragraphes[i].texte = v; node.textContent = v; marquerModifie(); }));
        badgeSuppr(node, () => { data.paragraphes.splice(i,1); marquerModifie(); rendreHistoire(); });
      });
      const cit = body.querySelector('[data-hcit]');
      if (cit) editable(cit, () => modale(data.citation, v => { data.citation = v; cit.querySelector('p').textContent = v; marquerModifie(); }));
      body.querySelectorAll('[data-photo-index]').forEach(ph => {
        const i = ph.getAttribute('data-photo-index');
        const zone = ph.querySelector('.acc-photo-zone');
        boutonPhoto(zone, () => choisirImage(c => { data.photos[i].image = c; marquerModifie(); rendreHistoire(); }, 1200), '📷 Changer');
        editable(ph.querySelector('.archive-caption'), () => modale(data.photos[i].legende, v => { data.photos[i].legende = v; ph.querySelector('.archive-caption').textContent = v; marquerModifie(); }));
        badgeSuppr(zone, () => { data.photos.splice(i,1); marquerModifie(); rendreHistoire(); });
      });
      boutonAjout(body, '➕ Ajouter un paragraphe', () => { if(!data.paragraphes)data.paragraphes=[]; data.paragraphes.push({texte:'Nouveau paragraphe.'}); marquerModifie(); rendreHistoire(); });
      boutonAjout(body, '➕ Ajouter une photo', () => { if(!data.photos)data.photos=[]; data.photos.push({image:'',legende:'Légende'}); marquerModifie(); rendreHistoire(); });
    }

    const tl = document.querySelector('[data-histoire-timeline]');
    if (tl) {
      tl.innerHTML = (data.chronologie||[]).map((c,i) => `<div class="tl-item"><div class="tl-year" data-hcy="${i}">${c.annee}</div><div class="tl-text" data-hct="${i}">${c.texte}</div></div>`).join('');
      tl.querySelectorAll('.tl-item').forEach((item, i) => {
        editable(item.querySelector('[data-hcy]'), () => modale(data.chronologie[i].annee, v => { data.chronologie[i].annee = v; item.querySelector('[data-hcy]').textContent = v; marquerModifie(); }));
        editable(item.querySelector('[data-hct]'), () => modale(data.chronologie[i].texte, v => { data.chronologie[i].texte = v; item.querySelector('[data-hct]').textContent = v; marquerModifie(); }));
        badgeSuppr(item, () => { data.chronologie.splice(i,1); marquerModifie(); rendreHistoire(); });
      });
      boutonAjout(tl, '➕ Ajouter une date', () => { if(!data.chronologie)data.chronologie=[]; data.chronologie.push({annee:'ANNÉE',texte:'Événement.'}); marquerModifie(); rendreHistoire(); });
    }
  }

  function photoBloc(i) {
    const p = (data.photos||[])[i]; if (!p) return '';
    const inner = p.image ? `<img src="${imgUrl(p.image)}" alt="" style="width:100%;height:100%;object-fit:cover;">` : '📷 Ajouter une photo';
    return `<div class="archive-photo" data-photo-index="${i}"><div class="acc-photo-zone">${inner}</div><div class="archive-caption">${p.legende||''}</div></div>`;
  }

  function injecterStyles() {
    const css = `
      #acc-modif-btn { position: fixed; bottom: 20px; right: 20px; z-index: 9000; background: #001F5C; color: #FFD600; border: none; border-radius: 100px; padding: 12px 22px; font-family: 'DM Sans',sans-serif; font-weight: 600; font-size: 14px; cursor: pointer; box-shadow: 0 6px 24px rgba(0,31,92,0.35); }
      #acc-toolbar { position: sticky; top: 0; z-index: 9500; display: flex; align-items: center; gap: 14px; background: #001F5C; padding: 10px 18px; box-shadow: 0 2px 14px rgba(0,0,0,0.25); flex-wrap: wrap; }
      #acc-toolbar .acc-brand { color: #FFD600; font-weight: 600; font-size: 14px; }
      #acc-toolbar .acc-info { color: #B5D4F4; font-size: 12px; }
      #acc-toolbar button { border: none; border-radius: 8px; padding: 8px 16px; font-family: inherit; font-weight: 600; font-size: 13px; cursor: pointer; }
      #acc-save { background: #FFD600; color: #001F5C; }
      #acc-save:disabled { opacity: 0.5; cursor: not-allowed; }
      #acc-quit { background: rgba(255,255,255,0.14); color: #fff; }
      body.acc-edit-mode .acc-editable { outline: 2px dashed rgba(255,214,0,0.9); outline-offset: 2px; cursor: pointer; border-radius: 3px; }
      body.acc-edit-mode .acc-editable:hover { background: rgba(255,214,0,0.18); }
      .acc-photo-fab { position: absolute; top: 6px; right: 6px; z-index: 20; background: rgba(0,20,60,0.82); color: #fff; border: none; border-radius: 8px; padding: 5px 10px; font-size: 11px; font-weight: 600; cursor: pointer; font-family: 'DM Sans',sans-serif; }
      .acc-suppr-badge { position: absolute; top: -8px; right: -8px; z-index: 21; width: 22px; height: 22px; border-radius: 50%; background: #A32D2D; color: #fff; border: none; font-size: 11px; cursor: pointer; }
      .acc-ajout { display: inline-block; background: #003DA5; color: #fff; border: none; border-radius: 10px; padding: 10px 18px; font-family: 'DM Sans',sans-serif; font-weight: 600; font-size: 13px; cursor: pointer; margin: 16px auto; }
      #acc-herofond-ctrl { position: absolute; top: 12px; left: 12px; z-index: 30; display: flex; gap: 8px; }
      #acc-herofond-ctrl button { background: rgba(0,20,60,0.82); color: #fff; border: none; border-radius: 8px; padding: 8px 14px; font-size: 12px; font-weight: 600; cursor: pointer; font-family: 'DM Sans',sans-serif; }
      .acc-photo-zone { position: relative; height: 220px; background: linear-gradient(135deg,#001F5C,#003DA5); display: flex; align-items: center; justify-content: center; color: #fff; cursor: pointer; overflow: hidden; border-radius: 10px; }
      .acc-toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%) translateY(120px); background: #0F6E56; color: #fff; padding: 14px 24px; border-radius: 12px; font-size: 14px; font-weight: 600; z-index: 9999; transition: transform 0.35s; box-shadow: 0 8px 30px rgba(0,0,0,0.3); }
      .acc-toast.show { transform: translateX(-50%) translateY(0); }
      .acc-toast.error { background: #A32D2D; }
      .acc-modal-bg { display: none; position: fixed; inset: 0; background: rgba(0,20,60,0.55); z-index: 9800; align-items: center; justify-content: center; padding: 20px; }
      .acc-modal-bg.open { display: flex; }
      .acc-modal { background: #fff; border-radius: 16px; padding: 24px; max-width: 520px; width: 100%; font-family: 'DM Sans',sans-serif; }
      .acc-modal h3 { font-size: 16px; margin-bottom: 12px; color: #0D1B3E; }
      .acc-modal textarea { width: 100%; min-height: 110px; font-family: inherit; font-size: 15px; padding: 12px; border: 1.5px solid #E0E5F0; border-radius: 10px; margin-bottom: 14px; resize: vertical; }
      .acc-modal-actions { display: flex; gap: 10px; }
      .acc-modal-actions button { flex: 1; border: none; border-radius: 10px; padding: 12px; font-weight: 600; font-size: 14px; cursor: pointer; font-family: inherit; }
      .acc-modal-actions .acc-ok { background: #003DA5; color: #fff; }
      .acc-modal-actions .acc-cancel { background: #F4F6FB; color: #455A7A; }
      .value-photo { width: 64px; height: 64px; border-radius: 14px; overflow: hidden; margin-bottom: 12px; }
      .value-photo img { width: 100%; height: 100%; object-fit: cover; }
    `;
    const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
  }

  function init() {
    injecterStyles();
    if (actif && token) {
      afficherToolbar(!!config);
      if (config) charger();
    } else if (config) {
      afficherBoutonModifier();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
