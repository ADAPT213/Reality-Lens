import os
from contextlib import contextmanager
from typing import Dict, Any, Optional
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource, SERVICE_NAME, SERVICE_VERSION
from opentelemetry.trace import Status, StatusCode, Span

SERVICE_NAME_STR = "smartpick-vision"
SERVICE_VERSION_STR = "0.1.0"

tracer_provider: Optional[TracerProvider] = None
tracer: Optional[trace.Tracer] = None


def initialize_tracing():
    """Initialize OpenTelemetry tracing for the vision service."""
    global tracer_provider, tracer
    
    if os.getenv("OTEL_TRACING_ENABLED", "true").lower() == "false":
        print("OpenTelemetry tracing disabled")
        return
    
    resource = Resource(attributes={
        SERVICE_NAME: SERVICE_NAME_STR,
        SERVICE_VERSION: SERVICE_VERSION_STR,
        "deployment.environment": os.getenv("ENVIRONMENT", "development"),
    })
    
    tracer_provider = TracerProvider(resource=resource)
    
    if os.getenv("ENVIRONMENT") == "development":
        span_processor = BatchSpanProcessor(ConsoleSpanExporter())
    else:
        otlp_endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4318")
        span_exporter = OTLPSpanExporter(
            endpoint=f"{otlp_endpoint}/v1/traces",
        )
        span_processor = BatchSpanProcessor(span_exporter)
    
    tracer_provider.add_span_processor(span_processor)
    trace.set_tracer_provider(tracer_provider)
    
    tracer = trace.get_tracer(SERVICE_NAME_STR, SERVICE_VERSION_STR)
    print("OpenTelemetry tracing initialized")


def shutdown_tracing():
    """Shutdown OpenTelemetry tracing."""
    global tracer_provider
    if tracer_provider:
        tracer_provider.shutdown()
        print("OpenTelemetry tracing shutdown")


def get_tracer() -> trace.Tracer:
    """Get the global tracer instance."""
    global tracer
    if tracer is None:
        initialize_tracing()
    return tracer or trace.get_tracer(SERVICE_NAME_STR)


@contextmanager
def trace_span(
    name: str,
    attributes: Optional[Dict[str, Any]] = None,
    record_exception: bool = True,
):
    """Context manager for creating traced spans.
    
    Args:
        name: Name of the span
        attributes: Optional attributes to add to the span
        record_exception: Whether to record exceptions in the span
        
    Yields:
        The active span
    """
    tracer = get_tracer()
    with tracer.start_as_current_span(name) as span:
        if attributes:
            for key, value in attributes.items():
                if value is not None:
                    span.set_attribute(key, value)
        
        try:
            yield span
            span.set_status(Status(StatusCode.OK))
        except Exception as e:
            span.set_status(Status(StatusCode.ERROR, str(e)))
            if record_exception:
                span.record_exception(e)
            raise


def set_span_attributes(span: Span, attributes: Dict[str, Any]):
    """Set multiple attributes on a span.
    
    Args:
        span: The span to set attributes on
        attributes: Dictionary of attributes to set
    """
    for key, value in attributes.items():
        if value is not None:
            span.set_attribute(key, value)


def get_current_trace_id() -> Optional[str]:
    """Get the current trace ID if available."""
    span = trace.get_current_span()
    if span and span.get_span_context().is_valid:
        return format(span.get_span_context().trace_id, "032x")
    return None


def get_current_span_id() -> Optional[str]:
    """Get the current span ID if available."""
    span = trace.get_current_span()
    if span and span.get_span_context().is_valid:
        return format(span.get_span_context().span_id, "016x")
    return None
