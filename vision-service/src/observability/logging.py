import os
import logging
import json
from typing import Optional
from .tracing import get_current_trace_id, get_current_span_id

class CorrelatedJSONFormatter(logging.Formatter):
    """JSON formatter that includes trace correlation IDs."""
    
    def __init__(self):
        super().__init__()
        self.service_name = os.getenv("SERVICE_NAME", "smartpick-vision")
        self.environment = os.getenv("ENVIRONMENT", "development")
    
    def format(self, record: logging.LogRecord) -> str:
        log_data = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "service": self.service_name,
            "environment": self.environment,
        }
        
        # Add trace context if available
        trace_id = get_current_trace_id()
        span_id = get_current_span_id()
        
        if trace_id:
            log_data["trace_id"] = trace_id
        if span_id:
            log_data["span_id"] = span_id
        
        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)
        
        # Add any extra fields
        if hasattr(record, "extra"):
            log_data.update(record.extra)
        
        return json.dumps(log_data)


def setup_logging(level: str = "INFO") -> logging.Logger:
    """Setup application logging with correlation IDs.
    
    Args:
        level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        
    Returns:
        Configured logger instance
    """
    log_level = os.getenv("LOG_LEVEL", level).upper()
    
    logger = logging.getLogger("smartpick-vision")
    logger.setLevel(log_level)
    
    # Remove existing handlers
    logger.handlers.clear()
    
    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setLevel(log_level)
    
    if os.getenv("ENVIRONMENT") == "production":
        # Use JSON formatting in production
        console_handler.setFormatter(CorrelatedJSONFormatter())
    else:
        # Use simpler formatting in development
        formatter = logging.Formatter(
            "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
        )
        console_handler.setFormatter(formatter)
    
    logger.addHandler(console_handler)
    
    return logger


def get_logger(name: Optional[str] = None) -> logging.Logger:
    """Get a logger instance with optional name.
    
    Args:
        name: Optional logger name, defaults to module name
        
    Returns:
        Logger instance
    """
    if name:
        return logging.getLogger(f"smartpick-vision.{name}")
    return logging.getLogger("smartpick-vision")
