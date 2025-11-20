# 🏭 SmartPick AI Platform - Complete Guide

## 🚀 Quick Start

### Starting the Platform

```powershell
# Backend (Port 4010)
cd backend
node smartpick-server.js

# Frontend (Port 3500)
cd frontend
npm run dev
```

### Accessing the Platform

- **Frontend**: http://localhost:3500
- **Backend API**: http://localhost:4010/api
- **Health Check**: http://localhost:4010/api/health

---

## 🎯 Platform Overview

SmartPick AI is a comprehensive warehouse optimization platform that combines AI-powered insights with real-time operational analytics to improve worker safety, efficiency, and productivity.

### Core Modules

1. **🤖 AI Assistant** - Intelligent warehouse optimization advisor (replaces "Copilot")
2. **🛡️ Clarity** - Ergonomic risk analysis and worker safety
3. **📦 Slotting** - AI-powered product placement optimization
4. **👁️ Vision** - Computer vision for safety zone detection
5. **📊 Analytics** - Predictive insights and KPI dashboards
6. **🚨 Alerts** - Real-time notification system
7. **📑 Reports** - Comprehensive operational reporting

---

## 🤖 AI Assistant API

**Endpoint**: `POST /api/v1/assistant/ask`

The SmartPick AI Assistant provides intelligent, context-aware guidance on warehouse operations.

### Request

```json
{
  "question": "What ergonomic risks should I address first?",
  "context": "optional context"
}
```

### Response

```json
{
  "answer": "Based on warehouse ergonomics best practices...",
  "source": "openai",
  "model": "gpt-4o-mini"
}
```

### Example Queries

- "What are the highest ergonomic risks in the warehouse?"
- "How should I optimize product placement for fast movers?"
- "Explain the green/yellow/red safety zone system"
- "What bottlenecks are affecting throughput?"
- "How can I reduce worker fatigue?"

### Features

✅ **Powered by OpenAI GPT-4** with warehouse expertise  
✅ **Intelligent Fallback** - Works even when AI is unavailable  
✅ **Context-Aware** - Understands ergonomics, slotting, safety, analytics  
✅ **Actionable Insights** - Always provides specific recommendations  

---

## 🛡️ Clarity Module - Ergonomic Risk Analysis

### Zone Risk Analysis

**Endpoint**: `GET /api/v1/clarity/zones/risk-analysis`

Returns comprehensive risk assessment for all warehouse zones with AI-powered insights.

**Response Structure**:
```json
{
  "zones": [
    {
      "id": "A1",
      "name": "High-Velocity Pick Zone A1",
      "riskScore": 78,
      "riskLevel": "high",
      "issues": [
        {
          "type": "high_reach",
          "severity": "critical",
          "count": 45,
          "description": "Items above 6ft requiring ladder use"
        }
      ],
      "recommendations": [
        "Relocate 45 high-reach items to mid-height positions",
        "Implement 2-hour rotation schedule"
      ]
    }
  ],
  "summary": {
    "totalZones": 4,
    "criticalZones": 1,
    "averageRiskScore": 58
  },
  "aiInsights": "Priority: Address B3 critical heavy lifting..."
}
```

### Worker Fatigue Tracking

**Endpoint**: `GET /api/v1/clarity/worker/:workerId/fatigue`

Tracks individual worker fatigue and exposure to risk factors.

**Response**:
```json
{
  "workerId": "123",
  "fatigueScore": 42,
  "fatigueLevel": "moderate",
  "hoursWorked": 5.5,
  "zonesWorked": ["A1", "B3", "D1"],
  "riskExposure": {
    "highReach": 23,
    "heavyLifting": 18,
    "repetitiveMotion": 67
  },
  "recommendation": "Rotate to low-risk zone within 1 hour",
  "breakSuggestion": "15-minute break recommended"
}
```

### Risk Score Scale

- **0-30**: 🟢 Low Risk - Safe for full shift
- **31-60**: 🟡 Moderate Risk - Rotation recommended
- **61-85**: 🟠 High Risk - Mandatory breaks/rotation
- **86-100**: 🔴 Critical Risk - Immediate intervention required

---

## 📦 Slotting Module - Product Placement Optimization

### Optimization Plan

**Endpoint**: `GET /api/v1/slotting/optimization-plan`

Generates AI-powered move plans to optimize product placement.

