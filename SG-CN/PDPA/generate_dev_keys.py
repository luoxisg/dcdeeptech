#!/usr/bin/env python3
"""
scripts/generate_dev_keys.py
开发环境密钥生成工具

为本地开发环境生成 SM2 / RSA 密钥对和自签名证书。
⚠️  生成的密钥仅用于开发和测试，绝对不可用于生产环境。
    生产环境密钥必须通过硬件安全模块（HSM）或受信任的证书颁发机构（CA）生成。

使用方式：
  python scripts/generate_dev_keys.py --output-dir ./keys/dev
"""

import argparse
import os
import subprocess
import sys
from pathlib import Path


def generate_rsa_keypair_openssl(output_dir: Path) -> None:
    """使用 OpenSSL 生成 RSA-2048 密钥对（模拟 SM2，开发用）。"""
    private_key_path = output_dir / "aidc_private.pem"
    public_key_path  = output_dir / "aidc_public.pem"
    cert_path        = output_dir / "aidc_cert.pem"

    print("生成 RSA-2048 开发密钥对（模拟 SM2）...")

    # 生成私钥
    subprocess.run([
        "openssl", "genrsa",
        "-out", str(private_key_path),
        "2048",
    ], check=True, capture_output=True)

    # 提取公钥
    subprocess.run([
        "openssl", "rsa",
        "-in", str(private_key_path),
        "-pubout",
        "-out", str(public_key_path),
    ], check=True, capture_output=True)

    # 生成自签名证书
    subprocess.run([
        "openssl", "req", "-x509",
        "-key", str(private_key_path),
        "-out", str(cert_path),
        "-days", "365",
        "-subj", "/CN=cq-aidc-dev/O=DevEnv/C=CN",
        "-addext", "subjectAltName=DNS:localhost,IP:127.0.0.1",
    ], check=True, capture_output=True)

    # 设置私钥权限（仅属主可读）
    os.chmod(private_key_path, 0o600)

    print(f"  ✅ 私钥     : {private_key_path}")
    print(f"  ✅ 公钥     : {public_key_path}")
    print(f"  ✅ 自签名证书: {cert_path}")


def generate_sm2_keypair_gmssl(output_dir: Path) -> None:
    """使用 gmssl 生成真正的 SM2 密钥对（需要安装 gmssl 库）。"""
    try:
        from gmssl.sm2 import CryptSM2
    except ImportError:
        print("  ⚠️  gmssl 未安装，跳过 SM2 密钥生成。")
        print("     安装命令：pip install gmssl>=3.2.2")
        return

    sm2_crypt = CryptSM2(private_key="", public_key="")

    try:
        priv_key, pub_key = sm2_crypt.generate_key()
    except AttributeError:
        print("  ⚠️  当前 gmssl 版本不支持 generate_key()，请升级至 3.2.2+")
        return

    sm2_priv_path = output_dir / "aidc_sm2_private.hex"
    sm2_pub_path  = output_dir / "aidc_sm2_public.hex"

    sm2_priv_path.write_text(priv_key)
    sm2_pub_path.write_text(pub_key)
    os.chmod(sm2_priv_path, 0o600)

    print(f"  ✅ SM2 私钥（hex）: {sm2_priv_path}")
    print(f"  ✅ SM2 公钥（hex）: {sm2_pub_path}")


def generate_ca_bundle(output_dir: Path) -> None:
    """生成开发环境 TLCP CA 证书包（使用自签名证书模拟）。"""
    cert_path   = output_dir / "aidc_cert.pem"
    bundle_path = output_dir.parent / "certs" / "ca-bundle-tlcp-compliant.crt"
    bundle_path.parent.mkdir(parents=True, exist_ok=True)

    if cert_path.exists():
        import shutil
        shutil.copy(cert_path, bundle_path)
        print(f"  ✅ TLCP CA 证书包: {bundle_path}")
    else:
        print(f"  ⚠️  证书文件不存在: {cert_path}，跳过 CA 包生成。")


def main():
    parser = argparse.ArgumentParser(description="开发环境密钥生成工具")
    parser.add_argument(
        "--output-dir", type=str, default="./keys/dev",
        help="密钥输出目录（默认：./keys/dev）",
    )
    parser.add_argument(
        "--sm2", action="store_true",
        help="同时生成真正的 SM2 密钥对（需要 gmssl>=3.2.2）",
    )
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    print("\n🔑 开发环境密钥生成工具")
    print("⚠️  警告：以下密钥仅供开发/测试使用，禁止用于生产环境！\n")

    try:
        generate_rsa_keypair_openssl(output_dir)
    except subprocess.CalledProcessError as e:
        print(f"  ❌ OpenSSL 命令失败: {e}")
        print("     请确保系统已安装 OpenSSL。")
        sys.exit(1)
    except FileNotFoundError:
        print("  ❌ 未找到 openssl 命令。")
        print("     Ubuntu/Debian: sudo apt-get install openssl")
        print("     macOS:         brew install openssl")
        sys.exit(1)

    if args.sm2:
        print("\n生成 SM2 密钥对...")
        generate_sm2_keypair_gmssl(output_dir)

    generate_ca_bundle(output_dir)

    print("\n✅ 密钥生成完成！")
    print(f"   密钥目录: {output_dir.resolve()}")
    print("\n下一步：")
    print("  1. 将 AIDC_API_URL 和 SG_CQ_BEARER_TOKEN 设置为环境变量")
    print("  2. 运行演示脚本：python -m sg_edge.demo")
    print("  3. 或启动完整服务：docker-compose up --build")


if __name__ == "__main__":
    main()
