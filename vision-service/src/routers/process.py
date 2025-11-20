import logging
from fastapi import APIRouter, UploadFile, File
from pydantic import BaseModel
from pathlib import Path
import tempfile
import shutil

from services import posture_estimation, risk_scoring

logger = logging.getLogger(__name__)

router = APIRouter()


class ProcessPayload(BaseModel):
    upload_id: str
    file_url: str
    warehouse_timezone: str


@router.post("/upload")
async def process_upload(payload: ProcessPayload):
    return {"status": "accepted", "upload_id": payload.upload_id}


@router.post("/image")
async def process_image(file: UploadFile = File(...)):
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as tmp_file:
            shutil.copyfileobj(file.file, tmp_file)
            tmp_path = tmp_file.name
        
        posture_result = posture_estimation.estimate_posture(tmp_path)
        
        risk_result = {"rula": None, "reba": None, "composite": None}
        if posture_result.get("postures") and len(posture_result["postures"]) > 0:
            first_posture = posture_result["postures"][0]
            ergonomic_features = first_posture.get("ergonomic_features", {})
            
            risk_result = risk_scoring.compute_risk({
                "ergonomic_features": ergonomic_features
            })
        
        Path(tmp_path).unlink(missing_ok=True)
        
        return {
            "status": "success",
            "posture": posture_result,
            "risk_assessment": risk_result
        }
        
    except Exception as e:
        logger.error(f"Error processing image: {e}")
        return {
            "status": "error",
            "error": str(e)
        }


@router.post("/video")
async def process_video(file: UploadFile = File(...)):
    return {
        "status": "not_implemented",
        "message": "Video processing will be implemented in future version"
    }
