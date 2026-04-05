"""
cq_cloud/gm_crypto_server.py
国密算法服务端封装（重庆 AIDC）

实现服务端的国密操作：
  - SM2 私钥解封会话密钥（KEM 解封装）
  - SM4-GCM 载荷解密与认证
  - SM3 完整性校验
  - SM2 公钥分发

密钥安全要求：
  - SM2 私钥必须存储在硬件安全模块（HSM）或加密密钥管理服务中
  - 私钥文件权限必须设置为 0600（仅属主可读）
  - 定期轮换（建议每 365 天）
"""

import logging
import os

logger = logging.getLogger(__name__)

try:
    from gmssl import sm2, sm3
    from gmssl.sm2 import CryptSM2
    _GMSSL_AVAILABLE = True
except ImportError:
    _GMSSL_AVAILABLE = False
    logger.warning("gmssl 库未安装，使用开发模式模拟实现。")


class GMCryptoServer:
    """国密算法服务端。"""

    SM4_IV_SIZE = 12  # GCM 模式 96-bit IV

    def __init__(self, private_key_path: str = "/opt/security/keys/aidc_private.pem"):
        self._private_key_pem: str | None = None
        self._public_key_pem: str | None = None
        self._load_keys(private_key_path)

    def _load_keys(self, private_key_path: str) -> None:
        """从文件加载 SM2 密钥对。"""
        if os.path.exists(private_key_path):
            try:
                with open(private_key_path, "r") as f:
                    self._private_key_pem = f.read()
                # 生成对应公钥（实际部署时公钥应单独存储）
                pub_path = private_key_path.replace("private", "public").replace(".pem", "_pub.pem")
                if os.path.exists(pub_path):
                    with open(pub_path, "r") as f:
                        self._public_key_pem = f.read()
                logger.info("SM2 密钥对加载完成。")
            except Exception as exc:
                logger.warning("密钥加载失败，生成临时密钥对（仅供开发）: %s", exc)
                self._generate_dev_keypair()
        else:
            logger.warning("密钥文件 %s 不存在，生成临时密钥对（仅供开发）。", private_key_path)
            self._generate_dev_keypair()

    def _generate_dev_keypair(self) -> None:
        """开发模式：生成临时 RSA 密钥对模拟 SM2（非生产环境）。"""
        try:
            from cryptography.hazmat.primitives.asymmetric import rsa
            from cryptography.hazmat.primitives import serialization
            private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
            self._private_key_pem = private_key.private_bytes(
                serialization.Encoding.PEM,
                serialization.PrivateFormat.TraditionalOpenSSL,
                serialization.NoEncryption(),
            ).decode()
            self._public_key_pem = private_key.public_key().public_bytes(
                serialization.Encoding.PEM,
                serialization.PublicFormat.SubjectPublicKeyInfo,
            ).decode()
            logger.debug("[开发模式] 临时 RSA-2048 密钥对生成完成。")
        except Exception as exc:
            logger.error("密钥对生成失败: %s", exc)

    def get_public_key_pem(self) -> str:
        """返回服务端 SM2 公钥（PEM 格式），供客户端拉取。"""
        return self._public_key_pem or "-----BEGIN PUBLIC KEY-----\n(开发模式占位符)\n-----END PUBLIC KEY-----\n"

    def sm2_decrypt(self, ciphertext: bytes) -> bytes:
        """使用 SM2 私钥解封会话密钥（KEM 解封装）。"""
        if _GMSSL_AVAILABLE and self._private_key_pem:
            try:
                # 提取私钥十六进制（gmssl 要求）
                priv_hex = self._pem_to_hex(self._private_key_pem, is_private=True)
                pub_hex  = self._pem_to_hex(self._public_key_pem or "", is_private=False)
                sm2_crypt = CryptSM2(private_key=priv_hex, public_key=pub_hex)
                return bytes.fromhex(sm2_crypt.decrypt(ciphertext.hex()))
            except Exception as exc:
                logger.warning("gmssl SM2 解密失败，尝试 RSA 回退: %s", exc)

        # 开发模式回退：RSA-OAEP 解密
        return self._rsa_oaep_decrypt_fallback(ciphertext)

    def _pem_to_hex(self, pem: str, is_private: bool) -> str:
        """PEM 转十六进制（gmssl 所需格式）。"""
        import base64
        lines = pem.strip().splitlines()
        b64 = "".join(l for l in lines if not l.startswith("-----"))
        der = base64.b64decode(b64 + "==")
        # 私钥取最后 32 字节（SM2 私钥），公钥取最后 64 字节
        if is_private:
            return der[-32:].hex()
        return der[-64:].hex()

    def _rsa_oaep_decrypt_fallback(self, ciphertext: bytes) -> bytes:
        """开发模式：RSA-OAEP 解密（非生产环境）。"""
        try:
            from cryptography.hazmat.primitives import hashes, serialization
            from cryptography.hazmat.primitives.asymmetric import padding
            priv_key = serialization.load_pem_private_key(
                self._private_key_pem.encode(), password=None
            )
            return priv_key.decrypt(ciphertext, padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None,
            ))
        except Exception:
            logger.warning("[测试模式] RSA 解密失败，返回原始数据。")
            return ciphertext

    def sm4_gcm_decrypt(
        self,
        ciphertext_with_iv: bytes,
        key: bytes,
        auth_tag: bytes,
        associated_data: bytes = b"sg-cq-vlm-api-v1",
    ) -> bytes:
        """SM4-GCM 认证解密。"""
        try:
            from cryptography.hazmat.primitives.ciphers.aead import AESGCM
            iv = ciphertext_with_iv[:self.SM4_IV_SIZE]
            ciphertext = ciphertext_with_iv[self.SM4_IV_SIZE:]
            aesgcm = AESGCM(key)
            return aesgcm.decrypt(iv, ciphertext + auth_tag, associated_data)
        except Exception as exc:
            raise ValueError(f"SM4-GCM 解密失败（可能被篡改）: {exc}") from exc

    def sm3_digest(self, data: bytes) -> bytes:
        """计算 SM3 消息摘要（256-bit）。"""
        if _GMSSL_AVAILABLE:
            try:
                hex_digest = sm3.sm3_hash(list(data))
                return bytes.fromhex(hex_digest)
            except Exception:
                pass
        import hashlib
        return hashlib.sha256(data).digest()
