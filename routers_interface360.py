"""Interface 360 router — interfaces, systems, routing paths, facets, stats."""
from __future__ import annotations
from fastapi import APIRouter
from .db import query

router = APIRouter(prefix="/interface360", tags=["interface360"])


@router.get("/interfaces")
def interfaces(source_system: str | None = None,
               target_system: str | None = None,
               source_project_id: str | None = None,
               target_project_id: str | None = None,
               feed_type: str | None = None,
               direction: str | None = None,
               migration_flag: str | None = None,
               carries_pii: str | None = None,
               limit: int = 100, offset: int = 0):
    where, params = ["1=1"], {"lim": limit, "off": offset}

    # Facets arrive as CSV for multi-selects (e.g. "AddVantage,AddVantage - API").
    # Split into an exact-match IN (...) so "AddVantage" never pulls in
    # "AddVantage - API". TRIM guards against whitespace from ingestion.
    # Param names below MUST match the UI filter keys in filterConfigs.js.
    def add_in(col: str, csv: str | None, prefix: str):
        if not csv:
            return
        vals = [v.strip() for v in csv.split(",") if v.strip()]
        if not vals:
            return
        keys = []
        for j, v in enumerate(vals):
            k = f"{prefix}{j}"
            params[k] = v
            keys.append(f":{k}")
        where.append(f"TRIM({col}) IN ({', '.join(keys)})")

    add_in("source_system", source_system, "ss")
    add_in("target_system", target_system, "ts")
    add_in("feed_type", feed_type, "ft")
    add_in("direction", direction, "dr")
    add_in("migration_flag", migration_flag, "mg")
    add_in("carries_pii", carries_pii, "pi")
    add_in("source_project_id", source_project_id, "sp")
    add_in("target_project_id", target_project_id, "tp")

    return {"interfaces": query(f"""
        SELECT interface_id, domain, application, integration_name, feed_type,
               source_system, source_project_id, target_system, target_project_id,
               direction, frequency, migration_flag, carries_pii, pii_categories,
               update_owner
        FROM interface360_interfaces WHERE {' AND '.join(where)}
        ORDER BY application
        OFFSET :off ROWS FETCH NEXT :lim ROWS ONLY""", params)}


@router.get("/systems")
def systems():
    return {"systems": query("""
        SELECT system_name, project_id, party, outbound_count, inbound_count,
               total_count, carries_pii
        FROM interface360_systems ORDER BY total_count DESC""")}


@router.get("/routing-paths")
def routing_paths(limit: int = 100):
    return {"hops": query("""
        SELECT interface_id, hop_order, system_name, project_id
        FROM interface360_routing_hops ORDER BY interface_id, hop_order
        FETCH FIRST :lim ROWS ONLY""", {"lim": limit})}


@router.get("/facets")
def facets():
    return {
        "source_system": query("""SELECT source_system AS value, COUNT(*) AS count
                                   FROM interface360_interfaces
                                   WHERE source_system IS NOT NULL
                                   GROUP BY source_system ORDER BY value"""),
        "target_system": query("""SELECT target_system AS value, COUNT(*) AS count
                                   FROM interface360_interfaces
                                   WHERE target_system IS NOT NULL
                                   GROUP BY target_system ORDER BY value"""),
        "feed_type": query("""SELECT feed_type AS value, COUNT(*) AS count
                              FROM interface360_interfaces
                              WHERE feed_type IS NOT NULL GROUP BY feed_type
                              ORDER BY count DESC"""),
        "source_project": query("""SELECT source_project_id AS value, COUNT(*) AS count
                                   FROM interface360_interfaces
                                   GROUP BY source_project_id"""),
        "target_project": query("""SELECT target_project_id AS value, COUNT(*) AS count
                                   FROM interface360_interfaces
                                   GROUP BY target_project_id"""),
    }


@router.get("/stats")
def stats():
    tot = query("SELECT COUNT(*) AS n FROM interface360_interfaces")
    sysn = query("SELECT COUNT(*) AS n FROM interface360_systems")
    pii = query("SELECT COUNT(*) AS n FROM interface360_interfaces WHERE carries_pii='Y'")
    mig = query("SELECT COUNT(*) AS n FROM interface360_interfaces WHERE migration_flag='Y'")
    cross = query("""SELECT COUNT(*) AS n FROM interface360_interfaces
                     WHERE source_project_id <> target_project_id""")
    return {
        "interfaces": tot[0]["n"] if tot else 0,
        "systems": sysn[0]["n"] if sysn else 0,
        "carry_pii": pii[0]["n"] if pii else 0,
        "migration": mig[0]["n"] if mig else 0,
        "cross_project": cross[0]["n"] if cross else 0,
    }
