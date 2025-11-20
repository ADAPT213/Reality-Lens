import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from routers import process
from services import posture_estimation

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting SmartPick Vision Service...")
    posture_estimation.initialize_models()
    yield
    logger.info("Shutting down SmartPick Vision Service...")


app = FastAPI(
    title="SmartPick Vision Service",
    description="Computer vision and ergonomic risk scoring for warehouse operations",
    version="0.1.0",
    lifespan=lifespan
)

app.include_router(process.router, prefix="/process", tags=["process"])


@app.get("/health")
async def health():
    model_info = posture_estimation.get_model_info()
    
    response = {
        "status": "ok",
        "service": "vision-service",
        "version": "0.1.0"
    }
    
    if model_info["loaded"]:
        response["ml"] = {
            "model_loaded": True,
            "model_name": model_info["metadata"]["name"],
            "model_version": model_info["metadata"]["version"],
            "provider": model_info["metadata"]["provider"],
            "metrics": model_info["metrics"]
        }
    else:
        response["ml"] = {
            "model_loaded": False,
            "message": model_info.get("message", "Model not initialized")
        }
    
    return response


@app.get("/")
async def root():
    return {
        "service": "SmartPick Vision Service",
        "version": "0.1.0",
        "endpoints": {
            "health": "/health",
            "process_image": "/process/image",
            "process_video": "/process/video"
        }
    }
