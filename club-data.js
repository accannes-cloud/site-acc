// ============================================================
//  club-data.js — Contenu modifiable du site ACC
//  Ce script lit les fichiers modifiés via le CMS et les
//  injecte automatiquement dans toutes les pages du site.
//  Architecture : un seul fichier partagé par toutes les pages.
// ============================================================

(function () {
  const REPO = 'accannes-cloud/site-acc';
  const BRANCH = 'main';
  const RAW = `https://raw.githubusercontent.com/${REPO}/${BRANCH}`;

  // Récupère un JSON via raw (aucune limite de requêtes pour les visiteurs).
  // Un paramètre anti-cache qui change chaque minute limite le délai d'affichage.
  async function getJSON(path) {
    try {
      const buster = Math.floor(Date.now() / 60000);
      const res = await fetch(`${RAW}/${path}?v=${buster}`, { cache: 'no-store' });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  }

  // ========== 1. COORDONNÉES DU CLUB ==========
  // Injecte dans tout élément ayant un attribut data-club="..."
  async function injectCoordonnees() {
    const data = await getJSON('contenu/reglages/coordonnees.json');
    if (!data) return;

    // Texte simple : <span data-club="telephone"></span>
    document.querySelectorAll('[data-club]').forEach(el => {
      const key = el.getAttribute('data-club');
      if (data[key] !== undefined && data[key] !== '') {
        el.textContent = data[key];
      }
    });

    // Liens téléphone : <a data-club-tel></a>
    document.querySelectorAll('[data-club-tel]').forEach(el => {
      if (data.telephone) {
        el.textContent = data.telephone;
        el.href = 'tel:' + data.telephone.replace(/\s/g, '');
      }
    });

    // Liens email : <a data-club-email></a>
    document.querySelectorAll('[data-club-email]').forEach(el => {
      if (data.email) {
        el.textContent = data.email;
        el.href = 'mailto:' + data.email;
      }
    });

    // Adresse : <span data-club-adresse></span>
    document.querySelectorAll('[data-club-adresse]').forEach(el => {
      if (data.adresse) el.textContent = data.adresse;
    });
  }

  // ========== 2. HORAIRES D'ENTRAÎNEMENT ==========
  // Injecte dans <div data-horaires="running"></div> (ou sante, jeune, piste)
  async function injectHoraires() {
    const conteneurs = document.querySelectorAll('[data-horaires]');
    for (const conteneur of conteneurs) {
      const discipline = conteneur.getAttribute('data-horaires');
      const data = await getJSON(`contenu/horaires/${discipline}.json`);
      if (!data || !data.creneaux || data.creneaux.length === 0) continue;

      let html = '<div class="horaires-table">';
      data.creneaux.forEach(c => {
        const details = [];
        if (c.groupe) details.push('<span class="horaire-groupe">' + c.groupe + '</span>');
        if (c.categorie) details.push('<span class="horaire-cat">' + c.categorie + '</span>');
        html += `
          <div class="horaire-row">
            <div class="horaire-jour">${c.jour || ''}</div>
            <div class="horaire-heure">${c.horaire || ''}</div>
            <div class="horaire-detail">
              ${details.join('')}
              ${c.lieu ? '<span class="horaire-lieu">📍 ' + c.lieu + '</span>' : ''}
              ${c.coach ? '<span class="horaire-coach">👤 ' + c.coach + '</span>' : ''}
            </div>
          </div>`;
      });
      html += '</div>';
      conteneur.innerHTML = html;
    }
  }

  // ========== 3. ÉQUIPE / BUREAU ==========
  // Bureau : <div data-equipe="bureau"></div>
  // Entraîneurs par catégorie : <div data-equipe-entraineurs></div>
  async function injectEquipe() {
    // --- Bureau (liste simple) ---
    const conteneursBureau = document.querySelectorAll('[data-equipe="bureau"]');
    for (const conteneur of conteneursBureau) {
      const data = await getJSON('contenu/equipe/bureau.json');
      if (!data || !data.membres || data.membres.length === 0) continue;
      let html = '';
      data.membres.forEach(m => {
        const initiales = (m.nom || '?').split(' ').map(x => x[0]).join('').substring(0, 2).toUpperCase();
        html += `
          <div class="equipe-card-dyn">
            <div class="equipe-avatar-dyn">${m.photo ? '<img src="' + m.photo + '" alt="' + (m.nom || '') + '">' : initiales}</div>
            <div class="equipe-info-dyn">
              <h4>${m.nom || ''}</h4>
              <p>${m.role || ''}</p>
            </div>
          </div>`;
      });
      conteneur.innerHTML = html;
    }

    // --- Entraîneurs (liste simple regroupée par catégorie à l'affichage) ---
    const conteneursCoachs = document.querySelectorAll('[data-equipe-entraineurs]');
    for (const conteneur of conteneursCoachs) {
      const data = await getJSON('contenu/equipe/entraineurs.json');
      if (!data || !data.entraineurs || data.entraineurs.length === 0) continue;

      // Définition des catégories : ordre d'affichage + icône + description
      const categories = [
        { nom: 'BABY ATHLÉ', icone: '👶', sous: "Les tout-petits, premiers pas dans l'athlétisme" },
        { nom: 'ÉVEIL ATHLÉTISME', icone: '🌱', sous: 'Découverte ludique et motricité' },
        { nom: 'POUSSINS', icone: '🏃', sous: 'Premières disciplines athlétiques' },
        { nom: 'BENJAMINS / MINIMES', icone: '⚡', sous: 'Vers la spécialisation et la compétition' },
        { nom: 'CADETS ET +', icone: '🥇', sous: 'Spécialisation par discipline & haut niveau' },
        { nom: 'ATHLÉ SANTÉ & BIEN-ÊTRE', icone: '❤️', sous: 'Marche, fitness et pratique santé pour tous' }
      ];

      let html = '';
      categories.forEach(cat => {
        const coachs = data.entraineurs.filter(e => (e.categorie || '') === cat.nom);
        if (coachs.length === 0) return; // on n'affiche pas une catégorie vide
        let cards = '';
        coachs.forEach(c => {
          const nomComplet = ((c.prenom || '') + ' ' + (c.nom || '')).trim();
          const initiales = ((c.prenom || '?')[0] + (c.nom || '')[0] || '?').toUpperCase();
          const photoHtml = c.photo
            ? `<img src="${c.photo}" alt="${nomComplet}" style="width:100%;height:100%;object-fit:cover;">`
            : `<div class="coach-initials">${initiales}</div>`;
          cards += `
            <div class="coach-card-dyn">
              <div class="coach-photo-dyn">${photoHtml}</div>
              <div class="coach-name-dyn">${nomComplet}</div>
            </div>`;
        });
        html += `
          <div class="coach-group-dyn">
            <div class="coach-group-head-dyn">
              <div class="coach-group-icon-dyn">${cat.icone}</div>
              <div class="coach-group-text-dyn">
                <div class="coach-group-title-dyn">${cat.nom}</div>
                <div class="coach-group-sub-dyn">${cat.sous}</div>
              </div>
              <div class="coach-group-count-dyn">${coachs.length} coach${coachs.length > 1 ? 's' : ''}</div>
            </div>
            <div class="coach-grid-dyn">${cards}</div>
          </div>`;
      });
      conteneur.innerHTML = html;
    }
  }

  // ========== 4. PAGE D'ACCUEIL (textes modifiables) ==========
  async function injectAccueil() {
    // On n'agit que si la page contient des éléments d'accueil
    if (!document.querySelector('[data-accueil], [data-accueil-stats], [data-accueil-valeurs]')) return;
    const data = await getJSON('contenu/pages/accueil.json');
    if (!data) return;

    // Textes simples
    document.querySelectorAll('[data-accueil]').forEach(el => {
      const key = el.getAttribute('data-accueil');
      if (data[key] !== undefined && data[key] !== '') {
        el.textContent = data[key];
      }
    });

    // Bande de statistiques
    const statsBar = document.querySelector('[data-accueil-stats]');
    if (statsBar && Array.isArray(data.stats) && data.stats.length > 0) {
      statsBar.innerHTML = data.stats.map(s => `
        <div class="stat-item">
          <div class="stat-number" data-target="${s.nombre}">${s.nombre}</div>
          <div class="stat-label">${s.label}</div>
        </div>`).join('');
    }

    // Cartes de valeurs
    const valeursBox = document.querySelector('[data-accueil-valeurs]');
    if (valeursBox && Array.isArray(data.valeurs) && data.valeurs.length > 0) {
      valeursBox.innerHTML = data.valeurs.map((v, i) => {
        const visuel = v.photo
          ? `<div class="value-photo"><img src="${v.photo}" alt="${v.titre || ''}"></div>`
          : `<div class="value-icon">${v.icone || ''}</div>`;
        return `
        <div class="value-card reveal reveal-delay-${(i % 4) + 1} visible">
          ${visuel}
          <div class="value-title">${v.titre || ''}</div>
          <div class="value-text">${v.texte || ''}</div>
        </div>`;
      }).join('');
    }

    // Fond du hero : vidéo (prioritaire) ou image
    const heroFond = document.querySelector('[data-accueil-herofond]');
    if (heroFond) {
      const lignes = heroFond.querySelector('.track-lines');
      const lignesHtml = lignes ? lignes.outerHTML : '';
      if (data.hero_fond_video) {
        heroFond.innerHTML = `<video autoplay muted loop playsinline style="width:100%;height:100%;object-fit:cover;opacity:0.5;"><source src="${data.hero_fond_video}" type="video/mp4"></video>` + lignesHtml;
      } else if (data.hero_fond_image) {
        heroFond.innerHTML = `<img src="${data.hero_fond_image}" alt="Athletic Club de Cannes" style="width:100%;height:100%;object-fit:cover;opacity:0.5;">` + lignesHtml;
      }
    }

    // Cartes disciplines (spécifiques à l'accueil)
    const discBox = document.querySelector('[data-accueil-disciplines]');
    if (discBox && Array.isArray(data.disciplines) && data.disciplines.length > 0) {
      discBox.innerHTML = data.disciplines.map((d, i) => {
        const fond = d.photo
          ? `<div class="disc-bg" style="background-image:url(${d.photo});background-size:cover;background-position:center;"></div>`
          : `<div class="disc-bg">${d.emoji || ''}</div>`;
        return `
        <a href="${d.lien || '#'}" class="disc-card reveal${i > 0 ? ' reveal-delay-' + i : ''}" data-color="${d.couleur || 'bleu'}">
          ${fond}
          <div class="disc-overlay"></div>
          <div class="disc-content">
            <span class="disc-tag">${d.tag || ''}</span>
            <div class="disc-name">${d.nom || ''}</div>
            <p class="disc-desc">${d.desc || ''}</p>
            <span class="disc-arrow">Découvrir →</span>
          </div>
        </a>`;
      }).join('');
    }

    // Bande des sponsors / partenaires
    const sponsorsBox = document.querySelector('[data-accueil-sponsors]');
    if (sponsorsBox && Array.isArray(data.sponsors) && data.sponsors.length > 0) {
      sponsorsBox.innerHTML = data.sponsors.map(s => {
        if (s.logo) {
          return `<div class="part-logo"><img src="${s.logo}" alt="${s.nom || ''}" style="max-height:44px;max-width:120px;object-fit:contain;"></div>`;
        }
        return `<div class="part-logo">${s.nom || ''}</div>`;
      }).join('');
    }

    // Fond du hero : vidéo prioritaire, sinon image personnalisée, sinon rien (garde le défaut)
    const heroFond = document.querySelector('[data-accueil-herofond]');
    if (heroFond) {
      if (data.hero_fond_video) {
        heroFond.innerHTML = `<video autoplay muted loop playsinline style="width:100%;height:100%;object-fit:cover;opacity:0.55;"><source src="${data.hero_fond_video}" type="video/mp4"></video>`;
      } else if (data.hero_fond_image) {
        heroFond.innerHTML = `<img src="${data.hero_fond_image}" alt="" style="width:100%;height:100%;object-fit:cover;opacity:0.5;">`;
      }
    }

    // Cartes disciplines (fond photo + textes, modifiables depuis l'accueil)
    const discGrid = document.querySelector('.disc-grid');
    if (discGrid && Array.isArray(data.disciplines) && data.disciplines.length > 0) {
      const couleurs = ['bleu', 'bleu2', 'bleu3', 'navy', 'bleu'];
      discGrid.innerHTML = data.disciplines.map((d, i) => {
        const fondStyle = d.photo
          ? `style="background-image:url('${d.photo}');background-size:cover;background-position:center;font-size:0;"`
          : '';
        return `
        <a href="${d.lien || '#'}" class="disc-card reveal visible" data-color="${couleurs[i % 5]}">
          <div class="disc-bg" data-disc-index="${i}" ${fondStyle}>${d.photo ? '' : (d.emoji || '')}</div>
          <div class="disc-overlay"></div>
          <div class="disc-content">
            <span class="disc-tag">${d.tag || ''}</span>
            <div class="disc-name">${d.nom || ''}</div>
            <p class="disc-desc">${d.desc || ''}</p>
            <span class="disc-arrow">Découvrir →</span>
          </div>
        </a>`;
      }).join('');
    }
  }

  // ========== 5. PAGE HISTOIRE DU CLUB ==========
  async function injectHistoire() {
    if (!document.querySelector('[data-histoire], [data-histoire-body], [data-histoire-timeline]')) return;
    const data = await getJSON('contenu/pages/histoire.json');
    if (!data) return;

    // Textes simples (eyebrow, titre, intro)
    document.querySelectorAll('[data-histoire]').forEach(el => {
      const key = el.getAttribute('data-histoire');
      if (data[key]) el.textContent = data[key];
    });

    // Corps : paragraphes + photos + citation, dans l'ordre d'origine
    const body = document.querySelector('[data-histoire-body]');
    if (body) {
      let html = '';
      const paras = data.paragraphes || [];
      const photos = data.photos || [];

      if (paras[0]) html += `<p class="reveal visible">${paras[0].texte}</p>`;
      if (paras[1]) html += `<p class="reveal visible">${paras[1].texte}</p>`;
      if (paras[2]) html += `<p class="reveal visible">${paras[2].texte}</p>`;
      if (photos[0]) html += photoHtml(photos[0]);
      if (data.citation) html += `<div class="pull-quote reveal visible"><p>${data.citation}</p></div>`;
      if (paras[3]) html += `<p class="reveal visible">${paras[3].texte}</p>`;
      if (photos[1]) html += photoHtml(photos[1]);
      for (let i = 4; i < paras.length; i++) html += `<p class="reveal visible">${paras[i].texte}</p>`;

      body.innerHTML = html;
    }

    // Chronologie
    const tl = document.querySelector('[data-histoire-timeline]');
    if (tl && Array.isArray(data.chronologie)) {
      tl.innerHTML = data.chronologie.map(c => `
        <div class="tl-item reveal visible">
          <div class="tl-year">${c.annee || ''}</div>
          <div class="tl-text">${c.texte || ''}</div>
        </div>`).join('');
    }
  }

  function photoHtml(p) {
    return `
      <div class="archive-photo reveal visible">
        <img src="${p.image}" alt="">
        ${p.legende ? '<div class="archive-caption">' + p.legende + '</div>' : ''}
      </div>`;
  }

  // Styles minimaux injectés pour les horaires et l'équipe dynamiques
  function injectStyles() {
    const css = `
      .value-photo { width: 64px; height: 64px; border-radius: 14px; overflow: hidden; margin-bottom: 12px; background: var(--gris-clair, #F4F6FB); }
      .value-photo img { width: 100%; height: 100%; object-fit: cover; }
      .horaires-table { display: flex; flex-direction: column; gap: 10px; margin-top: 24px; }
      .horaire-row { display: grid; grid-template-columns: 140px 160px 1fr; gap: 16px; align-items: center; background: var(--blanc, #fff); border-radius: 12px; padding: 16px 22px; box-shadow: 0 4px 18px rgba(0,31,92,0.06); border-left: 4px solid var(--jaune, #FFD600); }
      .horaire-jour { font-family: 'Bebas Neue', sans-serif; font-size: 20px; letter-spacing: 1px; color: var(--bleu, #003DA5); }
      .horaire-heure { font-weight: 600; color: var(--texte, #0D1B3E); font-size: 15px; }
      .horaire-detail { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
      .horaire-groupe { background: rgba(0,61,165,0.08); color: var(--bleu, #003DA5); font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 100px; }
      .horaire-cat { background: rgba(255,214,0,0.2); color: #8a6d00; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 100px; }
      .horaire-lieu { font-size: 13px; color: var(--texte-doux, #455A7A); }
      .horaire-coach { font-size: 13px; color: var(--texte-doux, #455A7A); font-weight: 600; }
      @media (max-width: 700px) { .horaire-row { grid-template-columns: 1fr; gap: 6px; text-align: left; } }
      .equipe-card-dyn { display: flex; align-items: center; gap: 16px; background: var(--blanc, #fff); border-radius: 14px; padding: 18px 22px; box-shadow: 0 4px 18px rgba(0,31,92,0.06); }
      .equipe-avatar-dyn { width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, #001F5C, #003DA5); color: #FFD600; display: flex; align-items: center; justify-content: center; font-family: 'Bebas Neue', sans-serif; font-size: 22px; flex-shrink: 0; overflow: hidden; }
      .equipe-avatar-dyn img { width: 100%; height: 100%; object-fit: cover; }
      .equipe-info-dyn h4 { font-size: 16px; font-weight: 600; margin-bottom: 3px; color: var(--texte, #0D1B3E); }
      .equipe-info-dyn p { font-size: 13px; color: var(--bleu, #003DA5); font-weight: 600; }
      .coach-group-dyn { margin-bottom: 40px; }
      .coach-group-head-dyn { display: flex; align-items: center; gap: 16px; margin-bottom: 20px; padding-bottom: 14px; border-bottom: 2px solid #EEF1F8; }
      .coach-group-icon-dyn { width: 52px; height: 52px; border-radius: 14px; background: linear-gradient(135deg, #001F5C, #003DA5); display: flex; align-items: center; justify-content: center; font-size: 24px; flex-shrink: 0; }
      .coach-group-text-dyn { flex: 1; }
      .coach-group-title-dyn { font-family: 'Bebas Neue', sans-serif; font-size: 24px; letter-spacing: 1px; color: var(--bleu, #003DA5); line-height: 1.1; }
      .coach-group-sub-dyn { font-size: 13px; color: var(--texte-doux, #455A7A); margin-top: 2px; }
      .coach-group-count-dyn { background: var(--jaune, #FFD600); color: var(--bleu-fonce, #001F5C); font-size: 12px; font-weight: 700; padding: 6px 14px; border-radius: 100px; white-space: nowrap; }
      .coach-grid-dyn { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 16px; }
      .coach-card-dyn { background: var(--blanc, #fff); border-radius: 14px; padding: 18px; text-align: center; box-shadow: 0 4px 18px rgba(0,31,92,0.06); transition: transform 0.2s; }
      .coach-card-dyn:hover { transform: translateY(-4px); }
      .coach-photo-dyn { width: 72px; height: 72px; border-radius: 50%; margin: 0 auto 12px; overflow: hidden; background: linear-gradient(135deg, #001F5C, #003DA5); display: flex; align-items: center; justify-content: center; }
      .coach-initials { color: var(--jaune, #FFD600); font-family: 'Bebas Neue', sans-serif; font-size: 26px; }
      .coach-name-dyn { font-size: 14px; font-weight: 600; color: var(--texte, #0D1B3E); }
      @media (max-width: 600px) { .coach-grid-dyn { grid-template-columns: repeat(2, 1fr); } .coach-group-head-dyn { flex-wrap: wrap; } }
    `;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }

  // Lancement quand la page est prête
  function init() {
    injectStyles();
    injectCoordonnees();
    injectHoraires();
    injectEquipe();
    injectAccueil();
    injectHistoire();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
