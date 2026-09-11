#!/bin/bash
set -e

echo "🔨 Limpiando caché de npm..."
rm -rf node_modules package-lock.json .npm

echo "📦 Instalando dependencias limpias..."
npm install --legacy-peer-deps --no-save

echo "✅ Build completado"
