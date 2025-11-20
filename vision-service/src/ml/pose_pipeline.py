import logging
import time
from typing import Dict, List, Any, Tuple, Optional
from pathlib import Path

import numpy as np
import cv2
from PIL import Image

from .model_loader import ModelLoader

logger = logging.getLogger(__name__)


class PosePipeline:
    def __init__(self, model_loader: ModelLoader):
        self.model_loader = model_loader
        self.config = model_loader.config
        
    def preprocess_image(self, image_path: str) -> np.ndarray:
        pose_config = self.config.get("pose_estimation", {})
        target_size = tuple(pose_config.get("input_size", [192, 192]))
        
        img = cv2.imread(image_path)
        if img is None:
            raise ValueError(f"Failed to load image: {image_path}")
        
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        img_resized = cv2.resize(img_rgb, target_size)
        img_normalized = img_resized.astype(np.float32) / 255.0
        img_batch = np.expand_dims(img_normalized, axis=0)
        
        return img_batch
    
    def run_inference(self, preprocessed_image: np.ndarray) -> np.ndarray:
        if not self.model_loader.session:
            raise RuntimeError("Model not loaded. Call model_loader.load_model() first.")
        
        start_time = time.perf_counter()
        
        input_name = self.model_loader.session.get_inputs()[0].name
        outputs = self.model_loader.session.run(None, {input_name: preprocessed_image})
        
        end_time = time.perf_counter()
        latency_ms = (end_time - start_time) * 1000
        self.model_loader.update_metrics(latency_ms)
        
        return outputs[0]
    
    def extract_keypoints(self, model_output: np.ndarray) -> List[Dict[str, Any]]:
        pose_config = self.config.get("pose_estimation", {})
        confidence_threshold = pose_config.get("confidence_threshold", 0.3)
        keypoint_names = pose_config.get("keypoint_names", [])
        
        keypoints = []
        
        if model_output.ndim == 3:
            for idx in range(model_output.shape[1]):
                y, x, confidence = model_output[0, idx, :]
                
                if confidence >= confidence_threshold:
                    keypoint = {
                        "id": idx,
                        "name": keypoint_names[idx] if idx < len(keypoint_names) else f"keypoint_{idx}",
                        "x": float(x),
                        "y": float(y),
                        "confidence": float(confidence)
                    }
                    keypoints.append(keypoint)
        
        return keypoints
    
    def calculate_angle(self, p1: Tuple[float, float], p2: Tuple[float, float], 
                       p3: Tuple[float, float]) -> float:
        v1 = np.array([p1[0] - p2[0], p1[1] - p2[1]])
        v2 = np.array([p3[0] - p2[0], p3[1] - p2[1]])
        
        cos_angle = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-6)
        angle = np.arccos(np.clip(cos_angle, -1.0, 1.0))
        
        return np.degrees(angle)
    
    def get_keypoint_by_name(self, keypoints: List[Dict], name: str) -> Optional[Dict]:
        for kp in keypoints:
            if kp["name"] == name:
                return kp
        return None
    
    def calculate_ergonomic_features(self, keypoints: List[Dict]) -> Dict[str, Any]:
        features = {
            "neck_flexion": None,
            "trunk_flexion": None,
            "left_shoulder_abduction": None,
            "right_shoulder_abduction": None,
            "left_elbow_flexion": None,
            "right_elbow_flexion": None,
            "asymmetry_score": None,
            "reach_distance_ratio": None
        }
        
        nose = self.get_keypoint_by_name(keypoints, "nose")
        left_shoulder = self.get_keypoint_by_name(keypoints, "left_shoulder")
        right_shoulder = self.get_keypoint_by_name(keypoints, "right_shoulder")
        left_elbow = self.get_keypoint_by_name(keypoints, "left_elbow")
        right_elbow = self.get_keypoint_by_name(keypoints, "right_elbow")
        left_wrist = self.get_keypoint_by_name(keypoints, "left_wrist")
        right_wrist = self.get_keypoint_by_name(keypoints, "right_wrist")
        left_hip = self.get_keypoint_by_name(keypoints, "left_hip")
        right_hip = self.get_keypoint_by_name(keypoints, "right_hip")
        
        if nose and left_shoulder and right_shoulder:
            mid_shoulder_x = (left_shoulder["x"] + right_shoulder["x"]) / 2
            mid_shoulder_y = (left_shoulder["y"] + right_shoulder["y"]) / 2
            
            neck_angle = np.abs(np.arctan2(
                nose["y"] - mid_shoulder_y,
                nose["x"] - mid_shoulder_x
            ))
            features["neck_flexion"] = float(np.degrees(neck_angle))
        
        if left_shoulder and left_hip and right_shoulder and right_hip:
            mid_shoulder_x = (left_shoulder["x"] + right_shoulder["x"]) / 2
            mid_shoulder_y = (left_shoulder["y"] + right_shoulder["y"]) / 2
            mid_hip_x = (left_hip["x"] + right_hip["x"]) / 2
            mid_hip_y = (left_hip["y"] + right_hip["y"]) / 2
            
            trunk_angle = np.abs(np.arctan2(
                mid_shoulder_y - mid_hip_y,
                mid_shoulder_x - mid_hip_x
            ) - np.pi / 2)
            features["trunk_flexion"] = float(np.degrees(trunk_angle))
        
        if left_shoulder and left_elbow and left_hip:
            angle = self.calculate_angle(
                (left_hip["x"], left_hip["y"]),
                (left_shoulder["x"], left_shoulder["y"]),
                (left_elbow["x"], left_elbow["y"])
            )
            features["left_shoulder_abduction"] = float(angle)
        
        if right_shoulder and right_elbow and right_hip:
            angle = self.calculate_angle(
                (right_hip["x"], right_hip["y"]),
                (right_shoulder["x"], right_shoulder["y"]),
                (right_elbow["x"], right_elbow["y"])
            )
            features["right_shoulder_abduction"] = float(angle)
        
        if left_shoulder and left_elbow and left_wrist:
            angle = self.calculate_angle(
                (left_shoulder["x"], left_shoulder["y"]),
                (left_elbow["x"], left_elbow["y"]),
                (left_wrist["x"], left_wrist["y"])
            )
            features["left_elbow_flexion"] = float(angle)
        
        if right_shoulder and right_elbow and right_wrist:
            angle = self.calculate_angle(
                (right_shoulder["x"], right_shoulder["y"]),
                (right_elbow["x"], right_elbow["y"]),
                (right_wrist["x"], right_wrist["y"])
            )
            features["right_elbow_flexion"] = float(angle)
        
        if left_shoulder and right_shoulder:
            left_side_height = left_shoulder["y"]
            right_side_height = right_shoulder["y"]
            asymmetry = abs(left_side_height - right_side_height)
            features["asymmetry_score"] = float(asymmetry * 100)
        
        if left_shoulder and right_shoulder and left_wrist:
            shoulder_width = abs(left_shoulder["x"] - right_shoulder["x"])
            reach_distance = abs(left_wrist["x"] - left_shoulder["x"])
            if shoulder_width > 0:
                features["reach_distance_ratio"] = float(reach_distance / shoulder_width)
        
        return features
    
    def process_image(self, image_path: str) -> Dict[str, Any]:
        try:
            preprocessed = self.preprocess_image(image_path)
            model_output = self.run_inference(preprocessed)
            keypoints = self.extract_keypoints(model_output)
            ergonomic_features = self.calculate_ergonomic_features(keypoints)
            
            return {
                "success": True,
                "keypoints": keypoints,
                "ergonomic_features": ergonomic_features,
                "num_keypoints_detected": len(keypoints)
            }
            
        except Exception as e:
            logger.error(f"Error processing image: {e}")
            return {
                "success": False,
                "error": str(e),
                "keypoints": [],
                "ergonomic_features": {},
                "num_keypoints_detected": 0
            }
    
    def process_batch(self, image_paths: List[str]) -> List[Dict[str, Any]]:
        results = []
        for image_path in image_paths:
            result = self.process_image(image_path)
            results.append(result)
        return results
