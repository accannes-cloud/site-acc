# 📦 FICHIERS À METTRE À JOUR SUR GITHUB

Voici la liste complète de tout ce qui doit être sur ton dépôt GitHub
(https://github.com/accannes-cloud/site-acc) pour que le site soit à jour.

Le plus simple : utilise le fichier **site-acc-complet.zip** (voir méthode tout en bas).

---

## ✅ MÉTHODE RAPIDE (recommandée) : tout d'un coup avec le ZIP

1. **Décompresse** le fichier `site-acc-complet.zip` sur ton ordinateur
   (clic droit → "Extraire tout")
2. Tu obtiens un dossier avec tous les fichiers + les dossiers `admin/` et `contenu/`
3. Va sur https://github.com/accannes-cloud/site-acc/upload/main
4. **Sélectionne TOUT** le contenu du dossier décompressé et glisse-le
5. GitHub écrasera les anciens fichiers par les nouveaux
6. **Commit changes**

⚠️ Vérifie qu'aucun fichier n'a un nom avec "(1)" après extraction.

---

## 📋 LISTE COMPLÈTE DES FICHIERS (si tu préfères vérifier un par un)

### Pages HTML (à la racine) — 17 fichiers
- index.html ........... (cartes cliquables + onglet Horaires)
- horaires.html ........ ⭐ NOUVEAU (page récap des horaires)
- le-club.html
- equipe.html .......... (entraîneurs dynamiques)
- installations.html ... (coordonnées modifiables)
- palmares.html
- inscription.html
- blog.html ............ (articles + résultats auto)
- evenements.html ...... (compétitions auto)
- boutique.html ........ (commandes Google Forms)
- athle-jeune.html ..... (horaires dynamiques)
- athle-piste.html ..... (horaires dynamiques)
- athle-running.html ... ⭐ NOUVEAU
- athle-sante.html ..... ⭐ NOUVEAU
- athle-parasport.html . ⭐ NOUVEAU
- partenaires.html ..... ⭐ NOUVEAU
- accepter-invitation.html

### Script partagé (à la racine) — 1 fichier
- club-data.js ......... ⭐ (coordonnées, horaires, entraîneurs modifiables)

### Dossier admin/ — 2 fichiers
- admin/index.html
- admin/config.yml ..... (6 rubriques du CMS)

### Dossier contenu/ — 7 fichiers
- contenu/reglages/coordonnees.json
- contenu/horaires/running.json
- contenu/horaires/sante.json
- contenu/horaires/jeune.json
- contenu/horaires/piste.json
- contenu/equipe/bureau.json
- contenu/equipe/entraineurs.json

### Images (à la racine) — déjà en ligne, pas besoin de re-uploader sauf si manquantes
- Logo_bleu.png, Club.jpg
- product-*.png (10 produits boutique)
- pack-*.jpg (6 visuels packs)
- histoire-*.jpg (3 photos histoire)

---

## 🎯 LES NOUVEAUTÉS DE CETTE SESSION

1. ⭐ 4 nouvelles pages : Running, Santé, Parasport, Partenaires
2. ⭐ Nouvelle page Horaires (2 vues : par discipline / par jour)
3. ⭐ Onglet "Horaires" ajouté dans le menu de toutes les pages
4. ⭐ Cartes disciplines de l'accueil entièrement cliquables
5. ⭐ Coordonnées du club modifiables via le CMS
6. ⭐ Horaires modifiables via le CMS (4 disciplines)
7. ⭐ Entraîneurs modifiables via le CMS (liste simple par catégorie)

---

## ⚠️ RAPPEL IMPORTANT

À chaque téléchargement de fichier, vérifie que le navigateur ne l'a pas
renommé en "fichier (1).html". Si c'est le cas, renomme-le proprement
AVANT de l'uploader, sinon GitHub crée un doublon et le site casse.
