# TOPMET Machine Monitoring Dashboard

**Sequence Analysis & Vacuum Performance Monitoring for Metallizer Machines**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-View%20Dashboard-2563EB?style=for-the-badge)](https://topmet-sequence-monitoring.vercel.app/)

## Overview

TOPMET Machine Monitoring Dashboard is a web-based industrial monitoring and data analysis system designed to evaluate the operational performance of metallizer vacuum systems across four Metz machines.

The system transforms machine sequence records, HMI parameters, and vacuum performance data into interactive visualizations to support machine comparison, operational analysis, condition monitoring, and maintenance evaluation.

By connecting machine operating sequences with vacuum pressure trends, the dashboard provides a more structured approach to understanding equipment behavior and identifying potential operational anomalies.

## Key Features

### 1. Machine Overview
Provides a consolidated overview of Metz 1–4, including machine performance rankings and key vacuum parameters.

### 2. Sequence Analysis
Visualizes component ON/OFF states throughout machine operating cycles, including component activity timelines, operating duration, and key sequence transitions.

### 3. Vacuum Pressure Trend
Displays chamber pressure behavior over time using logarithmic-scale visualization to accommodate the wide range of vacuum pressure values.

### 4. Trial Comparison
Compares Trial 1 and Trial 2 to identify differences in operating duration, pressure performance, and sequence timing.

### 5. Machine Performance
Presents comparative performance indicators and machine health scoring to support equipment condition evaluation.

### 6. Component Monitoring
Analyzes component operating duration, duty cycle, and state transitions throughout the recorded machine sequence.

### 7. Maintenance Insights
Highlights potential anomalies and provides inspection recommendations based on recorded sequence and operating parameters.

## System Architecture

The application uses a lightweight front-end architecture:

- **HTML5** — Dashboard structure and content.
- **CSS3** — Layout, styling, and responsive interface.
- **JavaScript** — Data processing, analytical calculations, interactive components, and visualization logic.

### Data Workflow

```text
HMI Records & Machine Sequence
              |
              v
     Data Collection
              |
              v
   Sequence & Parameter Data
              |
              v
      Data Processing
              |
              v
   Performance Evaluation
              |
              v
    Interactive Dashboard
              |
              v
  Maintenance Decision Support
```

## Data Sources

The dashboard is built using recorded operational data from four Metz metallizer machines.

Primary data sources include:

- Machine sequence records from Trial 1 and Trial 2.
- HMI-recorded vacuum pressure parameters.
- Component operating states and transitions.
- Electrical wiring diagrams as technical references for component identification and sequence interpretation.

The collected data is organized to support machine-level and trial-level comparisons.

## Analytical Indicators

The system evaluates several operational indicators, including:

| Indicator | Description |
|---|---|
| Coating Final Pressure | Final recorded coating chamber pressure |
| Foreline Pressure | Pressure indicator associated with the diffusion pump backing system |
| Pump-down Time | Time required to reach selected pressure thresholds |
| Pressure Stability | Recorded pressure fluctuations during operation |
| Sequence Timing | Timing of key component state transitions |
| Component Duty Cycle | Percentage of cycle time a component remains ON |

### Machine Health Scoring

A weighted scoring approach is used to compare machine performance based on selected vacuum and operational indicators.

The score is intended as a comparative condition assessment and maintenance prioritization aid, not a definitive measurement of machine health or a confirmed fault diagnosis.

Scoring criteria, normalization methods, and reference thresholds should be validated against engineering specifications and operational standards before being used for maintenance decisions.

## Technology Stack

| Technology | Purpose |
|---|---|
| HTML5 | Application structure |
| CSS3 | User interface and responsive styling |
| JavaScript | Data processing and application logic |
| Chart Visualization | Operational and pressure trend analysis |
| Vercel | Web deployment and hosting |

## Project Objectives

- Digitize machine sequence documentation and operational records.
- Improve visibility into vacuum system performance.
- Compare operating characteristics across multiple machines.
- Identify potential deviations in component sequences and pressure behavior.
- Support data-driven maintenance evaluation.
- Establish a foundation for future industrial monitoring integration.

## Current Scope & Limitations

This project currently focuses on analysis of recorded and validated machine data.

- Data is based on recorded HMI parameters and sequence documentation.
- The dashboard is not directly connected to PLC or HMI hardware.
- It does not perform live machine control or automated equipment operation.
- Maintenance recommendations are inspection suggestions, not final technical diagnoses.
- Historical comparisons depend on data completeness and comparable operating conditions.

## Future Development

Potential improvements include:

- Automated Excel data import and validation.
- Historical data storage and trend tracking.
- Integration with industrial data acquisition systems.
- Read-only PLC/SCADA connectivity through approved industrial gateways or OPC UA.
- Advanced anomaly detection and condition monitoring.
- More comprehensive equipment performance evaluation.

## Industrial Applications

This project demonstrates the integration of:

**Electrical Systems + Machine Operations + Software Development + Industrial Data Analytics**

It represents an application of industrial digitalization, connecting physical manufacturing processes with digital tools to improve operational visibility and maintenance decision support.

## Disclaimer

This dashboard is developed for machine sequence analysis, operational data visualization, and maintenance evaluation purposes. It is not a replacement for physical inspection, engineering validation, manufacturer specifications, or authorized maintenance procedures.

---

**TOPMET Machine Monitoring Dashboard**

*Bridging Industrial Systems with Digital Technology.*
