# Extends the official image to trust this machine's corporate TLS-inspecting proxy root CA
# (Zscaler) — without it, PrestaShop's own auto-installer can't download the language pack
# from i18n.prestashop-project.org (see docker/zscaler-root-ca.pem; not needed off this network).
FROM prestashop/prestashop:latest

COPY docker/zscaler-root-ca.pem /usr/local/share/ca-certificates/zscaler-root-ca.crt
RUN update-ca-certificates

# admin-api-tls (Caddy, see Caddyfile) terminates TLS and forwards plain HTTP to this
# container. Symfony's trusted_proxies (PS_TRUSTED_PROXIES) doesn't reach the Admin API's
# SSL-enforcement listener, so instead set Apache's HTTPS server var directly from
# X-Forwarded-Proto — this is what Request::createFromGlobals() checks natively.
COPY docker/trust-forwarded-proto.conf /etc/apache2/conf-enabled/trust-forwarded-proto.conf