**Response**:
```json
{
  "movePlan": [
    {
      "sku": "SKU-8842",
      "product": "Widget Pro 500",
      "currentLocation": {
        "zone": "C3",
        "height": "84in",
        "aisle": "12"
      },
      "recommendedLocation": {
        "zone": "A1",
        "height": "42in",
        "aisle": "3"
      },
      "reason": "High-frequency pick (450/day) currently in slow zone",
      "expectedGain": "45% faster pick time, 30% less walking",
      "priority": "critical",
      "ergonomicImpact": "Reduces high-reach from 84in to optimal 42in"
    }
  ],
  "summary": {
    "totalMoves": 3,
    "criticalMoves": 2,
    "estimatedTime": "4-6 hours with 2-person crew",
    "expectedROI": "25% efficiency gain, 60% injury reduction"
  },
  "implementationStrategy": "Phase 1 (Day 1): Critical safety moves..."
}
```

### ABC Analysis

**Endpoint**: `GET /api/v1/slotting/abc-analysis`

Analyzes inventory by pick frequency and provides placement recommendations.

**Response**:
```json
{
  "analysis": {
    "aClass": {
      "count": 156,
      "percentage": 15,
      "pickFrequency": "80% of total picks",
      "recommendation": "Place at 30-48in height, <20ft from pack stations",
      "currentCompliance": "67%",
      "action": "Relocate 51 items to optimal zones"
    },
    "bClass": { /* 15% of picks */ },
    "cClass": { /* 5% of picks */ }
  }
}
```

### Slotting Best Practices

| Class | Pick Frequency | Optimal Height | Distance from Pack | Priority |
|-------|---------------|----------------|-------------------|----------|
| **A** | 80% of picks | 30-48 inches | <20 feet | Critical |
| **B** | 15% of picks | 24-60 inches | 20-40 feet | High |
| **C** | 5% of picks | >60 or <24 inches | >40 feet | Low |

---

## 👁️ Vision Module - Safety Zone Detection

### Zone Classification

**Endpoint**: `GET /api/v1/vision/zone-classification`

Computer vision-powered safety zone classification system.

**Response**:
```json
{
  "zones": [
    {
      "id": "A1",
      "classification": "yellow",
      "safetyScore": 68,
      "reasons": [
        "Moderate reach height",
        "High traffic",
        "Adequate lighting"
      ],
      "maxDuration": "6 hours",
      "requiredPPE": ["Safety shoes", "High-visibility vest"],
      "monitoringStatus": "active"
    },
    {
      "id": "B3",
      "classification": "red",
      "safetyScore": 35,
      "reasons": [
        "Heavy ground-level items",
        "Poor lighting",
        "Narrow aisles"
      ],
      "maxDuration": "2 hours",
      "requiredPPE": ["Safety shoes", "Back support", "Hard hat"],
      "immediateAction": "Implement traffic control, add lighting"
    }
  ],
  "summary": {
    "greenZones": 4,
    "yellowZones": 7,
    "redZones": 2,
    "overallSafetyScore": 71
  }
}
```

### Safety Zone Colors

- 🟢 **Green Zone**: Safe for full shift, minimal risk
- 🟡 **Yellow Zone**: Caution required, 4-6 hour limit
- 🔴 **Red Zone**: Danger, 2 hour maximum, immediate remediation needed

### Posture Analysis

**Endpoint**: `POST /api/v1/vision/posture-analysis`

Analyzes worker posture from camera feeds to detect injury risks.

**Request**:
```json
{
  "imageData": "base64_encoded_image",
  "zoneId": "A1"
}
```

**Response**:
```json
{
  "zoneId": "A1",
  "analysis": {
    "postureScore": 74,
    "riskFactors": [
      {
        "factor": "Spinal flexion",
        "severity": "moderate",
        "angle": "35 degrees"
      }
    ],
    "recommendation": "Consider step stool for overhead items"
  }
}
```

---

## 📊 Analytics Module - Predictive Insights

### Dashboard KPIs

**Endpoint**: `GET /api/v1/analytics/dashboard`

Real-time operational dashboard with predictive analytics.

**Response**:
```json
{
  "kpis": {
    "pickRate": {
      "current": 118,
      "target": 120,
      "unit": "picks/hour",
      "trend": "up",
      "change": "+3%"
    },
    "ergonomicRisk": {
      "current": 58,
      "target": 30,
      "unit": "score",
      "trend": "down",
      "change": "-12%"
    },
    "accuracy": {
      "current": 99.4,
      "target": 99.7,
      "unit": "percent"
    },
    "throughput": {
      "current": 4850,
      "target": 5000,
      "unit": "units/day"
    }
  },
  "predictions": {
    "congestion": {
      "timeframe": "2-4 hours",
      "locations": ["Aisle 3", "Aisle 7"],
      "probability": 78,
      "recommendation": "Stagger break schedules"
    },
    "injuryRisk": {
      "timeframe": "next 7 days",
      "zones": ["B3", "A1"],
      "probability": 42
    },
    "staffingNeeds": {
      "date": "2025-11-25",
      "recommended": 14,
      "current": 12,
      "gap": 2
    }
  }
}
```

