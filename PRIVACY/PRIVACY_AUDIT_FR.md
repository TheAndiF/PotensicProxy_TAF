# Potensic Atom 2 — Audit de Confidentialite : Donnees Transmises a l'Insu de l'Utilisateur (French / Francais)

> **Firmware analyse :** cam_atom2_v8.12.11 (2025-09-19) — `main_app` (10MB, aarch64 ELF)
> **Bibliotheque RemoteID :** `libridtrans.so` (ASTM F3411 / OpenDroneID)
> **SoC :** HiSilicon Hi3519DV500

---

## 1. RemoteID — Diffusion Continue en BLE/WiFi (Le Plus Invasif)

Via `libridtrans.so` (protocole ASTM F3411 / OpenDroneID), le drone diffuse en continu les donnees suivantes par BLE et WiFi :

| Donnee | Fonction API |
|--------|-------------|
| **Numero de serie** (UASID = `[MFR CODE][SERIAL]`) | `RIDTRANS_SetBasicID` |
| **Position GPS en temps reel** (lat, lon, alt) | `RIDTRANS_SetLocation` |
| **Vitesse horizontale/verticale** | `RIDTRANS_SetLocation` |
| **Direction de vol** | `RIDTRANS_SetLocation` |
| **Altitude barometrique + geodesique** | `RIDTRANS_SetLocation` |
| **Precision horizontale/verticale/vitesse** | `RIDTRANS_SetLocation` |
| **Position du pilote** (Operator Location) | `RIDTRANS_SetSystem` |
| **Categorie + classe EU** du drone | `RIDTRANS_SetSystem` |
| **Identifiant operateur** | `RIDTRANS_SetOperatorID` |
| **Texte libre** (Self ID) | `RIDTRANS_SetSelfID` |
| **Donnees d'authentification** | `RIDTRANS_SetAuth` |
| **Horodatage** | `RIDTRNAS_SetTime` |

**N'importe qui** disposant d'un recepteur BLE/WiFi dans un rayon d'environ 1 km peut lire toutes ces donnees en temps reel. C'est **par conception** (reglementations EU/FAA), mais les utilisateurs ne sont pas forcement pleinement conscients de l'etendue des donnees diffusees.

## 2. Metadonnees EXIF/XMP dans les Photos et Videos

Chaque fichier photo et video contient des metadonnees integrees (namespace XMP `http://www.ipotensic.com/drone/1.0/`) :

| Champ | Contenu |
|-------|---------|
| `GPSLatitude` / `GPSLongitude` | Position exacte |
| `GPSAltitude` | Altitude |
| `AbsoluteAltitude` / `RelativeAltitude` | Altitudes absolue et relative |
| `GimbalPitchDegree` / `GimbalRollDegree` / `GimbalYawDegree` | Orientation de la camera |
| `FlightPitchDegree` / `FlightRollDegree` / `FlightYawDegree` | Orientation du drone |
| `FlightXSpeed` / `FlightYSpeed` / `FlightZSpeed` | Vitesse 3D |
| `CameraSerialNumber` / `BodySerialNumber` | Numeros de serie |
| `Make` / `Model` | Identifiants materiels |
| `ISOSpeed` / `ShutterSpeedValue` / `FNumber` | Reglages camera |

Ces donnees sont **integrees dans les fichiers** — si vous partagez une photo ou une video, toutes ces informations sont transmises avec.

## 3. Piste Privee "Potensic MetaData" dans les Videos MP4

Les enregistrements video MP4 contiennent une **piste de donnees privee** (`Create private data track`) avec des entrees `UserDefAtom` — un flux de telemetrie complet encode dans le fichier video (GPS, attitude, vitesse, etc. image par image).

## 4. Heartbeat vers l'Application Mobile — Flux de Donnees Continu

Le `camera_heartbeat` envoie en continu a l'application mobile connectee :
- Mode de fonctionnement
- Etat de la carte SD
- Etat des medias
- Etat du WiFi Direct
- Etat composite
- Mode media actif

## 5. Authentification du Telephone

Le drone **identifie et authentifie** le telephone connecte :
- `is_cellphone_id_authenticated` — verifie si le telephone est autorise
- `cellphone id authenticated: %s` — journalise l'identifiant du telephone
- Jeton stocke dans `/data/config/token`

## 6. Zones d'Exclusion Aerienne — Appliquees Silencieusement

Le systeme NFZ (`deepsea_nfz`) :
- Telecharge les zones de restriction depuis les serveurs Potensic (via l'application mobile)
- Les stocke dans `/data/no_fly_zone/` (formats cercle + polygone)
- Le controleur de vol **refuse de voler** dans ces zones
- L'utilisateur **ne peut pas les supprimer** sans acces root

## Ce Qui N'Est PAS Fait (Positif)

- Le drone **ne se connecte pas directement a Internet** — toute communication passe par l'application mobile
- Pas de telemetrie cloud directe depuis le drone
- Pas de comportement autonome de type "phone home"

## Resume des Risques

| Risque | Severite | Controle Utilisateur |
|--------|----------|---------------------|
| RemoteID diffusant position/numero de serie en continu | **Elevee** | Aucun (impossible a desactiver sans root) |
| GPS/numero de serie integres dans les photos partagees | **Moyenne** | Supprimer les EXIF avant le partage |
| Piste de telemetrie dans les videos | **Moyenne** | Pas de moyen simple de la supprimer |
| NFZ imposees par le serveur | **Moyenne** | Aucun sans root |
| Authentification du telephone | **Faible** | Normal pour l'appairage |
