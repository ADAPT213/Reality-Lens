import logging
from typing import Dict, Any
import yaml
from pathlib import Path

logger = logging.getLogger(__name__)


class BiomechanicalScorer:
    def __init__(self, config_path: str = "src/config/models.yaml"):
        self.config = self._load_config(config_path)
        self.thresholds = self.config.get("ergonomic_thresholds", {})
        self.weights = self.config.get("risk_scoring", {}).get("reba_weights", {})
        self.risk_levels = self.config.get("risk_scoring", {}).get("risk_levels", {})
    
    def _load_config(self, config_path: str) -> Dict[str, Any]:
        config_file = Path(config_path)
        if not config_file.exists():
            logger.warning(f"Config not found: {config_path}, using defaults")
            return self._get_default_config()
        
        with open(config_file, 'r') as f:
            return yaml.safe_load(f)
    
    def _get_default_config(self) -> Dict[str, Any]:
        return {
            "ergonomic_thresholds": {
                "neck_flexion": {"low": 20, "medium": 45, "high": 60},
                "trunk_flexion": {"low": 20, "medium": 45, "high": 60},
                "shoulder_abduction": {"low": 45, "medium": 90, "high": 135}
            },
            "risk_scoring": {
                "reba_weights": {
                    "neck": 0.20,
                    "trunk": 0.25,
                    "upper_arm": 0.20,
                    "lower_arm": 0.15
                },
                "risk_levels": {
                    "negligible": [0, 20],
                    "low": [21, 40],
                    "medium": [41, 60],
                    "high": [61, 80],
                    "very_high": [81, 100]
                }
            }
        }
    
    def _score_angle(self, angle: float, thresholds: Dict[str, float]) -> int:
        if angle is None:
            return 0
        
        if angle < thresholds["low"]:
            return 1
        elif angle < thresholds["medium"]:
            return 2
        elif angle < thresholds["high"]:
            return 3
        else:
            return 4
    
    def calculate_reba_score(self, ergonomic_features: Dict[str, Any]) -> Dict[str, Any]:
        neck_score = self._score_angle(
            ergonomic_features.get("neck_flexion"),
            self.thresholds.get("neck_flexion", {"low": 20, "medium": 45, "high": 60})
        )
        
        trunk_score = self._score_angle(
            ergonomic_features.get("trunk_flexion"),
            self.thresholds.get("trunk_flexion", {"low": 20, "medium": 45, "high": 60})
        )
        
        left_shoulder = ergonomic_features.get("left_shoulder_abduction")
        right_shoulder = ergonomic_features.get("right_shoulder_abduction")
        avg_shoulder = None
        if left_shoulder is not None and right_shoulder is not None:
            avg_shoulder = (left_shoulder + right_shoulder) / 2
        elif left_shoulder is not None:
            avg_shoulder = left_shoulder
        elif right_shoulder is not None:
            avg_shoulder = right_shoulder
        
        upper_arm_score = self._score_angle(
            avg_shoulder,
            self.thresholds.get("shoulder_abduction", {"low": 45, "medium": 90, "high": 135})
        )
        
        left_elbow = ergonomic_features.get("left_elbow_flexion")
        right_elbow = ergonomic_features.get("right_elbow_flexion")
        avg_elbow = None
        if left_elbow is not None and right_elbow is not None:
            avg_elbow = (left_elbow + right_elbow) / 2
        elif left_elbow is not None:
            avg_elbow = left_elbow
        elif right_elbow is not None:
            avg_elbow = right_elbow
        
        lower_arm_score = self._score_angle(
            avg_elbow,
            self.thresholds.get("elbow_flexion", {"low": 60, "medium": 100, "high": 140})
        )
        
        weighted_score = (
            neck_score * self.weights.get("neck", 0.20) +
            trunk_score * self.weights.get("trunk", 0.25) +
            upper_arm_score * self.weights.get("upper_arm", 0.20) +
            lower_arm_score * self.weights.get("lower_arm", 0.15)
        )
        
        reba_score = int(weighted_score * 25)
        
        confidence = self._calculate_confidence(ergonomic_features)
        
        return {
            "score": min(reba_score, 100),
            "neck_score": neck_score,
            "trunk_score": trunk_score,
            "upper_arm_score": upper_arm_score,
            "lower_arm_score": lower_arm_score,
            "confidence": confidence
        }
    
    def _calculate_confidence(self, ergonomic_features: Dict[str, Any]) -> float:
        available_features = sum(
            1 for v in ergonomic_features.values() if v is not None
        )
        total_features = len(ergonomic_features)
        
        if total_features == 0:
            return 0.0
        
        return available_features / total_features
    
    def calculate_rula_score(self, ergonomic_features: Dict[str, Any]) -> Dict[str, Any]:
        upper_arm_score = self._score_angle(
            ergonomic_features.get("left_shoulder_abduction"),
            self.thresholds.get("shoulder_abduction", {"low": 45, "medium": 90, "high": 135})
        )
        
        lower_arm_score = self._score_angle(
            ergonomic_features.get("left_elbow_flexion"),
            self.thresholds.get("elbow_flexion", {"low": 60, "medium": 100, "high": 140})
        )
        
        neck_score = self._score_angle(
            ergonomic_features.get("neck_flexion"),
            self.thresholds.get("neck_flexion", {"low": 20, "medium": 45, "high": 60})
        )
        
        trunk_score = self._score_angle(
            ergonomic_features.get("trunk_flexion"),
            self.thresholds.get("trunk_flexion", {"low": 20, "medium": 45, "high": 60})
        )
        
        group_a = upper_arm_score + lower_arm_score
        group_b = neck_score + trunk_score
        
        rula_score = int((group_a + group_b) * 12.5)
        
        confidence = self._calculate_confidence(ergonomic_features)
        
        return {
            "score": min(rula_score, 100),
            "group_a_score": group_a,
            "group_b_score": group_b,
            "confidence": confidence
        }
    
    def get_risk_level(self, score: int) -> str:
        for level, (min_score, max_score) in self.risk_levels.items():
            if min_score <= score <= max_score:
                return level
        return "unknown"
    
    def get_traffic_light(self, score: int) -> str:
        if score <= 40:
            return "green"
        elif score <= 60:
            return "yellow"
        else:
            return "red"


