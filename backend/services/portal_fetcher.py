import httpx
from typing import Optional
from schemas import MantisIssue


async def fetch_mantis_issue(portal_url: str, api_token: str, issue_id: str) -> MantisIssue:
    url = f"{portal_url.rstrip('/')}/api/rest/issues/{issue_id}"
    headers = {"Authorization": api_token}

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = client.build_request("GET", url, headers=headers)
        r = await client.send(response)

    if r.status_code == 404:
        raise ValueError(f"Issue #{issue_id} not found in Mantis portal.")
    if r.status_code == 401:
        raise PermissionError("Invalid API token. Please check your portal settings.")
    if not r.is_success:
        raise RuntimeError(f"Mantis API error: {r.status_code} — {r.text[:200]}")

    data = r.json().get("issues", [{}])[0] if "issues" in r.json() else r.json()

    description_raw = data.get("description", "")
    if isinstance(description_raw, dict):
        description_raw = description_raw.get("body", "")

    reporter = data.get("reporter", {})
    reporter_name = reporter.get("name", "") if isinstance(reporter, dict) else str(reporter)

    severity = data.get("severity", {})
    severity_label = severity.get("label", "") if isinstance(severity, dict) else str(severity)

    status = data.get("status", {})
    status_label = status.get("label", "") if isinstance(status, dict) else str(status)

    return MantisIssue(
        portal_task_id=str(issue_id),
        title=data.get("summary", f"Issue #{issue_id}"),
        description=description_raw,
        reporter=reporter_name,
        severity=severity_label,
        portal_status=status_label,
    )
