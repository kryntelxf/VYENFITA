``markdown
# 🚀 VYENFITA

### AI-Native Business Application & Automation Platform

[![GitHub release](https://img.shields.io/github/v/release/kryntelxf/VYENFITA)](https://github.com/kryntelxf/VYENFITA/releases)
[![GitHub Actions](https://github.com/kryntelxf/VYENFITA/actions/workflows/build-verify.yml/badge.svg)](https://github.com/kryntelxf/VYENFITA/actions)
[![Docker Pulls](https://img.shields.io/badge/docker-available-blue)](https://github.com/kryntelxf/VYENFITA/pkgs/container/vyenfita)
[![License](https://img.shields.io/badge/license-Apache%202.0-green)](LICENSE)
[![AI Enabled](https://img.shields.io/badge/AI-Enabled-purple)](https://github.com/kryntelxf/VYENFITA)

---

**VYENFITA** is a production-grade, AI-native business application and automation platform built on Appsmith. It combines the power of low-code development with advanced AI capabilities to help organizations build, deploy, and optimize business applications faster than ever.

## ✨ Key Features

### 🤖 AI-Powered Application Generation
Describe your business needs in natural language, and VYENFITA generates a complete application structure, including pages, widgets, datasources, and queries.

### ⚡ AI Workflow Automation
Create complex business workflows and automations using plain English descriptions. No coding required.

### 🔌 Multi-Provider AI Support
Seamlessly switch between AI providers: OpenAI, Anthropic, and extensible to any provider.

### 🔒 Enterprise-Grade Security
Built-in authentication, authorization, rate limiting, audit logging, and tenant isolation.

### 📊 Business Intelligence
Built-in analytics, anomaly detection, and business insights to drive data-driven decisions.

### 🚀 Scale-Ready Architecture
Designed for horizontal scaling, microservices, and enterprise deployment.

---

## 🎯 Vision

> **"Describe what your business needs. VYENFITA builds and operates it."**

VYENFITA makes sophisticated business software, automation, analytics, and operational intelligence accessible to organizations of all sizes.

---

## 🏁 Quick Start

### Prerequisites
- Docker & Docker Compose
- OpenAI API Key (or Anthropic)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/kryntelxf/VYENFITA.git
   cd VYENFITA
```

1. Configure environment
   ```bash
   cp .env.production .env
   # Edit .env with your API keys
   ```
2. Start VYENFITA
   ```bash
   docker-compose -f docker-compose.yml -f docker-compose.override.yml up -d
   ```
3. Access VYENFITA
   · Main App: http://localhost:8080
   · AI Service: http://localhost:3001
   · AI Health Check: http://localhost:3001/health

---

🎨 AI Features

Generate Application

```bash
curl -X POST http://localhost:3001/api/v1/ai/generate-application \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"description": "Build a customer support dashboard with ticket tracking"}'
```

Generate Workflow

```bash
curl -X POST http://localhost:3001/api/v1/ai/generate-workflow \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"description": "Send weekly sales report to managers every Monday at 9 AM"}'
```

Chat with AI

```bash
curl -X POST http://localhost:3001/api/v1/ai/chat \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "How do I build a dashboard?"}]}'
```

---

🏗️ Architecture

```
VYENFITA
├── AI Layer (app/ai)
│   ├── Multi-Provider Interface
│   ├── Application Generator
│   ├── Workflow Generator
│   └── Business Intelligence
├── Appsmith Core
│   ├── Application Builder
│   ├── UI Framework
│   ├── API Management
│   └── Database Integrations
└── Infrastructure
    ├── Docker & Kubernetes
    ├── Multi-Tenant SaaS
    ├── Enterprise Security
    └── Global Cloud Ready
```

---

📦 Deployment

Docker Compose

```bash
docker-compose -f docker-compose.yml -f docker-compose.override.yml up -d
```

Production

```bash
docker-compose -f docker-compose.yml -f docker-compose.override.yml -f docker-compose.prod.yml up -d
```

---

🛠️ Development

Prerequisites

· Node.js 24.14.1
· Java 25 (Eclipse Temurin)
· Maven 3.9.12
· Docker & Docker Compose
· MongoDB (with replica set)
· Redis

Setup

```bash
# Clone repository
git clone https://github.com/kryntelxf/VYENFITA.git
cd VYENFITA

# Setup AI Layer
cd app/ai
yarn install
cp .env.example .env
# Edit .env with your API keys

# Setup Backend
cd ../server
cp envs/dev.env.example .env
# Edit .env with your database URLs

# Setup Frontend
cd ../client
yarn install

# Start development servers
# Terminal 1: Backend
cd app/server
./scripts/start-dev-server.sh

# Terminal 2: Frontend
cd app/client
yarn start

# Terminal 3: AI Service
cd app/ai
yarn dev
```

---

🧪 Testing

AI Layer Tests

```bash
cd app/ai
yarn test
```

Integration Tests

```bash
cd app/client/cypress
yarn run setup
npx cypress run --spec <spec-path> --browser chrome
```

---

🤝 Contributing

1. Fork the repository
2. Create a feature branch (feature/your-feature)
3. Commit your changes
4. Push to your fork
5. Create a Pull Request to vyenfita-development

Guidelines

· All code must be in English (variables, functions, classes, comments)
· Follow the Zero-Chaos Engineering principle
· Each change must be verified with GitHub Actions
· No false success claims

---

📄 License

VYENFITA is licensed under the terms of Apache License 2.0.

This means you can:

· ✅ Use it commercially
· ✅ Modify it
· ✅ Distribute it
· ✅ Use it privately

With the condition that you:

· 📝 Include the original copyright notice
· 📝 Include the license text
· 📝 State any significant changes made

---

🙏 Acknowledgements

· Appsmith - The foundation of VYENFITA
· OpenAI - AI Provider
· Anthropic - AI Provider

---

📞 Support

· GitHub Issues
· Discord Community

---

⭐ Star History

If you find VYENFITA useful, please give it a ⭐ on GitHub!

---

🏆 Contributors

We ❤️ our contributors. Thank you for making VYENFITA better!

---

Built with ❤️ by the VYENFITA Team

```

---
