## 3. AI Document Intelligence & Classification

### `POST /api/ai/classify`
Classifies a short project title and description using `gemini-1.5-flash` to determine whether it is software-related.

- **Access**: Internal / Service
- **Request Body**:
  ```json
  {
    "title": "โครงการจ้างเหมาพัฒนาระบบคลังข้อมูลและการเชื่อมโยงข้อมูลขนาดใหญ่",
    "description": "จัดทำ Data Lakehouse และ API เชื่อมโยง 15 หน่วยงาน"
  }
  ```
- **Response (`200 OK`)**:
  ```json
  {
    "isSoftwareRelated": true,
    "category": "Database",
    "confidence": "High",
    "confidenceScore": 0.94,
    "reasoning": "Scope focuses on Data Lakehouse architecture, ETL pipelines, and API integrations."
  }
  ```

---

### `POST /api/ai/extract`
Submits a TOR document (base64 binary or public URL) to Vertex AI (`gemini-1.5-pro`) to extract the complete Five Business Pillars.

- **Access**: Internal Ingestion / Admin
- **Request Body**:
  ```json
  {
    "documentUrl": "http://egp2.bangkok.go.th/docs/tor_100234.pdf",
    "language": "th"
  }
  ```
- **Response (`200 OK`)**: Returns structured JSON matching the Five-Pillar schema.

