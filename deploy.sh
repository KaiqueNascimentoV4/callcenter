#!/bin/bash
set -e

echo "→ Puxando atualizações..."
git pull origin main

echo "→ Instalando dependências..."
npm install --omit=dev

echo "→ Reiniciando servidor..."
pm2 restart callcenter-backend || pm2 start ecosystem.config.cjs --env production

echo "✓ Deploy concluído"
pm2 status
