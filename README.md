# Kolkata JolSafety (কলকাতা জল-সুরক্ষা)

**Real-Time Urban Flood Intelligence, Waterlogging Telemetry, Electrocution Hazard Prevention & Climate-Resilient Routing Platform for Greater Kolkata**

[![Architecture: Event-Driven GIS & Hydrological Telemetry](https://img.shields.io/badge/Architecture-Hydrological%20GIS%20%2B%20Edge%20IoT-0284c7?style=flat-square)](#system-architecture--core-pipelines)
[![Target Authority: KMC / KMDA / Disaster Management](https://img.shields.io/badge/Domain-Civic%20Resilience%20%26%20Urban%20Hydrology-0f766e?style=flat-square)](#problem-statement--kolkata-hydrological-context)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-334155?style=flat-square)](#license)

---

## 1. Executive Summary

**Kolkata JolSafety** is an end-to-end urban hydro-meteorological intelligence and citizen safety platform purpose-built for the unique topographical, tidal, and drainage realities of the **Kolkata Municipal Corporation (KMC)** and **Kolkata Metropolitan Development Authority (KMDA)** regions.

Unlike generic weather apps that only report macro-level precipitation, **Kolkata JolSafety** fuses **Hooghly River tidal lock schedules**, **micro-catchment elevation profiles**, **KMC pumping station discharge telemetry**, **ultrasonic street-level water-depth sensors**, **computer-vision crowdsourced flood verification**, and **CESC/WBSEDCL live-wire hazard reports** into a unified operational picture. The platform computes real-time **Safe-Passage Routing** for citizens, emergency ambulances, and civic response units while giving KMC Drainage Department engineers predictive inundation lead-time across all **144 KMC wards**.

---

## 2. Problem Statement & Kolkata Hydrological Context

Kolkata's urban flooding is not merely a rainfall problem—it is a **coupled compound-flooding phenomenon**:

1. **Inverted Saucer Topography & Subsidence**: Much of central, north, and east Kolkata slopes *away* from the Hooghly River toward the East Kolkata Wetlands (Bidyadhari basin), creating natural retention bowls in pockets such as **Thanthania Kalibari, College Street, Amherst Street, Behala, Ultadanga, Ballygunge, and Ekbalpore**.
2. **Hooghly Tidal Lock-In Effect**: During high tide (especially spring tides / *Bhora Kotal*), the lock gates along the Hooghly outfalls must be closed to prevent river backflow. If a cloudburst (>50 mm/hr) coincides with a 4-hour tidal lock window, gravity drainage ceases completely and stormwater backs up across arterial corridors within 25–40 minutes.
3. **Submerged Electrocution & Open-Manhole Hazards**: Every monsoon, fatalities in Kolkata occur not from drowning, but from **submerged live electrical feeder boxes, street-light poles, and unbarricaded open manholes** hidden beneath opaque waterlogged streets.
4. **Siltation & Combined Sewer Overflow (CSO)**: Legacy colonial-era brick sewers (Town System & Suburban System) and open outfall canals (*khals*—Tolly's Nullah, Beliaghata Circular Canal, Bagjola, Kestopur, Panchannagram) operate near capacity under high sediment load.

**Kolkata JolSafety** bridges the gap between **macro meteorological warnings** and **street-by-street actionable survival intelligence**.

---

## 3. System Architecture & Core Pipelines

The platform is engineered around **six deterministic, fault-tolerant data and ML pipelines** designed for low-bandwidth monsoon resilience and sub-second geospatial querying.

```text
+---------------------------------------------------------------------------------------------------+
|                                 1. MULTI-MODAL INGESTION LAYER                                    |
|  [IMD Doppler Radar / AWS]   [Hooghly Tide Gauge API]   [KMC Sump Pump SCADA]   [Edge IoT Nodes]  |
|  [Citizen CV Crowdsourcing]  [CESC/WBSEDCL Fault Feed]  [SRTM / LiDAR DEM]      [144-Ward GIS]    |
+-------------------------------------------------+-------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
|                         2. STREAM PROCESSING & SPATIAL FUSION PIPELINE                            |
|     Apache Kafka / Redis Streams  --->  PostGIS / H3 Hexagonal Spatial Indexing (Resolution 10)   |
+------------------------+-------------------------------------------------+------------------------+
                         |                                                 |
                         v                                                 v
+------------------------------------------------+ +------------------------------------------------+
|   3. HYDROLOGICAL NOWCASTING & RISK PIPELINE   | |  4. CV VERIFICATION & HAZARD TRIAGE PIPELINE   |
| - Tidal Lock + Runoff Balance Solver           | | - Reference-Object Water Depth Estimation      |
| - 15/30/60-min Ward Inundation Forecast        | | - EXIF / GPS Spoofing & Duplicate Filtering    |
| - Electrocution & Manhole Risk Scoring         | | - Live-Wire / Fallen Pole Priority Escalation  |
+------------------------+-----------------------+ +-----------------------+------------------------+
                         |                                                 |
                         +------------------------+------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
|                     5. DYNAMIC SAFE-PASSAGE & EMERGENCY ROUTING PIPELINE                          |
|  OSRM / pgRouting Graph  +  Time-Dependent Flood Edge Weights  +  Vehicle Clearance Profiles      |
|  (Pedestrian | Two-Wheeler | Hatchback/Sedan | Critical Ambulance / NDRF High-Clearance)          |
+-------------------------------------------------+-------------------------------------------------+
                                                  |
                                                  v
+---------------------------------------------------------------------------------------------------+
|                        6. OMNI-CHANNEL DISPATCH & OFFLINE-FIRST DELIVERY                          |
|  [PWA Offline Map Cache]  [KMC Control Room Dashboard]  [Bengali/Hindi/English Voice & SMS Alerts]|
+---------------------------------------------------------------------------------------------------+
```

---

### Pipeline 1: Multi-Sensor Hydrological & Tidal Ingestion Pipeline

Ingests heterogeneous real-time and static geospatial streams, normalizes timestamps to `Asia/Kolkata (IST)`, and projects coordinates into **EPSG:32645 (UTM Zone 45N)** and **Uber H3 Hexagonal Cells (Resolution 9 & 10 — ~100m street blocks)**:

* **Meteorological Telemetry**: IMD Kolkata (Alipore & Dum Dum) Automatic Weather Stations (AWS) 15-minute rainfall accumulation (mm) and Doppler Weather Radar (DWR) reflectivity nowcasts.
* **Tidal & Outfall Boundary Conditions**: Kolkata Port Trust (Syama Prasad Mookerjee Port) Garden Reach tide-gauge telemetry, predicted high/low tide curves, and lock-gate status (`OPEN`, `THROTTLED`, `TIDAL_LOCK_CLOSED`).
* **Drainage Infrastructure State**: Real-time operational status and discharge rates (cusecs) from major KMC pumping stations (**Palmerazar, Ballygunge, Dhapa Lock, Ultadanga, Maniktala, Mominpore, Behala Flying Club, Chowbaga**).
* **Street-Level Edge IoT Telemetry**: Low-power LoRaWAN / NB-IoT ultrasonic water-level nodes (`JSN-SR04T` + `ESP32`) mounted on street-light poles at 75+ chronic waterlogging hotspots, transmitting median-filtered water depth (`cm` above carriageway crown) every 120 seconds.

```text
[Ultrasonic / Pressure Node] --> [Kalman Spike Filter] --> [MQTT / LoRa Gateway]
                                                                    |
[IMD Radar + Port Tide API]  --> [Schema Normalizer]  --------------+--> [TimescaleDB + PostGIS]
```

---

### Pipeline 2: Computer Vision (CV) Crowdsourced Verification & Anti-Spoofing Pipeline

During peak monsoon events, citizen reports provide critical coverage where physical IoT sensors are absent. To prevent false alarms, panic, or stale recycled photos, every uploaded image/video passes through a strict **4-stage verification pipeline**:

1. **Cryptographic & Spatio-Temporal Metadata Validation**:
   * Verifies device GPS coordinates, compass bearing, timestamp recency (`< 20 minutes`), and H3 cell alignment with active rainfall radar cells.
2. **Semantic Segmentation & Reference-Object Depth Estimation**:
   * Uses a lightweight vision pipeline to segment water surface area and estimate depth by measuring submergence ratios against standardized urban reference objects:
     * **KMC Black-and-Yellow / White-and-Blue Kerbstones** (`~15–20 cm`)
     * **Two-Wheeler / Autorickshaw / Car Wheel Hubs** (`~25–35 cm` — engine stall threshold)
     * **Pedestrian Knee / Waist Landmarks** (`>45 cm` — severe inundation)
3. **Critical Hazard Detection (Electrocution & Open Manholes)**:
   * Flags visual or textual indicators of sparking CESC junction boxes, submerged transformer plinths, fallen overhead cables, or dislodged manhole covers for **Priority-0 Zero-Latency Escalation**.
4. **Bayesian Consensus & Trust Scoring**:
   * Aggregates multiple citizen reports within the same H3 hexagon and cross-validates against nearest ultrasonic sensor readings and topographical depression indices before updating the public routing graph.

---

### Pipeline 3: Compound Flood Nowcasting & Micro-Catchment Risk Scoring Pipeline

Computes a deterministic + ML hybrid **Inundation Depth & Risk Index ($R_{cell}$)** for every 100m road segment at **T+0 (Live), T+15 min, T+30 min, and T+60 min**:

$$\text{Net Accumulation Rate } \frac{dH}{dt} = \underbrace{I(t) \cdot C_{\text{runoff}}}_{\text{Rainfall Inflow}} + \underbrace{Q_{\text{upstream}}(t)}_{\text{Slope Convergence}} - \underbrace{\eta_{\text{tidal}}(t) \cdot Q_{\text{pump/sewer}}}_{\text{Effective Drainage Capacity}}$$

Where:
* $I(t)$: Local rainfall intensity (mm/hr) from IMD AWS + radar extrapolation.
* $C_{\text{runoff}}$: Impervious surface coefficient derived from built-up land-use density (`0.75 – 0.92` in dense North/Central Kolkata wards).
* $Q_{\text{upstream}}(t)$: Topographical Wetness Index (TWI) flow accumulation from adjacent higher-elevation cells.
* $\eta_{\text{tidal}}(t) \in [0, 1]$: Tidal drainage efficiency factor, which drops toward `0.15` when Hooghly tide height exceeds outfall sill elevation (`Tidal Lock Active`).
* $Q_{\text{pump/sewer}}$: Active pumping station extraction capacity minus historical canal siltation penalty.

#### Composite Street Hazard Classification

| Severity Tier | Water Depth ($d$) | Compound Hazard Triggers | Operational Action |
| :--- | :--- | :--- | :--- |
| **TIER 0 — CLEAR** | `< 5 cm` | Normal drainage; no tidal lock | All vehicles & pedestrians permitted |
| **TIER 1 — CAUTION** | `5 – 15 cm` | Kerb-level ponding; slow drainage | Pedestrian ankle-deep; low-floor two-wheelers cautioned |
| **TIER 2 — SEVERE WATERLOGGING** | `15 – 35 cm` | Exhaust submergence risk; tidal lock active | **Reroute Two-Wheelers & Hatchbacks**; stall warning |
| **TIER 3 — CRITICAL / NO-GO** | `> 35 cm` | High-depth inundation or unverified manhole | **Closed to standard traffic**; only high-clearance rescue/buses |
| **TIER 4 — LETHAL HAZARD (BLACK)** | *Any depth* | **Live wire / CESC feeder submergence / open manhole** | **Hard Geofence Block**; automated CESC & KMC emergency dispatch |

---

### Pipeline 4: Flood-Aware Dynamic Routing & Emergency Corridor Pipeline

Standard navigation engines route drivers straight into flooded underpasses and low-lying bowls because traffic speed appears "clear" when vehicles have stopped entering. **Kolkata JolSafety** modifies the road network graph $G = (V, E)$ in real time:

1. **Dynamic Edge Cost Formulation**:
   For each road edge $e \in E$ and vehicle/user profile $p \in \{\text{Pedestrian}, \text{TwoWheeler}, \text{Car}, \text{Ambulance}\}$:

   $$W(e, p) = \begin{cases} \infty & \text{if } \text{ElectroHazard}(e) = \text{True} \text{ or } d(e) > d_{\text{max}}(p) \\ T_{\text{base}}(e) \cdot \left(1 + \alpha_p \left(\frac{d(e)}{d_{\text{max}}(p)}\right)^2 + \beta \cdot \text{ManholeRisk}(e)\right) & \text{otherwise} \end{cases}$$

2. **Vehicle Safe-Wading Clearance Thresholds ($d_{\text{max}}$)**:
   * **Pedestrian**: `15 cm` (strict zero-tolerance around electrified poles or open manholes)
   * **Two-Wheeler / EV Scooter**: `18 cm` (prevents air-intake ingestion & battery pack shorting)
   * **Sedan / Hatchback**: `22 cm` (prevents hydrostatic engine lock)
   * **SUV / Bus / Emergency Ambulance**: `40 cm` (prioritizes elevated flyovers: **Maa Flyover, AJC Bose Road Flyover, Park Street Flyover, Sealdah Flyover, Chingrighata**)
3. **Medical & Disaster Corridor Guarantee**:
   * Computes guaranteed dry/passable access corridors to major trauma and medical hubs (**SSKM Hospital, Calcutta Medical College, NRS, RG Kar, Apollo Gleneagles, AMRI**) even during severe city-wide waterlogging.

---

### Pipeline 5: Electrocution & Civic Incident Response Dispatch Pipeline

A dedicated life-safety pipeline addressing Kolkata's #1 monsoon fatality cause:

```text
[Citizen / Guard Reports Sparking Pole or Submerged Feeder Box]
                            |
                            v
     [Geo-Fenced 150m Lethal Hazard Exclusion Zone]
                            |
       +--------------------+--------------------+
       |                                         |
       v                                         v
[Utility Isolation Webhook]             [Hyper-Local Citizen Broadcast]
- CESC / WBSEDCL Feeder ID Lookup       - Audio Alert in Bengali / Hindi / English
- Automated LT/HT Isolation Ticket      - Reroutes all active pedestrians within 250m
- KMC Streetlight Dept Notification     - Tracks "Reported -> Isolated -> Cleared" SLA
```

---

### Pipeline 6: Offline-First Edge Caching & Vernacular Alert Delivery Pipeline

During severe Nor'westers (*Kalboishakhi*), cyclones, or heavy monsoon cells, cellular data packet loss spikes across waterlogged wards:

* **Progressive Web App (PWA) & IndexedDB Spatial Cache**: Pre-caches Kolkata ward boundaries, chronic waterlogging polygons, emergency shelter locations, and the last known flood graph so citizens can view safe routes even with intermittent 2G/offline connectivity.
* **Delta-Compressed Telemetry Sync**: Uses compact GeoJSON / FlatGeobuf payloads (<18 KB per sync) for low-bandwidth updates.
* **Trilingual Accessibility**: Supports **Bengali (বাংলা)**, **English**, and **Hindi (हिन्दी)** with high-contrast outdoor monsoon visibility and voice-guided hazard readouts for two-wheeler riders and senior citizens.

---

## 4. Key Functional Modules

| Module | Primary Users | Core Capabilities |
| :--- | :--- | :--- |
| **1. Live Ward & Street Flood Map** | Citizens, Commuters | Interactive ward-level & street-segment inundation map, live tide-lock status banner, pumping station telemetry, and electrocution hazard markers. |
| **2. Safe-Passage Route Planner** | Commuters, Ambulance Drivers | Origin-to-destination routing customized by mode (`Pedestrian`, `Two-Wheeler`, `Car`, `Ambulance`) that actively avoids flooded pockets and submerged live wires. |
| **3. Crowdsourced Hazard Reporter** | Citizens, Civic Volunteers | 10-second reporting workflow with reference-object depth selector (Ankle / Knee / Wheel-hub / Waist), live-wire toggle, and CV verification badge. |
| **4. KMC & Disaster Command Center** | KMC Engineers, NDRF, Police | 144-ward risk matrix, Hooghly tide vs. rainfall convergence monitor, portable pump deployment optimizer, and CESC feeder isolation tracker. |
| **5. Predictive Early Warning Engine** | Ward Coordinators, Schools, Hospitals | 15–60 minute compound flood forecasting combining IMD radar cells with Hooghly high-tide windows. |

---

## 5. Technology Stack

| Layer | Technology Choices | Engineering Rationale |
| :--- | :--- | :--- |
| **Frontend & GIS Visualization** | React 19, TypeScript, Vite, Tailwind CSS, Leaflet / MapLibre GL | Zero-jank vector tile rendering, responsive mobile-first field UI, and offline PWA caching. |
| **Backend & API Gateway** | Node.js / Express & Python FastAPI Microservices | High-concurrency telemetry ingestion paired with Python scientific/hydrological compute. |
| **Geospatial & Time-Series Data** | PostgreSQL + PostGIS, TimescaleDB, SQLite (Local/Edge Prototype) | Native spatial indexing (`GIST`), Uber H3 hexagonal aggregation, and high-write sensor time series. |
| **Routing & Graph Engine** | Custom Dijkstra / A* Flood-Cost Graph + OSRM Integration | Sub-50ms dynamic edge weight recalculation when new flood or electrocution reports arrive. |
| **AI / Computer Vision & Analytics** | Gemini Vision / PyTorch Edge Segmentation + Explainable Rule Engine | Reference-object water depth estimation and deterministic, auditable hydrological risk scoring. |

---

## 6. Repository Structure

```text
kolkata-jolsafety/
├── src/
│   ├── components/             # Interactive GIS Map, Safe-Route Planner, KMC Command Console, Hazard Reporter
│   ├── lib/
│   │   ├── hydrologyEngine.ts  # Compound flood nowcasting (Rainfall + Tidal Lock + Pump Discharge solver)
│   │   ├── routingGraph.ts     # Vehicle-specific flood-safe A* routing & electrocution geofencing
│   │   └── cvVerification.ts   # Crowdsourced depth estimation & anti-spoofing validation logic
│   ├── types/                  # Strict TypeScript contracts for Wards, Sensors, Alerts & Routing
│   └── App.tsx                 # Main application shell & offline-resilient state coordinator
├── server.ts                   # Telemetry API, GIS spatial endpoints, CESC/KMC dispatch webhooks & persistence
├── package.json                # Dependencies, build scripts, and test runners
└── README.md                   # System architecture & pipeline documentation
```

---

## 7. Local Development & Deployment Guide

### Prerequisites
* **Node.js** `>= 20.x` (with built-in SQLite / TypeScript runtime support)
* **npm** `>= 10.x`

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/your-org/kolkata-jolsafety.git
cd kolkata-jolsafety
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and configure optional external API keys:
```bash
cp .env.example .env
```

```env
# Optional: For AI-assisted visual water-depth & hazard verification
GEMINI_API_KEY="your_api_key_here"
APP_URL="http://localhost:3000"
```

### 3. Run the Application Locally
```bash
npm run dev
```
The application and backend telemetry API will start on `http://localhost:3000`.

### 4. Run Automated Verification & Pipeline Unit Tests
```bash
npm test
npm run build
```

---

## 8. Validation Metrics & Engineering Benchmarks

To ensure production readiness for civic deployment rather than a static mockup, **Kolkata JolSafety** is evaluated against four operational benchmarks:

1. **Compound Flood Nowcast Accuracy**: Evaluates predicted street inundation depth against historical KMC monsoon logs (e.g., September 2021 & Cyclone Remal 2024 cloudburst + high-tide events) across 25 benchmark wards.
2. **Zero-Tolerance Electrocution Avoidance**: Guarantees `100%` route exclusion within a `150m` buffer of any verified active electrical hazard (`W(e, p) = ∞`).
3. **Sub-Second Dynamic Rerouting**: Recalculates safe routes across Kolkata's arterial graph in `< 45 ms` upon receiving a new sensor spike or verified citizen report.
4. **Low-Bandwidth Resilience**: Full initial map & telemetry state loads in `< 1.5s` on throttled 3G connections, with offline fallback for active navigation corridors.

---

## 9. Roadmap for KMC / KMDA Civic Integration

* **Phase 1 (Monsoon Readiness Pilot)**: Deployment across 15 chronic waterlogging wards in North and Central Kolkata (Wards 6, 37, 38, 40, 48, 69, 70, 85, 115–130) with LoRaWAN ultrasonic pole sensors.
* **Phase 2 (SCADA & Utility Coupling)**: Direct API integration with KMC Drainage SCADA servers and CESC automated feeder-trip telemetry.
* **Phase 3 (Regional Expansion)**: Scaling hydrological meshes to Bidhannagar (Salt Lake), New Town (NKDA), Howrah Municipal Corporation (HMC), and Barrackpore/Barasat peri-urban basins.

---

## 10. License

Distributed under the **Apache License 2.0**. Built for civic resilience, public safety, and urban flood mitigation in Kolkata.
