## FEAT-04: Historical Price Benchmarking & Outlier Engine
[← Back to Feature Details](Feature-Details)

### 1. Overview & Purpose
Empowers technology bidders to formulate competitive pricing strategies by comparing current procurement budgets against historical awarded contracts across BMA and central government agencies.

### 2. Architecture & Components
- **UI Component**: `src/components/analytics/HistoricalAnalyticsView.tsx`, `BoxPlotChart.tsx`
- **Route Handler**: `GET /api/historical`
- **Primary Model**: `src/models/HistoricalProject.ts`
- **Visualization**: `Chart.js` + `react-chartjs-2`

```mermaid
flowchart TD
    CurrentProj[Selected Project Budget] --> QueryHist[Query Historical Projects by Category]
    QueryHist --> CalcStats[Calculate Quartiles:\nQ1, Median, Q3, IQR]
    CalcStats --> OutlierCheck{Budget > Q3 + 1.5*IQR\nOR\nBudget < Q1 - 1.5*IQR?}
    OutlierCheck -->|Yes| Warning[Display Outlier Warning Banner:\n'Budget is statistically unusually High/Low']
    OutlierCheck -->|No| Normal[Display 'Within Expected Historical Range' Indicator]
    CalcStats --> RenderCharts[Plot Historical Percentiles & Agency Spend Distribution]
```

### 3. Statistical Algorithms
- **Five-Number Summary**: Minimum, First Quartile (Q1), Median, Third Quartile (Q3), Maximum.
- **Interquartile Range (IQR)**:
 
IQR=Q3-Q1
- **Outlier Boundary Gates**:
  - High Outlier Threshold: UpperBound=Q3+1.5IQR
  - Low Outlier Threshold: LowerBound=Q1-1.5IQR
- **Agency Analytics Aggregation**: Total budget spend, project counts, and average contract sizes across agencies.

---
