#!/bin/sh
# Creates a free, local code-signing certificate for HiveAnnotate.
#
# Why: macOS keys the Screen Recording permission to the signing certificate.
# Unsigned (ad-hoc) builds get a new identity every rebuild, so the permission
# is lost every time. Any *stable* certificate fixes that — it does not need to
# come from Apple. A Developer ID is only needed to run on other people's Macs.
#
# This touches your login keychain and asks for your password once, to trust
# the certificate for code signing. It changes nothing else.
#
# Undo:  security delete-certificate -c "HiveAnnotate Local Signing"
set -eu

NAME="HiveAnnotate Local Signing"
KEYCHAIN="$HOME/Library/Keychains/login.keychain-db"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

if security find-identity -v -p codesigning | grep -q "$NAME"; then
  echo "\"$NAME\" already exists and is trusted — nothing to do."
  exit 0
fi

cat > "$WORK/openssl.cnf" <<CNF
[req]
distinguished_name = dn
x509_extensions = ext
prompt = no
[dn]
CN = $NAME
[ext]
basicConstraints = critical, CA:false
keyUsage = critical, digitalSignature
extendedKeyUsage = critical, codeSigning
CNF

openssl req -x509 -newkey rsa:2048 -nodes -days 3650 \
  -keyout "$WORK/key.pem" -out "$WORK/cert.pem" -config "$WORK/openssl.cnf" 2>/dev/null

# A throwaway passphrase: the p12 exists only for the import below.
PASS=$(openssl rand -hex 16)
openssl pkcs12 -export -inkey "$WORK/key.pem" -in "$WORK/cert.pem" \
  -name "$NAME" -out "$WORK/cert.p12" -passout "pass:$PASS" 2>/dev/null

security import "$WORK/cert.p12" -k "$KEYCHAIN" -P "$PASS" -T /usr/bin/codesign
echo "Trusting it for code signing — macOS will ask for your password once."
security add-trusted-cert -d -r trustRoot -p codeSign -k "$KEYCHAIN" "$WORK/cert.pem"

echo
security find-identity -v -p codesigning | grep "$NAME"
echo
echo "Done. Build signed with:"
echo "  HIVE_SIGNING_IDENTITY=\"$NAME\" npm run pack"
