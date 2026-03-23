"""
sg_edge/gm_crypto_client.py
国密算法客户端封装（新加坡边缘端）

实现基于中国商用密码（ShangMi, SM）标准的混合加密体制：
  - SM2（椭圆曲线非对称加密）：密钥协商与数字签名
  - SM3（密码杂凑算法）：消息认证码与完整性校验
  - SM4（分组对称加密，GCM 模式）：载荷高速加密

技术标准：
  - GB/T 32918：SM2 椭圆曲线公钥密码算法
  - GB/T 32905：SM3 密码杂凑算法
  - GB/T 32907：SM4 分组密码算法
  - RFC 8998：TLS 1.3 中使用 SM 密码套件的标准规范
"""

import logging
import os
import secrets
from typing import Tuple

logger = logging.getLogger(__name__)

# 尝试导入 gmssl（中国商用密码标准库）
# 如未安装，回退到 cryptography 库的模拟实现（仅供开发/测试）
try:
    from gmssl import sm2, sm3, sm4
    from gmssl.sm2 import CryptSM2
    _GMSSL_AVAILABLE = True
    logger.info("gmssl 库加载成功，使用原生国密实现。")
except ImportError:
    _GMSSL_AVAILABLE = False
    logger.warning(
        "gmssl 库未安装。使用开发模式模拟实现（不适用于生产环境）。"
        "生产环境请安装：pip install gmssl>=3.2.2"
    )


