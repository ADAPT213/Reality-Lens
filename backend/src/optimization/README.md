# SmartPick AI - Product Positioning Engine

## Overview

The Product Positioning Engine uses **MachineMath** - transparent, explainable scoring to optimize SKU placement in warehouse locations. Every score is broken down into measurable components with clear weights.

## Scoring Formula

```
Score(sku, location) =
  0.4 × F (normalized pick frequency)
  - 0.3 × T (travel cost)
  - 0.2 × E (ergonomic penalty)
  - 0.1 × C (congestion penalty)
  + R (rule alignment bonus)
```

### Component Breakdown

#### 1. **Frequency Score (F)** - Weight: 40%

- **What it measures**: How often a SKU is picked
- **Data sources**:
  - Order history (30-day lookback)
  - Hourly pick patterns
  - Peak hour analysis
- **Normalization**: `picks_per_hour / max_warehouse_picks`
- **Range**: 0.0 to 1.0
- **Higher is better**: Frequently picked items score higher

#### 2. **Travel Cost (T)** - Weight: 30%

- **What it measures**: Physical distance and accessibility
- **Components**:
  - Distance from dock (meters)
  - Distance from main picking path
  - Average distance to related SKUs
- **Normalization**: `total_distance / 100m`
- **Range**: 0.0 to 1.0
- **Lower is better**: Closer locations are more efficient

#### 3. **Ergonomic Score (E)** - Weight: 20%

- **What it measures**: Physical strain risk
- **Band penalties**:
  - **Green** (50-150cm): 0.0 penalty
  - **Yellow** (<50cm or 150-200cm): 0.5 penalty
  - **Red** (>200cm or <30cm): 1.0 penalty
- **Additional factors**:
  - Average RULA score (7-day lookback)
  - Average REBA score
  - Composite risk index
  - Incident count (red traffic light events)
- **Range**: 0.0 to 1.0
- **Lower is better**: Safer locations reduce injury risk

#### 4. **Congestion Score (C)** - Weight: 10%

- **What it measures**: Zone traffic and conflicts
- **Metrics**:
  - Current picks/hour in zone
  - Peak picks/hour
  - Zone utilization (active locations / total locations)
  - Conflict probability (picks/hour per location)
- **Normalization**: Weighted combination of all factors
- **Range**: 0.0 to 1.0
- **Lower is better**: Less congested zones improve flow

#### 5. **Rule Alignment Bonus (R)** - Additive

- **What it measures**: Business rule compliance
- **Bonuses**:
  - **Client Priority**: +0.2 for priority customer SKUs in optimal zones
  - **Family Affinity**: +0.15 for SKUs co-located with family members
  - **Lane Affinity**: +0.1 for SKUs placed near preferred shipping lanes
- **Range**: 0.0 to 0.45
- **Cumulative**: Multiple rules can stack

## API Endpoints

### Calculate Score

```
GET /optimization/warehouses/:warehouseId/score
  ?skuId=<sku-id>
  &locationId=<location-id>

Response:
{
  "totalScore": 0.623,
  "breakdown": {
    "frequencyScore": 0.82,
    "travelCostScore": 0.45,
    "ergonomicScore": 0.12,
    "congestionScore": 0.23,
    "ruleAlignmentScore": 0.35,
    "weights": { ... }
  },
  "components": { ... }
}
```

### Explain Score

```
GET /optimization/warehouses/:warehouseId/explain
  ?skuId=<sku-id>
  &locationId=<location-id>

Response:
{
  "score": { ... },
  "explanation": [
    "Total Score: 0.623",
    "Frequency (40%): 0.820 - 41.2 picks/hour",
    "Travel Cost (30%): -0.450 - 45.3m from dock",
    ...
  ]
}
```

### Generate Recommendations

```
GET /optimization/warehouses/:warehouseId/recommendations
  ?limit=20
  &minImpact=0.1

Response:
{
  "recommendations": [
    {
      "skuCode": "SKU-12345",
      "fromLocationLabel": "A1-B2-L3",
      "toLocationLabel": "A1-B1-L2",
      "scoreImprovement": 0.487,
      "impactAnalysis": {
        "secondsPerPickSaved": 7.3,
        "riskReductionPercent": 45.2,
        "affectedOrdersPerDay": 328,
        "effortEstimate": {
          "estimatedMinutes": 25
        }
      },
      "roi": 347.6,
      "priority": "high",
      "reasoning": "Moves from red to green ergonomic band; Saves 7.3s per pick"
    }
  ],
  "summary": {
    "totalRecommendations": 20,
    "totalSecondsPerDaySaved": 12450,
    "totalRiskReduction": 32.4,
    "estimatedImplementationHours": 8.5
  }
}
```

### Compare Locations

```
GET /optimization/warehouses/:warehouseId/compare
  ?skuId=<sku-id>
  &locationIds=<loc1>,<loc2>,<loc3>

Returns scores for all locations, sorted by total score
```

### Find Best Location

```
POST /optimization/warehouses/:warehouseId/find-best
{
  "skuId": "sku-123",
  "candidateLocationIds": ["loc1", "loc2", "loc3"]
}

Returns the optimal location with full score breakdown
```

## Database Schema

### location_properties

- Stores physical attributes: aisle, bay, level, ergonomic band
- Calculated distances: dock, main path, accessibility

### sku_constraints

- Weight class, stack limits, equipment requirements
- Temperature ranges, hazmat classifications
- Incompatibility rules

### service_rules

- Warehouse-specific business rules (JSON)
- Client priorities, SKU families, lane affinities
- Configurable per warehouse

### move_recommendations

- Generated recommendations with full impact analysis
- Status tracking (pending, approved, implemented)
- Historical record for optimization effectiveness

## Configuration

### Warehouse-Specific Weights

Customize scoring weights per warehouse:

```typescript
{
  frequency: 0.4,    // 40% weight
  travelCost: 0.3,   // 30% weight
  ergonomic: 0.2,    // 20% weight
  congestion: 0.1    // 10% weight
}
```

## Scoring Components

Each component is a separate service for modularity:

- **FrequencyCalculator** (`scoring/frequency-calculator.ts`)
- **TravelCostCalculator** (`scoring/travel-cost-calculator.ts`)
- **ErgonomicScorer** (`scoring/ergonomic-scorer.ts`)
- **CongestionAnalyzer** (`scoring/congestion-analyzer.ts`)
- **RuleEngine** (`scoring/rule-engine.ts`)

## Usage Example

```typescript
// Inject the service
constructor(private positioningEngine: PositioningEngineService) {}

// Calculate score for a SKU at a location
const result = await this.positioningEngine.calculateScore(
  skuId,
  locationId,
  warehouseId
);

console.log(`Total Score: ${result.totalScore}`);
console.log(`Frequency: ${result.components.frequency.picksPerHour} picks/hour`);
console.log(`Ergonomic Band: ${result.components.ergonomic.band}`);

// Find the best location for a SKU
const best = await this.positioningEngine.findBestLocation(
  skuId,
  candidateLocationIds,
  warehouseId
);

console.log(`Best location: ${best.locationId}`);
console.log(`Score: ${best.score.totalScore}`);
```

## Migration

Run the following to create the new tables:

```bash
npm run migrate:dev
```

## Design Principles

1. **Transparency**: Every score is fully explainable
2. **Configurability**: Weights can be adjusted per warehouse
3. **Real-time**: Uses live ergonomic, congestion, and pick data
4. **Actionable**: Recommendations include ROI and effort estimates
5. **Traceable**: All recommendations are stored with impact metrics
