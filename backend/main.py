"""
CallShield AI — Standalone Python FastAPI Backend Reference
Supports real audio DSP (librosa, numpy, soundfile), SQLite persistence,
Speech Emotion Recognition (SER), and Hybrid Fraud Risk Scoring.
"""
import base64
import io
import json
import os
import sqlite3
import time
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy as np

try:
    import soundfile as sf
except ImportError:
    sf = None

app = FastAPI(
    title="CallShield AI Forensic API",
    version="2.4.0",
    description="Real-Time Speech Emotion Analysis and Cybercrime Fraud Detection API",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "callshield_fastapi.sqlite")
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute(
        "CREATE TABLE IF NOT EXISTS analyses (id TEXT PRIMARY KEY, created_at TEXT, payload TEXT)"
    )
    conn.execute(
        "CREATE TABLE IF NOT EXISTS cases (id TEXT PRIMARY KEY, case_reference TEXT, updated_at TEXT, payload TEXT)"
    )
    return conn


@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "service": "CallShield AI Python FastAPI Engine",
        "soundfileAvailable": sf is not None,
        "numpyVersion": np.__version__,
    }