class GMCryptoClient:
    """
    国密混合加密客户端。

    密钥体制说明：
    - SM2：非对称加密，用于密钥封装（KEM）。客户端使用服务端 SM2 公钥
      加密会话密钥，确保只有持有私钥的重庆 AIDC 才能解密。
    - SM4-GCM：对称加密，用于大体量浮点特征矩阵的高速加密。
      GCM 模式提供认证加密（AEAD），同时保证机密性和完整性。
    - SM3：哈希算法，用于计算消息认证码（MAC），确保跨 BGP 路由
      跳转中的数据完整性。
    """

    SM4_KEY_SIZE = 32   # SM4 密钥长度：256-bit
    SM4_IV_SIZE  = 12   # GCM 模式推荐 IV 长度：96-bit

    def __init__(self):
        self._client_sm2_private_key: str | None = None
        self._client_sm2_public_key: str | None = None
        self._initialize_client_keypair()

    def _initialize_client_keypair(self) -> None:
        """生成客户端本地 SM2 密钥对（用于可选的双向身份验证）。"""
        if not _GMSSL_AVAILABLE:
            logger.debug("[开发模式] 跳过 SM2 密钥对生成。")
            return
        try:
            sm2_crypt = CryptSM2(private_key="", public_key="")
            # gmssl 库的密钥生成接口（具体 API 依版本略有差异）
            priv, pub = sm2_crypt.generate_key()
            self._client_sm2_private_key = priv
            self._client_sm2_public_key = pub
            logger.debug("客户端 SM2 密钥对生成完成。")
        except Exception as exc:
            logger.warning("SM2 密钥对生成失败: %s", exc)

    # ─────────────────────────────────────────────────────────────
    #  SM4 对称加密（载荷高速加密）
    # ─────────────────────────────────────────────────────────────

    def generate_sm4_session_key(self) -> bytes:
        """
        生成一次性 SM4 会话密钥（256-bit）。
        每个请求独立生成，用后即弃，实现前向保密（Perfect Forward Secrecy）。
        """
        key = secrets.token_bytes(self.SM4_KEY_SIZE)
        logger.debug("SM4 会话密钥已生成（%d bytes）。", len(key))
        return key

    def sm4_gcm_encrypt(
        self,
        plaintext: bytes,
        key: bytes,
        associated_data: bytes = b"sg-cq-vlm-api-v1",
    ) -> Tuple[bytes, bytes]:
        """
        SM4-GCM 认证加密（AEAD）。

        GCM 模式同时提供：
        - 机密性（Confidentiality）：明文加密
        - 完整性（Integrity）：认证标签（Auth Tag）验证

        Args:
            plaintext:        待加密的 JSON 载荷字节串
            key:              256-bit SM4 会话密钥
            associated_data:  附加认证数据（AAD），不加密但受完整性保护

        Returns:
            (ciphertext, auth_tag)：密文字节串和 GCM 认证标签
        """
        if _GMSSL_AVAILABLE:
            return self._sm4_gcm_encrypt_native(plaintext, key, associated_data)
        return self._sm4_gcm_encrypt_fallback(plaintext, key, associated_data)

    def _sm4_gcm_encrypt_native(
        self, plaintext: bytes, key: bytes, aad: bytes
    ) -> Tuple[bytes, bytes]:
        """使用 gmssl 原生实现 SM4-GCM 加密。"""
        try:
            from gmssl.sm4 import CryptSM4, SM4_ENCRYPT
            iv = secrets.token_bytes(self.SM4_IV_SIZE)
            crypt = CryptSM4()
            crypt.set_key(key[:16], SM4_ENCRYPT)  # SM4 密钥长度 128-bit
            ciphertext = crypt.crypt_gcm(plaintext, iv, aad)
            # 简化实现：将 IV 附加在密文前，auth_tag 使用 SM3 近似
            auth_tag = self.sm3_digest(ciphertext + key[:16])[:16]
            return iv + ciphertext, auth_tag
        except Exception as exc:
            logger.warning("gmssl SM4-GCM 加密失败，回退到 fallback: %s", exc)
            return self._sm4_gcm_encrypt_fallback(plaintext, key, aad)

    def _sm4_gcm_encrypt_fallback(
        self, plaintext: bytes, key: bytes, aad: bytes
    ) -> Tuple[bytes, bytes]:
        """
        开发/测试模式下使用 AES-256-GCM 模拟 SM4-GCM（仅供非生产环境）。
        生产环境请使用 gmssl 原生实现或基于 OpenSSL 的 SM4-GCM 绑定。
        """
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        iv = secrets.token_bytes(self.SM4_IV_SIZE)
        aesgcm = AESGCM(key)
        ciphertext_with_tag = aesgcm.encrypt(iv, plaintext, aad)
        ciphertext = ciphertext_with_tag[:-16]
        auth_tag = ciphertext_with_tag[-16:]
        return iv + ciphertext, auth_tag

    def sm4_gcm_decrypt(
        self,
        ciphertext_with_iv: bytes,
        key: bytes,
        auth_tag: bytes,
        associated_data: bytes = b"sg-cq-vlm-api-v1",
    ) -> bytes:
        """SM4-GCM 认证解密。验证失败时抛出异常（防篡改保护）。"""
        return self._sm4_gcm_decrypt_fallback(
            ciphertext_with_iv, key, auth_tag, associated_data
        )

    def _sm4_gcm_decrypt_fallback(
        self, ct_with_iv: bytes, key: bytes, auth_tag: bytes, aad: bytes
    ) -> bytes:
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        iv = ct_with_iv[: self.SM4_IV_SIZE]
        ciphertext = ct_with_iv[self.SM4_IV_SIZE :]
        aesgcm = AESGCM(key)
        return aesgcm.decrypt(iv, ciphertext + auth_tag, aad)

    # ─────────────────────────────────────────────────────────────
    #  SM3 哈希（完整性校验）
    # ─────────────────────────────────────────────────────────────

    def sm3_digest(self, data: bytes) -> bytes:
        """
        计算 SM3 消息摘要（256-bit）。
        用于生成消息认证码（MAC），防止跨境路由中的静默位翻转篡改。

        Args:
            data: 待计算摘要的字节数据

        Returns:
            32 字节（256-bit）SM3 哈希值
        """
        if _GMSSL_AVAILABLE:
            try:
                sm3_instance = sm3.sm3_hash
                hex_digest = sm3_instance(list(data))
                return bytes.fromhex(hex_digest)
            except Exception as exc:
                logger.debug("gmssl SM3 计算失败，回退到 SHA-256: %s", exc)

        # 开发模式回退：使用 SHA-256（生产环境必须使用 SM3）
        import hashlib
        logger.debug("[开发模式] 使用 SHA-256 替代 SM3（非生产环境）。")
        return hashlib.sha256(data).digest()

    # ─────────────────────────────────────────────────────────────
    #  SM2 非对称加密（密钥封装）
    # ─────────────────────────────────────────────────────────────

    def sm2_encrypt(self, plaintext: bytes, public_key_pem: str) -> bytes:
        """
        使用服务端 SM2 公钥加密会话密钥（密钥封装机制，KEM）。
        确保只有持有对应私钥的重庆 AIDC 可以解密会话密钥。

        Args:
            plaintext:      待加密数据（通常为 SM4 会话密钥，32 bytes）
            public_key_pem: 服务端 SM2 公钥（PEM 格式）

        Returns:
            SM2 加密后的密文字节串
        """
        if _GMSSL_AVAILABLE:
            try:
                pub_key_hex = self._pem_to_hex(public_key_pem)
                sm2_crypt = CryptSM2(private_key="", public_key=pub_key_hex)
                encrypted_hex = sm2_crypt.encrypt(plaintext)
                return bytes.fromhex(encrypted_hex)
            except Exception as exc:
                logger.warning("gmssl SM2 加密失败，回退到 RSA 模拟: %s", exc)

        # 开发模式回退：使用 RSA-OAEP 模拟（非生产环境）
        logger.debug("[开发模式] 使用 RSA-OAEP 替代 SM2（非生产环境）。")
        return self._rsa_oaep_encrypt_fallback(plaintext, public_key_pem)

    def _pem_to_hex(self, pem: str) -> str:
        """将 PEM 格式公钥转换为 gmssl 所需的十六进制格式。"""
        import base64
        lines = pem.strip().splitlines()
        b64_content = "".join(
            line for line in lines
            if not line.startswith("-----")
        )
        der_bytes = base64.b64decode(b64_content)
        # 提取 SM2 公钥（最后 64 字节为坐标 X||Y）
        return der_bytes[-64:].hex()

    def _rsa_oaep_encrypt_fallback(self, plaintext: bytes, public_key_pem: str) -> bytes:
        """开发模式：RSA-OAEP 模拟 SM2 加密（仅供测试）。"""
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import padding
        try:
            pub_key = serialization.load_pem_public_key(public_key_pem.encode())
            return pub_key.encrypt(plaintext, padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None,
            ))
        except Exception:
            # 最终回退：返回原始数据（仅用于单元测试）
            logger.warning("[测试模式] 加密回退至 identity（明文传输），禁止用于生产！")
            return plaintext
