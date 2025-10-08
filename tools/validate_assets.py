# -*- coding: utf-8 -*-
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict, List

ROOT = Path(__file__).resolve().parents[1]
ASSETS_DIR = ROOT / "assets"
LOCATIONS_PATH = ASSETS_DIR / "locations.json"
TYPES_PATH = ASSETS_DIR / "types.json"


def load_json(path: Path) -> Any:
    if not path.exists():
        raise FileNotFoundError(f"Fichier introuvable : {path}")
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise ValueError(f"JSON invalide dans {path}: {error}") from error


def validate_types(types: Dict[str, Dict[str, Any]], *, check_media: bool) -> List[str]:
    issues: List[str] = []
    for type_name, payload in types.items():
        icon = payload.get("icon")
        zoom = payload.get("zoom")
        if not isinstance(icon, str) or not icon:
            issues.append(f"Type '{type_name}': champ 'icon' manquant ou invalide")
        elif check_media:
            icon_path = ROOT / icon
            if not icon_path.exists():
                issues.append(f"Type '{type_name}': icone introuvable ({icon})")
        if zoom is None:
            issues.append(f"Type '{type_name}': champ 'zoom' manquant")
        elif not isinstance(zoom, (int, float)):
            issues.append(f"Type '{type_name}': champ 'zoom' doit etre numerique (actuel: {zoom!r})")
    return issues


def validate_locations(dataset: Dict[str, Any], types: Dict[str, Any], *, check_media: bool) -> List[str]:
    issues: List[str] = []
    seen_names: Dict[str, str] = {}
    for continent, raw_locations in dataset.items():
        if not isinstance(raw_locations, list):
            issues.append(f"Continent '{continent}': structure attendue = liste")
            continue
        for index, entry in enumerate(raw_locations):
            if not isinstance(entry, dict):
                issues.append(f"{continent}[{index}]: entree non objet JSON")
                continue
            name = (entry.get("name") or "").strip()
            if not name:
                issues.append(f"{continent}[{index}]: nom manquant")
                continue
            if name in seen_names:
                issues.append(f"Doublon de nom '{name}' (deja vu dans {seen_names[name]})")
            else:
                seen_names[name] = f"{continent}[{index}]"

            loc_type = (entry.get("type") or "default").strip()
            if loc_type != "default" and loc_type not in types:
                issues.append(f"{name}: type inconnu '{loc_type}'")

            for coord_key in ("x", "y"):
                value = entry.get(coord_key)
                if not isinstance(value, (int, float)):
                    issues.append(f"{name}: coordonnee '{coord_key}' invalide ({value!r})")

            audio_path = entry.get("audio")
            if audio_path:
                if not isinstance(audio_path, str):
                    issues.append(f"{name}: champ audio doit etre une chaine")
                elif check_media:
                    resolved = ROOT / audio_path
                    if not resolved.exists():
                        issues.append(f"{name}: fichier audio introuvable ({audio_path})")

            images = entry.get("images") or []
            if isinstance(images, list):
                for image in images:
                    if not isinstance(image, str):
                        issues.append(f"{name}: entree image non valide ({image!r})")
                        continue
                    if check_media:
                        resolved = ROOT / image
                        if not resolved.exists():
                            issues.append(f"{name}: image introuvable ({image})")
            elif images:
                issues.append(f"{name}: champ images doit etre une liste")
    return issues


def main() -> int:
    parser = argparse.ArgumentParser(description="Validation des ressources de la carte interactive")
    parser.add_argument("--locations", type=Path, default=LOCATIONS_PATH, help="Chemin du fichier locations.json")
    parser.add_argument("--types", type=Path, default=TYPES_PATH, help="Chemin du fichier types.json")
    parser.add_argument("--no-files", action="store_true", help="Ignore la verification de presence des fichiers medias")
    args = parser.parse_args()

    types_data = load_json(args.types)
    locations_data = load_json(args.locations)

    check_media = not args.no_files
    issues: List[str] = []
    issues.extend(validate_types(types_data, check_media=check_media))
    issues.extend(validate_locations(locations_data, types_data, check_media=check_media))

    if issues:
        print("\n[ERREUR] Problemes detectes :")
        for entry in issues:
            print(f" - {entry}")
    else:
        print("[OK] Aucun probleme detecte")

    total_locations = sum(len(v) for v in locations_data.values() if isinstance(v, list))
    print(f"\nResume : {len(types_data)} types, {total_locations} lieux analyses.")
    if issues and check_media:
        missing_files = [msg for msg in issues if "introuvable" in msg]
        if missing_files:
            print(f"- {len(missing_files)} fichiers medias manquants")
    return 1 if issues else 0


if __name__ == "__main__":
    raise SystemExit(main())
