# n8n-nodes-crowdsec

Nœuds communautaires **n8n** pour **CrowdSec** : alertes, décisions et allowlists via la **Local API (LAPI)**, ainsi que décisions, blocklists, intégrations et organisations via la **Console Service API**.

## Installation

### Via l'interface n8n (recommandé)

**Paramètres → Communauté nodes → Installer** : saisissez `n8n-nodes-crowdsec`.

> Nécessite n8n ≥ 1.35 avec la variable d'environnement `N8N_COMMUNITY_PACKAGES=true` (actif par défaut).

### Manuellement (auto-hébergé)

```bash
cd /home/n8n/.n8n/custom    # ou le dossier défini par N8N_CUSTOM_EXTENSIONS
npm install n8n-nodes-crowdsec
```

Puis redémarrez n8n.

## Nœuds fournis

### 1. CrowdSec LAPI — Local API (machine / bouncer)

| Ressource | Opérations |
|---|---|
| **Alert** | Lister les alertes (`getAll`), Obtenir une alerte (`get`), Supprimer une alerte (`delete`), Supprimer plusieurs alertes (`deleteMany`) |
| **Decision** | Lister les décisions (`getAll`), Flux des décisions (`stream`), Supprimer plusieurs décisions (`deleteMany`), Supprimer une décision (`delete`) |
| **Allowlist** | Lister (`getAll`), Obtenir (`get`), Vérifier une IP (`check`) |

### 2. CrowdSec Console — Console Service API (admin.api.crowdsec.net)

| Ressource | Opérations |
|---|---|
| **Decision** | Lister (`getAll`), Décisions agrégées (`getAggregated`), Créer (`create`), Supprimer (`delete`) |
| **Blocklist** | Lister (`getAll`), Obtenir (`get`), Créer (`create`), Supprimer (`delete`), Télécharger (`download`), Ajouter des IP (`addIps`), Supprimer des IP (`deleteIps`) |
| **Integration** | Lister (`getAll`), Obtenir le contenu (`getContent`) |
| **Organization** | Informations (`getInfo`) |

## Credentials

### CrowdSec LAPI (bouncer API key) — lecture seule sur les décisions

```bash
# Sur le serveur CrowdSec
cscli bouncers add n8n
```

- **Base URL** : `http://127.0.0.1:8080` (ou votre reverse proxy TLS)
- **API Key** : la clé renvoyée par `cscli bouncers add`

> ⚠️ Une clé bouncer n'accède **qu'aux endpoints `/v1/decisions`** (lecture seule). Pour les alertes et les suppressions, il faut un compte machine.

### CrowdSec LAPI (machine account) — alertes, décisions, allowlists

Créez sur le serveur CrowdSec un compte machine dédié :

```bash
cscli machines add n8n-node
```

Ou récupérez les identifiants existants dans `/etc/crowdsec/local_api_credentials.yaml` :

- **Base URL** : `http://127.0.0.1:8080`
- **Machine ID** : `machine_id` du fichier yaml
- **Password** : `password` du fichier yaml

> 💡 Le nœud effectue un **login JWT frais à chaque exécution** : le token ne peut jamais expirer en cours de workflow.
> ⚠️ Un compte machine ne peut pas lire les endpoints bouncer `/v1/decisions` : pour ces derniers, ajoutez aussi le credential bouncer (le nœud choisit automatiquement le bon selon l'opération).

**Si le test renvoie 401 Unauthorized** : vérifiez que le machine_id et le mot de passe correspondent à `cscli machines list` (colonne `NAME`), et que la machine est bien validée (`VALID` ✅). Le User-Agent `n8n-nodes-crowdsec/0.1.0` est envoyé automatiquement — la LAPI refuse les User-Agent au format `nom/version` incorrect.

### CrowdSec Console API (admin.api.crowdsec.net)

- **API Key** : clé générée depuis la [Console CrowdSec](https://app.crowdsec.net) (Paramètres → Clés API)
- Le credential envoie automatiquement l'en-tête `x-api-key` sur `https://admin.api.crowdsec.net`.

### 🧪 Bouton « Test » des credentials

Chaque credential dispose d'un bouton **Test** dans sa fenêtre de configuration :

| Credential | Requête de test | Valide |
|---|---|---|
| Bouncer | `GET /v1/decisions?limit=1` | La clé bouncer (403 si mauvaise clé) |
| Machine | `POST /v1/watchers/login` (même login que le nœud) | Le machine_id / password (JWT) |
| Console | `GET /v1/info` | La clé de service Console |

## Exemples d'utilisation

**Lister les alertes en cours et recevoir une notification :**

```
[CrowdSec LAPI] Alert → GetAll (limite 20, alertes actives)
    → [IF] items > 0
        → [Telegram / Email]
```

**Stream des décisions (surveillance temps quasi-réel, style firewall bouncer) :**

```
[CrowdSec LAPI] Decision → Stream (boucle sur les nouveaux bannis)
```

**Synchroniser une blocklist Console vers un firewall :**

```
[CrowdSec Console] Blocklist → Download
    → [HTTP Request] (push vers votre équipement)
```

## Équivalents curl

```bash
# Alertes (compte machine)
curl -s -H "Authorization: Bearer $JWT" "http://127.0.0.1:8080/v1/alerts?limit=20"

# Décisions (clé bouncer)
curl -s -H "X-Api-Key: $BOUNCER_KEY" "http://127.0.0.1:8080/v1/decisions?limit=100"

# Blocklists Console
curl -s -H "x-api-key: $CONSOLE_KEY" "https://admin.api.crowdsec.net/v1/blocklists"
```

## Sécurité

- Ne exposez **jamais** la LAPI en dehors de `127.0.0.1` sans TLS (reverse proxy obligatoire).
- Privilégiez une clé bouncer dédiée (lecture seule) quand l'opération le permet.
- Les credentials machine ont un accès **en écriture** (suppression d'alertes/décisions) : réservez-les aux workflows qui en ont besoin.

## Compatibilité

- n8n ≥ 1.35 (Community Nodes)
- CrowdSec Local API v1 (CrowdSec ≥ 1.4)
- Console Service API `admin.api.crowdsec.net`

## Licence

[MIT](LICENSE)
