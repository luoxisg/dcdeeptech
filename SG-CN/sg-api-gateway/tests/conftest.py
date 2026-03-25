import os
os.environ.update({
    "ENVIRONMENT": "development",
    "DEBUG": "true",
    "REDIS_URL": "redis://localhost:6379/15",
    "ADMIN_API_KEY": "test_admin_key_for_unit_tests_only",
    "CQ_BACKEND_PRIMARY": "http://mock-cq-primary:8080",
    "CQ_BACKEND_STANDBY": "http://mock-cq-standby:8080",
    "LOG_FORMAT": "console",
    "LOG_FILE": "",
    "AUDIT_LOG_FILE": "",
})
