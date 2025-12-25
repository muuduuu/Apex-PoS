#!/bin/bash
echo "🔴 522 EMERGENCY DIAGNOSTIC"
echo "=========================="
echo "1. PM2 STATUS:"
pm2 status
echo -e "\n2. BACKEND DIRECT:"
curl -m 10 -s http://localhost:3001/health || echo "❌ BACKEND DEAD"
echo -e "\n3. NGINX LOCAL API:"
curl -m 10 -s http://localhost/api/health || echo "❌ NGINX PROXY DEAD"
echo -e "\n4. PM2 LOGS (Last 10):"
pm2 logs pos-backend --lines 10
echo -e "\n5. NGINX LOGS (Last 5):"
sudo tail -5 /var/log/nginx/error.log
echo -e "\n6. PORT 3001:"
sudo lsof -i :3001 || echo "❌ NO PROCESS ON 3001"
echo -e "\n7. NGINX CONFIG:"
sudo nginx -t && echo "✅ NGINX OK" || echo "❌ NGINX BAD"
echo -e "\n8. UFW:"
sudo ufw status
