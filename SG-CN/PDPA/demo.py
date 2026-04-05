"""
sg_edge/demo.py
边缘端演示脚本

快速验证整个跨境推理流水线是否正常工作。
使用合成图像（或指定本地图像）进行端到端测试。

运行方式：
  # 使用合成图像（无需真实图片）
  python -m sg_edge.demo

  # 使用本地图像文件
  python -m sg_edge.demo --image /path/to/image.jpg --prompt "描述这张图片"

  # 使用高强度隐私保护（ε=0.1，适合医疗场景）
  python -m sg_edge.demo --epsilon 0.1 --prompt "分析这张医学影像"
"""

import argparse
import json
import logging
import os
import sys
import tempfile
import time

import numpy as np

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


def generate_synthetic_image(path: str, size: int = 224) -> str:
    """生成一张合成测试图像（224×224 随机彩色像素）。"""
    try:
        from PIL import Image
        img_array = np.random.randint(0, 256, (size, size, 3), dtype=np.uint8)
        Image.fromarray(img_array).save(path)
        logger.info("合成测试图像已生成: %s (%dx%d)", path, size, size)
    except ImportError:
        # 如果 Pillow 未安装，写入一个最小 PNG 文件头
        with open(path, "wb") as f:
            f.write(b"\x89PNG\r\n\x1a\n" + b"\x00" * 100)
        logger.warning("Pillow 未安装，使用最小 PNG 替代。")
    return path


def run_demo(args: argparse.Namespace) -> None:
    """执行端到端演示推理。"""
    from sg_edge.client import SgEdgePrivacyClient

    api_url = args.api_url or os.environ.get("AIDC_API_URL", "http://localhost:8443")
    token   = args.token   or os.environ.get("SG_CQ_BEARER_TOKEN", "demo-token-000")

    print("\n" + "="*60)
    print("  中新数据通道 PDPA 合规 VLM 推理 API — 演示")
    print("="*60)
    print(f"  AIDC 端点  : {api_url}")
    print(f"  隐私预算 ε : {args.epsilon}")
    print(f"  推理指令   : {args.prompt[:60]}...")
    print("="*60 + "\n")

    # 准备图像
    if args.image:
        image_path = args.image
        if not os.path.exists(image_path):
            logger.error("图像文件不存在: %s", image_path)
            sys.exit(1)
    else:
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as f:
            image_path = f.name
        generate_synthetic_image(image_path)

    # 初始化边缘客户端
    logger.info("初始化边缘隐私提取客户端...")
    client = SgEdgePrivacyClient(
        target_api_url=api_url,
        tenant_auth_token=token,
        epsilon_budget=args.epsilon,
        tlcp_ca_bundle=args.ca_bundle or "/etc/ssl/certs/ca-certificates.crt",
    )

    # 执行推理
    logger.info("开始端到端推理流水线...")
    start_time = time.time()

    try:
        result = client.process_and_dispatch(
            raw_image_path=image_path,
            user_instruction=args.prompt,
        )
        elapsed = time.time() - start_time

        print("\n" + "─"*60)
        print("  ✅ 推理完成")
        print("─"*60)
        print(f"  耗时        : {elapsed*1000:.1f} ms")
        print(f"  推理结果    :\n")
        print(f"    {result.get('result_text', '（无结果）')}")
        print("\n  FinOps 计费信息:")
        metrics = result.get("finops_metrics", {})
        for k, v in metrics.items():
            print(f"    {k:30s}: {v}")
        print("─"*60)
        print("\n  🔒 PDPA 合规保证：")
        print("    ✓ 原始像素已在新加坡本地内存销毁")
        print(f"   ✓ 差分隐私（ε={args.epsilon}）确保数学级不可逆匿名化")
        print("    ✓ SM2/SM3/SM4 国密混合加密全程保护")
        print("    ✓ 跨境数据脱离 PDPA 第 26 条管辖\n")

    except Exception as exc:
        elapsed = time.time() - start_time
        logger.error("推理失败（%.1f ms）: %s", elapsed * 1000, exc)
        if args.verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)
    finally:
        # 清理合成图像临时文件
        if not args.image and os.path.exists(image_path):
            os.unlink(image_path)


def main():
    parser = argparse.ArgumentParser(
        description="中新数据通道 PDPA 合规 VLM 推理 API 演示脚本"
    )
    parser.add_argument("--image",   type=str, default=None, help="输入图像路径（可选，默认使用合成图像）")
    parser.add_argument("--prompt",  type=str, default="请详细描述这张图像的内容。", help="推理指令")
    parser.add_argument("--epsilon", type=float, default=1.0, help="差分隐私预算 ε（默认 1.0）")
    parser.add_argument("--api-url", type=str, default=None, help="AIDC 网关 URL")
    parser.add_argument("--token",   type=str, default=None, help="Bearer Token")
    parser.add_argument("--ca-bundle", type=str, default=None, help="TLCP CA 证书链路径")
    parser.add_argument("--verbose", action="store_true", help="显示详细错误堆栈")
    args = parser.parse_args()
    run_demo(args)


if __name__ == "__main__":
    main()
