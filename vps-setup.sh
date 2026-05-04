#!/bin/bash
# Script de setup completo — Ubuntu 20.04
# Execute como root ou com sudo
set -e

echo "=== 1. Atualizando sistema ==="
apt update && apt upgrade -y

echo "=== 2. Instalando Node.js 20 ==="
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
node -v && npm -v

echo "=== 3. Instalando PM2 ==="
npm install -g pm2
pm2 startup systemd -u $SUDO_USER --hp /home/$SUDO_USER

echo "=== 4. Instalando nginx ==="
apt install -y nginx
systemctl enable nginx
systemctl start nginx

echo "=== 5. Instalando Certbot (SSL) ==="
apt install -y certbot python3-certbot-nginx

echo "=== 6. Instalando git ==="
apt install -y git

echo "=== 7. Criando diretório do projeto ==="
mkdir -p /var/www/callcenter
chown -R $SUDO_USER:$SUDO_USER /var/www/callcenter

echo "✓ Setup concluído. Próximo passo: clonar o repositório em /var/www/callcenter"
