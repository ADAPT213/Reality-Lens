import logging
import os
from pathlib import Path
from typing import Dict, Any, Optional
import hashlib

import yaml
import onnxruntime as ort
import numpy as np

logger = logging.getLogger(__name__)


class ModelLoader:
    def __init__(self, config_path: str = "src/config/models.yaml"):
        self.config_path = config_path
        self.config = self._load_config()
        self.session: Optional[ort.InferenceSession] = None
        self.model_metadata: Dict[str, Any] = {}
        self.metrics = {
            "latency_p50": 0.0,
            "latency_p95": 0.0,
            "latency_p99": 0.0,
            "inference_count": 0,
            "latencies": []
        }
        
    def _load_config(self) -> Dict[str, Any]:
        config_file = Path(self.config_path)
        if not config_file.exists():
            logger.warning(f"Config file not found: {self.config_path}, using defaults")
            return self._get_default_config()
        
        with open(config_file, 'r') as f:
            return yaml.safe_load(f)
    
    def _get_default_config(self) -> Dict[str, Any]:
        return {
            "pose_estimation": {
                "model_name": "movenet_singlepose_lightning",
                "version": "1.0.0",
                "path": "models/movenet_lightning.onnx",
                "input_size": [192, 192],
                "confidence_threshold": 0.3,
                "num_keypoints": 17
            },
            "inference": {
                "device": "auto",
                "num_threads": 4,
                "warmup_iterations": 3
            }
        }
    
    def _detect_device(self) -> str:
        available_providers = ort.get_available_providers()
        logger.info(f"Available ONNX providers: {available_providers}")
        
        if "CUDAExecutionProvider" in available_providers:
            logger.info("GPU (CUDA) detected and will be used")
            return "CUDAExecutionProvider"
        elif "TensorrtExecutionProvider" in available_providers:
            logger.info("GPU (TensorRT) detected and will be used")
            return "TensorrtExecutionProvider"
        else:
            logger.info("Using CPU for inference")
            return "CPUExecutionProvider"
    
    def _compute_model_hash(self, model_path: Path) -> str:
        sha256_hash = hashlib.sha256()
        with open(model_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()
    
    def load_model(self) -> bool:
        pose_config = self.config.get("pose_estimation", {})
        model_path = Path(pose_config.get("path", "models/movenet_lightning.onnx"))
        
        if not model_path.exists():
            logger.error(f"Model file not found: {model_path}")
            logger.info("Please download a pose estimation model (MoveNet, RTMPose, etc.)")
            logger.info("For MoveNet: https://tfhub.dev/google/movenet/singlepose/lightning/4")
            logger.info("Convert to ONNX format and place in models/ directory")
            return False
        
        try:
            inference_config = self.config.get("inference", {})
            device_preference = inference_config.get("device", "auto")
            
            if device_preference == "auto":
                providers = [self._detect_device()]
            elif device_preference == "gpu":
                providers = ["CUDAExecutionProvider", "CPUExecutionProvider"]
            else:
                providers = ["CPUExecutionProvider"]
            
            sess_options = ort.SessionOptions()
            sess_options.intra_op_num_threads = inference_config.get("num_threads", 4)
            sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
            
            self.session = ort.InferenceSession(
                str(model_path),
                sess_options=sess_options,
                providers=providers
            )
            
            self.model_metadata = {
                "name": pose_config.get("model_name"),
                "version": pose_config.get("version"),
                "path": str(model_path),
                "sha256": self._compute_model_hash(model_path),
                "input_size": pose_config.get("input_size"),
                "num_keypoints": pose_config.get("num_keypoints"),
                "confidence_threshold": pose_config.get("confidence_threshold"),
                "provider": self.session.get_providers()[0]
            }
            
            logger.info(f"Model loaded: {self.model_metadata['name']} v{self.model_metadata['version']}")
            logger.info(f"Provider: {self.model_metadata['provider']}")
            logger.info(f"Model SHA256: {self.model_metadata['sha256'][:16]}...")
            
            self._warmup_model(inference_config.get("warmup_iterations", 3))
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            return False
    
    def _warmup_model(self, iterations: int = 3):
        if not self.session:
            return
        
        logger.info(f"Warming up model with {iterations} iterations...")
        input_name = self.session.get_inputs()[0].name
        input_shape = self.session.get_inputs()[0].shape
        
        dummy_input = np.random.randn(*input_shape).astype(np.float32)
        
        for i in range(iterations):
            _ = self.session.run(None, {input_name: dummy_input})
        
        logger.info("Model warmup complete")
    
    def get_input_details(self) -> Dict[str, Any]:
        if not self.session:
            return {}
        
        input_info = self.session.get_inputs()[0]
        return {
            "name": input_info.name,
            "shape": input_info.shape,
            "dtype": input_info.type
        }
    
    def get_output_details(self) -> Dict[str, Any]:
        if not self.session:
            return {}
        
        output_info = self.session.get_outputs()[0]
        return {
            "name": output_info.name,
            "shape": output_info.shape,
            "dtype": output_info.type
        }
    
    def update_metrics(self, latency_ms: float):
        self.metrics["inference_count"] += 1
        self.metrics["latencies"].append(latency_ms)
        
        if len(self.metrics["latencies"]) > 1000:
            self.metrics["latencies"] = self.metrics["latencies"][-1000:]
        
        if len(self.metrics["latencies"]) > 0:
            sorted_latencies = sorted(self.metrics["latencies"])
            n = len(sorted_latencies)
            self.metrics["latency_p50"] = sorted_latencies[int(n * 0.5)]
            self.metrics["latency_p95"] = sorted_latencies[int(n * 0.95)]
            self.metrics["latency_p99"] = sorted_latencies[int(n * 0.99)]
    
    def get_metrics(self) -> Dict[str, Any]:
        throughput = 0.0
        if self.metrics["latency_p50"] > 0:
            throughput = 1000.0 / self.metrics["latency_p50"]
        
        return {
            "inference_count": self.metrics["inference_count"],
            "latency_p50_ms": round(self.metrics["latency_p50"], 2),
            "latency_p95_ms": round(self.metrics["latency_p95"], 2),
            "latency_p99_ms": round(self.metrics["latency_p99"], 2),
            "throughput_fps": round(throughput, 2)
        }
