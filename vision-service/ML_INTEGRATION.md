# ML Integration Summary

## Overview

Real machine learning inference has been integrated into the SmartPick Vision Service using ONNX Runtime for production-ready pose estimation and ergonomic risk scoring.

## Components Implemented

### 1. ML Infrastructure (`src/ml/`)

#### `model_loader.py`
- **Automatic device detection** (CUDA GPU, TensorRT, or CPU)
- **Model validation** with SHA256 hash verification
- **Session optimization** (graph optimization, thread configuration)
- **Model warmup** on startup (3 iterations by default)
- **Performance metrics** tracking (P50/P95/P99 latency, throughput)
- **Graceful degradation** if model not available

**Key Features:**
- Configurable ONNX Runtime providers
- Thread pool management
- Rolling metrics window (last 1000 inferences)

#### `pose_pipeline.py`
- **Image preprocessing** (resize, normalize to [0,1])
- **Inference execution** with latency tracking
- **Keypoint extraction** with confidence filtering
- **Ergonomic feature calculation**:
  - Neck flexion angle
  - Trunk flexion angle
  - Shoulder abduction (left/right)
  - Elbow flexion (left/right)
  - Body asymmetry score
  - Reach distance ratio
- **Batch processing** support for video frames

### 2. Biomechanical Risk Scoring (`src/services/risk_scoring.py`)

#### REBA-Inspired Scoring
- Weighted scoring based on:
  - Neck posture (20%)
  - Trunk posture (25%)
  - Upper arm (20%)
  - Lower arm (15%)
- Score range: 0-100
- Confidence calculation based on available features

#### RULA-Inspired Scoring
- Group A: Upper limbs (arm, forearm, wrist)
- Group B: Neck, trunk, legs
- Combined score with confidence

#### Risk Levels
- **Negligible** (0-20): Green light
- **Low** (21-40): Green light
- **Medium** (41-60): Yellow light
- **High** (61-80): Red light
- **Very High** (81-100): Red light

### 3. Configuration System (`src/config/models.yaml`)

#### Model Configuration
```yaml
pose_estimation:
  model_name: "movenet_singlepose_lightning"
  path: "models/movenet_lightning.onnx"
  input_size: [192, 192]
  confidence_threshold: 0.3
  num_keypoints: 17
```

#### Inference Settings
```yaml
inference:
  device: "auto"  # auto, gpu, or cpu
  num_threads: 4
  batch_size: 1
  warmup_iterations: 3
```

#### Ergonomic Thresholds
```yaml
ergonomic_thresholds:
  neck_flexion: {low: 20, medium: 45, high: 60}
  trunk_flexion: {low: 20, medium: 45, high: 60}
  shoulder_abduction: {low: 45, medium: 90, high: 135}
```

### 4. Enhanced API Endpoints

#### `POST /process/image`
Upload an image for pose analysis and risk scoring.

**Response:**
```json
{
  "status": "success",
  "posture": {
    "postures": [{
      "keypoints": [...],
      "ergonomic_features": {
        "neck_flexion": 35.2,
        "trunk_flexion": 22.5,
        "left_shoulder_abduction": 85.3,
        "right_shoulder_abduction": 82.1,
        "left_elbow_flexion": 95.4,
        "right_elbow_flexion": 92.8,
        "asymmetry_score": 3.2,
        "reach_distance_ratio": 0.65
      },
      "num_keypoints": 17
    }],
    "metrics": {
      "inference_count": 42,
      "latency_p50_ms": 15.2,
      "latency_p95_ms": 23.8,
      "latency_p99_ms": 31.5,
      "throughput_fps": 65.79
    }
  },
  "risk_assessment": {
    "rula": 45,
    "reba": 52,
    "composite": 48,
    "confidence": 0.88,
    "traffic_light": "yellow",
    "risk_level": "medium"
  }
}
```

#### `GET /health`
Enhanced with ML metrics.

**Response:**
```json
{
  "status": "ok",
  "service": "vision-service",
  "version": "0.1.0",
  "ml": {
    "model_loaded": true,
    "model_name": "movenet_singlepose_lightning",
    "model_version": "1.0.0",
    "provider": "CPUExecutionProvider",
    "metrics": {
      "inference_count": 42,
      "latency_p50_ms": 15.2,
      "latency_p95_ms": 23.8,
      "latency_p99_ms": 31.5,
      "throughput_fps": 65.79
    }
  }
}
```

## Performance Considerations

### Expected Performance

#### MoveNet Lightning (192x192)
- **CPU (4 cores)**: 15-25ms per inference (~40-60 FPS)
- **GPU (CUDA)**: 5-10ms per inference (~100-200 FPS)
- **Model size**: ~7 MB
- **Accuracy**: Good for real-time applications

#### Memory Usage
- **Base service**: ~100-200 MB
- **With model loaded**: ~300-500 MB
- **Per inference**: ~10-20 MB temporary

### Optimization Strategies

