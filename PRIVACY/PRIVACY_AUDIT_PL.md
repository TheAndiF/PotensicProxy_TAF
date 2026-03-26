# Potensic Atom 2 — Audyt prywatnosci: dane wysylane bez wiedzy uzytkownika (Polish / Polski)

> **Analizowany firmware:** cam_atom2_v8.12.11 (2025-09-19) — `main_app` (10MB, aarch64 ELF)
> **Biblioteka RemoteID:** `libridtrans.so` (ASTM F3411 / OpenDroneID)
> **SoC:** HiSilicon Hi3519DV500

---

## 1. RemoteID — ciagla transmisja BLE/WiFi (najbardziej inwazyjna)

Za posrednictwem `libridtrans.so` (protokol ASTM F3411 / OpenDroneID) dron nieprzerwanie nadaje nastepujace dane przez BLE i WiFi:

| Dane | Funkcja API |
|------|-------------|
| **Numer seryjny** (UASID = `[MFR CODE][SERIAL]`) | `RIDTRANS_SetBasicID` |
| **Pozycja GPS w czasie rzeczywistym** (szer., dlug., wys.) | `RIDTRANS_SetLocation` |
| **Predkosc pozioma/pionowa** | `RIDTRANS_SetLocation` |
| **Kierunek lotu** | `RIDTRANS_SetLocation` |
| **Wysokosc barometryczna + geodetyczna** | `RIDTRANS_SetLocation` |
| **Dokladnosc pozioma/pionowa/predkosci** | `RIDTRANS_SetLocation` |
| **Pozycja pilota** (Operator Location) | `RIDTRANS_SetSystem` |
| **Kategoria + klasa UE** drona | `RIDTRANS_SetSystem` |
| **Identyfikator operatora** | `RIDTRANS_SetOperatorID` |
| **Dowolny tekst** (Self ID) | `RIDTRANS_SetSelfID` |
| **Dane uwierzytelniajace** | `RIDTRANS_SetAuth` |
| **Znacznik czasu** | `RIDTRNAS_SetTime` |

**Kazdy** posiadajacy odbiornik BLE/WiFi w zasiegu ~1 km moze odczytac wszystkie te dane w czasie rzeczywistym. Jest to **zamierzone** (regulacje UE/FAA), ale uzytkownicy moga nie byc w pelni swiadomi zakresu nadawanych danych.

## 2. Metadane EXIF/XMP w zdjeciach i filmach

Kazde zdjecie i plik wideo zawiera osadzone metadane (przestrzen nazw XMP `http://www.ipotensic.com/drone/1.0/`):

| Pole | Zawartosc |
|------|-----------|
| `GPSLatitude` / `GPSLongitude` | Dokladna pozycja |
| `GPSAltitude` | Wysokosc |
| `AbsoluteAltitude` / `RelativeAltitude` | Wysokosc bezwzgledna i wzgledna |
| `GimbalPitchDegree` / `GimbalRollDegree` / `GimbalYawDegree` | Orientacja kamery |
| `FlightPitchDegree` / `FlightRollDegree` / `FlightYawDegree` | Orientacja drona |
| `FlightXSpeed` / `FlightYSpeed` / `FlightZSpeed` | Predkosc 3D |
| `CameraSerialNumber` / `BodySerialNumber` | Numery seryjne |
| `Make` / `Model` | Identyfikatory sprzetu |
| `ISOSpeed` / `ShutterSpeedValue` / `FNumber` | Ustawienia kamery |

Te dane sa **osadzone w plikach** — jesli udostepnisz zdjecie lub film, wszystkie te informacje zostana przekazane wraz z nimi.

## 3. Prywatna sciezka "Potensic MetaData" w filmach MP4

Nagrania wideo MP4 zawieraja **prywatna sciezke danych** (`Create private data track`) z wpisami `UserDefAtom` — kompletny strumien telemetrii zakodowany w pliku wideo (GPS, orientacja, predkosc itp. dla kazdej klatki).

## 4. Heartbeat do aplikacji telefonicznej — ciagly strumien danych

`camera_heartbeat` nieprzerwanie wysyla do polaczonej aplikacji telefonicznej:
- Tryb pracy
- Status karty SD
- Status mediow
- Status WiFi Direct
- Status zlozony
- Aktywny tryb mediow

## 5. Uwierzytelnianie telefonu

Dron **identyfikuje i uwierzytelnia** polaczony telefon:
- `is_cellphone_id_authenticated` — sprawdza, czy telefon jest autoryzowany
- `cellphone id authenticated: %s` — loguje identyfikator telefonu
- Token przechowywany w `/data/config/token`

## 6. Strefy zakazu lotow — wymuszane po cichu

System NFZ (`deepsea_nfz`):
- Pobiera strefy ograniczen z serwerow Potensic (przez aplikacje telefoniczna)
- Przechowuje je w `/data/no_fly_zone/` (formaty kolo + wielokat)
- Kontroler lotu **odmawia startu** w tych strefach
- Uzytkownik **nie moze ich usunac** bez dostepu root

## Czego NIE robi (pozytywne aspekty)

- Dron **nie laczy sie bezposrednio z Internetem** — cala komunikacja odbywa sie przez aplikacje telefoniczna
- Brak bezposredniej telemetrii w chmurze z drona
- Brak autonomicznego zachowania typu "phone home"

## Podsumowanie ryzyk

| Ryzyko | Waznosc | Kontrola uzytkownika |
|--------|---------|----------------------|
| RemoteID ciagla transmisja pozycji/numeru seryjnego | **Wysoka** | Brak (nie mozna wylaczyc bez root) |
| GPS/numer seryjny osadzone w udostepnianych zdjeciach | **Srednia** | Usun EXIF przed udostepnieniem |
| Sciezka telemetrii w filmach | **Srednia** | Brak prostego sposobu usuniecia |
| NFZ wymuszane przez serwer | **Srednia** | Brak bez dostepu root |
| Uwierzytelnianie telefonu | **Niska** | Normalne dla parowania |
