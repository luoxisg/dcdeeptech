  # 🌏 SG-CN AI Gateway POC

**Singapore--China Cross-Border AI Gateway (OpenAI-Compatible)**

![Python](https://img.shields.io/badge/Python-3.10+-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-API-green)
![License](https://img.shields.io/badge/License-MIT-yellow)
![Status](https://img.shields.io/badge/Status-POC-orange)

------------------------------------------------------------------------

## 📑 Table of Contents

-   Overview
-   Architecture
-   Features
-   Tech Stack
-   Installation
-   Configuration
-   Run
-   API Usage
-   Project Structure
-   Success Criteria
-   Roadmap
-   中文版本

------------------------------------------------------------------------

## 📌 Overview

This project demonstrates a minimal cross-border AI inference
architecture:

Global → Singapore Gateway → China Compute → Response

------------------------------------------------------------------------

## 🧱 Architecture

``` mermaid
flowchart TD
    A["Clients"] --> B["Singapore API Gateway"]
    B --> C["Cross-border Inference Channel"]
    C --> D["Model Inference: China GPU / vLLM"]
    D --> C
    C --> B
```

------------------------------------------------------------------------

## ✨ Features

-   OpenAI-compatible API
-   API Key authentication
-   Cross-border routing
-   Protocol adapter
-   Observability (basic)

------------------------------------------------------------------------

## 🛠 Tech Stack

FastAPI / httpx / Uvicorn / vLLM

------------------------------------------------------------------------

## 📦 Installation

``` bash
git clone https://github.com/your-org/sg-cn-ai-gateway-poc.git
cd sg-cn-ai-gateway-poc

python -m venv .venv
source .venv/bin/activate

pip install -r requirements.txt
```

------------------------------------------------------------------------

## 🔑 Configuration

``` bash
export GATEWAY_API_KEY="demo-key"
export SOPHNET_API_URL="https://your-endpoint"
export SOPHNET_API_KEY="your-key"
export SOPHNET_AUTH_MODE="bearer"
export DEFAULT_MODEL="your-model"
```

------------------------------------------------------------------------

## 🚀 Run

``` bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

------------------------------------------------------------------------

## 🔌 API Usage

``` bash
curl http://localhost:8000/v1/chat/completions \
  -H "Authorization: Bearer demo-key" \
  -H "Content-Type: application/json" \
  -d '{"model":"test","messages":[{"role":"user","content":"Hello"}]}'
```

------------------------------------------------------------------------

## 📁 Project Structure

``` text
SG-CN/
├── main.py
├── requirements.txt
├── README.md
└── adapter/
```

------------------------------------------------------------------------

## 📊 Success Criteria

-   API callable from Singapore\
-   Correct response\
-   ≥95% success rate

------------------------------------------------------------------------

## 🛣 Roadmap

-   Phase 1: POC\
-   Phase 2: Billing\
-   Phase 3: Platform

------------------------------------------------------------------------

## 📄 License

MIT

------------------------------------------------------------------------

# ==============================

# 中文版本

# ==============================

# 🌏 新加坡---中国跨境AI网关 POC

------------------------------------------------------------------------

## 📌 项目概述

本项目用于验证跨境AI调用架构：

海外 → 新加坡网关 → 中国算力 → 返回

------------------------------------------------------------------------

## 🧱 架构

同英文部分

------------------------------------------------------------------------

## ✨ 功能

-   OpenAI兼容接口\
-   API Key鉴权\
-   跨境调用

------------------------------------------------------------------------

## 📦 安装

同英文部分

------------------------------------------------------------------------

## 🚀 启动

同英文部分

------------------------------------------------------------------------

## 🧠 结论

跨境AI基础设施层


---

## 👨‍💻 How to Use (for Clients)

### Overview
Use exactly like OpenAI API, just replace base URL:

https://api.openai.com → https://api.dcdeeptech.com

### Required Information
- Endpoint: https://api.dcdeeptech.com/v1/chat/completions
- API Key: Authorization: Bearer sk-xxxx
- Model: qwen-7b / deepseek

### Example (curl)
curl https://api.dcdeeptech.com/v1/chat/completions \
  -H "Authorization: Bearer sk-demo" \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen-7b","messages":[{"role":"user","content":"Hello"}]}'

---

## 👨‍💻 客户使用方式

### 使用方式
与 OpenAI 完全一致，只需替换：

https://api.openai.com → https://api.dcdeeptech.com

### 必需信息
- API地址：https://api.dcdeeptech.com/v1/chat/completions
- API Key：Authorization: Bearer sk-xxxx
- 模型：qwen-7b / deepseek

### 示例
curl https://api.dcdeeptech.com/v1/chat/completions \
  -H "Authorization: Bearer sk-demo" \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen-7b","messages":[{"role":"user","content":"你好"}]}'

