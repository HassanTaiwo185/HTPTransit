HTPTransit — Intelligent Transit Backend
HTPTransit is a backend service built with FastAPI, Uvicorn, and a lightweight machine‑learning pipeline to support real‑time and predictive transit features. It includes automated setup, model training, geocoding utilities, and a modern frontend stack powered by Tailwind CSS and MapLeaf.

🚀 Overview
HTPTransit provides:

A FastAPI backend with auto‑generated API docs

Real‑time server via Uvicorn

Machine‑learning model training (scikit‑learn)

Automated geocoding for Durham school locations

Websocket support

Frontend tooling (Tailwind CSS + MapLeaf already configured)

A one‑command setup script (setup.sh) that installs dependencies, prepares environment variables, trains the ML model, geocodes data, and launches the server

📦 Tech Stack
Backend
FastAPI

Uvicorn

WebSockets

SlowAPI (rate limiting)

Pydantic v2

HTTPX

python‑multipart

Machine Learning
scikit‑learn

pandas

numpy

Frontend
Tailwind CSS (preconfigured)

MapLeaf (preconfigured)

npm for package management

🛠 Installation & Setup
1. Clone the repository
bash
git clone https://github.com/HassanTaiwo185/HTPTransit
cd HTPTransit
🐍 Backend Setup
2. Install Python dependencies
bash
pip install -r requirements.txt
Or manually:

bash
pip install fastapi==0.111.0 uvicorn[standard]==0.29.0 websockets==12.0 scikit-learn==1.4.2 pandas==2.2.2 numpy==1.26.4 python-multipart==0.0.9 pydantic==2.7.1 httpx==0.27.0 slowapi==0.1.9
🌐 Frontend Setup
3. Install Node dependencies
bash
npm install
Tailwind CSS
Tailwind is already configured in the project.
All required files (tailwind.config.js, postcss.config.js, CSS imports) are included.
No extra setup is required.

MapLeaf
MapLeaf is also already set up.
Just ensure dependencies are installed:

bash
npm install mapleaf
No additional configuration is needed unless customizing the map.

🔑 Environment Variables
Create a .env file:

Code
TRANSIT_API_KEY=your_key_here
If .env is missing, the setup script will generate one automatically and prompt you to add your API key.

⚙️ One‑Command Setup (Recommended)
Run the automated setup script:

bash
bash setup.sh
This script will:

Check Python installation

Install backend dependencies

Create or validate .env

Train the ML model (if missing)

Geocode Durham school locations (if missing)

Start the FastAPI server

▶️ Running the Server Manually
bash
uvicorn app.main:app --reload
Server will start at:

API Root: http://localhost:8000

API Docs: http://localhost:8000/docs

📁 Project Structure
Code
HTPTransit/
│
├── app/
│   ├── main.py           # FastAPI entry point
│   ├── ml/
│   │   ├── train.py      # ML model training script
│   │   └── model.pkl     # Generated model
│   └── ...
│
├── data/
│   └── durham_schools_geocoded.csv
│
├── ml/
│   └── geocode_schools.py
│
├── setup.sh              # Automated setup script
├── requirements.txt
└── README.md
🤖 Machine Learning Pipeline
The ML component:

Loads transit‑related datasets

Trains a predictive model using scikit‑learn

Saves the model to app/ml/model.pkl

Automatically retrains if the model is missing

🗺 Geocoding
The script ml/geocode_schools.py:

Fetches coordinates for Durham schools

Saves results to data/durham_schools_geocoded.csv

Automatically runs during setup if the file is missing

🧪 Testing the API
Once the server is running, visit:

Code
http://localhost:8000/docs
You can test all endpoints interactively using Swagger UI. 
