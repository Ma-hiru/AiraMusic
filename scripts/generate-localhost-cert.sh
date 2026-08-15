#!/usr/bin/env bash
# 生成本地 HTTPS 代理使用的自签证书。
# 证书仅用于 127.0.0.1 / localhost 回环通信（浏览器 HTTP/2 仅协商于 TLS 之上），
# 不构成真实安全边界，私钥入库以保证构建可复现；无需保密。
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)/packages/app/cert"
mkdir -p "$DIR"
cd "$DIR"

KEY="localhost-key.pem"
CERT="localhost-cert.pem"
DAYS=3650

if command -v openssl >/dev/null 2>&1 && openssl req -help 2>&1 | grep -q -- "-addext"; then
  openssl req -x509 -newkey rsa:2048 -nodes \
    -keyout "$KEY" -out "$CERT" -days "$DAYS" \
    -subj "/CN=localhost/O=AiraMusic Local Proxy" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" \
    -addext "keyUsage=digitalSignature,keyEncipherment" \
    -addext "extendedKeyUsage=serverAuth"
else
  CONF="$(mktemp)"
  cat > "$CONF" <<EOF
[req]
distinguished_name = dn
x509_extensions = v3_req
prompt = no

[dn]
CN = localhost
O = AiraMusic Local Proxy

[v3_req]
subjectAltName = DNS:localhost,IP:127.0.0.1
keyUsage = digitalSignature,keyEncipherment
extendedKeyUsage = serverAuth
EOF
  openssl req -x509 -newkey rsa:2048 -nodes \
    -keyout "$KEY" -out "$CERT" -days "$DAYS" \
    -config "$CONF"
  rm -f "$CONF"
fi

echo "generated $CERT and $KEY:"
openssl x509 -in "$CERT" -noout -subject -dates -fingerprint -sha256
