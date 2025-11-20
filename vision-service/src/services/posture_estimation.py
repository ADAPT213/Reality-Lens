import logging
from typing import Dict, Any
from ml import ModelLoader, PosePipeline

logger = logging.getLogger(__name__)

_model_loader: ModelLoader = None
_pose_pipeline: PosePipeline = None


def initialize_models():
    global _model_loader, _pose_pipeline
    
    if _model_loader is None:
        logger.info("Initializing pose estimation models...")
        _model_loader = ModelLoader()
        
        if _model_loader.load_model():
            _pose_pipeline = PosePipeline(_model_loader)
            logger.info("Pose estimation models initialized successfully")
        else:
            logger.warning("Model loading failed - running in stub mode")
            _pose_pipeline = None


def estimate_posture(file_path: str) -> Dict[str, Any]:
    global _model_loader, _pose_pipeline
    
    if _pose_pipeline is None:
        logger.warning("Pose pipeline not initialized - returning stub response")
        return {
            "postures": [],
            "metrics": {},
            "warning": "Model not loaded - place ONNX model in models/ directory"
        }
    
    try:
        result = _pose_pipeline.process_image(file_path)
        
        if result["success"]:
            return {
                "postures": [{
                    "keypoints": result["keypoints"],
                    "ergonomic_features": result["ergonomic_features"],
                    "num_keypoints": result["num_keypoints_detected"]
                }],
                "metrics": _model_loader.get_metrics()
            }
        else:
            return {
                "postures": [],
                "metrics": {},
                "error": result.get("error")
            }
            
    except Exception as e:
        logger.error(f"Error in posture estimation: {e}")
        return {
            "postures": [],
            "metrics": {},
            "error": str(e)
        }


def get_model_info() -> Dict[str, Any]:
    global _model_loader
    
    if _model_loader is None or _model_loader.session is None:
        return {
            "loaded": False,
            "message": "No model loaded"
        }
    
    return {
        "loaded": True,
        "metadata": _model_loader.model_metadata,
        "metrics": _model_loader.get_metrics()
    }
