"""
sg_edge/vision_encoder.py
轻量级视觉编码器（ViT-based）

核心职责：将高分辨率像素矩阵降维为语义特征向量。
这是"边缘-云正交解耦"架构中实现"数据效用与数据可见性绝对分离"的关键组件。

架构说明：
  使用与重庆云端大模型同源的视觉编码器（ViT 前若干层网络）在边缘端执行
  特征提取，使得云端模型可直接接收特征向量作为输入，无需重复提取步骤。

  像素矩阵 (H×W×3) → [ViT Patch Embedding + Transformer Blocks] → 特征向量 (N_patches × D)

PDPA 合规意义：
  - 特征提取完成后，原始像素在边缘端内存中物理销毁
  - 特征向量不包含可直接识别个人的像素信息
  - 结合差分隐私注入后，理论上无法通过逆向重构攻击还原原始图像
"""

import logging
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)

# 轻量级 ViT 配置预设
ViT_CONFIGS = {
    "vit-tiny-patch16":    {"image_size": 224, "patch_size": 16, "embed_dim": 192, "num_layers": 4},
    "vit-small-patch16":   {"image_size": 224, "patch_size": 16, "embed_dim": 384, "num_layers": 6},
    "vit-base-patch16":    {"image_size": 224, "patch_size": 16, "embed_dim": 768, "num_layers": 12},
    "vit-large-patch16":   {"image_size": 224, "patch_size": 16, "embed_dim": 1024, "num_layers": 24},
}

DEFAULT_MODEL = "vit-small-patch16"


class LightweightVisionEncoder:
    """
    边缘端轻量级视觉编码器。

    负责将包含 PII 的高维像素矩阵压缩为抽象语义向量，
    提取完成后立即通知调用方销毁原始像素缓存。

    支持两种后端：
    1. PyTorch（生产环境推荐）：加载本地预训练 ViT 权重
    2. NumPy 模拟（开发环境）：使用随机投影近似特征提取
    """

    def __init__(
        self,
        model_name: str = DEFAULT_MODEL,
        model_weights_path: Optional[str] = None,
        device: str = "cpu",
    ):
        """
        Args:
            model_name:          ViT 模型规格（见 ViT_CONFIGS）
            model_weights_path:  本地预训练权重路径（None 则使用模拟模式）
            device:              计算设备（'cpu' 或 'cuda'）
        """
        if model_name not in ViT_CONFIGS:
            raise ValueError(f"不支持的模型规格 {model_name}，可用: {list(ViT_CONFIGS.keys())}")

        self.model_name = model_name
        self.config = ViT_CONFIGS[model_name]
        self.device = device
        self._model = None
        self._simulation_mode = True

        if model_weights_path:
            self._load_model(model_weights_path)
        else:
            logger.warning(
                "未提供模型权重路径，启用 NumPy 随机投影模拟模式（仅供开发）。"
                "生产环境请提供 model_weights_path。"
            )

    def _load_model(self, weights_path: str) -> None:
        """加载本地预训练 ViT 权重。"""
        try:
            import torch
            import torchvision.models as models

            self._model = torch.load(weights_path, map_location=self.device)
            self._model.eval()
            self._simulation_mode = False
            logger.info("ViT 模型加载完成: %s -> %s", weights_path, self.device)
        except Exception as exc:
            logger.warning("ViT 模型加载失败，回退到模拟模式: %s", exc)

    def _preprocess(self, image_array: np.ndarray) -> np.ndarray:
        """
        图像预处理：调整尺寸 + 归一化。

        Args:
            image_array: (H, W, 3) 浮点数组，值域 [0, 1]

        Returns:
            调整后的 (target_size, target_size, 3) 数组
        """
        target_size = self.config["image_size"]
        h, w = image_array.shape[:2]

        if h != target_size or w != target_size:
            try:
                from PIL import Image
                img = Image.fromarray((image_array * 255).astype(np.uint8))
                img = img.resize((target_size, target_size), Image.BICUBIC)
                image_array = np.array(img, dtype=np.float32) / 255.0
            except ImportError:
                # 简单的中心裁剪回退
                min_dim = min(h, w)
                start_h = (h - min_dim) // 2
                start_w = (w - min_dim) // 2
                image_array = image_array[start_h:start_h+min_dim, start_w:start_w+min_dim]
                # 粗略降采样
                factor = min_dim // target_size
                if factor > 1:
                    image_array = image_array[::factor, ::factor]
                image_array = image_array[:target_size, :target_size]

        # ImageNet 标准化（近似）
        mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
        std  = np.array([0.229, 0.224, 0.225], dtype=np.float32)
        return (image_array - mean) / (std + 1e-7)

    def encode(
        self,
        image_array: np.ndarray,
        sensitivity_mask: Optional[object] = None,
    ) -> np.ndarray:
        """
        执行视觉特征提取。

        Args:
            image_array:      原始图像像素矩阵 (H, W, 3)
            sensitivity_mask: 可选的 PII 敏感区域热力图（SensitivityHeatMap）
                              当前版本暂未使用（预留扩展接口）

        Returns:
            特征向量矩阵，形状 (N_patches, embed_dim)
            N_patches = (image_size / patch_size)²
        """
        preprocessed = self._preprocess(image_array)

        if not self._simulation_mode and self._model is not None:
            return self._encode_with_model(preprocessed)
        return self._encode_simulation(preprocessed)

    def _encode_with_model(self, preprocessed: np.ndarray) -> np.ndarray:
        """使用 PyTorch ViT 模型执行真实特征提取。"""
        import torch
        tensor = torch.tensor(preprocessed).permute(2, 0, 1).unsqueeze(0)
        tensor = tensor.to(self.device)
        with torch.no_grad():
            features = self._model(tensor)
        return features.cpu().numpy().squeeze(0)

    def _encode_simulation(self, preprocessed: np.ndarray) -> np.ndarray:
        """
        开发模式：使用随机投影矩阵模拟 ViT 特征提取。
        输出与真实 ViT 输出形状相同，但语义内容无意义（仅供单元测试）。
        """
        patch_size  = self.config["patch_size"]
        image_size  = self.config["image_size"]
        embed_dim   = self.config["embed_dim"]
        n_patches   = (image_size // patch_size) ** 2

        # 将图像分割为 patch 序列
        patches = preprocessed.reshape(
            image_size // patch_size, patch_size,
            image_size // patch_size, patch_size,
            3,
        ).transpose(0, 2, 1, 3, 4).reshape(n_patches, -1)

        # 随机投影到 embed_dim 维（固定种子保持可重现）
        rng = np.random.RandomState(seed=42)
        projection = rng.randn(patches.shape[1], embed_dim).astype(np.float32)
        projection /= np.sqrt(patches.shape[1])  # 归一化

        features = patches @ projection

        logger.debug(
            "[模拟模式] 特征提取完成 | 输入形状=%s | 输出形状=%s",
            preprocessed.shape, features.shape,
        )
        return features

    @property
    def output_shape(self) -> tuple:
        """返回编码器输出的特征向量形状 (N_patches, embed_dim)。"""
        n_patches = (self.config["image_size"] // self.config["patch_size"]) ** 2
        return (n_patches, self.config["embed_dim"])
