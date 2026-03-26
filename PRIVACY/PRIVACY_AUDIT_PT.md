# Potensic Atom 2 — Auditoria de Privacidade: Dados Enviados Sem Conhecimento do Utilizador (Portuguese / Portugues)

> **Firmware analisado:** cam_atom2_v8.12.11 (2025-09-19) — `main_app` (10MB, aarch64 ELF)
> **Biblioteca RemoteID:** `libridtrans.so` (ASTM F3411 / OpenDroneID)
> **SoC:** HiSilicon Hi3519DV500

---

## 1. RemoteID — Transmissao Continua por BLE/WiFi (Mais Invasivo)

Atraves de `libridtrans.so` (protocolo ASTM F3411 / OpenDroneID), o drone transmite continuamente os seguintes dados por BLE e WiFi:

| Dados | Funcao da API |
|-------|---------------|
| **Numero de serie** (UASID = `[MFR CODE][SERIAL]`) | `RIDTRANS_SetBasicID` |
| **Posicao GPS em tempo real** (lat, lon, alt) | `RIDTRANS_SetLocation` |
| **Velocidade horizontal/vertical** | `RIDTRANS_SetLocation` |
| **Direcao de voo** | `RIDTRANS_SetLocation` |
| **Altitude barometrica + geodesica** | `RIDTRANS_SetLocation` |
| **Precisao horizontal/vertical/velocidade** | `RIDTRANS_SetLocation` |
| **Posicao do piloto** (Operator Location) | `RIDTRANS_SetSystem` |
| **Categoria + classe UE** do drone | `RIDTRANS_SetSystem` |
| **ID do operador** | `RIDTRANS_SetOperatorID` |
| **Texto livre** (Self ID) | `RIDTRANS_SetSelfID` |
| **Dados de autenticacao** | `RIDTRANS_SetAuth` |
| **Marca temporal** | `RIDTRNAS_SetTime` |

**Qualquer pessoa** com um recetor BLE/WiFi num raio de ~1km pode ler todos estes dados em tempo real. Isto e **por concepcao** (regulamentacoes UE/FAA), mas os utilizadores podem nao estar totalmente cientes da extensao dos dados transmitidos.

## 2. Metadados EXIF/XMP em Fotos e Videos

Cada ficheiro de foto e video contem metadados incorporados (namespace XMP `http://www.ipotensic.com/drone/1.0/`):

| Campo | Conteudo |
|-------|----------|
| `GPSLatitude` / `GPSLongitude` | Posicao exata |
| `GPSAltitude` | Altitude |
| `AbsoluteAltitude` / `RelativeAltitude` | Altitudes absoluta e relativa |
| `GimbalPitchDegree` / `GimbalRollDegree` / `GimbalYawDegree` | Orientacao da camera |
| `FlightPitchDegree` / `FlightRollDegree` / `FlightYawDegree` | Orientacao do drone |
| `FlightXSpeed` / `FlightYSpeed` / `FlightZSpeed` | Velocidade 3D |
| `CameraSerialNumber` / `BodySerialNumber` | Numeros de serie |
| `Make` / `Model` | Identificadores de hardware |
| `ISOSpeed` / `ShutterSpeedValue` / `FNumber` | Definicoes da camera |

Estes dados estao **incorporados nos ficheiros** — se partilhar uma foto ou video, tudo isto vai junto.

## 3. Faixa Privada "Potensic MetaData" em Videos MP4

As gravacoes de video MP4 contem uma **faixa de dados privada** (`Create private data track`) com entradas `UserDefAtom` — um fluxo completo de telemetria codificado dentro do ficheiro de video (GPS, atitude, velocidade, etc. por cada frame).

## 4. Heartbeat para a Aplicacao do Telefone — Fluxo Continuo de Dados

O `camera_heartbeat` envia continuamente para a aplicacao do telefone conectado:
- Modo de operacao
- Estado do cartao SD
- Estado dos media
- Estado do WiFi Direct
- Estado composto
- Modo de media ativo

## 5. Autenticacao do Telefone

O drone **identifica e autentica** o telefone conectado:
- `is_cellphone_id_authenticated` — verifica se o telefone esta autorizado
- `cellphone id authenticated: %s` — regista o ID do telefone
- Token armazenado em `/data/config/token`

## 6. Zonas de Voo Proibido — Aplicadas Silenciosamente

O sistema NFZ (`deepsea_nfz`):
- Descarrega zonas de restricao dos servidores Potensic (atraves da aplicacao do telefone)
- Armazena-as em `/data/no_fly_zone/` (formatos circulo + poligono)
- O Controlador de Voo **recusa voar** nestas zonas
- O utilizador **nao pode remove-las** sem acesso root

## O Que NAO e Feito (Positivo)

- O drone **nao se conecta diretamente a Internet** — toda a comunicacao passa pela aplicacao do telefone
- Sem telemetria direta para a cloud a partir do drone
- Sem comportamento autonomo de "phone home"

## Resumo de Riscos

| Risco | Severidade | Controlo do Utilizador |
|-------|------------|------------------------|
| RemoteID a transmitir posicao/serie continuamente | **Alto** | Nenhum (nao pode ser desativado sem root) |
| GPS/serie incorporado em fotos partilhadas | **Medio** | Remover EXIF antes de partilhar |
| Faixa de telemetria em videos | **Medio** | Sem forma simples de remover |
| NFZ aplicadas pelo servidor | **Medio** | Nenhum sem root |
| Autenticacao do telefone | **Baixo** | Normal para emparelhamento |
