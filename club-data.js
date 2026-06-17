// ============================================================
//  club-data.js — Contenu modifiable du site ACC
//  Ce script lit les fichiers modifiés via le CMS et les
//  injecte automatiquement dans toutes les pages du site.
//  Architecture : un seul fichier partagé par toutes les pages.
// ============================================================

(function () {
  const REPO = 'accannes-cloud/site-acc';
  const BRANCH = 'main';
  // On lit directement les fichiers "raw" (pas l'API) pour éviter les limites de débit
  const RAW = `https://raw.githubusercontent.com/${REPO}/${BRANCH}`;

  // Petit utilitaire : récupère un JSON, renvoie null si absent
  async function getJSON(path) {
    try {
      const res = await fetch(`${RAW}/${path}?t=${Date.now()}`);
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
        html += `
          <div class="horaire-row">
            <div class="horaire-jour">${c.jour || ''}</div>
            <div class="horaire-heure">${c.horaire || ''}</div>
            <div class="horaire-detail">
              ${c.groupe ? '<span class="horaire-groupe">' + c.groupe + '</span>' : ''}
              ${c.lieu ? '<span class="horaire-lieu">📍 ' + c.lieu + '</span>' : ''}
            </div>
          </div>`;
      });
      html += '</div>';
      conteneur.innerHTML = html;
    }
  }

  // ========== 3. ÉQUIPE / BUREAU ==========
  // Injecte dans <div data-equipe="bureau"></div> et <div data-equipe="entraineurs"></div>
  async function injectEquipe() {
    const conteneurs = document.querySelectorAll('[data-equipe]');
    for (const conteneur of conteneurs) {
      const type = conteneur.getAttribute('data-equipe');
      const data = await getJSON(`contenu/equipe/${type}.json`);
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
  }

  // Styles minimaux injectés pour les horaires et l'équipe dynamiques
  function injectStyles() {
    const css = `
      .horaires-table { display: flex; flex-direction: column; gap: 10px; margin-top: 24px; }
      .horaire-row { display: grid; grid-template-columns: 140px 160px 1fr; gap: 16px; align-items: center; background: var(--blanc, #fff); border-radius: 12px; padding: 16px 22px; box-shadow: 0 4px 18px rgba(0,31,92,0.06); border-left: 4px solid var(--jaune, #FFD600); }
      .horaire-jour { font-family: 'Bebas Neue', sans-serif; font-size: 20px; letter-spacing: 1px; color: var(--bleu, #003DA5); }
      .horaire-heure { font-weight: 600; color: var(--texte, #0D1B3E); font-size: 15px; }
      .horaire-detail { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
      .horaire-groupe { background: rgba(0,61,165,0.08); color: var(--bleu, #003DA5); font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 100px; }
      .horaire-lieu { font-size: 13px; color: var(--texte-doux, #455A7A); }
      @media (max-width: 700px) { .horaire-row { grid-template-columns: 1fr; gap: 6px; text-align: left; } }
      .equipe-card-dyn { display: flex; align-items: center; gap: 16px; background: var(--blanc, #fff); border-radius: 14px; padding: 18px 22px; box-shadow: 0 4px 18px rgba(0,31,92,0.06); }
      .equipe-avatar-dyn { width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, #001F5C, #003DA5); color: #FFD600; display: flex; align-items: center; justify-content: center; font-family: 'Bebas Neue', sans-serif; font-size: 22px; flex-shrink: 0; overflow: hidden; }
      .equipe-avatar-dyn img { width: 100%; height: 100%; object-fit: cover; }
      .equipe-info-dyn h4 { font-size: 16px; font-weight: 600; margin-bottom: 3px; color: var(--texte, #0D1B3E); }
      .equipe-info-dyn p { font-size: 13px; color: var(--bleu, #003DA5); font-weight: 600; }
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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
