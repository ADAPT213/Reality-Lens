import os
import time
from typing import Dict, Optional
from contextlib import contextmanager
from opentelemetry import metrics
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.exporter.prometheus import PrometheusMetricReader
from opentelemetry.sdk.resources import Resource, SERVICE_NAME, SERVICE_VERSION
from prometheus_client import start_http_server

SERVICE_NAME_STR = "smartpick-vision"
SERVICE_VERSION_STR = "0.1.0"

meter_provider: Optional[MeterProvider] = None
meter: Optional[metrics.Meter] = None

# Metrics instances
inference_duration: Optional[metrics.Histogram] = None
inference_requests: Optional[metrics.Counter] = None
inference_errors: Optional[metrics.Counter] = None
model_load_duration: Optional[metrics.Histogram] = None
gpu_utilization: Optional[metrics.ObservableGauge] = None
gpu_memory_used: Optional[metrics.ObservableGauge] = None
frame_processing_duration: Optional[metrics.Histogram] = None
ergonomic_score_distribution: Optional[metrics.Histogram] = None


def initialize_metrics():
    """Initialize OpenTelemetry metrics and Prometheus exporter."""
    global meter_provider, meter
    global inference_duration, inference_requests, inference_errors
    global model_load_duration, gpu_utilization, gpu_memory_used
    global frame_processing_duration, ergonomic_score_distribution
    
    if os.getenv("OTEL_METRICS_ENABLED", "true").lower() == "false":
        print("OpenTelemetry metrics disabled")
        return
    
    resource = Resource(attributes={
        SERVICE_NAME: SERVICE_NAME_STR,
        SERVICE_VERSION: SERVICE_VERSION_STR,
        "deployment.environment": os.getenv("ENVIRONMENT", "development"),
    })
    
    # Prometheus exporter
    prometheus_port = int(os.getenv("PROMETHEUS_PORT", "9465"))
    prometheus_reader = PrometheusMetricReader()
    
    meter_provider = MeterProvider(
        resource=resource,
        metric_readers=[prometheus_reader],
    )
    metrics.set_meter_provider(meter_provider)
    
    meter = metrics.get_meter(SERVICE_NAME_STR, SERVICE_VERSION_STR)
    
    # Initialize metrics
    inference_duration = meter.create_histogram(
        name="inference_duration_seconds",
        description="Duration of model inference",
        unit="s",
    )
    
    inference_requests = meter.create_counter(
        name="inference_requests_total",
        description="Total number of inference requests",
        unit="1",
    )
    
    inference_errors = meter.create_counter(
        name="inference_errors_total",
        description="Total number of inference errors",
        unit="1",
    )
    
    model_load_duration = meter.create_histogram(
        name="model_load_duration_seconds",
        description="Duration of model loading",
        unit="s",
    )
    
    frame_processing_duration = meter.create_histogram(
        name="frame_processing_duration_seconds",
        description="Duration of frame processing",
        unit="s",
    )
    
    ergonomic_score_distribution = meter.create_histogram(
        name="ergonomic_score_distribution",
        description="Distribution of ergonomic risk scores",
        unit="1",
    )
    
    # Start Prometheus HTTP server
    start_http_server(port=prometheus_port, addr="0.0.0.0")
    print(f"Prometheus metrics exposed at http://0.0.0.0:{prometheus_port}/metrics")


def shutdown_metrics():
    """Shutdown metrics provider."""
    global meter_provider
    if meter_provider:
        meter_provider.shutdown()
        print("Metrics provider shutdown")


def record_inference(
    duration_seconds: float,
    model: str,
    success: bool = True,
    error_type: Optional[str] = None,
):
    """Record an inference operation.
    
    Args:
        duration_seconds: Duration of the inference in seconds
        model: Name of the model used
        success: Whether the inference was successful
        error_type: Type of error if not successful
    """
    attributes = {"model": model}
    
    if inference_requests:
        inference_requests.add(1, attributes)
    
    if inference_duration:
        inference_duration.record(duration_seconds, attributes)
    
    if not success and inference_errors and error_type:
        inference_errors.add(1, {**attributes, "error_type": error_type})


def record_frame_processing(duration_seconds: float, attributes: Optional[Dict] = None):
    """Record frame processing duration.
    
    Args:
        duration_seconds: Duration of frame processing
        attributes: Additional attributes
    """
    if frame_processing_duration:
        frame_processing_duration.record(
            duration_seconds,
            attributes or {}
        )


def record_ergonomic_score(score: float, attributes: Optional[Dict] = None):
    """Record an ergonomic risk score.
    
    Args:
        score: The ergonomic risk score (0-100)
        attributes: Additional attributes
    """
    if ergonomic_score_distribution:
        ergonomic_score_distribution.record(
            score,
            attributes or {}
        )


def record_model_load(duration_seconds: float, model: str):
    """Record model loading time.
    
    Args:
        duration_seconds: Duration of model loading
        model: Name of the model
    """
    if model_load_duration:
        model_load_duration.record(duration_seconds, {"model": model})


@contextmanager
def measure_time(metric_name: str, attributes: Optional[Dict] = None):
    """Context manager to measure execution time.
    
    Args:
        metric_name: Name of the metric to record to
        attributes: Attributes to attach to the measurement
        
    Yields:
        Start time
    """
    start_time = time.time()
    try:
        yield start_time
    finally:
        duration = time.time() - start_time
        
        if metric_name == "inference":
            if inference_duration:
                inference_duration.record(duration, attributes or {})
        elif metric_name == "frame_processing":
            if frame_processing_duration:
                frame_processing_duration.record(duration, attributes or {})
        elif metric_name == "model_load":
            if model_load_duration:
                model_load_duration.record(duration, attributes or {})


def get_gpu_metrics() -> Dict[str, float]:
    """Get current GPU metrics.
    
    Returns:
        Dictionary with GPU utilization and memory usage
        
    Note:
        This is a placeholder. In production, integrate with nvidia-ml-py3
        or similar library for actual GPU metrics.
    """
    try:
        # Placeholder - integrate with nvidia-ml-py3 for actual metrics
        return {
            "utilization": 0.0,
            "memory_used_mb": 0.0,
            "memory_total_mb": 0.0,
        }
    except Exception:
        return {
            "utilization": 0.0,
            "memory_used_mb": 0.0,
            "memory_total_mb": 0.0,
        }
