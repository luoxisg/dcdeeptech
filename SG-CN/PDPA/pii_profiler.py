"""
sg_edge/pii_profiler.py
PII 风险探测器

负责对输入图像进行实体级别的隐私敏感度画像，
圈定包含高风险个人身份信息（PII）的感兴趣区域（ROI）。

支持的 PII 检测类别：
  - 人脸（Face）：直接标识符，高风险
  - 车牌号（License Plate）：可间接关联个人
  - 医疗文档文字（Medical Text）：特殊类别个人数据
  - 证件信息（ID Documents）：直接标识符
  - 手写签名（Handwritten Signature）：生物特征标识符
"""

import logging
from dataclasses import dataclass, field
from typing import List

import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class PIIRegion:
    """检测到的 PII 区域信息。"""
    x1: int
    y1: int
    x2: int
    y2: int
    category: str     # 例如：'face', 'license_plate', 'medical_text'
    risk_score: float  # 0.0（低风险）到 1.0（高风险）


@dataclass
class SensitivityHeatMap:
    """全图 PII 风险热力图。"""
    pixel_mask: np.ndarray        # 与输入图像同分辨率的归一化风险矩阵（H×W）
    detected_regions: List[PIIRegion] = field(default_factory=list)
    overall_risk: float = 0.0


class PIIRiskProfiler:
    """
    实体级别 PII 风险探测器。

    生产环境建议使用：
    - 人脸检测：MTCNN、RetinaFace 或 InsightFace（本地离线运行）
    - 文字识别：PaddleOCR（离线模型，检测证件号、姓名等关键字）
    - 车牌检测：专用 YOLO 变体模型

    本实现提供接口规范，具体模型权重由部署方提供。
    """

    def __init__(self, model_dir: str = "/opt/edge_models"):
        self.model_dir = model_dir
        self._models_loaded = False
        self._try_load_models()

    def _try_load_models(self) -> None:
        """尝试加载本地离线模型权重。"""
        import os
        if os.path.isdir(self.model_dir):
            logger.info("从 %s 加载 PII 探测模型...", self.model_dir)
            # 实际部署时在此加载 RetinaFace、PaddleOCR 等模型
            self._models_loaded = True
        else:
            logger.warning(
                "模型目录 %s 不存在，将使用启发式备用探测逻辑。", self.model_dir
            )

    def evaluate_sensitivity(self, image_array: np.ndarray) -> SensitivityHeatMap:
        """
        对输入图像进行全域 PII 敏感度评估。

        Args:
            image_array: 归一化 RGB 图像矩阵，形状 (H, W, 3)，值域 [0, 1]

        Returns:
            SensitivityHeatMap：包含逐像素风险分值和检测到的 PII 区域列表
        """
        h, w = image_array.shape[:2]
        heat_map = np.zeros((h, w), dtype=np.float32)
        detected_regions: List[PIIRegion] = []

        if self._models_loaded:
            detected_regions = self._run_model_detection(image_array)
        else:
            detected_regions = self._heuristic_detection(image_array)

        # 将检测区域投影到热力矩阵
        for region in detected_regions:
            risk = region.risk_score
            heat_map[region.y1:region.y2, region.x1:region.x2] = np.maximum(
                heat_map[region.y1:region.y2, region.x1:region.x2], risk
            )

        overall_risk = float(np.mean(heat_map))
        logger.info(
            "PII 风险评估完成 | 检测到 %d 个区域 | 整体风险=%.3f",
            len(detected_regions), overall_risk,
        )
        return SensitivityHeatMap(
            pixel_mask=heat_map,
            detected_regions=detected_regions,
            overall_risk=overall_risk,
        )

    def _run_model_detection(self, image_array: np.ndarray) -> List[PIIRegion]:
        """使用已加载的模型运行检测（生产环境实现）。"""
        # 此处接入 RetinaFace、PaddleOCR 等本地模型
        return []

    def _heuristic_detection(self, image_array: np.ndarray) -> List[PIIRegion]:
        """
        启发式备用探测（无模型时使用）。
        简单将图像上半部分标记为中风险（人脸通常出现在上半区域）。
        """
        h, w = image_array.shape[:2]
        return [
            PIIRegion(
                x1=0, y1=0, x2=w, y2=h // 2,
                category="heuristic_upper_region",
                risk_score=0.5,
            )
        ]