_scorer = None


def get_scorer() -> BiomechanicalScorer:
    global _scorer
    if _scorer is None:
        _scorer = BiomechanicalScorer()
    return _scorer


def compute_risk(inputs: Dict[str, Any]) -> Dict[str, Any]:
    scorer = get_scorer()
    
    ergonomic_features = inputs.get("ergonomic_features", {})
    
    if not ergonomic_features:
        logger.warning("No ergonomic features provided for risk scoring")
        return {
            "rula": None,
            "reba": None,
            "niosh": None,
            "composite": None,
            "traffic_light": None,
            "risk_level": None
        }
    
    try:
        reba_result = scorer.calculate_reba_score(ergonomic_features)
        rula_result = scorer.calculate_rula_score(ergonomic_features)
        
        composite_score = int((reba_result["score"] + rula_result["score"]) / 2)
        composite_confidence = (reba_result["confidence"] + rula_result["confidence"]) / 2
        
        return {
            "rula": rula_result["score"],
            "reba": reba_result["score"],
            "niosh": None,
            "composite": composite_score,
            "confidence": round(composite_confidence, 2),
            "traffic_light": scorer.get_traffic_light(composite_score),
            "risk_level": scorer.get_risk_level(composite_score),
            "details": {
                "reba": reba_result,
                "rula": rula_result
            }
        }
        
    except Exception as e:
        logger.error(f"Error computing risk score: {e}")
        return {
            "rula": None,
            "reba": None,
            "niosh": None,
            "composite": None,
            "traffic_light": None,
            "risk_level": None,
            "error": str(e)
        }
