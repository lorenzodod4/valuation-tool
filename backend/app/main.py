import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import valuation

app = FastAPI(title="Valuation Tool API", version="0.1.0")

# CORS configuration
# In production, set ALLOWED_ORIGINS env var to a comma-separated list of allowed domains
# Example: ALLOWED_ORIGINS=https://valuation-tool.vercel.app,https://www.valuation-tool.com
default_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

env_origins = os.getenv("ALLOWED_ORIGINS", "")
if env_origins:
    extra_origins = [o.strip() for o in env_origins.split(",") if o.strip()]
    allowed_origins = default_origins + extra_origins
else:
    allowed_origins = default_origins

# Allow Vercel preview deployments via regex (any *.vercel.app subdomain)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(valuation.router)


@app.get("/")
def root() -> dict[str, str]:
    return {"status": "ok", "service": "valuation-tool-api"}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "healthy"}