1. **GPU Acceleration**
   ```bash
   pip install onnxruntime-gpu
   ```
   - 3-5x speedup on CUDA-enabled GPUs
   - Requires CUDA 11.x or 12.x

2. **Thread Tuning**
   ```yaml
   inference:
     num_threads: 8  # Set to CPU core count
   ```

3. **Batch Processing** (for video)
   ```python
   results = pipeline.process_batch(image_paths)
   ```

4. **Model Selection**
   - **Lightning**: Faster, good accuracy
   - **Thunder**: Slower, better accuracy
   - **RTMPose-s**: Balanced
   - **RTMPose-m**: Higher accuracy

### Scaling Considerations

#### Single Instance
- **Throughput**: 40-60 images/sec (CPU)
- **Latency**: 15-25ms (P50)
- **Concurrent requests**: 4-8 workers recommended

#### Horizontal Scaling
- Stateless service (ready for Kubernetes)
- Load balance across multiple pods
- Shared model storage via volume mount

#### Cold Start
- **Model loading**: 1-3 seconds
- **Warmup**: 3 iterations (~50ms total)
- **Total**: ~3-5 seconds to ready

## Setup Instructions

### 1. Install Dependencies

```bash
cd vision-service
pip install -e .
```

For GPU support:
```bash
pip install onnxruntime-gpu
```

### 2. Obtain Pose Model

**Option A: Convert MoveNet**
```bash
pip install tensorflow tensorflow-hub tf2onnx
python tools/convert_movenet_to_onnx.py
```

**Option B: Use Pre-trained ONNX**
- Download from model zoo
- Place in `models/movenet_lightning.onnx`

**Option C: Use Alternative Model**
- Update `src/config/models.yaml` with your model details

See `models/README.md` for detailed instructions.

### 3. Run Service

```bash
cd src
uvicorn main:app --host 0.0.0.0 --port 8002
```

### 4. Test Integration

```bash
# Check health
curl http://localhost:8002/health

# Process image
curl -X POST -F "file=@test_image.jpg" http://localhost:8002/process/image
```

## Integration with Backend

The vision service now provides real ergonomic data to the backend:

```python
# Backend integration example
async with httpx.AsyncClient() as client:
    files = {"file": open("worker_photo.jpg", "rb")}
    response = await client.post(
        "http://vision-service:8002/process/image",
        files=files
    )
    
    result = response.json()
    risk_score = result["risk_assessment"]["composite"]
    confidence = result["risk_assessment"]["confidence"]
```

## Monitoring & Metrics

### Key Metrics to Monitor

1. **Inference Latency**
   - P50, P95, P99 from `/health` endpoint
   - Alert if P95 > 50ms (CPU) or P95 > 20ms (GPU)

2. **Throughput**
   - FPS from metrics
   - Should sustain 40+ FPS on CPU

3. **Model Confidence**
   - Average confidence in risk scores
   - Alert if confidence < 0.5 consistently

4. **Error Rate**
   - Failed inferences
   - Missing keypoints

### Logging

Service logs include:
- Model loading events
- Inference errors
- Performance warnings
- Configuration issues

## Future Enhancements

### Short Term
- [ ] Video processing with frame sampling
- [ ] Multi-person pose estimation
- [ ] Object detection integration (boxes, pallets)
- [ ] Temporal smoothing for video

### Medium Term
- [ ] Custom model training on warehouse data
- [ ] Action recognition (lifting, reaching, bending)
- [ ] Real-time streaming inference
- [ ] Model versioning and A/B testing

### Long Term
- [ ] 3D pose estimation
- [ ] Force/load estimation from visual cues
- [ ] Fatigue detection from temporal patterns
- [ ] Predictive injury risk modeling

## Troubleshooting

### Model Not Loading
```
ERROR: Model file not found: models/movenet_lightning.onnx
```
**Solution**: Download or convert model per `models/README.md`

### Slow Inference
```
WARNING: P95 latency = 150ms (expected < 50ms)
```
**Solution**: 
- Enable GPU acceleration
- Reduce `num_threads` if over-subscribed
- Use lighter model

### Low Confidence Scores
```
WARNING: Average confidence = 0.35
```
**Solution**:
- Check image quality (lighting, resolution)
- Lower `confidence_threshold` in config
- Ensure proper camera angles

### Memory Issues
```
ERROR: Out of memory during batch processing
```
**Solution**:
- Reduce batch size
- Process images sequentially
- Increase container memory limit

## License & Attribution

### ONNX Runtime
- License: MIT
- Source: https://github.com/microsoft/onnxruntime

### MoveNet (if used)
- License: Apache 2.0
- Source: Google Research / TensorFlow Hub
- Citation: https://tfhub.dev/google/movenet

### REBA/RULA Methods
- Methodology based on published ergonomic assessment standards
- Adapted for automated computer vision scoring

## Contact & Support

For issues with ML integration:
1. Check logs in container/service
2. Verify model files and configuration
3. Test with sample images
4. Review `models/README.md`

For custom model training or advanced optimization, consider professional ML/CV consulting services.
