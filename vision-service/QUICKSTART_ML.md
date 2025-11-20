# Quick Start: ML Integration

## Prerequisites

- Python 3.12+
- pip
- (Optional) CUDA-enabled GPU for acceleration

## Installation

### 1. Install Dependencies

```bash
cd vision-service
pip install -e .
```

For GPU support (optional):
```bash
pip uninstall onnxruntime
pip install onnxruntime-gpu
```

### 2. Get a Pose Estimation Model

You have three options:

#### Option A: Use a lightweight pose model from a model zoo
Download a pre-converted ONNX pose model and place it in `models/movenet_lightning.onnx`

#### Option B: Convert MoveNet from TensorFlow Hub
```bash
pip install tensorflow tensorflow-hub tf2onnx
python tools/convert_movenet_to_onnx.py
```

#### Option C: Run without model (stub mode)
The service will start but return placeholder data until a model is added.

### 3. Test the Setup

```bash
# Run integration tests (works without model)
python tools/test_ml_integration.py
```

### 4. Start the Service

```bash
cd src
uvicorn main:app --host 0.0.0.0 --port 8002 --reload
```

Or using the provided script:
```bash
python -m uvicorn src.main:app --host 0.0.0.0 --port 8002
```

## Testing

### Check Health

```bash
curl http://localhost:8002/health
```

**Expected response (without model):**
```json
{
  "status": "ok",
  "service": "vision-service",
  "version": "0.1.0",
  "ml": {
    "model_loaded": false,
    "message": "No model loaded"
  }
}
```

**Expected response (with model):**
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
      "inference_count": 0,
      "latency_p50_ms": 0.0,
      "latency_p95_ms": 0.0,
      "latency_p99_ms": 0.0,
      "throughput_fps": 0.0
    }
  }
}
```

### Process an Image

```bash
# Download a test image
curl -o test_person.jpg "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400"

# Process it
curl -X POST \
  -F "file=@test_person.jpg" \
  http://localhost:8002/process/image
```

**Expected response:**
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
        ...
      },
      "num_keypoints": 17
    }],
    "metrics": {
      "inference_count": 1,
      "latency_p50_ms": 15.2,
      ...
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

## Docker Deployment

### Build Image

```bash
docker build -t smartpick-vision:latest .
```

### Run Container

```bash
docker run -d \
  --name vision-service \
  -p 8002:8000 \
  -v $(pwd)/models:/app/models \
  smartpick-vision:latest
```

**Note:** The `-v` mount allows you to update the model without rebuilding the image.

### With GPU Support

```bash
docker run -d \
  --name vision-service \
  --gpus all \
  -p 8002:8000 \
  -v $(pwd)/models:/app/models \
  smartpick-vision:latest
```

## Configuration

### Adjust Model Settings

Edit `src/config/models.yaml`:

```yaml
pose_estimation:
  model_name: "your_model_name"
  path: "models/your_model.onnx"
  input_size: [192, 192]  # Adjust based on your model
  confidence_threshold: 0.3  # Lower = more detections, higher = fewer false positives

inference:
  device: "auto"  # auto, gpu, or cpu
  num_threads: 4  # Set to your CPU core count
```

### Adjust Risk Scoring Thresholds

Edit `src/config/models.yaml`:

```yaml
ergonomic_thresholds:
  neck_flexion:
    low: 20    # degrees
    medium: 45
    high: 60
  trunk_flexion:
    low: 20
    medium: 45
    high: 60
```

## Performance Optimization

### CPU Optimization

```yaml
inference:
  device: "cpu"
  num_threads: 8  # Match your CPU cores
```

### GPU Optimization

```yaml
inference:
  device: "gpu"
```

Install GPU runtime:
```bash
pip install onnxruntime-gpu
```

### Monitoring Performance

Check the `/health` endpoint regularly:

```bash
watch -n 1 'curl -s http://localhost:8002/health | jq .ml.metrics'
```

## Troubleshooting

### Issue: "Model file not found"

**Solution:** Place an ONNX model file in the `models/` directory or run in stub mode.

### Issue: Slow inference (>50ms P95 on CPU)

**Solutions:**
- Reduce `num_threads` if CPU is over-subscribed
- Use GPU acceleration
- Switch to a lighter model (e.g., MoveNet Lightning)

### Issue: Low confidence scores (<0.5)

**Solutions:**
- Improve image quality (better lighting, higher resolution)
- Lower `confidence_threshold` in config
- Ensure camera angle captures full body

### Issue: Import errors

**Solution:** Ensure you're running from the correct directory:
```bash
cd vision-service
python -m uvicorn src.main:app --reload
```

## Next Steps

1. ✅ Service running with ML integration
2. ✅ Process test images
3. 📝 Integrate with backend service
4. 📝 Add video processing
5. 📝 Deploy to production
6. 📝 Monitor performance metrics

## Resources

- [Full ML Integration Documentation](ML_INTEGRATION.md)
- [Model Setup Guide](models/README.md)
- [API Documentation](http://localhost:8002/docs) (when service is running)

## Support

For issues or questions:
1. Check service logs for errors
2. Verify configuration in `src/config/models.yaml`
3. Test with `tools/test_ml_integration.py`
4. Review [ML_INTEGRATION.md](ML_INTEGRATION.md) for detailed troubleshooting
