# Fréquentation du CDI

Petite application web (aucune installation, aucun serveur) pour noter chaque jour le nombre d'élèves accueillis au CDI par niveau, de la 6e à la 3e.

## Utilisation

1. Ouvrir `index.html` dans un navigateur (double-clic suffit ; fonctionne hors ligne).
2. Choisir la zone de vacances (A, B ou C) dans l'en-tête.
3. Dans « Saisie du jour », choisir la date, saisir le nombre d'élèves par niveau, enregistrer.
4. Les cumuls (par niveau, total, moyenne par jour ouvert) s'affichent par année scolaire et par trimestre scolaire (T1 : rentrée → veille des vacances de Noël ; T2 : reprise de janvier → veille des vacances d'hiver ; T3 : reprise des vacances d'hiver → fin d'année scolaire).
5. Un camembert montre la répartition annuelle des fréquentations par niveau (calculée sur l'année scolaire sélectionnée, tous trimestres confondus) ; il est téléchargeable en PNG.
6. L'historique liste toutes les saisies ; cliquer sur une ligne pour la recharger et la modifier.

## Règles d'ouverture

Le CDI est considéré ouvert les **lundis, mardis, jeudis et vendredis**, sauf :
- mercredis, samedis, dimanches ;
- jours fériés (calculés automatiquement, y compris Pâques, Ascension, Pentecôte) ;
- jours « ponts » vaqués (ex. vendredi 15 mai 2026) ;
- vacances scolaires selon la zone choisie (calendriers officiels intégrés pour 2024-2025, 2025-2026 et 2026-2027) ;
- fermetures exceptionnelles ajoutées manuellement dans la section dédiée.

Tenter d'enregistrer un jour fermé affiche la raison de fermeture.

## Données

- Sauvegarde automatique dans le navigateur (localStorage) — propre à l'ordinateur/navigateur utilisé.
- Export CSV (toutes les saisies) et sauvegarde/restauration JSON pour changer de machine ou archiver.

## Fichiers

- `index.html` — structure de la page
- `styles.css` — mise en page
- `app.js` — logique (calendrier scolaire, trimestres, cumuls, stockage)
- `test-cdi.js` — tests de la logique métier (35 tests) : `node test-cdi.js`