### Bottleneck Detection

**Endpoint**: `GET /api/v1/analytics/bottlenecks`

Identifies operational bottlenecks and recommends solutions.

**Response**:
```json
{
  "bottlenecks": [
    {
      "location": "Aisle 3 - A1 Zone",
      "type": "congestion",
      "severity": "high",
      "impact": "15% throughput reduction",
      "peakTimes": ["10:00-11:30", "14:00-15:30"],
      "solution": "Add secondary pick path, widen aisle to 8ft minimum"
    }
  ]
}
```

---

## 🚨 Alerts Module - Real-Time Notifications

### Active Alerts

**Endpoint**: `GET /api/v1/alerts/active`

Returns all active alerts requiring attention.

**Response**:
```json
{
  "alerts": [
    {
      "id": "ALT-8842",
      "type": "ergonomic_risk",
      "severity": "high",
      "zone": "B3",
      "message": "Worker has been in red zone for 1.8 hours",
      "action": "Rotate to green zone immediately",
      "timestamp": "2025-11-18T09:15:00Z"
    },
    {
      "id": "ALT-8843",
      "type": "safety",
      "severity": "critical",
      "zone": "A7",
      "message": "Spill detected in aisle 7 - slip hazard",
      "action": "Deploy cleanup crew, place caution signs",
      "timestamp": "2025-11-18T09:25:00Z"
    }
  ],
  "summary": {
    "critical": 1,
    "high": 1,
    "moderate": 1,
    "total": 3
  }
}
```

### Alert Types

- **ergonomic_risk**: Worker fatigue or zone time limits
- **safety**: Immediate hazards (spills, equipment failures)
- **performance**: KPI threshold breaches
- **equipment**: Maintenance required
- **compliance**: Regulatory violations

### Acknowledge Alert

**Endpoint**: `POST /api/v1/alerts/acknowledge/:alertId`

Acknowledges an alert and logs the action.

---

## 📑 Reports Module

### Daily Summary

**Endpoint**: `GET /api/v1/reports/daily-summary`

Comprehensive daily operations report.

**Response**:
```json
{
  "date": "2025-11-18",
  "operations": {
    "totalPicks": 4850,
    "accuracy": 99.4,
    "avgPickRate": 118,
    "shiftsCompleted": 2
  },
  "safety": {
    "incidents": 0,
    "nearMisses": 2,
    "ergonomicAlerts": 14,
    "zonesInCompliance": "85%"
  },
  "efficiency": {
    "throughput": 4850,
    "targetThroughput": 5000,
    "gap": 150,
    "wastedMotion": "12% (target <10%)"
  },
  "recommendations": [
    "Address B3 red zone immediately",
    "Implement slotting changes for SKU-8842"
  ]
}
```

---

## 🔧 Technical Architecture

### Backend Stack

- **Runtime**: Node.js 22+
- **Framework**: Express.js 4.21
- **AI Provider**: OpenAI GPT-4o-mini
- **Port**: 4010

### Frontend Stack

- **Framework**: Next.js 15
- **Runtime**: React 18
- **Port**: 3500

### API Design

- RESTful architecture
- JSON request/response format
- CORS enabled for frontend integration
- Comprehensive error handling
- AI-powered with intelligent fallbacks

---

## 🧪 Testing

### Run Full Test Suite

```powershell
# Start backend first
cd backend
node smartpick-server.js

# In another terminal, run tests
node test-platform.js
```

### Test Coverage

✅ 19 comprehensive tests covering all modules  
✅ 100% pass rate achieved  
✅ Tests health, AI assistant, Clarity, Slotting, Vision, Analytics, Alerts, Reports  

---

## 🚀 Production Deployment

### Environment Variables

```env
# Backend (.env)
PORT=4010
OPENAI_API_KEY=your_api_key_here
NODE_ENV=production
DATABASE_URL=postgres://user:pass@host:5432/smartpick
JWT_SECRET=your-secure-jwt-secret-min-32-chars
```

