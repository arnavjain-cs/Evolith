"""Merge configured local specialist adapters without loading the base model."""
import argparse
import json

from modelforge.config import Settings
from modelforge.service import Service

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--coding", type=float, default=0.5)
    parser.add_argument("--writing", type=float, default=0.5)
    parser.add_argument("--humor", type=float, default=0)
    parser.add_argument("--thinking", type=float, default=0)
    parser.add_argument("--no-normalize", action="store_true")
    args = parser.parse_args()
    settings = Settings(mode="live")
    service = Service(settings)
    try:
        recipe = service.merger.create({"coding": args.coding, "humor": args.humor, "thinking": args.thinking, "writing": args.writing}, not args.no_normalize)
        print(json.dumps(recipe, indent=2))
        print("Adapter directory:", service.merger.path(recipe))
    finally:
        service.close()
