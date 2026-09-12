"""Local JobSpy sidecar, adapted from JobTrail's MIT-licensed service.

The Electron main process is the only intended caller. Identical searches are
cached to keep result sets responsive and reduce pressure on public job sources.
"""

import math
import os
from typing import Any, Optional

from cachetools import TTLCache
from fastapi import FastAPI, HTTPException
from jobspy import scrape_jobs
from pydantic import BaseModel, Field

CACHE_TTL = int(os.environ.get("JOBSPY_CACHE_TTL", "600"))
PROXIES_RAW = os.environ.get("JOBSPY_PROXIES", "").strip()
PROXIES = [value.strip() for value in PROXIES_RAW.split(",") if value.strip()] or None
CACHE: TTLCache = TTLCache(maxsize=128, ttl=CACHE_TTL)


class SearchRequest(BaseModel):
    site_name: list[str] = Field(default_factory=lambda: ["linkedin", "indeed"])
    search_term: str
    google_search_term: Optional[str] = None
    location: Optional[str] = None
    country_indeed: str = "canada"
    distance: int = Field(default=50, ge=1, le=200)
    results_wanted: int = Field(default=24, ge=1, le=50)
    offset: int = Field(default=0, ge=0)
    hours_old: Optional[int] = Field(default=None, ge=1)
    is_remote: Optional[bool] = None
    job_type: Optional[str] = None


app = FastAPI(title="Local JobTrail JobSpy service", version="0.1.0")


@app.get("/health")
def health():
    return {"status": "ok", "cacheTtl": CACHE_TTL}


def clean(value: Any):
    if value is None:
        return None
    enum_value = getattr(value, "value", None)
    if enum_value is not None:
        return clean(enum_value)
    scalar = getattr(value, "item", None)
    if callable(scalar):
        try:
            return scalar()
        except (TypeError, ValueError):
            pass
    if isinstance(value, float) and math.isnan(value):
        return None
    iso = getattr(value, "isoformat", None)
    if callable(iso):
        try:
            return iso()
        except Exception:
            return str(value)
    return value


def cache_key(request: SearchRequest) -> str:
    return "|".join([
        ",".join(sorted(request.site_name)), request.search_term.lower().strip(),
        (request.location or "").lower().strip(), request.country_indeed,
        str(request.results_wanted), str(request.offset), str(request.hours_old),
        str(request.is_remote), str(request.job_type),
    ])


@app.post("/search")
def search(request: SearchRequest):
    key = cache_key(request)
    if key in CACHE:
        return {"cached": True, **CACHE[key]}

    try:
        frame = scrape_jobs(
            site_name=request.site_name,
            search_term=request.search_term,
            google_search_term=request.google_search_term,
            location=request.location,
            country_indeed=request.country_indeed,
            distance=request.distance,
            results_wanted=request.results_wanted,
            offset=request.offset,
            hours_old=request.hours_old,
            is_remote=request.is_remote,
            job_type=request.job_type,
            linkedin_fetch_description=True,
            proxies=PROXIES,
            verbose=0,
        )
    except Exception as error:
        raise HTTPException(status_code=502, detail=f"jobspy error: {error}") from error

    results = []
    if frame is not None:
        for _, row in frame.iterrows():
            site = str(clean(row.get("site")) or "unknown").replace("Site.", "").lower()
            external_id = clean(row.get("id")) or clean(row.get("job_url")) or ""
            results.append({
                "site": site,
                "id": str(external_id),
                "title": clean(row.get("title")),
                "company": clean(row.get("company")),
                "location": clean(row.get("location")),
                "jobUrl": clean(row.get("job_url")),
                "jobUrlDirect": clean(row.get("job_url_direct")),
                "companyUrl": clean(row.get("company_url")),
                "companyUrlDirect": clean(row.get("company_url_direct")),
                "description": clean(row.get("description")),
                "isRemote": clean(row.get("is_remote")),
                "minimumAmount": clean(row.get("min_amount")),
                "maximumAmount": clean(row.get("max_amount")),
                "currency": clean(row.get("currency")),
                "interval": clean(row.get("interval")),
                "datePosted": clean(row.get("date_posted")),
                "jobType": clean(row.get("job_type")),
            })

    payload = {"count": len(results), "results": results, "warnings": []}
    CACHE[key] = payload
    return {"cached": False, **payload}
