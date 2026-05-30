#!/usr/bin/env python3
"""Generate Tidy's committed codebase orientation graph."""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = Path(os.environ.get("TIDY_CODEBASE_GRAPH_OUTPUT", ROOT / "codebase-graph.json"))
GRAPHIFY_DIR = ROOT / "graphify-out"
GRAPHIFY_GRAPH = GRAPHIFY_DIR / "graph.json"
GRAPHIFY_REPORT = GRAPHIFY_DIR / "GRAPH_REPORT.md"

SCHEMA_VERSION = "tidy-codebase-graph/v1"
FALLBACK_GENERATOR = "scripts/generate_codebase_graph.py fallback scanner"
GRAPHIFY_GENERATOR = "graphify CLI via graphifyy"

PROTECTED_PATHS = [
    "app/generated/prisma",
    "node_modules",
    ".next",
    ".git",
    "graphify-out",
    "chroma-data",
    "coverage",
    "test-results",
    "playwright-report",
    "docs/SESSION_LOG",
]

READ_FIRST_FALLBACK = [
    "STATE.json",
    "codebase-graph.json",
    "docs/CODEX_RULES.md",
    "docs/VERSIONING.md",
    "docs/AI_HANDOFF.md",
    "docs/FUTURE_PLANS.md",
    "docs/PHASE_LOG.md",
    "docs/WORKFLOW.md",
]

READ_FIRST_GRAPHIFY = [
    "STATE.json",
    "codebase-graph.json",
    "graphify-out/GRAPH_REPORT.md",
    "docs/CODEX_RULES.md",
    "docs/VERSIONING.md",
    "docs/AI_HANDOFF.md",
    "docs/FUTURE_PLANS.md",
    "docs/PHASE_LOG.md",
    "docs/WORKFLOW.md",
]

SCANNED_EXTENSIONS = {
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".ps1",
    ".py",
    ".md",
    ".json",
    ".prisma",
}

ROOT_DOCS = {"AGENTS.md", "CLAUDE.md", "README.md", "STATE.json", "package.json"}
SYMBOL_LIMIT = 20

IMPORT_PATTERNS = [
    re.compile(r"""(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]"""),
    re.compile(r"""require\(\s*['"]([^'"]+)['"]\s*\)"""),
    re.compile(r"""import\(\s*['"]([^'"]+)['"]\s*\)"""),
]

SYMBOL_PATTERNS = [
    re.compile(r"\bexport\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)"),
    re.compile(r"\b(?:async\s+)?function\s+([A-Za-z_$][\w$]*)"),
    re.compile(r"\bexport\s+const\s+([A-Za-z_$][\w$]*)\s*="),
    re.compile(r"\bconst\s+([A-Za-z_$][\w$]*)\s*="),
    re.compile(r"\bexport\s+(?:interface|type|class)\s+([A-Za-z_$][\w$]*)"),
    re.compile(r"\b(?:interface|type|class)\s+([A-Za-z_$][\w$]*)"),
]


def repo_path(path: Path) -> str:
    return path.resolve().relative_to(ROOT).as_posix()


def is_protected(path: Path) -> bool:
    try:
        rel = repo_path(path)
    except ValueError:
        return True
    if rel == "codebase-graph.json":
        return True
    for protected in PROTECTED_PATHS:
        if rel == protected or rel.startswith(f"{protected}/"):
            return True
    return False


def read_version() -> str:
    state_path = ROOT / "STATE.json"
    with state_path.open("r", encoding="utf-8") as f:
        return json.load(f)["version"]


def generated_date() -> str:
    return datetime.now().strftime("%Y-%m-%d")


def classify(path: str) -> str:
    p = path.replace("\\", "/")
    name = Path(p).name
    if p.startswith("app/api/") or (p.startswith("app/") and p.endswith("/route.ts")):
        return "api_route"
    if p.startswith("app/") and p.endswith("/page.tsx"):
        return "page_route"
    if p.startswith("components/"):
        return "component"
    if p.startswith("hooks/"):
        return "hook"
    if p.startswith("lib/"):
        return "library"
    if p.startswith("trpc/routers/"):
        return "trpc_router"
    if p.startswith("trpc/"):
        return "trpc"
    if p.startswith("prisma/"):
        return "prisma"
    if p.startswith("scripts/"):
        return "script"
    if p.startswith("docs/"):
        return "documentation"
    if p.startswith("tests/"):
        return "test"
    if "/" not in p and name in ROOT_DOCS:
        return "root_doc"
    return "file"


def iter_source_files() -> list[Path]:
    files: list[Path] = []
    for current, dirnames, filenames in os.walk(ROOT):
        current_path = Path(current)
        dirnames[:] = sorted(
            [dirname for dirname in dirnames if not is_protected(current_path / dirname)],
            key=str.lower,
        )
        for filename in sorted(filenames, key=str.lower):
            path = current_path / filename
            if is_protected(path):
                continue
            if path.suffix in SCANNED_EXTENSIONS:
                files.append(path)
    return sorted(files, key=lambda p: repo_path(p).lower())


def extract_imports(text: str) -> list[str]:
    imports: list[str] = []
    seen: set[str] = set()
    for pattern in IMPORT_PATTERNS:
        for match in pattern.finditer(text):
            specifier = match.group(1)
            if specifier not in seen:
                seen.add(specifier)
                imports.append(specifier)
    return imports


