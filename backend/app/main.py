import traceback
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import app.config  # noqa: F401 — ensures dirs are created on import


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure Supabase storage buckets exist on startup
    try:
        from app.supabase_client import ensure_buckets
        ensure_buckets()
    except Exception as exc:
        print(f"[startup] Could not ensure buckets: {exc}", flush=True)
    yield


from app.routes import projects, upload, analysis, report, mapping, case_definition, cleaning, dashboard_routes, share, template  # noqa: E402
from app.routes import payment  # noqa: E402

app = FastAPI(
    title="BananaEpi API",
    description="Outbreak Investigation Assistant",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def catch_all_exceptions(request: Request, call_next):
    try:
        response = await call_next(request)
        return response
    except Exception as exc:
        tb = traceback.format_exc()
        print(f"UNHANDLED EXCEPTION on {request.method} {request.url}: {type(exc).__name__}", flush=True)
        return JSONResponse(
            status_code=500,
            content={"detail": f"{type(exc).__name__}: {exc}", "traceback": tb},
        )


app.include_router(projects.router,          prefix="/projects",        tags=["Projects"])
app.include_router(upload.router,            prefix="/upload",          tags=["Upload"])
app.include_router(mapping.router,           prefix="/mapping",         tags=["Mapping"])
app.include_router(case_definition.router,   prefix="/case-definition", tags=["Case Definition"])
app.include_router(analysis.router,          prefix="/analysis",        tags=["Analysis"])
app.include_router(report.router,            prefix="/report",          tags=["Report"])
app.include_router(cleaning.router,          prefix="/cleaning",        tags=["Cleaning"])
app.include_router(dashboard_routes.router,  tags=["Dashboard"])
app.include_router(share.router,             tags=["Share"])
app.include_router(template.router,          tags=["Template"])
app.include_router(payment.router,           tags=["Payment"])


@app.get("/", tags=["Health"])
def root():
    return {"message": "BananaEpi API is running", "version": "2.0.0", "docs": "/docs"}


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok", "version": "v2-supabase"}
