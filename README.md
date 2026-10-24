# Suivi des dépenses du voyage (PWA)

Application 100 % locale : HTML/CSS/JS sans dépendance, données dans le localStorage du téléphone,
service worker pour le mode hors-ligne.

## Installer sur iPhone
1. Héberger le dossier app/ en HTTPS (GitHub Pages, Netlify, Cloudflare Pages…), une seule fois.
2. Ouvrir l'URL dans Safari, avec du réseau.
3. Partager → Sur l'écran d'accueil → Ajouter.
4. Lancer l'icône une fois en ligne, puis tester en mode avion.

## À savoir
- Les données vivent uniquement sur l'iPhone : exporter une sauvegarde régulièrement (Réglages → Données).
- Vider les données de Safari ou supprimer l'icône efface les dépenses.
- Supprimer les dépenses d'exemple avant de commencer.
- Après modification du code, incrémenter CACHE dans sw.js.