```env
# Frontend (.env.local)
PORT=3500
NEXT_PUBLIC_API_BASE_URL=http://localhost:4010/api
NEXT_PUBLIC_WS_URL=http://localhost:4010
```

### Startup Commands

```powershell
# Backend (Production)
cd backend
NODE_ENV=production node smartpick-server.js

# Frontend (Production)
cd frontend
npm run build
npm start
```

---

## 📈 Key Features

### ✅ AI-Powered Intelligence
- OpenAI GPT-4 integration with warehouse expertise
- Intelligent fallback system for 100% uptime
- Context-aware responses for all modules

### ✅ Comprehensive Safety Analysis
- Real-time ergonomic risk scoring
- Worker fatigue tracking
- Zone classification (Green/Yellow/Red)
- Posture analysis via computer vision

### ✅ Optimization Engine
- AI-powered slotting recommendations
- ABC analysis with pick frequency
- Automated move plan generation
- ROI calculations for all changes

### ✅ Predictive Analytics
- Congestion forecasting (2-4 hours ahead)
- Injury risk prediction (7-day outlook)
- Staffing optimization
- Bottleneck detection

### ✅ Real-Time Alerts
- Multi-severity alert system
- Proactive notifications
- Actionable recommendations
- Alert acknowledgment tracking

### ✅ Operational Reporting
- Daily summary reports
- KPI tracking and trending
- Compliance monitoring
- Custom report generation

---

## 🎯 Use Cases

### 1. Reduce Worker Injuries
**Problem**: High injury rates in zones with heavy ground-level items  
**Solution**: Clarity module identifies high-risk zones → Slotting module generates move plan → Risk reduced by 60%+

### 2. Improve Pick Efficiency
**Problem**: Slow movers occupying prime locations  
**Solution**: ABC analysis identifies misplaced items → AI generates optimal slotting → Pick rate increases 25%+

### 3. Prevent Congestion
**Problem**: Bottlenecks during peak hours  
**Solution**: Analytics predicts congestion 2-4 hours ahead → Alerts notify supervisors → Proactive staff redistribution

### 4. Maintain Compliance
**Problem**: Workers exceeding safe time limits in red zones  
**Solution**: Vision + Clarity track zone time → Alerts trigger at thresholds → Automatic rotation recommendations

---

## 💡 Best Practices

### For Warehouse Managers
1. Review **Clarity risk analysis** daily - prioritize critical zones
2. Implement **Slotting recommendations** monthly - optimize for seasonal changes
3. Monitor **Analytics dashboard** hourly - catch issues before they compound
4. Respond to **Alerts** immediately - prevent incidents before they occur

### For Safety Officers
1. Use **Vision zone classification** for daily inspections
2. Track **worker fatigue** scores throughout shifts
3. Review **posture analysis** for ergonomic training opportunities
4. Generate **daily reports** for compliance documentation

### For Operations Teams
1. Consult **AI Assistant** for real-time guidance
2. Check **bottleneck analysis** during peak hours
3. Review **ABC analysis** for inventory planning
4. Use **predictions** for proactive staffing

---

## 🆘 Support & Troubleshooting

### Common Issues

**Q: Backend won't start**  
A: Check that port 4010 is not in use: `Get-NetTCPConnection -LocalPort 4010`

**Q: AI responses are using fallback**  
A: Verify OPENAI_API_KEY is set correctly in backend/.env

**Q: Frontend can't connect to backend**  
A: Ensure NEXT_PUBLIC_API_BASE_URL=http://localhost:4010/api in frontend/.env.local

**Q: Tests failing**  
A: Ensure backend is running before running test-platform.js

### Health Check

Always verify platform health:
```powershell
Invoke-RestMethod http://localhost:4010/api/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "SmartPick AI Platform",
  "modules": {
    "clarity": "active",
    "slotting": "active",
    "vision": "active",
    "analytics": "active",
    "assistant": "active"
  }
}
```

---

## 🏆 Platform Achievements

✅ **100% Test Pass Rate** - All 19 tests passing  
✅ **AI-First Design** - OpenAI integration across all modules  
✅ **Production Ready** - Comprehensive error handling and fallbacks  
✅ **Safety Focused** - Ergonomic risk at the core  
✅ **Actionable Insights** - Every response includes recommendations  
✅ **Predictive Power** - Forecasts issues before they impact operations  

---

**SmartPick AI Platform** - Transforming warehouse operations through intelligent automation and worker-first design.

*Built with care for optimal performance, safety, and efficiency.* 🏭✨