def extract_symbols(text: str) -> list[str]:
    symbols: list[str] = []
    seen: set[str] = set()
    for pattern in SYMBOL_PATTERNS:
        for match in pattern.finditer(text):
            symbol = match.group(1)
            if symbol not in seen:
                seen.add(symbol)
                symbols.append(symbol)
                if len(symbols) >= SYMBOL_LIMIT:
                    return symbols
    return symbols


def candidate_paths(base: Path) -> list[Path]:
    candidates = [base]
    if base.suffix:
        return candidates
    for suffix in [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]:
        candidates.append(base.with_suffix(suffix))
    for index_name in ["index.ts", "index.tsx", "index.js", "index.jsx"]:
        candidates.append(base / index_name)
    return candidates


def resolve_import(source: Path, specifier: str) -> str | None:
    if specifier.startswith("@/"):
        base = ROOT / specifier[2:]
    elif specifier.startswith("."):
        base = (source.parent / specifier).resolve()
    else:
        return None

    for candidate in candidate_paths(base):
        try:
            candidate = candidate.resolve()
            if candidate.exists() and candidate.is_file() and not is_protected(candidate):
                return repo_path(candidate)
        except ValueError:
            continue
    return None


def fallback_graph() -> dict[str, Any]:
    nodes: list[dict[str, Any]] = []
    edges: list[dict[str, str]] = []

    for path in iter_source_files():
        rel = repo_path(path)
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            text = ""

        imports = extract_imports(text)
        symbols = extract_symbols(text)
        nodes.append(
            {
                "path": rel,
                "kind": classify(rel),
                "extension": path.suffix,
                "symbols": symbols,
                "imports": imports,
            }
        )

        for specifier in imports:
            target = resolve_import(path, specifier)
            if target:
                edges.append(
                    {
                        "from": rel,
                        "to": target,
                        "type": "imports",
                        "import": specifier,
                    }
                )

    edges.sort(key=lambda e: (e["from"].lower(), e["to"].lower(), e["import"].lower()))

    return {
        "schemaVersion": SCHEMA_VERSION,
        "version": read_version(),
        "generatedAt": generated_date(),
        "generator": FALLBACK_GENERATOR,
        "graphify": graphify_metadata(fallback_used=True),
        "protectedPathsExcluded": PROTECTED_PATHS,
        "readFirst": READ_FIRST_FALLBACK,
        "nodes": nodes,
        "edges": edges,
    }


def graphify_metadata(fallback_used: bool, extra: dict[str, Any] | None = None) -> dict[str, Any]:
    metadata: dict[str, Any] = {
        "preferredCli": "graphify",
        "package": "graphifyy",
        "fallbackUsed": fallback_used,
    }
    if extra:
        metadata.update(extra)
    return metadata


def run_graphify_cli() -> None:
    cli = shutil.which("graphify")
    if not cli:
        return

    GRAPHIFY_DIR.mkdir(exist_ok=True)
    command = [cli, "--output", str(GRAPHIFY_DIR), str(ROOT)]
    subprocess.run(
        command,
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        timeout=120,
        check=False,
    )


def graph_report_excerpt() -> str:
    if not GRAPHIFY_REPORT.exists():
        return ""
    text = GRAPHIFY_REPORT.read_text(encoding="utf-8", errors="replace").strip()
    lines = text.splitlines()
    return "\n".join(lines[:80])


def graphify_graph() -> dict[str, Any] | None:
    if not GRAPHIFY_GRAPH.exists():
        return None
    try:
        with GRAPHIFY_GRAPH.open("r", encoding="utf-8") as f:
            raw = json.load(f)
    except (OSError, json.JSONDecodeError):
        return None

    nodes = raw.get("nodes")
    edges = raw.get("edges")
    if not isinstance(nodes, list) or not isinstance(edges, list):
        return None

    return {
        "schemaVersion": SCHEMA_VERSION,
        "version": read_version(),
        "generatedAt": generated_date(),
        "generator": GRAPHIFY_GENERATOR,
        "graphify": graphify_metadata(
            fallback_used=False,
            extra={
                "graphPath": "graphify-out/graph.json",
                "reportPath": "graphify-out/GRAPH_REPORT.md",
                "reportExcerpt": graph_report_excerpt(),
            },
        ),
        "protectedPathsExcluded": PROTECTED_PATHS,
        "readFirst": READ_FIRST_GRAPHIFY,
        "nodes": nodes,
        "edges": edges,
    }


def write_graph(graph: dict[str, Any]) -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open("w", encoding="utf-8", newline="\n") as f:
        json.dump(graph, f, indent=2, ensure_ascii=False)
        f.write("\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate Tidy codebase graph.")
    parser.add_argument("--fallback-only", action="store_true", help="Skip Graphify CLI and use the fallback scanner.")
    args = parser.parse_args()

    graph: dict[str, Any] | None = None
    if not args.fallback_only:
        run_graphify_cli()
        graph = graphify_graph()

    if graph is None:
        graph = fallback_graph()

    write_graph(graph)


if __name__ == "__main__":
    main()
