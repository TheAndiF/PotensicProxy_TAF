PotensicProxy_TAF fixed Android release signing key
==================================================

Keystore: potensicproxy-taf-release-v1.jks
Alias: potensicproxy_taf_release
Certificate SHA-256 fingerprint:
40:73:1D:2F:68:A4:E3:AE:3D:00:EA:A4:36:8C:DB:C4:89:5B:F7:FD:62:3C:81:CE:D3:D3:1C:2A:3C:5C:54:DA
Keystore file SHA-256:
f4ecd67c1af4357be8ed8beda653b5efab05f809ff27b87fb372bdcfafbe2e98

The passwords are stored in ../../keystore.properties so this project archive can
produce reproducibly signed release APKs. Protect the complete project archive
and keep multiple backups. Anyone who obtains the keystore and passwords can
sign APKs that Android accepts as updates for installations signed with this key.

Do not regenerate or replace this keystore for future PotensicProxy_TAF releases.
A different private key cannot update an installation signed with this key.

The Gradle signing configuration also accepts these optional CI overrides:
TAF_RELEASE_STORE_PASSWORD
TAF_RELEASE_KEY_ALIAS
TAF_RELEASE_KEY_PASSWORD
