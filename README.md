# 🐾 Palworld Server Manager

**Pilote et gère ton serveur Palworld dédié (Windows) depuis une seule fenêtre — pas de ligne de
commande, pas d'édition de fichiers de config à la main.**

L'appli installe le serveur Palworld pour toi, te laisse changer les réglages depuis une
interface claire, redémarre le serveur s'il plante, prend des sauvegardes automatiques, envoie
des notifications Discord, et bien plus.

## ⬇️ Télécharger

**[Dernière version](../../releases/latest)** — `PalworldDashboardLauncher-Setup.exe`

1. Télécharge et double-clique le Setup : Windows demande l'élévation (UAC) automatiquement
   (nécessaire pour créer les services Windows et la règle de pare-feu).
2. Suis l'assistant d'installation (dossier modifiable, raccourcis Bureau/menu Démarrer créés).
   Contrairement à un exécutable portable, l'installation ne se fait qu'une fois — les lancements
   suivants sont quasi instantanés.
3. Une fois installé, lance **« Palworld Dashboard »** depuis le menu Démarrer : il installe
   SteamCMD + le serveur Palworld, configure les services, et te laisse gérer ton serveur depuis
   le dashboard.

## Ce que ça permet

- Installation guidée du serveur Palworld (aucun prérequis à installer soi-même)
- Démarrage / arrêt / redémarrage, avec redémarrage automatique récurrent programmable
- Sauvegardes manuelles et planifiées (plusieurs horaires/jour, jours de la semaine), avec
  restauration en un clic
- Édition des réglages du monde (`PalWorldSettings.ini`) depuis le navigateur
- Joueurs connectés, kick/ban, annonces, messages préréglés
- Carte en direct des joueurs
- Vérification et application des mises à jour du serveur
- Comptes multiples avec rôles (admin / utilisateur / lecture seule)
- Notifications Discord, journal d'activité, alerte espace disque, watchdog anti-crash

## Sécurité

- Le mot de passe admin renseigné à l'installation sert aussi de mot de passe pour l'API REST
  Palworld — il n'est jamais exposé publiquement (l'API reste en local).
- Toutes les actions sensibles sont vérifiées côté serveur selon le rôle du compte.

---

*Palworld Server Manager est un outil indépendant, non affilié à Pocketpair, Inc. « Palworld »
est une marque déposée de son propriétaire respectif.*
