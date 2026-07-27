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
    // --- Bureau (ancien système, liste simple) ---
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

    // --- Entraîneurs (ancien système par catégorie) ---
    // Ne s'exécute que si un ancien conteneur [data-equipe-entraineurs] existe encore.
    // La page équipe utilise désormais [data-equipe-entraineurs-groupes] (voir injectEquipePage).
    const conteneursCoachs = document.querySelectorAll('[data-equipe-entraineurs]');
    if (conteneursCoachs.length === 0) return; // rien à faire : nouveau système en place
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

    // Fond du hero : vidéo prioritaire, sinon image personnalisée
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

  // ========== PAGE ACTUALITÉS ==========
  async function injectActualites() {
    const box = document.querySelector('[data-actus-articles]');
    if (!box) return;
    const data = await getJSON('contenu/pages/actualites.json');
    if (!data) return;
    document.querySelectorAll('[data-actus]').forEach(el => {
      const k = el.getAttribute('data-actus');
      if (data[k] !== undefined) el.textContent = data[k];
    });
    const gradients = ['gradient-1','gradient-2','gradient-3','gradient-4','gradient-5','gradient-6'];
    if (Array.isArray(data.articles)) {
      box.innerHTML = data.articles.map((a, i) => {
        const img = a.photo
          ? `<div class="article-img" style="background-image:url('${a.photo}');background-size:cover;background-position:center;"></div>`
          : `<div class="article-img ${gradients[i % 6]}">📰</div>`;
        return `<a href="#" class="article-card" onclick="return false;">
          ${img}
          <div class="article-body">
            <div class="article-meta"><span>📅 ${formatDateFr(a.date)}</span></div>
            <h3 class="article-title">${a.titre || ''}</h3>
            <p class="article-excerpt">${a.texte || ''}</p>
          </div>
        </a>`;
      }).join('');
    }

    // Résultats sportifs
    const resBox = document.querySelector('[data-actus-resultats]');
    if (resBox && Array.isArray(data.resultats)) {
      resBox.innerHTML = data.resultats.map(r => {
        const cls = r.medaille === '🥇' ? 'medal-gold' : r.medaille === '🥈' ? 'medal-silver' : r.medaille === '🥉' ? 'medal-bronze' : 'medal-info';
        return `<div class="result-item">
          <div class="result-medal ${cls}">${r.medaille || '🏅'}</div>
          <div class="result-content"><h4>${r.titre || ''}</h4><p>${r.desc || ''}</p></div>
          <div class="result-date">${r.date || ''}</div>
        </div>`;
      }).join('');
    }
  }

  function formatDateFr(dateStr) {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d)) return dateStr;
      return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) { return dateStr; }
  }

  // ========== PAGE HORAIRES (par groupe + filtres) ==========
  async function injectHorairesPage() {
    const box = document.querySelector('[data-horaires-groupes]');
    if (!box) return;
    const data = await getJSON('contenu/pages/horaires.json');
    if (!data || !Array.isArray(data.groupes)) return;

    document.querySelectorAll('[data-horaires]').forEach(el => {
      const k = el.getAttribute('data-horaires');
      if (data[k] !== undefined) el.textContent = data[k];
    });

    const groupes = data.groupes;
    const ordreJours = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];

    // Valeurs de filtres disponibles
    const jours = ordreJours.filter(j => groupes.some(g => (g.creneaux||[]).some(c => (c.jour||'').toLowerCase() === j.toLowerCase())));
    const familles = [...new Set(groupes.map(g => g.famille).filter(Boolean))];
    // Années de naissance possibles (de la plus récente à la plus ancienne)
    let anneeMin = 9999, anneeMax = 0;
    groupes.forEach(g => { if (g.annee_min) anneeMin = Math.min(anneeMin, g.annee_min); if (g.annee_max) anneeMax = Math.max(anneeMax, g.annee_max); });
    const annees = [];
    if (anneeMax >= anneeMin) for (let a = anneeMax; a >= Math.max(anneeMin, anneeMax - 25); a--) annees.push(a);

    // État des filtres
    let fJour = null, fFamille = null, fAnnee = null;

    // Construire l'interface de filtres
    const filtresBox = document.querySelector('[data-horaires-filtres]');
    if (filtresBox) {
      filtresBox.innerHTML = `
        <div class="filtre-groupe">
          <div class="filtre-label">Par jour</div>
          <div class="filtre-chips" data-f="jour">
            <button class="filtre-chip actif" data-val="">Tous</button>
            ${jours.map(j => `<button class="filtre-chip" data-val="${j}">${j}</button>`).join('')}
          </div>
        </div>
        <div class="filtre-groupe">
          <div class="filtre-label">Par discipline</div>
          <div class="filtre-chips" data-f="famille">
            <button class="filtre-chip actif" data-val="">Toutes</button>
            ${familles.map(f => `<button class="filtre-chip" data-val="${f}">${f}</button>`).join('')}
          </div>
        </div>
        <div class="filtre-groupe">
          <div class="filtre-label">Par année de naissance</div>
          <div class="filtre-annee">
            <select data-f-annee>
              <option value="">Toutes les années</option>
              ${annees.map(a => `<option value="${a}">${a}</option>`).join('')}
            </select>
            <button class="filtre-reset" data-reset>↺ Réinitialiser les filtres</button>
          </div>
        </div>`;

      // Clics sur les chips jour et famille
      filtresBox.querySelectorAll('[data-f] .filtre-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          const type = chip.parentElement.getAttribute('data-f');
          chip.parentElement.querySelectorAll('.filtre-chip').forEach(c => c.classList.remove('actif'));
          chip.classList.add('actif');
          const val = chip.getAttribute('data-val') || null;
          if (type === 'jour') fJour = val; else fFamille = val;
          afficher();
        });
      });
      // Sélecteur année
      const sel = filtresBox.querySelector('[data-f-annee]');
      if (sel) sel.addEventListener('change', () => { fAnnee = sel.value ? parseInt(sel.value) : null; afficher(); });
      // Réinitialiser
      const reset = filtresBox.querySelector('[data-reset]');
      if (reset) reset.addEventListener('click', () => {
        fJour = null; fFamille = null; fAnnee = null;
        filtresBox.querySelectorAll('[data-f]').forEach(grp => { grp.querySelectorAll('.filtre-chip').forEach((c, i) => c.classList.toggle('actif', i === 0)); });
        if (sel) sel.value = '';
        afficher();
      });
    }

    // Affichage filtré
    function afficher() {
      const filtres = groupes.filter(g => {
        if (fJour && !(g.creneaux||[]).some(c => (c.jour||'').toLowerCase() === fJour.toLowerCase())) return false;
        if (fFamille && g.famille !== fFamille) return false;
        if (fAnnee && !(g.annee_min && g.annee_max && fAnnee >= g.annee_min && fAnnee <= g.annee_max)) return false;
        return true;
      });

      if (filtres.length === 0) {
        box.innerHTML = '<div class="horaires-vide">Aucun groupe ne correspond à ces critères. Essaie d\'élargir ta recherche.</div>';
        return;
      }

      box.innerHTML = filtres.map(g => {
        // Si un jour est filtré, on n'affiche que les créneaux de ce jour
        let creneaux = g.creneaux || [];
        if (fJour) creneaux = creneaux.filter(c => (c.jour||'').toLowerCase() === fJour.toLowerCase());
        const creneauxHtml = creneaux.map(c =>
          `<div class="grp-creneau"><span class="grp-jour">${c.jour || ''}</span><span class="grp-heure">${c.horaire || ''}</span></div>`
        ).join('');
        return `<div class="grp-card" data-c="${g.couleur || 'bleu'}">
          <div class="grp-head">
            <div class="grp-nom">${g.nom || ''}</div>
            ${g.categorie ? '<div class="grp-cat">' + g.categorie + '</div>' : ''}
            ${g.reprise ? '<div class="grp-reprise">📅 Reprise le ' + g.reprise + '</div>' : ''}
          </div>
          <div class="grp-creneaux">${creneauxHtml}</div>
        </div>`;
      }).join('');
    }

    afficher();
  }

  // ========== PAGE INSTALLATIONS ==========
  async function injectInstallations() {
    if (!document.querySelector('[data-install], [data-install-equipements]')) return;
    const data = await getJSON('contenu/pages/installations.json');
    if (!data) return;
    document.querySelectorAll('[data-install]').forEach(el => {
      const k = el.getAttribute('data-install');
      if (data[k] !== undefined) el.textContent = data[k];
    });
    const box = document.querySelector('[data-install-equipements]');
    if (box && Array.isArray(data.equipements)) {
      box.innerHTML = data.equipements.map(e => `<li><span class="if-icon">${e.icone||''}</span> ${e.texte||''}</li>`).join('');
    }
  }

  // ========== PAGE PALMARÈS ==========
  async function injectPalmares() {
    if (!document.querySelector('[data-palmares], [data-palmares-chiffres]')) return;
    const data = await getJSON('contenu/pages/palmares.json');
    if (!data) return;
    document.querySelectorAll('[data-palmares]').forEach(el => {
      const k = el.getAttribute('data-palmares');
      if (data[k] !== undefined) el.textContent = data[k];
    });
    const chBox = document.querySelector('[data-palmares-chiffres]');
    if (chBox && Array.isArray(data.chiffres)) {
      chBox.innerHTML = data.chiffres.map(c => `<div class="palm-card reveal visible"><div class="palm-num">${c.nombre}</div><div class="palm-label">${c.label}</div></div>`).join('');
    }
    const photo = document.querySelector('[data-palmares-photo]');
    if (photo) {
      const img = photo.querySelector('img');
      if (data.photo_image && img) img.src = data.photo_image;
      const cap = photo.querySelector('.archive-caption');
      if (cap && data.photo_legende) cap.textContent = data.photo_legende;
    }
    const legBox = document.querySelector('[data-palmares-legendes]');
    if (legBox && Array.isArray(data.legendes)) {
      legBox.innerHTML = data.legendes.map(l => `<div class="legend-item"><div class="legend-icon">${l.icone||'🏅'}</div><div><div class="legend-name">${l.nom||''}</div><div class="legend-desc">${l.desc||''}</div></div></div>`).join('');
    }
  }

  // ========== 6. PAGE ÉQUIPE (en-tête + bureau) ==========
  async function injectEquipePage() {
    if (!document.querySelector('[data-equipepage], [data-equipe-bureau]')) return;
    const data = await getJSON('contenu/pages/equipe.json');
    if (!data) return;

    // Textes (titre, sous-titre, en-tête bureau)
    document.querySelectorAll('[data-equipepage]').forEach(el => {
      const key = el.getAttribute('data-equipepage');
      if (data[key]) el.textContent = data[key];
    });

    // Bureau : groupes de membres avec photos
    const box = document.querySelector('[data-equipe-bureau]');
    if (box && Array.isArray(data.groupes)) {
      box.innerHTML = rendreGroupesPublic(data.groupes);
    }
    // Entraîneurs : mêmes groupes
    const boxE = document.querySelector('[data-equipe-entraineurs-groupes]');
    if (boxE && Array.isArray(data.entraineurs_groupes)) {
      boxE.innerHTML = rendreGroupesPublic(data.entraineurs_groupes);
    }
  }

  // Génère le HTML public d'une liste de groupes de personnes
  function rendreGroupesPublic(groupes) {
    return groupes.map(g => {
      const cartes = (g.membres || []).map(m => {
        const initiales = (m.nom || '?').split(' ').map(x => x[0]).join('').substring(0,2).toUpperCase();
        const photo = m.photo
          ? `<div class="person-photo"><img src="${m.photo}" alt="${m.nom}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;"></div>`
          : `<div class="person-photo"><div class="person-photo-initials">${initiales}</div></div>`;
        return `<div class="person-card">
          ${photo}
          <div class="person-body">
            ${m.poste ? '<span class="person-badge">' + m.poste + '</span>' : ''}
            <div class="person-name">${m.nom || ''}</div>
            <div class="person-role">${m.role || ''}</div>
          </div>
        </div>`;
      }).join('');
      return `<div class="team-group reveal visible">
        <div class="team-group-head">
          <div class="team-group-icon">${g.icone || '🏛️'}</div>
          <div><div class="team-group-title">${g.titre || ''}</div><div class="team-group-sub">${g.sous_titre || ''}</div></div>
          <div class="team-group-count">${(g.membres||[]).length} membre${(g.membres||[]).length>1?'s':''}</div>
        </div>
        <div class="people-grid">${cartes}</div>
      </div>`;
    }).join('');
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
    // Si le mode édition est actif, c'est edition.js qui gère l'affichage → on ne fait rien
    if (sessionStorage.getItem('acc_edit_actif') === '1') return;
    injectStyles();
    injectCoordonnees();
    injectHoraires();
    injectEquipe();
    injectEquipePage();
    injectAccueil();
    injectHistoire();
    injectInstallations();
    injectPalmares();
    injectHorairesPage();
    injectActualites();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
