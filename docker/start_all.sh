#!/bin/bash

cd /mnt/d/EXTRA/Cyber-X/docker

echo "🚀 Starting CyberX Honeypot Infrastructure..."

# Start all services
docker compose -f docker-compose.honeypot.yml up -d

echo "⏳ Waiting for services to initialize..."
sleep 15

# Check status
docker ps

echo ""
echo "✅ Services started!"
echo ""
echo "📥 Pulling Ollama model (this may take 5-10 minutes)..."
docker exec -it cyberx-ollama ollama pull llama3.2:3b

echo ""
echo "✅ Setup complete!"
echo ""
echo "🌐 Access points:"
echo "  - Kibana: http://localhost:5601"
echo "  - Elasticsearch: http://localhost:9200"
echo "  - Ollama API: http://localhost:11434"
echo "  - SSH Honeypot: ssh root@localhost -p 2222"
echo ""
echo "🔍 Check logs:"
echo "  docker logs cyberx-ollama"
echo "  docker logs cyberx-cowrie"
