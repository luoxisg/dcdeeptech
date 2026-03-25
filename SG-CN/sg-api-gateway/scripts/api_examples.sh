#!/usr/bin/env bash
# ============================================================
# API 使用示例 - 完整 cURL 演示
# 前提：服务已启动，ADMIN_API_KEY 已设置
# ============================================================

BASE_URL="${BASE_URL:-https://localhost}"
ADMIN_KEY="${ADMIN_API_KEY:-your_admin_key_here}"

echo "════════════════════════════════════════"
echo "  SG API Gateway - cURL 示例"
echo "════════════════════════════════════════"

# ── 1. 健康检查 ───────────────────────────────────────────
echo ""
echo "1️⃣  健康检查"
curl -sk "${BASE_URL}/health" | python3 -m json.tool

# ── 2. 创建 API Key（管理员操作）─────────────────────────
echo ""
echo "2️⃣  创建租户 API Key"
CREATE_RESPONSE=$(curl -sk -X POST "${BASE_URL}/admin/keys" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${ADMIN_KEY}" \
  -d '{
    "tenant_id": "acme-corp",
    "project_id": "ai-assistant",
    "scope": "write",
    "rate_limit_qps": 20,
    "rate_limit_daily": 50000,
    "description": "ACME Corp AI assistant project"
  }')
echo "$CREATE_RESPONSE" | python3 -m json.tool

TENANT_KEY=$(echo "$CREATE_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['api_key'])" 2>/dev/null || echo "")
echo ""
echo "   ✓ Tenant API Key: ${TENANT_KEY}"

# ── 3. 转发推理请求（自动PDPA过滤）────────────────────────
echo ""
echo "3️⃣  转发推理请求（含PDPA敏感字段，将被自动过滤）"
curl -sk -X POST "${BASE_URL}/api/v1/forward" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${TENANT_KEY:-test_key}" \
  -d '{
    "path": "/v1/chat/completions",
    "method": "POST",
    "payload": {
      "model": "llama3-70b",
      "messages": [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Summarize the quarterly report."}
      ],
      "temperature": 0.7,
      "max_tokens": 1024,
      "nric": "S1234567A",
      "email": "user@example.com"
    }
  }' | python3 -m json.tool

# ── 4. 查看 PDPA 字段过滤策略 ────────────────────────────
echo ""
echo "4️⃣  查看当前 PDPA 字段策略"
curl -sk "${BASE_URL}/api/v1/compliance/field-policy" \
  -H "X-API-Key: ${TENANT_KEY:-test_key}" | python3 -m json.tool

# ── 5. 查看后端链路状态（管理员）────────────────────────
echo ""
echo "5️⃣  后端链路状态（主/备节点）"
curl -sk "${BASE_URL}/admin/backend/status" \
  -H "X-API-Key: ${ADMIN_KEY}" | python3 -m json.tool

# ── 6. 撤销 API Key ─────────────────────────────────────
echo ""
echo "6️⃣  撤销 API Key（如需）"
echo "   curl -sk -X DELETE '${BASE_URL}/admin/keys' \\"
echo "     -H 'X-API-Key: ${ADMIN_KEY}' \\"
echo "     -d '{\"api_key\": \"<key_to_revoke>\"}'"

echo ""
echo "════════════════════════════════════════"
echo "  完成！查看审计日志："
echo "  docker compose exec gateway tail -f /var/log/sg-gateway/audit.log"
echo "  docker compose exec gateway tail -f /var/log/sg-gateway/pdpa-audit.log"
echo "════════════════════════════════════════"
