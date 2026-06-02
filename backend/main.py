from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine, Base
import models  # ensure all models are registered

from routers import members, tasks, labels, comments, attachments, portal, dashboard, config, todos, relations, releases, reports

Base.metadata.create_all(bind=engine)

app = FastAPI(title="TeamMan API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dashboard.router)
app.include_router(members.router)
app.include_router(tasks.router)
app.include_router(labels.router)
app.include_router(comments.router)
app.include_router(attachments.router)
app.include_router(portal.router)
app.include_router(config.router)
app.include_router(todos.router)
app.include_router(relations.router)
app.include_router(releases.router)
app.include_router(reports.router)


@app.get("/health")
def health():
    return {"status": "ok"}
